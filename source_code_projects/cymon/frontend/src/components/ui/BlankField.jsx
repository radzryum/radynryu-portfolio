import { blankInput } from './formStyles'

// A single "Label ______________" row from the printed CMPS forms: a label on
// the left and a fillable underline on the right. Pass custom children to put
// something other than a plain text input on the line (e.g. checkboxes).
// Pass `stacked` to put the label above the field (for narrow columns).
function BlankField({ label, hint, labelClassName = 'w-52', className = '', children, stacked = false }) {
  if (stacked) {
    return (
      <div className={`space-y-1 ${className}`}>
        {label || hint ? (
          <span className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
            {hint ? <span className="block text-[10px] italic leading-tight text-slate-500 dark:text-slate-400">{hint}</span> : null}
          </span>
        ) : null}
        <div className="min-w-0">{children ?? <input className={blankInput} />}</div>
      </div>
    )
  }
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      {label || hint ? (
        <span className={`shrink-0 ${labelClassName}`}>
          <span className="text-[12.5px] text-slate-800 dark:text-slate-200">{label}</span>
          {hint ? <span className="block text-[10px] italic leading-tight text-slate-500 dark:text-slate-400">{hint}</span> : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children ?? <input className={blankInput} />}</span>
    </div>
  )
}

export default BlankField
