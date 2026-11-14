const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50'

const variants = {
  primary:
    'bg-purple-700 text-white hover:bg-purple-800 active:bg-purple-900 dark:bg-purple-900/50 dark:border dark:border-purple-700 dark:text-purple-200 dark:hover:bg-purple-900/80 dark:active:bg-purple-900 transition-colors',
  secondary:
    'border border-purple-200 dark:border-purple-500/50 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700 active:bg-purple-100 dark:active:bg-slate-600 transition-colors',
  ghost: 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors',
}

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}

export default Button
