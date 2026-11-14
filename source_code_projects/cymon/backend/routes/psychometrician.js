const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { completePastAppointments } = require('../lib/appointments');
const { createNotification } = require('../lib/notify');
const { writeAudit } = require('../lib/audit');
const { patientName, capitalizeNamePart } = require('../lib/names');
const dto = require('../lib/dto');
const { dedupeLatestBy } = require('../lib/latest');
const { localPermissionsStore } = require('../lib/permissions');
const { renderFormPdf, renderAttendancePdf, inferFormCode, normalizeDailyActivityRecord } = require('../lib/formPdf');
const { normalizeBehavioralReportContent } = require('../lib/behavioralReport');
const { friendlyDbError } = require('../lib/dbErrors');
const { FO05_METADATA_FIELDS, responseValue, scoreAssessment, structureForTemplate } = require('../lib/assessmentSchemas');
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

router.use(requireAuth, requireRole('psychometrician', 'admin', 'super_admin', 'psychologist'));

// Only admins see signature ink on generated PDFs. Psychometricians and
// psychologists receive the same document with signatures recorded-but-hidden;
// the official signed copy is generated from the admin clinical-records
// endpoints, which never pass hideSignatures.
function hideSignaturesFor(req) {
  // Gate on the ACTING role (x-active-role), not every held role: a
  // multi-role staffer working as psychometrician/psychologist must get the
  // redacted copy. Held extra_roles used to bypass this check, which is why
  // dual-role accounts kept seeing signature ink outside admin.
  const acting = req.activeRoles || [req.profile.role, ...(req.profile.extra_roles || [])];
  return !acting.includes('admin') && !acting.includes('super_admin');
}

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

