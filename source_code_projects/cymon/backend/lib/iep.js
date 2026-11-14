// Shared IEP (Individualized Education Plan) helpers.
//
// A cycle is one assessment_reports row (report_type 'iep'). The row's `period`
// column carries the cycle label ("Month N" for legacy rows, "Cycle N" for new
// ones); the plan itself lives in `content` with per-week domain activities.
// Weeks are 1-based: content.weeks = { 1: {...}, ..., N: {...} } where N is the
// cycle duration (content.cycle.durationWeeks). A week can be flagged
// `noSession` with a required `noSessionReason` — e.g. no therapy session that
// week — in which case its domain activities are skipped by validation.

const IEP_TITLE_RE = /(individualized educat(?:ion|ional) plan|\biep\b)/i;
const IEP_DOMAINS = ['practical', 'social', 'conceptual', 'kinFine', 'kinGross'];
const IEP_REQUIRED_FIELDS = ['activity', 'objectives', 'materials'];

const IEP_MIN_WEEKS = 1;
const IEP_MAX_WEEKS = 12;
const IEP_DEFAULT_WEEKS = 4;

function clampWeeks(n) {
  const parsed = Number(n);
  if (!Number.isFinite(parsed)) return IEP_DEFAULT_WEEKS;
  return Math.min(IEP_MAX_WEEKS, Math.max(IEP_MIN_WEEKS, Math.floor(parsed)));
}

function parseIepContent(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.form || parsed?.iep || parsed;
  } catch {
    return null;
  }
}

// How many weeks this cycle covers. Explicit metadata wins; otherwise assume
// the legacy 4-week shape unless stored weeks reach further (forward growth).
function iepDurationWeeks(form) {
  if (!form || typeof form !== 'object') return IEP_DEFAULT_WEEKS;
  if (form?.cycle?.durationWeeks != null) return clampWeeks(form.cycle.durationWeeks);
  const keys = Object.keys(form.weeks || {})
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k) && k >= 1 && k <= IEP_MAX_WEEKS);
  if (keys.length && Math.max(...keys) > IEP_DEFAULT_WEEKS) {
    return clampWeeks(Math.max(...keys));
  }
  return IEP_DEFAULT_WEEKS;
}

function iepWeekData(form, week) {
  if (!form || typeof form !== 'object') return null;
  return form.weeks?.[week] || form.weeks?.[String(week)] || null;
}

function isIepNoSessionWeek(weekData) {
  return Boolean(weekData?.noSession);
}

function isIepWeekStarted(weekData) {
  if (!weekData) return false;
  if (weekData?.noSession) return true;
  if (weekData?.level) return true;
  return IEP_DOMAINS.some((domain) =>
    [...IEP_REQUIRED_FIELDS, 'notes'].some((field) => String(weekData?.[domain]?.[field] || '').trim()),
  );
}

// A week counts as complete when it is either a no-session week with a reason
// or a regular week whose level + required domain fields are all filled.
function isIepWeekComplete(weekData) {
  if (!weekData) return false;
  if (weekData?.noSession) return Boolean(String(weekData?.noSessionReason || '').trim());
  if (!weekData?.level) return false;
  return IEP_DOMAINS.every((domain) =>
    IEP_REQUIRED_FIELDS.every((field) => String(weekData?.[domain]?.[field] || '').trim()),
  );
}

function iepCycleProgress(form) {
  const total = iepDurationWeeks(form);
  let done = 0;
  for (let week = 1; week <= total; week += 1) {
    if (isIepWeekComplete(iepWeekData(form, week))) done += 1;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function findIncompleteIepField(content) {
  const form = parseIepContent(content);
  if (!form || typeof form !== 'object') return 'IEP form data';
  const basics = [
    ['plan title', form.title],
    ["learner's name", form.learnerName],
    ['date of birth', form.learnerDob],
    ['plan start date', form.planStart],
    ['behavioral therapist', form.techName],
    ['diagnosis / profile', form.diagnosis],
    ['psychometrician signature date', form.preparedDate],
  ];
  const missingBasic = basics.find(([, value]) => !String(value || '').trim());
  if (missingBasic) return missingBasic[0];

  const total = iepDurationWeeks(form);
  for (let week = 1; week <= total; week += 1) {
    const weekData = iepWeekData(form, week);
    // Week 1 is always required for review; later weeks are optional until
    // started, so a Week 1-only IEP can be sent for checking while the
    // rest stay as draft.
    if (week > 1 && !isIepWeekStarted(weekData)) continue;
    if (isIepNoSessionWeek(weekData)) {
      if (!String(weekData?.noSessionReason || '').trim()) {
        return `Week ${week} no-session reason`;
      }
      continue;
    }
    if (!weekData?.level) return `Week ${week} support level`;
    for (const domain of IEP_DOMAINS) {
      for (const field of IEP_REQUIRED_FIELDS) {
        if (!String(weekData?.[domain]?.[field] || '').trim()) {
          return `Week ${week} ${domain} ${field}`;
        }
      }
    }
  }
  return null;
}

function stringifyIepContent(content) {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function hasOverlongIepText(value) {
  if (typeof value === 'string') return value.length > 400;
  if (Array.isArray(value)) return value.some(hasOverlongIepText);
  if (value && typeof value === 'object') return Object.values(value).some(hasOverlongIepText);
  return false;
}

module.exports = {
  IEP_TITLE_RE,
  IEP_DOMAINS,
  IEP_REQUIRED_FIELDS,
  IEP_MIN_WEEKS,
  IEP_MAX_WEEKS,
  IEP_DEFAULT_WEEKS,
  clampWeeks,
  parseIepContent,
  iepDurationWeeks,
  iepWeekData,
  isIepNoSessionWeek,
  isIepWeekStarted,
  isIepWeekComplete,
  iepCycleProgress,
  findIncompleteIepField,
  stringifyIepContent,
  hasOverlongIepText,
};
