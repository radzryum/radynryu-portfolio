const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { completePastAppointments } = require('../lib/appointments');
const { createNotification } = require('../lib/notify');
const { writeAudit } = require('../lib/audit');
const { patientName, capitalizeNamePart } = require('../lib/names');
const { responseValue, structureForTemplate } = require('../lib/assessmentSchemas');
const { dedupeLatestBy } = require('../lib/latest');
const { localPermissionsStore } = require('../lib/permissions');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res.status(500).json({ error: 'Server not configured: Supabase missing.' });
    return false;
  }
  return true;
}

function requireRole(...roles) {
  return (req, res, next) => {
    const mine = [req.profile.role, ...(req.profile.extra_roles || [])];
    if (!mine.some((r) => roles.includes(r))) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

router.use(requireAuth, requireRole('psychologist', 'admin', 'super_admin', 'psychometrician'));

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

const name = patientName;
const relationRow = (value) => (Array.isArray(value) ? value[0] || null : value || null);
// Group appointments store students in appointment_participants (patient_id
// is null), so the queue must look at participants — otherwise a Front Desk
// group booking never reaches the practitioner's Upcoming tab.
const taskPatientList = (a) => {
  const parts = Array.isArray(a?.appointment_participants) ? a.appointment_participants : [];
  if (a?.format === 'group' || parts.length) {
    return parts.map((row) => row?.patients).filter(Boolean);
  }
  return [relationRow(a?.patients)].filter(Boolean);
};
const taskPrimaryPatient = (a) => taskPatientList(a)[0] || relationRow(a?.patients) || null;
const taskDisplayName = (a) => {
  const list = taskPatientList(a);
  if (!list.length) return 'Group session';
  return list.map((p) => name(p)).join(', ');
};
const appointmentCompliant = (a) => {
  const list = taskPatientList(a);
  if (!list.length) return false;
  return list.every((p) => complianceComplete(p));
};
const inClinic = (rows, clinic, profile, activeRoles) => {
  if (!rows) return [];
  return rows.filter((r) => {
    if (r?.appointment_participants !== undefined || r?.format === 'group' || r?.practitioner_id !== undefined) {
      const list = taskPatientList(r);
      if (!list.length || !list.some((p) => p?.clinic_id === clinic)) return false;
      if (!profile) return true;
      const roles = activeRoles || [profile.role, ...(profile.extra_roles || [])];
      if (roles.includes('admin')) return true;
      let matched = false;
      let checkedAny = false;
      if (roles.includes('psychologist')) {
        checkedAny = true;
        if (list.some((p) => p.treating_psychologist_id === profile.id)) matched = true;
      }
      if (roles.includes('psychometrician')) {
        checkedAny = true;
        if (list.some((p) => p.treating_psychometrician_id === profile.id)) matched = true;
      }
      if (!checkedAny) return true;
      if (r.practitioner_id === profile.id) return true;
      return matched;
    }
    const patient = relationRow(r.patients);
    if (!patient || patient.clinic_id !== clinic) return false;
    if (!profile) return true;
    const roles = activeRoles || [profile.role, ...(profile.extra_roles || [])];
    if (roles.includes('admin')) return true;
    let matched = false;
    let checkedAny = false;
    if (roles.includes('psychologist')) {
      checkedAny = true;
      if (patient.treating_psychologist_id === profile.id) matched = true;
    }
    if (roles.includes('psychometrician')) {
      checkedAny = true;
      if (patient.treating_psychometrician_id === profile.id) matched = true;
    }
    if (!checkedAny) return true;
    return matched;
  });
};
const complianceComplete = (patient) =>
  patient?.admission_form_status === 'complete' &&
  (patient?.waiver_submissions || []).some(
    (w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved',
  );

const PRIORITY_LABEL = { high: 'High Priority', normal: 'Medium Priority', low: 'Low Priority' };
const REPORT_SIGNATURE_COLUMNS = ['prepared_signature_image', 'reviewer_signature_image'];
const ONSITE_VIEW_SOURCE_TABLES = new Set(['assessment_submissions', 'assessment_reports']);
const APPROVED_ASSESSMENT_STATUSES = new Set(['scored', 'approved', 'finalized']);

function toOnsiteDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isOnsiteWeekday(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return false;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function storedOnsiteOptions(options) {
  return Array.isArray(options)
    ? [...new Set(options.map(toOnsiteDate).filter(Boolean).filter(isOnsiteWeekday))].sort()
    : [];
}

function normalizeOnsiteOptions(options) {
  if (!Array.isArray(options)) return null;
  const today = new Date().toISOString().slice(0, 10);
  const normalized = [...new Set(options.map(toOnsiteDate).filter(Boolean))]
    .filter((value) => value > today && isOnsiteWeekday(value))
    .sort();
  if (normalized.length < 1) return null;
  return normalized;
}

async function fetchAssessmentReportsWithFallback({ status, patientIds, orderBy = 'created_at', ascending = false, selectVariants }) {
  if (patientIds && patientIds.length === 0) return { data: [], error: null };
  let lastError = null;
  for (const select of selectVariants) {
    let query = supabase
      .from('assessment_reports')
      .select(select)
      .order(orderBy, { ascending });
    if (status) query = query.eq('status', status);
    if (patientIds) query = query.in('patient_id', patientIds);
    const result = await query;

    if (!result.error) return result;

    const isMissingReportSignatureColumn =
      result.error.code === '42703' &&
      REPORT_SIGNATURE_COLUMNS.some((column) => result.error.message?.includes(column));

    if (isMissingReportSignatureColumn) {
      lastError = result.error;
      continue;
    }

    return result;
  }

  return { data: null, error: lastError };
}

const normalizeAssessmentReport = (report) => ({
  ...report,
  reviewer_signature_image: report?.reviewer_signature_image || null,
  prepared_signature_image: report?.prepared_signature_image || null,
  reviewer_comment: report?.reviewer_comment || null,
});
const isIepLikeReport = (report) =>
  report?.report_type === 'iep' ||
  (report?.report_type === 'progress_summary' && /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(report?.title || ''));
const MONTHLY_DOMAINS = [
  'Conceptual Domain',
  'Social Domain',
  'Bodily Kinesthetics Domain',
  'Practical Domain',
];
const MONTHLY_TEXT_LIMIT = 400;
const MONTHLY_DIAGNOSIS_LIMIT = 100;

function parseMonthlyContent(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.form || parsed?.monthly || parsed;
  } catch {
    return null;
  }
}

function validateMonthlyContent(content) {
  const form = parseMonthlyContent(content);
  if (!form || typeof form !== 'object') return 'Monthly report data is required.';
  const required = [
    ['reporting period', form.period],
    ['student name', form.patientName],
    ['age', form.age],
    ['sex', form.sex],
    ['diagnosis', form.diagnosis],
    ['data narrative', form.dataNarrative],
    ['general overview', form.generalOverview],
    ['psychometrician signature date', form.preparedDate],
  ];
  const missing = required.find(([, value]) => !String(value ?? '').trim());
  if (missing) return `Please complete ${missing[0]} before sending the monthly report.`;

  if (String(form.diagnosis ?? '').length > MONTHLY_DIAGNOSIS_LIMIT) {
    return `Diagnosis is limited to ${MONTHLY_DIAGNOSIS_LIMIT} characters.`;
  }

  const age = Number(form.age);
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return 'Age must be a whole number from 0 to 150.';
  }
  if (!['male', 'female'].includes(String(form.sex).toLowerCase())) {
    return 'Sex must be Male or Female.';
  }
  if (!Array.isArray(form.selectedDomains) || form.selectedDomains.length === 0) {
    return 'Select at least one assessment domain.';
  }
  for (const domain of form.selectedDomains) {
    if (!MONTHLY_DOMAINS.includes(domain)) return 'An invalid assessment domain was selected.';
    if (!String(form.domainAssessments?.[domain] || '').trim()) {
      return `Please complete the ${domain} assessment.`;
    }
  }
  if (!Array.isArray(form.planRows) || form.planRows.length === 0) {
    return 'Add at least one complete activity plan.';
  }
  const planFields = ['objective', 'activities', 'timeFrame', 'responsible', 'outcome'];
  for (let index = 0; index < form.planRows.length; index += 1) {
    const missingPlanField = planFields.find(
      (field) => !String(form.planRows[index]?.[field] || '').trim(),
    );
    if (missingPlanField) return `Complete all fields in activity plan row ${index + 1}.`;
  }

  const hasOverlongText = (value) => {
    if (typeof value === 'string') return value.length > MONTHLY_TEXT_LIMIT;
    if (Array.isArray(value)) return value.some(hasOverlongText);
    if (value && typeof value === 'object') return Object.values(value).some(hasOverlongText);
    return false;
  };
  if (hasOverlongText(form)) {
    return `Monthly report text fields are limited to ${MONTHLY_TEXT_LIMIT} characters.`;
  }
  return null;
}

// Omission guard (FS-IT-06): resolve the report's free-text period into a
// concrete date range so source coverage can be compiled. Accepts
// "March 2026", "Mar 2026", "2026-03", "03/2026". Anything else falls back
// to the trailing 30 days — always labeled explicitly, never silently
// assumed, and always stamped into the snapshot.
const REPORT_MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
function resolveReportRange(periodText) {
  const raw = String(periodText || '').trim();
  let year = null;
  let month = null;
  let m = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]) - 1;
  }
  if (month == null || !(month >= 0 && month < 12)) {
    m = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) {
      month = Number(m[1]) - 1;
      year = Number(m[2]);
    }
  }
  if (month == null || !(month >= 0 && month < 12)) {
    m = raw.match(/^([A-Za-z.]+)\s+(\d{4})$/);
    if (m) {
      const idx = REPORT_MONTHS[m[1].toLowerCase().replace(/\./g, '')];
      if (idx != null) {
        month = idx;
        year = Number(m[2]);
      }
    }
  }
  if (month == null || !(month >= 0 && month < 12) || !(year >= 2000 && year <= 2100)) {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    const iso = (d) => d.toISOString().slice(0, 10);
    return {
      from: iso(from),
      to: iso(to),
      label: `Trailing 30 days to ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      inferred: true,
    };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const from = `${year}-${pad(month + 1)}-01`;
  const to = `${year}-${pad(month + 1)}-${new Date(year, month + 1, 0).getDate()}`;
  return {
    from,
    to,
    label: `${new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${from} to ${to})`,
    inferred: false,
  };
}

// Counts the session/attendance/activity records behind a monthly report so
// reviewers can verify nothing was omitted. Never blocks submission — a quiet
// month is still reportable — it snapshots the evidence instead. Each count
// is individually tolerant: a missing table yields null, not a 500.
async function compileSourceCoverage(supabaseClient, patientId, clinicId, periodText) {
  const range = resolveReportRange(periodText);
  const fromStart = `${range.from}T00:00:00+08:00`;
  const toEnd = `${range.to}T23:59:59+08:00`;
  const safe = async (fn) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  const [sessions, attendanceDays, activityLogs] = await Promise.all([
    safe(async () => {
      const { count, error } = await supabaseClient
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .gte('starts_at', fromStart)
        .lte('starts_at', toEnd);
      if (error) return null;
      return count ?? 0;
    }),
    safe(async () => {
      const { data: forms, error: formsError } = await supabaseClient
        .from('student_attendance_session_forms')
        .select('id')
        .eq('patient_id', patientId);
      if (formsError) return null;
      const formIds = (forms || []).map((f) => f.id);
      if (formIds.length === 0) return 0;
      const { data: recs, error: recsError } = await supabaseClient
        .from('student_attendance_records')
        .select('date')
        .in('form_id', formIds)
        .gte('date', range.from)
        .lte('date', range.to);
      if (recsError) return null;
      return new Set((recs || []).map((r) => r.date)).size;
    }),
    safe(async () => {
      const { count, error } = await supabaseClient
        .from('daily_activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .gte('log_date', range.from)
        .lte('log_date', range.to);
      if (error) return null;
      return count ?? 0;
    }),
  ]);
  return {
    sessions,
    attendanceDays,
    activityLogs,
    rangeFrom: range.from,
    rangeTo: range.to,
    rangeLabel: range.label,
    computedAt: new Date().toISOString(),
  };
}

// Stamps the coverage snapshot into the report content (no schema change).
function attachCoverage(rawContent, coverage) {
  if (!coverage) return rawContent;
  let obj = null;
  let wasString = false;
  if (typeof rawContent === 'string') {
    wasString = true;
    try {
      obj = JSON.parse(rawContent);
    } catch {
      return rawContent;
    }
  } else if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    obj = structuredClone(rawContent);
  }
  if (!obj || typeof obj !== 'object') return rawContent;
  const form = obj.form && typeof obj.form === 'object' ? obj.form
    : obj.monthly && typeof obj.monthly === 'object' ? obj.monthly
    : obj;
  form.sourceCoverage = coverage;
  return wasString ? JSON.stringify(obj) : obj;
}
const SESSION_LABEL = {
  initial_consultation: 'Initial Consultation',
  follow_up: 'Follow-up Session',
  therapy: 'Therapy Session',
  assessment: 'Assessment Session',
  feedback: 'Feedback Session',
};

function ageFromDob(dob) {
  if (!dob) return '?';
  const birth = new Date(dob);
  // Invalid or future birthdates (bad data entry) must never render as a
  // negative age — callers show '?' for unknown.
  if (Number.isNaN(birth.getTime())) return '?';
  const now = new Date();
  if (birth > now) return '?';
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

router.get('/tasks', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    await completePastAppointments(supabase, req.profile.clinic_id);
    const gateCompliance = !req.activeRoles.includes('admin');
    const reportSelectVariants = [
      'id, patient_id, title, document_type_code, report_type, status, priority, created_at, updated_at, patients(id, first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
    ];

    const appointmentQuery = supabase
        .from('appointments')
        .select("id, starts_at, session_type, location, status, format, practitioner_id, created_by:created_by_id(display_name), patients:patients!appointments_patient_id_fkey(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)), appointment_participants(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)))")
        .eq('clinic_id', req.profile.clinic_id)
        .order('starts_at', { ascending: true });
    if (req.profile.role === 'psychologist' && !(req.profile.extra_roles || []).includes('admin')) {
      appointmentQuery.eq('practitioner_id', req.profile.id);
    }

    const { data: clinicPatients } = await supabase.from('patients').select('id').eq('clinic_id', req.profile.clinic_id);
    const patientIds = (clinicPatients || []).map(p => p.id);

    const subsQuery = supabase
      .from('assessment_submissions')
      .select('id, patient_id, template_id, status, created_at, updated_at, submitted_at, patients(id, first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)), assessment_templates(id, title, document_type_code)')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (patientIds.length > 0) subsQuery.in('patient_id', patientIds);

    const [reportResult, apptsResult, subsResult] = await Promise.all([
      fetchAssessmentReportsWithFallback({
        status: null,
        patientIds: patientIds,
        orderBy: 'updated_at',
        ascending: false,
        selectVariants: reportSelectVariants,
      }),
      appointmentQuery,
      patientIds.length > 0 ? subsQuery : { data: [], error: null },
    ]);

    if (apptsResult.error) return next(apptsResult.error);
    if (reportResult.error) return next(reportResult.error);
    if (subsResult.error) return next(subsResult.error);

    const baseTasks = inClinic(apptsResult.data || [], req.profile.clinic_id, req.profile, req.activeRoles);
    const baseIds = new Set(baseTasks.map((a) => a.id));
    // Sessions explicitly booked to me stay in my queue even when the treating
    // assignment differs; the compliance rule below still applies. Group rows
    // carry students in appointment_participants (patients is null).
    const extraTasks = gateCompliance ? (apptsResult.data || []).filter((a) =>
      !baseIds.has(a.id) &&
      taskPatientList(a).some((p) => p?.clinic_id === req.profile.clinic_id) &&
      (a.practitioner_id === req.profile.id || (req.profile.employee_id && a.practitioner_id === req.profile.employee_id)) &&
      appointmentCompliant(a),
    ) : [];
    const clinicTasks = [...baseTasks, ...extraTasks].sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at));
    const tasks = clinicTasks.filter((a) => !gateCompliance || appointmentCompliant(a)).map((a) => {
      const dt = new Date(a.starts_at);
      const p = taskPrimaryPatient(a);
      const isGroup = a?.format === 'group' || (Array.isArray(a?.appointment_participants) && a.appointment_participants.length > 0);
      const groupList = isGroup ? taskPatientList(a) : null;
      const sexInit = !isGroup && p?.sex ? p.sex[0].toUpperCase() : '';
      return {
        id: a.id,
        name: taskDisplayName(a),
        photo_url: p?.photo_url || null,
        meta: isGroup
          ? `Group · ${groupList.length} students`
          : (p ? `ID: ${p.patient_id} Â· ${ageFromDob(p.date_of_birth)} yrs / ${sexInit}` : ''),
        detail: `${isGroup ? 'Group · ' : ''}${SESSION_LABEL[a.session_type] || a.session_type}`,
        room: a.location || '—',
        time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        starts_at: a.starts_at,
        status: a.status === 'completed' ? 'COMPLETED' : a.status === 'cancelled' ? 'CANCELLED' : 'SCHEDULED',
        booked_by: a.created_by?.display_name || null,
        format: isGroup ? 'group' : 'individual',
        participants: isGroup ? groupList.map((g) => name(g)) : [],
      };
    });

    const dedupedReports = dedupeLatestBy(
      (reportResult.data || []).filter(r =>
        ['draft', 'in_progress', 'revise_requested', 'ready_for_review', 'submitted'].includes(r.status),
      ),
      (r) => `${r.patient_id}:${isIepLikeReport(r) ? 'iep' : r.report_type || 'report'}`,
      ['updated_at', 'created_at'],
    );
    const dedupedSubs = dedupeLatestBy(
      (subsResult.data || []).filter(s => s.status === 'submitted' || s.status === 'processed'),
      (s) => `${s.patient_id}:${s.template_id}`,
      ['submitted_at', 'created_at'],
    );

    // Pending review items stay visible even when enrollment compliance is
    // incomplete — gating them here zeroes the Tasks queue and hides the
    // very submissions the notification bell links to. Sessions keep the
    // compliance gate; only the review queue is exempt.
    const clinicReports = inClinic(dedupedReports, req.profile.clinic_id, req.profile, req.activeRoles);
    const clinicSubs = inClinic(dedupedSubs, req.profile.clinic_id, req.profile, req.activeRoles);

    const assessments = [
      ...clinicReports.map((r) => {
        const iepLike = isIepLikeReport(r);
        const p = r.patients;
        const sexInit = p?.sex ? p.sex[0].toUpperCase() : '';
        const rType = iepLike ? 'iep' : (r.report_type || '');
        const codeFallback =
          r.document_type_code ||
          (rType === 'behavioral' ? 'CMPS:SE-FO-06' :
           rType === 'iep' ? 'CMPS:SE-FO-10' :
           rType === 'daily_activity' ? 'CMPS:SE-FO-07' :
           rType === 'progress_summary' ? 'CMPS:SE-FO-09' : '');
        return {
          id: r.id,
          patientId: r.patient_id,
          patientName: name(p),
          photo_url: p?.photo_url || null,
          meta: p ? `ID: ${p.patient_id} Â· ${ageFromDob(p.date_of_birth)} yrs / ${sexInit}` : '',
          title: iepLike ? 'Individualized Education Plan' : (r.title || 'Report'),
          code: codeFallback,
          reportType: rType,
          dueDate: r.updated_at || r.created_at,
          status: r.status,
          type: 'report',
        };
      }),
      ...clinicSubs.map((s) => {
        const p = relationRow(s.patients);
        const sexInit = p?.sex ? p.sex[0].toUpperCase() : '';
        const t = relationRow(s.assessment_templates) || {};
        return {
          id: s.id,
          patientId: s.patient_id,
          patientName: name(p),
          photo_url: p?.photo_url || null,
          meta: p ? `ID: ${p.patient_id} Â· ${ageFromDob(p.date_of_birth)} yrs / ${sexInit}` : '',
          title: t.title || 'Assessment',
          code: t.document_type_code || '',
          dueDate: s.submitted_at || s.updated_at || s.created_at,
          status: s.status,
          type: 'submission',
        };
      })
    ].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    res.json({ tasks, assessments });
  } catch (err) {
    next(err);
  }
});

// mark one of my own sessions done/cancelled (practitioner-scoped)
router.patch('/tasks/appointments/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status } = req.body || {};
    if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use completed or cancelled.' });
    }
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, clinic_id, practitioner_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!appt || appt.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const mine = req.activeRoles.includes('admin')
      || appt.practitioner_id === req.profile.id
      || appt.practitioner_id === req.profile.employee_id;
    if (!mine) {
      return res.status(403).json({ error: 'You can only update your own sessions.' });
    }
    const { data: updated, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, status')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'update_appointment',
      entityType: 'appointment',
      entityId: appt.id,
      summary: `${req.profile.display_name || 'Practitioner'} marked a session as ${status}.`,
      severity: 'info',
    });
    res.json({ appointment: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/approvals', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const reportSelectVariants = [
      'id, patient_id, title, document_type_code, report_type, period, status, priority, created_at, updated_at, finalized_at, content, prepared_signature_image, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      'id, patient_id, title, document_type_code, report_type, status, priority, created_at, updated_at, content, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      'id, patient_id, title, document_type_code, report_type, status, priority, created_at, updated_at, content, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
    ];

    const { data: clinicPatients } = await supabase.from('patients').select('id').eq('clinic_id', req.profile.clinic_id);
    const patientIds = (clinicPatients || []).map(p => p.id);

    const subsQuery = supabase
      .from('assessment_submissions')
      .select('id, patient_id, template_id, status, total_score, max_score, created_at, updated_at, submitted_at, respondent_name, respondent_signature_image, reviewer_comment, reviewer_signature_image, respondent_profile:respondent_profile_id(display_name, title, license_no), reviewer_profile:reviewed_by_id(display_name, title, license_no), answers, metadata, patients(id, first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id), assessment_templates(id, title, document_type_code)')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (patientIds.length > 0) subsQuery.in('patient_id', patientIds);

    let reportResult = await fetchAssessmentReportsWithFallback({
      status: null,
      patientIds: patientIds,
      orderBy: 'updated_at',
      ascending: false,
      selectVariants: reportSelectVariants,
    });

    const [subsResult] = await Promise.all([
      patientIds.length > 0 ? subsQuery : { data: [], error: null },
    ]);

    const { data, error } = reportResult;
    const { data: subsData, error: subsError } = subsResult;

    if (error) return next(error);
    if (subsError) return next(subsError);

    // IEP and monthly rows track per month (period); every other type
    // tracks per type.
    const dedupedReports = dedupeLatestBy(
      (data || []).map(normalizeAssessmentReport),
      (r) => {
        if (isIepLikeReport(r)) return `${r.patient_id}:iep:${r.period || 'Month 1'}`;
        if (r.report_type === 'progress_summary') return `${r.patient_id}:progress_summary:${r.period || 'unspecified'}`;
        return `${r.patient_id}:${r.report_type || 'report'}`;
      },
      ['updated_at', 'created_at'],
    );
    const dedupedSubs = dedupeLatestBy(
      subsData || [],
      (s) => `${s.patient_id}:${s.template_id}`,
      ['submitted_at', 'created_at'],
    );

    res.json({
      reports: inClinic(dedupedReports, req.profile.clinic_id, req.profile, req.activeRoles).map((r) => {
        const iepLike = isIepLikeReport(r);
        return {
          id: r.id,
          patient_id: r.patient_id,
          name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
          title: r.title,
          report_type: iepLike ? 'iep' : r.report_type,
          period: r.period || (iepLike ? 'Month 1' : null),
          status: r.status,
          type: iepLike
            ? `IEP (${r.period || 'Month 1'})`
            : `${r.title}${r.document_type_code ? ` (${r.document_type_code.replace('CMPS:SE-', '')})` : ''}`,
          date: r.updated_at || r.created_at,
          finalized_at: r.finalized_at || null,
          priority: PRIORITY_LABEL[r.priority] || 'Medium Priority',
          submitted_by: r.prepared_by?.display_name || 'Psychometrician',
          content: r.content || null,
          prepared_signature_image: r.prepared_signature_image || null,
          reviewer_signature_image: r.reviewer_signature_image || null,
          reviewer_comment: r.reviewer_comment || null,
          prepared_profile: r.prepared_by || null,
          reviewer_profile: r.noted_by || null,
        };
      }),
      submissions: inClinic(dedupedSubs, req.profile.clinic_id, req.profile, req.activeRoles).map((s) => {
        const patient = relationRow(s.patients);
        const template = relationRow(s.assessment_templates);
        return {
        id: s.id,
        patient_id: s.patient_id || patient?.id || null,
        template_id: s.template_id,
        student_name: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Student',
        assessment_name: template
          ? `${template.title || 'Standard Test'}${template.document_type_code ? ` (${template.document_type_code})` : ''}`
          : 'Standard Test',
        submitted_by: s.respondent_name || 'Psychometrician',
        date: s.submitted_at || s.updated_at || s.created_at,
        status: s.status,
        answers: s.answers,
        metadata: s.metadata,
        respondent_signature_image: s.respondent_signature_image || null,
        respondent_profile: relationRow(s.respondent_profile),
        reviewer_comment: s.reviewer_comment || null,
        reviewer_signature_image: s.reviewer_signature_image || null,
        reviewer_profile: relationRow(s.reviewer_profile),
        score: s.total_score !== null && s.total_score !== undefined ? `${s.total_score}/${s.max_score}` : '-',
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/assessment-onsite-view-requests', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    return res.status(410).json({ error: 'Onsite viewing is now managed through admin assessment document releases.' });
    const roles = req.activeRoles;
    if (!roles.includes('psychologist') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only a psychologist or administrator can review onsite viewing requests.' });
    }

    const [{ data: submissions, error: submissionError }, { data: reports, error: reportError }] = await Promise.all([
      supabase
        .from('assessment_submissions')
        .select('id, patient_id, template_id, status, reviewed_at, updated_at, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
        .in('onsite_view_status', ['pending', 'options_proposed', 'scheduled', 'completed'])
        .order('onsite_view_requested_at', { ascending: false }),
      supabase
        .from('assessment_reports')
        .select('id, patient_id, title, document_type_code, report_type, status, finalized_at, updated_at, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
        .eq('report_type', 'behavioral')
        .in('onsite_view_status', ['pending', 'options_proposed', 'scheduled', 'completed'])
        .order('onsite_view_requested_at', { ascending: false }),
    ]);
    if (submissionError) return next(submissionError);
    if (reportError) return next(reportError);

    const rows = [
      ...(submissions || []).map((submission) => ({
        id: submission.id,
        patient_id: submission.patient_id,
        source_table: 'assessment_submissions',
        source_id: submission.id,
        status: submission.onsite_view_status,
        requested_at: submission.onsite_view_requested_at,
        scheduled_date: submission.onsite_view_date,
        options: storedOnsiteOptions(submission.onsite_view_options),
        selected_at: submission.onsite_view_selected_at || null,
        completed_at: submission.reviewed_at || submission.updated_at,
        record: submission,
      })),
      ...(reports || []).map((report) => ({
        id: report.id,
        patient_id: report.patient_id,
        source_table: 'assessment_reports',
        source_id: report.id,
        status: report.onsite_view_status,
        requested_at: report.onsite_view_requested_at,
        scheduled_date: report.onsite_view_date,
        options: storedOnsiteOptions(report.onsite_view_options),
        selected_at: report.onsite_view_selected_at || null,
        completed_at: report.finalized_at || report.updated_at,
        record: report,
      })),
    ];
    if (!rows.length) return res.json({ requests: [] });

    const patientIds = [...new Set(rows.map((row) => row.patient_id).filter(Boolean))];
    let patientQuery = supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, caregiver_id, treating_psychologist_id, clinic_id, photo_url')
      .eq('clinic_id', req.profile.clinic_id)
      .in('id', patientIds);
    if (!roles.includes('admin')) patientQuery = patientQuery.eq('treating_psychologist_id', req.profile.id);
    const { data: patients, error: patientError } = await patientQuery;
    if (patientError) return next(patientError);

    const allowedPatientIds = new Set((patients || []).map((patient) => patient.id));
    const allowedRows = rows.filter((row) => allowedPatientIds.has(row.patient_id));
    const templateIds = [...new Set(allowedRows
      .filter((row) => row.source_table === 'assessment_submissions')
      .map((row) => row.record.template_id)
      .filter(Boolean))];
    const { data: templates, error: templateError } = templateIds.length
      ? await supabase.from('assessment_templates').select('id, title, document_type_code').in('id', templateIds)
      : { data: [], error: null };
    if (templateError) return next(templateError);

    const patientById = Object.fromEntries((patients || []).map((patient) => [patient.id, patient]));
    const templateById = Object.fromEntries((templates || []).map((template) => [template.id, template]));

    res.json({
      requests: allowedRows.map((request) => {
        const patient = patientById[request.patient_id] || {};
        const submission = request.source_table === 'assessment_submissions' ? request.record : null;
        const report = request.source_table === 'assessment_reports' ? request.record : null;
        const template = submission ? templateById[submission.template_id] || {} : {};
        return {
          id: request.id,
          patient_id: request.patient_id,
          student_name: name(patient),
        photo_url: patient.photo_url || patient.patients?.photo_url || null,
          patient_identifier: patient.patient_id || null,
          source_table: request.source_table,
          source_id: request.source_id,
          document_title: template.title || report?.title || 'Assessment Report',
          document_code: template.document_type_code || report?.document_type_code || null,
          status: request.status,
          requested_at: request.requested_at,
          scheduled_date: request.scheduled_date,
          options: storedOnsiteOptions(request.record?.onsite_view_options),
          selected_at: request.record?.onsite_view_selected_at || null,
          completed_at: request.completed_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/assessment-onsite-view-requests/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    return res.status(410).json({ error: 'Onsite viewing is now managed through admin assessment document releases.' });
    const roles = req.activeRoles;
    if (!roles.includes('psychologist') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only a psychologist or administrator can resolve onsite viewing requests.' });
    }
    const { source_table, status, options } = req.body || {};
    if (!ONSITE_VIEW_SOURCE_TABLES.has(source_table)) {
      return res.status(400).json({ error: 'source_table is required and must identify the assessment document.' });
    }
    if (!['options_proposed', 'denied', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be options_proposed, denied, cancelled, or completed.' });
    }
    const normalizedOptions = status === 'options_proposed' ? normalizeOnsiteOptions(options) : [];
    if (status === 'options_proposed' && !normalizedOptions) {
      return res.status(400).json({ error: 'Provide at least one future weekday for onsite viewing.' });
    }

    const { data: record, error: recordError } = await supabase
      .from(source_table)
      .select(source_table === 'assessment_reports'
        ? 'id, patient_id, status, report_type, onsite_view_status, onsite_view_date, onsite_view_options, onsite_view_selected_at, onsite_view_selected_by_id'
        : 'id, patient_id, status, onsite_view_status, onsite_view_date, onsite_view_options, onsite_view_selected_at, onsite_view_selected_by_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (recordError) return next(recordError);
    if (!record) return res.status(404).json({ error: 'Viewing request not found.' });
    if (!['pending', 'options_proposed', 'scheduled'].includes(record.onsite_view_status)) {
      return res.status(409).json({ error: 'This onsite viewing request is no longer active.' });
    }
    if (status === 'completed' && record.onsite_view_status !== 'scheduled') {
      return res.status(409).json({ error: 'Only a scheduled onsite viewing can be marked as done.' });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, caregiver_id, treating_psychologist_id, clinic_id, photo_url')
      .eq('id', record.patient_id)
      .eq('clinic_id', req.profile.clinic_id)
      .maybeSingle();
    if (patientError) return next(patientError);
    if (!patient) return res.status(404).json({ error: 'Student not found.' });
    if (!roles.includes('admin') && patient.treating_psychologist_id !== req.profile.id) {
      return res.status(403).json({ error: 'This student is assigned to another psychologist.' });
    }

    if (status === 'options_proposed' && !APPROVED_ASSESSMENT_STATUSES.has(record.status)) {
      return res.status(409).json({ error: 'Onsite viewing dates can only be proposed after psychologist approval.' });
    }
    if (source_table === 'assessment_reports' && record.report_type !== 'behavioral') {
      return res.status(400).json({ error: 'Unsupported assessment report type.' });
    }

    const { data: updated, error: updateError } = await supabase
      .from(source_table)
      .update({
        onsite_view_status: status,
        onsite_view_options: status === 'options_proposed' ? normalizedOptions : [],
        onsite_view_date: status === 'completed' ? record.onsite_view_date : null,
        onsite_view_selected_at: status === 'completed' ? record.onsite_view_selected_at : null,
        onsite_view_selected_by_id: status === 'completed' ? record.onsite_view_selected_by_id : null,
        onsite_view_scheduled_by_id: status === 'options_proposed' ? req.profile.id : null,
        onsite_view_scheduled_at: status === 'options_proposed' ? new Date().toISOString() : null,
      })
      .eq('id', record.id)
      .select('id, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
      .single();
    if (updateError) return next(updateError);

    const title = source_table === 'assessment_reports' ? 'Behavioral Assessment Report' : 'completed assessment';
    const optionCount = normalizedOptions.length;
    await createNotification({
      clinicId: patient.clinic_id,
      recipientId: patient.caregiver_id,
      type: 'assessment',
      title: status === 'options_proposed'
        ? 'Onsite viewing dates available'
        : status === 'completed'
          ? 'Onsite document viewing completed'
        : status === 'cancelled'
          ? 'Onsite viewing appointment cancelled'
          : 'Onsite viewing request not approved',
      body: status === 'options_proposed'
        ? `The clinic proposed ${optionCount} possible clinic date${optionCount === 1 ? '' : 's'} for onsite viewing of the ${title}. Please select one in the portal.`
        : status === 'completed'
          ? `The onsite viewing of the ${title} for ${name(patient)} has been marked as completed.`
        : status === 'cancelled'
          ? `The onsite viewing appointment for the ${title} for ${name(patient)} was cancelled.`
        : `The onsite viewing request for the ${title} for ${name(patient)} was not approved.`,
      link: '/client/assessments',
      email: {
        subject: 'Assessment Viewing Update: ClearMind Clinic',
      },
    });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: status === 'options_proposed'
        ? 'propose_assessment_onsite_view_dates'
        : status === 'completed'
          ? 'complete_assessment_onsite_view'
        : status === 'cancelled'
          ? 'cancel_assessment_onsite_view'
          : 'deny_assessment_onsite_view',
      entityType: source_table,
      entityId: record.id,
        summary: `${req.profile.display_name || 'Psychologist'} ${status === 'options_proposed' ? 'proposed available dates for' : status === 'completed' ? 'marked complete' : status === 'cancelled' ? 'cancelled' : 'denied'} onsite document viewing for ${name(patient)}.`,
      severity: status === 'denied' ? 'warn' : 'info',
    });
    res.json({
      request: {
        id: updated.id,
        source_table,
        source_id: updated.id,
        status: updated.onsite_view_status,
        requested_at: updated.onsite_view_requested_at,
        scheduled_date: updated.onsite_view_date,
      options: storedOnsiteOptions(updated.onsite_view_options),
        selected_at: updated.onsite_view_selected_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/assessments/grant-permission', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, template_id, status } = req.body || {}; // status: 'granted' or 'none' (for decline/revoke)
    if (!patient_id || !template_id || !status) return res.status(400).json({ error: 'patient_id, template_id and status are required' });
    if (!['granted', 'none'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    let patient;
    try {
      patient = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    try {
      const { data, error } = await supabase
        .from('assessment_permissions')
        .upsert({
          clinic_id: req.profile.clinic_id,
          patient_id,
          template_id,
          status,
          granted_by_id: status === 'granted' ? req.profile.id : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clinic_id,patient_id,template_id' })
        .select('*')
        .single();
      if (error) throw error;
      await writeAudit({
        clinicId: patient.clinic_id,
        actorId: req.profile.id,
        action: status === 'granted' ? 'grant_assessment_permission' : 'revoke_assessment_permission',
        entityType: 'assessment_permission',
        entityId: data.id,
        summary: `${req.profile.display_name || 'Psychologist'} ${status === 'granted' ? 'granted' : 'revoked'} assessment permission for ${name(patient)}${patient.patient_id ? ` (${patient.patient_id})` : ''}.`,
        severity: status === 'granted' ? 'info' : 'warn',
      });
      res.json({ permission: data });
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        console.warn('[db] falling back to local memory store to grant permission');
        const key = `${patient_id}_${template_id}`;
        const existing = localPermissionsStore.get(key) || {
          id: require('crypto').randomUUID(),
          clinic_id: req.profile.clinic_id,
          patient_id,
          template_id,
        };
        const updated = {
          ...existing,
          status,
          granted_by_id: status === 'granted' ? req.profile.id : null,
        };
        localPermissionsStore.set(key, updated);
        await writeAudit({
          clinicId: patient.clinic_id,
          actorId: req.profile.id,
          action: status === 'granted' ? 'grant_assessment_permission' : 'revoke_assessment_permission',
          entityType: 'assessment_permission',
          entityId: updated.id,
          summary: `${req.profile.display_name || 'Psychologist'} ${status === 'granted' ? 'granted' : 'revoked'} assessment permission for ${name(patient)}${patient.patient_id ? ` (${patient.patient_id})` : ''}.`,
          severity: status === 'granted' ? 'info' : 'warn',
        });
        res.json({ permission: updated });
      } else {
        throw dbErr;
      }
    }
  } catch (err) {
    next(err);
  }
});

router.get('/roster', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let q = supabase
      .from('patients')
      .select('id, first_name, middle_name, last_name, created_at, allow_journal_entry, treating_psychologist_id, treating_psychometrician_id, admission_form_status, clinical_profiles(iep_level, milestone_progress, chief_complaint, working_diagnosis, updated_at), photo_url, waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    if (!roles.includes('admin')) {
      if (roles.includes('psychologist')) {
        q = q.eq('treating_psychologist_id', req.profile.id);
      } else if (roles.includes('psychometrician')) {
        q = q.eq('treating_psychometrician_id', req.profile.id);
      }
    }

    // Newest assignments first so recently assigned students sit on top.
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) return next(error);
    const visibleData = roles.includes('admin') ? (data || []) : (data || []).filter(complianceComplete);
    res.json({
      clients: visibleData.map((p) => {
        const cp = p.clinical_profiles || {};
        return {
          id: p.id,
          name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
          allow_journal_entry: p.allow_journal_entry || false,
          level: cp.iep_level || 'Not specified',
          progress: cp.milestone_progress || 0,
          chief_complaint: cp.chief_complaint || '',
          working_diagnosis: cp.working_diagnosis || '',
          updated: cp.updated_at,
          created_at: p.created_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

async function clinicPatients(clinicId, profile, activeRoles) {
  let q = supabase
    .from('patients')
    .select('id, patient_id, first_name, middle_name, last_name, allow_journal_entry, treating_psychologist_id, treating_psychometrician_id, admission_form_status, photo_url, waiver_submissions(id, document_type_code, status)')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);

  if (profile) {
    const roles = activeRoles || [profile.role, ...(profile.extra_roles || [])];
    if (!roles.includes('admin')) {
      const actsAsPsychologist = roles.includes('psychologist');
      const actsAsPsychometrician = roles.includes('psychometrician');
      if (actsAsPsychologist && actsAsPsychometrician) {
        // Dual-role staff see patients they treat in EITHER capacity.
        q = q.or(
          `treating_psychologist_id.eq.${profile.id},treating_psychometrician_id.eq.${profile.id}`,
        );
      } else if (actsAsPsychologist) {
        q = q.eq('treating_psychologist_id', profile.id);
      } else if (actsAsPsychometrician) {
        q = q.eq('treating_psychometrician_id', profile.id);
      }
    }
  }

  const { data } = await q.order('first_name', { ascending: true });
  return (data || []).map((p) => ({
    id: p.id,
    patient_id: p.patient_id || null,
    name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
    allow_journal_entry: p.allow_journal_entry || false,
    admission_form_status: p.admission_form_status || null,
    waiver_submissions: p.waiver_submissions || [],
  }));
}

async function authorizePatient(patientId, profile, activeRoles) {
  const { data: pt, error } = await supabase
    .from('patients')
    .select('id, patient_id, clinic_id, caregiver_id, first_name, middle_name, last_name, date_of_birth, sex, treating_psychologist_id, treating_psychometrician_id, clinical_profiles(working_diagnosis), photo_url')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !pt || pt.clinic_id !== profile.clinic_id) {
    throw new Error('Patient not found');
  }
  const roles = activeRoles || [profile.role, ...(profile.extra_roles || [])];
  if (!roles.includes('admin')) {
    const isAssigned =
      (roles.includes('psychologist') && pt.treating_psychologist_id === profile.id) ||
      (roles.includes('psychometrician') && pt.treating_psychometrician_id === profile.id);
    if (!isAssigned) {
      throw new Error('Patient is not assigned to you');
    }
  }
  return pt;
}

router.get('/mainstreaming', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const [{ data, error }, patients] = await Promise.all([
      supabase
        .from('mainstreaming_assessments')
        .select('id, readiness_score, status, evaluated_on, patient_id, patients(first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, clinical_profiles(support_level))')
        .order('evaluated_on', { ascending: false }),
      clinicPatients(req.profile.clinic_id, req.profile, req.activeRoles),
    ]);
    if (error) return next(error);
    res.json({
      students: inClinic(data, req.profile.clinic_id, req.profile, req.activeRoles).map((m) => ({
        id: m.id,
        patient_id: m.patient_id,
        name: name(m.patients),
        photo_url: m.patients?.photo_url || m.patients?.patients?.photo_url || null,
        level: m.patients?.clinical_profiles?.support_level || '—',
        score: m.readiness_score,
        status: m.status,
      })),
      patients,
    });
  } catch (err) {
    next(err);
  }
});

// record a mainstreaming-readiness assessment
router.post('/mainstreaming', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, readiness_score, status, notes } = req.body || {};
    if (!patient_id) return res.status(400).json({ error: 'Patient is required' });
    if (status !== undefined && !['not_ready', 'approaching', 'ready'].includes(status)) {
      return res.status(400).json({ error: 'Status must be not_ready, approaching, or ready' });
    }
    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { data, error } = await supabase
      .from('mainstreaming_assessments')
      .insert({
        patient_id,
        evaluated_by_id: req.profile.id,
        readiness_score: readiness_score != null && readiness_score !== '' ? Number(readiness_score) : null,
        status: status || 'not_ready',
        notes: notes || null,
      })
      .select('id')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: 'record_mainstreaming_assessment',
      entityType: 'mainstreaming_assessment',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Clinician'} recorded a mainstreaming readiness assessment for ${name(pt)}.`,
    });
    res.status(201).json({ assessment: data });
  } catch (err) {
    next(err);
  }
});

