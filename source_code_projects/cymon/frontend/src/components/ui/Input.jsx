import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const tones = {
  default:
    'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet focus:ring-violet/30 transition-colors',
  purple:
    'border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet focus:ring-violet/30 transition-colors',
}

const labelTones = {
  default: 'text-slate-700 dark:text-slate-300 transition-colors',
  purple: 'text-violet dark:text-purple-400 transition-colors',
}

function Input({ label, className = '', inputClassName = '', id, tone = 'default', type = 'text', ...rest }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [showPassword, setShowPassword] = useState(false)

  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
  // Passwords must be typed, not pasted or dropped in — so "confirm"
  // fields actually prove the user knows the password.
  const blockPasswordPaste = (event) => event.preventDefault()

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className={`text-sm font-medium ${labelTones[tone]}`}
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          onPaste={isPassword ? blockPasswordPaste : undefined}
          onDrop={isPassword ? blockPasswordPaste : undefined}
          title={isPassword ? 'For security, please type your password instead of pasting it.' : undefined}
          className={`h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 ${tones[tone]} ${inputClassName} ${isPassword ? 'pr-10' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  )
}

export default Input
