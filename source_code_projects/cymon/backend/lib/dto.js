// Response DTOs — whitelisting mappers for every HTTP response that carries
// patient, clinical, guardian, emergency-contact, or mood-series data.
//
// Why this file exists: several endpoints used to `{ ...row }`-spread raw
// `select('*')` rows into res.json. That silently exposes any column a future
// migration adds. These mappers pick an explicit, reviewed field list per
// audience, so the response contract only changes when someone edits it here
// on purpose (and updates tests/dto.test.js alongside).
//
// Role x field matrix:
//   Client (caregiver) sees: the child's demographics and signature data the
//     profile/waiver flows need, plus the clinical fields shown on MyProfile
//     (complaint, diagnoses, allergies, IEP level, enrollment/review dates).
//     The clinic representative's counter-signature (rep_signature) is
//     included read-only: it belongs to the family's own executed admission
//     document, which the admission view renders from the patient record.
//     Never: linkage ids (caregiver_id, clinic_id), workflow/auth-adjacent
//     flags (status, delivery_method, force_password_change), other
//     staff-side signature metadata (rep_printed_name, rep_profession,
//     rep_license_no), or bookkeeping timestamps.
//   Staff (admin/psychologist/psychometrician) sees: everything the client
//     sees, plus linkage ids, workflow flags, and the full clinical record
//     (notes, scores, support/milestone) needed for care and official PDFs.
//     Never: credential-adjacent flags (force_password_change) or
//     soft-delete/bookkeeping timestamps.
// PDF bundles (loadStaffPdfRecord and friends) intentionally keep full rows:
// they never leave the server as JSON — the governed artifact is the signed
// PDF produced under the document-release workflow.

function pick(row, keys) {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  for (const key of keys) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

// Shown on the client profile, waiver prefill, and layout header.
const PATIENT_CLIENT_KEYS = [
  'id',
  'patient_id',
  'first_name',
  'middle_name',
  'last_name',
  'nick_name',
  'name_suffix',
  'date_of_birth',
  'sex',
  'place_of_birth',
  'citizenship',
  'religion',
  'contact_number',
  'home_address',
  'permanent_address',
  'photo_url',
  'school',
  'grade_level',
  'admission_form_status',
  'allow_journal_entry',
  // The family's own Yes/No answers about prior diagnosis — needed so
  // assessment forms can pre-select Yes/No and show the recorded diagnosis
  // (or "None"). Not linkage or auth data, so safe for the caregiver.
  'previously_diagnosed',
  'other_disability',
  'parent_signature',
  'parent_printed_name',
  'rep_signature',
  'created_at',
];

// Everything above, plus linkage ids, workflow flags, and staff-side
// signature metadata needed for admission and onsite flows.
const PATIENT_STAFF_KEYS = [
  ...PATIENT_CLIENT_KEYS,
  'caregiver_id',
  'clinic_id',
  'status',
  'treating_psychologist_id',
  'treating_psychometrician_id',
  // Nested clinical profile (working_diagnosis, etc.): staff forms prefill
  // Diagnosis from it. It was fetched but stripped here, so every staff
  // form's Diagnosis field loaded empty despite the record existing.
  'clinical_profiles',
  'previously_diagnosed',
  'other_disability',
  'delivery_method',
  'rep_printed_name',
  'rep_profession',
  'rep_license_no',
  'rep_signature',
  'admission_scan_url',
];

// Shown on the client MyProfile page.
const CLINICAL_CLIENT_KEYS = [
  'chief_complaint',
  'working_diagnosis',
  'primary_diagnosis',
  'secondary_diagnosis',
  'allergies',
  'iep_level',
  'date_enrolled',
  'last_assessment_at',
  'next_review_at',
];

// Full clinical record for staff care flows. Explicit (not *) so a future
// column stays server-side until it is reviewed into this list.
const CLINICAL_STAFF_KEYS = [
  'patient_id',
  'primary_diagnosis',
  'iep_level',
  'secondary_diagnosis',
  'treating_psychologist_id',
  'treating_psychometrician_id',
  'date_enrolled',
  'referral_source',
  'last_assessment_at',
  'next_review_at',
  'gars3_gai_score',
  'gars3_label',
  'notes',
  'support_level',
  'milestone_progress',
  'chief_complaint',
  'working_diagnosis',
  'prior_diagnosis',
  'prior_physician',
  'prior_institution',
  'allergies',
];

const GUARDIAN_KEYS = [
  'id',
  'full_name',
  'relationship',
  'contact_number',
  'email',
  'occupation',
  'employer',
  'is_primary',
  'photo_url',
];

const EMERGENCY_KEYS = [
  'id',
  'full_name',
  'relationship',
  'contact_number',
  'alt_contact_number',
  'address',
];

// `extras` carries computed values (full_name, age, photo fallbacks,
// treating-staff objects) and wins over picked columns.
function patientForClient(row, extras = {}) {
  return { ...pick(row, PATIENT_CLIENT_KEYS), ...extras };
}

function patientForStaff(row, extras = {}) {
  return { ...pick(row, PATIENT_STAFF_KEYS), ...extras };
}

function clinicalForClient(row, extras = {}) {
  return { ...pick(row, CLINICAL_CLIENT_KEYS), ...extras };
}

function clinicalForStaff(row, extras = {}) {
  return { ...pick(row, CLINICAL_STAFF_KEYS), ...extras };
}

function guardianCard(row) {
  return pick(row, GUARDIAN_KEYS);
}

function emergencyCard(row) {
  return pick(row, EMERGENCY_KEYS);
}

// Mood chart points shared by /home (`value`) and /activity-logs (`score`).
// scoreOf maps a mood id to its numeric score; the key name is the only
// thing that differs between the two endpoints, so it is a parameter.
function moodSeriesPoints(logs, valueKey, scoreOf) {
  return (logs || []).map((log) => ({
    date: log.log_date,
    [valueKey]: scoreOf(log.mood),
  }));
}

module.exports = {
  PATIENT_CLIENT_KEYS,
  PATIENT_STAFF_KEYS,
  CLINICAL_CLIENT_KEYS,
  CLINICAL_STAFF_KEYS,
  GUARDIAN_KEYS,
  EMERGENCY_KEYS,
  patientForClient,
  patientForStaff,
  clinicalForClient,
  clinicalForStaff,
  guardianCard,
  emergencyCard,
  moodSeriesPoints,
};
