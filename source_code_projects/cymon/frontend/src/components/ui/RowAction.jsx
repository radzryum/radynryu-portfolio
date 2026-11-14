// Compact table-row action button. Consistent View/Edit styling across every
// table: `view` is an outlined purple button, `edit` is a solid emerald button,
// `download` is outlined purple with a download arrow.
const variants = {
  view: 'border border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-900/60 dark:text-purple-300 dark:hover:bg-slate-800',
  edit: 'bg-emerald-500 text-white hover:bg-emerald-600',
}

function RowAction({ variant = 'view', className = '', type = 'button', children, ...rest }) {
  if (variant === 'view') {
    return (
      <button type={type} className={`cymon-view-btn ${className}`} {...rest}>
        <span className="IconContainer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </span>
        <span className="text">{children || 'View'}</span>
      </button>
    )
  }

  if (variant === 'download') {
    return (
      <button type={type} className={`cymon-view-btn cymon-view-btn-wide ${className}`} {...rest}>
        <span className="IconContainer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </span>
        <span className="text">{children || 'Download'}</span>
      </button>
    )
  }

  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export default RowAction