router.get('/interventions', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const [{ data, error }, patients] = await Promise.all([
      supabase
        .from('interventions')
        .select('id, title, plan_date, procedure_count, status, patients(first_name, middle_name, last_name, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
        .order('plan_date', { ascending: false }),
      clinicPatients(req.profile.clinic_id, req.profile, req.activeRoles),
    ]);
    if (error) return next(error);
    res.json({
      items: inClinic(data, req.profile.clinic_id, req.profile, req.activeRoles).map((i) => ({
        id: i.id,
        name: name(i.patients),
        photo_url: i.patients?.photo_url || i.patients?.patients?.photo_url || null,
        title: i.title,
        date: i.plan_date,
        count: i.procedure_count,
        status: i.status,
      })),
      patients,
    });
  } catch (err) {
    next(err);
  }
});

// create an intervention plan
router.post('/interventions', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, title, plan_date, status, notes } = req.body || {};
    if (!patient_id || !title) return res.status(400).json({ error: 'Patient and title are required' });
    if (status !== undefined && !['planned', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be planned, in_progress, or completed' });
    }
    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { data, error } = await supabase
      .from('interventions')
      .insert({
        patient_id,
        author_id: req.profile.id,
        title,
        plan_date: plan_date || undefined,
        status: status || 'planned',
        notes: notes || null,
      })
      .select('id')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: 'create_intervention_plan',
      entityType: 'intervention',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Clinician'} created the intervention plan "${title}" for ${name(pt)}.`,
    });
    res.status(201).json({ intervention: data });
  } catch (err) {
    next(err);
  }
});

