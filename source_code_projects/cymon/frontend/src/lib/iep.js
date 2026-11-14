// Shared IEP (Individualized Education Plan) helpers for the psychometrician
// workspace, the psychologist review, and the official PDF preview.
//
// Plan model: one assessment_reports row (report_type 'iep') per plan. The
// row's `period` carries the label — "Month N" for legacy rows, "Plan N" for
// new ones ("Cycle N" rows from the brief interim are read the same way).
// Numbering is 1-based throughout (no Plan 0): a legacy Month 1 reads as
// Plan 1, so history keeps rendering without a data migration. Each plan
// stores its own duration (content.cycle.durationWeeks, 1–12, default 4) and
// per-week plans; a week may be flagged `noSession` with a required reason.

export const IEP_MIN_WEEKS = 1
export const IEP_MAX_WEEKS = 12
export const IEP_DEFAULT_WEEKS = 4

export const IEP_LEVELS = [
  {
    key: 'LSN',
    name: 'Low Support Needs',
    plain: 'The learner can do most tasks alone and needs only light guidance or reminders.',
  },
  {
    key: 'MSN',
    name: 'Moderate Support Needs',
    plain: 'The learner needs regular, structured help from the therapist to complete tasks.',
  },
  {
    key: 'HSN',
    name: 'High Support Needs',
    plain: 'The learner needs close, hands-on support for most or all parts of a task.',
  },
]

export const IEP_DOMAINS = [
  { key: 'practical', name: 'Practical Domain', plain: 'Everyday self-care and daily-living skills (eating, dressing, hygiene, routines).' },
  { key: 'social', name: 'Social Domain', plain: 'How the learner interacts with others (greetings, sharing, turn-taking, group behavior).' },
  { key: 'conceptual', name: 'Conceptual Domain', plain: 'Thinking and learning skills (language, numbers, following instructions, problem-solving).' },
  { key: 'kinFine', name: 'Fine Motor Skills', plain: 'Small-muscle control (grasping, drawing, cutting, buttoning). Part of Bodily Kinesthetics.' },
  { key: 'kinGross', name: 'Gross Motor Skills', plain: 'Big-muscle movement (walking, running, jumping, balance). Part of Bodily Kinesthetics.' },
]

export const IEP_FIELD_HINTS = {
  activity: 'What the learner will do (e.g. "Buttoning practice with a dressing frame").',
  objectives: 'What the learner should achieve (e.g. "Buttons 3/5 independently").',
  materials: 'What the therapist needs (e.g. "Dressing frame, visual cue cards").',
  notes: 'Optional observations from the session.',
  noSessionReason: 'Why there was no session this week (e.g. "Holiday break", "Learner was sick").',
}

export const IEP_KINDS = [
  { key: 'initial_plan', label: 'Initial Plan' },
  { key: 'renewal', label: 'Renewal' },
]

export function kindForCycleNumber(n) {
  if (n <= 1) return 'initial_plan'
  return 'renewal'
}

export function kindLabel(kind) {
  // 'initial_assessment' is retired: rows stored during the brief interim
  // read as Initial Plan so nothing renders as a bare "Plan".
  if (kind === 'initial_assessment') return 'Initial Plan'
  return (IEP_KINDS.find((k) => k.key === kind) || { label: 'Plan' }).label
}

// "Plan 2" -> 2 · interim "Cycle 2" -> 2 · legacy "Month 1" -> 1 (same plan,
// 1-based throughout). Anything else -> null.
export function cycleNumberFromPeriod(period) {
  const m = /^\s*(?:Plan|Cycle)\s+(\d+)\s*$/i.exec(period || '')
  if (m) return Math.max(1, Number(m[1]))
  const legacy = /^\s*Month\s+(\d+)\s*$/i.exec(period || '')
  if (legacy) return Math.max(1, Number(legacy[1]))
  return null
}

export function cycleLabel(n) {
  return `Plan ${n}`
}

