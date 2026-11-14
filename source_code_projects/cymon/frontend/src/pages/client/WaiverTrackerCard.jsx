import { useNavigate } from 'react-router-dom'

// One document's status tracker: vertical stepper Answered -> Clinic
// review -> Approved. Read-only — steps come from the backend status,
// never clickable. No timestamps: the waivers API exposes no per-step
// dates, so none are invented.
const STATUS_META = {
  submitted: { label: 'Submitted & Answered', cls: 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' },
  approved: { label: 'Approved & Completed', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  returned: { label: 'Returned — Needs Revision', cls: 'bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800 animate-pulse' },
  pending_signature: { label: 'Pending Signature (Not Answered)', cls: 'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  pending: { label: 'Signature Required', cls: 'bg-rose-500 text-white border border-rose-600 dark:bg-rose-600 dark:border-rose-500 animate-[pulse_1.5s_infinite] font-bold shadow-sm' },
  overdue: { label: 'Overdue (Action Required)', cls: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800 animate-pulse' },
  not_started: { label: 'Action Required', cls: 'bg-rose-500 text-white border border-rose-600 dark:bg-rose-600 dark:border-rose-500 animate-[pulse_1.5s_infinite] font-bold shadow-sm' },
}

function stepsFor(form) {
  switch (form.status) {
    case 'approved':
      return [
        { key: 'answered', label: 'Answered', state: 'done' },
        { key: 'review', label: 'Clinic review', state: 'done' },
        { key: 'approved', label: 'Approved & completed', state: 'done' },
      ]
    case 'submitted':
      return [
        { key: 'answered', label: 'Answered', state: 'done' },
        { key: 'review', label: 'Clinic review', state: 'active', hint: 'Waiting for the clinic team.' },
        { key: 'approved', label: 'Approved & completed', state: 'pending' },
      ]
    case 'returned':
      return [
        { key: 'answered', label: 'Answered', state: 'done' },
        { key: 'review', label: 'Clinic review', state: 'attention', hint: form.review_comment || 'The clinic asked for changes.' },
        { key: 'approved', label: 'Approved & completed', state: 'pending' },
      ]
    default:
      return [
        { key: 'answered', label: 'Answered', state: 'active', hint: 'Fill out and sign the form below.' },
        { key: 'review', label: 'Clinic review', state: 'pending' },
        { key: 'approved', label: 'Approved & completed', state: 'pending' },
      ]
  }
}

function StepNode({ index, state }) {
  if (state === 'done') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z" />
        </svg>
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-purple-600 dark:border-purple-400 bg-white dark:bg-slate-900 text-sm font-bold text-purple-700 dark:text-purple-300 shadow-sm" aria-hidden="true">
        {index + 1}
      </span>
    )
  }
  if (state === 'attention') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-sm font-bold text-amber-600 dark:text-amber-300 shadow-sm animate-pulse" aria-hidden="true">
        !
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-400 dark:text-slate-500" aria-hidden="true">
      {index + 1}
    </span>
  )
}

function WaiverTrackerCard({ form }) {
  const navigate = useNavigate()
  const meta = STATUS_META[form.status] || STATUS_META.not_started
  const steps = stepsFor(form)
  const isPending = form.status !== 'submitted' && form.status !== 'approved'

  const goAction = () => {
    navigate(`/client/waivers/${encodeURIComponent(form.code)}${isPending ? '' : '?view=true'}`)
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 transition-colors">{form.title}</h4>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug transition-colors">{form.description}</p>
          <p className="mt-1 text-[10px] sm:text-[11px] font-semibold text-purple-700 dark:text-purple-400 transition-colors">{form.code}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[10px] font-bold ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      <ol className="mt-4 flex-1 space-y-0" aria-label={`${form.title} progress`}>
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === 'active' ? 'step' : undefined}>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[17px] top-10 bottom-0 w-0.5 ${step.state === 'done' ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              />
            ) : null}
            <StepNode index={i} state={step.state} />
            <div className="min-w-0 flex-1 pt-1">
              <p className={`text-xs sm:text-sm font-bold ${step.state === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'} transition-colors`}>
                {step.label}
              </p>
              {step.hint ? (
                <p className="mt-0.5 text-[11px] sm:text-xs leading-snug text-slate-500 dark:text-slate-400 transition-colors">{step.hint}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 border-t border-purple-100/70 dark:border-slate-800 pt-3 transition-colors">
        <button
          type="button"
          onClick={goAction}
          className={`w-full rounded-lg border px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer shadow-xs transition-colors text-center ${
            isPending
              ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-700 dark:border-purple-600 hover:bg-purple-700 dark:hover:bg-purple-400'
              : 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-400'
          }`}
        >
          {isPending ? 'Answer Form' : 'View PDF'}
        </button>
      </div>
    </article>
  )
}

export default WaiverTrackerCard