router.get('/progress', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const selectVariants = [
      'id, patient_id, title, period, trend, status, content, created_at, updated_at, finalized_at, prepared_signature_image, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      'id, patient_id, title, period, trend, status, content, created_at, updated_at, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      'id, patient_id, title, period, trend, status, content, created_at, updated_at, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
    ];
    const [reportResult, patients] = await Promise.all([
      (async () => {
        for (const select of selectVariants) {
          const result = await supabase
            .from('assessment_reports')
            .select(select)
            .eq('report_type', 'progress_summary')
            .order('updated_at', { ascending: false });
          if (!result.error) return result;
          if (result.error.code !== '42703') return result;
        }
        return { data: null, error: null };
      })(),
      // The directory follows the ACTIVE role: each role handles its own
      // patient list, so acting as RPm shows only treating-psychometrician
      // patients (empty until any are assigned), acting as psychologist shows
      // treating-psychologist patients. No-header dual-role sees the union
      // via the dual branch in clinicPatients.
      clinicPatients(req.profile.clinic_id, req.profile, req.activeRoles),
    ]);
    const { data, error } = reportResult || {};
    if (error) return next(error);
    // One tracker row per student per month (period). Months are submitted
    // and reviewed independently.
    const deduped = dedupeLatestBy(
      (data || []).filter((report) => !isIepLikeReport(report)),
      (r) => `${r.patient_id}:${r.period || 'unspecified'}:progress_summary`,
      ['updated_at', 'created_at'],
    );
    const visiblePatients = req.activeRoles.includes('admin')
      ? patients
      : (patients || []).filter(complianceComplete);
    const eligiblePatientId = new Set((visiblePatients || []).map((p) => p.id));
    const visibleItems = inClinic(deduped, req.profile.clinic_id, req.profile, req.activeRoles)
      .filter((r) => eligiblePatientId.has(r.patient_id));
    res.json({
      items: visibleItems.map((r) => ({
        id: r.id,
        patient_id: r.patient_id,
        name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients?.patient_id || null,
        title: r.title || 'Monthly Assessment Report',
        period: r.period,
        trend: r.trend,
        status: r.status,
        date: r.updated_at || r.created_at,
        finalized_at: r.finalized_at || null,
        content: r.content || null,
        prepared_signature_image: r.prepared_signature_image || null,
        reviewer_signature_image: r.reviewer_signature_image || null,
        reviewer_comment: r.reviewer_comment || null,
        prepared_profile: r.prepared_by || null,
        reviewer_profile: r.noted_by || null,
      })),
      patients: visiblePatients,
    });
  } catch (err) {
    next(err);
  }
});

