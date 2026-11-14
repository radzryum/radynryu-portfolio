import { useEffect, useRef, useState } from 'react'

export default function AnimatedSelect({ options, value, onChange, placeholder = 'Select...', className = '', searchable, searchPlaceholder = 'Search...' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selectedOpt = options.find(o => o.value === value)
  const displayLabel = selectedOpt ? selectedOpt.label : placeholder
  // Long name lists (clinician filters) get a search field automatically;
  // short lists (branch, sort mode) stay as-is unless forced on.
  const showSearch = searchable ?? options.length >= 6

  // A checkbox-hack version used to stay open when anything else (e.g. the
  // Sign out dialog) appeared on top. Close on outside click / Escape so a
  // menu never floats detached above later UI.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (open) {
      setQuery('')
      if (showSearch) requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, showSearch ])

  const visibleOptions = (() => {
    if (!showSearch) return options
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return options
    return options.filter((o) =>
      tokens.every((t) => String(o.label || '').toLowerCase().includes(t)),
    )
  })()

  return (
    <div ref={rootRef} className={`cymon-animated-select-container ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="cymon-animated-trigger"
      >
        <span className="flex-1 truncate text-left pr-2">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-purple-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <ul className={`cymon-animated-list cymon-webkit-scrollbar ${open ? 'cymon-open' : ''}`} role="listbox">
        {showSearch ? (
          <li className="cymon-animated-listitem" role="presentation" onClick={(e) => e.stopPropagation()}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="cymon-animated-article w-full cursor-text bg-white text-sm font-normal text-slate-700 placeholder-slate-400 focus:outline-none dark:bg-slate-900 dark:text-slate-100"
            />
          </li>
        ) : null}
        {visibleOptions.map((opt) => (
          <li key={opt.value} className="cymon-animated-listitem" role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={(e) => {
                e.preventDefault()
                handleSelect(opt.value)
              }}
              className={`cymon-animated-article ${opt.value === value ? 'selected' : ''}`}
            >
              {opt.label}
            </button>
          </li>
        ))}
        {showSearch && visibleOptions.length === 0 ? (
          <li className="cymon-animated-listitem" role="presentation">
            <span className="cymon-animated-article cursor-default text-sm font-normal text-slate-400">
              No match found.
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
