function PageSubtitle({ children, className = '' }) {
  return (
    <div className={`mt-3 rounded-xl bg-purple-200/70 dark:bg-purple-900/30 px-3 py-2 text-xs text-purple-900 dark:text-purple-300 sm:px-4 sm:text-sm transition-colors ${className}`}>
      {children}
    </div>
  )
}

export default PageSubtitle