// Create or update the Monthly Assessment Report per student per period.
// A completed (pending/approved) report locks its period; the next month
// creates a new row instead of 409ing on the old patient-wide singleton.
router.post('/progress', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician')) {
      return res.status(403).json({
        error: 'Only the assigned psychometrician can submit a Monthly Assessment Report.',
      });
    }
    const {
      id,
      patient_id,
      title,
      period,
      status,
      content,
      prepared_signature_image,
    } = req.body || {};
    if (!patient_id) return res.status(400).json({ error: 'Patient is required.' });
    const nextStatus = status === 'revise_requested' ? 'revise_requested' : (status || 'draft');
    if (!['draft', 'in_progress', 'ready_for_review', 'revise_requested'].includes(nextStatus)) {
      return res.status(400).json({
        error: 'Invalid status for Monthly Assessment Report.',
      });
    }

    if (nextStatus === 'ready_for_review') {
      const validationError = validateMonthlyContent(content);
      if (validationError) return res.status(400).json({ error: validationError });
      if (!prepared_signature_image) {
        return res.status(400).json({
          error: 'The psychometrician signature is required before sending the monthly report.',
        });
      }
    }

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const parsedContent = parseMonthlyContent(content);
    const requestedPeriod = String(parsedContent?.period || period || '').trim() || null;

    let existing = null;
    if (id) {
      const { data, error } = await supabase
        .from('assessment_reports')
        .select('id, patient_id, report_type, status, period')
        .eq('id', id)
        .maybeSingle();
      if (error) return next(error);
      existing = data;
    } else if (requestedPeriod) {
      const { data, error } = await supabase
        .from('assessment_reports')
        .select('id, patient_id, report_type, status, period')
        .eq('patient_id', patient_id)
        .eq('report_type', 'progress_summary')
        .eq('period', requestedPeriod)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return next(error);
      existing = data;
      if (!existing) {
        const { data: latest, error: latestError } = await supabase
          .from('assessment_reports')
          .select('id, patient_id, report_type, status, period')
          .eq('patient_id', patient_id)
          .eq('report_type', 'progress_summary')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) return next(latestError);
        // Reuse an in-progress draft as the next month instead of orphaning it.
        if (latest && ['draft', 'in_progress', 'revise_requested'].includes(latest.status)) {
          existing = latest;
        }
      }
    } else {
      const { data, error } = await supabase
        .from('assessment_reports')
        .select('id, patient_id, report_type, status, period')
        .eq('patient_id', patient_id)
        .eq('report_type', 'progress_summary')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return next(error);
      existing = data;
      // A locked latest report means a new month: start a fresh row.
      if (existing && !['draft', 'in_progress', 'revise_requested'].includes(existing.status)) {
        existing = null;
      }
    }

    if (existing && String(existing.patient_id) !== String(patient_id)) {
      return res.status(400).json({
        error: 'The Monthly Assessment Report does not belong to the selected student.',
      });
    }
    if (existing && existing.report_type !== 'progress_summary') {
      return res.status(400).json({ error: 'The selected record is not a Monthly Assessment Report.' });
    }
    if (existing && !['draft', 'in_progress', 'revise_requested'].includes(existing.status)) {
      return res.status(409).json({
        error:
          existing.status === 'ready_for_review'
            ? 'This monthly report is already pending psychologist review.'
            : 'This monthly report is complete and can no longer be changed.',
      });
    }
    // Omission guard: snapshot the session/attendance/activity evidence behind
    // this submission so reviewers (and the FO-09 print) can verify nothing
    // was left out. Informational only — never blocks a quiet month.
    let sourceCoverage = null;
    let contentToSave = content;
    if (nextStatus === 'ready_for_review') {
      sourceCoverage = await compileSourceCoverage(
        supabase,
        patient_id,
        pt.clinic_id,
        parsedContent?.period || period,
      );
      contentToSave = attachCoverage(content, sourceCoverage);
    }
    const payload = {
      patient_id,
      report_type: 'progress_summary',
      document_type_code: 'CMPS:SE-FO-09',
      title: String(title || 'Monthly Assessment Report').trim(),
      period: String(parsedContent.period || period || '').trim() || null,
      status: nextStatus,
      completeness: nextStatus === 'ready_for_review' ? 100 : 50,
      content: JSON.stringify(contentToSave),
      prepared_by_id: req.profile.id,
      prepared_signature_image: prepared_signature_image || null,
      noted_by_id: null,
      reviewer_signature_image: null,
      reviewer_comment: null,
      finalized_at: null,
    };

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('assessment_reports')
        .update(payload)
        .eq('id', existing.id)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('assessment_reports')
        .insert(payload)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    }

    if (result && nextStatus === 'ready_for_review') {
      const { data: psychologistProfiles } = pt.treating_psychologist_id
        ? await supabase
            .from('profiles')
            .select('id')
            .eq('id', pt.treating_psychologist_id)
            .is('deleted_at', null)
        : await supabase
            .from('profiles')
            .select('id')
            .eq('clinic_id', req.profile.clinic_id)
            .eq('role', 'psychologist')
            .is('deleted_at', null);

      await Promise.all(
        (psychologistProfiles || []).map((psychologist) =>
          createNotification({
            clinicId: pt.clinic_id,
            recipientId: psychologist.id,
            type: 'report',
            title: 'Monthly report submitted for review',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychometrician'} submitted the Monthly Assessment Report${payload.period ? ` (${payload.period})` : ''} for ${patientName(pt)} (ID: ${pt.patient_id || 'N/A'}). Please review and sign.`,
            link: `/psychologist/progress?patientId=${pt.id}`,
          }),
        ),
      );

      // Parent-facing notice — once (the old code sent one copy per
      // psychologist inside the map above).
      if (pt.caregiver_id) {
        await createNotification({
          clinicId: pt.clinic_id,
          recipientId: pt.caregiver_id,
          type: 'report',
          title: 'Monthly report submitted',
          // Parent-facing: a new monthly report went to the psychologist for
          // review. Linked to Assessment Services, where parents can see it
          // once approved — never to a staff-only route.
          body: `A new Monthly Assessment Report for ${name(pt)} was sent for psychologist review. You will be able to view it in Assessment Services once approved.`,
          link: '/client/assessments',
          email: {
            subject: `Monthly Report Submitted: ${name(pt)} - ClearMind Clinic`,
          },
        });
      }

      await writeAudit({
        clinicId: pt.clinic_id,
        actorId: req.profile.id,
        action: existing?.id
          ? 'resubmit_progress_report'
          : 'submit_progress_report',
        entityType: 'progress_report',
        entityId: result.id,
        summary: `${req.profile.display_name || 'Psychometrician'} sent the Monthly Assessment Report for ${name(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''} to the psychologist for review.${sourceCoverage ? ` Sources: ${sourceCoverage.sessions ?? '?'} session(s), ${sourceCoverage.attendanceDays ?? '?'} attendance day(s), ${sourceCoverage.activityLogs ?? '?'} activity log(s) (${sourceCoverage.rangeLabel}).` : ''}`,
      });
    }

    res.status(existing?.id ? 200 : 201).json({ report: result, sourceCoverage });
  } catch (err) {
    next(err);
  }
});

