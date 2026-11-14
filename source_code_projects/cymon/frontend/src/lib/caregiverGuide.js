// Caregiver Observation Checklist (FO-03) — scoring GUIDE only.
//
// This module is intentionally read-only: it computes percentages, severity
// bands, and a preliminary support-level suggestion for DISPLAY, and never
// writes to submissions, approvals, or official PDFs. The submitted
// domain_scores / total_score and the generated PDF remain the system of
// record; everything here is a suggestion the clinician may accept or ignore.
//
// Band cutoffs are adapted proportionally from the 57-item paper reference
// (global 19/33/44 -> <=33% severe, <=58% moderate, <=77% mild, above good)
// so they apply fairly to all seven FO-03 domains, including the 2-item
// perceptual and 7-item stimming sections. They are screening heuristics,
// not norms — final leveling stays with the licensed psychologist.

// FO-03 sections whose YES answers mean observed concerns (flagged for
// clinical interview, never converted to a skill percentage).
// Every other domain counts YES answers as acquired skills (scored
// by %) — see FLAG_KEYS handling in scoreCaregiverGuide. The same shape
// covers the clinic-adapted MMSE checklist (FO-04), which reuses these
// domain keys; its single "bodily" domain scores as developmental.
const FLAG_KEYS = new Set(['perceptual', 'stimming'])

// Domain keys that carry motor content for referral hints. FO-03 splits
// them (gross_motor / fine_motor); FO-04 merges them ("bodily").
function motorKindOf(key) {
  const k = String(key || '').toLowerCase()
  if (k.includes('gross')) return 'gross'
  if (k.includes('fine')) return 'fine'
  if (k.includes('motor') || k.includes('bodily') || k.includes('kinest')) return 'motor'
  return null
}

export const GUIDE_CUTOFFS = {
  // Percentages are inclusive upper bounds, adapted from the 57-item
  // reference cutoffs 19/33/44.
  SEVERE_MAX_PCT: 33,
  MODERATE_MAX_PCT: 58,
  MILD_MAX_PCT: 77,
  // A domain below this counts as "needing support" for the DBI suggestion.
  NEEDS_SUPPORT_PCT: 60,
}

export function bandFor(pct) {
  if (pct == null) return null
  if (pct <= GUIDE_CUTOFFS.SEVERE_MAX_PCT) return 'severe'
  if (pct <= GUIDE_CUTOFFS.MODERATE_MAX_PCT) return 'moderate'
  if (pct <= GUIDE_CUTOFFS.MILD_MAX_PCT) return 'mild'
  return 'good'
}

export const BAND_LABEL = {
  severe: 'Significant difficulty',
  moderate: 'Moderate difficulty',
  mild: 'Mild difficulty',
  good: 'Age-appropriate',
}

function countYes(items, answers) {
  let yes = 0
  let answered = 0
  let na = 0
  for (const it of items) {
    const v = String(answers[it.key] || '').toLowerCase()
    if (v === 'yes') {
      yes += 1
      answered += 1
    } else if (v === 'no') {
      answered += 1
    } else if (v === 'na') {
      na += 1
    }
  }
  return { yes, answered, na }
}

