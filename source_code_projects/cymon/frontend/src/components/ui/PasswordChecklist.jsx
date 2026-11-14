import { passwordChecks } from '../../lib/password'

// Live password-requirements checklist. Shows every rule with a pass/fail
// state as the user types, so the restrictions are visible BEFORE submit
// instead of arriving as an error after.
function PasswordChecklist({ password = '', className = '' }) {
  const checks = passwordChecks(password)
  return (
    <ul className={`mt-2 space-y-1 rounded-lg border border-purple-100 dark:border-slate-700 bg-purple-50/50 dark:bg-slate-800/50 px-3 py-2 ${className}`} aria-live="polite">
      {checks.map((check) => (
        <li
          key={check.key}
          className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${
            check.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
              check.pass ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
            }`}
            aria-hidden="true"
          >
            {check.pass ? '✓' : '·'}
          </span>
          {check.label}
        </li>
      ))}
    </ul>
  )
}

export default PasswordChecklist
