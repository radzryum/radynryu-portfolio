import { useMemo } from 'react'
import { BAND_LABEL, scoreCaregiverGuide } from '../../lib/caregiverGuide'

// Read-only scoring guide for the Caregiver Observation Checklist (FO-03).
// Suggestion only: it never edits answers, submissions, approvals, or PDFs.
// Shown to psychometricians while encoding and to psychologists while
// reviewing — both through AnswerAssessment.
const BAND_TONE = {
  severe: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  mild: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const LEVEL_TONE = {
  HSN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  MSN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LSN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

function BandBadge({ band }) {
  if (!band) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BAND_TONE[band]}`}>
      {BAND_LABEL[band]}
    </span>
  )
}

function DomainRow({ domain }) {
  if (domain.kind === 'flag') {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{domain.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Not scored — endorsed items are interview flags</div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {domain.score} observed
        </span>
      </div>
    )
  }
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{domain.title}</div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-bold text-purple-800 dark:text-purple-200">
            {domain.score}/{domain.max} · {domain.pct}%
          </span>
          <BandBadge band={domain.band} />
        </div>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-purple-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={domain.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${domain.title} ${domain.pct} percent`}
      >
        <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${domain.pct}%` }} />
      </div>
    </div>
  )
}

function CaregiverScoringGuide({ structure, answers, sourceLabel = 'Caregiver Observation Checklist (FO-03)' }) {
  const guide = useMemo(() => scoreCaregiverGuide(structure, answers), [structure, answers])

  if (guide.answeredCount === 0) {
    return (
      <section aria-label="Scoring guide" className="no-print rounded-2xl border border-dashed border-purple-300 dark:border-slate-700 bg-purple-50/50 dark:bg-slate-900 p-4 shadow-sm">
        <div className="text-sm font-semibold text-purple-800 dark:text-purple-200">Scoring Guide (suggestion only)</div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Domain percentages, severity hints, and a preliminary support-level suggestion will appear here as items are answered.
          Nothing here changes the submitted answers or the official PDF.
        </p>
      </section>
    )
  }

  const { global, suggestion } = guide

  return (
    <section
      id="form-section-guide"
      aria-label="Scoring guide"
      className="no-print scroll-mt-4 rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300">
          Scoring Guide · Suggestion only
        </div>
        <BandBadge band={global.band} />
      </div>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{sourceLabel}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Overall {global.total}/{global.max} ({global.pct}%) across {guide.developmental.length} developmental domains.
        Screening reference — not a diagnosis. Does not alter the record or PDF.
      </p>

      <div className="mt-2 divide-y divide-purple-100 dark:divide-slate-800">
        {guide.domains.map((d) => (
          <DomainRow key={d.key} domain={d} />
        ))}
      </div>

      {suggestion.level ? (
        <div className="mt-3 rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Preliminary support suggestion
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${LEVEL_TONE[suggestion.level]}`}>
              {suggestion.level}
            </span>
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {suggestion.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Final leveling is decided and signed off by the licensed psychologist. Manually encoded results stay authoritative.
          </p>
        </div>
      ) : null}

      {guide.referrals.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Referral hints</div>
          <ul className="mt-1.5 space-y-1.5">
            {guide.referrals.map((r) => (
              <li
                key={r.title}
                className={`rounded-xl border px-3 py-2 text-xs ${r.flag
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                <span className="font-bold">{r.title}: </span>{r.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 border-t border-purple-100 dark:border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Ethics note: this checklist is an initial screening tool, not a diagnostic instrument. N/A answers are excluded from
        counts. Perceptual and stimming sections are interview flags, never skill scores. Confirm any suggestion with clinical
        judgment before encoding the official result.
      </p>
    </section>
  )
}

export default CaregiverScoringGuide
