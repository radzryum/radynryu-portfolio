import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const pad = (value) => String(value).padStart(2, '0')
const toISODate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

const fmtDateMed = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Themed date picker: a button trigger with a calendar popover in the app's
// purple language, readable in both modes. Replaces native `type="date"`
// inputs, whose browser popup is unstyled and whose icon turns near-invisible
// in dark mode. Dates are `YYYY-MM-DD` strings; onChange receives the picked
// `YYYY-MM-DD` string (not an event). `disabledDays` optionally blocks
// weekdays by number (0 = Sunday, 6 = Saturday). Works controlled
// (`value` + `onChange`) or uncontrolled (omit both — the picker keeps its
// own state, handy for blank-template fields).
function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date',
  disabled = false,
  disabledDays = [],
  className = '',
  ariaLabel = 'Choose date',
}) {
  const [open, setOpen] = useState(false)
  const [inner, setInner] = useState('')
  const [cursor, setCursor] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })
  const wrapRef = useRef(null)
  const shown = value ?? inner
  const pick = (iso) => {
    if (value === undefined) setInner(iso)
    onChange?.(iso)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  const openPicker = () => {
    if (disabled) return
    const base = shown ? new Date(`${shown}T00:00:00`) : new Date()
    if (!Number.isNaN(base.getTime())) setCursor({ y: base.getFullYear(), m: base.getMonth() })
    setOpen((o) => !o)
  }
  const shift = (delta) => setCursor((c) => {
    const d = new Date(c.y, c.m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const monthIndex = cursor.y * 12 + cursor.m
  const minMonth = min ? (() => { const [y, m] = min.split('-').map(Number); return y * 12 + (m - 1) })() : null
  const maxMonth = max ? (() => { const [y, m] = max.split('-').map(Number); return y * 12 + (m - 1) })() : null
  // Month/year jump selects: swiping month-by-month to a birth year takes
  // dozens of taps, so the header lets users jump straight to any month/year.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const minYear = min ? Number(min.split('-')[0]) : 1900
  const maxYear = max ? Number(max.split('-')[0]) : 2100
  const yearOptions = []
  for (let y = maxYear; y >= minYear; y--) yearOptions.push(y)
  const setYear = (y) => setCursor((c) => {
    const lo = minMonth !== null && Math.floor(minMonth / 12) === y ? minMonth % 12 : 0
    const hi = maxMonth !== null && Math.floor(maxMonth / 12) === y ? maxMonth % 12 : 11
    return { y, m: Math.min(Math.max(c.m, lo), hi) }
  })
  const setMonth = (m) => setCursor((c) => ({ ...c, m }))
  const monthDisabled = (m) =>
    (minMonth !== null && cursor.y * 12 + m < minMonth) ||
    (maxMonth !== null && cursor.y * 12 + m > maxMonth)
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
  const dim = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  const todayISO = toISODate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const jumpSelectCls = 'rounded-md border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-1 text-xs font-bold text-purple-800 dark:text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer'

  return (
    <div ref={wrapRef} className={`relative ${disabled ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-md border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/80 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors hover:border-purple-300 dark:hover:border-slate-600 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${className}`}
      >
        <span className={shown ? 'truncate' : 'text-slate-400 dark:text-slate-500'}>{shown ? fmtDateMed(shown) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-purple-500 dark:text-purple-400" />
      </button>
      {open && !disabled ? (
        <div role="dialog" aria-label={ariaLabel} className="absolute left-0 top-full z-30 mt-1 w-full min-w-[268px] rounded-xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              disabled={minMonth !== null && monthIndex <= minMonth}
              aria-label="Previous month"
              className="rounded-md p-1 text-slate-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-purple-300"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              <select
                aria-label="Choose month"
                value={cursor.m}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={`${jumpSelectCls} max-w-[104px]`}
              >
                {MONTHS.map((name, m) => (
                  <option key={name} value={m} disabled={monthDisabled(m)}>{name}</option>
                ))}
              </select>
              <select
                aria-label="Choose year"
                value={cursor.y}
                onChange={(e) => setYear(Number(e.target.value))}
                className={jumpSelectCls}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => shift(1)}
              disabled={maxMonth !== null && monthIndex >= maxMonth}
              aria-label="Next month"
              className="rounded-md p-1 text-slate-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-purple-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <span key={`x-${i}`} />
              const iso = toISODate(cursor.y, cursor.m, day)
              const outOfRange = (min && iso < min) || (max && iso > max)
              const closedDay = disabledDays.includes(new Date(cursor.y, cursor.m, day).getDay())
              const selected = shown === iso
              const isToday = iso === todayISO
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={outOfRange || closedDay}
                  onClick={() => pick(iso)}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    selected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-purple-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  } ${!selected && isToday ? 'ring-1 ring-purple-400' : ''}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DatePicker