async function attachPdfProfiles(record) {
  const ids = [
    record.prepared_by_id,
    record.noted_by_id,
    record.author_id,
    record.reviewed_by_id,
    record.respondent_profile_id,
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
  record.respondent_profile = byId[record.respondent_profile_id] || null;
  return record;
}

async function loadStaffPdfRecord(sourceTable, id, clinicId) {
  if (!['assessment_reports', 'assessment_submissions', 'session_logs'].includes(sourceTable)) {
    const error = new Error('Unsupported PDF source');
    error.status = 400;
    throw error;
  }
  const { data: record, error } = await supabase.from(sourceTable).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!record) return null;

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*, photo_url')
    .eq('id', record.patient_id)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();
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
  const bundle = {
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

  if (sourceTable === 'assessment_submissions') {
    const { data: template, error: templateError } = await supabase
      .from('assessment_templates')
      .select('document_type_code')
      .eq('id', record.template_id)
      .maybeSingle();
    if (templateError) throw templateError;
    record.document_type_code = template?.document_type_code || 'CMPS:SE-FO-04';
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
    // Preview friendliness: an unapproved DAR has no reviewer yet — show the
    // assigned psychologist's name in the Noted-by slot (no signature) so
    // the official form never prints a blank signatory.
    record.noted_by = bundle.patient.treating_psychologist;
  }
  return { record, bundle, code };
}

router.get('/pdf/:sourceTable/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const loaded = await loadStaffPdfRecord(req.params.sourceTable, req.params.id, req.profile.clinic_id);
    if (!loaded) return res.status(404).json({ error: 'Document not found' });
    const bytes = await renderFormPdf({
      code: loaded.code,
      bundle: loaded.bundle,
      submission: loaded.record,
      report: loaded.record,
      requestingUser: req.profile,
      hideSignatures: hideSignaturesFor(req),
    });
    const filename = `${loaded.bundle.patient.patient_id || loaded.bundle.patient.id}-${loaded.code.replace(/[:]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(bytes);
  } catch (err) {
    next(err);
  }
});

// Official Monthly Assessment Report preview. When a report has not been
// submitted yet, render a database-backed blank FO-08 with the student's
// identity, diagnosis, and assigned signatories already filled in.
router.get('/progress/:patientId/pdf', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await authorizePatient(req.params.patientId, req.profile);
    const [{ data: reports, error: reportError }, { data: guardians, error: guardianError }, { data: emergency, error: emergencyError }] = await Promise.all([
      supabase
        .from('assessment_reports')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('report_type', 'progress_summary')
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase.from('guardians').select('*').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
      supabase.from('emergency_contacts').select('*').eq('patient_id', patient.id).limit(1).maybeSingle(),
    ]);
    if (reportError) throw reportError;
    if (guardianError) throw guardianError;
    if (emergencyError) throw emergencyError;

    const savedReport = (reports || []).find((report) => !/(individualized educat(?:ion|ional) plan|\biep\b)/i.test(report.title || '')) || null;
    const profileIds = [patient.treating_psychologist_id, patient.treating_psychometrician_id].filter(Boolean);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, middle_name, last_name, phone, license_no, title')
      .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);
    if (profileError) throw profileError;
    const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    const bundle = {
      patient: {
        ...patient,
        full_name: patientName(patient),
        photo_url: patient.photo_url || patient.patients?.photo_url || null,
        treating_psychologist: profileById[patient.treating_psychologist_id] || null,
        treating_psychometrician: profileById[patient.treating_psychometrician_id] || null,
      },
      clinical: Array.isArray(patient.clinical_profiles) ? patient.clinical_profiles[0] || {} : patient.clinical_profiles || {},
      guardians: guardians || [],
      emergency: emergency || {},
    };
    const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const report = savedReport || {
      patient_id: patient.id,
      document_type_code: 'CMPS:SE-FO-08',
      report_type: 'progress_summary',
      title: 'Monthly Assessment Report',
      period,
      content: {
        schema_version: 1,
        form: {
          period,
          patientName: patientName(patient),
          sex: patient.sex || '',
          diagnosis: bundle.clinical.working_diagnosis || '',
          selectedDomains: [],
          dataNarrative: '',
          generalOverview: '',
          domainAssessments: {},
          planRows: [],
        },
      },
      prepared_by_id: patient.treating_psychometrician_id || null,
      noted_by_id: patient.treating_psychologist_id || null,
      prepared_signature_image: null,
      reviewer_signature_image: null,
    };
    report.document_type_code = 'CMPS:SE-FO-08';
    report.prepared_by_id = report.prepared_by_id || patient.treating_psychometrician_id || null;
    report.noted_by_id = report.noted_by_id || patient.treating_psychologist_id || null;
    await attachPdfProfiles(report);

    const bytes = await renderFormPdf({ code: 'CMPS:SE-FO-08', bundle, report, requestingUser: req.profile, hideSignatures: hideSignaturesFor(req) });
    const filename = `${patient.patient_id || patient.id}-CMPS-SE-FO-08.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(bytes);
  } catch (err) {
    if (err.message === 'Patient not found' || err.message === 'Patient is not assigned to you') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

const SESSION_LABEL = {
  mmse: 'MMSE Assessment',
  cafat: 'CAFAT Testing',
  gars: 'GARS Assessment',
  initial_assessment: 'Initial Assessment',
  follow_up: 'Follow-up Session',
  therapy: 'Therapy Session',
  parent_consultation: 'Parent Consultation',
};

function getAssessmentQuestions(structure = []) {
  return (Array.isArray(structure) ? structure : []).flatMap((domain) =>
    Array.isArray(domain?.items)
      ? domain.items.map((item) => ({
          ...item,
          key: item?.key,
          label: item?.label || item?.text || item?.name || item?.key || 'Assessment item',
          domain: domain?.title || domain?.name || domain?.label || '',
        }))
      : [],
  ).filter((item) => item.key);
}

function findIncompleteAssessmentItems(structure = [], answers = {}) {
  return getAssessmentQuestions(structure).filter((item) => {
    const raw = answers?.[item.key];
    const response = raw && typeof raw === 'object' ? raw.response ?? raw.value ?? raw.answer : raw;
    const normalized = String(response || '').trim().toLowerCase();
    if (item.response_type === 'text') return !normalized;
    if (item.response_type === 'select') {
      return !(item.options || []).some((option) => String(option).toLowerCase() === normalized);
    }
    return !['yes', 'no', 'na'].includes(normalized);
  });
}

const REPORT_SIGNATURE_COLUMNS = ['prepared_signature_image', 'reviewer_signature_image'];
const {
  IEP_TITLE_RE,
  findIncompleteIepField,
  stringifyIepContent,
  hasOverlongIepText,
  parseIepContent,
} = require('../lib/iep');

const DAR_TEXT_LIMIT = 400;
const DAR_TITLE_LIMIT = 100;

function validateDailyActivityPayload(payload = {}) {
  const required = [
    ['session number', payload.session_number],
    ['activity date', payload.session_date],
    ['activity title', payload.activity_title],
    ['targeted domains', payload.target_domain],
    ['objectives', payload.objectives],
    ['activity procedure', payload.procedure],
    ['responses / observations', payload.observations],
  ];
  const missing = required.find(([, value]) => !String(value ?? '').trim());
  if (missing) return `Please complete ${missing[0]} before sending the DAR.`;

  const sessionNumber = Number(payload.session_number);
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 9999) {
    return 'Session number must be a whole number from 1 to 9999.';
  }
  const today = new Date().toISOString().slice(0, 10);
  if (String(payload.session_date) > today) {
    return 'Activity date cannot be in the future.';
  }
  if (String(payload.activity_title).length > DAR_TITLE_LIMIT) {
    return `Activity title is limited to ${DAR_TITLE_LIMIT} characters.`;
  }
  for (const field of ['target_domain', 'objectives', 'procedure', 'observations']) {
    if (String(payload[field] || '').length > DAR_TEXT_LIMIT) {
      return `DAR text fields are limited to ${DAR_TEXT_LIMIT} characters.`;
    }
  }
  return null;
}

const normalizeAssessmentReport = (report) => ({
  ...report,
  prepared_signature_image: report?.prepared_signature_image || null,
  reviewer_signature_image: report?.reviewer_signature_image || null,
  reviewer_comment: report?.reviewer_comment || null,
});

async function fetchAssessmentReportsByType(reportType, selectVariants, orderBy = 'updated_at', ascending = false) {
  let lastError = null;
  for (const select of selectVariants) {
    const result = await supabase
      .from('assessment_reports')
      .select(select)
      .eq('report_type', reportType)
      .order(orderBy, { ascending });

    if (!result.error) return result;

    const missingSignatureColumn =
      result.error.code === '42703' &&
      REPORT_SIGNATURE_COLUMNS.some((column) => result.error.message?.includes(column));

    if (missingSignatureColumn) {
      lastError = result.error;
      continue;
    }

    return result;
  }

  return { data: null, error: lastError };
}

async function fetchIepReportsWithFallback(selectVariants, orderBy = 'updated_at', ascending = false) {
  let lastError = null;
  for (const reportType of ['iep', 'progress_summary']) {
    for (const select of selectVariants) {
      const result = await supabase
        .from('assessment_reports')
        .select(select)
        .eq('report_type', reportType)
        .order(orderBy, { ascending });

      if (!result.error) {
        if (reportType === 'iep' && (!result.data || result.data.length === 0)) {
          continue;
        }
        return { ...result, reportTypeUsed: reportType };
      }

      const missingSignatureColumn =
        result.error.code === '42703' &&
        [...REPORT_SIGNATURE_COLUMNS, 'period'].some((column) => result.error.message?.includes(column));

      if (missingSignatureColumn) {
        lastError = result.error;
        continue;
      }

      if (reportType === 'iep' && result.error.code === '22P02') {
        lastError = result.error;
        break;
      }

      return { ...result, reportTypeUsed: reportType };
    }
  }

  return { data: null, error: lastError, reportTypeUsed: 'progress_summary' };
}

function ageFromDob(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  // Invalid or future birthdates (bad data entry) must never render as a
  // negative age — callers show a placeholder for null.
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  if (b > now) return null;
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
}

const name = patientName;
// Group appointments store students in appointment_participants (patient_id
// is null), so the queue must look at participants — otherwise a Front Desk
// group booking never reaches the practitioner's Upcoming tab.
const taskPatientList = (a) => {
  const parts = Array.isArray(a?.appointment_participants) ? a.appointment_participants : [];
  if (a?.format === 'group' || parts.length) {
    return parts.map((row) => row?.patients).filter(Boolean);
  }
  return [a?.patients].filter(Boolean);
};
const taskPrimaryPatient = (a) => taskPatientList(a)[0] || a?.patients || null;
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
    // Appointments: accept when the single patient OR any group participant
    // belongs to this clinic (and to me, when not acting as admin).
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
      // A session explicitly booked to me stays visible even when the
      // treating assignment points elsewhere.
      if (r.practitioner_id === profile.id) return true;
      return matched;
    }
    if (!r.patients || r.patients.clinic_id !== clinic) return false;
    if (!profile) return true;
    const roles = activeRoles || [profile.role, ...(profile.extra_roles || [])];
    if (roles.includes('admin')) return true;
    let matched = false;
    let checkedAny = false;
    if (roles.includes('psychologist')) {
      checkedAny = true;
      if (r.patients.treating_psychologist_id === profile.id) matched = true;
    }
    if (roles.includes('psychometrician')) {
      checkedAny = true;
      if (r.patients.treating_psychometrician_id === profile.id) matched = true;
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

async function authorizePatient(patientId, profile, activeRoles) {
  const { data: pt, error } = await supabase
    .from('patients')
    .select('id, clinic_id, caregiver_id, patient_id, first_name, middle_name, last_name, date_of_birth, sex, treating_psychologist_id, treating_psychometrician_id, clinical_profiles(working_diagnosis), photo_url')
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

router.get('/tasks', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    await completePastAppointments(supabase, req.profile.clinic_id);
    const gateCompliance = !req.activeRoles.includes('admin');
    const appointmentQuery = supabase
        .from('appointments')
        .select("id, starts_at, session_type, location, status, format, practitioner_id, created_by:created_by_id(display_name), patients:patients!appointments_patient_id_fkey(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)), appointment_participants(patient_id, patients:patients!appointment_participants_patient_id_fkey(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)))")
        .eq('clinic_id', req.profile.clinic_id)
        .order('starts_at', { ascending: true });
    if (req.profile.role === 'psychometrician' && !(req.profile.extra_roles || []).includes('admin')) {
      appointmentQuery.eq('practitioner_id', req.profile.id);
    }

    let assignmentQuery = supabase
      .from('assessment_assignments')
      .select('id, patient_id, status, due_date, template_id, assigned_to_id, updated_at, created_at, patients(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)), assessment_templates(title, document_type_code)')
      .in('status', ['assigned', 'in_progress'])
      .order('due_date', { ascending: true });
    if (req.profile.role === 'psychometrician' && !(req.profile.extra_roles || []).includes('admin')) {
      assignmentQuery.eq('assigned_to_id', req.profile.id);
    }

    let assignmentResult = await assignmentQuery;
    if (assignmentResult.error?.code === '42703') {
      assignmentResult = await supabase
        .from('assessment_assignments')
        .select('id, patient_id, status, due_date, template_id, assigned_by_id, updated_at, created_at, patients(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status)), assessment_templates(title, document_type_code)')
        .in('status', ['assigned', 'in_progress'])
        .eq('assigned_by_id', req.profile.id)
        .order('due_date', { ascending: true });
    }

    const [{ data: appts, error: apptErr }, { data: reportDrafts, error: reportDraftErr }, { data: subs, error: subsErr }, { data: templates, error: templatesErr }] = await Promise.all([
      appointmentQuery,
      supabase
        .from('assessment_reports')
        .select('id, patient_id, title, document_type_code, report_type, status, updated_at, patients(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
        .in('status', ['draft', 'in_progress', 'revise_requested'])
        .order('updated_at', { ascending: false }),
      // Standardized-test submissions still needing the psychometrician's
      // action (unfinished drafts + psychologist revalidation requests). These
      // live outside assessment_assignments/assessment_reports, so without
      // this bucket a Draft adaptive test is invisible in the Task List queue.
      supabase
        .from('assessment_submissions')
        .select('id, patient_id, template_id, status, updated_at, patients(first_name, middle_name, last_name, patient_id, photo_url, date_of_birth, sex, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
        // submission_status enum is ('draft','submitted','processed','scored',
        // 'flagged','revalidation') — 'in_progress' is not a member and makes
        // Postgres reject the whole /tasks query with a 500.
        .in('status', ['draft', 'revalidation'])
        .order('updated_at', { ascending: false }),
      supabase
        .from('assessment_templates')
        .select('id, title, document_type_code'),
    ]);
    const { data: assigns, error: assignErr } = assignmentResult;
    if (apptErr) return next(apptErr);
    if (reportDraftErr) return next(reportDraftErr);
    if (subsErr) return next(subsErr);
    if (templatesErr) return next(templatesErr);

    const baseTasks = inClinic(appts || [], req.profile.clinic_id, req.profile, req.activeRoles);
    const baseIds = new Set(baseTasks.map((a) => a.id));
    // Sessions explicitly booked to me stay in my queue even when the treating
    // assignment differs; the compliance rule below still applies. Group rows
    // carry students in appointment_participants (patients is null).
    const extraTasks = gateCompliance ? (appts || []).filter((a) =>
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

    const templateById = new Map((templates || []).map((t) => [String(t.id), t]));
    const clinicSubs = dedupeLatestBy(
      inClinic(subs || [], req.profile.clinic_id, req.profile, req.activeRoles),
      (submission) => `${submission.patient_id}:${submission.template_id}`,
      ['updated_at'],
    ).filter((s) => !gateCompliance || complianceComplete(s.patients));
    // A submission supersedes its assignment row (same patient + template) —
    // without this the same unfinished test appears twice in the queue.
    const submittedKeys = new Set(clinicSubs.map((s) => `${s.patient_id}:${s.template_id}`));
    const clinicAssigns = dedupeLatestBy(
      inClinic(assigns || [], req.profile.clinic_id, req.profile, req.activeRoles),
      (assignment) => `${assignment.patient_id}:${assignment.template_id}`,
      ['updated_at', 'created_at', 'due_date'],
    ).filter((g) => !submittedKeys.has(`${g.patient_id}:${g.template_id}`));
    const submissionDrafts = clinicSubs.map((s) => {
      const p = s.patients;
      const sexInit = p?.sex ? p.sex[0].toUpperCase() : '';
      const t = templateById.get(String(s.template_id)) || {};
      return {
        id: s.id,
        patientId: s.patient_id,
        patientName: name(p),
        photo_url: p?.photo_url || null,
        meta: p ? `ID: ${p.patient_id} Â· ${ageFromDob(p.date_of_birth)} yrs / ${sexInit}` : '',
        title: t.title || 'Assessment',
        code: t.document_type_code || '',
        templateId: s.template_id,
        dueDate: s.updated_at,
        status: s.status,
        type: 'submission',
      };
    });
    const assessments = clinicAssigns.filter((g) => !gateCompliance || complianceComplete(g.patients)).map((g) => {
      const p = g.patients;
      const sexInit = p?.sex ? p.sex[0].toUpperCase() : '';
      const t = g.assessment_templates || {};
      return {
        id: g.id,
        patientId: g.patient_id,
        patientName: name(p),
        photo_url: p?.photo_url || null,
        meta: p ? `ID: ${p.patient_id} Â· ${ageFromDob(p.date_of_birth)} yrs / ${sexInit}` : '',
        title: t.title || 'Assessment',
        code: t.document_type_code || '',
        dueDate: g.due_date,
        status: g.status,
      };
    });
    const draftReports = dedupeLatestBy(
      inClinic(reportDrafts || [], req.profile.clinic_id, req.profile, req.activeRoles),
      (report) => `${report.patient_id}:${report.report_type || report.document_type_code || report.title}`,
      ['updated_at'],
    ).filter((report) => !gateCompliance || complianceComplete(report.patients)).map((report) => {
      const codeFallback =
        report.document_type_code ||
        (report.report_type === 'behavioral' ? 'CMPS:SE-FO-06' :
         report.report_type === 'iep' ? 'CMPS:SE-FO-10' :
         report.report_type === 'daily_activity' ? 'CMPS:SE-FO-07' :
         report.report_type === 'progress_summary' ? 'CMPS:SE-FO-09' : '');
      return {
        id: report.id,
        patientId: report.patient_id,
        patientName: name(report.patients),
        photo_url: report.patients?.photo_url || null,
        meta: report.patients ? `ID: ${report.patients.patient_id || 'N/A'}` : '',
        title: report.title || 'Behavioral Assessment Report',
        code: codeFallback,
        reportType: report.report_type || '',
        dueDate: report.updated_at,
        status: report.status,
        type: 'draft_report',
      };
    });

    res.json({ tasks, assessments, submissionDrafts, draftReports });
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

router.get('/assessments', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    // Lean mode (?lean=1) for pages that only need the roster + test list
    // (e.g. the psychologist Approvals directory): skip the appointment,
    // employee, submission (full answers JSON + signature ink), assignment,
    // and permission queries entirely. Same response shape, empty arrays —
    // default callers are untouched.
    const lean = req.query.lean === '1';
    let patientsQuery = supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, date_of_birth, sex, previously_diagnosed, other_disability, treating_psychologist_id, treating_psychometrician_id, treating_psychologist:profiles!patients_treating_psychologist_id_fkey(display_name, title, license_no), photo_url, admission_form_status, waiver_submissions(id, document_type_code, status), clinical_profiles(primary_diagnosis, working_diagnosis, secondary_diagnosis)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    const restrictToAssessmentAssignments = roles.includes('psychometrician') && !roles.includes('psychologist');
    if (!roles.includes('admin')) {
      const actsAsPsychologist = roles.includes('psychologist');
      const actsAsPsychometrician = roles.includes('psychometrician');
      if (actsAsPsychologist && actsAsPsychometrician) {
        // Dual-role staff see patients they treat in EITHER capacity. A plain
        // psychologist-only filter here would blank the directory for a
        // psychometrician holding both roles.
        patientsQuery = patientsQuery.or(
          `treating_psychologist_id.eq.${req.profile.id},treating_psychometrician_id.eq.${req.profile.id}`,
        );
      } else if (actsAsPsychologist) {
        patientsQuery = patientsQuery.eq('treating_psychologist_id', req.profile.id);
      }
    }

    let assignmentsQuery = supabase
      .from('assessment_assignments')
      .select('patient_id, template_id, status, assigned_to_id, assigned_by_id')
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false });
    const { data: clinicPatients } = await supabase.from('patients').select('id').eq('clinic_id', req.profile.clinic_id);
    const patientIds = (clinicPatients || []).map(p => p.id);

    let subsQuery = supabase
      .from('assessment_submissions')
      .select('id, patient_id, template_id, status, total_score, max_score, created_at, updated_at, submitted_at, respondent_name, respondent_signature_image, reviewer_comment, reviewer_signature_image, respondent_profile:respondent_profile_id(display_name, title, license_no), reviewer_profile:reviewed_by_id(display_name, title, license_no), answers, metadata, patients(clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
      .order('created_at', { ascending: false });
    if (patientIds.length > 0) subsQuery.in('patient_id', patientIds);

    const [testsResult, sessionsResult, rosterResult, employeesResult, submissionsResult] = await Promise.all([
      supabase.from('assessment_templates').select('id, document_type_code, title, est_minutes, icon, is_active, document_types(description)').order('title', { ascending: true }),
      lean
        ? { data: [], error: null }
        : supabase
          .from('appointments')
          .select('id, starts_at, patients:patients!appointments_patient_id_fkey(first_name, middle_name, last_name, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
          .eq('clinic_id', req.profile.clinic_id)
          .order('starts_at', { ascending: true })
          .limit(6),
      patientsQuery.order('first_name', { ascending: true }),
      lean
        ? { data: [], error: null }
        : supabase
          .from('profiles')
          .select('id, display_name, role')
          .eq('clinic_id', req.profile.clinic_id)
          .neq('role', 'client')
          .order('display_name', { ascending: true }),
      lean || patientIds.length === 0 ? { data: [], error: null } : subsQuery,
    ]);

    let assignmentsResult = lean
      ? { data: [], error: null }
      : await assignmentsQuery;
    if (!lean && assignmentsResult.error?.code === '42703') {
      assignmentsResult = await supabase
        .from('assessment_assignments')
        .select('patient_id, template_id, status, assigned_by_id')
        .neq('status', 'cancelled')
        .order('updated_at', { ascending: false });
    }

    const queryError = [testsResult, sessionsResult, rosterResult, employeesResult, submissionsResult, assignmentsResult].find(
      (result) => result?.error,
    )?.error;
    if (queryError) return next(queryError);

    const tests = testsResult.data || [];
    const sessions = sessionsResult.data || [];
    const roster = rosterResult.data || [];
    const employees = employeesResult.data || [];
    const subs = submissionsResult.data || [];
    const assignmentRows = (assignmentsResult.data || []).filter((assignment) =>
      roles.includes('admin') ||
      assignment.assigned_to_id === req.profile.id ||
      assignment.assigned_to_id === req.profile.employee_id ||
      (!assignment.assigned_to_id && (
        assignment.assigned_by_id === req.profile.id ||
        assignment.assigned_by_id === req.profile.employee_id
      )),
    );
    const assignedRoster = restrictToAssessmentAssignments
      ? roster.filter((patient) =>
          patient.treating_psychometrician_id === req.profile.id ||
          patient.treating_psychometrician_id === req.profile.employee_id,
        )
      : roster;
    const approvedPatients = assignedRoster.filter((patient) =>
      patient.admission_form_status === 'complete' &&
      (patient.waiver_submissions || []).some(
        (waiver) => waiver.document_type_code === 'CMPS:SE-FO-02' && waiver.status === 'approved',
      ),
    );
    const hasExplicitAssignments = assignmentRows.length > 0;
    const eligibleAssignmentRows = restrictToAssessmentAssignments && hasExplicitAssignments
      ? assignmentRows.filter((assignment) => {
          const patient = roster.find((item) => item.id === assignment.patient_id);
          return patient?.admission_form_status === 'complete' &&
            (patient.waiver_submissions || []).some(
              (waiver) => waiver.document_type_code === 'CMPS:SE-FO-02' && waiver.status === 'approved',
            );
        })
      : [];
    let eligiblePatientIds = restrictToAssessmentAssignments
      ? new Set(hasExplicitAssignments
        ? eligibleAssignmentRows.map((assignment) => assignment.patient_id)
        : approvedPatients.map((patient) => patient.id))
      : new Set(roster.map((patient) => patient.id));
    // Never blank the whole directory: if assignment-scoping matches nobody
    // (stale assignments, compliance pending), fall back to the staff member's
    // treating + compliance-approved patients instead of showing none.
    if (restrictToAssessmentAssignments && hasExplicitAssignments && eligiblePatientIds.size === 0 && approvedPatients.length > 0) {
      console.warn(`[assessments] assignment scope matched 0 patients for ${req.profile.id}; falling back to approved treating patients`);
      eligiblePatientIds = new Set(approvedPatients.map((patient) => patient.id));
    }
    const fallbackTemplateIds = !hasExplicitAssignments
      ? (testsResult.data || []).filter((template) => template.is_active !== false).map((template) => template.id)
      : [];
    const assignedTemplatesByPatient = eligibleAssignmentRows.reduce((map, assignment) => {
      if (!map[assignment.patient_id]) map[assignment.patient_id] = [];
      if (!map[assignment.patient_id].includes(assignment.template_id)) {
        map[assignment.patient_id].push(assignment.template_id);
      }
      return map;
    }, {});

    let permissions = [];
    if (lean) {
      // Lean mode skips the permission ledger (Assessment Services only).
    } else try {
      const { data, error } = await supabase
        .from('assessment_permissions')
        .select('id, patient_id, template_id, status, requested_by_id, granted_by_id')
        .eq('clinic_id', req.profile.clinic_id);
      if (error) throw error;
      permissions = data || [];
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        console.warn('[db] falling back to local memory store for assessment permissions');
        permissions = Array.from(localPermissionsStore.values()).filter(p => p.clinic_id === req.profile.clinic_id);
      } else {
        throw dbErr;
      }
    }

    const latestSubmissions = dedupeLatestBy(
      subs || [],
      (s) => `${s.patient_id}:${s.template_id}`,
      ['updated_at', 'submitted_at', 'created_at'],
    );

    res.json({
      // Diagnostic counts (safe: numbers only) to trace directory filtering.
      meta: {
        restricted: restrictToAssessmentAssignments,
        roster: (roster || []).length,
        eligible: eligiblePatientIds.size,
        hasAssignments: hasExplicitAssignments,
      },
      tests: (tests || []).map((t) => ({
        id: t.id,
        code: t.document_type_code,
        title: t.title,
        desc: t.document_types ? t.document_types.description : '',
        duration: t.est_minutes ? `Est. ${t.est_minutes} mins` : '',
        icon: t.icon,
        active: t.is_active,
      })),
      sessions: inClinic(sessions || [], req.profile.clinic_id, req.profile, req.activeRoles).map((s) => ({
        id: s.id,
        label: `${name(s.patients)} (${new Date(s.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} Session)`,
      })),
      patients: (roster || []).filter((p) => eligiblePatientIds.has(p.id)).map((p) => ({
        id: p.id,
        patient_id: p.patient_id,
        name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        age: p.age || (p.date_of_birth ? ageFromDob(p.date_of_birth) : null) || null,
        sex: p.sex || null,
        date_of_birth: p.date_of_birth || null,
        clinical: Array.isArray(p.clinical_profiles) ? p.clinical_profiles[0] || null : p.clinical_profiles || null,
        treating_psychologist_id: p.treating_psychologist_id || null,
        treating_psychometrician_id: p.treating_psychometrician_id || null,
        treating_psychologist: p.treating_psychologist || null,
        admission_form_status: p.admission_form_status || null,
        waiver_submissions: p.waiver_submissions || [],
        assigned_template_ids: assignedTemplatesByPatient[p.id] || fallbackTemplateIds,
      })),
      permissions: permissions.map((ap) => ({
        id: ap.id,
        patient_id: ap.patient_id,
        template_id: ap.template_id,
        status: ap.status,
      })),
      employees: (employees || []).map((e) => ({
        id: e.id,
        name: `${e.display_name} (${e.role.replace('_', ' ').toUpperCase()})`,
      })),
      submissions: inClinic(latestSubmissions, req.profile.clinic_id, req.profile, req.activeRoles).map((s) => ({
        id: s.id,
        patient_id: s.patient_id,
        template_id: s.template_id,
        status: s.status,
        respondent_signature_image: s.respondent_signature_image || null,
        reviewer_comment: s.reviewer_comment || null,
        reviewer_signature_image: s.reviewer_signature_image || null,
        respondent_profile: s.respondent_profile || null,
        reviewer_profile: s.reviewer_profile || null,
        answers: s.answers,
        metadata: s.metadata || {},
        score: s.total_score !== null ? `${s.total_score}/${s.max_score}` : 'â€”',
        respondent: s.respondent_name
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/assessments/request-permission', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, template_id } = req.body || {};
    if (!patient_id || !template_id) return res.status(400).json({ error: 'Patient ID and Template ID are required' });

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
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
          requested_by_id: req.profile.id,
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clinic_id,patient_id,template_id' })
        .select('*')
        .single();
      if (error) throw error;
      await writeAudit({
        clinicId: pt.clinic_id,
        actorId: req.profile.id,
        action: 'request_assessment_permission',
        entityType: 'assessment_permission',
        entityId: data.id,
        summary: `${req.profile.display_name || 'Psychometrician'} requested assessment permission for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
      });
      res.json({ permission: data });
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        console.warn('[db] falling back to local memory store to request permission');
        const key = `${patient_id}_${template_id}`;
        const mockPerm = {
          id: require('crypto').randomUUID(),
          clinic_id: req.profile.clinic_id,
          patient_id,
          template_id,
          requested_by_id: req.profile.id,
          status: 'pending',
        };
        localPermissionsStore.set(key, mockPerm);
        await writeAudit({
          clinicId: pt.clinic_id,
          actorId: req.profile.id,
          action: 'request_assessment_permission',
          entityType: 'assessment_permission',
          entityId: mockPerm.id,
          summary: `${req.profile.display_name || 'Psychometrician'} requested assessment permission for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
        });
        res.json({ permission: mockPerm });
      } else {
        throw dbErr;
      }
    }
  } catch (err) {
    next(err);
  }
});

router.get('/data-review', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data, error } = await supabase
      .from('assessment_submissions')
      .select('id, status, flagged, submitted_at, created_at, respondent_name, respondent_relationship, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id), assessment_templates(title, document_type_code)')
      .order('created_at', { ascending: false });
    if (error) return next(error);
    const rows = inClinic(data, req.profile.clinic_id, req.profile, req.activeRoles);
    res.json({
      summary: {
        newSubmissions: rows.filter((r) => ['submitted', 'processed'].includes(r.status)).length,
        flagged: rows.filter((r) => r.flagged).length,
        approved: rows.filter((r) => r.status === 'scored').length,
      },
      rows: rows.map((r) => ({
        id: r.id,
        name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients?.patient_id || null,
        by: r.respondent_name || 'Caregiver',
        rel: r.respondent_relationship || '',
        date: r.submitted_at || r.created_at,
        status: r.status,
        flag: r.flagged,
        assessment_type: r.assessment_templates ? `${r.assessment_templates.title} (${r.assessment_templates.document_type_code})` : 'Self-Report Checklist',
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/reports', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data, error } = await supabase
      .from('assessment_reports')
      .select('id, title, status, completeness, report_type, updated_at, patients(id, first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))')
      .eq('report_type', 'behavioral')
      .order('updated_at', { ascending: false });
    if (error) return next(error);
    const rows = inClinic(data, req.profile.clinic_id, req.profile, req.activeRoles);
    res.json({
      summary: {
        inProgress: rows.filter((r) => ['draft', 'in_progress'].includes(r.status)).length,
        readyForReview: rows.filter((r) => r.status === 'ready_for_review').length,
      },
      drafts: rows.map((r) => ({
        id: r.id,
        name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients?.patient_id || null,
        status: r.status,
        completeness: r.completeness,
        updated_at: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/activity-logs', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let patientsQuery = supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, treating_psychologist_id, treating_psychometrician_id, admission_form_status, photo_url, waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    if (!roles.includes('admin')) {
      if (roles.includes('psychometrician')) {
        patientsQuery = patientsQuery.eq('treating_psychometrician_id', req.profile.id);
      } else if (roles.includes('psychologist')) {
        patientsQuery = patientsQuery.eq('treating_psychologist_id', req.profile.id);
      }
    }

    const sessionSelectVariants = [
      'id, patient_id, author_id, session_number, session_date, activity_title, target_domain, objectives, procedure, observations, status, created_at, updated_at, prepared_signature_image, prepared_signature_date, reviewed_by_id, reviewer_signature_image, reviewer_comment, reviewed_at, author:author_id(display_name, title, license_no), reviewer:reviewed_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      'id, patient_id, author_id, session_number, session_date, activity_title, target_domain, objectives, procedure, observations, status, created_at, updated_at, patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
    ];
    let sessionResult = null;
    for (const select of sessionSelectVariants) {
      sessionResult = await supabase
        .from('session_logs')
        .select(select)
        .order('updated_at', { ascending: false });
      if (!sessionResult.error) break;
      if (sessionResult.error.code !== '42703') break;
    }

    const [{ data: roster }] = await Promise.all([
      patientsQuery.order('first_name', { ascending: true }),
    ]);
    const { data, error } = sessionResult || {};
    if (error) return next(error);

    const rosterForRole = roles.includes('admin')
      ? roster
      : (roster || []).filter(complianceComplete);
    const eligiblePatientId = new Set((rosterForRole || []).map((p) => p.id));
    // One tracker entry per student per day — daily entries are submitted
    // and reviewed independently, with no limit on how many days are added.
    const latestRows = dedupeLatestBy(
      inClinic(data || [], req.profile.clinic_id, req.profile, req.activeRoles),
      (row) => `${row.patient_id}:${row.session_date}`,
      ['updated_at', 'created_at', 'session_date'],
    );
    const visibleRows = latestRows.filter((r) => eligiblePatientId.has(r.patient_id));

    res.json({
      rows: visibleRows.map((r) => ({
        id: r.id,
        patient_id: r.patient_id,
        name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients?.patient_id || null,
        date: r.session_date,
        session_number: r.session_number,
        detail: r.activity_title,
        target_domain: r.target_domain,
        objectives: r.objectives,
        procedure: r.procedure,
        observations: r.observations,
        status: r.status,
        prepared_signature_image: r.prepared_signature_image || null,
        prepared_signature_date: r.prepared_signature_date || null,
        reviewer_signature_image: r.reviewer_signature_image || null,
        reviewer_comment: r.reviewer_comment || null,
        reviewed_at: r.reviewed_at || null,
        prepared_profile: r.author || null,
        reviewer_profile: r.reviewer || null,
      })),
      patients: (rosterForRole || []).map((p) => ({
        id: p.id,
        patient_id: p.patient_id || null,
        name: patientName(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        admission_form_status: p.admission_form_status || null,
        waiver_submissions: p.waiver_submissions || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// create or update a session activity log (FO-07)
router.post('/activity-logs', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician')) {
      return res.status(403).json({ error: 'Only the assigned psychometrician can submit a DAR.' });
    }
    const {
      id,
      patient_id,
      session_number,
      session_date,
      activity_title,
      target_domain,
      objectives,
      procedure,
      observations,
      status,
      prepared_signature_image,
      prepared_signature_date,
    } = req.body || {};
    if (!patient_id) {
      return res.status(400).json({ error: 'Patient is required.' });
    }
    const nextStatus = status === 'revise_requested' ? 'revise_requested' : (status || 'draft');
    if (!['draft', 'pending', 'revise_requested'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status for DAR.' });
    }

    if (nextStatus === 'pending') {
      const validationError = validateDailyActivityPayload(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });
      if (!prepared_signature_image) {
        return res.status(400).json({ error: 'The psychometrician signature is required before sending the DAR.' });
      }
      if (!prepared_signature_date) {
        return res.status(400).json({ error: 'The psychometrician signature date is required before sending the DAR.' });
      }
    }

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    // Each day is its own DAR entry: match the same-day row so a new day
    // always starts a fresh entry instead of colliding with older ones.
    const entryDate = session_date || new Date().toISOString().slice(0, 10);
    let existing = null;
    if (id) {
      const { data, error } = await supabase
        .from('session_logs')
        .select('id, patient_id, status, session_date')
        .eq('id', id)
        .maybeSingle();
      if (error) return next(error);
      existing = data;
    } else {
      const { data, error } = await supabase
        .from('session_logs')
        .select('id, patient_id, status, session_date')
        .eq('patient_id', patient_id)
        .eq('session_date', entryDate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return next(error);
      existing = data;
    }

    if (existing && String(existing.patient_id) !== String(patient_id)) {
      return res.status(400).json({ error: 'The DAR does not belong to the selected student.' });
    }
    if (existing && !['draft', 'revise_requested'].includes(existing.status)) {
      return res.status(409).json({
        error:
          existing.status === 'pending'
            ? `The DAR for ${existing.session_date || entryDate} is already pending psychologist review.`
            : `The DAR for ${existing.session_date || entryDate} is complete and can no longer be changed.`,
      });
    }

    const payload = {
      patient_id,
      author_id: req.profile.id,
      session_number: session_number ? Number(session_number) : null,
      session_date: entryDate,
      activity_title: String(activity_title || 'Daily Activity Report').trim() || 'Daily Activity Report',
      target_domain: String(target_domain || '').trim(),
      objectives: String(objectives || '').trim(),
      procedure: String(procedure || '').trim(),
      observations: String(observations || '').trim(),
      status: nextStatus,
      prepared_signature_image: prepared_signature_image || null,
      prepared_signature_date: prepared_signature_date || null,
    };
    // A draft save (including autosave) on a returned DAR must NOT wipe the
    // psychologist's revision note — it stays until the RPm sends for review.
    // Only sending for review (pending) clears the review fields.
    if (nextStatus === 'pending') {
      payload.reviewed_by_id = null;
      payload.reviewer_signature_image = null;
      payload.reviewer_comment = null;
      payload.reviewed_at = null;
    } else if (existing?.status === 'revise_requested' || nextStatus === 'revise_requested') {
      payload.status = 'revise_requested';
    }

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('session_logs')
        .update(payload)
        .eq('id', existing.id)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('session_logs')
        .insert(payload)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    }

    if (result && nextStatus === 'pending') {
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
            title: 'Daily Activity Report submitted for review',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychometrician'} submitted the Daily Activity Report for ${patientName(pt)} (ID: ${pt.patient_id || 'N/A'}). Please review.`,
            link: `/psychologist/activity?patientId=${pt.id}`,
          }),
        ),
      );

      await writeAudit({
        clinicId: pt.clinic_id,
        actorId: req.profile.id,
        action: existing?.id
          ? 'resubmit_daily_activity_report'
          : 'submit_daily_activity_report',
        entityType: 'daily_activity_report',
        entityId: result.id,
        summary: `${capitalizeNamePart(req.profile.display_name) || 'Psychometrician'} sent the Daily Activity Report for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''} to the psychologist for review.`,
      });
    }

    res.status(existing?.id ? 200 : 201).json({ log: result });
  } catch (err) {
    next(err);
  }
});

// Delete a Daily Activity Report that is still a draft (or returned for
// revision). Reports already sent for review or approved are locked.
router.delete('/activity-logs/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the assigned psychometrician can delete a DAR.' });
    }
    const { data: existing, error: fetchError } = await supabase
      .from('session_logs')
      .select('id, patient_id, status, session_date, activity_title')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!existing) return res.status(404).json({ error: 'Daily Activity Report not found.' });
    if (!['draft', 'revise_requested'].includes(existing.status)) {
      return res.status(409).json({
        error: existing.status === 'pending'
          ? 'This DAR is pending psychologist review and can no longer be deleted.'
          : 'This DAR is complete and can no longer be deleted.',
      });
    }
    let pt;
    try {
      pt = await authorizePatient(existing.patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { error: deleteError } = await supabase
      .from('session_logs')
      .delete()
      .eq('id', existing.id);
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: 'delete_daily_activity_report',
      entityType: 'daily_activity_report',
      entityId: existing.id,
      summary: `${req.profile.display_name || 'Psychometrician'} deleted the Daily Activity Report (${existing.session_date || 'undated'}) for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// fetch a template's structure so the psychometrician can administer it
router.get('/assessment-templates/:templateId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: template, error } = await supabase
      .from('assessment_templates')
      .select('id, title, document_type_code, structure, max_score')
      .eq('id', req.params.templateId)
      .maybeSingle();
    if (error) return next(error);
    if (!template) return res.status(404).json({ error: 'Assessment not found' });
    res.json({
      template: {
        ...template,
        structure: structureForTemplate(template),
        max_score: template.document_type_code === 'CMPS:SE-FO-05' ? 3 : template.max_score,
      },
    });
  } catch (err) {
    next(err);
  }
});

// fetch the latest submission for a patient/template pair so the form can resume with the saved signature
router.get('/assessments/submission', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, template_id } = req.query || {};
    if (!patient_id || !template_id) {
      return res.status(400).json({ error: 'patient_id and template_id are required' });
    }

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const { data, error } = await supabase
      .from('assessment_submissions')
      .select(
        'id, patient_id, template_id, status, total_score, max_score, created_at, updated_at, respondent_name, respondent_signature_image, reviewer_comment, reviewer_signature_image, respondent_profile:respondent_profile_id(display_name, title, license_no), reviewer_profile:reviewed_by_id(display_name, title, license_no), answers, metadata, patients(clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      )
      .eq('patient_id', patient_id)
      .eq('template_id', template_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.json({ submission: null });
    if (data.patients?.clinic_id !== pt.clinic_id) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({
      submission: {
        id: data.id,
        patient_id: data.patient_id,
        template_id: data.template_id,
        status: data.status,
        total_score: data.total_score,
        max_score: data.max_score,
        created_at: data.created_at,
        updated_at: data.updated_at,
        respondent_name: data.respondent_name,
        respondent_signature_image: data.respondent_signature_image || null,
        reviewer_comment: data.reviewer_comment || null,
        reviewer_signature_image: data.reviewer_signature_image || null,
        respondent_profile: data.respondent_profile || null,
        reviewer_profile: data.reviewer_profile || null,
        answers: data.answers || {},
        metadata: data.metadata || {},
      },
    });
  } catch (err) {
    next(err);
  }
});

// record an assessment the psychometrician administered for a patient
router.post('/assessments/:templateId/submit', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const {
      patient_id,
      answers = {},
      metadata = {},
      respondent_signature_image,
      status,
    } = req.body || {};
    // NOTE: client-sent domain_scores / total_score / max_score are ignored —
    // scores are recomputed server-side below and are the only values saved.
    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const { data: template, error: tplErr } = await supabase
      .from('assessment_templates')
      .select('id, document_type_code, title, structure')
      .eq('id', req.params.templateId)
      .maybeSingle();
    if (tplErr) return next(tplErr);
    if (!template) return res.status(404).json({ error: 'Assessment not found' });

    const isDraft = status === 'draft';

    if (!isDraft && !respondent_signature_image) {
      return res.status(400).json({ error: 'Psychometrician signature is required before sending this assessment.' });
    }

    const assessmentStructure = structureForTemplate(template);
    if (!isDraft) {
      const incomplete = findIncompleteAssessmentItems(assessmentStructure, answers);
      if (incomplete.length > 0) {
        const first = incomplete[0];
        const firstLabel = first?.label && first.label !== 'Assessment item' ? first.label : 'an item';
        const firstDomain = first?.domain ? ` in "${first.domain}"` : '';
        const labels = incomplete.slice(0, 5).map((it) => it?.label).filter(Boolean);
        const detail = labels.length
          ? ` Unanswered: ${labels.join('; ')}${labels.length < incomplete.length ? ` (+${incomplete.length - labels.length} more)` : ''}.`
          : '';
        return res.status(400).json({
          error: `Please answer all assessment items before sending. ${incomplete.length} item${incomplete.length === 1 ? '' : 's'} still need a response (starting with "${firstLabel}"${firstDomain}).${detail}`,
        });
      }
      if (template.document_type_code === 'CMPS:SE-FO-05') {
        const missingMetadata = FO05_METADATA_FIELDS.find((field) => !String(metadata?.[field] || '').trim());
        if (missingMetadata) {
          return res.status(400).json({ error: 'Complete the date, student, age/gender, guardian, and assessor information before sending the assessment.' });
        }
      }
    }

    // Scores are server-authoritative: recompute totals AND domain subtotals
    // from the submitted answers so a tampered or stale client payload can
    // never reach the clinical record. Mirrors the encoder UI exactly
    // (FO-05 scores yes_no items only; other templates score every item).
    const isAdaptiveTemplate = template.document_type_code === 'CMPS:SE-FO-05';
    const serverTotals = scoreAssessment(assessmentStructure, answers);
    const serverDomainScores = {};
    for (const d of Array.isArray(assessmentStructure) ? assessmentStructure : []) {
      const items = Array.isArray(d?.items) ? d.items : [];
      if (!d?.key || items.length === 0) continue;
      const scoreItems = items.filter((it) => !isAdaptiveTemplate || it.response_type === 'yes_no' || !it.response_type);
      const score = scoreItems.filter((it) => String(responseValue(answers, it.key)).toLowerCase() === 'yes').length;
      serverDomainScores[d.key] = { score, max: scoreItems.length };
    }
    const scores = { total: serverTotals.total, max: serverTotals.max };
    const payload = {
      patient_id,
      template_id: req.params.templateId,
      respondent_profile_id: req.profile.id,
      respondent_name: req.profile.display_name,
      respondent_relationship: null,
      answers,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      domain_scores: serverDomainScores,
      total_score: scores.total,
      max_score: scores.max,
      status: isDraft ? 'draft' : 'submitted',
      submitted_at: isDraft ? null : new Date().toISOString(),
      respondent_signature_image: respondent_signature_image || null,
    };
    // A draft save (including autosave on close / preview) must NOT wipe the
    // psychologist's revision note — it stays until the RPm actually resubmits.
    // Only a real submit clears the review fields.
    if (!isDraft) {
      payload.reviewer_comment = null;
      payload.reviewer_signature_image = null;
      payload.reviewed_by_id = null;
      payload.reviewed_at = null;
    }

    const { data: existingSubmission, error: existingError } = await supabase
      .from('assessment_submissions')
      .select('id, status')
      .eq('patient_id', patient_id)
      .eq('template_id', req.params.templateId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return next(existingError);

    if (existingSubmission?.status && !['draft', 'revalidation'].includes(existingSubmission.status)) {
      return res.status(409).json({
        error: 'This assessment is already pending approval. Please wait until it is returned for revision before sending again.',
      });
    }

    // A draft save on a returned assessment keeps the revalidation status so
    // the badge and the psychologist's note survive refresh until resubmit.
    if (isDraft && existingSubmission?.status === 'revalidation') {
      payload.status = 'revalidation';
    }

    let data;
    if (existingSubmission?.id) {
      const { data: updated, error } = await supabase
        .from('assessment_submissions')
        .update(payload)
        .eq('id', existingSubmission.id)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      data = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('assessment_submissions')
        .insert(payload)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      data = inserted;
    }
    await supabase
      .from('assessment_assignments')
      .update({ status: 'submitted' })
      .eq('patient_id', patient_id)
      .eq('template_id', req.params.templateId)
      .in('status', ['assigned', 'in_progress']);

    // Notify only on a real submit — never for draft saves (manual Save,
    // auto-save, preview). Skip recipients that already hold the identical
    // unread notice (double-submit, retry) so the inbox doesn't flood.
    if (!isDraft) {
      const { data: psychologistProfiles } = pt.treating_psychologist_id
        ? await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', pt.treating_psychologist_id)
            .is('deleted_at', null)
        : await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('clinic_id', req.profile.clinic_id)
            .eq('role', 'psychologist')
            .is('deleted_at', null);

      const notifBody = `${capitalizeNamePart(req.profile.display_name) || 'The psychometrician'} submitted "${template.title || 'an assessment'}" for ${patientName(pt)} (ID: ${pt.patient_id || 'N/A'}). Please review and sign.`;
      await Promise.all(
        (psychologistProfiles || []).map(async (staff) => {
          const { data: dup } = await supabase
            .from('notifications')
            .select('id')
            .eq('recipient_id', staff.id)
            .eq('type', 'assessment')
            .eq('title', 'Assessment submitted for review')
            .eq('body', notifBody)
            .is('read_at', null)
            .limit(1)
            .maybeSingle();
          if (dup) return;
          await createNotification({
            clinicId: pt.clinic_id,
            recipientId: staff.id,
            type: 'assessment',
            title: 'Assessment submitted for review',
            body: notifBody,
            link: `/psychologist/approvals?patientId=${patient_id}&section=submissions&submissionId=${data.id}`,
          });
        }),
      );
    }

    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: existingSubmission?.id
        ? 'resubmit_standardized_assessment'
        : 'submit_standardized_assessment',
      entityType: 'assessment_submission',
      entityId: data.id,
      summary: `${capitalizeNamePart(req.profile.display_name) || 'Psychometrician'} sent ${template.title || 'a standardized assessment'} for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''} to the psychologist for review.`,
    });

    res.status(existingSubmission?.id ? 200 : 201).json({ submission: data });
  } catch (err) {
    next(err);
  }
});

// assign an assessment template to a patient (surfaces in the client portal)
router.post('/assignments', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, template_id, due_date, assigned_to_id } = req.body || {};
    if (!patient_id || !template_id) {
      return res.status(400).json({ error: 'patient_id and template_id are required' });
    }
    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { data, error } = await supabase
      .from('assessment_assignments')
      .insert({
        patient_id,
        template_id,
        assigned_by_id: req.profile.id,
        assigned_to_id: assigned_to_id || null,
        status: 'assigned',
        due_date: due_date || null,
      })
      .select('id')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    const { data: tpl } = await supabase
      .from('assessment_templates')
      .select('title')
      .eq('id', template_id)
      .maybeSingle();
    await createNotification({
      clinicId: pt.clinic_id,
      recipientId: pt.caregiver_id,
      type: 'assessment',
      title: 'New assessment assigned',
      body: `${tpl?.title || 'An assessment'} has been assigned for ${pt.first_name}.`,
      link: '/client/assessments',
      email: {
        subject: `New Assessment Assigned: ${pt.first_name} - ClearMind Clinic`,
      },
    });
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: 'assign_assessment',
      entityType: 'assessment_assignment',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Psychometrician'} assigned ${tpl?.title || 'an assessment'} to ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
    });
    res.status(201).json({ assignment: data });
  } catch (err) {
    next(err);
  }
});

// request that Admin activate (make available) an assessment template (feature #11)
router.post('/assessment-requests', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { template_id, note } = req.body || {};
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });

    const { data: tpl } = await supabase
      .from('assessment_templates')
      .select('id, title, is_active')
      .eq('id', template_id)
      .maybeSingle();
    if (!tpl) return res.status(404).json({ error: 'Assessment not found' });
    if (tpl.is_active) return res.status(409).json({ error: 'That assessment is already available' });

    const { data: existing } = await supabase
      .from('assessment_activation_requests')
      .select('id')
      .eq('template_id', template_id)
      .eq('clinic_id', req.profile.clinic_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'A request for this assessment is already pending' });

    const { data, error } = await supabase
      .from('assessment_activation_requests')
      .insert({
        clinic_id: req.profile.clinic_id,
        template_id,
        requested_by_id: req.profile.id,
        note: note || null,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('clinic_id', req.profile.clinic_id)
      .eq('role', 'admin')
      .is('deleted_at', null);
    await Promise.all(
      (admins || []).map((a) =>
        createNotification({
          clinicId: req.profile.clinic_id,
          recipientId: a.id,
          type: 'assessment',
          title: 'Assessment activation requested',
          body: `${capitalizeNamePart(req.profile.display_name) || 'A professional'} requested activation of "${tpl.title}" so it can be used for assessments.`,
          link: '/admin/assessments',
        }),
      ),
    );
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'request_assessment_activation',
      entityType: 'assessment_activation_request',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Psychometrician'} requested activation of ${tpl.title || 'an assessment template'}.`,
    });
    res.status(201).json({ request: data });
  } catch (err) {
    next(err);
  }
});

// mark a caregiver submission processed / flagged
router.patch('/submissions/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status, flagged } = req.body || {};
    const { data: sub } = await supabase
      .from('assessment_submissions')
      .select('id, patients(clinic_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!sub || !sub.patients || sub.patients.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const upd = {};
    if (status !== undefined) {
      if (!['submitted', 'processed', 'scored', 'flagged', 'draft', 'revalidation'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      upd.status = status;
      if (status === 'processed') upd.processed_by_id = req.profile.id;
    }
    if (flagged !== undefined) upd.flagged = Boolean(flagged);
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'Nothing to update' });
    const { error } = await supabase.from('assessment_submissions').update(upd).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: sub.patients.clinic_id,
      actorId: req.profile.id,
      action: 'update_assessment_submission',
      entityType: 'assessment_submission',
      entityId: sub.id,
      summary: `${req.profile.display_name || 'Psychometrician'} updated an assessment submission.`,
      severity: flagged ? 'warn' : 'info',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// update a report draft / submit it for psychologist review
router.patch('/reports/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { status, completeness, prepared_signature_image } = req.body || {};
    const { data: rep } = await supabase
      .from('assessment_reports')
      .select('id, status, patients(clinic_id)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!rep || !rep.patients || rep.patients.clinic_id !== req.profile.clinic_id) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (rep.status && !['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(rep.status)) {
      return res.status(409).json({ error: 'This report is no longer editable.' });
    }
    const upd = { prepared_by_id: req.profile.id };
    if (status !== undefined) {
      if (!['draft', 'in_progress', 'ready_for_review'].includes(status)) {
        return res.status(400).json({ error: 'A psychometrician can only set draft, in_progress, or ready_for_review' });
      }
      upd.status = status;
    }
    if (completeness !== undefined) {
      upd.completeness = Math.max(0, Math.min(100, Number(completeness) || 0));
    }
    if (prepared_signature_image !== undefined) {
      upd.prepared_signature_image = prepared_signature_image || null;
    }
    const { error } = await supabase.from('assessment_reports').update(upd).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: rep.patients.clinic_id,
      actorId: req.profile.id,
      action: status === 'ready_for_review' ? 'submit_report_for_review' : 'update_report',
      entityType: 'assessment_report',
      entityId: rep.id,
      summary: `${req.profile.display_name || 'Psychometrician'} ${status === 'ready_for_review' ? 'sent a report for psychologist review' : 'updated a report'}.`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// create or update a behavioral assessment report and route it to the psychologist
router.post('/reports', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const {
      id,
      patient_id,
      title,
      content,
      status,
      prepared_by_id,
      prepared_signature_image,
    } = req.body || {};

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient is required' });
    }
    if (status !== undefined && !['draft', 'in_progress', 'ready_for_review'].includes(status)) {
      return res.status(400).json({ error: 'A psychometrician can only set draft, in_progress, or ready_for_review' });
    }

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const { data: existingById, error: existingByIdError } = id
      ? await supabase
          .from('assessment_reports')
          .select('id, status, patient_id, report_type')
          .eq('id', id)
          .maybeSingle()
      : { data: null, error: null };
    if (existingByIdError) return next(existingByIdError);

    const { data: existingByPatient, error: existingByPatientError } = !existingById?.id
      ? await supabase
          .from('assessment_reports')
          .select('id, status, patient_id, report_type')
          .eq('patient_id', patient_id)
          .eq('report_type', 'behavioral')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };
    if (existingByPatientError) return next(existingByPatientError);

    const existingReport = existingById?.id ? existingById : existingByPatient;
    if (
      existingReport?.status &&
      !['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(existingReport.status)
    ) {
      return res.status(409).json({
        error: 'This behavioral report has already been sent. Wait for the psychologist to return it as draft before editing again.',
      });
    }

    const nextStatus = status || 'draft';
    if (nextStatus === 'ready_for_review' && !prepared_signature_image) {
      return res.status(400).json({ error: 'The psychometrician signature is required before sending this report.' });
    }

    let normalizedContent = null;
    try {
      normalizedContent = normalizeBehavioralReportContent(content);
    } catch {
      return res.status(400).json({ error: 'Behavioral report content must be a valid JSON object.' });
    }
    if (
      nextStatus === 'ready_for_review' &&
      (!normalizedContent ||
        typeof normalizedContent !== 'object' ||
        !normalizedContent.report_draft ||
        typeof normalizedContent.report_draft !== 'object')
    ) {
      return res.status(400).json({
        error: 'The completed behavioral report fields are required before sending.',
      });
    }

    const payload = {
      patient_id,
      report_type: 'behavioral',
      document_type_code: 'CMPS:SE-FO-06',
      title: title || 'Behavioral Assessment Report',
      content: normalizedContent,
      administered_tests: normalizedContent?.report_draft?.administeredTests || [],
      status: nextStatus,
      prepared_by_id: prepared_by_id || req.profile.id,
      prepared_signature_image: prepared_signature_image || null,
    };
    // A draft save on a returned report keeps the revision status so the
    // badge and the psychologist's note survive until the RPm resubmits.
    // 'revalidation' only exists on assessment_submissions — the reports-side
    // equivalent is 'revise_requested', so normalize it on write. Writing the
    // raw value (or even using it as a query literal) makes Postgres reject
    // the save with `invalid input value for enum report_status`.
    if (
      ['draft', 'in_progress'].includes(nextStatus) &&
      ['revalidation', 'revise_requested'].includes(existingReport?.status)
    ) {
      payload.status = existingReport.status === 'revalidation' ? 'revise_requested' : existingReport.status;
    }

    let result;
    if (existingReport?.id) {
      // Heal legacy rows stuck on the submissions-side status before the
      // guarded update below: the guard can only list valid report_status
      // values, so without this the row could never be saved again.
      if (existingReport.status === 'revalidation') {
        const { error: healError } = await supabase
          .from('assessment_reports')
          .update({ status: 'revise_requested' })
          .eq('id', existingReport.id);
        if (healError) return res.status(400).json({ error: friendlyDbError(healError) });
        existingReport.status = 'revise_requested';
      }
      // Same atomic guard as the IEP path above: a draft autosave racing a
      // Send must not silently revert a just-submitted report to draft.
      const { data, error } = await supabase
        .from('assessment_reports')
        .update(payload)
        .eq('id', existingReport.id)
        .in('status', ['draft', 'in_progress', 'revise_requested'])
        .select('id, status, updated_at')
        .maybeSingle();
      if (error) return res.status(400).json({ error: friendlyDbError(error) });
      if (!data) {
        return res.status(409).json({
          error: 'This report was just changed by another save. Reload to get the latest status, then try again.',
        });
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('assessment_reports')
        .insert(payload)
        .select('id, status, updated_at')
        .single();
      if (error) return res.status(400).json({ error: friendlyDbError(error) });
      result = data;
    }

    if (nextStatus === 'ready_for_review') {
      const { data: psychologistProfiles } = pt.treating_psychologist_id
        ? await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', pt.treating_psychologist_id)
            .is('deleted_at', null)
        : await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('clinic_id', req.profile.clinic_id)
            .eq('role', 'psychologist')
            .is('deleted_at', null);

      await Promise.all(
        (psychologistProfiles || []).map((staff) =>
          createNotification({
            clinicId: pt.clinic_id,
            recipientId: staff.id,
            type: 'report',
            title: 'Behavioral Report submitted for review',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychometrician'} submitted "${payload.title || 'a Behavioral Assessment Report'}" for ${patientName(pt)} (ID: ${pt.patient_id || 'N/A'}). Please review and sign.`,
            link: `/psychologist/approvals?patientId=${pt.id}&section=behavioral&reportId=${result.id}`,
          }),
        ),
      );
    }

    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action:
        nextStatus === 'ready_for_review'
          ? existingReport?.id
            ? 'resubmit_behavioral_assessment_report'
            : 'submit_behavioral_assessment_report'
          : existingReport?.id
            ? 'update_behavioral_assessment_report'
            : 'create_behavioral_assessment_report',
      entityType: 'behavioral_assessment_report',
      entityId: result.id,
      summary:
        nextStatus === 'ready_for_review'
          ? `${req.profile.display_name || 'Psychometrician'} sent ${payload.title} for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''} to the psychologist for review.`
          : `${req.profile.display_name || 'Psychometrician'} ${existingReport?.id ? 'updated' : 'created'} ${payload.title} for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
    });

    res.status(existingReport?.id ? 200 : 201).json({ report: result });
  } catch (err) {
    next(err);
  }
});

// Combined status ledger: Daily Activity Reports (session_logs) + Monthly
// Summary Progress reports (assessment_reports, progress_summary), each
// normalized to draft / submitted / approved.
const DAILY_STATUS = { draft: 'draft', pending: 'submitted', approved: 'approved' };
const PROGRESS_STATUS = {
  draft: 'draft',
  in_progress: 'draft',
  revalidation: 'revise_requested',
  revise_requested: 'revise_requested',
  ready_for_review: 'submitted',
  approved: 'approved',
  finalized: 'approved',
};

router.get('/drafting-reports', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let ptsQuery = supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, photo_url, waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    if (!roles.includes('admin')) {
      if (roles.includes('psychometrician')) {
        ptsQuery = ptsQuery.eq('treating_psychometrician_id', req.profile.id);
      } else if (roles.includes('psychologist')) {
        ptsQuery = ptsQuery.eq('treating_psychologist_id', req.profile.id);
      }
    }

    const behavioralResult = await fetchAssessmentReportsByType(
      'behavioral',
      [
        'id, patient_id, title, status, updated_at, content, prepared_signature_image, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
        'id, patient_id, title, status, updated_at, content, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
        'id, patient_id, title, status, updated_at, content, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(id, first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
      ],
      'updated_at',
      false,
    );

    const { data: behavioral, error: e2 } = behavioralResult;
    const { data: pts, error: e3 } = await ptsQuery.order('first_name');
    if (e2) return next(e2);
    if (e3) return next(e3);

    const latestBehavioral = dedupeLatestBy(
      inClinic((behavioral || []).map(normalizeAssessmentReport), req.profile.clinic_id, req.profile, req.activeRoles),
      (r) => r.patient_id || r.patients?.id,
      ['updated_at', 'created_at'],
    );

    const eligibleRows = roles.includes('admin')
      ? latestBehavioral
      : (latestBehavioral || []).filter((r) => complianceComplete(r.patients));
    const rows = eligibleRows.map((r) => ({
      id: r.id,
      patient_id: r.patients?.id || null,
      type: 'behavioral',
      typeLabel: 'Behavioral Assessment Report',
      name: name(r.patients),
      photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
      sid: r.patients?.patient_id || null,
      title: r.title || 'Behavioral Assessment Report',
      date: r.updated_at,
      status: PROGRESS_STATUS[r.status] || 'draft',
      content: r.content || null,
      prepared_signature_image: r.prepared_signature_image || null,
      reviewer_signature_image: r.reviewer_signature_image || null,
      reviewer_comment: r.reviewer_comment || null,
      prepared_profile: r.prepared_by || null,
      reviewer_profile: r.noted_by || null,
    })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const eligiblePts = roles.includes('admin') ? (pts || []) : (pts || []).filter(complianceComplete);
    res.json({
      summary: {
        draft: rows.filter((r) => ['draft', 'revise_requested'].includes(r.status)).length,
        submitted: rows.filter((r) => r.status === 'submitted').length,
        approved: rows.filter((r) => r.status === 'approved').length,
      },
      rows,
      patients: eligiblePts.map((p) => ({
        id: p.id,
        patient_id: p.patient_id,
        name: name(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        admission_form_status: p.admission_form_status || null,
        waiver_submissions: p.waiver_submissions || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Get patients list for dropdown
router.get('/patients', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let q = supabase
      .from('patients')
      .select('id, first_name, middle_name, last_name, patient_id, allow_journal_entry, treating_psychologist_id, treating_psychometrician_id, admission_form_status, photo_url, clinical_profiles(iep_level), waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    if (!roles.includes('admin')) {
      if (roles.includes('psychometrician')) {
        q = q.eq('treating_psychometrician_id', req.profile.id);
      } else if (roles.includes('psychologist')) {
        q = q.eq('treating_psychologist_id', req.profile.id);
      }
    }

    const { data: list, error } = await q.order('first_name', { ascending: true });
    if (error) return next(error);
    const visiblePatients = roles.includes('admin') ? list : (list || []).filter(complianceComplete);
    res.json({
      patients: (visiblePatients || []).map((p) => ({
        id: p.id,
        name: name(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        patient_id: p.patient_id,
        allow_journal_entry: p.allow_journal_entry || false,
        admission_form_status: p.admission_form_status,
        enrollment_type: p.clinical_profiles?.iep_level || null,
        waiver_submissions: p.waiver_submissions || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/patients/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let patient;
    try {
      patient = await authorizePatient(req.params.id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    const { data: caregiver } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('id', patient.caregiver_id)
      .maybeSingle();

    const [psychologistInfo, psychometricianInfo, guardiansInfo] = await Promise.all([
      patient.treating_psychologist_id
        ? supabase.from('profiles').select('id, display_name, license_no, title').eq('id', patient.treating_psychologist_id).maybeSingle()
        : Promise.resolve({ data: null }),
      patient.treating_psychometrician_id
        ? supabase.from('profiles').select('id, display_name, license_no, title').eq('id', patient.treating_psychometrician_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('guardians').select('id, full_name, relationship, is_primary').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
    ]);

    res.json({
      patient: dto.patientForStaff(patient, {
        full_name: patientName(patient),
        photo_url: patient.photo_url || null,
        age: ageFromDob(patient.date_of_birth),
        treating_psychologist: psychologistInfo?.data || null,
        treating_psychometrician: psychometricianInfo?.data || null,
        guardians: (guardiansInfo?.data || []).map(dto.guardianCard),
      }),
      caregiver: caregiver || null,
    });
  } catch (err) {
    next(err);
  }
});

// Get student journal logs for a patient
router.get('/student-journal/:patientId', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patientId } = req.params;
    
    // Verify patient assignment/clinic
    let patient;
    try {
      patient = await authorizePatient(patientId, req.profile);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    
    const { data: logs, error: lError } = await supabase
      .from('daily_activity_logs')
      .select('id, log_date, mood, task_completion, behavioral_episodes, sleep_quality, appetite, observations, audio_url, audio_duration_sec')
      .eq('patient_id', patientId)
      .order('log_date', { ascending: false });

    if (lError) return next(lError);

    // Signed playback URLs (service-role): staff browsers hold no Supabase
    // Auth session either, so direct signed-URL calls fail storage RLS.
    await Promise.all(
      (logs || []).map(async (log) => {
        const stored = log && typeof log.audio_url === 'string' ? log.audio_url : '';
        if (!stored.startsWith('journal-audio/')) return;
        try {
          const { data, error } = await supabase.storage
            .from('journal-audio')
            .createSignedUrl(stored.replace(/^journal-audio\//, ''), 3600);
          if (!error && data && data.signedUrl) log.audio_play_url = data.signedUrl;
          else if (error) console.error('[voice journal] signed URL failed:', error.message);
        } catch (err) {
          // leave this row without a playback URL
          console.error('[voice journal] signed URL failed:', err?.message || err);
        }
      })
    );

    res.json({ logs: logs || [], patientName: `${patient.first_name} ${patient.last_name}` });
  } catch (err) {
    next(err);
  }
});

router.patch('/journal-permission', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, allow_journal_entry } = req.body || {};
    if (!patient_id || typeof allow_journal_entry !== 'boolean') {
      return res.status(400).json({ error: 'patient_id and allow_journal_entry boolean are required' });
    }
    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    const { data, error } = await supabase
      .from('patients')
      .update({ allow_journal_entry })
      .eq('id', patient_id)
      .select('id, patient_id, first_name, last_name, allow_journal_entry')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Patient not found' });
    if (pt.caregiver_id) {
      const actorRole = req.profile?.role === 'psychologist' ? 'Psychologist' : 'Psychometrician';
      const journalTitle = allow_journal_entry ? 'Daily Journal access enabled' : 'Daily Journal access disabled';
      const journalBody = allow_journal_entry
        ? `Daily Journal access for ${patientName(pt)} is now enabled. You can submit and edit entries from the client portal.`
        : `Daily Journal access for ${patientName(pt)} has been disabled by the supervising ${actorRole}.`;
      await createNotification({
        clinicId: pt.clinic_id,
        recipientId: pt.caregiver_id,
        type: 'journal',
        title: journalTitle,
        body: journalBody,
        link: '/client/activity',
        email: {
          subject: `${journalTitle}: ${patientName(pt)} - ClearMind Clinic`,
        },
      });
    }
    await writeAudit({
      clinicId: pt.clinic_id,
      actorId: req.profile.id,
      action: allow_journal_entry ? 'enable_student_journal' : 'disable_student_journal',
      entityType: 'patient',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Psychometrician'} ${allow_journal_entry ? 'enabled' : 'disabled'} Daily Journal access for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
      severity: allow_journal_entry ? 'info' : 'warn',
    });
    res.json({ patient: data });
  } catch (err) {
    next(err);
  }
});

router.get('/iep', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let ptsQuery = supabase
      .from('patients')
      .select('id, patient_id, first_name, middle_name, last_name, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, photo_url, waiver_submissions(id, document_type_code, status)')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    const roles = req.activeRoles;
    if (!roles.includes('admin')) {
      if (roles.includes('psychometrician')) {
        ptsQuery = ptsQuery.eq('treating_psychometrician_id', req.profile.id);
      } else if (roles.includes('psychologist')) {
        ptsQuery = ptsQuery.eq('treating_psychologist_id', req.profile.id);
      }
    }

    const [iepResult, ptsResult] = await Promise.all([
      fetchIepReportsWithFallback(
        [
          'id, title, status, period, updated_at, finalized_at, content, patient_id, noted_by_id, prepared_by_id, prepared_signature_image, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
          'id, title, status, updated_at, content, patient_id, noted_by_id, prepared_by_id, reviewer_signature_image, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
          'id, title, status, updated_at, content, patient_id, noted_by_id, prepared_by_id, reviewer_comment, prepared_by:prepared_by_id(display_name, title, license_no), noted_by:noted_by_id(display_name, title, license_no), patients(first_name, middle_name, last_name, patient_id, photo_url, clinic_id, treating_psychologist_id, treating_psychometrician_id, admission_form_status, waiver_submissions(id, document_type_code, status))',
        ],
        'updated_at',
        false,
      ),
      ptsQuery.order('first_name'),
    ]);
    const { data: ieps, error: e2, reportTypeUsed } = iepResult;
    const { data: pts, error: e3 } = ptsResult;
    if (e2) return next(e2);
    if (e3) return next(e3);

    const compliantPts = roles.includes('admin')
      ? (pts || [])
      : (pts || []).filter(complianceComplete);
    const eligiblePatientId = new Set((compliantPts || []).map((p) => p.id));
    // One tracker row per student per month (period). Months are submitted
    // and reviewed independently.
    const iepRows = dedupeLatestBy(
      (ieps || []).filter((r) => (reportTypeUsed === 'iep' ? true : IEP_TITLE_RE.test(r.title || ''))),
      (r) => `${r.patient_id}:${r.period || 'Month 1'}:iep`,
      ['updated_at', 'created_at'],
    );
    const visibleRows = inClinic(iepRows, req.profile.clinic_id, req.profile, req.activeRoles)
      .filter((r) => eligiblePatientId.has(r.patient_id));

    res.json({
      rows: visibleRows.map((r) => ({
        id: r.id,
        type: 'iep',
        name: name(r.patients),
        photo_url: r.patients?.photo_url || r.patients?.patients?.photo_url || null,
        sid: r.patients?.patient_id || null,
        title: r.title || 'SPED Individualized Educational Plan',
        date: r.updated_at,
        finalized_at: r.finalized_at || null,
        period: r.period || 'Month 1',
        status: r.status,
        content: r.content,
        patient_id: r.patient_id,
        report_type: 'iep',
        prepared_signature_image: r.prepared_signature_image || null,
        reviewer_signature_image: r.reviewer_signature_image || null,
        reviewer_comment: r.reviewer_comment || null,
        prepared_profile: r.prepared_by || null,
        reviewer_profile: r.noted_by || null,
      })),
      patients: (compliantPts || []).map((p) => ({
        id: p.id,
        patient_id: p.patient_id || null,
        name: name(p),
        photo_url: p.photo_url || p.patients?.photo_url || null,
        admission_form_status: p.admission_form_status || null,
        waiver_submissions: p.waiver_submissions || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/iep', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the assigned psychometrician can submit an IEP.' });
    }

    const {
      id,
      patient_id,
      title,
      status,
      content,
      prepared_signature_image,
    } = req.body || {};
    if (!patient_id || !title) return res.status(400).json({ error: 'Patient and title are required' });
    // Each month is its own IEP entry with its own review tracker.
    const period = String(req.body?.period || 'Month 1').trim().slice(0, 40) || 'Month 1';
    const nextStatus = status === 'revise_requested' ? 'revise_requested' : (status || 'draft');
    if (!['draft', 'in_progress', 'ready_for_review', 'revise_requested'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status for IEP.' });
    }

    if (nextStatus === 'ready_for_review') {
      if (!prepared_signature_image) {
        return res.status(400).json({ error: 'The psychometrician signature is required before sending the IEP.' });
      }
      const incompleteField = findIncompleteIepField(content);
      if (incompleteField) {
        return res.status(400).json({ error: `Please complete ${incompleteField} before sending the IEP.` });
      }
    }
    if (hasOverlongIepText(parseIepContent(content))) {
      return res.status(400).json({ error: 'IEP text fields are limited to 400 characters.' });
    }

    let pt;
    try {
      pt = await authorizePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }

    let existingReport = null;
    let usingLegacyType = false;

    if (id) {
      const { data, error } = await supabase
        .from('assessment_reports')
        .select('id, patient_id, report_type, title, status')
        .eq('id', id)
        .maybeSingle();
      if (error) return next(error);
      existingReport = data;
    } else {
      let existingResult = await supabase
        .from('assessment_reports')
        .select('id, patient_id, report_type, title, status, period')
        .eq('patient_id', patient_id)
        .eq('report_type', 'iep')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (existingResult.error?.code === '22P02') {
        usingLegacyType = true;
        const legacyResult = await supabase
          .from('assessment_reports')
          .select('id, patient_id, report_type, title, status')
          .eq('patient_id', patient_id)
          .eq('report_type', 'progress_summary')
          .or('title.ilike.%Individualized Education Plan%,title.ilike.%Individualized Educational Plan%,title.ilike.%IEP%')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (legacyResult.error) return next(legacyResult.error);
        if (legacyResult.data) {
          usingLegacyType = true;
          existingReport = legacyResult.data;
        }
      } else {
        if (existingResult.error) return next(existingResult.error);
        // Match the requested month; rows without a period are Month 1.
        existingReport = ((existingResult.data || []).find(
          (r) => (r.period || 'Month 1') === period
        )) || null;
      }
      if (!existingReport) existingReport = null;
    }

    // Legacy pre-period rows only stand in for Month 1; later months always
    // start a fresh entry.
    if (usingLegacyType && period !== 'Month 1') existingReport = null;
    if (existingReport && String(existingReport.patient_id) !== String(patient_id)) {
      return res.status(400).json({ error: 'The IEP does not belong to the selected student.' });
    }
    if (existingReport && !IEP_TITLE_RE.test(existingReport.title || '') && existingReport.report_type !== 'iep') {
      return res.status(400).json({ error: 'The selected record is not an IEP.' });
    }
    if (existingReport && !['draft', 'in_progress', 'revise_requested'].includes(existingReport.status)) {
      return res.status(409).json({
        error:
          existingReport.status === 'ready_for_review'
            ? `This IEP (${period}) is already pending psychologist review.`
            : `This IEP (${period}) is complete and can no longer be changed.`,
      });
    }

    const payload = {
      patient_id,
      title,
      period,
      document_type_code: 'CMPS:SE-FO-10',
      status: nextStatus,
      content: stringifyIepContent(content),
      prepared_by_id: req.profile.id,
      prepared_signature_image: prepared_signature_image || null,
      reviewer_signature_image: null,
      reviewer_comment: null,
      noted_by_id: null,
      finalized_at: null,
    };

    let result;
    if (existingReport?.id) {
      // Atomic guard: only overwrite while the row is still editable. The
      // status check above is check-then-act — a draft autosave racing a
      // Send both passed it, and the draft committing last silently
      // reverted a just-submitted IEP to draft with zero audit trace.
      const { data, error } = await supabase
        .from('assessment_reports')
        .update(payload)
        .eq('id', existingReport.id)
        .in('status', ['draft', 'in_progress', 'revise_requested'])
        .select('id, status')
        .maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      if (!data) {
        return res.status(409).json({
          error:
            nextStatus === 'ready_for_review'
              ? 'This IEP was just changed by another save. Reload to get the latest status, then send again.'
              : 'This IEP is no longer editable. Reload to get the latest status.',
        });
      }
      result = data;
    } else {
      let insertResult = await supabase
        .from('assessment_reports')
        .insert({
          ...payload,
          report_type: usingLegacyType ? 'progress_summary' : 'iep',
        })
        .select('id, status')
        .single();

      if (insertResult.error?.code === '22P02') {
        insertResult = await supabase
          .from('assessment_reports')
          .insert({
            ...payload,
            report_type: 'progress_summary',
          })
          .select('id, status')
          .single();
      }
      if (insertResult.error?.code === '42703' && insertResult.error.message?.includes('period')) {
        // Migration 0099 not applied yet — save without the month label.
        const { period: _droppedPeriod, ...legacyPayload } = payload;
        insertResult = await supabase
          .from('assessment_reports')
          .insert({
            ...legacyPayload,
            report_type: usingLegacyType ? 'progress_summary' : 'iep',
          })
          .select('id, status')
          .single();
      }
      if (insertResult.error) return res.status(400).json({ error: insertResult.error.message });
      result = insertResult.data;
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
            title: 'IEP submitted for review',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The psychometrician'} submitted "${title || 'the IEP'}" for ${patientName(pt)} (ID: ${pt.patient_id || 'N/A'}). Please review and sign.`,
            link: `/psychologist/approvals?patientId=${pt.id}&section=iep&reportId=${result.id}`,
          }),
        ),
      );

      await writeAudit({
        clinicId: pt.clinic_id,
        actorId: req.profile.id,
        action: existingReport?.id ? 'resubmit_iep' : 'submit_iep',
        entityType: 'iep',
        entityId: result.id,
        summary: `${req.profile.display_name || 'Psychometrician'} sent ${title || 'the IEP'} (${period}) for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''} to the psychologist for review.`,
      });
    }

    res.json({ iep: result, report: result });
  } catch (err) {
    next(err);
  }
});

// Delete an IEP plan that is still a draft (or returned for revision).
// Plans already sent for review or approved are locked — return them for
// revision first. Scoped to the assigned psychometrician (or admin).
router.delete('/iep/:id', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const roles = req.activeRoles;
    if (!roles.includes('psychometrician') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the assigned psychometrician can delete an IEP.' });
    }
    const { data: existing, error: fetchError } = await supabase
      .from('assessment_reports')
      .select('id, patient_id, report_type, title, status, period')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return next(fetchError);
    if (!existing) return res.status(404).json({ error: 'IEP not found.' });
    if (existing.report_type !== 'iep' && !IEP_TITLE_RE.test(existing.title || '')) {
      return res.status(400).json({ error: 'The selected record is not an IEP.' });
    }
    if (!['draft', 'in_progress', 'revise_requested'].includes(existing.status)) {
      return res.status(409).json({
        error: existing.status === 'ready_for_review'
          ? 'This IEP is pending psychologist review and can no longer be deleted.'
          : 'This IEP is complete and can no longer be deleted.',
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
      action: 'delete_iep',
      entityType: 'iep',
      entityId: existing.id,
      summary: `${req.profile.display_name || 'Psychometrician'} deleted ${existing.title || 'the IEP'} (${existing.period || 'unspecified period'}) for ${patientName(pt)}${pt.patient_id ? ` (${pt.patient_id})` : ''}.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Attendance & Session Records (FO-11) ----------
// Same Supabase tables as the admin endpoints, so psychometrician edits
// reflect immediately on the admin / super admin side. Reads and writes are
// scoped to students assigned to the caller (treating_psychometrician_id)
// unless the caller also holds an admin role. Every write notifies all
// admins in the clinic.
async function authorizeAttendancePatient(patientId, profile, activeRoles) {
  return authorizePatient(patientId, profile, activeRoles);
}

function isMissingAttendanceColumn(error, columnName) {
  if (!error || !columnName) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes(columnName.toLowerCase()) &&
    (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'))
  );
}

async function notifyAdminsOfAttendanceChange({ profile, patient, monthYear, action }) {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('clinic_id', profile.clinic_id)
      .in('role', ['admin', 'super_admin'])
      .is('deleted_at', null);
    const studentLabel = `${patientName(patient)}${patient.patient_id ? ` (${patient.patient_id})` : ''}`;
    const verb = action === 'deleted' ? 'deleted' : action === 'created' ? 'created' : action === 'finalized' ? 'finalized' : action === 'reopened' ? 'reopened' : 'updated';
    await Promise.all(
      (admins || [])
        .filter((admin) => admin.id !== profile.id)
        .map((admin) =>
          createNotification({
            clinicId: profile.clinic_id,
            recipientId: admin.id,
            type: 'attendance',
            title: `Attendance record ${verb}`,
            body: `${capitalizeNamePart(profile.display_name) || 'The psychometrician'} ${verb} the Attendance & Session Record for ${studentLabel} for ${monthYear}.`,
            link: '/admin/attendance',
          }),
        ),
    );
  } catch (notifyError) {
    console.error('[attendance] failed to notify admins:', notifyError.message);
  }
}

async function loadAttendancePdfBundle(patientId, clinicId) {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*, photo_url')
    .eq('id', patientId)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();
  if (patientError) throw patientError;
  if (!patient) return null;
  const [{ data: clinical }, { data: guardians }, { data: emergency }] = await Promise.all([
    supabase.from('clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
    supabase.from('guardians').select('*').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
    supabase.from('emergency_contacts').select('*').eq('patient_id', patient.id).limit(1).maybeSingle(),
  ]);
  const profileIds = [patient.treating_psychologist_id, patient.treating_psychometrician_id].filter(Boolean);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, middle_name, last_name, phone, license_no, title')
    .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return {
    patient: {
      ...patient,
      full_name: patientName(patient),
      photo_url: patient.photo_url || null,
      treating_psychologist: profileById[patient.treating_psychologist_id] || null,
      treating_psychometrician: profileById[patient.treating_psychometrician_id] || null,
    },
    clinical: clinical || {},
    guardians: guardians || [],
    emergency: emergency || {},
  };
}

router.get('/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year } = req.query || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    let patient;
    try {
      patient = await authorizeAttendancePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
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
    if (!form) return res.json({ form: null, attendance: [], sessions: [] });

    const [{ data: attendance, error: attErr }, { data: sessions, error: sessErr }] = await Promise.all([
      supabase.from('student_attendance_records').select('*').eq('form_id', form.id).order('date', { ascending: true }),
      supabase.from('student_session_records').select('*').eq('form_id', form.id).order('date', { ascending: true }),
    ]);
    if (attErr) return next(attErr);
    if (sessErr) return next(sessErr);
    res.json({ form, attendance, sessions });
  } catch (err) {
    next(err);
  }
});

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
    let patient;
    try {
      patient = await authorizeAttendancePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    if (!patient) return res.status(404).json({ error: 'Student not found.' });
    if (!Array.isArray(attendance) || !Array.isArray(sessions)) {
      return res.status(400).json({ error: 'attendance and sessions must be arrays' });
    }
    const invalidAttendance = attendance.find((row) => !['Present', 'Absent', 'Excused'].includes(row.status));
    if (invalidAttendance) {
      return res.status(400).json({ error: 'Attendance status must be Present, Absent, or Excused.' });
    }

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
      ({ error: updateErr } = await supabase.from('student_attendance_session_forms').update(baseFormPayload).eq('id', formId));
      if (isMissingAttendanceColumn(updateErr, 'facilitator_name')) {
        const legacyPayload = { ...baseFormPayload };
        delete legacyPayload.facilitator_name;
        ({ error: updateErr } = await supabase.from('student_attendance_session_forms').update(legacyPayload).eq('id', formId));
        facilitatorNameStored = false;
      }
      if (updateErr) return next(updateErr);
    } else {
      let newForm = null;
      let insertErr = null;
      ({ data: newForm, error: insertErr } = await supabase.from('student_attendance_session_forms').insert(baseFormPayload).select('id').single());
      if (isMissingAttendanceColumn(insertErr, 'facilitator_name')) {
        const legacyPayload = { ...baseFormPayload };
        delete legacyPayload.facilitator_name;
        ({ data: newForm, error: insertErr } = await supabase.from('student_attendance_session_forms').insert(legacyPayload).select('id').single());
        facilitatorNameStored = false;
      }
      if (insertErr) return next(insertErr);
      formId = newForm.id;
    }

    const { error: delAttErr } = await supabase.from('student_attendance_records').delete().eq('form_id', formId);
    if (delAttErr) return next(delAttErr);
    if (attendance.length > 0) {
      const { error: insAttErr } = await supabase.from('student_attendance_records').insert(
        attendance.map((r) => ({
          form_id: formId,
          date: r.date,
          status: r.status,
          time_in: r.time_in || r.timeIn || null,
          time_out: r.time_out || r.timeOut || null,
          remarks: r.remarks || null,
        })),
      );
      if (insAttErr) return next(insAttErr);
    }

    const { error: delSessErr } = await supabase.from('student_session_records').delete().eq('form_id', formId);
    if (delSessErr) return next(delSessErr);
    if (sessions.length > 0) {
      const { error: insSessErr } = await supabase.from('student_session_records').insert(
        sessions.map((r) => ({
          form_id: formId,
          date: r.date,
          domain: r.domain || null,
          activity: r.activity || null,
          assistance: r.assistance || null,
          prompts: r.prompts || null,
          cues: r.cues || null,
          prodding: r.prodding || null,
          notes: r.notes || null,
        })),
      );
      if (insSessErr) return next(insSessErr);
    }

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: existingForm ? 'update_attendance_record' : 'create_attendance_record',
      entityType: 'attendance_session_form',
      entityId: formId,
      summary: `${req.profile.display_name || 'Psychometrician'} ${existingForm ? 'updated' : 'created'} the attendance and session record for ${month_year}.`,
    });

    await notifyAdminsOfAttendanceChange({
      profile: req.profile,
      patient,
      monthYear: month_year,
      action: existingForm ? 'updated' : 'created',
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
    let patient;
    try {
      patient = await authorizeAttendancePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
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
      if (isMissingAttendanceColumn(updErr, 'is_finalized')) {
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
      summary: `${req.profile.display_name || 'Psychometrician'} ${wantFinalized ? 'finalized' : 'reopened'} the attendance and session record for ${patientName(patient)} for ${month_year}.`,
    });

    await notifyAdminsOfAttendanceChange({
      profile: req.profile,
      patient,
      monthYear: month_year,
      action: wantFinalized ? 'finalized' : 'reopened',
    });

    res.json({ ok: true, is_finalized: wantFinalized });
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
    let patient;
    try {
      patient = await authorizeAttendancePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
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
      summary: `${req.profile.display_name || 'Psychometrician'} deleted the attendance and session record for ${patientName(patient)} for ${month_year}.`,
      severity: 'warn',
    });

    await notifyAdminsOfAttendanceChange({ profile: req.profile, patient, monthYear: month_year, action: 'deleted' });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/pdf/attendance-session-forms', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient_id, month_year } = req.query || {};
    if (!patient_id || !month_year) {
      return res.status(400).json({ error: 'patient_id and month_year are required' });
    }
    let patient;
    try {
      patient = await authorizeAttendancePatient(patient_id, req.profile, req.activeRoles);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
    if (!patient) return res.status(404).json({ error: 'Student not found.' });

    const [{ data: form, error: formError }, { data: attendance, error: attendanceError }] = await Promise.all([
      supabase.from('student_attendance_session_forms').select('*').eq('patient_id', patient_id).eq('month_year', month_year).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('student_attendance_records').select('*, student_attendance_session_forms!inner(patient_id, month_year)').eq('student_attendance_session_forms.patient_id', patient_id).eq('student_attendance_session_forms.month_year', month_year).order('date', { ascending: true }),
    ]);
    if (formError) return next(formError);
    if (attendanceError) return next(attendanceError);

    const attendanceForm = form || {
      patient_id,
      month_year,
      program_enrolled: '',
      facilitator_name: '',
      facilitator_signature: null,
      signoff_date: null,
      additional_notes: '',
    };
    const { data: sessions, error: sessionsError } = attendanceForm.id
      ? await supabase.from('student_session_records').select('*').eq('form_id', attendanceForm.id).order('date', { ascending: true })
      : { data: [], error: null };
    if (sessionsError) return next(sessionsError);

    const bundle = await loadAttendancePdfBundle(patient.id, req.profile.clinic_id);
    if (!bundle) return res.status(404).json({ error: 'Student not found.' });
    const bytes = await renderAttendancePdf({
      bundle,
      form: attendanceForm,
      attendance: (attendance || []).map(({ student_attendance_session_forms: _form, ...row }) => row),
      sessions: sessions || [],
      monthYear: month_year,
      hideSignatures: hideSignaturesFor(req),
      requestingUser: req.profile,
    });
    const studentId = bundle.patient.patient_id || bundle.patient.id;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${String(studentId).replace(/[^a-z0-9._-]+/gi, '_')}-CMPS-SE-FO-11.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(bytes);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
