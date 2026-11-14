import { useId } from 'react'

export default function Radio({
  label,
  checked,
  onChange,
  className = '',
  name,
  value,
  disabled,
  colorClass = 'bg-purple-700 text-white border-purple-700', // Default active
  unselectedClass = 'bg-white border-purple-200 text-purple-700 hover:bg-purple-50 dark:bg-slate-800 dark:border-purple-900 dark:text-purple-300 dark:hover:bg-slate-800', // Default inactive
}) {
  const generatedId = useId()
  const inputId = generatedId

  return (
    <div className="cymon-radio-wrapper inline-flex">
      <input
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer accent-purple-700 focus-visible:outline-none"
      />
      <label
        htmlFor={inputId}
        className={`cymon-radio-label ${className} ${checked ? colorClass : unselectedClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500 peer-focus-visible:ring-offset-2 peer-focus-visible:rounded-lg`}
      >
        {label}
      </label>
    </div>
  )
}
