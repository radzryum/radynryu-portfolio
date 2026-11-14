import { useId } from 'react'

function Select({ label, className = '', id, children, placeholder, ...rest }) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-purple-800 dark:text-purple-400 transition-colors">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className="h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-colors"
        defaultValue=""
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
    </div>
  )
}

export default Select