export function cycleInfoFor(period, content) {
  const stored = content?.cycle || {}
  const number = stored.number ?? cycleNumberFromPeriod(period) ?? 1
  const kind = stored.kind || kindForCycleNumber(number)
  const legacy = cycleNumberFromPeriod(period) != null && !/^(plan|cycle)/i.test(String(period || ''))
  return { number, kind, kindLabel: kindLabel(kind), label: cycleLabel(number), legacy }
}

export function clampWeeks(n) {
  const parsed = Number(n)
  if (!Number.isFinite(parsed)) return IEP_DEFAULT_WEEKS
  return Math.min(IEP_MAX_WEEKS, Math.max(IEP_MIN_WEEKS, Math.floor(parsed)))
}

export function durationWeeksOf(form) {
  if (!form || typeof form !== 'object') return IEP_DEFAULT_WEEKS
  if (form?.cycle?.durationWeeks != null) return clampWeeks(form.cycle.durationWeeks)
  const keys = Object.keys(form.weeks || {})
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k) && k >= 1 && k <= IEP_MAX_WEEKS)
  if (keys.length && Math.max(...keys) > IEP_DEFAULT_WEEKS) return clampWeeks(Math.max(...keys))
  return IEP_DEFAULT_WEEKS
}

export function weekDataOf(form, week) {
  if (!form || typeof form !== 'object') return null
  return form?.weeks?.[week] || form?.weeks?.[String(week)] || null
}

// Unwrap stored content (string or object, possibly nested under form/iep).
export function parseIepForm(content) {
  if (!content) return null
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    return parsed?.form || parsed?.iep || parsed || null
  } catch {
    return null
  }
}

const REQUIRED = ['activity', 'objectives', 'materials']

export function isNoSessionWeek(weekData) {
  return Boolean(weekData?.noSession)
}

export function isWeekStarted(weekData) {
  if (!weekData) return false
  if (weekData?.noSession) return true
  if (weekData?.level) return true
  return ['practical', 'social', 'conceptual', 'kinFine', 'kinGross'].some((domain) =>
    [...REQUIRED, 'notes'].some((field) => String(weekData?.[domain]?.[field] || '').trim()),
  )
}

export function isWeekComplete(weekData) {
  if (!weekData) return false
  if (weekData?.noSession) return Boolean(String(weekData?.noSessionReason || '').trim())
  if (!weekData?.level) return false
  return ['practical', 'social', 'conceptual', 'kinFine', 'kinGross'].every((domain) =>
    REQUIRED.every((field) => String(weekData?.[domain]?.[field] || '').trim()),
  )
}

export function cycleProgressOf(form) {
  const total = durationWeeksOf(form)
  let done = 0
  for (let week = 1; week <= total; week += 1) {
    if (isWeekComplete(weekDataOf(form, week))) done += 1
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

function parseIsoDate(value) {
  if (!value) return null
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function startDateOf(form) {
  return form?.cycle?.startDate || form?.planStart || null
}

export function endDateOf(form) {
  const start = parseIsoDate(startDateOf(form))
  if (!start) return null
  const end = new Date(start)
  end.setDate(end.getDate() + durationWeeksOf(form) * 7 - 1)
  return end.toISOString().slice(0, 10)
}

export function fmtDate(value) {
  if (!value) return '—'
  const d = parseIsoDate(value) || new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Highest cycle number across a patient's rows (legacy months count too).
// Cycles start at 1 — a student with no IEP yet gets Cycle 1 next.
export function nextCycleNumber(rows) {
  let max = 0
  for (const r of rows || []) {
    const n = r?.cycleNumber ?? cycleNumberFromPeriod(r?.period)
    if (Number.isInteger(n) && n > max) max = n
  }
  return max + 1
}

// The most recently finished week with a support level — carried over as the
// starting level when a cycle is renewed.
export function lastLevelOf(form) {
  const total = durationWeeksOf(form)
  for (let week = total; week >= 1; week -= 1) {
    const level = weekDataOf(form, week)?.level
    if (level) return level
  }
  return ''
}
