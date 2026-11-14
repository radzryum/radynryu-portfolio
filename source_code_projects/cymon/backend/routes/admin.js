const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { completePastAppointments } = require('../lib/appointments');
const { createNotification } = require('../lib/notify');
const { writeAudit } = require('../lib/audit');
const { patientName, capitalizeNamePart } = require('../lib/names');
const dto = require('../lib/dto');
const { sendMail } = require('../lib/email');
const { dedupeLatestBy } = require('../lib/latest');
const { validatePassword } = require('../lib/password');
const {
  renderFormPdf,
  renderAttendancePdf,
  inferFormCode,
  normalizeDailyActivityRecord,
} = require('../lib/formPdf');
const {
  formatReleaseRequest,
  normalizeMoney,
} = require('../lib/documentReleases');
const {
  EXPORT_FORMATS,
  EXPORT_CONTENT_TYPES,
  exportDateStamp,
  toCsv,
  toXlsx,
  sendDownload,
} = require('../lib/exportFiles');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res
      .status(500)
      .json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const mine = [req.profile.role, ...(req.profile.extra_roles || [])];
  if (!mine.includes('admin') && !mine.includes('super_admin')) {
    return res.status(403).json({ error: 'Admin account required' });
  }
  next();
}

// Multi-branch scope: a Super Admin sees every branch by default and may
// narrow a list with ?clinic_id=<uuid>. Anyone else may narrow to a branch
// they are assigned to (home or via profile_clinics, migration 0114) and
// otherwise sees their acting branch (x-active-branch header). Lists return
// null = no filter (all branches).
function isSuperAdminReq(req) {
  return req.profile?.role === 'super_admin';
}

function branchIdsOf(req) {
  const ids = Array.isArray(req.profile?.branch_ids) && req.profile.branch_ids.length
    ? req.profile.branch_ids
    : [req.profile?.clinic_id].filter(Boolean);
  return [...new Set(ids.filter(Boolean))];
}

function listClinicScope(req) {
  const q = typeof req.query?.clinic_id === 'string' ? req.query.clinic_id.trim() : '';
  // Super Admin: explicit ?clinic_id= wins, then an acting-branch choice
  // from the header switcher, else all branches (null = no filter).
  if (isSuperAdminReq(req)) return q || (req.profile.branch_scoped ? req.profile.clinic_id : null);
  if (q && branchIdsOf(req).includes(q)) return q;
  return req.profile.clinic_id;
}

function canAccessClinic(req, rowClinicId) {
  return isSuperAdminReq(req) || branchIdsOf(req).includes(rowClinicId);
}

// Extra (non-home) branches of one profile. Empty when migration 0114 is
// not applied yet — callers treat that as "home branch only".
async function extraBranchIds(profileId) {
  try {
    const { data, error } = await supabase
      .from('profile_clinics')
      .select('clinic_id')
      .eq('profile_id', profileId);
    if (error) return [];
    return (data || []).map((r) => r.clinic_id).filter(Boolean);
  } catch {
    return [];
  }
}

// Profile ids that may act in a branch (home members + junction members).
async function profileIdsForClinic(clinicId) {
  try {
    const { data } = await supabase
      .from('profile_clinics')
      .select('profile_id')
      .eq('clinic_id', clinicId);
    return (data || []).map((r) => r.profile_id).filter(Boolean);
  } catch {
    return [];
  }
}

// Branch labels for list rows (avoids a PostgREST clinics join, which needs
// a declared FK). Returns { [clinicId]: { code, name } }.
async function clinicLabelMap() {
  const { data } = await supabase.from('clinics').select('id, code, name');
  const map = {};
  for (const c of data || []) map[c.id] = { code: c.code, name: c.name };
  return map;
}

function isMissingColumnError(error, columnName) {
  if (!error || !columnName) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes(columnName.toLowerCase()) &&
    (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'))
  );
}

// Admission signature dates (FO-01 ".../DATE" captions). Empty stays null;
// garbage or future dates are rejected like every other date in this file.
function cleanSignatureDate(value) {
  const text = String(value ?? '').trim().slice(0, 10);
  if (!text) return { date: null };
  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { error: 'Enter a valid signature date.' };
  if (parsed > new Date()) return { error: 'Signature date cannot be in the future.' };
  return { date: text };
}

router.use(requireAuth, requireAdmin);

router.patch('/onboarding', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const completed = req.body?.completed !== false;
    const { data, error } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: completed ? new Date().toISOString() : null })
      .eq('id', req.user.id)
      .select('id, onboarding_completed_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ profile: data });
  } catch (err) {
    return next(err);
  }
});

function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  // Invalid or future birthdates (bad data entry) must never render as a
  // negative age — callers show a placeholder for null.
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  if (birth > now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function appointmentParticipantNames(appointment) {
  return (Array.isArray(appointment?.appointment_participants) ? appointment.appointment_participants : [])
    .map((participant) => participant?.patients ? patientName(participant.patients) : null)
    .filter(Boolean);
}

function appointmentPatientLabel(appointment) {
  const participants = appointmentParticipantNames(appointment);
  if (appointment?.format === 'group' || participants.length) {
    return participants.join(', ') || 'Group session';
  }
  return patientName(appointment?.patients);
}

async function loadProfileDisplayNames(ids = []) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', uniqueIds);

  if (error) throw error;

  return Object.fromEntries((data || []).filter(row => row != null).map((row) => [row.id, row.display_name || '—']));
}

// Short "First M. Last Suffix" variant for tight table columns (Students
// list clinician cells). Full display_name stays in the database and in
// detail views, audit trails, and schedules — only list cells shorten.
// Parts are capitalized on the way out so records typed in lowercase at
// registration ("jerome") still render correctly everywhere.
function shortProfileName(row) {
  if (!row) return '—';
  const first = capitalizeNamePart(String(row.first_name || '').trim());
  const middle = String(row.middle_name || '').trim();
  const last = capitalizeNamePart(String(row.last_name || '').trim());
  const suffix = capitalizeNamePart(String(row.suffix_name || '').trim());
  if (!first && !last) return capitalizeNamePart(row.display_name || '—');
  const initial = middle ? `${middle.charAt(0).toUpperCase()}.` : '';
  return [first, initial, last, suffix].filter(Boolean).join(' ');
}

async function loadProfileShortNames(ids = []) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, middle_name, last_name, suffix_name')
    .in('id', uniqueIds);

  if (error) throw error;

  return Object.fromEntries((data || []).filter(row => row != null).map((row) => [row.id, shortProfileName(row)]));
}

async function countPatients(clinicId, filter) {
  let q = supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);
  if (filter) q = filter(q);
  const { count } = await q;
  return count || 0;
}

async function countWaivers(statuses) {
  const { count } = await supabase
    .from('waiver_submissions')
    .select('*', { count: 'exact', head: true })
    .in('status', statuses);
  return count || 0;
}

