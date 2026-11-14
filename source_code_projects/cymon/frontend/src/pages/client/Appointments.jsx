import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import PageHeader from './PageHeader'
import DatePicker from '../../components/ui/DatePicker'
import Skeleton, { SkeletonText } from '../../components/ui/Skeleton'
import PageIntro from '../../components/ui/PageIntro'
import { api } from '../../lib/api'
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh'
import { AuthContext } from '../../auth/AuthContext'

const SESSION_LABEL = {
  mmse: 'MMSE Assessment',
  cafat: 'CAFAT Assessment',
  gars: 'GARS Assessment',
  initial_assessment: 'Initial Assessment',
  follow_up: 'Follow-up Session',
  therapy: 'Therapy Session',
  parent_consultation: 'Parent Consultation',
}

const STATUS_LABEL = {
  scheduled: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const CAL_TONE = {
  purple: 'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50',
  blue: 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50',
  green: 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50',
  orange: 'bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800/50',
  red: 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50',
}

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [clinic, setClinic] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const { profile } = useContext(AuthContext) || {}
  const userId = profile?.id
  const clinicId = profile?.clinic_id
  // Set on the first load only: background (realtime) refetches must not
  // yank the calendar back to the earliest month while the user browses.
  const didInitialFocusRef = useRef(false)

  const focusMonth = useCallback((list) => {
    if (!list.length) return
    const earliest = list.map((a) => new Date(a.starts_at)).sort((a, b) => a - b)[0]
    setCursor({ y: earliest.getFullYear(), m: earliest.getMonth() })
  }, [])

  const load = useCallback(() => {
    api.client
      .appointments()
      .then((d) => {
        setAppointments(d.appointments || [])
        setClinic(d.clinic)
        if (!didInitialFocusRef.current) {
          didInitialFocusRef.current = true
          focusMonth(d.appointments || [])
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
      })
  }, [focusMonth])

  useEffect(() => {
    load()
  }, [load])

  // Live-refresh the schedule. The clinic filter matches this patient's own
  // rows on delivery through the caregiver-owns_patient RLS policy (group
  // sessions with no patient_id stay invisible until the next fetch).
  useRealtimeRefresh(userId, clinicId ? [
    { table: 'appointments', filter: `clinic_id=eq.${clinicId}` },
  ] : [], load)

  const filtered = appointments

  const monthStart = new Date(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const offset = monthStart.getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
  const now = new Date()
  const todayDay = now.getFullYear() === cursor.y && now.getMonth() === cursor.m ? now.getDate() : null

  const eventsByDay = filtered.reduce((acc, a) => {
    const d = new Date(a.starts_at)
    if (d.getFullYear() !== cursor.y || d.getMonth() !== cursor.m) return acc
    const day = d.getDate()
    const ev = {
      id: a.id,
      tone: CAL_TONE[a.color_tag] || CAL_TONE.purple,
      title: `${timeOf(a.starts_at)} — ${SESSION_LABEL[a.session_type] || a.session_type}`,
      sub: a.practitioner || '—',
    }
    acc[day] = [...(acc[day] || []), ev]
    return acc
  }, {})

  const list = filtered
    .filter((a) => {
      const date = new Date(a.starts_at)
      return date.getFullYear() === cursor.y && date.getMonth() === cursor.m && date.getDate() === selectedDay
    })
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .map((a) => ({
      id: a.id,
      time: timeOf(a.starts_at),
      title: SESSION_LABEL[a.session_type] || a.session_type,
      practitioner: a.practitioner || '—',
      status: STATUS_LABEL[a.status] || a.status,
      location: a.location || (clinic && clinic.name) || '',
      notes: a.notes,
    }))

  const shiftMonth = (delta) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      setSelectedDay(1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const goToday = () => {
    const n = new Date()
    setCursor({ y: n.getFullYear(), m: n.getMonth() })
    setSelectedDay(n.getDate())
  }

  return (
    <>
      <PageHeader title="Appointments" />
      <div data-onboarding-key="client-appointments-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
        <PageIntro
          title="My Appointments Schedule"
          subtitle="Upcoming sessions and schedule details."
          className="hidden sm:block mb-3 sm:mb-4"
        />
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">Date:</label>
              <DatePicker
                onChange={(v) => {
                  if (!v) return
                  const parts = v.split('-')
                  if (parts.length === 3) {
                    const y = parseInt(parts[0], 10)
                    const m = parseInt(parts[1], 10) - 1
                    const d = parseInt(parts[2], 10)
                    setCursor({ y, m })
                    setSelectedDay(d)
                  }
                }}
                value={`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`}
                className="w-full sm:w-auto"
                ariaLabel="Choose date"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <section data-onboarding-key="client-appointments-calendar" key={loading ? 'loading' : 'loaded'} className="rounded-2xl border border-purple-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-xs transition-colors duration-300 animate-content-fade-in">
            {loading ? (
              <Skeleton className="h-72 w-full" rounded="rounded-2xl" />
            ) : (
              <>
                <div className="flex flex-row items-center justify-between gap-2 text-purple-700 dark:text-purple-300">
                  <button
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                    className="rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 cursor-pointer shadow-xs"
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold sm:text-lg">{monthLabel}</div>
                    <button
                      onClick={goToday}
                      className="rounded-md border border-purple-200 dark:border-slate-700 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      TODAY
                    </button>
                  </div>
                  <button
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                    className="rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 cursor-pointer shadow-xs"
                  >
                    Next
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] font-semibold tracking-wider text-purple-700 dark:text-purple-400 sm:text-[10px]">
                  {WEEKDAYS.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: offset }).map((_, i) => (
                    <div key={`o${i}`} />
                  ))}
                  {days.map((d) => {
                    const isSelected = selectedDay === d
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDay(d)}
                        className={`flex min-h-[48px] sm:min-h-[78px] w-full flex-col items-stretch justify-start rounded-md border p-0.5 sm:p-1.5 text-[9px] transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/50 cursor-pointer ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50/40 dark:bg-purple-900/30 shadow-xs ring-1 ring-purple-600'
                            : 'border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div
                          className={`mb-0.5 sm:mb-1 inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold ${
                            d === todayDay
                              ? 'bg-purple-700 text-white'
                              : isSelected
                              ? 'text-purple-700 dark:text-purple-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {d}
                        </div>
                        {(eventsByDay[d] || []).map((e) => (
                          <div key={e.id} className={`mt-0.5 rounded px-0.5 py-0.5 ${e.tone}`}>
                            <div className="truncate text-[8px] sm:text-[9px] font-semibold">{e.title}</div>
                            <div className="truncate text-[8px] opacity-80 hidden sm:block">{e.sub}</div>
                          </div>
                        ))}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          <aside data-onboarding-key="client-appointments-list" className="min-w-0 overflow-hidden rounded-2xl border border-purple-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs transition-colors duration-300">
            <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-300">
              Schedule: {monthLabel.split(' ')[0]} {selectedDay}
            </div>
            {loading ? (
              <div className="mt-3">
                <SkeletonText lines={5} />
              </div>
            ) : (
              <div className="mt-3.5 animate-content-fade-in">
                {list.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    <div className="flex justify-center mb-2">
                      <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="font-medium">No sessions scheduled</p>
                    <p className="text-[10px] mt-0.5">for this day</p>
                  </div>
                ) : (
                  <div className="relative border-l border-purple-100 dark:border-slate-700 pl-3.5 space-y-4">
                    {list.map((u) => (
                      <div key={u.id} className="relative min-w-0">
                        <span className="absolute -left-[19px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-purple-500 ring-4 ring-white dark:ring-slate-900 transition-colors" />
                        <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center justify-between gap-1">
                          <span>{u.time}</span>
                          <span className="rounded-full bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 text-[8px] font-semibold text-purple-700 dark:text-purple-300 capitalize">
                            {u.status}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                          {u.title}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-normal">
                          Practitioner: {u.practitioner}
                        </div>
                        {u.location ? (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium">
                            📍 {u.location}
                          </div>
                        ) : null}
                        {u.notes ? (
                          <p className="mt-1.5 max-w-full overflow-hidden break-words whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2 text-xs italic text-slate-600 dark:text-slate-300">
                            Note: {u.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}

export default Appointments
