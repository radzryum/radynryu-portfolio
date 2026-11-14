// DTO contract tests — run with `npm test` (node --test, no dependencies).
// These assert the EXACT response key sets per audience. If a migration adds
// a column, these tests still pass (fail-closed: new columns stay
// server-side). If someone edits lib/dto.js whitelists, these tests force
// the change to be deliberate and reviewed here.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dto = require('../lib/dto');

const sortedKeys = (obj) => Object.keys(obj).sort();

// A fat row simulating `select('*')` AFTER a hypothetical future migration
// adds sensitive columns. Nothing outside the whitelist may leak.
const FAT_PATIENT = {
  id: 'p1',
  patient_id: 'CMPS-2026-001',
  clinic_id: 'c1',
  caregiver_id: 'g1',
  first_name: 'Ana',
  middle_name: 'B',
  last_name: 'Cruz',
  nick_name: 'Annie',
  name_suffix: null,
  date_of_birth: '2018-01-01',
  sex: 'female',
  place_of_birth: 'Manila',
  citizenship: 'Filipino',
  religion: null,
  contact_number: '0917',
  home_address: 'A St',
  permanent_address: null,
  photo_url: null,
  school: 'S',
  grade_level: '1',
  admission_form_status: 'complete',
  allow_journal_entry: true,
  parent_signature: 'ink',
  parent_printed_name: 'Ana C',
  status: 'active',
  treating_psychologist_id: 't1',
  treating_psychometrician_id: 't2',
  previously_diagnosed: false,
  other_disability: false,
  delivery_method: 'email',
  rep_printed_name: 'R',
  rep_profession: 'P',
  rep_license_no: 'L',
  rep_signature: 'ink2',
  admission_scan_url: 'admission-scans/proof.pdf',
  created_at: '2026-01-01',
  updated_at: '2026-02-01',
  deleted_at: null,
  force_password_change: true,
  internal_flag_from_future_migration: 'LEAK?',
};

const FAT_CLINICAL = {
  patient_id: 'p1',
  primary_diagnosis: 'D1',
  iep_level: 'MSN',
  secondary_diagnosis: 'D2',
  treating_psychologist_id: 't1',
  treating_psychometrician_id: 't2',
  date_enrolled: '2026-01-02',
  referral_source: 'X',
  last_assessment_at: '2026-03-01',
  next_review_at: '2026-06-01',
  gars3_gai_score: 70,
  gars3_label: 'G',
  notes: 'private note',
  support_level: 'MSN',
  milestone_progress: 40,
  chief_complaint: 'cc',
  working_diagnosis: 'wd',
  prior_diagnosis: 'pd',
  prior_physician: 'pp',
  prior_institution: 'pi',
  allergies: 'none',
  created_at: '2026-01-01',
  updated_at: '2026-02-01',
  secret_column_from_future_migration: 'LEAK?',
};

describe('patientForClient', () => {
  it('exposes exactly the client whitelist, never linkage ids or flags', () => {
    const out = dto.patientForClient(FAT_PATIENT, { full_name: 'Ana B. Cruz', age: 8 });
    assert.deepEqual(sortedKeys(out), [
      'admission_form_status', 'age', 'allow_journal_entry', 'citizenship',
      'contact_number', 'created_at', 'date_of_birth', 'first_name',
      'full_name', 'grade_level', 'home_address', 'id', 'last_name',
      'middle_name', 'name_suffix', 'nick_name', 'other_disability',
      'parent_printed_name', 'parent_signature', 'patient_id', 'permanent_address',
      'photo_url', 'place_of_birth', 'previously_diagnosed', 'religion',
      'rep_signature', 'school', 'sex',
    ]);
    for (const banned of ['caregiver_id', 'clinic_id', 'status', 'delivery_method',
      'force_password_change', 'rep_printed_name', 'rep_profession', 'rep_license_no',
      'admission_scan_url', 'deleted_at', 'updated_at', 'internal_flag_from_future_migration']) {
      assert.ok(!(banned in out), `${banned} must not leak to clients`);
    }
  });
});