// Delete a Monthly Assessment Report that is still a draft (or returned for
// revision). Reports already sent for review or approved are locked.
// IEP-like rows are never deleted here — they belong to the IEP plans page.
router.delete('/progress/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the assigned psychometrician can delete a monthly report.' });
    }
    const { data: existing, error: fetchError } = await supabase
      .from('assessment_reports')
      .select('id, patient_id, report_type, title, status, period')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!existing) return res.status(404).json({ error: 'Monthly report not found.' });
    if (existing.report_type !== 'progress_summary' || isIepLikeReport(existing)) {
      return res.status(400).json({ error: 'The selected record is not a Monthly Assessment Report.' });
    }
    if (!['draft', 'in_progress', 'revise_requested'].includes(existing.status)) {
      return res.status(409).json({
        error: existing.status === 'ready_for_review'
          ? 'This monthly report is pending psychologist review and can no longer be deleted.'
          : 'This monthly report is complete and can no longer be deleted.',
      });
    }
    let pt;
    try {
      pt = await authorizePatient(existing.patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { error: deleteError } = await supabase
      .from('assessment_reports')
      .delete()
      .eq('id', existing.id);
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: 'delete_progress_report',
      entityType: 'progress_report',
      entityId: existing.id,
      summary: `${req.profile.display_name || 'Psychometrician'} deleted the Monthly Assessment Report (${existing.period || 'unspecified period'}) for ${name(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// approve or request a revision on a report routed to the psychologist
router.patch('/reports/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Dual-role staff (e.g. primary psychometrician + psychologist) must be
    // allowed when acting as psychologist — checking only the primary role
    // wrongly rejects them. Mirrors the submissions endpoint below.
    if (!req.activeRoles.includes('psychologist')) {
      return res.status(403).json({ error: 'Only psychologists are allowed to sign or approve finalized reports.' });
    }
    const { status, reviewer_comment, reviewer_signature_image } = req.body || {};
    if (!['approved', 'revise_requested'].includes(status)) {
      return res.status(400).json({ error: 'A psychologist can approve or request a revision' });
    }
    const cleanedComment =
      reviewer_comment === undefined || reviewer_comment === null
        ? null
        : String(reviewer_comment).trim().slice(0, 100);
    if (status === 'approved' && !reviewer_signature_image) {
      return res.status(400).json({ error: 'A psychologist signature is required before approval.' });
    }
    if (status === 'revise_requested' && !cleanedComment) {
      return res.status(400).json({ error: 'A revision comment is required before returning the report.' });
    }
    const { data: rep } = await supabase
      .from('assessment_reports')
      .select('id, title, report_type, status, patient_id, prepared_by_id, patients(clinic_id, caregiver_id, patient_id, first_name, middle_name, last_name, photo_url, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!rep || !rep.patients || rep.patients.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (rep.status !== 'ready_for_review') {
      return res.status(409).json({ error: 'This report is no longer pending psychologist review.' });
    }
    const upd = { status, noted_by_id: req.profile.id };
    if (reviewer_comment !== undefined) upd.reviewer_comment = cleanedComment;
    if (reviewer_signature_image !== undefined) upd.reviewer_signature_image = reviewer_signature_image || null;
    if (status === 'approved') upd.finalized_at = new Date().toISOString();
    const { error } = await supabase.from('assessment_reports').update(upd).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });

    if (status === 'approved') {
      await createNotification({
        clinicId: rep.patients.clinic_id,
        recipientId: rep.patients.caregiver_id,
        type: 'report',
        title: 'Report available for request',
        body: `${rep.title || 'A report'} for ${name(rep.patients)} has been approved and signed by ${capitalizeNamePart(req.profile.display_name) || 'the psychologist'}. You can now request a certified true copy for clinic pick-up in Assessment Services.`,
        link: '/client/assessments',
        email: {
          subject: `Report Ready: ${name(rep.patients)} - ClearMind Clinic`,
        },
      });
    }

    const psychometricianRecipientId =
      rep.prepared_by_id ||
      rep.patients.treating_psychometrician_id ||
      null;
    if (psychometricianRecipientId && psychometricianRecipientId !== req.profile.id) {
      // Deep link: each target page selects the student (and the exact item
      // where the page shows a list) from these params.
      const reportDeepLink = `?patientId=${rep.patient_id}&reportId=${rep.id}`;
      const reportLink =
        isIepLikeReport(rep)
          ? `/psychometrician/iep${reportDeepLink}`
          : rep.report_type === 'progress_summary'
            ? `/psychometrician/progress${reportDeepLink}`
            : rep.report_type === 'daily_activity'
              ? `/psychometrician/activity${reportDeepLink}`
              : `/psychometrician/assessments?patientId=${rep.patient_id}&section=behavioral&reportId=${rep.id}`;
      await createNotification({
        clinicId: rep.patients.clinic_id,
        recipientId: psychometricianRecipientId,
        type: 'report',
        title: status === 'approved' ? 'Report approved' : 'Report returned for revision',
        body:
          status === 'approved'
            ? `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} approved and signed "${rep.title || 'the report'}" for ${name(rep.patients)}.`
            : `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} returned "${rep.title || 'the report'}" for ${name(rep.patients)} for revision. Please check the reviewer comment.`,
        link: reportLink,
      });
    }

    if (status === 'approved') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('clinic_id', rep.patients.clinic_id)
        .eq('role', 'admin')
        .is('deleted_at', null);
      const reportKind = isIepLikeReport(rep)
        ? 'IEP'
        : rep.report_type === 'progress_summary'
          ? 'Monthly Assessment Report'
          : rep.title || 'Behavioral Assessment Report';
      await Promise.all(
        (admins || []).map((a) =>
          createNotification({
            clinicId: rep.patients.clinic_id,
            recipientId: a.id,
            type: 'report',
            title: 'Document completed',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} approved the ${reportKind} for ${name(rep.patients)}. It is now available for document release.`,
            link: `/admin/records?student=${encodeURIComponent(name(rep.patients))}&highlight=${encodeURIComponent(reportKind)}`,
          }),
        ),
      );
    }

    const reportKind = isIepLikeReport(rep)
      ? 'IEP'
      : rep.report_type === 'progress_summary'
        ? 'Monthly Assessment Report'
        : rep.title || 'Behavioral Assessment Report';
    await writeAudit({
      clinicId: rep.patients?.clinic_id || req.profile.clinic_id,
      actorId: req.profile.id,
      action: status === 'approved' ? 'approve_report' : 'return_report_for_revision',
      entityType: isIepLikeReport(rep)
        ? 'iep'
        : rep.report_type === 'progress_summary'
          ? 'monthly_assessment_report'
          : 'behavioral_assessment_report',
      entityId: rep.id,
      summary:
        status === 'approved'
          ? `${req.profile.display_name || 'Psychologist'} approved and signed the ${reportKind} for ${name(rep.patients)}${rep.patients?.patient_id ? ` (${rep.patients.patient_id})` : ''}.`
          : `${req.profile.display_name || 'Psychologist'} returned the ${reportKind} for ${name(rep.patients)}${rep.patients?.patient_id ? ` (${rep.patients.patient_id})` : ''} for revision.`,
      severity: status === 'approved' ? 'info' : 'warn',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/activity-logs/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Same dual-role rule as /reports/:id above: accept any held role, not
    // just the primary one.
    if (!req.activeRoles.includes('psychologist')) {
      return res.status(403).json({ error: 'Only psychologists can review a Daily Activity Report.' });
    }
    const { status, reviewer_comment, reviewer_signature_image } = req.body || {};
    if (!['approved', 'revise_requested'].includes(status)) {
      return res.status(400).json({ error: 'A DAR can only be approved or returned for revision.' });
    }
    const cleanedComment =
      reviewer_comment === undefined || reviewer_comment === null
        ? null
        : String(reviewer_comment).trim().slice(0, 100);
    if (status === 'approved' && !reviewer_signature_image) {
      return res.status(400).json({ error: 'A psychologist signature is required before approval.' });
    }
    if (status === 'revise_requested' && !cleanedComment) {
      return res.status(400).json({ error: 'A revision comment is required before returning the DAR.' });
    }

    const { data: log, error: fetchError } = await supabase
      .from('session_logs')
      .select('id, patient_id, author_id, status, patients(clinic_id, first_name, middle_name, last_name, photo_url, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!log?.patients || log.patients.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Daily Activity Report not found.' });
    }
    if (
      log.patients.treating_psychologist_id &&
      log.patients.treating_psychologist_id !== req.profile.id
    ) {
      return res.status(403).json({ error: 'This student is not assigned to you.' });
    }
    if (log.status !== 'pending') {
      return res.status(409).json({ error: 'This DAR is no longer pending psychologist review.' });
    }

    const update = {
      status,
      reviewed_by_id: req.profile.id,
      reviewer_comment: cleanedComment,
      reviewer_signature_image: status === 'approved' ? reviewer_signature_image : null,
      reviewed_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from('session_logs')
      .update(update)
      .eq('id', req.params.id);
    if (updateError) return res.status(400).json({ error: updateError.message });

    const psychometricianRecipientId =
      log.author_id ||
      log.patients.treating_psychometrician_id ||
      null;
    if (psychometricianRecipientId) {
      await createNotification({
        clinicId: log.patients.clinic_id,
        recipientId: psychometricianRecipientId,
        type: 'report',
        title: status === 'approved' ? 'Daily Activity Report approved' : 'Daily Activity Report returned',
        body:
          status === 'approved'
            ? `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} approved the Daily Activity Report for ${patientName(log.patients)}.`
            : `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} returned the Daily Activity Report for ${patientName(log.patients)} for revision. Please check the comment.`,
        link: `/psychometrician/activity?patientId=${log.patient_id}`,
      });
    }

    if (status === 'approved') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('clinic_id', log.patients.clinic_id)
        .eq('role', 'admin')
        .is('deleted_at', null);
      await Promise.all(
        (admins || []).map((a) =>
          createNotification({
            clinicId: log.patients.clinic_id,
            recipientId: a.id,
            type: 'report',
            title: 'Document completed',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} approved the Daily Activity Report for ${patientName(log.patients)}. It is now available for document release.`,
            link: `/admin/records?student=${encodeURIComponent(patientName(log.patients))}&highlight=Daily Activity Report`,
          }),
        ),
      );
    }

    await writeAudit({
      clinicId: log.patients.clinic_id,
      actorId: req.profile.id,
      action:
        status === 'approved'
          ? 'approve_daily_activity_report'
          : 'return_daily_activity_report_for_revision',
      entityType: 'daily_activity_report',
      entityId: log.id,
      summary:
        status === 'approved'
          ? `${req.profile.display_name || 'Psychologist'} approved and signed the Daily Activity Report for ${patientName(log.patients)}.`
          : `${req.profile.display_name || 'Psychologist'} returned the Daily Activity Report for ${patientName(log.patients)} for revision.`,
      severity: status === 'approved' ? 'info' : 'warn',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Read-only progress reference for one roster client: latest FO-03 result,
// change since the first FO-03, and monthly-report coverage. The suggested
// value is a starting point only — the psychologist still sets and saves
// milestone_progress manually via PATCH /roster/:patientId.
router.get('/roster/:patientId/suggestion', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let patient;
    try {
      patient = await authorizePatient(req.params.patientId, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    let template = null;
    for (const match of [
      { col: 'document_type_code', op: 'eq', val: 'CMPS:SE-FO-03' },
      { col: 'document_type_code', op: 'ilike', val: '%FO-03%' },
    ]) {
      let q = supabase.from('assessment_templates').select('id, document_type_code, structure').limit(1);
      q = match.op === 'eq' ? q.eq(match.col, match.val) : q.ilike(match.col, match.val);
      const { data } = await q.maybeSingle();
      if (data) {
        template = data;
        break;
      }
    }

    const scoreOf = (answers, structure) => {
      let total = 0;
      let max = 0;
      let answered = 0;
      for (const d of Array.isArray(structure) ? structure : []) {
        // Perceptual/stimming sections flag concerns; they never score skill.
        if (['perceptual', 'stimming'].includes(d?.key)) continue;
        for (const it of Array.isArray(d?.items) ? d.items : []) {
          max += 1;
          const v = String(responseValue(answers, it.key)).toLowerCase();
          if (v === 'yes') {
            total += 1;
            answered += 1;
          } else if (v === 'no' || v === 'na') {
            answered += 1;
          }
        }
      }
      return { total, max, answered, pct: max > 0 ? Math.round((total / max) * 100) : null };
    };

    let latest = null;
    let first = null;
    if (template) {
      const structure = structureForTemplate(template);
      const { data: subs } = await supabase
        .from('assessment_submissions')
        .select('total_score, max_score, status, answers, updated_at, created_at')
        .eq('patient_id', patient.id)
        .eq('template_id', template.id)
        .order('updated_at', { ascending: true });
      const answered = (subs || []).filter((s) => s.answers && Object.keys(s.answers).length > 0);
      if (answered.length > 0) {
        const firstSub = answered[0];
        const lastSub = answered[answered.length - 1];
        const firstScore = scoreOf(firstSub.answers, structure);
        const lastScore = scoreOf(lastSub.answers, structure);
        const dateOf = (s) => String(s.updated_at || s.created_at || '').slice(0, 10);
        first = { ...firstScore, date: dateOf(firstSub) };
        latest = {
          ...lastScore,
          date: dateOf(lastSub),
          status: lastSub.status || '—',
          delta: firstScore.pct != null && lastScore.pct != null ? lastScore.pct - firstScore.pct : null,
          // Resubmits update the same row, so first and latest are usually
          // the same record (delta 0). The count lets the UI say so honestly
          // instead of printing a meaningless "+0 pts since first".
          count: answered.length,
        };
      }
    }

    const { data: reports } = await supabase
      .from('assessment_reports')
      .select('id, title, report_type')
      .eq('patient_id', patient.id)
      .eq('report_type', 'progress_summary');

    // Exclude legacy IEP rows stored as progress_summary so the count
    // matches the Monthly list (which filters isIepLikeReport).
    const monthlyOnly = (reports || []).filter((r) => !isIepLikeReport(r));

    res.json({
      suggestion: {
        fo03: latest,
        firstFo03: first,
        progressReports: monthlyOnly.length,
        // Reference point, not an auto-decision: current functioning snapshot.
        suggested: latest?.pct ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// update a client's roster classification (support level + milestone progress)
router.patch('/roster/:patientId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Support level, chief complaint, and working diagnosis are licensed-
    // psychologist decisions. authorizePatient alone would also admit an
    // assigned psychometrician, so enforce the clinical role explicitly.
    const clinicalRoles = [req.profile.role, ...(req.profile.extra_roles || [])];
    if (!clinicalRoles.some((r) => ['psychologist', 'admin', 'super_admin'].includes(r))) {
      return res.status(403).json({ error: 'Only the assigned psychologist (or an administrator) can update roster classifications.' });
    }
    const { support_level, milestone_progress, chief_complaint, working_diagnosis } = req.body || {};
    if (support_level !== undefined && !['HSN', 'MSN', 'LSN'].includes(support_level)) {
      return res.status(400).json({ error: 'Support level must be HSN, MSN, or LSN' });
    }
    if (
      milestone_progress !== undefined &&
      (!Number.isInteger(milestone_progress) || milestone_progress < 0 || milestone_progress > 100)
    ) {
      return res.status(400).json({ error: 'Milestone progress must be a whole number between 0 and 100' });
    }
    if (
      support_level === undefined &&
      milestone_progress === undefined &&
      chief_complaint === undefined &&
      working_diagnosis === undefined
    ) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    let patient;
    try {
      patient = await authorizePatient(req.params.patientId, req.profile);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const upd = { patient_id: patient.id };
    if (support_level !== undefined) upd.support_level = support_level;
    if (milestone_progress !== undefined) upd.milestone_progress = milestone_progress;
    if (chief_complaint !== undefined) upd.chief_complaint = chief_complaint || null;
    if (working_diagnosis !== undefined) upd.working_diagnosis = working_diagnosis || null;
    const { error } = await supabase
      .from('clinical_profiles')
      .upsert(upd, { onConflict: 'patient_id' });
    if (error) return res.status(400).json({ error: error.message });

    await createNotification({
      clinicId: patient.clinic_id,
      recipientId: patient.caregiver_id,
      type: 'report',
      title: 'Progress record updated',
      // Formal attribution: parents see the role, never a bare personal
      // name. The linked Home dashboard shows the updated figures.
      body: `Your assigned psychologist updated the support level and milestone progress for ${name(patient)}.`,
      link: '/client/home',
      email: {
        subject: `Progress Update: ${name(patient)} - ClearMind Clinic`,
      },
    });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'update_clinical_profile',
      entityType: 'patient',
      entityId: patient.id,
      summary: `${req.profile.display_name || 'Clinician'} updated the clinical profile for ${name(patient)}.`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Clinical intake interview (FS-IT-01). Read: assigned psychologist,
// psychometrician, or admin. Write: assigned psychologist, assigned
// psychometrician, or admin — both clinicians collaborate on the record,
// with per-field edit tracking (migration 0098) showing who changed what.
// (The roster's chief complaint / working diagnosis stays
// psychologist-only via PATCH /roster hardening.)
const INTAKE_COLUMNS = 'id, patient_id, interview_date, informant, concerns, onset, background, developmental, medical, family, observations, prepared_by_id, created_at, updated_at';
const INTAKE_COLUMNS_TRACKED = `${INTAKE_COLUMNS}, updated_by_id, field_meta`;

const resolveIntakeEditor = async (profileId) => {
  if (!profileId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', profileId)
    .maybeSingle();
  if (!data) return null;
  // display_name is hand-typed at registration and may be lowercase —
  // normalize on the way out so edit stamps render correctly.
  return { id: data.id, name: capitalizeNamePart(data.display_name || 'Clinician'), role: data.role || null };
};

// Dual-role staff (e.g. primary psychometrician + extra psychologist) must be
// stamped in the capacity they acted in for THIS patient — not their primary
// profile.role. Prefer the explicit acting role (x-active-role header yields a
// single-entry activeRoles), then the patient's assignment, then the page the
// save came from (sourceRole hint), so an assigned psychologist is stamped
// Psychologist even when their primary role is psychometrician.
const resolveIntakeRole = (profile, activeRoles, patient, hint = null) => {
  const held = [profile.role, ...(profile.extra_roles || [])].filter(Boolean);
  const active = Array.isArray(activeRoles) ? activeRoles : [];
  if (active.length === 1 && held.includes(active[0])) return active[0];
  if (patient) {
    const isPsy = !!patient.treating_psychologist_id && patient.treating_psychologist_id === profile.id;
    const isPmt = !!patient.treating_psychometrician_id && patient.treating_psychometrician_id === profile.id;
    if (isPsy && !isPmt) return 'psychologist';
    if (isPmt && !isPsy) return 'psychometrician';
  }
  if (hint && held.includes(hint)) return hint;
  return profile.role || null;
};

router.get('/intake/:patientId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let patient;
    try {
      patient = await authorizePatient(req.params.patientId, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    let { data, error } = await supabase
      .from('intake_interviews')
      .select(INTAKE_COLUMNS_TRACKED)
      .eq('patient_id', patient.id)
      .maybeSingle();
    if (error) {
      // Table missing (migration 0091 not applied yet) reads as "no intake".
      if (error.code === '42P01') return res.json({ intake: null, setupRequired: true });
      // Tracking columns missing (migration 0098 not applied yet) — fall back.
      if (error.code === '42703') {
        const legacy = await supabase
          .from('intake_interviews')
          .select(INTAKE_COLUMNS)
          .eq('patient_id', patient.id)
          .maybeSingle();
        if (legacy.error) return next(legacy.error);
        return res.json({ intake: legacy.data || null });
      }
      return next(error);
    }
    if (data) {
      const editor = await resolveIntakeEditor(data.updated_by_id);
      if (editor) {
        // Retroactive fix: stamps written before resolveIntakeRole carry the
        // editor's primary role. Re-derive from the patient's assignment so a
        // dual-role staffer assigned as psychologist reads Psychologist.
        const isPsy = !!patient.treating_psychologist_id && patient.treating_psychologist_id === editor.id;
        const isPmt = !!patient.treating_psychometrician_id && patient.treating_psychometrician_id === editor.id;
        if (isPsy && !isPmt) editor.role = 'psychologist';
        else if (isPmt && !isPsy) editor.role = 'psychometrician';
      }
      data.updated_by = editor;
    }
    res.json({ intake: data || null });
  } catch (err) {
    next(err);
  }
});

router.put('/intake/:patientId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const clinicalRoles = [req.profile.role, ...(req.profile.extra_roles || []), ...(req.activeRoles || [])];
    if (!clinicalRoles.some((r) => ['psychologist', 'psychometrician', 'admin', 'super_admin'].includes(r))) {
      return res.status(403).json({ error: 'Only the assigned psychologist, psychometrician, or an administrator can record the intake interview.' });
    }
    let patient;
    try {
      patient = await authorizePatient(req.params.patientId, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const body = req.body || {};
    const editorStamp = {
      by: capitalizeNamePart(req.profile.display_name || 'Clinician'),
      role: resolveIntakeRole(req.profile, req.activeRoles, patient, body.sourceRole),
      at: new Date().toISOString(),
    };
    const saveTracked = async (withTracking) => {
      // Merge per-field edit stamps so both clinicians can see who
      // last touched each field.
      let fieldMeta = {};
      let preparedById = req.profile.id;
      if (withTracking) {
        const { data: existing } = await supabase
          .from('intake_interviews')
          .select('prepared_by_id, field_meta')
          .eq('patient_id', patient.id)
          .maybeSingle();
        if (existing?.prepared_by_id) preparedById = existing.prepared_by_id;
        fieldMeta = (existing && typeof existing.field_meta === 'object' && existing.field_meta) || {};
        const changed = Array.isArray(body.changedFields) ? body.changedFields : [];
        for (const field of changed) {
          if (typeof field === 'string' && field) fieldMeta[field] = editorStamp;
        }
      }
      const row = {
        patient_id: patient.id,
        interview_date: body.interview_date || null,
        informant: body.informant || null,
        concerns: body.concerns || null,
        onset: body.onset || null,
        background: body.background || null,
        developmental: body.developmental || null,
        medical: body.medical || null,
        family: body.family || null,
        observations: body.observations || null,
        ...(withTracking
          ? { prepared_by_id: preparedById, updated_by_id: req.profile.id, field_meta: fieldMeta }
          : { prepared_by_id: req.profile.id }),
      };
      return supabase
        .from('intake_interviews')
        .upsert(row, { onConflict: 'patient_id' })
        .select(withTracking ? 'id, updated_at, field_meta' : 'id, updated_at')
        .maybeSingle();
    };
    let { data, error } = await saveTracked(true);
    if (error && error.code === '42703') {
      // Tracking columns missing (migration 0098 not applied yet) — save anyway.
      ({ data, error } = await saveTracked(false));
    }
    if (error) {
      if (error.code === '42P01') {
        return res.status(500).json({ error: 'Intake storage is not set up yet. Apply migration 0091_intake_interviews.sql in the Supabase SQL editor.' });
      }
      return res.status(400).json({ error: error.message });
    }
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'save_intake_interview',
      entityType: 'patient',
      entityId: patient.id,
      summary: `${req.profile.display_name || 'Clinician'} recorded the intake interview for ${name(patient)}.`,
    });
    res.json({
      ok: true,
      id: data?.id || null,
      updated_at: data?.updated_at || null,
      updated_by: editorStamp,
      field_meta: (data && data.field_meta) || {},
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/submissions/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychologist')) {
      return res.status(403).json({
        error: 'Only the assigned psychologist can review standardized assessments.',
      });
    }

    const { status, reviewer_comment, reviewer_signature_image } = req.body || {};
    if (!status || !['scored', 'revalidation'].includes(status)) {
      return res.status(400).json({
        error: 'An assessment can only be approved or returned for revision.',
      });
    }
    const cleanedComment =
      reviewer_comment === undefined || reviewer_comment === null
        ? null
        : String(reviewer_comment).trim().slice(0, 100);
    if (status === 'scored' && !reviewer_signature_image) {
      return res.status(400).json({
        error: 'A psychologist signature is required before approval.',
      });
    }
    if (status === 'revalidation' && !cleanedComment) {
      return res.status(400).json({
        error: 'A revision comment is required before returning the assessment.',
      });
    }
    const { data: sub, error: fetchError } = await supabase
      .from('assessment_submissions')
      .select('id, patient_id, status, total_score, max_score, template_id, domain_scores, respondent_profile_id, respondent_signature_image, patients(clinic_id, caregiver_id, first_name, last_name, photo_url, treating_psychologist_id, treating_psychometrician_id), assessment_templates(title, document_type_code)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!sub || !sub.patients || sub.patients.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (
      sub.patients.treating_psychologist_id &&
      sub.patients.treating_psychologist_id !== req.profile.id
    ) {
      return res.status(403).json({
        error: 'This student is assigned to another psychologist.',
      });
    }
    if (sub.status !== 'submitted') {
      return res.status(409).json({
        error: 'This assessment is no longer pending psychologist review.',
      });
    }
    if (!sub.respondent_signature_image) {
      return res.status(409).json({
        error: 'The psychometrician signature is missing. Return the assessment for completion.',
      });
    }

    const upd = {
      status,
      reviewed_by_id: req.profile.id,
      reviewed_at: new Date().toISOString(),
      reviewer_comment: cleanedComment,
      reviewer_signature_image: status === 'scored' ? reviewer_signature_image : null,
    };
    const { error } = await supabase
      .from('assessment_submissions')
      .update(upd)
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });

    // DARs now follow the signed RPm -> RPsy workflow in session_logs.
    if (false && status === 'scored') {
      const assessmentTitle = sub.assessment_templates?.title || sub.assessment_templates?.document_type_code || 'Assessment';
      const contentJson = JSON.stringify({
        assessment_code: sub.assessment_templates?.document_type_code || null,
        template_title: assessmentTitle,
        total_score: sub.total_score,
        max_score: sub.max_score,
        domain_scores: sub.domain_scores || [],
        scored_at: new Date().toISOString(),
        scored_by_id: req.profile.id,
        autogen: true,
      });
      const { error: insErr } = await supabase.from('assessment_reports').insert({
        patient_id: sub.patient_id,
        report_type: 'daily_activity',
        title: `Daily Activity Report â€” ${assessmentTitle}`,
        status: 'approved',
        content: contentJson,
        source_submission_id: sub.id,
        prepared_by_id: req.profile.id,
        noted_by_id: req.profile.id,
        finalized_at: new Date().toISOString(),
      }).maybeSingle();
      if (insErr) {
        console.error('Failed to auto-create DAR:', insErr);
      }
    }

    const notificationRecipientId = sub.respondent_profile_id || null;
    if (notificationRecipientId) {
      await createNotification({
        clinicId: sub.patients.clinic_id,
        recipientId: notificationRecipientId,
        type: 'assessment',
        title: status === 'scored' ? 'Assessment approved' : 'Assessment returned for revision',
        body: status === 'scored'
          ? `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} approved "${sub.assessment_templates?.title || 'the assessment'}" for ${patientName(sub.patients)}.`
          : `${capitalizeNamePart(req.profile.display_name) || 'The psychologist'} returned "${sub.assessment_templates?.title || 'the assessment'}" for ${patientName(sub.patients)} for revision. Please check the reviewer comment.`,
        // Deep link: select the student and highlight the exact assessment row.
        link: `/psychometrician/assessments?patientId=${sub.patient_id}&section=assessments&templateId=${sub.template_id}`,
      });
    }

    // Parents never saw completed standardized assessments: the notice above
    // goes to the staff respondent. Tell the caregiver so they know a copy
    // can now be requested for clinic pick-up.
    const caregiverId = sub.patients.caregiver_id || null;
    if (status === 'scored' && caregiverId) {
      await createNotification({
        clinicId: sub.patients.clinic_id,
        recipientId: caregiverId,
        type: 'assessment',
        title: 'Assessment completed',
        body: `"${sub.assessment_templates?.title || 'The assessment'}" for ${patientName(sub.patients)} has been completed. You can now request a copy for clinic pick-up in Assessment Services.`,
        link: '/client/assessments',
      });
    }

    await writeAudit({
      clinicId: sub.patients.clinic_id,
      actorId: req.profile.id,
      action:
        status === 'scored'
          ? 'approve_standardized_assessment'
          : status === 'revalidation'
            ? 'return_standardized_assessment_for_revision'
            : 'update_standardized_assessment',
      entityType: 'assessment_submission',
      entityId: sub.id,
      summary:
        status === 'scored'
          ? `${req.profile.display_name || 'Psychologist'} approved and signed ${sub.assessment_templates?.title || 'a standardized assessment'} for ${sub.patients.first_name} ${sub.patients.last_name}.`
          : status === 'revalidation'
            ? `${req.profile.display_name || 'Psychologist'} returned ${sub.assessment_templates?.title || 'a standardized assessment'} for ${sub.patients.first_name} ${sub.patients.last_name} for revision.`
            : `${req.profile.display_name || 'Psychologist'} updated ${sub.assessment_templates?.title || 'a standardized assessment'} for ${sub.patients.first_name} ${sub.patients.last_name}.`,
      severity: status === 'revalidation' ? 'warn' : 'info',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
