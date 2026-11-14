import { useEffect, useMemo, useRef, useState } from 'react'

// Searchable dropdown for name lists (clinicians, students, facilitators).
// Native <select> can't filter, so this renders a button + popover with a
// search field on top and a scrollable option list below. Type to narrow,
// click or Enter to pick, Esc / outside click to close.
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search name...',
  emptyText = 'No match found.',
  disabled = false,
  className = '',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selectedOpt = options.find((o) => String(o.value) === String(value))
  const displayLabel = selectedOpt ? selectedOpt.label : placeholder

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

  useEffect(() => {
    if (open) {
      setQuery('')
      // Focus the search field so typing filters immediately.
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open ])

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return options
    return options.filter((o) =>
      tokens.every((t) => String(o.label || '').toLowerCase().includes(t)),
    )
  }, [options, query ])

  const handleSelect = (val) => {
    onChange?.(val)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-purple-200 bg-purple-50/30 px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:border-purple-300 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-purple-500/20"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOpt ? '' : 'text-slate-400'}`}>
          {displayLabel}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-purple-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-purple-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-purple-100 p-2 dark:border-slate-700">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault()
                  handleSelect(filtered[0].value)
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-md border border-purple-200 bg-purple-50/50 px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-purple-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {filtered.map((opt) => {
              const selected = String(opt.value) === String(value)
              return (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      selected
                        ? 'bg-purple-100 font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
                        : 'text-slate-700 hover:bg-purple-50 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {selected ? <span aria-hidden="true">✓</span> : null}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 ? (
              <li className="px-2.5 py-3 text-sm text-slate-500 dark:text-slate-400">{emptyText}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