describe('patientForStaff', () => {
  it('adds linkage/workflow fields but still drops bookkeeping and secrets', () => {
    const out = dto.patientForStaff(FAT_PATIENT, { full_name: 'Ana B. Cruz' });
    for (const kept of ['caregiver_id', 'clinic_id', 'status',
      'treating_psychologist_id', 'previously_diagnosed', 'rep_signature',
      'admission_scan_url']) {
      assert.ok(kept in out, `${kept} must stay visible to staff`);
    }
    for (const banned of ['force_password_change', 'deleted_at', 'updated_at',
      'internal_flag_from_future_migration']) {
      assert.ok(!(banned in out), `${banned} must not leak even to staff`);
    }
  });
});

describe('clinicalForClient', () => {
  it('exposes only the MyProfile field set', () => {
    const out = dto.clinicalForClient(FAT_CLINICAL, { treating_psychologist_name: 'Dr X' });
    assert.deepEqual(sortedKeys(out), [
      'allergies', 'chief_complaint', 'date_enrolled', 'iep_level',
      'last_assessment_at', 'next_review_at', 'primary_diagnosis',
      'secondary_diagnosis', 'treating_psychologist_name', 'working_diagnosis',
    ]);
    for (const banned of ['notes', 'support_level', 'milestone_progress',
      'gars3_gai_score', 'referral_source', 'secret_column_from_future_migration']) {
      assert.ok(!(banned in out), `${banned} must not leak to clients`);
    }
  });
});

describe('clinicalForStaff', () => {
  it('keeps the full care record but drops future columns', () => {
    const out = dto.clinicalForStaff(FAT_CLINICAL);
    for (const kept of ['notes', 'support_level', 'milestone_progress',
      'gars3_gai_score', 'chief_complaint', 'prior_diagnosis', 'allergies']) {
      assert.ok(kept in out, `${kept} must stay visible to staff`);
    }
    assert.ok(!('secret_column_from_future_migration' in out));
    assert.ok(!('created_at' in out) && !('updated_at' in out));
  });
});

describe('guardianCard / emergencyCard', () => {
  it('drops linkage ids, timestamps, and future columns', () => {
    const guardian = dto.guardianCard({
      id: 'g1', patient_id: 'p1', full_name: 'Mom', relationship: 'Mother',
      contact_number: '0917', email: 'm@x.io', occupation: 'O', employer: 'E',
      is_primary: true, photo_url: null, created_at: 't', bank_account_from_future_migration: 'LEAK?',
    });
    assert.deepEqual(sortedKeys(guardian), ['contact_number', 'email', 'employer',
      'full_name', 'id', 'is_primary', 'occupation', 'photo_url', 'relationship']);
    const emergency = dto.emergencyCard({
      id: 'e1', patient_id: 'p1', full_name: 'Dad', relationship: 'Father',
      contact_number: '0918', alt_contact_number: null, address: 'A St',
      created_at: 't', notes_from_future_migration: 'LEAK?',
    });
    assert.deepEqual(sortedKeys(emergency), ['address', 'alt_contact_number',
      'contact_number', 'full_name', 'id', 'relationship']);
  });

  it('passes narrowed rows through unchanged (missing keys stay missing)', () => {
    assert.deepEqual(
      dto.guardianCard({ id: 'g1', full_name: 'Mom', relationship: 'Mother', is_primary: true }),
      { id: 'g1', full_name: 'Mom', relationship: 'Mother', is_primary: true },
    );
  });
});

describe('moodSeriesPoints', () => {
  const logs = [
    { log_date: '2026-03-02', mood: 'good' },
    { log_date: '2026-03-01', mood: 'sad' },
  ];
  const scoreOf = (mood) => ({ good: 4, sad: 2 }[mood] || 0);

  it('builds the /home value-shaped points', () => {
    assert.deepEqual(dto.moodSeriesPoints(logs, 'value', scoreOf), [
      { date: '2026-03-02', value: 4 },
      { date: '2026-03-01', value: 2 },
    ]);
  });

  it('builds the /activity-logs score-shaped points', () => {
    assert.deepEqual(dto.moodSeriesPoints(logs, 'score', scoreOf), [
      { date: '2026-03-02', score: 4 },
      { date: '2026-03-01', score: 2 },
    ]);
  });
});