// Scores one FO-03 submission for guide display. `structure` is the live
// FO-03 domain list; `answers` maps item key -> 'yes' | 'no' | 'na'.
export function scoreCaregiverGuide(structure, answers) {
  const safeAnswers = answers || {}
  const domains = []
  for (const d of Array.isArray(structure) ? structure : []) {
    const items = Array.isArray(d?.items) ? d.items : []
    if (items.length === 0) continue
    const { yes, answered, na } = countYes(items, safeAnswers)
    const kind = FLAG_KEYS.has(d.key) ? 'flag' : 'developmental'
    const pct = kind === 'developmental' && items.length > 0
      ? Math.round((yes / items.length) * 100)
      : null
    domains.push({
      key: d.key,
      title: d.title || d.key,
      kind,
      score: yes,
      max: items.length,
      answered,
      na,
      pct,
      band: kind === 'developmental' ? bandFor(pct) : null,
    })
  }

  const developmental = domains.filter((d) => d.kind === 'developmental')
  const flags = domains.filter((d) => d.kind === 'flag')
  const total = developmental.reduce((s, d) => s + d.score, 0)
  const max = developmental.reduce((s, d) => s + d.max, 0)
  const totalPct = max > 0 ? Math.round((total / max) * 100) : null
  const answeredCount = domains.reduce((s, d) => s + d.answered + d.na, 0)
  const itemCount = domains.reduce((s, d) => s + d.max, 0)

  const needsSupport = developmental.filter(
    (d) => d.pct != null && d.pct < GUIDE_CUTOFFS.NEEDS_SUPPORT_PCT,
  )

  // Preliminary DBI suggestion. Thresholds mirror the clinic dosage tiers
  // (HSN 48h/mo, MSN 36h/mo, LSN 24h/mo): more needs -> more hours.
  let level = null
  const reasons = []
  if (totalPct != null) {
    if (totalPct < 50 || needsSupport.length >= 3) {
      level = 'HSN'
    } else if (totalPct < 75 || needsSupport.length >= 1) {
      level = 'MSN'
    } else {
      level = 'LSN'
    }
    reasons.push(`Overall ${total}/${max} (${totalPct}%)`)
    reasons.push(
      needsSupport.length > 0
        ? `${needsSupport.length} domain${needsSupport.length > 1 ? 's' : ''} below ${GUIDE_CUTOFFS.NEEDS_SUPPORT_PCT}%: ${needsSupport.map((d) => d.title).join(', ')}`
        : `All domains at or above ${GUIDE_CUTOFFS.NEEDS_SUPPORT_PCT}%`,
    )
  }

  const gross = domains.find((d) => motorKindOf(d.key) === 'gross')
  const fine = domains.find((d) => motorKindOf(d.key) === 'fine')
  // FO-04 merges motor content into a single "bodily" domain.
  const singleMotor = !gross && !fine
    ? domains.find((d) => motorKindOf(d.key) === 'motor')
    : null
  const motorSevere = [gross, fine, singleMotor].some(
    (d) => d && ['severe', 'moderate'].includes(d.band),
  )
  const referrals = []
  if (gross && ['severe', 'moderate'].includes(gross.band)) {
    referrals.push({
      title: 'Gross motor suggestion',
      text: `Gross motor at ${gross.pct}% — consider a Pediatric or Physical Therapy referral.`,
      flag: true,
    })
  }
  if (fine && ['severe', 'moderate'].includes(fine.band)) {
    referrals.push({
      title: 'Fine motor suggestion',
      text: `Fine motor at ${fine.pct}% — consider an Occupational Therapy evaluation.`,
      flag: true,
    })
  }
  if (singleMotor && ['severe', 'moderate'].includes(singleMotor.band)) {
    referrals.push({
      title: 'Motor suggestion',
      text: `${singleMotor.title} at ${singleMotor.pct}% — consider a Physical or Occupational Therapy referral.`,
      flag: true,
    })
  }
  if (motorSevere && gross?.band && fine?.band) {
    const grossRank = ['good', 'mild', 'moderate', 'severe'].indexOf(gross.band)
    const fineRank = ['good', 'mild', 'moderate', 'severe'].indexOf(fine.band)
    if (grossRank >= 2 && fineRank >= 2) {
      referrals.push({
        title: 'Combined motor suggestion',
        text: 'Both gross and fine motor fall in the moderate-to-severe range — consider a developmental pediatric assessment.',
        flag: true,
      })
    }
  }
  for (const f of flags) {
    if (f.score > 0) {
      referrals.push({
        title: `${f.title} — observed`,
        text: `${f.score} item${f.score > 1 ? 's' : ''} endorsed. Flag for clinical interview; this section is not scored.`,
        flag: true,
      })
    }
  }
  if (referrals.length === 0 && answeredCount > 0) {
    referrals.push({
      title: 'No referral flags',
      text: 'No motor or behavioral flags from this screening. Continue routine monitoring.',
      flag: false,
    })
  }

  return {
    domains,
    developmental,
    flags,
    global: { total, max, pct: totalPct, band: bandFor(totalPct) },
    suggestion: { level, reasons },
    referrals,
    answeredCount,
    itemCount,
  }
}