router.get('/overview', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic. scope null = no filter.
    const scope = listClinicScope(req);
    const scopeEq = (q, col = 'clinic_id') => (scope ? q.eq(col, scope) : q);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const next7Days = new Date(now);
    next7Days.setDate(next7Days.getDate() + 7);

    const monthStartIso = monthStart.toISOString();
    const nextMonthIso = nextMonth.toISOString();
    const todayStartIso = todayStart.toISOString();
    const todayEndIso = todayEnd.toISOString();
    const next7DaysIso = next7Days.toISOString();

    const [
      { data: patients, error: patientsErr },
      { data: employees, error: employeesErr },
      { data: waivers, error: waiversErr },
      { data: attendanceRows, error: attendanceErr },
      { data: appointments, error: appointmentsErr },
      { data: templates, error: templatesErr },
      { data: activationRequests, error: activationErr },
      { data: permissions, error: permissionsErr },
      { data: submissions, error: submissionsErr },
      { data: activity, error: activityErr },
    ] = await Promise.all([
      scopeEq(supabase
        .from('patients')
        .select('id, patient_id, first_name, middle_name, last_name, date_of_birth, status, admission_form_status, treating_psychologist_id, treating_psychometrician_id, created_at, photo_url'))
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      scopeEq(supabase
        .from('profiles')
        .select('id, display_name, role, extra_roles, created_at'))
        .neq('role', 'client')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      (() => {
        // Scoped to this clinic at the DB level (was: all clinics, filtered
        // in JS). The !inner join turns the clinic check into a filter.
        // Skipped entirely for a cross-branch (Super Admin) view.
        const q = supabase
          .from('waiver_submissions')
          .select('id, due_date, status, document_type_code, patient_id, provisions_agreed, signature_text, signed_at, patients!inner(first_name, middle_name, last_name, patient_id), document_types(title)')
          .is('patients.deleted_at', null)
          .in('status', ['pending_signature', 'overdue', 'submitted', 'approved']);
        return scopeEq(q, 'patients.clinic_id');
      })(),
      supabase
        .from('student_attendance_records')
        .select(`
          id,
          date,
          status,
          time_in,
          time_out,
          remarks,
          student_attendance_session_forms (
            month_year,
            program_enrolled,
            patient_id,
            patients (
              first_name,
              last_name,
              patient_id
            )
          )
        `)
        .gte('date', monthStartIso.slice(0, 10))
        .lt('date', nextMonthIso.slice(0, 10))
        .order('date', { ascending: false }),
      scopeEq(supabase
        .from('appointments')
        .select('id, starts_at, session_type, color_tag, location, practitioner_id, format, patients:patients!appointments_patient_id_fkey(first_name, middle_name, last_name), appointment_participants!appointment_participants_appointment_id_fkey(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, middle_name, last_name))'))
        .gte('starts_at', todayStartIso)
        .lt('starts_at', next7DaysIso)
        .order('starts_at', { ascending: true }),
      supabase
        .from('assessment_templates')
        .select('id, title, document_type_code, is_active')
        .order('title', { ascending: true }),
      scopeEq(supabase
        .from('assessment_activation_requests')
        .select('id, note, status, created_at, template_id, assessment_templates(title), requested_by:requested_by_id(display_name)'))
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      scopeEq(supabase
        .from('assessment_permissions')
        .select('id, patient_id, template_id, status, requested_by_id, patients(first_name, last_name, patient_id), assessment_templates(title), requested_by:requested_by_id(display_name)'))
        .eq('status', 'pending'),
      (() => {
        const q = supabase
          .from('assessment_submissions')
          .select('id, patient_id, status, created_at, patients!inner(clinic_id)')
          .is('patients.deleted_at', null)
          .in('status', ['processed', 'scored', 'submitted']);
        return scopeEq(q, 'patients.clinic_id');
      })(),
      scopeEq(supabase
        .from('audit_log')
        .select('id, action, summary, severity, created_at, actor_id'))
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    if (patientsErr) return next(patientsErr);
    if (employeesErr) return next(employeesErr);
    if (waiversErr) return next(waiversErr);
    if (attendanceErr) return next(attendanceErr);
    if (appointmentsErr) return next(appointmentsErr);
    if (templatesErr) return next(templatesErr);
    if (activationErr) return next(activationErr);
    if (permissionsErr) return next(permissionsErr);
    if (submissionsErr) return next(submissionsErr);
    if (activityErr) return next(activityErr);

    const patientIds = new Set((patients || []).map((p) => p.id));
    const staffIds = [
      ...(patients || []).flatMap((p) => [p.treating_psychologist_id, p.treating_psychometrician_id]),
      ...(appointments || []).map((a) => a.practitioner_id),
      ...(activity || []).map((a) => a.actor_id),
    ].filter(Boolean);

    const staffNames = await loadProfileDisplayNames(staffIds);
    // Tight table cells use the short "First M. Last" form (see above).
    const staffShortNames = await loadProfileShortNames(
      (patients || []).flatMap((p) => [p.treating_psychologist_id, p.treating_psychometrician_id]),
    );

    const patientNameById = Object.fromEntries((patients || []).map((p) => [p.id, patientName(p)]));
    const isStaffRole = (profile, role) => [profile.role, ...(profile.extra_roles || [])].includes(role);

    const currentPatients = (patients || []).map((p) => ({
      ...p,
      name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
      age: ageFromDob(p.date_of_birth),
      treating_psychologist_name: p.treating_psychologist_id ? staffShortNames[p.treating_psychologist_id] || null : null,
      treating_psychometrician_name: p.treating_psychometrician_id ? staffShortNames[p.treating_psychometrician_id] || null : null,
    }));

    const currentWaivers = (waivers || [])
      .filter((w) => patientIds.has(w.patient_id))
      .map((w) => ({
        ...w,
        student: w.patients ? patientName(w.patients) : patientNameById[w.patient_id] || '—',
        title: w.document_types ? w.document_types.title : w.document_type_code,
      }));

    const currentAttendance = (attendanceRows || [])
      .filter((row) => row.student_attendance_session_forms && patientIds.has(row.student_attendance_session_forms.patient_id))
      .map((row) => {
        const form = row.student_attendance_session_forms;
        return {
          id: row.id,
          date: row.date,
          status: row.status,
          timeIn: row.time_in,
          timeOut: row.time_out,
          remarks: row.remarks,
          studentName: form && form.patients ? `${form.patients.first_name} ${form.patients.last_name}` : 'Unknown Student',
          patientId: form ? form.patient_id : null,
          program: form ? form.program_enrolled : '',
        };
      });

    const currentAppointments = (appointments || []).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      session_type: a.session_type,
      color_tag: a.color_tag,
      format: a.format || (appointmentParticipantNames(a).length ? 'group' : 'individual'),
      participants: appointmentParticipantNames(a),
      location: a.location,
      practitioner: a.practitioner_id ? staffNames[a.practitioner_id] || '—' : '—',
      patient: appointmentPatientLabel(a),
    }));

    const activeStudents = currentPatients.filter((p) => p.status === 'active').length;
    const pendingAdmissions = currentPatients.filter((p) => p.status === 'pending' || ['pending', 'in_progress'].includes(p.admission_form_status)).length;
    const newThisMonth = currentPatients.filter((p) => p.created_at && p.created_at >= monthStartIso && p.created_at < nextMonthIso).length;
    const assignedPsychologist = currentPatients.filter((p) => p.treating_psychologist_id).length;
    const assignedPsychometrician = currentPatients.filter((p) => p.treating_psychometrician_id).length;
    const unassignedPsychologist = currentPatients.length - assignedPsychologist;
    const unassignedPsychometrician = currentPatients.length - assignedPsychometrician;

    const isSuperAdmin = req.profile.role === 'super_admin';
    const staffRows = (employees || [])
      .filter((p) => isSuperAdmin || p.role !== 'super_admin')
      .map((p) => ({ ...p, roles: [p.role, ...(p.extra_roles || [])].filter(Boolean) }));
    // Role counts overlap: one person holding both psychologist and
    // psychometrician roles appears in BOTH counts but counts as ONE staff
    // member in `total`. `multi_role` makes that explicit for the UI.
    const staffSummary = {
      total: staffRows.length,
      admins: staffRows.filter((p) => isStaffRole(p, 'admin')).length,
      psychologists: staffRows.filter((p) => isStaffRole(p, 'psychologist')).length,
      psychometricians: staffRows.filter((p) => isStaffRole(p, 'psychometrician')).length,
      multi_role: staffRows.filter((p) => p.roles.length > 1).length,
      therapists: 0, // speech_therapist and occupational_therapist roles have been removed
    };

    const complianceSummary = {
      overdue: currentWaivers.filter((w) => w.status === 'overdue').length,
      pendingSignature: currentWaivers.filter((w) => w.status === 'pending_signature').length,
      submitted: currentWaivers.filter((w) => w.status === 'submitted').length,
      approved: currentWaivers.filter((w) => w.status === 'approved').length,
      total: currentWaivers.length,
    };

    const attendanceSummary = currentAttendance.reduce((acc, row) => {
      acc.total += 1;
      if (row.status === 'Present') acc.present += 1;
      else if (row.status === 'Absent') acc.absent += 1;
      else if (row.status === 'Excused') acc.excused += 1;
      return acc;
    }, { total: 0, present: 0, absent: 0, excused: 0 });
    attendanceSummary.presentRate = attendanceSummary.total > 0
      ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
      : 100;

    const activeTemplates = (templates || []).filter((t) => t.is_active).length;
    const pendingActivationRequests = (activationRequests || []).length;
    const pendingPermissions = (permissions || []).length;
    const submissionsThisMonth = (submissions || []).filter((s) => s.created_at && s.created_at >= monthStartIso && s.created_at < nextMonthIso && patientIds.has(s.patient_id)).length;

    const todayAppointments = currentAppointments.filter((a) => a.starts_at >= todayStartIso && a.starts_at < todayEndIso).length;
    const upcoming7Days = currentAppointments.length;
    const groupAppointments = currentAppointments.filter((appointment) => appointment.format === 'group').length;
    const individualAppointments = currentAppointments.filter((appointment) => appointment.format !== 'group').length;

    const urgentWaivers = currentWaivers
      .filter((w) => w.status === 'overdue' || w.status === 'pending_signature')
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
      .slice(0, 5)
      .map((w) => ({
        id: w.id,
        student: w.student,
        doc: w.title,
        code: w.document_type_code,
        due_date: w.due_date,
        status: w.status,
      }));

    const needsAttention = [
      pendingAdmissions > 0
        ? {
          label: 'Pending admissions',
          value: pendingAdmissions,
          detail: 'Student admission records still need review or completion.',
          to: '/admin/patients',
        }
        : null,
      complianceSummary.overdue > 0
        ? {
          label: 'Overdue waivers',
          value: complianceSummary.overdue,
          detail: 'Parents or guardians still need to sign submitted forms.',
          to: '/admin/compliance',
        }
        : null,
      pendingActivationRequests > 0
        ? {
          label: 'Assessment requests',
          value: pendingActivationRequests,
          detail: 'Pending activation requests are waiting for review.',
          to: '/admin/assessments',
        }
        : null,
      pendingPermissions > 0
        ? {
          label: 'Assessment permissions',
          value: pendingPermissions,
          detail: 'Pending assessment access requests are waiting approval.',
          to: '/admin/assessments',
        }
        : null,
      unassignedPsychometrician > 0
        ? {
          label: 'Students without RPm',
          value: unassignedPsychometrician,
          detail: 'Students still need an assigned psychometrician.',
          to: '/admin/patients',
        }
        : null,
      unassignedPsychologist > 0
        ? {
          label: 'Students without RPsy',
          value: unassignedPsychologist,
          detail: 'Students still need an assigned psychologist.',
          to: '/admin/patients',
        }
        : null,
    ].filter(Boolean);

    res.json({
      stats: {
        totalActive: activeStudents,
        pendingAdmissions,
        waiversMissing: complianceSummary.overdue + complianceSummary.pendingSignature,
      },
      snapshot: {
        students: {
          total: currentPatients.length,
          active: activeStudents,
          pending: pendingAdmissions,
          newThisMonth,
          assignedPsychologist,
          assignedPsychometrician,
          unassignedPsychologist,
          unassignedPsychometrician,
        },
        staff: staffSummary,
        compliance: {
          ...complianceSummary,
          needsAction: complianceSummary.overdue + complianceSummary.pendingSignature,
        },
        attendance: attendanceSummary,
        schedule: {
          today: todayAppointments,
          upcoming7Days,
          group: groupAppointments,
          individual: individualAppointments,
        },
        assessments: {
          activeTemplates,
          pendingActivationRequests,
          pendingPermissions,
          submissionsThisMonth,
        },
      },
      needsAttention,
      upcomingAppointments: currentAppointments.slice(0, 5),
      recentAdmissions: currentPatients
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5),
      urgentWaivers,
      recentAudit: (activity || []).map((l) => ({
        ...l,
        actor: staffNames[l.actor_id] || 'System',
      })),
      activity: (activity || []).map((l) => ({
        ...l,
        actor: staffNames[l.actor_id] || 'System',
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/patients', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const includeArchived = String(req.query.include_archived || '').toLowerCase() === 'true';
    // Optional server-side pagination (backward compatible: omitted = all rows).
    // NOTE: 0 means "no pagination" — Math.max(1, ...) here would turn an
    // omitted page/limit into page=1,limit=1 and hide every row but one.
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const limit = Math.min(100, Math.max(0, parseInt(req.query.limit, 10) || 0));
    const search = String(req.query.search || '').trim();
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const scope = listClinicScope(req);
    let listQuery = supabase
      .from('patients')
      .select('id, clinic_id, patient_id, first_name, middle_name, last_name, date_of_birth, sex, status, admission_form_status, treating_psychologist_id, treating_psychometrician_id, created_at, deleted_at, clinical_profiles(iep_level), photo_url, waiver_submissions(id, document_type_code, status)', { count: page ? 'exact' : undefined });
    if (scope) listQuery = listQuery.eq('clinic_id', scope);
    if (!includeArchived) listQuery = listQuery.is('deleted_at', null);
    if (search) {
      const like = `%${search}%`;
      listQuery = listQuery.or(`first_name.ilike.${like},middle_name.ilike.${like},last_name.ilike.${like},patient_id.ilike.${like}`);
    }
    if (page > 0 && limit > 0) {
      const from = (page - 1) * limit;
      listQuery = listQuery.range(from, from + limit - 1);
    }
    // Newest registrations first so recently added/assigned students sit on
    // top of admin and clinician rosters instead of the bottom.
    const { data, error, count } = await listQuery.order('created_at', { ascending: false });
    if (error) return next(error);

    const staffNames = await loadProfileDisplayNames([
      ...(data || []).map((p) => p.treating_psychologist_id),
      ...(data || []).map((p) => p.treating_psychometrician_id),
    ]);
    // Tight table cells use the short "First M. Last" form; full names stay
    // in detail views, schedules, and audit trails.
    const staffShortNames = await loadProfileShortNames([
      ...(data || []).map((p) => p.treating_psychologist_id),
      ...(data || []).map((p) => p.treating_psychometrician_id),
    ]);
    const clinicLabels = await clinicLabelMap();

    res.json({
      patients: (data || []).map((p) => ({
        id: p.id,
        clinic_id: p.clinic_id,
        clinic_code: clinicLabels[p.clinic_id]?.code || null,
        clinic_name: clinicLabels[p.clinic_id]?.name || null,
        patient_id: p.patient_id,
        name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        first_name: p.first_name,
        middle_name: p.middle_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        age: ageFromDob(p.date_of_birth),
        sex: p.sex,
        status: p.status,
        admission_form_status: p.admission_form_status,
        waiver_submissions: p.waiver_submissions || [],
        treating_psychologist_id: p.treating_psychologist_id,
        treating_psychometrician_id: p.treating_psychometrician_id,
        treating_psychologist_name: p.treating_psychologist_id ? staffShortNames[p.treating_psychologist_id] || null : null,
        treating_psychometrician_name: p.treating_psychometrician_id ? staffShortNames[p.treating_psychometrician_id] || null : null,
        enrollment_type: p.clinical_profiles?.iep_level || null,
        created_at: p.created_at,
        is_archived: !!p.deleted_at,
        deleted_at: p.deleted_at || null,
      })),
      ...(page > 0 && limit > 0 ? { pagination: { page, limit, total: count ?? null } } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// Soft-archive a student record (reversible via /restore). The row stays in
// the database with deleted_at set, so it is hidden from all default
// listings but remains recoverable —unlike DELETE which removes it permanently.
router.patch('/patients/:id/archive', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let archiveQuery = supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('deleted_at', null);
    if (!isSuperAdminReq(req)) archiveQuery = archiveQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await archiveQuery
      .select('id, clinic_id, first_name, last_name, patient_id')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Student not found or already archived' });

    await writeAudit({
      clinicId: data.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'archive_patient',
      entityType: 'patient',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} archived student ${data.first_name} ${data.last_name} (ID: ${data.patient_id}).`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/patients/:id/restore', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let restoreQuery = supabase
      .from('patients')
      .update({ deleted_at: null })
      .eq('id', req.params.id)
      .not('deleted_at', 'is', null);
    if (!isSuperAdminReq(req)) restoreQuery = restoreQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await restoreQuery
      .select('id, clinic_id, first_name, last_name, patient_id')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Archived student not found' });

    await writeAudit({
      clinicId: data.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'restore_patient',
      entityType: 'patient',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} restored archived student ${data.first_name} ${data.last_name} (ID: ${data.patient_id}).`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Admission applications submitted through the public QR/link form.
// Staff-only: review each entry, import it into the full admission form,
// then mark it imported (or rejected for spam/duplicates).
router.get('/applications', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const status = String(req.query.status || '').trim();
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const scope = listClinicScope(req);
    let q = supabase
      .from('admission_applications')
      .select('id, clinic_id, status, payload, parent_printed_name, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (scope) q = q.eq('clinic_id', scope);
    if (['pending', 'imported', 'rejected'].includes(status)) q = q.eq('status', status);
    const { data: rows, error } = await q;
    if (error) return next(error);
    const clinicLabels = await clinicLabelMap();
    res.json({
      applications: (rows || []).map((r) => {
        const p = r.payload?.patient || {};
        return {
          id: r.id,
          clinic_id: r.clinic_id,
          clinic_code: clinicLabels[r.clinic_id]?.code || null,
          clinic_name: clinicLabels[r.clinic_id]?.name || null,
          status: r.status,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
          child_name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
          date_of_birth: p.date_of_birth || null,
          sex: p.sex || null,
          parent_printed_name: r.parent_printed_name,
          payload: r.payload,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/applications/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const status = String(req.body?.status || '').trim();
    if (!['imported', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be imported or rejected.' });
    }
    let updQuery = supabase
      .from('admission_applications')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: req.profile.id })
      .eq('id', req.params.id)
      .eq('status', 'pending');
    // Regular admins may only touch their own branch; Super Admin may act
    // on any branch.
    if (!isSuperAdminReq(req)) updQuery = updQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await updQuery
      .select('id, clinic_id, payload')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Pending application not found.' });

    const p = data.payload?.patient || {};
    await writeAudit({
      clinicId: data.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: status === 'imported' ? 'import_application' : 'reject_application',
      entityType: 'admission_application',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} ${status} the admission application for ${[p.first_name, p.last_name].filter(Boolean).join(' ') || 'an applicant'}.`,
      severity: status === 'rejected' ? 'warn' : 'info',
    });

    // Retire the bell items: the "New admission application" notification
    // is a to-do, and the to-do is done. Mark it read for EVERY recipient
    // (branch admins + Super Admins) so nobody clicks into a stale badge.
    // Best-effort — a notification failure must never fail the resolve.
    try {
      const { error: retireError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('entity_type', 'admission_application')
        .eq('entity_id', data.id)
        .is('read_at', null);
      // Missing entity columns = migration 0113 not applied yet. The
      // resolve itself already succeeded; just log and move on.
      if (retireError) console.error('[applications] failed to retire notifications:', retireError.message);
    } catch (notifyErr) {
      console.error('[applications] failed to retire notifications:', notifyErr.message);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Single application for notification deep-links
// (/admin/applications?application=<id>): reports whichever tab holds the
// record plus who resolved it, so a stale bell click lands on the right
// place with context instead of an empty Pending list.
router.get('/applications/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let q = supabase
      .from('admission_applications')
      .select('id, clinic_id, status, payload, parent_printed_name, created_at, reviewed_at, reviewed_by')
      .eq('id', req.params.id);
    // Regular admins may only open their own branch; Super Admin any.
    if (!isSuperAdminReq(req)) q = q.eq('clinic_id', req.profile.clinic_id);
    const { data: r, error } = await q.maybeSingle();
    if (error) return next(error);
    if (!r) return res.status(404).json({ error: 'Application not found.' });
    const clinicLabels = await clinicLabelMap();
    let reviewedByName = null;
    if (r.reviewed_by) {
      const { data: reviewer } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', r.reviewed_by)
        .maybeSingle();
      reviewedByName = reviewer?.display_name || null;
    }
    const p = r.payload?.patient || {};
    res.json({
      application: {
        id: r.id,
        clinic_id: r.clinic_id,
        clinic_code: clinicLabels[r.clinic_id]?.code || null,
        clinic_name: clinicLabels[r.clinic_id]?.name || null,
        status: r.status,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        reviewed_by_name: reviewedByName,
        child_name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
        date_of_birth: p.date_of_birth || null,
        sex: p.sex || null,
        parent_printed_name: r.parent_printed_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// This clinic's public identity (code + name + address) for the QR/link
// admission form and branch badges.
router.get('/clinic', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('id, code, name, address')
      .eq('id', req.profile.clinic_id)
      .maybeSingle();
    if (error) return next(error);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found.' });
    res.json({ clinic });
  } catch (err) {
    next(err);
  }
});

// Branch list for Super Admin only (branch selector in admission/employee
// forms). Regular admins never see other branches — they are locked to their
// own clinic_id by every query below.
router.get('/clinics', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    if (req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can list branches.' });
    }
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id, code, name, address')
      .order('code', { ascending: true });
    if (error) return next(error);
    res.json({ clinics: clinics || [] });
  } catch (err) {
    next(err);
  }
});

router.patch('/patients/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const body = req.body || {};
    // Optimistic concurrency guard (backward compatible): if the caller sends
    // `expected_updated_at`, reject stale writes with 409 instead of silently
    // overwriting a newer edit from another clinician.
    if (body.expected_updated_at) {
      let curQuery = supabase
        .from('patients')
        .select('updated_at')
        .eq('id', req.params.id);
      // Regular admins may only touch their own branch; Super Admin may
      // act on any branch.
      if (!isSuperAdminReq(req)) curQuery = curQuery.eq('clinic_id', req.profile.clinic_id);
      const { data: current } = await curQuery.maybeSingle();
      if (current?.updated_at && current.updated_at !== body.expected_updated_at) {
        return res.status(409).json({ error: 'This record was updated by another user. Please reload and try again.' });
      }
    }
    const child = body.child || {};
    const clinical = body.clinical || {};
    const guardians = Array.isArray(body.guardians) ? body.guardians : null;
    const emergency = body.emergency || {};
    const patientPatch = {};
    const clinicalPatch = {};

    const first_name = child.first_name ?? body.first_name;
    const middle_name = child.middle_name ?? body.middle_name;
    const last_name = child.last_name ?? body.last_name;
    const date_of_birth = child.date_of_birth ?? body.date_of_birth;
    const sex = child.sex ?? body.sex;
    const status = body.status;
    const treating_psychologist_id = body.treating_psychologist_id ?? body.patient?.treating_psychologist_id;
    const treating_psychometrician_id = body.treating_psychometrician_id ?? body.patient?.treating_psychometrician_id;
    const parent_signature = body.parent_signature ?? body.patient?.parent_signature;
    const parent_printed_name = body.parent_printed_name ?? body.patient?.parent_printed_name;
    const parent_signature_date = body.parent_signature_date ?? body.patient?.parent_signature_date;
    const rep_signature = body.rep_signature ?? body.patient?.rep_signature;
    const rep_printed_name = body.rep_printed_name ?? body.patient?.rep_printed_name;
    const rep_signature_date = body.rep_signature_date ?? body.patient?.rep_signature_date;
    const rep_profession = body.rep_profession ?? body.patient?.rep_profession;
    const rep_license_no = body.rep_license_no ?? body.patient?.rep_license_no;
    const permanent_address = body.permanent_address ?? body.patient?.permanent_address;
    const previously_diagnosed = body.previously_diagnosed ?? body.patient?.previously_diagnosed;
    const other_disability = body.other_disability ?? body.patient?.other_disability;
    const photoValue = child.photo ?? body.photo;
    const admission_form_status = body.admission_form_status;

    if (first_name !== undefined) patientPatch.first_name = first_name;
    if (middle_name !== undefined) patientPatch.middle_name = middle_name || null;
    if (last_name !== undefined) patientPatch.last_name = last_name;
    if (date_of_birth !== undefined) {
      // A future birthdate is always a data-entry mistake — reject it here
      // so it can never surface as a negative age in rosters and reports.
      if (date_of_birth && (Number.isNaN(new Date(date_of_birth).getTime()) || new Date(date_of_birth) > new Date())) {
        return res.status(400).json({ error: 'Enter a valid date of birth (not in the future).' });
      }
      patientPatch.date_of_birth = date_of_birth || null;
    }
    if (sex !== undefined) patientPatch.sex = sex;
    if (status !== undefined) {
      if (!['active', 'pending', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      patientPatch.status = status;
    }
    if (admission_form_status !== undefined) {
      if (!['complete', 'pending', 'in_progress'].includes(admission_form_status)) {
        return res.status(400).json({ error: 'Invalid admission form status' });
      }
      patientPatch.admission_form_status = admission_form_status;
    }
    if (treating_psychologist_id !== undefined) patientPatch.treating_psychologist_id = treating_psychologist_id || null;
    if (treating_psychometrician_id !== undefined) patientPatch.treating_psychometrician_id = treating_psychometrician_id || null;
    if (parent_signature !== undefined) patientPatch.parent_signature = parent_signature || null;
    if (parent_printed_name !== undefined) patientPatch.parent_printed_name = parent_printed_name || null;
    if (parent_signature_date !== undefined) {
      const cleaned = cleanSignatureDate(parent_signature_date);
      if (cleaned.error) return res.status(400).json({ error: cleaned.error });
      patientPatch.parent_signature_date = cleaned.date;
    }
    if (rep_signature !== undefined) patientPatch.rep_signature = rep_signature || null;
    if (rep_signature_date !== undefined) {
      const cleaned = cleanSignatureDate(rep_signature_date);
      if (cleaned.error) return res.status(400).json({ error: cleaned.error });
      patientPatch.rep_signature_date = cleaned.date;
    }
    if (rep_printed_name !== undefined) patientPatch.rep_printed_name = rep_printed_name || null;
    if (rep_profession !== undefined) patientPatch.rep_profession = rep_profession || null;
    if (rep_license_no !== undefined) patientPatch.rep_license_no = rep_license_no || null;
    if (permanent_address !== undefined) patientPatch.permanent_address = permanent_address || null;
    if (previously_diagnosed !== undefined) patientPatch.previously_diagnosed = previously_diagnosed ?? null;
    if (other_disability !== undefined) patientPatch.other_disability = other_disability ?? null;

    if (photoValue !== undefined) {
      const photoMatch = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(photoValue || '');
      if (photoMatch) {
        const ext = photoMatch[2] === 'jpeg' || photoMatch[2] === 'jpg' ? 'jpg' : photoMatch[2];
        const buffer = Buffer.from(photoMatch[3], 'base64');
        if (buffer.length <= 5 * 1024 * 1024) {
          const path = `patients/${req.params.id}/${require('crypto').randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('photos')
            .upload(path, buffer, { contentType: photoMatch[1], upsert: true });
          if (!upErr) {
            patientPatch.photo_url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
          }
        }
      } else if (photoValue === null) {
        patientPatch.photo_url = null;
      }
    }

    if (clinical.primary_diagnosis !== undefined) clinicalPatch.primary_diagnosis = clinical.primary_diagnosis || null;
    if (clinical.iep_level !== undefined) clinicalPatch.iep_level = clinical.iep_level || null;
    if (clinical.secondary_diagnosis !== undefined) clinicalPatch.secondary_diagnosis = clinical.secondary_diagnosis || null;
    if (clinical.date_enrolled !== undefined) clinicalPatch.date_enrolled = clinical.date_enrolled || null;
    if (clinical.referral_source !== undefined) clinicalPatch.referral_source = clinical.referral_source || null;
    if (clinical.allergies !== undefined) clinicalPatch.allergies = clinical.allergies || null;
    if (treating_psychologist_id !== undefined) clinicalPatch.treating_psychologist_id = treating_psychologist_id || null;
    if (treating_psychometrician_id !== undefined) clinicalPatch.treating_psychometrician_id = treating_psychometrician_id || null;

    if (Object.keys(patientPatch).length === 0 && Object.keys(clinicalPatch).length === 0 && guardians === null && body.emergency === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let updPatientQuery = supabase
      .from('patients')
      .update(patientPatch)
      .eq('id', req.params.id)
      .is('deleted_at', null);
    if (!isSuperAdminReq(req)) updPatientQuery = updPatientQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await updPatientQuery
      .select('id, clinic_id')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Patient not found' });

    if (Object.keys(clinicalPatch).length > 0) {
      const { error: clinicalErr } = await supabase
        .from('clinical_profiles')
        .upsert({ patient_id: req.params.id, ...clinicalPatch }, { onConflict: 'patient_id' });
      if (clinicalErr) return res.status(400).json({ error: clinicalErr.message });
    }

    if (guardians) {
      await supabase.from('guardians').delete().eq('patient_id', req.params.id);
      const guardianRows = guardians.filter((g) => g && g.full_name).map((g, i) => ({
        patient_id: req.params.id,
        full_name: g.full_name,
        relationship: g.relationship || null,
        contact_number: g.contact_number || null,
        email: g.email || null,
        occupation: g.occupation || null,
        employer: g.employer || null,
        is_primary: i === 0,
      }));
      if (guardianRows.length) {
        const { error: guardianErr } = await supabase.from('guardians').insert(guardianRows);
        if (guardianErr) return res.status(400).json({ error: guardianErr.message });
      }
    }

    if (body.emergency !== undefined) {
      await supabase.from('emergency_contacts').delete().eq('patient_id', req.params.id);
      if (emergency && emergency.full_name) {
        const { error: emergencyErr } = await supabase.from('emergency_contacts').insert({
          patient_id: req.params.id,
          full_name: emergency.full_name,
          relationship: emergency.relationship || null,
          contact_number: emergency.contact_number || null,
          alt_contact_number: emergency.alt_contact_number || null,
          address: emergency.address || null,
        });
        if (emergencyErr) return res.status(400).json({ error: emergencyErr.message });
      }
    }

    await writeAudit({
      clinicId: data.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'update_patient',
      entityType: 'patient',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} updated a student record.`,
    });
    await refreshEnrollmentStatus(data.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/patients/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: patient, error: getErr } = await supabase
      .from('patients')
      .select('id, clinic_id, patient_id, first_name, last_name, photo_url')
      .eq('id', req.params.id)
      .maybeSingle();
    // Regular admins may only touch their own branch; Super Admin may act
    // on any branch.
    if (getErr) return res.status(400).json({ error: getErr.message });
    if (!patient || !canAccessClinic(req, patient.clinic_id)) return res.status(404).json({ error: 'Student not found' });

    // Clean up the one known patient-linked table that does not cascade.
    // Other patient-linked tables are already configured with ON DELETE CASCADE.
    const { error: surveyErr } = await supabase
      .from('survey_responses')
      .delete()
      .eq('patient_id', req.params.id);
    if (surveyErr && !/table.*survey_responses|relation.*survey_responses/i.test(surveyErr.message || '')) {
      return res.status(400).json({ error: surveyErr.message });
    }

    let delPatientQuery = supabase
      .from('patients')
      .delete()
      .eq('id', req.params.id);
    if (!isSuperAdminReq(req)) delPatientQuery = delPatientQuery.eq('clinic_id', req.profile.clinic_id);

    const { error: delErr } = await delPatientQuery;

    if (delErr) return res.status(400).json({ error: delErr.message });

    await writeAudit({
      clinicId: patient.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'delete_patient',
      entityType: 'patient',
      entityId: patient.id,
      summary: `Permanently deleted student record for ${patient.first_name} ${patient.last_name} (ID: ${patient.patient_id}).`,
      severity: 'alert',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const COMPLIANCE_FORM_CODES = [
  'CMPS:SE-FO-01',
  'CMPS:SE-FO-02',
  'CMPS:SE-FO-12',
];

router.get('/compliance', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic. Downstream waiver/guardian
    // queries follow patientIds, so scoping here scopes everything.
    const complianceScope = listClinicScope(req);
    let compliancePatientsQuery = supabase
      .from('patients')
      .select('id, clinic_id, patient_id, first_name, middle_name, last_name, caregiver_id, admission_form_status, photo_url')
      .is('deleted_at', null)
      .order('patient_id', { ascending: true });
    if (complianceScope) compliancePatientsQuery = compliancePatientsQuery.eq('clinic_id', complianceScope);
    const [{ data: patients, error: patientsError }, { data: types, error: typesError }] = await Promise.all([
      compliancePatientsQuery,
      supabase
        .from('document_types')
        .select('code, title, description, category')
        .in('code', COMPLIANCE_FORM_CODES),
    ]);
    if (patientsError) return next(patientsError);
    if (typesError) return next(typesError);

    const patientIds = (patients || []).map((patient) => patient.id);
    let rows = [];
    let guardians = [];
    if (patientIds.length) {
      const [subResult, guardResult] = await Promise.all([
        supabase
          .from('waiver_submissions')
          .select(
            'id, due_date, status, document_type_code, patient_id, provisions_agreed, house_rules_agreed, signature_text, signed_at, answer_notes, review_comment, answered_at, created_at, updated_at, answered_by:answered_by_id(display_name)'
          )
          .in('patient_id', patientIds)
          .in('document_type_code', COMPLIANCE_FORM_CODES),
        supabase
          .from('guardians')
          .select('patient_id, full_name, email, is_primary')
          .in('patient_id', patientIds),
      ]);
      if (subResult.error) return next(subResult.error);
      if (guardResult.error) return next(guardResult.error);
      rows = subResult.data || [];
      guardians = guardResult.data || [];
    }

    const uniqueRows = dedupeLatestBy(
      rows,
      (r) => `${r.patient_id}:${r.document_type_code}`,
      ['updated_at', 'signed_at', 'created_at'],
    );

    const guardianByPatient = {};
    (guardians || []).forEach((g) => {
      if (!guardianByPatient[g.patient_id] || g.is_primary) guardianByPatient[g.patient_id] = g;
    });

    const typeOrder = new Map(COMPLIANCE_FORM_CODES.map((code, index) => [code, index]));
    const orderedTypes = [...new Map((types || []).map((type) => [type.code, type])).values()].sort(
      (a, b) => (typeOrder.get(a.code) ?? 99) - (typeOrder.get(b.code) ?? 99),
    );
    const submissionByKey = new Map(
      uniqueRows.map((row) => [`${row.patient_id}:${row.document_type_code}`, row]),
    );

    const complianceLabels = await clinicLabelMap();

    const responseRows = (patients || []).flatMap((patient) => {      const guardian = guardianByPatient[patient.id];
      return orderedTypes.map((type) => {
        const submission = submissionByKey.get(`${patient.id}:${type.code}`);
        const admissionComplete =
          type.code === 'CMPS:SE-FO-01' && patient.admission_form_status === 'complete';
        return {
          id: submission?.id || null,
          clinic_id: patient.clinic_id,
          clinic_code: complianceLabels[patient.clinic_id]?.code || null,
          clinic_name: complianceLabels[patient.clinic_id]?.name || null,
          patient_id: patient.id,
          student: patientName(patient),
          sid: patient.patient_id || '—',
          parent: guardian?.full_name || '—',
          email: guardian?.email || null,
          doc: type.title,
          description: type.description,
          category: type.category,
          code: type.code,
          due_date: null,
          status: submission?.status || (admissionComplete ? 'approved' : 'not_started'),
          provisions_agreed: submission?.provisions_agreed || {},
          house_rules_agreed: submission?.house_rules_agreed || false,
          signature_text: submission?.signature_text || null,
          signed_at: submission?.signed_at || null,
          answer_notes: submission?.answer_notes || null,
          review_comment: submission?.review_comment || null,
          answered_at: submission?.answered_at || null,
          answered_by: submission?.answered_by || null,
          editable: type.category === 'waiver' && submission?.status !== 'approved',
        };
      });
    });

    const overdue = responseRows.filter((row) => row.status === 'overdue').length;
    const pending = responseRows.filter((row) => row.status === 'pending_signature').length;
    const compliant = responseRows.filter((row) => ['submitted', 'approved'].includes(row.status)).length;

    res.json({
      summary: { overdue, pending, compliant, total: patients?.length || 0 },
      rows: responseRows,
    });
  } catch (err) {
    next(err);
  }
});

// Enrollment status rule (shown with a legend in Student Management):
// active = admission complete + FO-02 waiver approved; pending = otherwise.
// 'inactive' is a manual admin state and is never auto-changed. Best-effort;
// callers must never let this fail the clinical operation.
async function refreshEnrollmentStatus(patientId) {
  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, status, admission_form_status')
      .eq('id', patientId)
      .maybeSingle();
    if (!patient || patient.status === 'inactive') return patient?.status || null;
    const { data: waiver } = await supabase
      .from('waiver_submissions')
      .select('id')
      .eq('patient_id', patientId)
      .eq('document_type_code', 'CMPS:SE-FO-02')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();
    const computed = patient.admission_form_status === 'complete' && waiver ? 'active' : 'pending';
    if (computed !== patient.status) {
      await supabase.from('patients').update({ status: computed }).eq('id', patientId);
    }
    return computed;
  } catch {
    return null;
  }
}

// Notify the assigned psychologist/psychometrician when a student's SPED
// Consent & Waiver (FO-02) is approved — the student becomes official and
// appears in their student directory. The link deep-links into the Intake
// Interview with the student preselected (?patientId=), since intake is the
// first thing to do for a new student. Best-effort; never throws.
//
// The message names WHICH directory (psychologist vs psychometrician):
// dual-role holders (e.g. acting psychometrician but assigned psychologist)
// otherwise get a "visible in your directory" notice for a directory they
// can't find the student in.
async function notifyNewStudentAssignees(patient, documentCode) {
  if (!patient || documentCode !== 'CMPS:SE-FO-02') return;
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'A new student';
  const label = `${name}${patient.patient_id ? ` (${patient.patient_id})` : ''}`;
  const directoryFor = (role) => `is now visible in your ${role} student directory.`;

  // Roster visibility needs same-branch + assignment + compliance gates, but
  // this notice used to promise visibility unconditionally — a cross-branch
  // assignment produced exactly the confusion of a bell that opens an empty
  // directory. Look up assignee home branches; on a mismatch, name the
  // student's branch and link at the directory (where they land after
  // switching) instead of a dead intake deep-link. Lookup failures fall
  // back to the same-branch wording below.
  const assigneeIds = [...new Set(
    [patient.treating_psychologist_id, patient.treating_psychometrician_id].filter(Boolean),
  )];
  const homeById = {};
  if (assigneeIds.length) {
    try {
      const { data: rows } = await supabase
        .from('profiles')
        .select('id, clinic_id')
        .in('id', assigneeIds);
      for (const r of rows || []) homeById[r.id] = r.clinic_id;
    } catch {
      // fall through to same-branch wording
    }
  }
  let studentBranch = null;
  if (patient.clinic_id) {
    try {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('code, name')
        .eq('id', patient.clinic_id)
        .maybeSingle();
      const haystack = `${clinic?.code || ''} ${clinic?.name || ''}`;
      const m = haystack.match(/cabuyao|alabang/i);
      studentBranch = m
        ? m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase()
        : (clinic?.name || clinic?.code || null);
    } catch {
      studentBranch = null;
    }
  }
  const needsSwitch = (id) => Boolean(studentBranch && homeById[id] && homeById[id] !== patient.clinic_id);

  const targets = [];
  if (patient.treating_psychologist_id) {
    // Same person assigned as both → one notice naming both directories.
    const both = patient.treating_psychometrician_id === patient.treating_psychologist_id;
    if (needsSwitch(patient.treating_psychologist_id)) {
      targets.push({
        recipientId: patient.treating_psychologist_id,
        link: `/psychologist/students?patientId=${patient.id}`,
        body: `${label} completed compliance and is assigned to you in ${studentBranch}. Switch to that branch to view them in your student directory.`,
      });
    } else {
      targets.push({
        recipientId: patient.treating_psychologist_id,
        link: `/psychologist/intake?patientId=${patient.id}`,
        body: both
          ? `${label} completed compliance and is now visible in your psychologist and psychometrician student directories.`
          : `${label} completed compliance and ${directoryFor('psychologist')}`,
      });
    }
  }
  if (patient.treating_psychometrician_id && patient.treating_psychometrician_id !== patient.treating_psychologist_id) {
    if (needsSwitch(patient.treating_psychometrician_id)) {
      targets.push({
        recipientId: patient.treating_psychometrician_id,
        link: `/psychometrician/roster?patientId=${patient.id}`,
        body: `${label} completed compliance and is assigned to you in ${studentBranch}. Switch to that branch to view them in your student directory.`,
      });
    } else {
      targets.push({
        recipientId: patient.treating_psychometrician_id,
        link: `/psychometrician/intake?patientId=${patient.id}`,
        body: `${label} completed compliance and ${directoryFor('psychometrician')}`,
      });
    }
  }
  await Promise.all(targets.map((t) => createNotification({
    clinicId: patient.clinic_id,
    recipientId: t.recipientId,
    type: 'waiver',
    title: 'New student in your directory',
    body: t.body,
    link: t.link,
  })));
}

router.put('/compliance/:patientId/:code', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const code = decodeURIComponent(req.params.code || '');
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, patient_id, first_name, last_name, caregiver_id, clinic_id, photo_url, treating_psychometrician_id, treating_psychologist_id')
      .eq('id', req.params.patientId)
      .is('deleted_at', null)
      .maybeSingle();
    if (patientError) return next(patientError);
    // Super Admins work across branches (the compliance list shows all
    // branches for them), so scope like the sibling endpoints do — a strict
    // home-clinic check 404s every cross-branch completion as "Student not
    // found". Regular admins stay locked to their own clinic.
    if (!patient || !canAccessClinic(req, patient.clinic_id)) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { data: documentType, error: typeError } = await supabase
      .from('document_types')
      .select('code, title, category')
      .eq('code', code)
      .maybeSingle();
    if (typeError) return next(typeError);
    if (!documentType || (documentType.category !== 'waiver' && code !== 'CMPS:SE-FO-01')) {
      return res.status(400).json({ error: 'Only waiver forms can be answered from Compliance.' });
    }

    const {
      provisions_agreed: provisionsAgreed,
      house_rules_agreed: houseRulesAgreed,
      signature_text: signatureText,
      notes,
    } = req.body || {};
    const values = provisionsAgreed && typeof provisionsAgreed === 'object' ? provisionsAgreed : {};
    const acknowledgements =
      values.acknowledgements && typeof values.acknowledgements === 'object'
        ? values.acknowledgements
        : {};
    const requiredText = [
      ['parent_name', 'Parent / guardian name'],
      ['child_name', 'Student name'],
      ['parent_date', 'Parent signature date'],
      ['rep_name', 'CMPS representative name'],
      ['rep_contact', 'CMPS representative contact number'],
      ['rep_date', 'CMPS representative signature date'],
    ];
    if (code !== 'CMPS:SE-FO-01') {
      requiredText.push(['parent_contact', 'Parent contact number']);
    }

    const missingField = requiredText.find(([key]) => !String(values[key] || '').trim());
    if (missingField) {
      return res.status(400).json({ error: `${missingField[1]} is required.` });
    }
    if (!values.signature_image || !values.rep_signature_image) {
      return res.status(400).json({ error: 'Both parent and CMPS representative signatures are required.' });
    }
    if (code !== 'CMPS:SE-FO-01') {
      if (!houseRulesAgreed || !Object.keys(acknowledgements).length || Object.values(acknowledgements).some((value) => value !== true)) {
        return res.status(400).json({ error: 'Every provision and house rule must be acknowledged before completion.' });
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from('waiver_submissions')
      .select('id, status')
      .eq('patient_id', patient.id)
      .eq('document_type_code', code)
      .maybeSingle();
    if (existingError) return next(existingError);
    if (existing?.status === 'approved') {
      return res.status(409).json({ error: 'This compliance form is already complete and cannot be edited again.' });
    }

    const now = new Date().toISOString();
    const payload = {
      patient_id: patient.id,
      document_type_code: code,
      signed_by_profile_id: req.profile.id,
      signed_at: now,
      signature_text: String(signatureText || values.parent_name).trim(),
      provisions_agreed: values,
      house_rules_agreed: true,
      status: 'approved',
      due_date: null,
      answer_notes: notes ? String(notes).trim().slice(0, 300) : null,
      answered_by_id: req.profile.id,
      answered_at: now,
    };
    const saveQuery = existing
      ? supabase.from('waiver_submissions').update(payload).eq('id', existing.id)
      : supabase.from('waiver_submissions').insert(payload);
    const { data: saved, error: saveError } = await saveQuery.select('*').single();
    if (saveError) return res.status(400).json({ error: saveError.message });

    if (code === 'CMPS:SE-FO-01') {
      await supabase.from('patients').update({ admission_form_status: 'complete' }).eq('id', patient.id);
    }

    if (patient.caregiver_id) {
      await createNotification({
        clinicId: patient.clinic_id,
        recipientId: patient.caregiver_id,
        type: 'waiver',
        title: 'Compliance form completed',
        body: `${documentType.title} for ${patient.first_name} is now available to view.`,
        link: `/client/waivers/${encodeURIComponent(code)}?view=true`,
        email: {
          subject: `Completed Compliance Form: ${patient.first_name} - ClearMind Clinic`,
        },
      });
    }

    await notifyNewStudentAssignees(patient, code);

    // Completing either compliance form can flip enrollment to active.
    await refreshEnrollmentStatus(patient.id);

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'complete_compliance_form',
      entityType: 'waiver_submission',
      entityId: saved.id,
      summary: `${req.profile.display_name || 'Administrator'} completed ${documentType.title} for ${patient.patient_id || patient.first_name}.`,
    });
    res.json({ ok: true, submission: saved });
  } catch (err) {
    next(err);
  }
});

// remind the caregiver about a pending/overdue waiver
router.post('/compliance/:id/remind', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: w } = await supabase
      .from('waiver_submissions')
      .select('id, status, document_type_code, patients(caregiver_id, clinic_id, first_name), document_types(title)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!w || !w.patients || !canAccessClinic(req, w.patients.clinic_id)) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    const docTitle = w.document_types ? w.document_types.title : w.document_type_code;
    await createNotification({
      clinicId: w.patients.clinic_id,
      recipientId: w.patients.caregiver_id,
      type: 'waiver',
      title: 'Document reminder',
      body: `${docTitle} for ${w.patients.first_name} is ${w.status === 'overdue' ? 'overdue' : 'awaiting your signature'}. Please complete it under Consents & Waivers.`,
      link: '/client/waivers',
    });

    // Send email notification to parent
    const { data: parent } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', w.patients.caregiver_id)
      .maybeSingle();

    if (parent && parent.email) {
      await sendMail({
        to: parent.email,
        subject: `Reminder: Action Required for ${w.patients.first_name}'s Document - ClearMind Clinic`,
        templateKey: 'complianceReminder',
        replyToClinicId: w.patients.clinic_id,
        templateData: {
          parent_name: parent.display_name,
          student_name: w.patients.first_name,
          document_title: docTitle,
          status_text: w.status === 'overdue' ? 'overdue' : 'awaiting your signature',
        },
      }).catch((e) => console.error('[email] failed to send compliance reminder:', e.message));
    }

    await writeAudit({
      clinicId: w.patients?.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'send_compliance_reminder',
      entityType: 'waiver_submission',
      entityId: w.id,
      summary: `${req.profile.display_name || 'Administrator'} sent a reminder for ${docTitle || 'a compliance document'} for ${w.patients.first_name}.`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// mark a compliance item as processed (document received / submitted)
router.patch('/compliance/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status, notes, provisions_agreed, house_rules_agreed, signature_text } = req.body || {};
    const { data: w } = await supabase
      .from('waiver_submissions')
      .select('id, status, document_type_code, patients(id, clinic_id, patient_id, first_name, last_name, treating_psychometrician_id, treating_psychologist_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!w || !w.patients || !canAccessClinic(req, w.patients.clinic_id)) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    if (w.status === 'approved') {
      return res.status(409).json({ error: 'This compliance item is already complete and cannot be edited again.' });
    }

    const patch = {
      answered_by_id: req.profile.id,
      answered_at: new Date().toISOString(),
    };

    if (status && ['pending_signature', 'submitted', 'approved', 'overdue', 'returned'].includes(status)) {
      patch.status = status;
    } else if (!status) {
      patch.status = 'submitted';
    } else {
      return res.status(400).json({ error: 'Invalid compliance status' });
    }

    if (notes !== undefined) patch.answer_notes = notes || null;
    if (provisions_agreed !== undefined) patch.provisions_agreed = provisions_agreed || {};
    if (house_rules_agreed !== undefined) patch.house_rules_agreed = Boolean(house_rules_agreed);
    if (signature_text !== undefined) patch.signature_text = signature_text || null;
    if (req.body.review_comment !== undefined) patch.review_comment = req.body.review_comment || null;

    const { error } = await supabase
      .from('waiver_submissions')
      .update(patch)
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    if (patch.status === 'approved') {
      await notifyNewStudentAssignees(w.patients, w.document_type_code);
    }
    await writeAudit({
      clinicId: w.patients?.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: patch.status === 'approved' ? 'complete_compliance_form' : 'update_compliance_form',
      entityType: 'waiver_submission',
      entityId: w.id,
      summary: `${req.profile.display_name || 'Administrator'} ${patch.status === 'approved' ? 'completed' : 'updated'} a student compliance form.`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Return a client-submitted compliance/waiver form back to the client with a
// comment describing what needs to change. The client can then edit and re-submit.
router.post('/compliance/:id/return', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const comment = String(req.body.review_comment || '').trim();
    if (!comment) {
      return res.status(400).json({ error: 'A comment explaining what to change is required.' });
    }

    const { data: w, error } = await supabase
      .from('waiver_submissions')
      .select('id, status, document_type_code, patients(caregiver_id, clinic_id, first_name), document_types(title)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return next(error);
    if (!w || !w.patients || !canAccessClinic(req, w.patients.clinic_id)) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    if (w.status === 'approved') {
      return res.status(409).json({ error: 'This compliance form is already complete and cannot be returned.' });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('waiver_submissions')
      .update({ status: 'returned', review_comment: comment.slice(0, 1000), answered_by_id: req.profile.id, answered_at: now })
      .eq('id', w.id);
    if (updateError) return res.status(400).json({ error: updateError.message });

    const docTitle = w.document_types ? w.document_types.title : w.document_type_code;
    await createNotification({
      clinicId: w.patients.clinic_id,
      recipientId: w.patients.caregiver_id,
      type: 'waiver',
      title: 'Compliance form returned for revision',
      body: `${docTitle} for ${w.patients.first_name} was returned. Review the clinic note and update the form.`,
      link: `/client/waivers/${encodeURIComponent(w.document_type_code)}`,
    });

    const { data: parent } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', w.patients.caregiver_id)
      .maybeSingle();
    if (parent && parent.email) {
      await sendMail({
        to: parent.email,
        subject: `Revision Needed: ${w.patients.first_name}'s Compliance Form - ClearMind Clinic`,
        templateKey: 'complianceReturned',
        replyToClinicId: w.patients.clinic_id,
        templateData: {
          parent_name: parent.display_name,
          student_name: w.patients.first_name,
          document_title: docTitle,
          comment,
        },
      }).catch((e) => console.error('[email] failed to send compliance-returned notice:', e.message));
    }

    await writeAudit({
      clinicId: w.patients?.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'return_compliance_form',
      entityType: 'waiver_submission',
      entityId: w.id,
      summary: `${req.profile.display_name || 'Administrator'} returned ${docTitle || 'a compliance form'} for ${w.patients.first_name} for revision.`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/schedule', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const schedScope = listClinicScope(req);
    if (schedScope) {
      await completePastAppointments(supabase, schedScope);
    } else {
      // Cross-branch view: sweep every branch so stale rows complete.
      const { data: scopeClinics } = await supabase.from('clinics').select('id');
      for (const c of scopeClinics || []) await completePastAppointments(supabase, c.id);
    }
    let schedQuery = supabase
      .from('appointments')
      .select('id, clinic_id, starts_at, session_type, color_tag, location, practitioner_id, status, format, patients:patients!appointments_patient_id_fkey(first_name, middle_name, last_name), appointment_participants!appointment_participants_appointment_id_fkey(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, middle_name, last_name)), practitioner:profiles!appointments_practitioner_id_fkey(display_name)');
    if (schedScope) schedQuery = schedQuery.eq('clinic_id', schedScope);
    const { data: rows, error } = await schedQuery.order('starts_at', { ascending: true });
    if (error) return next(error);

    const schedLabels = await clinicLabelMap();
    res.json({
      appointments: (rows || []).map((r) => ({
        id: r.id,
        clinic_id: r.clinic_id,
        clinic_code: schedLabels[r.clinic_id]?.code || null,
        clinic_name: schedLabels[r.clinic_id]?.name || null,
        patient: appointmentPatientLabel(r),
        participants: appointmentParticipantNames(r),
        format: r.format || (appointmentParticipantNames(r).length ? 'group' : 'individual'),
        status: r.status || 'scheduled',
        practitioner: r.practitioner?.display_name || '—',
        starts_at: r.starts_at,
        session_type: r.session_type,
        color_tag: r.color_tag,
        location: r.location,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/schedule/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, clinic_id, practitioner_id, patient_id, starts_at, session_type, location, patients:patients!appointments_patient_id_fkey(first_name, last_name)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!appt || !canAccessClinic(req, appt.clinic_id)) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });

    // Tell the practitioner their session was removed — a silent delete
    // leaves them preparing for a session that no longer exists.
    if (appt.practitioner_id) {
      const who = appt.patients
        ? `${appt.patients.first_name || ''} ${appt.patients.last_name || ''}`.trim() || 'A student'
        : 'A group session';
      const when = appt.starts_at
        ? new Date(appt.starts_at).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'the scheduled time';
      const { data: practitionerProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', appt.practitioner_id)
        .maybeSingle();
      const practitionerTasksPath = practitionerProfile?.role === 'psychologist' ? '/psychologist' : '/psychometrician';
      await createNotification({
        clinicId: appt.clinic_id || req.profile.clinic_id,
        recipientId: appt.practitioner_id,
        type: 'appointment',
        title: 'Session removed',
        body: `${who} on ${when} was removed from the schedule by the Front Desk.`,
        link: practitionerTasksPath,
      }).catch(() => {});
    }

    await writeAudit({
      clinicId: appt.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'delete_appointment',
      entityType: 'appointment',
      entityId: appt.id,
      summary: `${req.profile.display_name || 'Administrator'} deleted an appointment.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// update an appointment status (scheduled/completed/cancelled)
router.patch('/schedule/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status } = req.body || {};
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use scheduled, completed, or cancelled.' });
    }
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, clinic_id, practitioner_id, patient_id, starts_at, session_type, location, patients:patients!appointments_patient_id_fkey(first_name, last_name)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!appt || !canAccessClinic(req, appt.clinic_id)) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { data: updated, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, status')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // A cancellation must reach the practitioner too — otherwise the session
    // silently disappears from their queue with no explanation.
    if (status === 'cancelled' && appt.practitioner_id) {
      const who = appt.patients
        ? `${appt.patients.first_name || ''} ${appt.patients.last_name || ''}`.trim() || 'A student'
        : 'A group session';
      const when = appt.starts_at
        ? new Date(appt.starts_at).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'the scheduled time';
      const { data: practitionerProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', appt.practitioner_id)
        .maybeSingle();
      const practitionerTasksPath = practitionerProfile?.role === 'psychologist' ? '/psychologist' : '/psychometrician';
      await createNotification({
        clinicId: appt.clinic_id || req.profile.clinic_id,
        recipientId: appt.practitioner_id,
        type: 'appointment',
        title: 'Session cancelled',
        body: `${who} on ${when} was cancelled by the Front Desk.`,
        link: practitionerTasksPath,
      }).catch(() => {});
    }

    await writeAudit({
      clinicId: appt.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'update_appointment',
      entityType: 'appointment',
      entityId: appt.id,
      summary: `${req.profile.display_name || 'Administrator'} marked an appointment as ${status}.`,
      severity: 'info',
    });
    res.json({ appointment: updated });
  } catch (err) {
    next(err);
  }
});

const MAX_ANNOUNCEMENT_IMAGES = 5;

const uploadAnnouncementImage = async (dataUrl, clinicId) => {
  const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) {
    throw new Error('Provide a PNG, JPEG, or WEBP image');
  }
  const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5 MB');
  }
  const path = `announcements/${clinicId}/${require('crypto').randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('photos')
    .upload(path, buffer, { contentType: m[1], upsert: true });
  if (upErr) {
    throw new Error(upErr.message);
  }
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
};

// Upload several data-URL images (slideshow), returning their public URLs.
const uploadAnnouncementImages = async (dataUrls, clinicId) => {
  const list = (Array.isArray(dataUrls) ? dataUrls : []).filter(Boolean).slice(0, MAX_ANNOUNCEMENT_IMAGES);
  const urls = [];
  for (const dataUrl of list) {
    urls.push(await uploadAnnouncementImage(dataUrl, clinicId));
  }
  return urls;
};

router.get('/documents', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const [{ data: rawReports, error: repErr }, { data: rawSubs, error: subErr }, { data: rawDars, error: darErr }] =
      await Promise.all([
        supabase
          .from('assessment_reports')
          .select('id, title, report_type, document_type_code, status, finalized_at, updated_at, created_at, content, period, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, deleted_at), document_types(title)')
          .in('status', ['approved', 'finalized'])
          .order('finalized_at', { ascending: false }),
        supabase
          .from('assessment_submissions')
          .select('id, template_id, status, submitted_at, updated_at, total_score, max_score, respondent_name, answers, domain_scores, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, deleted_at), assessment_templates(title, document_type_code, document_types(title))')
          .in('status', ['processed', 'scored'])
          .order('submitted_at', { ascending: false }),
        supabase
          .from('session_logs')
          .select('id, patient_id, author_id, session_number, session_date, activity_title, target_domain, objectives, procedure, observations, status, created_at, updated_at, prepared_signature_image, prepared_signature_date, reviewed_by_id, reviewer_signature_image, reviewer_comment, reviewed_at, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, deleted_at)')
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
      ]);

    if (repErr) {
      // Migrations 0094/0099 (report periods) not applied yet: retry the
      // reports query without the period column instead of failing the vault.
      if (/period/i.test(repErr.message || '')) {
        const { data: legacyReports, error: legacyErr } = await supabase
          .from('assessment_reports')
          .select('id, title, report_type, document_type_code, status, finalized_at, updated_at, created_at, content, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, deleted_at), document_types(title)')
          .in('status', ['approved', 'finalized'])
          .order('finalized_at', { ascending: false });
        if (legacyErr) return next(legacyErr);
        (legacyReports || [])
          .filter((r) => usablePatient(r.patients))
          .forEach((r) => {
            const iepLike = r.report_type === 'iep' || /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(r.title || '');
            combined.push({
              id: r.id,
              sourceTable: 'assessment_reports',
              name: patientName(r.patients),
              photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
              sid: r.patients ? r.patients.patient_id : '—',
              type: r.title || (iepLike ? 'Individualized Educational Plan' : r.report_type === 'progress_summary' ? 'Monthly Assessment Report' : 'Behavioral Assessment Report'),
              code: iepLike && (!r.document_type_code || r.document_type_code === 'CMPS:SE-FO-08')
                ? 'CMPS:SE-FO-10'
                : r.document_type_code || (r.report_type === 'progress_summary' ? 'CMPS:SE-FO-08' : 'CMPS:SE-FO-06'),
              finalized_at: r.finalized_at || r.updated_at || r.created_at,
              period: null,
              details: r,
            });
          });
      } else {
        return next(repErr);
      }
    }
    if (subErr) return next(subErr);
    if (darErr) return next(darErr);

    // Normalize and combine
    const combined = [];

    // Rows whose student is archived/deleted are skipped: they cannot be
    // previewed (the PDF loader would 404 on the missing bundle).
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const docScope = listClinicScope(req);
    const usablePatient = (p) => {
      if (!p || p.deleted_at) return false;
      if (isSuperAdminReq(req)) return !docScope || p.clinic_id === docScope;
      return p.clinic_id === req.profile.clinic_id;
    };
    (rawReports || [])
      .filter((r) => usablePatient(r.patients))
      .forEach((r) => {
      const iepLike = r.report_type === 'iep' || /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(r.title || '');
      combined.push({
        id: r.id,
        sourceTable: 'assessment_reports',
        name: patientName(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients ? r.patients.patient_id : '—',
        type: r.title || (iepLike ? 'Individualized Educational Plan' : r.report_type === 'progress_summary' ? 'Monthly Assessment Report' : 'Behavioral Assessment Report'),
        code: iepLike && (!r.document_type_code || r.document_type_code === 'CMPS:SE-FO-08')
          ? 'CMPS:SE-FO-10'
          : r.document_type_code || (r.report_type === 'progress_summary' ? 'CMPS:SE-FO-08' : 'CMPS:SE-FO-06'),
        finalized_at: r.finalized_at || r.updated_at || r.created_at,
        period: r.period || null,
        details: r
      });
      });

    (rawSubs || [])
      .filter((s) => usablePatient(s.patients))
      .forEach((s) => {
      const tpl = s.assessment_templates || {};
      const docType = tpl.document_types || {};
      combined.push({
        id: s.id,
        sourceTable: 'assessment_submissions',
        name: patientName(s.patients),
        photo_url: s.patients?.photo_url || s.patients?.patients?.photo_url || null,
        sid: s.patients ? s.patients.patient_id : '—',
        type: tpl.title || docType.title || 'Standardized Assessment',
        code: tpl.document_type_code || 'CMPS:SE-FO-04',
        finalized_at: s.submitted_at || s.updated_at,
        details: s
      });
      });

    (rawDars || []).filter((dar) => usablePatient(dar.patients)).forEach((dar) => {
      combined.push({
        id: dar.id,
        sourceTable: 'session_logs',
        name: patientName(dar.patients),
        photo_url: dar.patients?.photo_url || dar.patients?.patients?.photo_url || null,
        sid: dar.patients ? dar.patients.patient_id : '—',
        type: 'Daily Activity Report',
        code: 'CMPS:SE-FO-07',
        finalized_at: dar.reviewed_at || dar.updated_at || dar.created_at,
        details: dar,
      });
    });

    // Sort combined list by finalized_at descending
    combined.sort((a, b) => new Date(b.finalized_at) - new Date(a.finalized_at));

    // Branch labels so a cross-branch viewer can tell rows apart.
    const docLabels = await clinicLabelMap();
    for (const row of combined) {
      const cid = row.details?.patients?.clinic_id || null;
      row.clinic_id = cid;
      row.clinic_code = (cid && docLabels[cid]?.code) || null;
      row.clinic_name = (cid && docLabels[cid]?.name) || null;
    }

    res.json({ documents: combined });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// One-click data exports (admin backup downloads). Every export is audit
// logged with its row count. Super Admin sees all branches (or one via
// ?clinic_id=); regular admins are locked to their own clinic. Archived
// students and deactivated staff are INCLUDED with flags — a backup must be
// complete, not just the active list.
// ---------------------------------------------------------------------------
function exportScope(req) {
  return listClinicScope(req);
}

function sendExport(res, format, sheetName, filenameBase, rows) {
  const stamp = exportDateStamp();
  if (format === 'csv') {
    return sendDownload(res, {
      buffer: Buffer.from(toCsv(rows), 'utf8'),
      filename: `${filenameBase}-${stamp}.csv`,
      contentType: EXPORT_CONTENT_TYPES.csv,
    });
  }
  if (format === 'xlsx') {
    return sendDownload(res, {
      buffer: toXlsx(sheetName, rows),
      filename: `${filenameBase}-${stamp}.xlsx`,
      contentType: EXPORT_CONTENT_TYPES.xlsx,
    });
  }
  return sendDownload(res, {
    buffer: Buffer.from(JSON.stringify(rows, null, 2), 'utf8'),
    filename: `${filenameBase}-${stamp}.json`,
    contentType: EXPORT_CONTENT_TYPES.json,
  });
}

async function logDataExport(req, filename, rowCount) {
  try {
    await writeAudit({
      clinicId: req.profile?.clinic_id,
      actorId: req.profile?.id,
      action: 'export_data',
      entityType: 'backup',
      entityId: null,
      summary: `${req.profile?.display_name || req.profile?.email || 'An administrator'} downloaded ${filename} (${rowCount} rows).`,
      severity: 'info',
    });
  } catch {
    // ignore — the download already succeeded
  }
}

router.get('/export/students', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json, csv, or xlsx.' });
    }
    const scope = exportScope(req);
    let query = supabase
      .from('patients')
      .select('id, clinic_id, patient_id, first_name, middle_name, last_name, date_of_birth, sex, status, admission_form_status, treating_psychologist_id, treating_psychometrician_id, photo_url, created_at, deleted_at, clinical_profiles(iep_level), waiver_submissions(document_type_code, status)')
      .order('patient_id', { ascending: true });
    if (scope) query = query.eq('clinic_id', scope);
    const { data, error } = await query;
    if (error) return next(error);

    const ids = (data || []).map((p) => p.id);
    const [{ data: guardians }, labels, staffNames] = await Promise.all([
      ids.length
        ? supabase.from('guardians').select('patient_id, first_name, last_name, phone, is_primary').in('patient_id', ids).order('is_primary', { ascending: false })
        : { data: [] },
      clinicLabelMap(),
      loadProfileDisplayNames((data || []).flatMap((p) => [p.treating_psychologist_id, p.treating_psychometrician_id])),
    ]);
    const primaryGuardian = {};
    for (const g of guardians || []) {
      if (!primaryGuardian[g.patient_id]) primaryGuardian[g.patient_id] = g;
    }
    const rows = (data || []).map((p) => {
      const consent = (p.waiver_submissions || []).find((w) => w.document_type_code === 'CMPS:SE-FO-02');
      const guardian = primaryGuardian[p.id];
      return {
        id: p.id,
        branch_code: labels[p.clinic_id]?.code || null,
        branch_name: labels[p.clinic_id]?.name || null,
        student_id: p.patient_id,
        first_name: p.first_name,
        middle_name: p.middle_name,
        last_name: p.last_name,
        full_name: patientName(p),
        date_of_birth: p.date_of_birth,
        age: ageFromDob(p.date_of_birth),
        sex: p.sex,
        status: p.status,
        admission_form_status: p.admission_form_status,
        consent_waiver_status: consent ? consent.status : null,
        enrollment_type: p.clinical_profiles?.iep_level || null,
        treating_psychologist: p.treating_psychologist_id ? staffNames[p.treating_psychologist_id] || null : null,
        treating_psychometrician: p.treating_psychometrician_id ? staffNames[p.treating_psychometrician_id] || null : null,
        guardian_name: guardian ? `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || null : null,
        guardian_phone: guardian ? guardian.phone || null : null,
        photo_url: p.photo_url || null,
        created_at: p.created_at,
        is_archived: !!p.deleted_at,
      };
    });
    const filename = `cymon-students-${exportDateStamp()}.${format}`;
    await logDataExport(req, filename, rows.length);
    return sendExport(res, format, 'Students', 'cymon-students', rows);
  } catch (err) {
    next(err);
  }
});

router.get('/export/employees', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json, csv, or xlsx.' });
    }
    const scope = exportScope(req);
    const baseCols =
      'id, clinic_id, display_name, email, role, phone, avatar_url, created_at, deleted_at, first_name, middle_name, last_name, employee_id, position, license_no, title, license_id_url';
    const runQuery = async (cols) => {
      let q = supabase.from('profiles').select(cols).neq('role', 'client').order('created_at', { ascending: false });
      if (scope) q = q.eq('clinic_id', scope);
      if (req.profile.role !== 'super_admin') q = q.neq('role', 'super_admin');
      return q;
    };
    let { data, error } = await runQuery(`${baseCols}, extra_roles, suffix_name`);
    if (error && isMissingColumn(error, 'suffix_name')) {
      ({ data, error } = await runQuery(`${baseCols}, extra_roles`));
    }
    if (error) ({ data, error } = await runQuery(baseCols));
    if (error) return next(error);

    const labels = await clinicLabelMap();
    const rows = (data || []).map((p) => ({
      id: p.id,
      branch_code: labels[p.clinic_id]?.code || null,
      branch_name: labels[p.clinic_id]?.name || null,
      employee_id: p.employee_id,
      display_name: p.display_name,
      first_name: p.first_name,
      middle_name: p.middle_name,
      last_name: p.last_name,
      suffix_name: p.suffix_name || null,
      email: p.email,
      phone: p.phone,
      role: p.role,
      extra_roles: (p.extra_roles || []).join('; '),
      position: p.position,
      title: p.title,
      license_no: p.license_no,
      avatar_url: p.avatar_url || null,
      license_id_url: p.license_id_url || null,
      created_at: p.created_at,
      is_disabled: !!p.deleted_at,
    }));
    const filename = `cymon-employees-${exportDateStamp()}.${format}`;
    await logDataExport(req, filename, rows.length);
    return sendExport(res, format, 'Employees', 'cymon-employees', rows);
  } catch (err) {
    next(err);
  }
});

// Lean completed-documents ledger shared by the tabular export and the PDF
// archive: same finalized-only definition as GET /documents (approved /
// finalized reports, processed / scored submissions, approved session logs),
// without the heavy content payloads.
async function collectExportDocuments(req) {
  const scope = exportScope(req);
  const usablePatient = (p) => {
    if (!p || p.deleted_at) return false;
    if (isSuperAdminReq(req)) return !scope || p.clinic_id === scope;
    return p.clinic_id === req.profile.clinic_id;
  };
  const patientCols = 'first_name, middle_name, last_name, patient_id, clinic_id, deleted_at';
  const [{ data: rawReports, error: repErr }, { data: rawSubs, error: subErr }, { data: rawDars, error: darErr }] =
    await Promise.all([
      supabase
        .from('assessment_reports')
        .select(`id, title, report_type, document_type_code, status, finalized_at, updated_at, created_at, period, patient_id, patients(${patientCols})`)
        .in('status', ['approved', 'finalized'])
        .order('finalized_at', { ascending: false }),
      supabase
        .from('assessment_submissions')
        .select(`id, template_id, status, submitted_at, updated_at, total_score, max_score, patient_id, patients(${patientCols}), assessment_templates(title, document_type_code)`)
        .in('status', ['processed', 'scored'])
        .order('submitted_at', { ascending: false }),
      supabase
        .from('session_logs')
        .select(`id, patient_id, session_number, session_date, activity_title, status, reviewed_at, updated_at, created_at, patients(${patientCols})`)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false }),
    ]);
  if (repErr) throw repErr;
  if (subErr) throw subErr;
  if (darErr) throw darErr;

  const labels = await clinicLabelMap();
  const docs = [];
  const pushDoc = (entry) => {
    const cid = entry.details?.patients?.clinic_id || entry.patients?.clinic_id || null;
    docs.push({
      ...entry,
      clinic_id: cid,
      branch_code: (cid && labels[cid]?.code) || null,
      branch_name: (cid && labels[cid]?.name) || null,
    });
  };
  for (const r of rawReports || []) {
    if (!usablePatient(r.patients)) continue;
    const iepLike = r.report_type === 'iep' || /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(r.title || '');
    pushDoc({
      source_table: 'assessment_reports',
      document_id: r.id,
      student_name: patientName(r.patients),
      student_patient_id: r.patients ? r.patients.patient_id : null,
      document_title: r.title || (iepLike ? 'Individualized Educational Plan' : r.report_type === 'progress_summary' ? 'Monthly Assessment Report' : 'Behavioral Assessment Report'),
      document_code: iepLike && (!r.document_type_code || r.document_type_code === 'CMPS:SE-FO-08')
        ? 'CMPS:SE-FO-10'
        : r.document_type_code || (r.report_type === 'progress_summary' ? 'CMPS:SE-FO-08' : 'CMPS:SE-FO-06'),
      status: r.status,
      finalized_at: r.finalized_at || r.updated_at || r.created_at,
      period_or_session: r.period || null,
      details: { patient_id: r.patient_id },
    });
  }
  for (const s of rawSubs || []) {
    if (!usablePatient(s.patients)) continue;
    const tpl = s.assessment_templates || {};
    pushDoc({
      source_table: 'assessment_submissions',
      document_id: s.id,
      student_name: patientName(s.patients),
      student_patient_id: s.patients ? s.patients.patient_id : null,
      document_title: tpl.title || 'Standardized Assessment',
      document_code: tpl.document_type_code || 'CMPS:SE-FO-04',
      status: s.status,
      finalized_at: s.submitted_at || s.updated_at,
      period_or_session: s.total_score != null && s.max_score != null ? `Score ${s.total_score}/${s.max_score}` : null,
      details: { patient_id: s.patient_id },
    });
  }
  for (const dar of rawDars || []) {
    if (!usablePatient(dar.patients)) continue;
    pushDoc({
      source_table: 'session_logs',
      document_id: dar.id,
      student_name: patientName(dar.patients),
      student_patient_id: dar.patients ? dar.patients.patient_id : null,
      document_title: dar.activity_title || 'Daily Activity Report',
      document_code: 'CMPS:SE-FO-07',
      status: dar.status,
      finalized_at: dar.reviewed_at || dar.updated_at || dar.created_at,
      period_or_session: dar.session_date || (dar.session_number != null ? `Session ${dar.session_number}` : null),
      details: { patient_id: dar.patient_id },
    });
  }
  docs.sort((a, b) => new Date(b.finalized_at) - new Date(a.finalized_at));
  return docs;
}

router.get('/export/documents', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json, csv, or xlsx.' });
    }
    const docs = await collectExportDocuments(req);
    const rows = docs.map(({ details, clinic_id, ...flat }) => flat);
    const filename = `cymon-documents-${exportDateStamp()}.${format}`;
    await logDataExport(req, filename, rows.length);
    return sendExport(res, format, 'Documents', 'cymon-documents', rows);
  } catch (err) {
    next(err);
  }
});

// Bulk PDF archive: one ZIP with every finalized document rendered through
// the same official PDF path as single downloads. Per-document failures are
// collected into errors.txt so one bad record never sinks the archive.
router.get('/export/documents-pdf', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // archiver v7+ is ESM-only: require() yields the namespace with
    // named archive classes instead of the legacy factory function.
    const archiverModule = require('archiver');
    const createArchive = typeof archiverModule === 'function'
      ? archiverModule
      : (format, options) => {
        if (format !== 'zip' || typeof archiverModule.ZipArchive !== 'function') {
          throw new Error('ZIP archive support is unavailable.');
        }
        return new archiverModule.ZipArchive(options);
      };
    const docs = await collectExportDocuments(req);
    if (docs.length > 1000) {
      return res.status(400).json({ error: `Too many documents for one archive (${docs.length}). Narrow the branch filter and retry.` });
    }
    const stamp = exportDateStamp();
    const filename = `cymon-documents-${stamp}.zip`;
    const loaderClinic = isSuperAdminReq(req) ? exportScope(req) : req.profile.clinic_id;

    res.set({
      'Content-Type': EXPORT_CONTENT_TYPES.zip,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
    const archive = createArchive('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    const manifest = [];
    const failures = [];
    const usedNames = new Set();
    for (const doc of docs) {
      try {
        const loaded = await loadPdfDocument(doc.source_table, doc.document_id, loaderClinic);
        const bytes = await renderFormPdf({
          code: loaded.code,
          bundle: loaded.bundle,
          submission: loaded.record,
          report: loaded.record,
          requestingUser: req.profile,
        });
        const sid = String(doc.student_patient_id || loaded.bundle?.patient?.patient_id || doc.document_id).replace(/[^a-z0-9-]+/gi, '_');
        const code = String(doc.document_code || loaded.code || 'DOC').replace(/[:]/g, '-');
        const day = String(doc.finalized_at || '').slice(0, 10);
        let name = `${sid}-${code}${day ? `-${day}` : ''}.pdf`;
        let dup = 1;
        while (usedNames.has(name)) {
          dup += 1;
          name = `${sid}-${code}${day ? `-${day}` : ''}-${dup}.pdf`;
        }
        usedNames.add(name);
        archive.append(Buffer.from(bytes), { name: `documents/${name}` });
        manifest.push({ file: `documents/${name}`, ...doc, details: undefined });
      } catch (err) {
        failures.push({ document_id: doc.document_id, source_table: doc.source_table, error: err.message || 'Failed to render' });
      }
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    if (failures.length) {
      archive.append(JSON.stringify(failures, null, 2), { name: 'errors.json' });
    }
    await archive.finalize();
    await logDataExport(req, filename, manifest.length);
  } catch (err) {
    next(err);
  }
});

router.get('/announcements', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const annScope = listClinicScope(req);
    let annQuery = supabase
      .from('announcements')
      .select('id, clinic_id, title, type, priority, body, publish_date, expires_on, audience, image_url, image_urls, patient_id, employee_id')
      .is('deleted_at', null)
      .order('publish_date', { ascending: false });
    if (annScope) annQuery = annQuery.eq('clinic_id', annScope);
    const { data, error } = await annQuery;
    if (error) return next(error);
    const annLabels = await clinicLabelMap();
    res.json({
      announcements: (data || []).map((a) => ({
        ...a,
        clinic_code: annLabels[a.clinic_id]?.code || null,
        clinic_name: annLabels[a.clinic_id]?.name || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Resolve who must receive a bell notification for an announcement's current
// targeting (one specific patient/employee, or a role audience). Shared by
// create (POST) and audience changes on edit (PATCH) so retargeted people
// always get an unread notice instead of silently appearing in their tab.
async function resolveAnnouncementRecipients(clinicId, { patient_id, employee_id, audience }) {
  if (patient_id) {
    const { data: patientRecord } = await supabase
      .from('patients')
      .select('caregiver_id')
      .eq('id', patient_id)
      .maybeSingle();
    return patientRecord?.caregiver_id
      ? [{ id: patientRecord.caregiver_id, link: '/client/announcements' }]
      : [];
  }
  if (employee_id) {
    const { data: employee } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', employee_id)
      .maybeSingle();
    if (!employee) return [];
    // Admins manage the Published list itself — they never get announcement
    // bell notifications, so their nav never carries an announcement badge.
    if (['admin', 'super_admin'].includes(employee.role)) return [];
    return [{
      id: employee.id,
      link: employee.role === 'client'
        ? '/client/announcements'
        : employee.role === 'admin' || employee.role === 'super_admin'
          ? '/admin/announcements'
          : employee.role === 'psychologist'
            ? '/psychologist/announcements'
            : '/psychometrician/announcements',
    }];
  }
  const announcementAudience = audience || ['all'];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, extra_roles')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);
  const matchesAudience = (profile) => {
    if (announcementAudience.includes('all')) return true;
    const roles = [profile.role, ...(profile.extra_roles || [])];
    const isStaff = roles.some((r) => ['admin', 'super_admin', 'psychologist', 'psychometrician'].includes(r));
    const isMhp = roles.some((r) => ['psychologist', 'psychometrician'].includes(r));
    return roles.some((role) =>
      announcementAudience.includes(role) ||
      (role === 'client' && (announcementAudience.includes('client') || announcementAudience.includes('all_clients'))) ||
      (announcementAudience.includes('therapist')),
    ) || (announcementAudience.includes('all_employees') && isStaff) || (announcementAudience.includes('all_mhp') && isMhp);
  };
  // Admins manage the Published list itself, so they never get announcement
  // bell notifications — their nav never carries an announcement badge.
  return (profiles || [])
    .filter((profile) => {
      if (!matchesAudience(profile)) return false;
      if (['admin', 'super_admin'].includes(profile.role)) return false;
      return true;
    })
    .map((profile) => ({
    id: profile.id,
    link: profile.role === 'client'
      ? '/client/announcements'
      : profile.role === 'admin' || profile.role === 'super_admin'
        ? '/admin/announcements'
        : profile.role === 'psychologist'
          ? '/psychologist/announcements'
          : '/psychometrician/announcements',
  }));
}

const sameAnnouncementTargeting = (a, b) =>
  JSON.stringify([...(a?.audience || [])].sort()) === JSON.stringify([...(b?.audience || [])].sort()) &&
  (a?.patient_id || null) === (b?.patient_id || null) &&
  (a?.employee_id || null) === (b?.employee_id || null);

router.post('/announcements', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { title, type = 'info', priority = 'normal', body, publish_date, expires_on, audience, patient_id, employee_id, image, images } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    const safePriority = ['normal', 'important', 'urgent'].includes(priority) ? priority : 'normal';
    // Branch scoping: regular admins publish into their own clinic. A Super
    // Admin may target another branch via clinic_id (validated) — targeted
    // rows and recipients must live in that same branch. clinic_id 'all'
    // (Super Admin only) fans out: one identical row per branch, since
    // readers only ever see their own clinic_id.
    const requestedClinicId = typeof req.body?.clinic_id === 'string' ? req.body.clinic_id.trim() : '';
    const publishAllBranches = requestedClinicId === 'all';
    if (publishAllBranches && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can publish to all branches.' });
    }
    if (publishAllBranches && (patient_id || employee_id)) {
      return res.status(400).json({ error: 'A targeted announcement cannot span branches. Pick one branch, or use an audience instead.' });
    }
    let targetClinicIds = [req.profile.clinic_id];
    if (requestedClinicId && requestedClinicId !== req.profile.clinic_id && !publishAllBranches) {
      if (req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can publish to another branch.' });
      }
      const { data: targetClinic, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', requestedClinicId)
        .maybeSingle();
      if (clinicErr) return next(clinicErr);
      if (!targetClinic) return res.status(400).json({ error: 'Unknown branch selected.' });
      targetClinicIds = [targetClinic.id];
    } else if (publishAllBranches) {
      const { data: allClinics, error: clinicsErr } = await supabase
        .from('clinics')
        .select('id')
        .order('id', { ascending: true });
      if (clinicsErr) return next(clinicsErr);
      targetClinicIds = (allClinics || []).map((c) => c.id);
      if (targetClinicIds.length === 0) {
        return res.status(400).json({ error: 'No branches found to publish to.' });
      }
    }
    // Single-branch targeting checks (all-branches + targeting is rejected
    // above, so targetClinicIds has exactly one entry whenever these run).
    const targetClinicId = targetClinicIds[0];
    if (patient_id) {
      const { data: tp } = await supabase.from('patients').select('clinic_id').eq('id', patient_id).maybeSingle();
      if (!tp || tp.clinic_id !== targetClinicId) {
        return res.status(400).json({ error: 'The targeted student does not belong to this branch.' });
      }
    }
    if (employee_id) {
      const { data: te } = await supabase.from('profiles').select('clinic_id').eq('id', employee_id).maybeSingle();
      if (!te || te.clinic_id !== targetClinicId) {
        return res.status(400).json({ error: 'The targeted employee does not belong to this branch.' });
      }
    }
    // `images` (array) is the multi-upload path; legacy single `image` still works.
    const uploads = Array.isArray(images) && images.length ? images : (image ? [image] : []);
    if (uploads.length > MAX_ANNOUNCEMENT_IMAGES) {
      return res.status(400).json({ error: `You can attach up to ${MAX_ANNOUNCEMENT_IMAGES} images.` });
    }
    // Fan-out: one identical row per target branch (usually just one — the
    // loop only runs long for publish-to-all-branches).
    const created = [];
    const publishToBranch = async (targetClinicId) => {
    const image_urls = await uploadAnnouncementImages(uploads, targetClinicId);
    const image_url = image_urls[0] || null;
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        clinic_id: targetClinicId,
        title,
        type,
        priority: safePriority,
        body,
        publish_date: publish_date || undefined,
        expires_on: expires_on || null,
        audience: Array.isArray(audience) && audience.length ? audience : ['all'],
        image_url,
        image_urls,
        created_by_id: req.profile.id,
        patient_id: patient_id || null,
        ...(employee_id ? { employee_id } : {}),
      })
      .select('id, title, type, priority, body, publish_date, expires_on, audience, image_url, image_urls, patient_id, employee_id')
      .single();
    if (error) {
      const insertError = new Error(error.message);
      insertError.status = 400;
      throw insertError;
    }

    const announcementRecipients = await resolveAnnouncementRecipients(targetClinicId, {
      patient_id: data.patient_id,
      employee_id: data.employee_id,
      audience: data.audience,
    });

    await Promise.all(announcementRecipients
      .filter((recipient) => recipient.id !== req.profile.id)
      .map((recipient) => createNotification({
        clinicId: targetClinicId,
        recipientId: recipient.id,
        type: 'announcement',
        title: `New announcement: ${data.title}`,
        body: data.body,
        // Deep-link to the exact card so clicking the bell notification
        // scrolls to and flashes it on the announcements page.
        link: `${recipient.link}?announcement=${data.id}`,
      })));

    // Announcement emails are awaited (not fire-and-forget) so the response
    // can report delivery: total silence on provider failures is exactly how
    // broken email config went unnoticed. A failed email never fails the
    // publish itself.
    let emailSent = 0;
    let emailTotal = 0;
    const sendOne = async (to, subject, templateData) => {
      emailTotal += 1;
      try {
        await sendMail({
          to,
          subject,
          templateKey: 'announcement',
          replyToClinicId: targetClinicId,
          templateData: {
            announcement_title: title,
            announcement_body: body,
            ...templateData,
          },
        });
        emailSent += 1;
      } catch (e) {
        console.error(`[email] failed to send announcement email to ${to}:`, e.message);
      }
    };
    if (data.patient_id) {
      try {
        const { data: pt } = await supabase
          .from('patients')
          .select('caregiver_id')
          .eq('id', data.patient_id)
          .maybeSingle();
        if (pt && pt.caregiver_id) {
          const { data: c } = await supabase
            .from('profiles')
            .select('email, display_name')
            .eq('id', pt.caregiver_id)
            .maybeSingle();
          if (c && c.email) {
            await sendOne(c.email, `New Targeted Message: ${title} - ClearMind Clinic`, {
              recipient_name: c.display_name,
            });
          }
        }
      } catch (e) {
        console.error('[email] failed to resolve targeted announcement email:', e.message);
      }
    } else if (data.employee_id) {
      try {
        const { data: emp } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', data.employee_id)
          .maybeSingle();
        if (emp && emp.email) {
          await sendOne(emp.email, `New Targeted Message: ${title} - ClearMind Clinic`, {
            recipient_name: emp.display_name,
          });
        }
      } catch (e) {
        console.error('[email] failed to resolve targeted announcement email:', e.message);
      }
    } else {
      const savedAudience = data.audience || ['all'];
      let roleFilter = [];
      if (!savedAudience.includes('all')) {
        if (savedAudience.includes('all_clients') || savedAudience.includes('client')) roleFilter.push('client');
        if (savedAudience.includes('psychologist')) roleFilter.push('psychologist');
        if (savedAudience.includes('psychometrician')) roleFilter.push('psychometrician');
        if (savedAudience.includes('therapist')) roleFilter.push('therapist');
      }

      let query = supabase.from('profiles').select('email, display_name').eq('clinic_id', targetClinicId).is('deleted_at', null);
      if (roleFilter.length > 0) {
        query = query.in('role', roleFilter);
      }

      try {
        const { data: users, error: usersError } = await query;
        if (usersError) throw usersError;
        const targets = (users || []).filter((u) => u.email);
        await Promise.allSettled(
          targets.map((u) =>
            sendOne(u.email, `New Announcement: ${title} - ClearMind Clinic`, {
              recipient_name: u.display_name,
            }),
          ),
        );
      } catch (e) {
        console.error('[email] failed to fetch emails for announcement:', e.message);
      }
    }
    return { ...data, emailsSent: emailSent, emailsTotal: emailTotal };
    };

    for (const targetClinicId of targetClinicIds) {
      created.push(await publishToBranch(targetClinicId));
    }

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'publish_announcement',
      entityType: 'announcement',
      entityId: created[0].id,
      summary: created.length > 1
        ? `${req.profile.display_name || 'Administrator'} published the announcement "${created[0].title}" to ${created.length} branches.`
        : `${req.profile.display_name || 'Administrator'} published the announcement "${created[0].title}".`,
    });
    res.status(201).json({
      announcement: created[0],
      announcements: created,
      branches: created.length,
      emailsSent: created.reduce((n, r) => n + (r.emailsSent || 0), 0),
      emailsTotal: created.reduce((n, r) => n + (r.emailsTotal || 0), 0),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/announcements/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { title, type, priority, body, publish_date, expires_on, audience, patient_id, employee_id, image, images, remove_image, remove_image_urls } = req.body || {};
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (priority !== undefined)
      patch.priority = ['normal', 'important', 'urgent'].includes(priority) ? priority : 'normal';
    if (body !== undefined) patch.body = body;
    if (publish_date !== undefined) patch.publish_date = publish_date || null;
    if (expires_on !== undefined) patch.expires_on = expires_on || null;
    if (audience !== undefined)
      patch.audience = Array.isArray(audience) && audience.length ? audience : ['all'];
    if (patient_id !== undefined) patch.patient_id = patient_id || null;
    if (employee_id !== undefined) patch.employee_id = employee_id || null;
    // Multi-image slideshow: append newly uploaded images, drop the URLs
    // the admin removed, and keep `image_url` as the cover (first image).
    // Legacy single `image` / `remove_image` payloads still work.
    const newUploads = Array.isArray(images) && images.length ? images : (image ? [image] : []);
    const wantsImageChange = newUploads.length > 0 || remove_image || (Array.isArray(remove_image_urls) && remove_image_urls.length > 0);
    const { data: previous } = await (() => {
      let prevQuery = supabase
        .from('announcements')
        .select('title, clinic_id, audience, patient_id, employee_id, image_url, image_urls')
        .eq('id', req.params.id)
        .is('deleted_at', null);
      // Regular admins may only touch their own branch; Super Admin may act
      // on any branch.
      if (!isSuperAdminReq(req)) prevQuery = prevQuery.eq('clinic_id', req.profile.clinic_id);
      return prevQuery.maybeSingle();
    })();
    if (!previous) return res.status(404).json({ error: 'Announcement not found' });
    if (wantsImageChange) {
      let kept = Array.isArray(previous.image_urls) && previous.image_urls.length
        ? [...previous.image_urls]
        : (previous.image_url ? [previous.image_url] : []);
      if (remove_image) kept = [];
      if (Array.isArray(remove_image_urls) && remove_image_urls.length) {
        const gone = new Set(remove_image_urls);
        kept = kept.filter((u) => !gone.has(u));
      }
      if (kept.length + newUploads.length > MAX_ANNOUNCEMENT_IMAGES) {
        return res.status(400).json({ error: `You can attach up to ${MAX_ANNOUNCEMENT_IMAGES} images.` });
      }
      const uploaded = await uploadAnnouncementImages(newUploads, previous.clinic_id || req.profile.clinic_id);
      const next = [...kept, ...uploaded];
      patch.image_urls = next;
      patch.image_url = next[0] || null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    let annUpdQuery = supabase
      .from('announcements')
      .update(patch)
      .eq('id', req.params.id)
      .is('deleted_at', null);
    if (!isSuperAdminReq(req)) annUpdQuery = annUpdQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await annUpdQuery
      .select('id, clinic_id, title, type, priority, body, publish_date, expires_on, audience, image_url, image_urls, patient_id, employee_id')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Announcement not found' });
    // Retargeting (e.g. general -> one specific student) must raise a fresh
    // unread bell notice for the new audience — otherwise they never know.
    if (!sameAnnouncementTargeting(previous, data)) {
      const rowClinicId = data.clinic_id || previous.clinic_id || req.profile.clinic_id;
      const [previousRecipients, retargeted] = await Promise.all([
        resolveAnnouncementRecipients(rowClinicId, {
          patient_id: previous.patient_id,
          employee_id: previous.employee_id,
          audience: previous.audience,
        }),
        resolveAnnouncementRecipients(rowClinicId, {
          patient_id: data.patient_id,
          employee_id: data.employee_id,
          audience: data.audience,
        })
      ]);

      const retargetedIds = new Set(retargeted.map(r => r.id));
      const removedIds = previousRecipients
        .map(r => r.id)
        .filter(id => !retargetedIds.has(id));

      if (removedIds.length > 0) {
        await supabase
          .from('notifications')
          .delete()
          .eq('type', 'announcement')
          .in('recipient_id', removedIds)
          .like('title', `%${previous.title}`);
      }

      const previousIds = new Set(previousRecipients.map(r => r.id));
      const newRecipients = retargeted.filter(r => !previousIds.has(r.id));

      await Promise.all(newRecipients
        .filter((recipient) => recipient.id !== req.profile.id)
        .map((recipient) => createNotification({
          clinicId: rowClinicId,
          recipientId: recipient.id,
          type: 'announcement',
          title: `Announcement updated: ${data.title}`,
          body: data.body,
          // Deep-link to the exact card so clicking the bell notification
          // scrolls to and flashes it on the announcements page.
          link: `${recipient.link}?announcement=${data.id}`,
        })));
    }
    await writeAudit({
      clinicId: data.clinic_id || previous.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'update_announcement',
      entityType: 'announcement',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} updated the announcement "${data.title}".`,
    });
    res.json({ announcement: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/announcements/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let annDelQuery = supabase
      .from('announcements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('deleted_at', null);
    if (!isSuperAdminReq(req)) annDelQuery = annDelQuery.eq('clinic_id', req.profile.clinic_id);
    const { data, error } = await annDelQuery
      .select('id, clinic_id, title')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Announcement not found' });
    await writeAudit({
      clinicId: data.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'delete_announcement',
      entityType: 'announcement',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} deleted the announcement "${data.title || 'Untitled'}".`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// read-only audit trail for the compliance page
router.get('/audit', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // 0 = no pagination (same one-row trap as the patients list — see above).
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const limit = Math.min(200, Math.max(0, parseInt(req.query.limit, 10) || 0));
    let q = supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, summary, severity, created_at, actor_id, ip_address, device_label, city, country', { count: page ? 'exact' : undefined })
      .eq('clinic_id', req.profile.clinic_id)
      .order('created_at', { ascending: false });
    if (page > 0 && limit > 0) {
      const from = (page - 1) * limit;
      q = q.range(from, from + limit - 1);
    } else {
      q = q.limit(1000);
    }
    const { data: rows, error, count } = await q;
    if (error) return next(error);

    const actorIds = [...new Set((rows || []).map((r) => r.actor_id).filter(Boolean))];
    const { data: actors } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .in('id', actorIds.length ? actorIds : ['00000000-0000-0000-0000-000000000000']);
    const byId = Object.fromEntries((actors || []).map((a) => [a.id, a]));

    res.json({
      logs: (rows || []).map((l) => {
        const a = byId[l.actor_id];
        return {
          id: l.id,
          created_at: l.created_at,
          actor: a ? a.display_name : 'System',
          actor_role: a ? a.role : null,
          action: l.action,
          entity_type: l.entity_type,
          entity_id: l.entity_id,
          summary: l.summary,
          severity: l.severity,
          ip_address: l.ip_address ?? null,
          device_label: l.device_label ?? null,
          city: l.city ?? null,
          country: l.country ?? null,
        };
      }),
      ...(page > 0 && limit > 0 ? { pagination: { page, limit, total: count ?? null } } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/scoring', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const clinic = req.profile.clinic_id;
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, middle_name, last_name, photo_url')
      .eq('clinic_id', clinic)
      .is('deleted_at', null);
    const ids = (patients || []).map((p) => p.id);
    if (ids.length === 0) return res.json({ rows: [], summary: { avgCafat: 0, assessmentsThisMonth: 0, needsSupport: 0 } });

    const [{ data: clinicals }, { data: subs }] = await Promise.all([
      supabase.from('clinical_profiles').select('patient_id, gars3_gai_score').in('patient_id', ids),
      supabase
        .from('assessment_submissions')
        .select('patient_id, total_score, created_at, assessment_templates(document_type_code)')
        .in('patient_id', ids),
    ]);
    const garsByPatient = Object.fromEntries((clinicals || []).map((c) => [c.patient_id, c.gars3_gai_score]));

    const behByPatient = {};
    const cafatByPatient = {};
    (subs || []).forEach((s) => {
      const code = s.assessment_templates && s.assessment_templates.document_type_code;
      if (code === 'CMPS:SE-FO-06') behByPatient[s.patient_id] = s.total_score;
      if (code === 'CMPS:SE-FO-05') cafatByPatient[s.patient_id] = s.total_score;
    });

    const statusFor = (beh) => (beh == null ? 'No Data' : beh >= 30 ? 'Mastered' : beh >= 20 ? 'Developing' : 'Needs Support');

    const rows = (patients || []).map((p) => {
      const beh = behByPatient[p.id] ?? null;
      return {
        id: p.id,
        name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        beh,
        gars: garsByPatient[p.id] ?? null,
        cafat: cafatByPatient[p.id] ?? null,
        status: statusFor(beh),
      };
    });

    const cafatVals = rows.map((r) => r.cafat).filter((v) => v != null);
    const avgCafat = cafatVals.length ? Number((cafatVals.reduce((a, b) => a + b, 0) / cafatVals.length).toFixed(1)) : 0;

    res.json({
      rows,
      summary: {
        avgCafat,
        assessmentsThisMonth: (subs || []).length,
        needsSupport: rows.filter((r) => r.status === 'Needs Support').length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// list registered employees (staff + admins) for the clinic
router.get('/employees', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const includeDisabled = String(req.query.include_disabled || '').toLowerCase() === 'true';
    // Super Admin sees all branches (or one via ?clinic_id=); everyone else
    // sees their acting branch. Multi-branch staff (junction members of the
    // scoped branch) are listed too, so a psychometrician serving two
    // branches shows up in both directories under one email.
    const scope = listClinicScope(req);
    const baseCols =
      'id, clinic_id, display_name, email, role, phone, avatar_url, created_at, deleted_at, first_name, middle_name, last_name, employee_id, position, license_no, title, license_id_url';
    const listQuery = (cols) => {
      let q = supabase
        .from('profiles')
        .select(cols)
        .neq('role', 'client')
        .order('created_at', { ascending: false });
      if (scope) q = q.eq('clinic_id', scope);

      if (req.profile.role !== 'super_admin') {
        q = q.neq('role', 'super_admin');
      }
      if (!includeDisabled) {
        q = q.is('deleted_at', null);
      }
      return q;
    };
    // extra_roles is added by migration 0017, suffix_name by 0089,
    // disabled_roles by 0115; fall back when any isn't applied yet
    let { data, error } = await listQuery(`${baseCols}, extra_roles, disabled_roles, suffix_name`);
    if (error && isMissingColumn(error, 'suffix_name')) {
      console.warn('[db] profiles.suffix_name missing — run migration 0089; listing without suffixes');
      ({ data, error } = await listQuery(`${baseCols}, extra_roles, disabled_roles`));
    }
    if (error && isMissingColumn(error, 'disabled_roles')) {
      console.warn('[db] profiles.disabled_roles missing — run migration 0115; listing without per-role status');
      ({ data, error } = await listQuery(`${baseCols}, extra_roles, suffix_name`));
    }
    if (error && isMissingColumn(error, 'suffix_name')) {
      ({ data, error } = await listQuery(`${baseCols}, extra_roles`));
    }
    if (error) ({ data, error } = await listQuery(baseCols));
    if (error) return next(error);
    // Junction members: staff whose HOME is elsewhere but who are granted
    // access to the scoped branch (one email, many branches).
    let merged = data || [];
    if (scope) {
      const extraIds = (await profileIdsForClinic(scope))
        .filter((id) => !merged.some((p) => p.id === id));
      if (extraIds.length) {
        let extraQuery = supabase
          .from('profiles')
          .select(`${baseCols}, extra_roles, disabled_roles, suffix_name`)
          .in('id', extraIds)
          .neq('role', 'client');
        if (req.profile.role !== 'super_admin') extraQuery = extraQuery.neq('role', 'super_admin');
        if (!includeDisabled) extraQuery = extraQuery.is('deleted_at', null);
        const { data: extraRows } = await extraQuery;
        merged = [...merged, ...(extraRows || []).map((r) => ({
          ...r,
          extra_roles: r.extra_roles || [],
          disabled_roles: Array.isArray(r.disabled_roles) ? r.disabled_roles : [],
          suffix_name: r.suffix_name ?? null,
        }))];
      }
    }
    const clinicLabels = await clinicLabelMap();
    // Extra-branch lookup per listed profile (one query for the page).
    const listedIds = merged.map((p) => p.id);
    let extrasByProfile = {};
    if (listedIds.length) {
      try {
        const { data: junctionRows } = await supabase
          .from('profile_clinics')
          .select('profile_id, clinic_id')
          .in('profile_id', listedIds);
        for (const r of junctionRows || []) {
          if (!r.clinic_id) continue;
          (extrasByProfile[r.profile_id] = extrasByProfile[r.profile_id] || new Set()).add(r.clinic_id);
        }
      } catch {
        extrasByProfile = {};
      }
    }
    res.json({
      employees: merged.map((p) => {
        const extraClinics = [...(extrasByProfile[p.id] || [])].filter((id) => id !== p.clinic_id);
        return {
          id: p.id,
          clinic_id: p.clinic_id,
          clinic_code: clinicLabels[p.clinic_id]?.code || null,
          clinic_name: clinicLabels[p.clinic_id]?.name || null,
          branches: [
            ...(p.clinic_id ? [{ id: p.clinic_id, code: clinicLabels[p.clinic_id]?.code || null, name: clinicLabels[p.clinic_id]?.name || null, is_primary: true }] : []),
            ...extraClinics.map((id) => ({ id, code: clinicLabels[id]?.code || null, name: clinicLabels[id]?.name || null, is_primary: false })),
          ],
          name: p.display_name,
          first_name: p.first_name,
          middle_name: p.middle_name,
          last_name: p.last_name,
          suffix_name: p.suffix_name || null,
          email: p.email,
          phone: p.phone,
          role: p.role,
          extra_roles: p.extra_roles || [],
          disabled_roles: Array.isArray(p.disabled_roles) ? p.disabled_roles : [],
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          employee_id: p.employee_id,
          position: p.position,
          license_no: p.license_no,
          staff_title: p.title,
          license_id_url: p.license_id_url,
          credential: p.role === 'admin' || p.role === 'super_admin' ? p.employee_id : p.license_no,
          title: p.role === 'admin' || p.role === 'super_admin' ? p.position : p.title,
          is_disabled: !!p.deleted_at,
          deleted_at: p.deleted_at || null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// register a new employee (clinician / admin)
const STAFF_ROLES = ['psychologist', 'psychometrician'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PH_MOBILE_RE = /^09\d{9}$/
const MAX = {
  email: 120,
  phone: 13,
  name: 20,
  employeeId: 30,
  position: 80,
  licenseNo: 40,
  profession: 80,
  password: 64,
}

// True when a Supabase error means "column does not exist yet" (migration
// not applied). Used to degrade gracefully until the DBA runs the migration.
const isMissingColumn = (err, column) => {
  if (!err) return false;
  if (err.code === 'PGRST204' || err.code === '42703') return true;
  return String(err.message || '').toLowerCase().includes(String(column || '').toLowerCase());
};

const composeDisplayName = (first, middle, last, suffix) =>
  [first, middle, last, suffix].filter(Boolean).join(' ');

// True when a Supabase Auth error means the email is already taken.
function isEmailTakenError(err) {
  if (!err) return false;
  if (err.code === 'email_exists') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('already been registered') || msg.includes('already registered') || msg.includes('email address is already');
}

// Find a Supabase Auth user by email (case-insensitive). The admin API has
// no email filter, so page through — clinic-scale user bases fit in a page
// or two, capped here to avoid runaway scans.
async function findAuthUserByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

const formatPHMobile = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = `0${digits.slice(2)}`
  digits = digits.slice(0, 11)
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ')
}

router.post('/employees', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email, password, first_name, middle_name, last_name, suffix_name, role, extra_roles, phone, employee_id, position, license_no, title, avatar, license_id_image } =
      req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '').trim();
    const trimmedFirst = capitalizeNamePart(String(first_name || '').trim());
    const trimmedMiddle = capitalizeNamePart(String(middle_name || '').trim());
    const trimmedLast = capitalizeNamePart(String(last_name || '').trim());
    const trimmedSuffix = capitalizeNamePart(String(suffix_name || '').trim());
    const trimmedPhone = String(phone || '').trim();
    // Employee IDs are matched case-insensitively at login, so store them
    // normalized to uppercase (e.g. a custom "cmps-emp-1" becomes "CMPS-EMP-1").
    const trimmedEmployeeId = String(employee_id || '').trim().toUpperCase();
    const trimmedPosition = String(position || '').trim();
    const trimmedLicenseNo = String(license_no || '').trim();
    const trimmedTitle = String(title || '').trim();

    if (!normalizedEmail || !trimmedPassword || !trimmedFirst || !trimmedLast || !role) {
      return res.status(400).json({ error: 'Email, password, first name, last name, and role are required' });
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (normalizedEmail.length > MAX.email) {
      return res.status(400).json({ error: `Email must be ${MAX.email} characters or fewer` });
    }
    if (trimmedFirst.length > MAX.name) {
      return res.status(400).json({ error: `First name must be ${MAX.name} characters or fewer` });
    }
    if (/\d/.test(trimmedFirst)) {
      return res.status(400).json({ error: 'First name cannot contain numbers' });
    }
    if (trimmedMiddle.length > MAX.name) {
      return res.status(400).json({ error: `Middle name must be ${MAX.name} characters or fewer` });
    }
    if (/\d/.test(trimmedMiddle)) {
      return res.status(400).json({ error: 'Middle name cannot contain numbers' });
    }
    if (trimmedLast.length > MAX.name) {
      return res.status(400).json({ error: `Last name must be ${MAX.name} characters or fewer` });
    }
    if (/\d/.test(trimmedLast)) {
      return res.status(400).json({ error: 'Last name cannot contain numbers' });
    }
    if (trimmedSuffix.length > MAX.name) {
      return res.status(400).json({ error: `Suffix name must be ${MAX.name} characters or fewer` });
    }
    const normalizedPhone = formatPHMobile(trimmedPhone);
    if (trimmedPhone && !PH_MOBILE_RE.test(normalizedPhone.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'Phone must be a valid Philippine mobile number' });
    }
    const passwordError = validatePassword(trimmedPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }
    const display_name = composeDisplayName(trimmedFirst, trimmedMiddle, trimmedLast, trimmedSuffix);
    const ALL_ROLES = [...STAFF_ROLES, 'admin', 'super_admin'];
    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if ((role === 'super_admin' || (extra_roles && extra_roles.includes('super_admin'))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can create another Super Admin.' });
    }

    // Regular admins cannot create administrator accounts — only super admins can
    if ((role === 'admin' || (extra_roles && extra_roles.includes('admin'))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can create Administrator accounts.' });
    }

    const extraRoles = Array.isArray(extra_roles)
      ? [...new Set(extra_roles.filter((r) => ALL_ROLES.includes(r) && r !== role))]
      : [];
    const requiresLicenseId = STAFF_ROLES.includes(role) || extraRoles.some((r) => STAFF_ROLES.includes(r));
    if (requiresLicenseId && !license_id_image) {
      return res.status(400).json({ error: 'Professional licensed ID is required for staff roles' });
    }
    if (role === 'admin' || role === 'super_admin' || extraRoles.includes('admin') || extraRoles.includes('super_admin')) {
      if (trimmedEmployeeId && trimmedEmployeeId.length > MAX.employeeId) {
        return res.status(400).json({ error: `Employee ID must be ${MAX.employeeId} characters or fewer` });
      }
      if (trimmedPosition.length > MAX.position) {
        return res.status(400).json({ error: `Position must be ${MAX.position} characters or fewer` });
      }
    }
    if (STAFF_ROLES.includes(role) || extraRoles.some((r) => STAFF_ROLES.includes(r))) {
      if (!trimmedLicenseNo) {
        return res.status(400).json({ error: 'PRC License No. is required for staff roles' });
      }
      if (trimmedLicenseNo.length > MAX.licenseNo) {
        return res.status(400).json({ error: `PRC License No. must be ${MAX.licenseNo} characters or fewer` });
      }
      if (!trimmedTitle) {
        return res.status(400).json({ error: 'Profession is required for staff roles' });
      }
      if (trimmedTitle.length > MAX.profession) {
        return res.status(400).json({ error: `Profession must be ${MAX.profession} characters or fewer` });
      }
    }
    let finalEmpId = trimmedEmployeeId;
    // Every employee (admin or clinical staff) gets an Employee ID. If one isn't
    // supplied it is generated as CMPS-EMP-<year>-<seq> so no employee is ever
    // left without an ID in the sidebar.
    if (!finalEmpId) {
      let isDupe = true;
      let seq = 1;
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('employee_id', 'is', null);
      seq = (count || 0) + 1;
      const year = new Date().getFullYear();
      while (isDupe) {
        finalEmpId = `CMPS-EMP-${year}-${String(seq).padStart(3, '0')}`;
        const { data: dupe } = await supabase
          .from('profiles')
          .select('id')
          .ilike('employee_id', finalEmpId)
          .maybeSingle();
        if (!dupe) {
          isDupe = false;
        } else {
          seq++;
        }
      }
    } else {
      const { data: dupe } = await supabase
        .from('profiles')
        .select('id')
        .ilike('employee_id', finalEmpId)
        .maybeSingle();
      if (dupe) return res.status(409).json({ error: 'That Employee ID is already in use' });
    }

    const createPayload = {
      email: normalizedEmail,
      password: trimmedPassword,
      email_confirm: true,
      user_metadata: { role, extra_roles: extraRoles, display_name },
    };
    let { data: created, error: createErr } = await supabase.auth.admin.createUser(createPayload);
    if (createErr && isEmailTakenError(createErr)) {
      // The email exists in Supabase Auth but produced no visible employee.
      // Resolve it instead of dead-ending (no manual dashboard delete needed):
      // - deactivated profile in THIS clinic → 409 with a code so the UI can
      //   offer Reactivate instead of re-registering;
      // - no profile row at all (orphaned auth account from a failed past
      //   signup) → delete the orphan and retry creation once;
      // - anything else → keep the original conflict error.
      const { data: profileMatches } = await supabase
        .from('profiles')
        .select('id, display_name, email, clinic_id, deleted_at, role')
        .ilike('email', normalizedEmail)
        .limit(2);
      const match = (profileMatches || [])[0] || null;
      if (match && !match.deleted_at) {
        // Active profile, yet invisible in the Employees list: it is either
        // a client (parent) account or staff of another clinic. Say which —
        // a bare "already registered" dead-ends the admin otherwise.
        if (match.role === 'client') {
          return res.status(409).json({
            error: 'This email is already registered as a client (parent) account, so it cannot also be registered as staff. Ask the person for a different email.',
            code: 'EMAIL_IS_CLIENT',
          });
        }
        if (match.clinic_id !== req.profile.clinic_id) {
          return res.status(409).json({
            error: 'This email is already registered as staff under a different branch. Grant them access to this branch instead of registering again — one email works in many branches.',
            code: 'EMAIL_OTHER_CLINIC',
            employee: { id: match.id, name: match.display_name || match.email, email: match.email },
          });
        }
        return res.status(409).json({ error: 'A user with this email address has already been registered' });
      }
      if (match && match.deleted_at && match.clinic_id === req.profile.clinic_id) {
        return res.status(409).json({
          error: `This email belongs to deactivated employee ${match.display_name || match.email}. Reactivate the account instead of registering again.`,
          code: 'EMPLOYEE_DEACTIVATED',
          employee: { id: match.id, name: match.display_name || match.email, email: match.email },
        });
      }
      if (!match) {
        try {
          const orphan = await findAuthUserByEmail(normalizedEmail);
          if (!orphan) return res.status(400).json({ error: createErr.message });
          const { error: delErr } = await supabase.auth.admin.deleteUser(orphan.id);
          if (delErr) {
            return res.status(400).json({
              error: `This email is stuck on an incomplete signup and could not be cleared automatically (${delErr.message}).`,
            });
          }
          const retry = await supabase.auth.admin.createUser(createPayload);
          if (retry.error) return res.status(400).json({ error: retry.error.message });
          created = retry.data;
          createErr = null;
        } catch (reclaimErr) {
          return res.status(400).json({ error: createErr.message });
        }
      } else {
        return res.status(409).json({ error: 'A user with this email address has already been registered' });
      }
    }
    if (createErr) return res.status(400).json({ error: createErr.message });
    const userId = created.user.id;

    let avatar_url = null;
    let license_id_url = null;
    const uploadImage = async (dataUrl, prefix) => {
      const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(dataUrl || '');
      if (!m) return null;
      const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
      const buffer = Buffer.from(m[3], 'base64');
      if (buffer.length > 5 * 1024 * 1024) return null;
      const path = `${prefix}/${userId}/${require('crypto').randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, buffer, { contentType: m[1], upsert: true });
      if (!upErr) return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
      return null;
    };
    avatar_url = await uploadImage(avatar, 'avatars');
    license_id_url = await uploadImage(license_id_image, 'license-ids');

    // Branch scoping (no hole): staff land in the creator's clinic by default
    // (via trigger). Only a Super Admin may place a new employee in another
    // branch by passing a valid clinic_id — validated, never trusted blindly.
    let targetEmployeeClinicId = req.profile.clinic_id;
    const requestedEmployeeClinicId = typeof req.body?.clinic_id === 'string' ? req.body.clinic_id.trim() : '';
    if (requestedEmployeeClinicId && requestedEmployeeClinicId !== req.profile.clinic_id) {
      if (req.profile.role !== 'super_admin') {
        // Clean up the just-created auth user so a rejected branch choice
        // never leaves an orphan login behind.
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        return res.status(403).json({ error: 'Only a Super Admin can assign staff to another branch.' });
      }
      const { data: targetClinic, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', requestedEmployeeClinicId)
        .maybeSingle();
      if (clinicErr) return next(clinicErr);
      if (!targetClinic) {
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        return res.status(400).json({ error: 'Unknown branch selected.' });
      }
      targetEmployeeClinicId = targetClinic.id;
    }

    const profileUpd = {
      clinic_id: targetEmployeeClinicId,
      phone: normalizedPhone || null,
      extra_roles: extraRoles,
      first_name: trimmedFirst || null,
      middle_name: trimmedMiddle || null,
      last_name: trimmedLast || null,
      suffix_name: trimmedSuffix || null,
      employee_id: finalEmpId || null,
      position: trimmedPosition || null,
      license_no: trimmedLicenseNo || null,
      title: trimmedTitle || null,
      license_id_url: license_id_url || null,
      ...(avatar_url ? { avatar_url } : {}),
    };
    let { error: profileUpdError } = await supabase.from('profiles').update(profileUpd).eq('id', userId);
    if (profileUpdError && isMissingColumn(profileUpdError, 'suffix_name')) {
      console.warn('[db] profiles.suffix_name missing — run migration 0089; saving employee without suffix');
      delete profileUpd.suffix_name;
      ({ error: profileUpdError } = await supabase.from('profiles').update(profileUpd).eq('id', userId));
    }
    if (profileUpdError) console.error('[admin] failed to update new employee profile:', profileUpdError.message);

    let welcomeEmailSent = false;
    try {
      await sendMail({
        to: normalizedEmail,
        subject: `Welcome to ClearMind Psychological Services`,
        templateKey: 'welcome',
        templateData: {
          parent_name: display_name,
          parent_email: normalizedEmail,
          temporary_password: trimmedPassword,
          role: role,
        },
      });
      welcomeEmailSent = true;
    } catch (mailErr) {
      console.error('[email] Failed to send welcome email to registered employee:', mailErr.message);
    }

    await writeAudit({
      clinicId: targetEmployeeClinicId,
      actorId: req.profile.id,
      action: 'register_employee',
      entityType: 'employee',
      entityId: userId,
      summary: `${req.profile.display_name || 'Administrator'} registered employee ${trimmedFirst} ${trimmedLast} (${normalizedEmail}).`,
    });

    res.status(201).json({ 
      id: userId, 
      email: normalizedEmail, 
      employee_id: finalEmpId, 
      role, 
      avatar_url, 
      welcome_email_sent: welcomeEmailSent 
    });
  } catch (err) {
    next(err);
  }
});

// update an employee's details or roles
router.patch('/employees/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const {
      role, extra_roles,
      first_name, middle_name, last_name, suffix_name, display_name,
      phone, employee_id, position, license_no, title, clinic_id
    } = req.body || {};

    let empQuery = supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id, first_name, middle_name, last_name, suffix_name, display_name')
      .eq('id', req.params.id);
    let { data: emp, error: empError } = await empQuery.maybeSingle();
    if (empError && isMissingColumn(empError, 'suffix_name')) {
      ({ data: emp, error: empError } = await supabase
        .from('profiles')
        .select('id, role, extra_roles, clinic_id, first_name, middle_name, last_name, display_name')
        .eq('id', req.params.id)
        .maybeSingle());
    }
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if ((emp.role === 'super_admin' || (emp.extra_roles && emp.extra_roles.includes('super_admin'))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can modify a Super Admin profile.' });
    }

    // Regular admins cannot modify administrator accounts — only super admins can
    if ((emp.role === 'admin' || (emp.extra_roles && emp.extra_roles.includes('admin'))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can modify an Administrator account.' });
    }

    // Role-removal gate: stripping a clinical role that still has assigned
    // students is a silent deactivation of that caseload. Block it and
    // point at the disable/deactivate flows, which reassign first.
    if (role !== undefined || extra_roles !== undefined) {
      const heldBefore = [emp.role, ...(emp.extra_roles || [])].filter(Boolean);
      const primaryAfter = role !== undefined ? role : emp.role;
      const extraAfter = extra_roles !== undefined
        ? (Array.isArray(extra_roles) ? extra_roles : [])
        : (emp.extra_roles || []);
      const heldAfter = new Set([primaryAfter, ...extraAfter].filter(Boolean));
      const removedClinical = heldBefore.filter((r) => CLINICAL_ROLES.includes(r) && !heldAfter.has(r));
      if (removedClinical.length) {
        const assignments = await getClinicianAssignments(emp.id, req);
        const blocking = removedClinical.filter((r) => assignments[r].length > 0);
        if (blocking.length) {
          return res.status(409).json({
            error: `This clinician still handles students as ${blocking.join(' / ')}. Disable the role (with reassignment) or reassign the students first.`,
            code: 'REASSIGNMENT_REQUIRED',
            assignments: {
              psychologist: assignments.psychologist,
              psychometrician: assignments.psychometrician,
            },
          });
        }
      }
    }

    const upd = {};

    // role / extra-roles update
    if (role !== undefined || extra_roles !== undefined) {
      const ALL_ROLES = [...STAFF_ROLES, 'admin', 'super_admin'];
      if ((role === 'super_admin' || (extra_roles && extra_roles.includes('super_admin'))) && req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can assign the Super Admin role.' });
      }
      if ((role === 'admin' || (extra_roles && extra_roles.includes('admin'))) && req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can assign the Administrator role.' });
      }

      if (role !== undefined) {
        if (!ALL_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid primary role' });
        upd.role = role;
      }
      const primary = role !== undefined ? role : emp.role;
      if (extra_roles !== undefined) {
        upd.extra_roles = Array.isArray(extra_roles)
          ? [...new Set(extra_roles.filter((r) => ALL_ROLES.includes(r) && r !== primary))]
          : [];
      }
    }

    // Profile details update
    if (first_name !== undefined) upd.first_name = capitalizeNamePart(String(first_name || '').trim());
    if (middle_name !== undefined) upd.middle_name = capitalizeNamePart(String(middle_name || '').trim());
    if (last_name !== undefined) upd.last_name = capitalizeNamePart(String(last_name || '').trim());
    if (suffix_name !== undefined) {
      const trimmedSuffix = capitalizeNamePart(String(suffix_name || '').trim());
      if (trimmedSuffix.length > MAX.name) {
        return res.status(400).json({ error: `Suffix name must be ${MAX.name} characters or fewer` });
      }
      upd.suffix_name = trimmedSuffix;
    }
    if (display_name !== undefined) {
      upd.display_name = capitalizeNamePart(String(display_name || '').trim());
    } else if (first_name !== undefined || middle_name !== undefined || last_name !== undefined || suffix_name !== undefined) {
      const f = first_name !== undefined ? upd.first_name : (emp.first_name || '');
      const m = middle_name !== undefined ? upd.middle_name : (emp.middle_name || '');
      const l = last_name !== undefined ? upd.last_name : (emp.last_name || '');
      const s = suffix_name !== undefined ? upd.suffix_name : (emp.suffix_name || '');
      upd.display_name = composeDisplayName(f, m, l, s);
    }
    if (title !== undefined) upd.title = String(title || '').trim();
    if (employee_id !== undefined) {
      upd.employee_id = String(employee_id || '').trim().toUpperCase();
      if (upd.employee_id) {
        const { data: dupe } = await supabase
          .from('profiles')
          .select('id')
          .ilike('employee_id', upd.employee_id)
          .neq('id', emp.id)
          .maybeSingle();
        if (dupe) return res.status(409).json({ error: 'That Employee ID is already in use' });
      }
    }
    if (position !== undefined) upd.position = String(position || '').trim();
    if (license_no !== undefined) upd.license_no = String(license_no || '').trim();

    // Branch reassignment. Profiles hold a single home clinic; only a Super
    // Admin may move an employee across branches (regular admins are locked
    // to their own clinic server-side). Super Admin accounts keep full
    // cross-branch visibility whatever their home clinic is.
    if (clinic_id !== undefined) {
      if (req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can reassign branches.' });
      }
      const targetClinicId = String(clinic_id || '').trim();
      if (!targetClinicId) {
        return res.status(400).json({ error: 'Branch is required' });
      }
      const { data: clinicRow, error: clinicError } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', targetClinicId)
        .maybeSingle();
      if (clinicError || !clinicRow) {
        return res.status(400).json({ error: 'Unknown branch' });
      }
      upd.clinic_id = clinicRow.id;
    }
    
    if (phone !== undefined) {
      const cleanPhone = String(phone || '').trim();
      if (cleanPhone) {
        let digits = String(cleanPhone || '').replace(/\D/g, '');
        if (digits.startsWith('63')) digits = `0${digits.slice(2)}`;
        digits = digits.slice(0, 11);
        if (!/^09\d{9}$/.test(digits)) {
          return res.status(400).json({ error: 'Phone must be a valid Philippine mobile number' });
        }
        upd.phone = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ');
      } else {
        upd.phone = null;
      }
    }

    if (Object.keys(upd).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    let { error } = await supabase.from('profiles').update(upd).eq('id', emp.id);
    if (error && isMissingColumn(error, 'suffix_name') && upd.suffix_name !== undefined) {
      console.warn('[db] profiles.suffix_name missing — run migration 0089; saving employee without suffix');
      delete upd.suffix_name;
      // Recompose the display name without the suffix so the row still saves.
      if (upd.display_name && suffix_name !== undefined) {
        const f = first_name !== undefined ? upd.first_name : (emp.first_name || '');
        const m = middle_name !== undefined ? upd.middle_name : (emp.middle_name || '');
        const l = last_name !== undefined ? upd.last_name : (emp.last_name || '');
        upd.display_name = [f, m, l].filter(Boolean).join(' ');
      }
      ({ error } = await supabase.from('profiles').update(upd).eq('id', emp.id));
    }
    if (error) return res.status(400).json({ error: error.message });

    if (upd.display_name && upd.display_name !== emp.display_name) {
      await supabase.auth.admin.updateUserById(emp.id, {
        user_metadata: { display_name: upd.display_name, role: upd.role || emp.role, extra_roles: upd.extra_roles || emp.extra_roles }
      });
    }

    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'update_employee',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} updated an employee's details.`,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/employees/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (req.params.id === req.profile.id) {
      return res.status(400).json({ error: 'You cannot delete your own account here' });
    }

    if ((emp.role === 'admin' || emp.role === 'super_admin' || (emp.extra_roles && emp.extra_roles.includes('admin'))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can delete an Administrator account.' });
    }

    const { error } = await supabase.auth.admin.deleteUser(emp.id);
    if (error) return res.status(400).json({ error: error.message });

    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'delete_employee',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} permanently deleted an employee account.`,
      severity: 'alert',
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- clinician reassignment + per-role status helpers ----------

const CLINICAL_ROLES = ['psychologist', 'psychometrician'];
const treatingColumnFor = (role) => (role === 'psychologist'
  ? 'treating_psychologist_id'
  : 'treating_psychometrician_id');

// Students currently handled by a clinician, grouped by clinical role.
// Only rows inside the caller's accessible branches are counted, so a
// branch admin never sees (or must reassign) another branch's students.
async function getClinicianAssignments(clinicianId, req) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, clinic_id, patient_id, first_name, middle_name, last_name, treating_psychologist_id, treating_psychometrician_id')
    .or(`treating_psychologist_id.eq.${clinicianId},treating_psychometrician_id.eq.${clinicianId}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const visible = (data || []).filter((p) => canAccessClinic(req, p.clinic_id));
  const byId = {};
  for (const p of visible) {
    byId[p.id] = {
      id: p.id,
      patient_id: p.patient_id,
      name: patientName(p),
      clinic_id: p.clinic_id,
    };
  }
  return {
    psychologist: visible.filter((p) => p.treating_psychologist_id === clinicianId).map((p) => byId[p.id]),
    psychometrician: visible.filter((p) => p.treating_psychometrician_id === clinicianId).map((p) => byId[p.id]),
  };
}

// Replacement-clinician checks for a handoff: holds the role, the role is
// active, the account is active, and they can act in every affected branch.
async function validateReplacement(replacementId, role, clinicianId, studentClinicIds) {
  if (!replacementId) return { error: 'A replacement clinician is required.' };
  if (replacementId === clinicianId) return { error: 'The replacement must be a different clinician.' };
  const { data: rep, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, extra_roles, disabled_roles, clinic_id, deleted_at')
    .eq('id', replacementId)
    .maybeSingle();
  if (error || !rep) return { error: 'Replacement clinician not found.' };
  if (rep.deleted_at) return { error: `${rep.display_name || 'The replacement'} is deactivated.` };
  const held = [rep.role, ...((rep.extra_roles) || [])].filter(Boolean);
  const disabled = Array.isArray(rep.disabled_roles) ? rep.disabled_roles : [];
  if (!held.includes(role) || disabled.includes(role)) {
    return { error: `${rep.display_name || 'The replacement'} does not hold an active ${role} role.` };
  }
  const repBranches = [rep.clinic_id, ...(await extraBranchIds(rep.id))].filter(Boolean);
  const missing = [...new Set(studentClinicIds)].filter((c) => !repBranches.includes(c));
  if (missing.length) {
    return { error: `${rep.display_name || 'The replacement'} does not have access to all affected branches. Grant branch access first.` };
  }
  return { rep };
}

// Move every assigned student of one clinical role to another clinician.
// Mirrors the assignment into clinical_profiles, which carries its own
// treating_* copy (see PATCH /patients/:id).
async function reassignRoleStudents(clinicianId, role, replacementId) {
  const column = treatingColumnFor(role);
  const { data: affected, error: findError } = await supabase
    .from('patients')
    .select('id')
    .eq(column, clinicianId)
    .is('deleted_at', null);
  if (findError) throw findError;
  const ids = (affected || []).map((p) => p.id);
  if (!ids.length) return 0;
  const { error: patientError } = await supabase
    .from('patients')
    .update({ [column]: replacementId })
    .in('id', ids);
  if (patientError) throw patientError;
  // clinical_profiles mirrors the assignment; a missing row is fine.
  await supabase
    .from('clinical_profiles')
    .update({ [column]: replacementId })
    .in('patient_id', ids);
  return ids.length;
}

// Soft-deactivate an employee account (reversible via /reactivate). The
// profile row keeps its deleted_at timestamp, and requireAuth blocks sign-in
// while it is set — the Auth user itself is left intact so access can be
// restored without re-registering.
router.patch('/employees/:id/deactivate', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, disabled_roles, clinic_id, display_name, deleted_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (req.params.id === req.profile.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account here' });
    }
    if (emp.deleted_at) {
      return res.status(400).json({ error: 'That account is already deactivated' });
    }
    if ((emp.role === 'admin' || emp.role === 'super_admin' || (emp.extra_roles && (emp.extra_roles.includes('admin') || emp.extra_roles.includes('super_admin')))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can deactivate an Administrator account.' });
    }

    // Reassignment gate: a clinician's students must be handed to another
    // clinician first — deactivation never orphans them into "Unassigned".
    const held = [emp.role, ...(emp.extra_roles || [])].filter(Boolean);
    const disabled = Array.isArray(emp.disabled_roles) ? emp.disabled_roles : [];
    const activeClinical = held.filter((r) => CLINICAL_ROLES.includes(r) && !disabled.includes(r));
    if (activeClinical.length) {
      const assignments = await getClinicianAssignments(emp.id, req);
      const blocking = activeClinical.filter((r) => assignments[r].length > 0);
      if (blocking.length) {
        const reassignKeyFor = (r) => (r === 'psychologist' ? 'reassign_psychologist_id' : 'reassign_psychometrician_id');
        const handoffs = [];
        for (const role of blocking) {
          const replacementId = String(req.body?.[reassignKeyFor(role)] || '').trim();
          if (!replacementId) {
            return res.status(409).json({
              error: `Reassign ${assignments[role].length} student${assignments[role].length === 1 ? '' : 's'} to another ${role === 'psychologist' ? 'psychologist (RPsy)' : 'psychometrician (RPm)'} before deactivating.`,
              code: 'REASSIGNMENT_REQUIRED',
              assignments: {
                psychologist: assignments.psychologist,
                psychometrician: assignments.psychometrician,
              },
            });
          }
          const studentClinics = assignments[role].map((s) => s.clinic_id);
          const { error: repError } = await validateReplacement(replacementId, role, emp.id, studentClinics);
          if (repError) return res.status(400).json({ error: repError });
          handoffs.push({ role, replacementId });
        }
        for (const h of handoffs) {
          const moved = await reassignRoleStudents(emp.id, h.role, h.replacementId);
          await writeAudit({
            clinicId: emp.clinic_id || req.profile.clinic_id,
            actorId: req.profile.id,
            action: 'reassign_students',
            entityType: 'employee',
            entityId: emp.id,
            summary: `${req.profile.display_name || 'Administrator'} reassigned ${moved} student${moved === 1 ? '' : 's'} from ${emp.display_name || 'a clinician'} to another ${h.role} before deactivation.`,
          });
        }
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), disabled_roles: held })
      .eq('id', emp.id);
    if (error) return res.status(400).json({ error: error.message });

    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'deactivate_employee',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} deactivated employee ${emp.display_name || ''}.`.trim(),
      severity: 'warn',
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/employees/:id/reactivate', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id, display_name, deleted_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (!emp.deleted_at) {
      return res.status(400).json({ error: 'That account is already active' });
    }
    if ((emp.role === 'admin' || emp.role === 'super_admin' || (emp.extra_roles && (emp.extra_roles.includes('admin') || emp.extra_roles.includes('super_admin')))) && req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a Super Admin can reactivate an Administrator account.' });
    }

    // Reactivation restores every role the account held (per-role disables
    // set by the deactivation above are cleared together with deleted_at).
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null, disabled_roles: [] })
      .eq('id', emp.id);
    if (error) return res.status(400).json({ error: error.message });

    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'reactivate_employee',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} reactivated employee ${emp.display_name || ''}.`.trim(),
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- per-role status + branch access + assignments ----------
// (The caller's own branch list lives at GET /api/auth/my-clinics so
// non-admin clinicians can use the branch switcher too.)

// Students handled by one clinician, grouped by clinical role — the data
// behind the "reassign before deactivating" confirmation.
router.get('/employees/:id/assignments', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id, display_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const assignments = await getClinicianAssignments(emp.id, req);
    res.json({
      employee: { id: emp.id, name: emp.display_name },
      assignments,
    });
  } catch (err) {
    next(err);
  }
});

function checkRoleManagePermission(req, emp) {
  if ((emp.role === 'super_admin' || (emp.extra_roles && emp.extra_roles.includes('super_admin'))) && req.profile.role !== 'super_admin') {
    return 'Only a Super Admin can modify a Super Admin profile.';
  }
  if ((emp.role === 'admin' || (emp.extra_roles && (emp.extra_roles.includes('admin') || emp.extra_roles.includes('super_admin')))) && req.profile.role !== 'super_admin') {
    return 'Only a Super Admin can modify an Administrator account.';
  }
  return null;
}

async function setDisabledRoles(empId, nextDisabled) {
  const { error } = await supabase
    .from('profiles')
    .update({ disabled_roles: [...new Set(nextDisabled.filter(Boolean))] })
    .eq('id', empId);
  if (error) {
    if (isMissingColumnError(error, 'disabled_roles')) {
      const err = new Error('Per-role status needs migration 0115 (profiles.disabled_roles).');
      err.status = 500;
      throw err;
    }
    throw error;
  }
}

// Disable ONE role on a multi-role account (e.g. switch off psychometrician
// while psychologist keeps working). Students of that role must be handed
// to another clinician first — same gate as full deactivation.
router.patch('/employees/:id/roles/disable', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const role = String(req.body?.role || '').trim();
    if (!CLINICAL_ROLES.includes(role) && !['admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'Unknown role.' });
    }
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, disabled_roles, clinic_id, display_name, deleted_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (emp.deleted_at) {
      return res.status(400).json({ error: 'That account is deactivated. Reactivate it first.' });
    }
    const permError = checkRoleManagePermission(req, emp);
    if (permError) return res.status(403).json({ error: permError });
    const held = [emp.role, ...(emp.extra_roles || [])].filter(Boolean);
    if (!held.includes(role)) {
      return res.status(400).json({ error: `This account does not hold the ${role} role.` });
    }
    const disabled = Array.isArray(emp.disabled_roles) ? emp.disabled_roles : [];
    if (disabled.includes(role)) {
      return res.status(400).json({ error: `The ${role} role is already disabled.` });
    }
    const stillActive = held.filter((r) => r !== role && !disabled.includes(r));
    if (!stillActive.length) {
      return res.status(400).json({
        error: `This is the account's last active role. Use Deactivate Account instead — it reassigns students first.`,
        code: 'LAST_ACTIVE_ROLE',
      });
    }
    if (CLINICAL_ROLES.includes(role)) {
      const assignments = await getClinicianAssignments(emp.id, req);
      if (assignments[role].length) {
        const replacementId = String(
          req.body?.reassign_psychologist_id || req.body?.reassign_psychometrician_id || req.body?.replacement_id || '',
        ).trim();
        if (!replacementId) {
          return res.status(409).json({
            error: `Reassign ${assignments[role].length} student${assignments[role].length === 1 ? '' : 's'} to another ${role === 'psychologist' ? 'psychologist (RPsy)' : 'psychometrician (RPm)'} before disabling this role.`,
            code: 'REASSIGNMENT_REQUIRED',
            assignments,
          });
        }
        const { error: repError } = await validateReplacement(
          replacementId, role, emp.id, assignments[role].map((s) => s.clinic_id),
        );
        if (repError) return res.status(400).json({ error: repError });
        const moved = await reassignRoleStudents(emp.id, role, replacementId);
        await writeAudit({
          clinicId: emp.clinic_id || req.profile.clinic_id,
          actorId: req.profile.id,
          action: 'reassign_students',
          entityType: 'employee',
          entityId: emp.id,
          summary: `${req.profile.display_name || 'Administrator'} reassigned ${moved} student${moved === 1 ? '' : 's'} from ${emp.display_name || 'a clinician'} to another ${role} before disabling the role.`,
        });
      }
    }
    await setDisabledRoles(emp.id, [...disabled, role]);
    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'disable_employee_role',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} disabled the ${role} role on ${emp.display_name || 'an employee'} (other roles stay active).`,
      severity: 'warn',
    });
    return res.json({ ok: true, disabled_roles: [...disabled, role] });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Re-enable a previously disabled role.
router.patch('/employees/:id/roles/enable', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const role = String(req.body?.role || '').trim();
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, disabled_roles, clinic_id, display_name, deleted_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (emp.deleted_at) {
      return res.status(400).json({ error: 'That account is deactivated. Reactivate it first.' });
    }
    const permError = checkRoleManagePermission(req, emp);
    if (permError) return res.status(403).json({ error: permError });
    const disabled = Array.isArray(emp.disabled_roles) ? emp.disabled_roles : [];
    if (!disabled.includes(role)) {
      return res.status(400).json({ error: `The ${role} role is not disabled.` });
    }
    const held = [emp.role, ...(emp.extra_roles || [])].filter(Boolean);
    if (!held.includes(role)) {
      return res.status(400).json({ error: `This account no longer holds the ${role} role.` });
    }
    const next = disabled.filter((r) => r !== role);
    await setDisabledRoles(emp.id, next);
    await writeAudit({
      clinicId: emp.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'enable_employee_role',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} re-enabled the ${role} role on ${emp.display_name || 'an employee'}.`,
    });
    return res.json({ ok: true, disabled_roles: next });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Grant one-email access to another branch: the same auth account (same
// email + password) can then act in that branch via the branch switcher.
// A Super Admin may grant anywhere; a branch admin may only pull staff into
// their own branch.
router.post('/employees/:id/branches', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const clinicId = String(req.body?.clinic_id || '').trim();
    if (!clinicId) return res.status(400).json({ error: 'Branch is required.' });
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id, display_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const permError = checkRoleManagePermission(req, emp);
    if (permError) return res.status(403).json({ error: permError });
    const isSuper = req.profile.role === 'super_admin';
    if (!isSuper && clinicId !== req.profile.clinic_id) {
      return res.status(403).json({ error: 'You can only grant access to your own branch.' });
    }
    if (!isSuper && !canAccessClinic(req, emp.clinic_id)) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, code, name')
      .eq('id', clinicId)
      .maybeSingle();
    if (!clinic) return res.status(400).json({ error: 'Unknown branch.' });
    if (clinic.id === emp.clinic_id) {
      return res.status(400).json({ error: 'This is already the home branch.' });
    }
    const { error } = await supabase
      .from('profile_clinics')
      .upsert({ profile_id: emp.id, clinic_id: clinic.id }, { onConflict: 'profile_id,clinic_id' });
    if (error) {
      if (/relation.*profile_clinics|table.*profile_clinics/i.test(error.message || '')) {
        return res.status(500).json({ error: 'Multi-branch access needs migration 0114 (profile_clinics).' });
      }
      return res.status(400).json({ error: error.message });
    }
    await writeAudit({
      clinicId: clinic.id,
      actorId: req.profile.id,
      action: 'grant_branch_access',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} granted ${emp.display_name || 'an employee'} access to ${clinic.name || clinic.code}.`,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Revoke a granted (non-home) branch. The home branch itself is never
// removed here — use the Super Admin branch move to change it.
router.delete('/employees/:id/branches/:clinicId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: emp } = await supabase
      .from('profiles')
      .select('id, role, extra_roles, clinic_id, display_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!emp || emp.role === 'client') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const permError = checkRoleManagePermission(req, emp);
    if (permError) return res.status(403).json({ error: permError });
    const isSuper = req.profile.role === 'super_admin';
    if (!isSuper && !canAccessClinic(req, emp.clinic_id)) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (req.params.clinicId === emp.clinic_id) {
      return res.status(400).json({ error: 'The home branch cannot be removed. Reassign it instead.' });
    }
    if (!isSuper && req.params.clinicId !== req.profile.clinic_id) {
      return res.status(403).json({ error: 'You can only revoke access to your own branch.' });
    }
    // Refuse when the clinician still handles students there — reassign
    // them first so the branch never keeps orphaned assignments.
    const { data: handled } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: false })
      .eq('clinic_id', req.params.clinicId)
      .or(`treating_psychologist_id.eq.${emp.id},treating_psychometrician_id.eq.${emp.id}`)
      .is('deleted_at', null)
      .limit(1);
    if ((handled || []).length) {
      return res.status(409).json({
        error: 'This clinician still handles students in that branch. Reassign them first.',
        code: 'REASSIGNMENT_REQUIRED',
      });
    }
    const { error } = await supabase
      .from('profile_clinics')
      .delete()
      .eq('profile_id', emp.id)
      .eq('clinic_id', req.params.clinicId);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: req.params.clinicId,
      actorId: req.profile.id,
      action: 'revoke_branch_access',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} revoked ${emp.display_name || 'an employee'}'s access to a branch.`,
      severity: 'warn',
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- practitioner weekly branch schedules ----------
// A clinician's branch follows their schedule: e.g. Cabuyao on Mon/Wed,
// Alabang on Tue/Thu. The Front Desk asks GET /schedule/suggestion while
// booking so the branch pre-selects itself from the weekday (+time).

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function schedulesMissingTable(error) {
  return /relation.*practitioner_branch_schedules|table.*practitioner_branch_schedules/i.test(error?.message || '');
}

async function loadEmployeeForSchedule(req, res, id) {
  const { data: emp } = await supabase
    .from('profiles')
    .select('id, role, extra_roles, clinic_id, display_name')
    .eq('id', id)
    .maybeSingle();
  if (!emp || !canAccessClinic(req, emp.clinic_id) || emp.role === 'client') {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }
  const held = [emp.role, ...(emp.extra_roles || [])].filter(Boolean);
  if (!held.some((r) => CLINICAL_ROLES.includes(r))) {
    res.status(400).json({ error: 'Branch schedules are for clinicians (psychologist / psychometrician) only.' });
    return null;
  }
  return emp;
}

function checkScheduleWrite(req, res, emp, clinicId) {
  const permError = checkRoleManagePermission(req, emp);
  if (permError) {
    res.status(403).json({ error: permError });
    return false;
  }
  // A branch admin manages schedules only inside their own branch; a Super
  // Admin manages every branch.
  if (req.profile.role !== 'super_admin' && clinicId !== req.profile.clinic_id) {
    res.status(403).json({ error: 'You can only set schedules in your own branch.' });
    return false;
  }
  return true;
}

router.get('/employees/:id/schedules', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const emp = await loadEmployeeForSchedule(req, res, req.params.id);
    if (!emp) return;
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('practitioner_branch_schedules')
        .select('id, clinic_id, day_of_week, start_time, end_time')
        .eq('profile_id', emp.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      rows = data || [];
    } catch (e) {
      if (!schedulesMissingTable(e)) throw e;
      return res.status(500).json({ error: 'Branch schedules need migration 0116 (practitioner_branch_schedules).' });
    }
    const labels = await clinicLabelMap();
    res.json({
      schedules: rows.map((s) => ({
        ...s,
        clinic_code: labels[s.clinic_id]?.code || null,
        clinic_name: labels[s.clinic_id]?.name || null,
        day_label: DAY_LABELS[s.day_of_week] || '',
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/employees/:id/schedules', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const emp = await loadEmployeeForSchedule(req, res, req.params.id);
    if (!emp) return;
    const clinicId = String(req.body?.clinic_id || '').trim();
    const day = Number(req.body?.day_of_week);
    const start = String(req.body?.start_time || '08:00').slice(0, 5);
    const end = String(req.body?.end_time || '17:00').slice(0, 5);
    if (!clinicId) return res.status(400).json({ error: 'Branch is required.' });
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Day must be 0 (Sunday) to 6 (Saturday).' });
    }
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) {
      return res.status(400).json({ error: 'Enter a valid time range (start before end).' });
    }
    const { data: clinic } = await supabase.from('clinics').select('id').eq('id', clinicId).maybeSingle();
    if (!clinic) return res.status(400).json({ error: 'Unknown branch.' });
    if (!checkScheduleWrite(req, res, emp, clinicId)) return;
    // The clinician must be able to act in the scheduled branch.
    const access = [emp.clinic_id, ...(await extraBranchIds(emp.id))].filter(Boolean);
    if (!access.includes(clinicId)) {
      return res.status(400).json({
        error: 'Grant this clinician access to that branch first (one email, many branches).',
        code: 'BRANCH_ACCESS_REQUIRED',
      });
    }
    const { data, error } = await supabase
      .from('practitioner_branch_schedules')
      .upsert(
        { profile_id: emp.id, clinic_id: clinicId, day_of_week: day, start_time: start, end_time: end },
        { onConflict: 'profile_id,clinic_id,day_of_week,start_time' },
      )
      .select('id, clinic_id, day_of_week, start_time, end_time')
      .maybeSingle();
    if (error) {
      if (schedulesMissingTable(error)) {
        return res.status(500).json({ error: 'Branch schedules need migration 0116 (practitioner_branch_schedules).' });
      }
      return res.status(400).json({ error: error.message });
    }
    await writeAudit({
      clinicId,
      actorId: req.profile.id,
      action: 'set_practitioner_schedule',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} set ${emp.display_name || 'a clinician'}'s ${DAY_LABELS[day]} schedule (${start}–${end}).`,
    });
    return res.status(201).json({ schedule: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/employees/:id/schedules/:scheduleId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const emp = await loadEmployeeForSchedule(req, res, req.params.id);
    if (!emp) return;
    const { data: row } = await supabase
      .from('practitioner_branch_schedules')
      .select('id, clinic_id, day_of_week')
      .eq('id', req.params.scheduleId)
      .eq('profile_id', emp.id)
      .maybeSingle();
    if (!row) return res.status(404).json({ error: 'Schedule not found.' });
    if (!checkScheduleWrite(req, res, emp, row.clinic_id)) return;
    const { error } = await supabase
      .from('practitioner_branch_schedules')
      .delete()
      .eq('id', row.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: row.clinic_id,
      actorId: req.profile.id,
      action: 'delete_practitioner_schedule',
      entityType: 'employee',
      entityId: emp.id,
      summary: `${req.profile.display_name || 'Administrator'} removed ${emp.display_name || 'a clinician'}'s ${DAY_LABELS[row.day_of_week] || ''} schedule.`.trim(),
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Booking-time suggestion: which branch is this practitioner scheduled in
// on the given date (+optional time)? matched=false → no slot that day,
// and the Front Desk falls back to the acting branch.
router.get('/schedule/suggestion', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const practitionerId = String(req.query.practitioner_id || '').trim();
    const date = String(req.query.date || '').slice(0, 10);
    const time = String(req.query.time || '').slice(0, 5);
    if (!practitionerId || !date) return res.json({ matched: false, clinic_id: null });
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('practitioner_branch_schedules')
        .select('clinic_id, day_of_week, start_time, end_time')
        .eq('profile_id', practitionerId);
      if (error) throw error;
      rows = data || [];
    } catch (e) {
      if (!schedulesMissingTable(e)) throw e;
      return res.json({ matched: false, clinic_id: null });
    }
    const { suggestClinicForDate } = require('../lib/branchSchedules');
    const clinicId = suggestClinicForDate(rows, date, time);
    if (!clinicId) return res.json({ matched: false, clinic_id: null });
    const labels = await clinicLabelMap();
    const match = rows.find((r) => r.clinic_id === clinicId);
    return res.json({
      matched: true,
      clinic_id: clinicId,
      clinic_code: labels[clinicId]?.code || null,
      clinic_name: labels[clinicId]?.name || null,
      day_label: match ? DAY_LABELS[match.day_of_week] : null,
    });
  } catch (err) {
    next(err);
  }
});

// book an appointment
router.post('/schedule', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, patient_ids, format, practitioner_id, date, time, session_type, color_tag, notes, location } =
      req.body || {};
    const isGroup = format === 'group';
    const patientIdList = isGroup
      ? [...new Set((Array.isArray(patient_ids) ? patient_ids : []).filter(Boolean))]
      : [patient_id].filter(Boolean);

    if (isGroup && patientIdList.length < 2) {
      return res.status(400).json({ error: 'At least 2 students are required for a group appointment.' });
    }
    if (!isGroup && !patient_id) {
      return res.status(400).json({ error: 'A student is required for an individual appointment.' });
    }
    if (!practitioner_id || !date || !time || !session_type) {
      return res.status(400).json({ error: 'Patient, practitioner, date, time, and session type are required' });
    }

    // Branch scoping: regular admins book into their own clinic. A Super
    // Admin may target another branch via clinic_id (validated, never
    // trusted blindly) — students and practitioner must belong to it.
    let targetClinicId = req.profile.clinic_id;
    const requestedClinicId = typeof req.body?.clinic_id === 'string' ? req.body.clinic_id.trim() : '';
    if (requestedClinicId && requestedClinicId !== req.profile.clinic_id) {
      if (req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can book into another branch.' });
      }
      const { data: targetClinic, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', requestedClinicId)
        .maybeSingle();
      if (clinicErr) return next(clinicErr);
      if (!targetClinic) return res.status(400).json({ error: 'Unknown branch selected.' });
      targetClinicId = targetClinic.id;
    }

    // treat the entered date/time as clinic-local (Philippines, +08:00)
    const starts = new Date(`${date}T${time}:00+08:00`);
    if (Number.isNaN(starts.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time' });
    }

    const { data: selectedPatients, error: selectedPatientsError } = await supabase
      .from('patients')
      .select('id, clinic_id, caregiver_id, first_name, last_name, photo_url, admission_form_status, waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', targetClinicId)
      .is('deleted_at', null)
      .in('id', patientIdList);
    if (selectedPatientsError) return next(selectedPatientsError);
    if ((selectedPatients || []).length !== patientIdList.length) {
      return res.status(400).json({ error: 'One or more selected students could not be found in this branch.' });
    }
    const notCompliant = (selectedPatients || []).filter((s) => !(
      s.admission_form_status === 'complete' &&
      (s.waiver_submissions || []).some((w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved')
    ));
    if (notCompliant.length > 0) {
      const names = notCompliant.map((s) => `${s.first_name || ''} ${s.last_name || ''}`.trim()).join(', ');
      return res.status(400).json({ error: `Only students with completed compliance can be scheduled. Please complete the admission and consent waiver first for: ${names}.` });
    }

    const { data: practitioner, error: practitionerError } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', practitioner_id)
      .eq('clinic_id', targetClinicId)
      .maybeSingle();
    if (practitionerError) return next(practitionerError);
    if (!practitioner) {
      return res.status(400).json({ error: 'The selected practitioner could not be found in this branch.' });
    }

    // Prevent double-booking: the same practitioner cannot hold overlapping sessions.
    const APPOINTMENT_MINUTES = 60;
    const newEnd = new Date(starts.getTime() + APPOINTMENT_MINUTES * 60000);
    const { data: existingBookings, error: bookingsError } = await supabase
      .from('appointments')
      .select('id, starts_at, duration_minutes, session_type, patient_id, patients:patients!appointments_patient_id_fkey(first_name, last_name), appointment_participants!appointment_participants_appointment_id_fkey(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, last_name))')
      .eq('clinic_id', targetClinicId)
      .eq('practitioner_id', practitioner_id)
      .eq('status', 'scheduled')
      .lt('starts_at', newEnd.toISOString())
      .gt('starts_at', new Date(starts.getTime() - 12 * 60 * 60000).toISOString());
    if (bookingsError) return next(bookingsError);
    const conflict = (existingBookings || []).find((row) => {
      const rowStart = new Date(row.starts_at).getTime();
      const rowEnd = rowStart + (row.duration_minutes || APPOINTMENT_MINUTES) * 60000;
      return rowStart < newEnd.getTime() && rowEnd > starts.getTime();
    });
    const SESSION_NAMES = {
      mmse: 'MMSE',
      cafat: 'CAFAT',
      gars: 'GARS',
      initial_assessment: 'Initial Assessment',
      follow_up: 'Follow-up Session',
      therapy: 'Therapy Session',
      parent_consultation: 'Parent Consultation',
    };
    if (conflict) {
      const conflictStart = new Date(conflict.starts_at);
      // Always render in clinic-local time. Without `timeZone` the server
      // timezone (UTC on Vercel) leaks through, e.g. a 10am Manila booking
      // is reported as "2am".
      const conflictDate = conflictStart.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' });
      const conflictTime = conflictStart.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
      const conflictPatient = conflict.patient_id && conflict.patients
        ? `${conflict.patients.first_name || ''} ${conflict.patients.last_name || ''}`.trim()
        : `${(conflict.appointment_participants || []).length} students (group session)`;
      const sessionLabel = SESSION_NAMES[conflict.session_type] || String(conflict.session_type || '').replace(/_/g, ' ');
      const requestedTime = starts.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
      return res.status(409).json({
        error: `The ${requestedTime} slot you selected is unavailable: ${practitioner.display_name || 'This practitioner'} is already booked on ${conflictDate} at ${conflictTime} (${conflictPatient}${sessionLabel ? ` — ${sessionLabel}` : ''}). Please choose another time.`,
      });
    }

    // Room conflict: the same room cannot host overlapping sessions. The
    // location is stored as "City - Room" (or just "City" when no room was
    // picked) — only bookings with a real room part can clash.
    const roomOfLocation = (value) => {
      const parts = String(value || '').split(' - ');
      return parts.length > 1 ? parts.slice(1).join(' - ').trim().toLowerCase() : '';
    };
    const requestedRoom = roomOfLocation(location);
    if (requestedRoom) {
      const { data: roomBookings, error: roomError } = await supabase
        .from('appointments')
        .select('id, starts_at, duration_minutes, session_type, location, patient_id, patients:patients!appointments_patient_id_fkey(first_name, last_name), appointment_participants!appointment_participants_appointment_id_fkey(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, last_name))')
        .eq('clinic_id', targetClinicId)
        .eq('status', 'scheduled')
        .lt('starts_at', newEnd.toISOString())
        .gt('starts_at', new Date(starts.getTime() - 12 * 60 * 60000).toISOString());
      if (roomError) return next(roomError);
      const roomClash = (roomBookings || []).find((row) => {
        if (roomOfLocation(row.location) !== requestedRoom) return false;
        const rowStart = new Date(row.starts_at).getTime();
        const rowEnd = rowStart + (row.duration_minutes || APPOINTMENT_MINUTES) * 60000;
        return rowStart < newEnd.getTime() && rowEnd > starts.getTime();
      });
      if (roomClash) {
        const clashStart = new Date(roomClash.starts_at);
        const clashDate = clashStart.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' });
        const clashTime = clashStart.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
        const clashRoom = String(roomClash.location || '').split(' - ').slice(1).join(' - ').trim() || 'This room';
        const clashPatient = roomClash.patient_id && roomClash.patients
          ? `${roomClash.patients.first_name || ''} ${roomClash.patients.last_name || ''}`.trim()
          : `${(roomClash.appointment_participants || []).length} students (group session)`;
        const clashSession = SESSION_NAMES[roomClash.session_type] || String(roomClash.session_type || '').replace(/_/g, ' ');
        return res.status(409).json({
          error: `${clashRoom} is already booked on ${clashDate} at ${clashTime} (${clashPatient}${clashSession ? ` — ${clashSession}` : ''}). Please choose another room or time.`,
        });
      }
    }

    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        clinic_id: targetClinicId,
        patient_id: isGroup ? null : patient_id,
        format: isGroup ? 'group' : 'individual',
        practitioner_id,
        starts_at: starts.toISOString(),
        session_type,
        color_tag: color_tag || 'purple',
        location: location || null,
        notes: notes || null,
        created_by_id: req.profile.id,
      })
      .select('id')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    if (isGroup) {
      const { error: participantError } = await supabase
        .from('appointment_participants')
        .insert(patientIdList.map((selectedPatientId) => ({
          appointment_id: appt.id,
          patient_id: selectedPatientId,
        })));
      if (participantError) {
        await supabase.from('appointments').delete().eq('id', appt.id);
        return res.status(400).json({ error: participantError.message });
      }
    }

    // Notify for each patient
    const caregiverIds = (selectedPatients || []).map((pt) => pt.caregiver_id).filter(Boolean);
    const uniqueCaregiverIds = [...new Set(caregiverIds)];
    let caregiverMap = {};
    if (uniqueCaregiverIds.length) {
      const { data: caregiverProfiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', uniqueCaregiverIds);
      caregiverMap = Object.fromEntries((caregiverProfiles || []).map((p) => [p.id, p]));
    }

    const when = starts.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const notificationPromises = [];
    // The practitioner gets their own booking notice (parents are notified
    // below). Without this, staff only discover sessions on the day itself
    // via the Tasks queue — future bookings stay invisible to them.
    {
      const studentNames = (selectedPatients || [])
        .map((pt) => `${pt.first_name || ''} ${pt.last_name || ''}`.trim())
        .filter(Boolean)
        .join(', ');
      const who = isGroup
        ? `${patientIdList.length} students (group session)`
        : (studentNames || 'A student');
      const practitionerTasksPath = practitioner.role === 'psychologist' ? '/psychologist' : '/psychometrician';
      notificationPromises.push(
        createNotification({
          clinicId: targetClinicId,
          recipientId: practitioner_id,
          type: 'appointment',
          title: 'New session booked for you',
          body: `${who} on ${when} at ${location || 'ClearMind Clinic'}.`,
          link: practitionerTasksPath,
        }).catch(() => {}),
      );
    }
    for (const pt of (selectedPatients || [])) {
      const parent = pt.caregiver_id ? caregiverMap[pt.caregiver_id] : null;
      if (parent) {
        notificationPromises.push(
          createNotification({
            clinicId: pt.clinic_id,
            recipientId: pt.caregiver_id,
            type: 'appointment',
            title: 'New appointment scheduled',
            body: `${pt.first_name} has a session on ${when}.`,
            link: '/client/appointments',
          }).catch(() => {}),
        );

        if (parent.email) {
          notificationPromises.push(
            sendMail({
              to: parent.email,
              subject: `Appointment Scheduled: ${pt.first_name} - ClearMind Clinic`,
              templateKey: 'appointmentReminder',
              replyToClinicId: targetClinicId,
              templateData: {
                parent_name: parent.display_name,
                student_name: `${pt.first_name} ${pt.last_name}`,
                when,
                location: location || 'ClearMind Clinic',
                session_type,
                notes: notes || 'None',
              },
            }).catch((e) => console.error('[email] failed to send schedule email:', e.message)),
          );
        }
      }
    }
    if (notificationPromises.length) {
      await Promise.all(notificationPromises);
    }

    await writeAudit({
      clinicId: targetClinicId,
      actorId: req.profile.id,
      action: 'create_appointment',
      entityType: 'appointment',
      entityId: appt.id,
      summary: `${req.profile.display_name || 'Administrator'} scheduled a ${format === 'group' ? 'group' : 'student'} appointment for ${when}.`,
    });
    res.status(201).json({ appointment: appt });
  } catch (err) {
    next(err);
  }
});

// register a patient: create the parent (caregiver) account and enroll their child
router.post('/patients', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const {
      parent_email, parent_password, parent_display_name,
      previously_diagnosed, other_disability, parent_signature, parent_printed_name, parent_signature_date,
      rep_signature, rep_printed_name, rep_signature_date,
      rep_profession, rep_license_no, admission_scan_url,
      permanent_address,
      treating_psychologist_id, treating_psychometrician_id,
      child = {}, clinical = {}, guardian = {}, emergency = {},
    } = req.body || {};
    const hasRealEmail = Boolean(parent_email && parent_email.trim());
    const loginEmail = hasRealEmail ? parent_email.trim() : `noemail_${require('crypto').randomUUID()}@placeholder.local`;
    if (!parent_password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const parentPasswordError = validatePassword(parent_password);
    if (parentPasswordError) {
      return res.status(400).json({ error: parentPasswordError });
    }
    if (!child.first_name || !child.last_name) {
      return res.status(400).json({ error: 'Child first and last name are required' });
    }
    // Branch scoping (no hole): regular admins always register into their own
    // clinic. Only a Super Admin may target another branch by passing a valid
    // clinic_id — it is validated against the clinics table, never trusted
    // blindly, so a tampered id can never silently land in the wrong branch.
    let targetClinicId = req.profile.clinic_id;
    const requestedClinicId = typeof req.body?.clinic_id === 'string' ? req.body.clinic_id.trim() : '';
    if (requestedClinicId && requestedClinicId !== req.profile.clinic_id) {
      if (req.profile.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a Super Admin can register to another branch.' });
      }
      const { data: targetClinic, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', requestedClinicId)
        .maybeSingle();
      if (clinicErr) return next(clinicErr);
      if (!targetClinic) return res.status(400).json({ error: 'Unknown branch selected.' });
      targetClinicId = targetClinic.id;
    }
    if (!child.date_of_birth || !child.sex) {
      return res.status(400).json({ error: 'Child date of birth and sex are required' });
    }
    // A future birthdate is always a data-entry mistake — reject it here so
    // it can never surface as a negative age in rosters and reports.
    if (Number.isNaN(new Date(child.date_of_birth).getTime()) || new Date(child.date_of_birth) > new Date()) {
      return res.status(400).json({ error: 'Enter a valid date of birth (not in the future).' });
    }
    // Wet-signature path: a scanned paper form replaces both e-signatures.
    // The path prefix check keeps arbitrary URLs out of the column.
    const rawScan = typeof admission_scan_url === 'string' ? admission_scan_url.trim() : '';
    const hasWetProof = rawScan.startsWith('admission-scans/');
    if ((!parent_signature || !rep_signature) && !hasWetProof) {
      return res.status(400).json({ error: 'Parent and CMPS representative signatures are required, or upload the scanned wet-signed form.' });
    }
    const parentSigDate = cleanSignatureDate(parent_signature_date);
    if (parentSigDate.error) return res.status(400).json({ error: parentSigDate.error });
    const repSigDate = cleanSignatureDate(rep_signature_date);
    if (repSigDate.error) return res.status(400).json({ error: repSigDate.error });

    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email: loginEmail,
      password: parent_password,
      email_confirm: true,
      user_metadata: { role: 'client', display_name: parent_display_name || guardian.full_name || loginEmail.split('@')[0] },
    });
    if (cErr) return res.status(400).json({ error: cErr.message });
    const caregiverId = created.user.id;
    // Tenant isolation: the trigger defaults new profiles to Cabuyao, so the
    // caregiver profile must follow the target branch explicitly — otherwise
    // an Alabang registration leaves the parent login in Cabuyao while the
    // child is in Alabang and the family becomes invisible to its own branch.
    if (targetClinicId) {
      const { error: cgUpdErr } = await supabase
        .from('profiles')
        .update({ clinic_id: targetClinicId })
        .eq('id', caregiverId);
      if (cgUpdErr) {
        await supabase.auth.admin.deleteUser(caregiverId).catch(() => {});
        return res.status(400).json({ error: cgUpdErr.message });
      }
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        clinic_id: targetClinicId,
        caregiver_id: caregiverId,
        first_name: child.first_name,
        middle_name: child.middle_name || null,
        last_name: child.last_name,
        nick_name: child.nick_name || null,
        date_of_birth: child.date_of_birth,
        sex: child.sex,
        home_address: child.home_address || null,
        permanent_address: permanent_address || null,
        contact_number: child.contact_number || null,
        place_of_birth: child.place_of_birth || null,
        citizenship: child.citizenship || null,
        religion: child.religion || null,
        admission_form_status: 'complete',
        treating_psychologist_id: treating_psychologist_id || null,
        treating_psychometrician_id: treating_psychometrician_id || null,
        // New registrations start pending: the student becomes active
        // automatically once the FO-02 waiver is approved (see
        // refreshEnrollmentStatus). Matches the caregiver notice below.
        status: 'pending',
        allow_journal_entry: false,
        previously_diagnosed: previously_diagnosed ?? null,
        other_disability: other_disability ?? null,
        parent_signature: parent_signature || null,
        parent_printed_name: parent_printed_name || null,
        parent_signature_date: parentSigDate.date,
        rep_signature: rep_signature || null,
        rep_printed_name: rep_printed_name || null,
        rep_signature_date: repSigDate.date,
        rep_profession: rep_profession || null,
        rep_license_no: rep_license_no || null,
        admission_scan_url: hasWetProof ? rawScan : null,
      })
      .select('*')
      .single();
    if (error) {
      if (isMissingColumnError(error, 'parent_signature_date') || isMissingColumnError(error, 'rep_signature_date')) {
        return res.status(400).json({ error: 'Server database is outdated: please apply migration 0110_admission_signature_dates.sql in Supabase first.' });
      }
      if (isMissingColumnError(error, 'admission_scan_url')) {
        return res.status(400).json({ error: 'Server database is outdated: please apply migration 0096_admission_scans.sql in Supabase first.' });
      }
      return res.status(400).json({ error: error.message });
    }

    const photoMatch = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(child.photo || '');
    if (photoMatch) {
      const ext = photoMatch[2] === 'jpeg' || photoMatch[2] === 'jpg' ? 'jpg' : photoMatch[2];
      const buffer = Buffer.from(photoMatch[3], 'base64');
      if (buffer.length <= 5 * 1024 * 1024) {
        const path = `patients/${patient.id}/${require('crypto').randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(path, buffer, { contentType: photoMatch[1], upsert: true });
        if (!upErr) {
          const photo_url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
          await supabase.from('patients').update({ photo_url }).eq('id', patient.id);
        }
      }
    }

    // Accept either a `guardians` array (mother + father) or a single `guardian`.
    const guardianList = (
      Array.isArray(req.body.guardians) && req.body.guardians.length
        ? req.body.guardians
        : [guardian]
    ).filter((g) => g && g.full_name);
    const guardianRows = guardianList.map((g, i) => ({
      patient_id: patient.id,
      full_name: g.full_name,
      relationship: g.relationship || null,
      contact_number: g.contact_number || null,
      email: g.email || null,
      occupation: g.occupation || null,
      employer: g.employer || null,
      is_primary: i === 0,
    }));

    await Promise.all([
      supabase.from('clinical_profiles').insert({
        patient_id: patient.id,
        primary_diagnosis: clinical.primary_diagnosis || null,
        iep_level: clinical.iep_level || null,
        secondary_diagnosis: clinical.secondary_diagnosis || null,
        date_enrolled: clinical.date_enrolled || null,
        referral_source: clinical.referral_source || null,
        allergies: clinical.allergies || null,
        treating_psychologist_id: treating_psychologist_id || null,
        treating_psychometrician_id: treating_psychometrician_id || null,
      }),
      guardianRows.length
        ? supabase.from('guardians').insert(guardianRows)
        : Promise.resolve(),
      emergency.full_name
        ? supabase.from('emergency_contacts').insert({
          patient_id: patient.id,
          full_name: emergency.full_name,
          relationship: emergency.relationship || null,
          contact_number: emergency.contact_number || null,
          alt_contact_number: emergency.alt_contact_number || null,
          address: emergency.address || null,
        })
        : Promise.resolve(),
    ]);

    let welcomeEmailSent = false;
    if (hasRealEmail) {
      try {
        const parentName = parent_display_name || guardian.full_name || parent_email.split('@')[0]
        const childName = `${child.first_name} ${child.last_name}`
        await sendMail({
          to: parent_email,
          subject: `Welcome to ClearMind Psychological Services`,
          templateKey: 'welcome',
          replyToClinicId: patient.clinic_id,
          templateData: {
            parent_name: parentName,
            child_name: childName,
          parent_email,
          temporary_password: parent_password,
        },
      });
        welcomeEmailSent = true;
      } catch (mailErr) {
        console.error('[email] Failed to send welcome email to registered parent:', mailErr.message);
      }
    }

    // Tell the caregiver right away that the SPED Consent & Waiver must be
    // answered before the student becomes official and visible to clinicians.
    // Best-effort (never throws); shown in the bell on first login.
    await createNotification({
      clinicId: patient.clinic_id,
      recipientId: caregiverId,
      type: 'waiver',
      title: 'Action Required: SPED Consent and Waiver',
      body: `Please answer the SPED Consent and Waiver for ${child.first_name} ${child.last_name} to complete enrollment and activate student records.`,
      link: '/client/waivers',
    });

    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'register_patient',
      entityType: 'patient',
      entityId: patient.id,
      summary: `${req.profile.display_name || 'Administrator'} registered ${patientName(patient)}${patient.patient_id ? ` (${patient.patient_id})` : ''} and created the caregiver account.`,
    });
    res.status(201).json({ patient: dto.patientForStaff(patient), welcome_email_sent: welcomeEmailSent });
  } catch (err) {
    next(err);
  }
});

// ---------- wet-signature admission scans ----------
// Scanned paper admission forms land in a private bucket through here —
// browsers never touch admission-scans directly. Mirrors the voice-upload
// pattern: base64 in, storage path out. Admin-only via router guard.
router.post('/admission-scan-upload', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { file_base64, content_type } = req.body || {};
    const raw = typeof file_base64 === 'string' ? file_base64 : '';
    const b64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    if (!b64) return res.status(400).json({ error: 'No file data received.' });
    const allowed = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const type = typeof content_type === 'string' ? content_type.split(';')[0].toLowerCase() : '';
    if (!allowed[type]) return res.status(400).json({ error: 'Only PDF, JPG, PNG, or WebP scans are accepted.' });
    const bytes = Buffer.from(b64, 'base64');
    if (!bytes.length) return res.status(400).json({ error: 'File data is corrupted. Please try again.' });
    if (bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'Scan is too large (max 10MB).' });
    const path = `admissions/${require('crypto').randomUUID()}.${allowed[type]}`;
    const doUpload = () => supabase.storage
      .from('admission-scans')
      .upload(path, bytes, { contentType: type, upsert: false });
    let { error } = await doUpload();
    // Self-healing: create the private bucket on first use so a missing
    // migration step degrades to a one-time setup instead of an error wall.
    if (error && /bucket not found/i.test(error.message || '')) {
      const { error: bucketError } = await supabase.storage.createBucket('admission-scans', { public: false });
      if (!bucketError) ({ error } = await doUpload());
    }
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ url: `admission-scans/${path}` });
  } catch (err) {
    next(err);
  }
});

// Pre-filled admission form for wet signing: renders FO-01 with the details
// already typed into the form and NO ink (stripSignatureImages guarantees
// it), so families only sign on paper. Accepts the same child/clinical/
// guardians/emergency shapes as POST /patients — no account is created.
router.post('/admission-prefill-pdf', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { child = {}, clinical = {}, guardians = [], emergency = {},
      permanent_address, previously_diagnosed, other_disability,
      parent_printed_name, rep_printed_name, rep_profession, rep_license_no,
    } = req.body || {};
    const bundle = {
      patient: {
        ...child,
        photo_url: null,
        permanent_address: permanent_address || null,
        previously_diagnosed: previously_diagnosed ?? null,
        other_disability: other_disability ?? null,
        parent_printed_name: parent_printed_name || null,
        rep_printed_name: rep_printed_name || null,
        rep_profession: rep_profession || null,
        rep_license_no: rep_license_no || null,
        parent_signature: null,
        rep_signature: null,
      },
      clinical: clinical || {},
      guardians: Array.isArray(guardians) ? guardians : [],
      emergency: emergency || {},
    };
    const bytes = await renderFormPdf({
      code: 'CMPS:SE-FO-01',
      bundle,
      submission: null,
      report: null,
      requestingUser: req.profile,
      hideSignatures: true,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': 'attachment; filename="CMPS-SE-FO-01-prefilled.pdf"',
      'Cache-Control': 'private, no-store',
    });
    res.end(Buffer.from(bytes));
  } catch (err) {
    next(err);
  }
});

// full profile (patient + clinical + guardians + emergency) for the detail panel
router.get('/patients/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: patient, error } = await supabase
      .from('patients')
      .select('*, photo_url')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return next(error);
    if (!patient || !canAccessClinic(req, patient.clinic_id)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const [{ data: clinical }, { data: guardians }, { data: emergency }, { data: caregiver }, psychologistInfo, psychometricianInfo] =
      await Promise.all([
        supabase.from('clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
        supabase.from('guardians').select('*').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
        supabase.from('emergency_contacts').select('*').eq('patient_id', patient.id).limit(1).maybeSingle(),
        supabase
          .from('profiles')
          .select('id, display_name, email')
          .eq('id', patient.caregiver_id)
          .maybeSingle(),
        patient.treating_psychologist_id
          ? supabase.from('profiles').select('id, display_name, license_no, title').eq('id', patient.treating_psychologist_id).maybeSingle()
          : Promise.resolve({ data: null }),
        patient.treating_psychometrician_id
          ? supabase.from('profiles').select('id, display_name, license_no, title').eq('id', patient.treating_psychometrician_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    res.json({
      patient: dto.patientForStaff(patient, {
        full_name: patientName(patient),
        photo_url: patient.photo_url || null,
        age: ageFromDob(patient.date_of_birth),
        treating_psychologist: psychologistInfo?.data || null,
        treating_psychometrician: psychometricianInfo?.data || null,
      }),
      caregiver: caregiver || null,
      clinical: clinical ? dto.clinicalForStaff(clinical) : null,
      guardians: (guardians || []).map(dto.guardianCard),
      emergency: emergency ? dto.emergencyCard(emergency) : null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- assessment activation (feature #11) ----------
// Admin controls which assessment templates are "available". MHPs file activation
// requests; the admin activates a template (is_active) and/or resolves the request.

router.get('/assessments', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic. Templates are global.
    const assessScope = listClinicScope(req);
    const [
      { data: templates, error: tErr },
      { data: requests, error: rErr },
      { data: permissions, error: pErr },
      { data: patients, error: ptErr }
    ] = await Promise.all([
      supabase
        .from('assessment_templates')
        .select('id, title, document_type_code, est_minutes, is_active, document_types(description)')
        .order('title', { ascending: true }),
      (() => {
        let q = supabase
          .from('assessment_activation_requests')
          .select('id, clinic_id, note, status, created_at, template_id, assessment_templates(title), requested_by:requested_by_id(display_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (assessScope) q = q.eq('clinic_id', assessScope);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('assessment_permissions')
          .select('id, clinic_id, patient_id, template_id, status, requested_by_id, granted_by_id');
        if (assessScope) q = q.eq('clinic_id', assessScope);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('patients')
          .select('id, clinic_id, patient_id, first_name, middle_name, last_name, photo_url')
          .order('last_name', { ascending: true });
        if (assessScope) q = q.eq('clinic_id', assessScope);
        return q;
      })(),
    ]);

    if (tErr) return next(tErr);
    if (rErr) return next(rErr);
    if (pErr) return next(pErr);
    if (ptErr) return next(ptErr);

    const assessLabels = await clinicLabelMap();
    res.json({
      templates: (templates || []).map((t) => ({
        id: t.id,
        title: t.title,
        code: t.document_type_code,
        desc: t.document_types ? t.document_types.description : '',
        duration: t.est_minutes ? `Est. ${t.est_minutes} mins` : '',
        active: t.is_active,
      })),
      requests: (requests || []).map((r) => ({
        id: r.id,
        clinic_id: r.clinic_id,
        clinic_code: assessLabels[r.clinic_id]?.code || null,
        clinic_name: assessLabels[r.clinic_id]?.name || null,
        note: r.note,
        templateId: r.template_id,
        templateTitle: r.assessment_templates ? r.assessment_templates.title : '—',
        requestedBy: r.requested_by ? r.requested_by.display_name : 'A professional',
        createdAt: r.created_at,
      })),
      permissions: permissions || [],
      patients: (patients || []).map((p) => ({
        id: p.id,
        clinic_id: p.clinic_id,
        clinic_code: assessLabels[p.clinic_id]?.code || null,
        clinic_name: assessLabels[p.clinic_id]?.name || null,
        patient_id: p.patient_id,
        name: `${p.first_name} ${p.last_name}`
      }))
    });
  } catch (err) {
    next(err);
  }
});

// activate / deactivate an assessment template
router.patch('/assessments/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }
    const { data, error } = await supabase
      .from('assessment_templates')
      .update({ is_active })
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Assessment not found' });
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: is_active ? 'activate_assessment_template' : 'deactivate_assessment_template',
      entityType: 'assessment_template',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Administrator'} ${is_active ? 'activated' : 'deactivated'} an assessment template.`,
      severity: is_active ? 'info' : 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// approve (activates the template) or decline an MHP activation request
router.patch('/assessment-requests/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status } = req.body || {};
    if (!['approved', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or declined' });
    }
    const { data: reqRow } = await supabase
      .from('assessment_activation_requests')
      .select('id, clinic_id, template_id, requested_by_id, status, assessment_templates(title)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!reqRow || !canAccessClinic(req, reqRow.clinic_id)) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ error: 'Request already resolved' });
    }

    if (status === 'approved') {
      const { error: actErr } = await supabase
        .from('assessment_templates')
        .update({ is_active: true })
        .eq('id', reqRow.template_id);
      if (actErr) return res.status(400).json({ error: actErr.message });
    }

    const { error } = await supabase
      .from('assessment_activation_requests')
      .update({ status, resolved_by_id: req.profile.id, resolved_at: new Date().toISOString() })
      .eq('id', reqRow.id);
    if (error) return res.status(400).json({ error: error.message });

    const title = reqRow.assessment_templates ? reqRow.assessment_templates.title : 'An assessment';
    await createNotification({
      clinicId: reqRow.clinic_id,
      recipientId: reqRow.requested_by_id,
      type: 'assessment',
      title: status === 'approved' ? 'Assessment activated' : 'Assessment request declined',
      body:
        status === 'approved'
          ? `${title} is now available you can assign it to a patient.`
          : `Your request to activate ${title} was declined.`,
      link: '/psychometrician/assessments',
    });
    await writeAudit({
      clinicId: reqRow.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action:
        status === 'approved'
          ? 'approve_assessment_activation_request'
          : 'decline_assessment_activation_request',
      entityType: 'assessment_activation_request',
      entityId: reqRow.id,
      summary: `${req.profile.display_name || 'Administrator'} ${status === 'approved' ? 'approved' : 'declined'} the activation request for ${title}.`,
      severity: status === 'approved' ? 'info' : 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// admin manually changes the password of any user in their clinic
// admin manually changes the email or password of any user in their clinic
router.patch('/users/:id/account', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { password, email } = req.body || {};
    
    const updates = {};
    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      updates.password = password;
    }
    if (email) {
      if (email.startsWith('noemail_')) return res.status(400).json({ error: 'Cannot change a system-generated email. Use the student number to log in.' });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    // Validate target user belongs to the same clinic as the admin
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, clinic_id, role, extra_roles')
      .eq('id', req.params.id)
      .maybeSingle();

    if (profileErr) return next(profileErr);
    // Regular admins may only manage their own branch; Super Admin may act
    // on any branch.
    if (!userProfile || !canAccessClinic(req, userProfile.clinic_id)) {
      return res.status(404).json({ error: 'User profile not found in your clinic' });
    }

    // Prevent an admin from resetting another admin's account — a peer takeover
    // vector. Only a super_admin may reset elevated accounts.
    const targetRoles = [userProfile.role, ...(userProfile.extra_roles || [])];
    const actorRoles = [req.profile.role, ...(req.profile.extra_roles || [])];
    const targetIsElevated = targetRoles.some((r) => ['admin', 'super_admin'].includes(r));
    if (targetIsElevated && !actorRoles.includes('super_admin')) {
      return res.status(403).json({ error: 'Admins cannot modify another admin\'s account.' });
    }

    // Override user account
    const { error: updateErr } = await supabase.auth.admin.updateUserById(req.params.id, updates);
    if (updateErr) {
      return res.status(400).json({ error: updateErr.message });
    }

    await writeAudit({
      clinicId: userProfile.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'admin_update_user_account',
      entityType: 'user_account',
      entityId: userProfile.id,
      summary: `${req.profile.display_name || 'Administrator'} updated a clinic user's account details.`,
      severity: 'alert',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function authorizeAttendancePatient(patientId, profile) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, patient_id, first_name, middle_name, last_name, clinic_id, photo_url')
    .eq('id', patientId)
    .eq('clinic_id', profile.clinic_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Get a specific student's attendance & session form for a month_year
// Get aggregated attendance statistics for the admin dashboard
router.get('/attendance-stats', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: attendanceLogs, error: attErr } = await supabase
      .from('student_attendance_records')
      .select(`
        id,
        date,
        status,
        time_in,
        time_out,
        remarks,
        student_attendance_session_forms (
          month_year,
          program_enrolled,
          patient_id,
          patients (
            first_name,
            last_name,
            patient_id
          )
        )
      `)
      .order('date', { ascending: false });

    if (attErr) return next(attErr);

    let total = 0;
    let present = 0;
    let absent = 0;
    let excused = 0;
    const studentBreakdown = {};

    (attendanceLogs || []).forEach((row) => {
      total++;
      if (row.status === 'Present') present++;
      else if (row.status === 'Absent') absent++;
      else if (row.status === 'Excused') excused++;

      const form = row.student_attendance_session_forms;
      if (form && form.patients) {
        const studentId = form.patient_id;
        const studentName = `${form.patients.first_name} ${form.patients.last_name}`;
        if (!studentBreakdown[studentId]) {
          studentBreakdown[studentId] = {
            id: studentId,
            sid: form.patients.patient_id,
            name: studentName,
            program: form.program_enrolled,
            total: 0,
            present: 0,
            absent: 0,
            excused: 0
          };
        }
        studentBreakdown[studentId].total++;
        if (row.status === 'Present') studentBreakdown[studentId].present++;
        else if (row.status === 'Absent') studentBreakdown[studentId].absent++;
        else if (row.status === 'Excused') studentBreakdown[studentId].excused++;
      }
    });

    res.json({
      summary: {
        total,
        present,
        absent,
        excused,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 100
      },
      students: Object.values(studentBreakdown),
      recentLogs: (attendanceLogs || []).map((row) => {
        const form = row.student_attendance_session_forms;
        return {
          id: row.id,
          date: row.date,
          status: row.status,
          timeIn: row.time_in,
          timeOut: row.time_out,
          remarks: row.remarks,
          studentName: form && form.patients ? `${form.patients.first_name} ${form.patients.last_name}` : 'Unknown Student',
          patientId: form ? form.patient_id : null,
          program: form ? form.program_enrolled : ''
        };
      })
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year } = req.query || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    const patient = await authorizeAttendancePatient(patient_id, req.profile);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });

    // 1. Fetch form header
    const { data: form, error: formErr } = await supabase
      .from('student_attendance_session_forms')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('month_year', month_year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (formErr) return next(formErr);

    if (!form) {
      return res.json({ form: null, attendance: [], sessions: [] });
    }

    // 2. Fetch attendance rows
    const { data: attendance, error: attErr } = await supabase
      .from('student_attendance_records')
      .select('*')
      .eq('form_id', form.id)
      .order('date', { ascending: true });

    if (attErr) return next(attErr);

    // 3. Fetch session rows
    const { data: sessions, error: sessErr } = await supabase
      .from('student_session_records')
      .select('*')
      .eq('form_id', form.id)
      .order('date', { ascending: true });

    if (sessErr) return next(sessErr);

    res.json({ form, attendance, sessions });
  } catch (err) {
    next(err);
  }
});

// Create or update a student's attendance & session form (FO-11)
router.post('/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year, program_enrolled, facilitator_name, facilitator_signature, signoff_date, additional_notes, attendance = [], sessions = [] } = req.body || {};

    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    if (String(month_year).trim().length > 50) {
      return res.status(400).json({ error: 'month_year must not exceed 50 characters' });
    }
    const patient = await authorizeAttendancePatient(patient_id, req.profile);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });
    if (!Array.isArray(attendance) || !Array.isArray(sessions)) {
      return res.status(400).json({ error: 'attendance and sessions must be arrays' });
    }
    const invalidAttendance = attendance.find(
      (row) => !['Present', 'Absent', 'Excused'].includes(row.status),
    );
    if (invalidAttendance) {
      return res.status(400).json({ error: 'Attendance status must be Present, Absent, or Excused.' });
    }

    // 1. Upsert form header
    const { data: existingForm } = await supabase
      .from('student_attendance_session_forms')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('month_year', month_year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // A finalized month is read-only until reopened — daily edits must not
    // silently rewrite a signed-off record.
    if (existingForm?.is_finalized) {
      return res.status(403).json({ error: 'This month is finalized. Reopen it to make changes.' });
    }

    const baseFormPayload = {
      patient_id,
      month_year,
      program_enrolled,
      facilitator_name: facilitator_name || null,
      facilitator_signature,
      signoff_date: signoff_date || new Date().toISOString().slice(0, 10),
      additional_notes,
      created_by: req.profile.id,
    };

    let formId;
    let facilitatorNameStored = true;
    if (existingForm) {
      formId = existingForm.id;
      let updateErr = null;
      ({ error: updateErr } = await supabase
        .from('student_attendance_session_forms')
        .update(baseFormPayload)
        .eq('id', formId));
      if (isMissingColumnError(updateErr, 'facilitator_name')) {
        const legacyPayload = { ...baseFormPayload };
        delete legacyPayload.facilitator_name;
        ({ error: updateErr } = await supabase
          .from('student_attendance_session_forms')
          .update(legacyPayload)
          .eq('id', formId));
        facilitatorNameStored = false;
      }
      if (updateErr) return next(updateErr);
    } else {
      let newForm = null;
      let insertErr = null;
      ({ data: newForm, error: insertErr } = await supabase
        .from('student_attendance_session_forms')
        .insert(baseFormPayload)
        .select('id')
        .single());
      if (isMissingColumnError(insertErr, 'facilitator_name')) {
        const legacyPayload = { ...baseFormPayload };
        delete legacyPayload.facilitator_name;
        ({ data: newForm, error: insertErr } = await supabase
          .from('student_attendance_session_forms')
          .insert(legacyPayload)
          .select('id')
          .single());
        facilitatorNameStored = false;
      }
      if (insertErr) return next(insertErr);
      formId = newForm.id;
    }

    // 2. Sync attendance rows
    const { error: delAttErr } = await supabase
      .from('student_attendance_records')
      .delete()
      .eq('form_id', formId);
    if (delAttErr) return next(delAttErr);

    if (attendance.length > 0) {
      const { error: insAttErr } = await supabase
        .from('student_attendance_records')
        .insert(attendance.map((r) => ({
          form_id: formId,
          date: r.date,
          status: r.status,
          time_in: r.time_in || r.timeIn || null,
          time_out: r.time_out || r.timeOut || null,
          remarks: r.remarks || null
        })));
      if (insAttErr) return next(insAttErr);
    }

    // 3. Sync session rows
    const { error: delSessErr } = await supabase
      .from('student_session_records')
      .delete()
      .eq('form_id', formId);
    if (delSessErr) return next(delSessErr);

    if (sessions.length > 0) {
      const { error: insSessErr } = await supabase
        .from('student_session_records')
        .insert(sessions.map((r) => ({
          form_id: formId,
          date: r.date,
          domain: r.domain || null,
          activity: r.activity || null,
          assistance: r.assistance || null,
          prompts: r.prompts || null,
          cues: r.cues || null,
          prodding: r.prodding || null,
          notes: r.notes || null
        })));
      if (insSessErr) return next(insSessErr);
    }

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: existingForm ? 'update_attendance_record' : 'create_attendance_record',
      entityType: 'attendance_session_form',
      entityId: formId,
      summary: `${req.profile.display_name || 'Administrator'} ${existingForm ? 'updated' : 'created'} the attendance and session record for ${month_year}.`,
    });
    res.status(200).json({
      success: true,
      formId,
      facilitatorNameStored,
      ...(facilitatorNameStored ? {} : {
        warning: 'Attendance saved, but facilitator_name was not stored because migration 0058_ensure_attendance_facilitator_name.sql is not applied yet.',
      }),
    });
  } catch (err) {
    next(err);
  }
});

// Finalize (lock) or reopen a month's attendance & session form.
// Finalizing requires the facilitator signature — once per month, at the end.
// While finalized, saves and deletes are rejected until reopened.
router.post('/attendance-session-forms/finalize', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year, finalized } = req.body || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    const patient = await authorizeAttendancePatient(patient_id, req.profile);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });

    const { data: form, error: formErr } = await supabase
      .from('student_attendance_session_forms')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('month_year', month_year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (formErr) return next(formErr);
    if (!form) return res.status(404).json({ error: 'No attendance record for this month yet.' });

    const wantFinalized = finalized !== false;
    if (wantFinalized && !form.facilitator_signature) {
      return res.status(400).json({ error: 'Facilitator signature is required to finalize this month.' });
    }
    const { error: updErr } = await supabase
      .from('student_attendance_session_forms')
      .update({
        is_finalized: wantFinalized,
        finalized_at: wantFinalized ? new Date().toISOString() : null,
      })
      .eq('id', form.id);
    if (updErr) {
      if (isMissingColumnError(updErr, 'is_finalized')) {
        return res.status(400).json({ error: 'Server database is outdated: please apply migration 0105_attendance_finalize.sql in Supabase first.' });
      }
      return next(updErr);
    }
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: wantFinalized ? 'finalize_attendance_record' : 'reopen_attendance_record',
      entityType: 'attendance_session_form',
      entityId: form.id,
      summary: `${req.profile.display_name || 'Administrator'} ${wantFinalized ? 'finalized' : 'reopened'} the attendance and session record for ${patientName(patient)} for ${month_year}.`,
    });
    res.json({ ok: true, is_finalized: wantFinalized });
  } catch (err) {
    next(err);
  }
});

// ---------- database-backed official PDF forms ----------
// These routes deliberately do not render React markup. They reload the source
// record from Supabase and pass it to the fixed CMPS reference-form renderer.

async function loadPdfPatient(patientId, clinicId) {
  // clinicId null = all branches (Super Admin cross-branch download).
  let patientQuery = supabase
    .from('patients')
    .select('*, photo_url')
    .eq('id', patientId)
    .is('deleted_at', null);
  if (clinicId) patientQuery = patientQuery.eq('clinic_id', clinicId);
  const { data: patient, error: patientError } = await patientQuery.maybeSingle();
  if (patientError) throw patientError;
  if (!patient) return null;

  const [{ data: clinical, error: clinicalError }, { data: guardians, error: guardianError }, { data: emergency, error: emergencyError }] = await Promise.all([
    supabase.from('clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
    supabase.from('guardians').select('*').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
    supabase.from('emergency_contacts').select('*').eq('patient_id', patient.id).limit(1).maybeSingle(),
  ]);
  if (clinicalError) throw clinicalError;
  if (guardianError) throw guardianError;
  if (emergencyError) throw emergencyError;

  const profileIds = [patient.treating_psychologist_id, patient.treating_psychometrician_id].filter(Boolean);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, middle_name, last_name, phone, license_no, title')
    .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);
  if (profileError) throw profileError;
  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

  return {
    patient: {
      ...patient,
      full_name: patientName(patient),
        photo_url: patient.photo_url || patient.patients?.photo_url || null,
      treating_psychologist: profileById[patient.treating_psychologist_id] || null,
      treating_psychometrician: profileById[patient.treating_psychometrician_id] || null,
    },
    clinical: clinical || {},
    guardians: guardians || [],
    emergency: emergency || {},
  };
}

async function attachPdfProfiles(record) {
  const ids = [
    record.prepared_by_id,
    record.noted_by_id,
    record.author_id,
    record.reviewed_by_id,
    record.respondent_profile_id,
    record.answered_by_id,
    record.signed_by_profile_id,
  ].filter(Boolean);
  if (!ids.length) return record;
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, middle_name, last_name, phone, license_no, title')
    .in('id', [...new Set(ids)]);
  if (error) throw error;
  const byId = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  record.prepared_profile = byId[record.prepared_by_id] || byId[record.author_id] || null;
  record.prepared_by = record.prepared_profile;
  record.noted_profile = byId[record.noted_by_id] || null;
  record.reviewed_profile = byId[record.reviewed_by_id] || null;
  record.reviewer_profile = record.noted_profile || record.reviewed_profile;
  record.noted_by = record.noted_profile || record.reviewer_profile;
  record.answered_profile = byId[record.answered_by_id] || null;
  record.signed_by_profile = byId[record.signed_by_profile_id] || null;
  record.respondent_profile = byId[record.respondent_profile_id] || null;
  return record;
}

async function loadPdfDocument(sourceTable, id, clinicId) {
  if (!['assessment_reports', 'assessment_submissions', 'session_logs', 'waiver_submissions'].includes(sourceTable)) {
    const error = new Error('Unsupported document source');
    error.status = 400;
    throw error;
  }

  const { data: record, error } = await supabase
    .from(sourceTable)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  // Distinct errors on purpose: a generic "not found" hides whether the
  // document or its student vanished (e.g. archived after the list loaded).
  if (!record) {
    const gone = new Error('Assessment record no longer exists. Reload the records list — it may have been deleted.');
    gone.status = 404;
    throw gone;
  }

  const bundle = await loadPdfPatient(record.patient_id, clinicId);
  if (!bundle) {
    const orphaned = new Error('The linked student record is archived or no longer available. Restore the student to preview this document.');
    orphaned.status = 404;
    throw orphaned;
  }

  if (sourceTable === 'assessment_submissions') {
    const { data: template, error: templateError } = await supabase
      .from('assessment_templates')
      .select('id, title, document_type_code, structure, max_score')
      .eq('id', record.template_id)
      .maybeSingle();
    if (templateError) throw templateError;
    record.assessment_templates = template || {};
    record.document_type_code = template?.document_type_code || 'CMPS:SE-FO-04';
  }

  if (sourceTable === 'waiver_submissions' && !record.document_type_code) {
    record.document_type_code = 'CMPS:SE-FO-02';
  }

  if (sourceTable === 'session_logs') {
    record.report_type = 'daily_activity';
    Object.assign(record, normalizeDailyActivityRecord(record, bundle));
  }

  const code = inferFormCode(record);
  await attachPdfProfiles(record);
  if (
    record.report_type === 'daily_activity' &&
    !record.noted_by &&
    !record.reviewer_profile &&
    bundle?.patient?.treating_psychologist
  ) {
    // Same DAR preview fallback as the psychometrician loader above.
    record.noted_by = bundle.patient.treating_psychologist;
  }
  return { record, bundle, code };
}

function sendPdf(res, bytes, filename) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(bytes.length),
    'Content-Disposition': `attachment; filename="${filename.replace(/[^a-z0-9._-]+/gi, '_')}"`,
    'Cache-Control': 'private, no-store',
  });
  res.end(bytes);
}

// Exported-file audit: who downloaded what, when. Fire-and-forget so a
// logging failure never blocks the download itself.
async function logExport(req, filename, entityId = null) {
  try {
    await writeAudit({
      clinicId: req.profile?.clinic_id,
      actorId: req.profile?.id,
      action: 'export_pdf',
      entityType: 'document',
      entityId,
      summary: `${req.profile?.display_name || req.profile?.email || 'A user'} downloaded ${filename}.`,
    });
  } catch {
    // ignore — download already succeeded
  }
}

router.get('/pdf/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year } = req.query || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    const patient = await authorizeAttendancePatient(patient_id, req.profile);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });

    const [{ data: form, error: formError }, { data: attendance, error: attendanceError }] = await Promise.all([
      supabase
        .from('student_attendance_session_forms')
        .select('*')
        .eq('patient_id', patient_id)
        .eq('month_year', month_year)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('student_attendance_records')
        .select('*, student_attendance_session_forms!inner(patient_id, month_year)')
        .eq('student_attendance_session_forms.patient_id', patient_id)
        .eq('student_attendance_session_forms.month_year', month_year)
        .order('date', { ascending: true }),
    ]);
    if (formError) return next(formError);
    if (attendanceError) return next(attendanceError);

    const attendanceForm = form || {
      patient_id,
      month_year,
      program_enrolled: patient.enrollment_type || '',
      facilitator_name: '',
      facilitator_signature: null,
      signoff_date: null,
      additional_notes: '',
    };
    const formId = attendanceForm.id;
    const { data: sessions, error: sessionsError } = formId
      ? await supabase
        .from('student_session_records')
        .select('*')
        .eq('form_id', formId)
        .order('date', { ascending: true })
      : { data: [], error: null };
    if (sessionsError) return next(sessionsError);

    const bundle = await loadPdfPatient(patient.id, isSuperAdminReq(req) ? null : req.profile.clinic_id);
    // ?ctc=true renders the watermark-free Certified True Copy (same pattern
    // as the other official PDF endpoints).
    const isCtc = req.query.ctc === 'true';
    const bytes = await renderAttendancePdf({
      bundle,
      form: attendanceForm,
      attendance: (attendance || []).map(({ student_attendance_session_forms: _form, ...row }) => row),
      sessions: sessions || [],
      monthYear: month_year,
      requestingUser: req.profile,
      isCtc,
    });
    const studentId = bundle.patient.patient_id || bundle.patient.id;
    const filename = isCtc ? `${studentId}-CMPS-SE-FO-11-CTC.pdf` : `${studentId}-CMPS-SE-FO-11.pdf`;
    await logExport(req, filename, patient.id);
    sendPdf(res, bytes, filename);
  } catch (err) {
    next(err);
  }
});

router.get('/pdf/patients/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const code = String(req.query.code || 'CMPS:SE-FO-01');
    if (code !== 'CMPS:SE-FO-01') return res.status(400).json({ error: 'Patient PDF export currently supports FO-01.' });
    const bundle = await loadPdfPatient(req.params.id, isSuperAdminReq(req) ? null : req.profile.clinic_id);
    if (!bundle) return res.status(404).json({ error: 'Patient not found' });
    const isCtc = req.query.ctc === 'true';
    const bytes = await renderFormPdf({ code, bundle, requestingUser: req.profile, isCtc });
    await logExport(req, `${bundle.patient.patient_id || bundle.patient.id}-FO-01.pdf`, bundle.patient.id);
    sendPdf(res, bytes, `${bundle.patient.patient_id || bundle.patient.id}-FO-01.pdf`);
  } catch (err) {
    next(err);
  }
});

router.get('/pdf/documents/:sourceTable/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // loadPdfDocument throws descriptive 404s (record vs student gone).
    const loaded = await loadPdfDocument(req.params.sourceTable, req.params.id, isSuperAdminReq(req) ? null : req.profile.clinic_id);
    const isCtc = req.query.ctc === 'true';
    const bytes = await renderFormPdf({
      code: loaded.code,
      bundle: loaded.bundle,
      submission: loaded.record,
      report: loaded.record,
      requestingUser: req.profile,
      isCtc,
    });
    const studentId = loaded.bundle.patient.patient_id || loaded.bundle.patient.id;
    await logExport(req, `${studentId}-${loaded.code.replace(/[:]/g, '-')}.pdf`, loaded.bundle.patient.id);
    sendPdf(res, bytes, `${studentId}-${loaded.code.replace(/[:]/g, '-')}.pdf`);
  } catch (err) {
    next(err);
  }
});

router.delete('/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year } = req.query || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    const patient = await authorizeAttendancePatient(patient_id, req.profile);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });

    const { data: existing, error: existingErr } = await supabase
      .from('student_attendance_session_forms')
      .select('*')
      .eq('patient_id', patient_id)
      .eq('month_year', month_year)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr) return next(existingErr);
    if (!existing) {
      return res.status(404).json({ error: 'No monthly attendance record was found.' });
    }
    if (existing.is_finalized) {
      return res.status(403).json({ error: 'This month is finalized. Reopen it before deleting.' });
    }

    const { data: deleted, error } = await supabase
      .from('student_attendance_session_forms')
      .delete()
      .eq('id', existing.id)
      .select('id');
    if (error) return next(error);
    if (!deleted?.length) {
      return res.status(404).json({ error: 'No monthly attendance record was found.' });
    }

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'delete_attendance_record',
      entityType: 'attendance_session_form',
      entityId: deleted[0].id,
      summary: `${req.profile.display_name || 'Administrator'} deleted the attendance and session record for ${patientName(patient)} for ${month_year}.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get pending patient assessment permissions
router.get('/assessment-permissions/pending', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const permScope = listClinicScope(req);
    let permQuery = supabase
      .from('assessment_permissions')
      .select('id, clinic_id, patient_id, template_id, status, requested_by_id, patients(first_name, last_name, patient_id), assessment_templates(title), requested_by:requested_by_id(display_name)')
      .eq('status', 'pending');
    if (permScope) permQuery = permQuery.eq('clinic_id', permScope);
    const { data: rows, error } = await permQuery;

    if (error) return next(error);

    const permLabels = await clinicLabelMap();
    res.json({
      requests: (rows || []).map((r) => ({
        id: r.id,
        clinic_id: r.clinic_id,
        clinic_code: permLabels[r.clinic_id]?.code || null,
        clinic_name: permLabels[r.clinic_id]?.name || null,
        patientName: r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : 'Unknown Student',
        sid: r.patients ? r.patients.patient_id : '—',
        templateTitle: r.assessment_templates ? r.assessment_templates.title : '—',
        requestedBy: r.requested_by ? r.requested_by.display_name : 'MHP',
        patient_id: r.patient_id,
        template_id: r.template_id
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Approve or deny a patient assessment permission request
router.patch('/assessment-permissions/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status } = req.body || {}; // 'granted' or 'none'
    if (!['granted', 'none'].includes(status)) {
      return res.status(400).json({ error: 'status must be granted or none' });
    }

    const { data: perm } = await supabase
      .from('assessment_permissions')
      .select('id, clinic_id, patient_id, template_id, requested_by_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!perm || !canAccessClinic(req, perm.clinic_id)) {
      return res.status(404).json({ error: 'Permission request not found' });
    }

    const { error } = await supabase
      .from('assessment_permissions')
      .update({
        status,
        granted_by_id: status === 'granted' ? req.profile.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', perm.id);

    if (error) return next(error);

    if (status === 'granted') {
      await supabase
        .from('assessment_assignments')
        .insert({
          patient_id: perm.patient_id,
          template_id: perm.template_id,
          assigned_by_id: perm.requested_by_id,
          status: 'assigned',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        });
    }

    await writeAudit({
      clinicId: perm.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: status === 'granted' ? 'grant_assessment_permission' : 'revoke_assessment_permission',
      entityType: 'assessment_permission',
      entityId: perm.id,
      summary: `${req.profile.display_name || 'Administrator'} ${status === 'granted' ? 'granted' : 'revoked'} a student assessment permission.`,
      severity: status === 'granted' ? 'info' : 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Direct Grant or Revoke patient assessment permission (also resolves pending requests)
router.post('/assessment-permissions/grant', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, template_id, status } = req.body || {}; // status: 'granted' or 'none'
    if (!patient_id || !template_id || !status) {
      return res.status(400).json({ error: 'patient_id, template_id and status are required' });
    }
    if (!['granted', 'none'].includes(status)) {
      return res.status(400).json({ error: 'status must be granted or none' });
    }

    // The permission lives in the patient's branch (a Super Admin granting
    // for another branch must not file it under their own clinic).
    const { data: grantPatient } = await supabase
      .from('patients')
      .select('clinic_id')
      .eq('id', patient_id)
      .maybeSingle();
    if (!grantPatient || !canAccessClinic(req, grantPatient.clinic_id)) {
      return res.status(404).json({ error: 'Student not found in your clinic' });
    }

    // Upsert the permission row
    const { data: perm, error } = await supabase
      .from('assessment_permissions')
      .upsert({
        clinic_id: grantPatient.clinic_id,
        patient_id,
        template_id,
        status,
        granted_by_id: status === 'granted' ? req.profile.id : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'clinic_id,patient_id,template_id' })
      .select('*')
      .single();

    if (error) return next(error);

    // If granted, create an assignment automatically!
    if (status === 'granted') {
      await supabase
        .from('assessment_assignments')
        .insert({
          patient_id,
          template_id,
          assigned_by_id: req.profile.id,
          status: 'assigned',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 14 days due date
        });
    }

    await writeAudit({
      clinicId: grantPatient.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: status === 'granted' ? 'grant_assessment_permission' : 'revoke_assessment_permission',
      entityType: 'assessment_permission',
      entityId: perm.id,
      summary: `${req.profile.display_name || 'Administrator'} ${status === 'granted' ? 'granted' : 'revoked'} a student assessment permission.`,
      severity: status === 'granted' ? 'info' : 'warn',
    });
    res.json({ ok: true, permission: perm });
  } catch (err) {
    next(err);
  }
});

// ---------- assessment document release workflow ----------

router.get('/assessment-document-releases', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Super Admin sees all branches (or one via ?clinic_id=); regular
    // admins are locked to their own clinic.
    const relScope = listClinicScope(req);
    let relQuery = supabase
      .from('assessment_document_release_requests')
      .select('id, clinic_id, patient_id, status, scheduled_date, scheduled_start_time, scheduled_end_time, location, payment_status, payment_method, payment_preference, paymongo_checkout_url, paid_at, released_at, declined_reason, admin_note, client_reason, created_at, updated_at, patients(first_name, middle_name, last_name, patient_id)')
      .order('created_at', { ascending: false });
    if (relScope) relQuery = relQuery.eq('clinic_id', relScope);
    const { data: requests, error: requestError } = await relQuery;
    if (requestError) return next(requestError);

    const requestIds = (requests || []).map((request) => request.id);
    const { data: items, error: itemsError } = requestIds.length
      ? await supabase
        .from('assessment_document_release_items')
        .select('id, request_id, patient_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee')
        .in('request_id', requestIds)
      : { data: [], error: null };
    if (itemsError) return next(itemsError);

    const itemsByRequest = {};
    (items || []).forEach((item) => {
      if (!itemsByRequest[item.request_id]) itemsByRequest[item.request_id] = [];
      itemsByRequest[item.request_id].push(item);
    });
    const formatted = (requests || []).map((request) => {
      const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
      return formatReleaseRequest({
        ...request,
        student_name: patient ? patientName(patient) : 'Unknown Student',
        patient_identifier: patient?.patient_id || null,
      }, itemsByRequest[request.id] || []);
    });

    const relLabels = await clinicLabelMap();
    for (const r of formatted) {
      r.clinic_code = (r.clinic_id && relLabels[r.clinic_id]?.code) || null;
      r.clinic_name = (r.clinic_id && relLabels[r.clinic_id]?.name) || null;
    }

    res.json({
      requests: formatted,
      counts: {
        pending: formatted.filter((request) => request.status === 'pending').length,
        scheduled: formatted.filter((request) => request.status === 'scheduled').length,
        awaitingPayment: formatted.filter((request) => request.status === 'scheduled' && request.payment_status === 'unpaid').length,
        released: formatted.filter((request) => request.status === 'released').length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/assessment-document-releases/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status, scheduled_date, scheduled_start_time, scheduled_end_time, location, items: itemPayload, admin_note, declined_reason } = req.body || {};
    if (!['scheduled', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'status must be scheduled, declined, or cancelled' });
    }

    const { data: request, error: requestError } = await supabase
      .from('assessment_document_release_requests')
      .select('id, clinic_id, patient_id, status, payment_status, created_at, updated_at, patients(first_name, middle_name, last_name, patient_id, caregiver_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (requestError) return next(requestError);
    if (!request || !canAccessClinic(req, request.clinic_id)) return res.status(404).json({ error: 'Document release request not found' });
    const isReschedule = request.status === 'scheduled' && status === 'scheduled';
    if (request.status !== 'pending' && !isReschedule && status !== 'cancelled') {
      return res.status(409).json({ error: 'Only pending document release requests can be scheduled or declined.' });
    }

    const { data: currentItems, error: itemsError } = await supabase
      .from('assessment_document_release_items')
      .select('id, request_id, patient_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee')
      .eq('request_id', request.id);
    if (itemsError) return next(itemsError);
    if (!currentItems?.length) return res.status(409).json({ error: 'This request has no document items.' });

    if (status === 'scheduled') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(scheduled_date || ''))) {
        return res.status(400).json({ error: 'A clinic visit date is required.' });
      }
      const scheduledDay = new Date(`${scheduled_date}T00:00:00Z`);
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      // The clinic is closed on Sundays only — Saturdays accept pick-ups.
      if (Number.isNaN(scheduledDay.getTime()) || scheduledDay < today || scheduledDay.getUTCDay() === 0) {
        return res.status(400).json({ error: 'Choose today or a future day for the clinic visit. The clinic is closed on Sundays.' });
      }
      if (!/^\d{2}:\d{2}$/.test(String(scheduled_start_time || '')) || !/^\d{2}:\d{2}$/.test(String(scheduled_end_time || ''))) {
        return res.status(400).json({ error: 'A valid start and end time are required.' });
      }
      const startParts = String(scheduled_start_time).split(':').map(Number);
      const endParts = String(scheduled_end_time).split(':').map(Number);
      if ([...startParts, ...endParts].some((part, index) => !Number.isInteger(part) || (index % 2 === 0 ? part > 23 : part > 59))) {
        return res.status(400).json({ error: 'A valid start and end time are required.' });
      }
      if (String(scheduled_end_time) <= String(scheduled_start_time)) {
        return res.status(400).json({ error: 'The end time must be later than the start time.' });
      }
      if (!Array.isArray(itemPayload) || itemPayload.length !== currentItems.length) {
        return res.status(400).json({ error: 'A fee is required for every requested document.' });
      }
      const feesById = new Map(itemPayload.map((item) => [item.id, normalizeMoney(item.fee)]));
      if (currentItems.some((item) => !feesById.has(item.id) || feesById.get(item.id) === null)) {
        return res.status(400).json({ error: 'Each document fee must be a non-negative amount.' });
      }
      // A paid (PayMongo) request's amount is locked — never re-price it on
      // reschedule. Deprioritize: only apply the passed fees when not paid.
      const isPaidReschedule = isReschedule && request.payment_status === 'paid';
      if (!isPaidReschedule) {
        for (const item of currentItems) {
          const { error } = await supabase
            .from('assessment_document_release_items')
            .update({ fee: feesById.get(item.id) })
            .eq('id', item.id)
            .eq('request_id', request.id);
          if (error) return res.status(400).json({ error: error.message });
        }
      }
    }

    const patch = {
      status,
      admin_note: admin_note === undefined ? undefined : String(admin_note || '').trim().slice(0, 500) || null,
      declined_reason: status === 'declined' ? String(declined_reason || '').trim() || null : null,
    };
    if (status === 'scheduled') {
      patch.scheduled_date = scheduled_date;
      patch.scheduled_start_time = scheduled_start_time;
      patch.scheduled_end_time = scheduled_end_time;
      patch.location = String(location || 'Main Clinic Cashier / Reception').trim();
      if (!isReschedule) {
        patch.payment_status = 'unpaid';
        patch.payment_method = null;
        patch.paid_at = null;
        patch.paid_by_id = null;
      }
      patch.released_at = null;
      patch.released_by_id = null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('assessment_document_release_requests')
      .update(patch)
      .eq('id', request.id)
      .select('id, patient_id, status, scheduled_date, scheduled_start_time, scheduled_end_time, location, payment_status, payment_method, paid_at, released_at, declined_reason, admin_note, created_at, updated_at')
      .single();
    if (updateError) return res.status(400).json({ error: updateError.message });

    const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
    const note = String(admin_note || '').trim().slice(0, 500);
    const studentLabel = patient ? patientName(patient) : 'your child';
    const scheduledDateLabel = status === 'scheduled' && scheduled_date
      ? new Date(`${scheduled_date}T00:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'long' })
      : '';
    const scheduledTimeLabel = status === 'scheduled'
      ? `${String(scheduled_start_time || '').slice(0, 5)} to ${String(scheduled_end_time || '').slice(0, 5)}`
      : '';
    const totalAmount = status === 'scheduled'
      ? itemPayload.reduce((sum, item) => sum + Number(normalizeMoney(item.fee) || 0), 0).toFixed(2)
      : '0.00';

    if (patient?.caregiver_id) {
      await createNotification({
        clinicId: request.clinic_id,
        recipientId: patient.caregiver_id,
        type: 'assessment',
        title: isReschedule
          ? 'Document pick-up schedule updated'
          : status === 'scheduled'
            ? 'Document pick-up scheduled'
            : 'Document release request declined',
        body: status === 'scheduled'
          ? `${isReschedule ? 'Your assessment document pick-up schedule has been updated' : 'Your assessment document pick-up has been scheduled'} for ${scheduled_date}, ${scheduled_start_time} to ${scheduled_end_time} at ${String(location || 'the clinic').trim()}.${note ? ` Clinic notice: ${note}` : ''}`
          : `Your assessment document pick-up request was declined${declined_reason ? `: ${declined_reason}` : '.'}`,
        link: '/client/assessments',
      });

      const { data: caregiver } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', patient.caregiver_id)
        .maybeSingle();
      if (caregiver?.email) {
        sendMail({
          to: caregiver.email,
          subject: status === 'scheduled'
            ? `${isReschedule ? 'Updated Pick-Up Schedule' : 'Assessment Document Pick-Up Scheduled'}: ${studentLabel} - ClearMind Clinic`
            : `Assessment Document Request Update: ${studentLabel} - ClearMind Clinic`,
          templateKey: 'assessmentDocumentRelease',
          replyToClinicId: request.clinic_id,
          templateData: {
            parent_name: caregiver.display_name || 'there',
            student_name: studentLabel,
            status,
            scheduled_date: scheduledDateLabel,
            scheduled_time: scheduledTimeLabel,
            location: String(location || 'the clinic').trim(),
            document_count: currentItems.length,
            total_amount: totalAmount,
            clinic_notice: note,
            declined_reason: String(declined_reason || '').trim(),
            is_reschedule: isReschedule,
          },
        }).catch((error) => console.error('[email] failed to send assessment document pickup email:', error.message));
      }
    }
    await writeAudit({
      clinicId: request.clinic_id,
      actorId: req.profile.id,
      action: isReschedule ? 'reschedule_assessment_document_release' : status === 'scheduled' ? 'schedule_assessment_document_release' : `${status}_assessment_document_release`,
      entityType: 'assessment_document_release_request',
      entityId: request.id,
      summary: `${req.profile.display_name || 'Administrator'} ${isReschedule ? 'updated the schedule for' : status === 'scheduled' ? 'scheduled' : status} an assessment document release request.`,
      severity: status === 'declined' ? 'warn' : 'info',
    });

    const { data: updatedItems } = await supabase
      .from('assessment_document_release_items')
      .select('id, request_id, patient_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee')
      .eq('request_id', request.id);
    res.json({ request: formatReleaseRequest({
      ...updated,
      student_name: patient ? patientName(patient) : 'Unknown Student',
      patient_identifier: patient?.patient_id || null,
    }, updatedItems || []) });
  } catch (err) {
    next(err);
  }
});

router.post('/assessment-document-releases/:id/release', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const paymentMethodRaw = String(req.body?.payment_method || '').toLowerCase();
    // Allow cash, gcash, maya, gotyme, maribank (onsite), or paymongo (online). If empty, we'll default based on what the DB shows.
    const validMethods = ['cash', 'gcash', 'maya', 'gotyme', 'maribank'];

    const { data: request, error: requestError } = await supabase
      .from('assessment_document_release_requests')
      .select('id, clinic_id, patient_id, status, payment_status, payment_method, payment_preference, scheduled_date, scheduled_start_time, scheduled_end_time, location, created_at, updated_at, patients(first_name, middle_name, last_name, patient_id, caregiver_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (requestError) return next(requestError);
    if (!request || !canAccessClinic(req, request.clinic_id)) return res.status(404).json({ error: 'Document release request not found' });
    if (request.status !== 'scheduled') {
      return res.status(409).json({ error: 'Only a scheduled request can be released.' });
    }

    // Determine final payment method
    let resolvedMethod;
    if (request.payment_status === 'paid' && request.payment_method) {
      // Already marked paid by webhook — trust what's in DB
      resolvedMethod = request.payment_method;
    } else if (validMethods.includes(paymentMethodRaw)) {
      resolvedMethod = paymentMethodRaw;
    } else if (request.payment_preference === 'online') {
      // Online preference but no webhook yet — admin must wait or confirm manually
      return res.status(400).json({ error: 'This request is set to Pay Online. Wait for the patient to complete payment, or choose Cash, GCash, Maya, GoTyme, or MariBank if collecting payment in-person.' });
    } else {
      return res.status(400).json({ error: 'Choose Cash, GCash, Maya, GoTyme, or MariBank as the payment method.' });
    }

    const now = new Date().toISOString();
    const alreadyPaid = request.payment_status === 'paid';
    const { data: updated, error: updateError } = await supabase
      .from('assessment_document_release_requests')
      .update({
        status: 'released',
        payment_status: 'paid',
        payment_method: resolvedMethod,
        paid_at: alreadyPaid ? request.paid_at : now,
        paid_by_id: alreadyPaid ? undefined : req.profile.id,
        released_at: now,
        released_by_id: req.profile.id,
      })
      .eq('id', request.id)
      .select('id, patient_id, status, scheduled_date, scheduled_start_time, scheduled_end_time, location, payment_status, payment_method, payment_preference, paid_at, released_at, created_at, updated_at')
      .single();
    if (updateError) {
      // Most common cause: migration 0087 (maya/gotyme/maribank) has not been
      // applied yet, so the DB check constraint still rejects the new method.
      if (String(updateError.message || '').includes('payment_method_check')) {
        return res.status(400).json({ error: `Payment method "${resolvedMethod}" is not enabled in the database yet. Run migration 0087_add_onsite_ewallet_payment_methods.sql in the Supabase SQL editor, then retry.` });
      }
      return res.status(400).json({ error: updateError.message });
    }

    const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
    if (patient?.caregiver_id) {
      await createNotification({
        clinicId: request.clinic_id,
        recipientId: patient.caregiver_id,
        type: 'assessment',
        title: 'Assessment documents released',
        body: `Payment was recorded and your completed assessment documents were released by the clinic.`,
        link: '/client/assessments',
        email: {
          subject: `Assessment Documents Released: ${patient ? patientName(patient) : 'Your child'} - ClearMind Clinic`,
        },
      });
    }
    await writeAudit({
      clinicId: request.clinic_id,
      actorId: req.profile.id,
      action: 'release_assessment_documents',
      entityType: 'assessment_document_release_request',
      entityId: request.id,
      summary: `${req.profile.display_name || 'Administrator'} recorded ${resolvedMethod} payment and released assessment documents.`,
    });

    const { data: updatedItems } = await supabase
      .from('assessment_document_release_items')
      .select('id, request_id, patient_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee')
      .eq('request_id', request.id);
    res.json({ request: formatReleaseRequest({
      ...updated,
      student_name: patient ? patientName(patient) : 'Unknown Student',
      patient_identifier: patient?.patient_id || null,
    }, updatedItems || []) });
  } catch (err) {
    next(err);
  }
});

const uploadLandingImage = async (dataUrl, clinicId) => {
  const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(dataUrl || '');
  if (!m) {
    throw new Error('Provide a PNG, JPEG, WEBP, or GIF image');
  }
  const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5 MB');
  }
  const path = `landing/${clinicId}/${require('crypto').randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('photos')
    .upload(path, buffer, { contentType: m[1], upsert: true });
  if (upErr) {
    throw new Error(upErr.message);
  }
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
};

// Recursively walk an object and upload any key named *_image or *_images with a
// data-url value, replacing it with the uploaded public URL.
async function uploadLandingImages(value, clinicId) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => uploadLandingImages(v, clinicId)));
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/image$/i.test(key) && typeof entry === 'string' && entry.startsWith('data:')) {
      out[key] = await uploadLandingImage(entry, clinicId);
    } else if (/images/i.test(key) && Array.isArray(entry)) {
      out[key] = await Promise.all(entry.map(async (img, i) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
          return uploadLandingImage(img, clinicId);
        }
        if (img && typeof img === 'object') {
          if (typeof img.src === 'string' && img.src.startsWith('data:')) {
            const src = await uploadLandingImage(img.src, clinicId);
            return { ...img, src };
          }
          return uploadLandingImages(img, clinicId);
        }
        return img;
      }));
    } else {
      out[key] = await uploadLandingImages(entry, clinicId);
    }
  }
  return out;
}

// Merge a draft section over its live baseline so a draft that is missing a
// field (e.g. a specialty image) still shows what is currently published, while
// any field the draft actually set keeps winning. List items (arrays like
// `items`) are matched first by `id`, then by a badge+title composite key, and
// finally by position index — so specialty items added without an id field
// (via "Add Specialty") still correctly inherit their published images.
function mergeContent(live = {}, draft = {}) {
  const out = { ...live, ...draft };
  Object.keys(draft).forEach((key) => {
    const dv = draft[key];
    const lv = live && live[key];
    if (!Array.isArray(dv) || !Array.isArray(lv)) return;

    // Build lookup maps: by id and by badge+title composite key.
    const byId = new Map();
    const byComposite = new Map();
    lv.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      if (item.id != null) byId.set(String(item.id), item);
      const composite = `${(item.badge || '').trim()}|||${(item.title || '').trim()}`;
      if (composite !== '|||') byComposite.set(composite, item);
    });

    out[key] = dv.map((item, idx) => {
      if (!item || typeof item !== 'object') return item;

      // 1. Match by id (most specific).
      let liveItem = item.id != null ? byId.get(String(item.id)) : undefined;

      // 2. Match by badge+title composite (handles id-less items with the same content).
      if (!liveItem) {
        const composite = `${(item.badge || '').trim()}|||${(item.title || '').trim()}`;
        if (composite !== '|||') liveItem = byComposite.get(composite);
      }

      // 3. Fall back to same array index (items added in the same order).
      if (!liveItem) liveItem = lv[idx];

      if (!liveItem) return item;

      const merged = { ...liveItem, ...item };
      Object.keys(liveItem).forEach((k) => {
        if ((merged[k] == null || merged[k] === '') && liveItem[k] != null && liveItem[k] !== '') {
          merged[k] = liveItem[k];
        }
      });
      return merged;
    });
  });
  return out;
}

// GET /api/admin/landing — fetch current landing content for the admin editor.
// A section may have both a draft (published=false) and a live (published=true)
// row. The editor shows the draft layered over the live content, so an admin can
// keep working on saved-but-unpublished work without losing whatever is live
// (e.g. specialty images uploaded in a previously published version).
router.get('/landing', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data, error } = await supabase
      .from('landing_content')
      .select('section_key, content, published, updated_at')
      .eq('clinic_id', req.profile.clinic_id)
      .order('section_key', { ascending: true });
    if (error) return next(error);

    const live = {};
    const draft = {};
    (data || []).forEach((row) => {
      if (row.published === false) draft[row.section_key] = row.content;
      else live[row.section_key] = row.content;
    });

    const sections = {};
    new Set([...Object.keys(live), ...Object.keys(draft)]).forEach((key) => {
      sections[key] = mergeContent(live[key], draft[key]);
    });
    res.json({ sections });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/landing/defaults — returns the client-side defaults as a reference
// GET /api/admin/landing/upload — upload a single image (used by the editor for gallery-style fields)
router.post('/landing/upload', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { dataUrl } = req.body || {};
    const url = await uploadLandingImage(dataUrl, req.profile.clinic_id);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/landing — upsert one or more sections.
// Body: { sections: { hero: {...}, about: {...} }, publish: boolean }
//   publish=false (default) writes a DRAFT that visitors won't see until Published.
//   publish=true writes content that is LIVE on the landing page.
//
// When saving as a DRAFT we first fetch the published (live) row for the section
// and use inheritImages() to fill any empty image fields with the published values.
// This ensures the draft always has complete images — even if the editor state lost
// them due to a stale load — and prevents an empty-image save from silently wiping
// out images the admin already published.
function inheritImages(incoming, live) {
  if (!incoming || typeof incoming !== 'object' || !live || typeof live !== 'object') return incoming;
  if (Array.isArray(incoming)) {
    return incoming.map((item, idx) => inheritImages(item, Array.isArray(live) ? live[idx] : live));
  }
  const out = { ...incoming };
  for (const [key, val] of Object.entries(out)) {
    const liveVal = live[key];
    // Scalar image field: fill if the incoming value is empty but live has one.
    if (/image$/i.test(key) && typeof val === 'string' && !val && typeof liveVal === 'string' && liveVal) {
      out[key] = liveVal;
      continue;
    }
    // Nested array of items (specialties, etc.): match by id → badge+title composite → index.
    if (Array.isArray(val) && Array.isArray(liveVal)) {
      const byId = new Map();
      const byComposite = new Map();
      liveVal.forEach((li, i) => {
        if (!li || typeof li !== 'object') return;
        if (li.id != null) byId.set(String(li.id), li);
        const comp = `${(li.badge || '').trim()}|||${(li.title || '').trim()}`;
        if (comp !== '|||') byComposite.set(comp, li);
      });
      out[key] = val.map((item, i) => {
        if (!item || typeof item !== 'object') return item;
        let liveItem = item.id != null ? byId.get(String(item.id)) : undefined;
        if (!liveItem) {
          const comp = `${(item.badge || '').trim()}|||${(item.title || '').trim()}`;
          if (comp !== '|||') liveItem = byComposite.get(comp);
        }
        if (!liveItem) liveItem = liveVal[i];
        if (!liveItem) return item;
        return inheritImages(item, liveItem);
      });
      continue;
    }
    // Recurse into nested objects.
    if (val && typeof val === 'object' && liveVal && typeof liveVal === 'object') {
      out[key] = inheritImages(val, liveVal);
    }
  }
  return out;
}

router.patch('/landing', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { sections: incoming, publish } = req.body || {};
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Provide a sections object.' });
    }

    const published = publish === true;
    const now = new Date().toISOString();
    const upserted = [];
    for (const [sectionKey, rawContent] of Object.entries(incoming)) {
      let content = await uploadLandingImages(rawContent || {}, req.profile.clinic_id);

      // When saving a DRAFT, inherit any missing images from the live (published) row
      // so we never silently overwrite a published image with an empty string.
      if (!published) {
        const { data: liveRow } = await supabase
          .from('landing_content')
          .select('content')
          .eq('clinic_id', req.profile.clinic_id)
          .eq('section_key', sectionKey)
          .eq('published', true)
          .maybeSingle();
        if (liveRow?.content) {
          content = inheritImages(content, liveRow.content);
        }
      }

      const { data, error } = await supabase
        .from('landing_content')
        .upsert({
          clinic_id: req.profile.clinic_id,
          section_key: sectionKey,
          content,
          published,
          updated_by: req.profile.id,
          updated_at: now,
        }, { onConflict: 'clinic_id,section_key,published' })
        .select('section_key, content, published, updated_at')
        .single();
      if (error) return next(error);
      upserted.push(data);
    }

    res.json({ sections: upserted, published });
  } catch (err) {
    next(err);
  }
});


// DELETE /api/admin/landing/:sectionKey — reset a section to its published/live
// content by removing the saved DRAFT for that section. What's live stays as-is.
router.delete('/landing/:sectionKey', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { error } = await supabase
      .from('landing_content')
      .delete()
      .eq('clinic_id', req.profile.clinic_id)
      .eq('section_key', req.params.sectionKey)
      .eq('published', false);
    if (error) return next(error);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



