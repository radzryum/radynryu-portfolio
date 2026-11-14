const BEHAVIORAL_REPORT_SCHEMA_VERSION = 3;

const BEHAVIORAL_ADMINISTERED_TESTS = [
  { id: 'caregiver_observation', label: 'Caregiver Behavioral Observation Checklist' },
  { id: 'mmse', label: 'Mini-Mental Status Examination (MMSE)' },
  { id: 'adaptive_functioning', label: 'Child Adaptive Functioning Assessment Tool' },
  { id: 'ctoni_2', label: 'Comprehensive Test of Nonverbal Intelligence-2 (CTONI-2)' },
  { id: 'gars_3', label: "Gilliam's Autism Rating Scale-3 (GARS-3)" },
];

const ADMINISTERED_TEST_IDS = new Set(BEHAVIORAL_ADMINISTERED_TESTS.map((test) => test.id));
const ADMINISTERED_TEST_LABELS = new Map(BEHAVIORAL_ADMINISTERED_TESTS.map((test) => [test.label, test.id]));

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeAdministeredTests(value, schemaVersion = 1) {
  const version = Number(schemaVersion) || 1;
  const source = Array.isArray(value) ? value : [];
  const normalized = [...new Set(source
    .map((item) => ADMINISTERED_TEST_LABELS.get(String(item)) || String(item))
    .filter((item) => ADMINISTERED_TEST_IDS.has(item)))];

  // Part III was previously a static list. Preserve that output for legacy
  // reports while new schema versions require an explicit checkbox choice.
  return version < BEHAVIORAL_REPORT_SCHEMA_VERSION && normalized.length === 0
    ? BEHAVIORAL_ADMINISTERED_TESTS.map((test) => test.id)
    : normalized;
}

function normalizeBehavioralTableValues(value, schemaVersion = 1) {
  const source = objectValue(value);
  const normalized = { ...source };
  const version = Number(schemaVersion) || 1;

  // Older FO-06 drafts used Orientation/Registration/etc. for MMSE. The
  // official template uses the same four domain rows for every summary table,
  // so old values must not be displayed beside the new labels.
  if (version < BEHAVIORAL_REPORT_SCHEMA_VERSION) normalized.mmse = {};

  if (version < BEHAVIORAL_REPORT_SCHEMA_VERSION && source.garsComposite) {
    normalized.garsComposite = {};
    [0, 1].forEach((rowIndex) => {
      const severity = source.garsComposite[`${rowIndex}:1`] || source.garsComposite[`${rowIndex}:0`] || '';
      if (severity) normalized.garsComposite[`${rowIndex}:0`] = severity;
    });
  }

  if (version < BEHAVIORAL_REPORT_SCHEMA_VERSION && source.ctoniComposite) {
    normalized.ctoniComposite = {
      '0:0': source.ctoniComposite['0:0'] || '',
      '0:1': source.ctoniComposite['0:1'] || '',
      '1:0': source.ctoniComposite['1:0'] || '',
      '1:1': source.ctoniComposite['1:1'] || '',
    };
  }

  return normalized;
}

function normalizeBehavioralReportDraft(value, schemaVersion = 1) {
  const draft = objectValue(value);
  const cleanDraft = { ...draft };
  delete cleanDraft.reason;
  delete cleanDraft.summary;
  delete cleanDraft.concerns;
  delete cleanDraft.tables;
  const tableSource = draft.tableValues || draft.tables || {};

  return {
    ...cleanDraft,
    administeredTests: normalizeAdministeredTests(draft.administeredTests, schemaVersion),
    tableValues: normalizeBehavioralTableValues(tableSource, schemaVersion),
  };
}

function normalizeBehavioralReportContent(content) {
  if (content === null || content === undefined || content === '') return null;
  let parsed = content;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Behavioral report content must be a JSON object.');
  }

  const draft = parsed.report_draft || parsed.draft || parsed.form || {};
  return {
    ...parsed,
    schema_version: BEHAVIORAL_REPORT_SCHEMA_VERSION,
    report_draft: normalizeBehavioralReportDraft(draft, parsed.schema_version),
  };
}

module.exports = {
  BEHAVIORAL_REPORT_SCHEMA_VERSION,
  BEHAVIORAL_ADMINISTERED_TESTS,
  normalizeAdministeredTests,
  normalizeBehavioralTableValues,
  normalizeBehavioralReportDraft,
  normalizeBehavioralReportContent,
};
