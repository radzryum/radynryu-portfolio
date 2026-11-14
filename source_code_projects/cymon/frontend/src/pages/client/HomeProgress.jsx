import { useCallback, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from './PageHeader'
import { api } from '../../lib/api'
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh'
import { AuthContext } from '../../auth/AuthContext'
import Skeleton, { SkeletonStatCard } from '../../components/ui/Skeleton'
import PageSubtitle from '../../components/ui/PageSubtitle'

const SESSION_LABEL = {
  mmse: 'MMSE Assessment',
  cafat: 'CAFAT Assessment',
  gars: 'GARS-3 Assessment',
  initial_assessment: 'Initial Assessment',
  follow_up: 'Follow-up Session',
  therapy: 'Therapy Session',
  parent_consultation: 'Parent Consultation',
}

const formatDateStr = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parts[2]
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthName = months[monthIdx] || ''
  return `${monthName} ${parseInt(day, 10)}`
}

const getShortDayName = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[date.getDay()]
}

const getShortDateOnly = (dateStr) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[monthIdx]} ${day}`
}

function MoodIcon({ value }) {
  if (value === 5) {
    return (
      <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] fill-green-400 stroke-green-500 transition-transform duration-300 group-hover:scale-110">
        <style>{`
          @keyframes star-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .star-eye { transform-origin: center; animation: star-spin 6s linear infinite; }
        `}</style>
        <circle cx="50" cy="50" r="45" strokeWidth="3" />
        <path d="M 35 32 L 38 38 L 44 38 L 39 42 L 41 48 L 35 44 L 29 48 L 31 42 L 26 38 L 32 38 Z" className="fill-green-800 stroke-none star-eye" style={{ transformOrigin: '35px 40px' }} />
        <path d="M 65 32 L 68 38 L 74 38 L 69 42 L 71 48 L 65 44 L 59 48 L 61 42 L 56 38 L 62 38 Z" className="fill-green-800 stroke-none star-eye" style={{ transformOrigin: '65px 40px' }} />
        <path d="M 25 55 Q 50 85 75 55 Z" className="fill-white stroke-green-800" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    )
  }
  if (value === 4) {
    return (
      <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] fill-emerald-400 stroke-emerald-500 transition-transform duration-300 group-hover:scale-110">
        <style>{`
          @keyframes blink { 0%, 96%, 98% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
          .eye { transform-origin: center; animation: blink 4s infinite; }
        `}</style>
        <circle cx="50" cy="50" r="45" strokeWidth="3" />
        <circle cx="35" cy="40" r="6" className="fill-emerald-800 stroke-none eye" />
        <circle cx="65" cy="40" r="6" className="fill-emerald-800 stroke-none eye" />
        <path d="M 30 60 Q 50 75 70 60" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-emerald-800" />
      </svg>
    )
  }
  if (value === 3) {
    return (
      <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] fill-amber-300 stroke-amber-400 transition-transform duration-300 group-hover:scale-110">
        <style>{`
          @keyframes blink { 0%, 96%, 98% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
          .eye-offset { transform-origin: center; animation: blink 4s infinite 1s; }
        `}</style>
        <circle cx="50" cy="50" r="45" strokeWidth="3" />
        <circle cx="35" cy="40" r="6" className="fill-amber-800 stroke-none eye-offset" />
        <circle cx="65" cy="40" r="6" className="fill-amber-800 stroke-none eye-offset" />
        <line x1="35" y1="65" x2="65" y2="65" strokeWidth="5" strokeLinecap="round" className="stroke-amber-800" />
      </svg>
    )
  }
  if (value === 2) {
    return (
      <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] fill-orange-300 stroke-orange-400 transition-transform duration-300 group-hover:scale-110">
        <style>{`
          @keyframes blink { 0%, 96%, 98% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
          @keyframes tear { 0%, 50% { transform: translateY(0) scale(1); opacity: 0; } 60% { opacity: 1; } 100% { transform: translateY(15px) scale(0); opacity: 0; } }
          .eye-sad { transform-origin: center; animation: blink 4s infinite 2s; }
          .tear { animation: tear 3s infinite; }
        `}</style>
        <circle cx="50" cy="50" r="45" strokeWidth="3" />
        <circle cx="35" cy="40" r="6" className="fill-orange-800 stroke-none eye-sad" />
        <circle cx="65" cy="40" r="6" className="fill-orange-800 stroke-none eye-sad" />
        <path d="M 30 70 Q 50 55 70 70" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-orange-800" />
        <path d="M 65 48 Q 68 55 65 58 Q 62 55 65 48 Z" className="fill-sky-400 stroke-none tear" />
      </svg>
    )
  }
  if (value === 1) {
    return (
      <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] fill-rose-400 stroke-rose-500 transition-transform duration-300 group-hover:scale-110">
        <style>{`
          @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-1px) rotate(-1deg); } 75% { transform: translateX(1px) rotate(1deg); } }
          .angry-face { animation: shake 0.6s infinite; }
        `}</style>
        <circle cx="50" cy="50" r="45" strokeWidth="3" />
        <g className="angry-face" style={{ transformOrigin: 'center' }}>
          <line x1="25" y1="30" x2="42" y2="38" strokeWidth="6" strokeLinecap="round" className="stroke-rose-900" />
          <line x1="75" y1="30" x2="58" y2="38" strokeWidth="6" strokeLinecap="round" className="stroke-rose-900" />
          <circle cx="35" cy="45" r="5" className="fill-rose-900 stroke-none" />
          <circle cx="65" cy="45" r="5" className="fill-rose-900 stroke-none" />
          <path d="M 30 70 L 40 64 L 50 70 L 60 64 L 70 70" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="stroke-rose-900" />
        </g>
      </svg>
    )
  }
  return <div className="text-xl sm:text-2xl text-slate-300">?</div>
}

function FeelingsWeek({ points, loading, allowJournalEntry }) {
  if (loading) return <Skeleton className="h-40 w-full" rounded="rounded-xl" />

  // Generate the last 7 days including today
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  const MOOD_COLORS = {
    5: { label: 'Great', color: 'bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800' },
    4: { label: 'Good', color: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800' },
    3: { label: 'Okay', color: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' },
    2: { label: 'Sad', color: 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800' },
    1: { label: 'Very Bad', color: 'bg-rose-100 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800' },
  }

  // Create a map of date -> point
  const pointsMap = (points || []).reduce((acc, p) => {
    if (p.date) acc[p.date] = p
    return acc
  }, {})

  const todayStr = new Date().toISOString().slice(0, 10)
  
  // Find the most recent mood to display a message
  const recentPoint = [...(points || [])].reverse().find(p => p.value >= 1 && p.value <= 5)
  const message = recentPoint 
    ? (recentPoint.value >= 4 ? "Keep shining! ✨" : recentPoint.value === 3 ? "Taking it one day at a time 💛" : "We're here for you 💜")
    : "Tell us how you feel today!"

  return (
    <div className="w-full animate-[cymonModalFade_0.4s_ease-out]">
      <div className="flex flex-col items-center pt-2 pb-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">
          {message}
        </p>
        
        <div className="flex justify-between w-full max-w-lg px-2">
          {last7Days.map((dateStr) => {
            const isToday = dateStr === todayStr
            const point = pointsMap[dateStr]
            const moodConfig = point ? MOOD_COLORS[point.value] : null
            
            return (
              <div key={dateStr} className="flex flex-col items-center gap-2 group">
                <div 
                  className={`
                    flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 cursor-default relative transition-colors duration-300
                    ${isToday ? 'ring-4 ring-purple-100 dark:ring-purple-900 ring-offset-2 dark:ring-offset-slate-900' : ''}
                    ${moodConfig ? moodConfig.color : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-dashed'}
                  `}
                  title={moodConfig ? `${moodConfig.label} on ${formatDateStr(dateStr)}` : `No entry on ${formatDateStr(dateStr)}`}
                >
                  <MoodIcon value={point?.value} />
                </div>
                <div className="flex flex-col items-center mt-1">
                  <div className={`text-[11px] sm:text-xs font-bold transition-colors ${isToday ? 'text-purple-700 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {isToday ? 'Today' : getShortDayName(dateStr)}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-0.5">
                    {getShortDateOnly(dateStr)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {(!points || points.length === 0) && allowJournalEntry && (
        <div className="mt-2 flex justify-center pb-2">
          <Link to="/client/activity" className="rounded-full bg-purple-100 px-4 py-1.5 text-[11px] font-bold text-purple-700 hover:bg-purple-200 transition-colors">
            Log your feelings now →
          </Link>
        </div>
      )}
    </div>
  )
}

const AppointmentCard = ({ title, appt, loading = false, tone = 'purple', emptyText }) => {
  const dt = appt ? new Date(appt.starts_at) : null
  const palette = tone === 'slate'
      ? { bg: 'bg-slate-100 dark:bg-slate-800', num: 'text-slate-800 dark:text-slate-200', sub: 'text-slate-600 dark:text-slate-300', meta: 'text-slate-500 dark:text-slate-400' }
      : { bg: 'bg-purple-100 dark:bg-purple-900/40', num: 'text-purple-900 dark:text-purple-100', sub: 'text-purple-800 dark:text-purple-200', meta: 'text-purple-700 dark:text-purple-300' }
  
  return (
    <div className={`rounded-2xl ${palette.bg} p-3.5 sm:p-5 shadow-xs transition-colors duration-300`}>
      <div className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-purple-300">{title}</div>
      {loading ? (
        <div className="mt-3 space-y-2.5">
          <Skeleton className="h-9 w-14" rounded="rounded-lg" />
          <Skeleton className="h-3 w-36" rounded="rounded-md" />
          <Skeleton className="h-3 w-44" rounded="rounded-md" />
        </div>
      ) : appt ? (
        <div className="animate-[cymonModalFade_0.4s_ease-out]">
          <div className={`mt-2 sm:mt-3 text-2xl sm:text-3xl font-extrabold ${palette.num}`}>{dt.getDate()}</div>
          <div className={`text-xs sm:text-sm font-medium ${palette.sub}`}>
            {dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} · {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className={`mt-1.5 sm:mt-2 text-[11px] sm:text-xs ${palette.meta}`}>
            {SESSION_LABEL[appt.session_type] || appt.session_type}<br />
            {[appt.practitioner, appt.location].filter(Boolean).join(' · ')}
          </div>
        </div>
      ) : <div className={`mt-2 sm:mt-3 text-xs sm:text-sm ${palette.meta} animate-[cymonModalFade_0.4s_ease-out]`}>{emptyText}</div>}
    </div>
  )
}

function HomeProgress() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const { profile } = useContext(AuthContext) || {}
  const userId = profile?.id

  const load = useCallback(() => {
    api.client.home()
      .then((d) => { setData(d); setLoadError(null) })
      .catch((err) => setLoadError(err?.message || 'Unable to load your dashboard.'))
  }, [])

  useEffect(() => {
    let timer
    load()
    timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    window.addEventListener('cymon:notification-update', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('cymon:notification-update', load)
    }
  }, [load])

  // Live-refresh the dashboard aggregate. patients is scoped to the
  // caregiver's own child; daily_activity_logs carries no clinic column, so
  // delivery relies on its caregiver-owns_patient RLS policy (the view stays
  // server-truth because events only refetch load()). session_logs is
  // intentionally not subscribed — this page renders no session-log rows.
  useRealtimeRefresh(userId, userId ? [
    { table: 'patients', filter: `caregiver_id=eq.${userId}` },
    { table: 'daily_activity_logs' },
  ] : [], load)

  const loading = !data && !loadError
  const submittedToday = data?.moodSeries?.some((m) => m.date === new Date().toISOString().slice(0, 10))

  return (
    <>
      <PageHeader title={data?.patient ? `Good Day, ${data.patient.first_name}!` : 'Welcome'} />
      <div data-onboarding-key="client-home-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#311465] dark:text-purple-100 tracking-tight">
            {data?.patient ? `Good Day, ${data.patient.first_name}!` : 'Welcome'}
          </h1>
          <PageSubtitle className="hidden sm:block mb-3 sm:mb-4 mt-1 text-xs sm:text-sm text-slate-500">
            Your care team, schedule, assessments, and daily progress in one place.
          </PageSubtitle>
        </div>

        {loadError ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-sm font-semibold text-rose-800">{loadError}</p>
            <p className="mt-1 text-xs text-rose-600">Reload the page to try again.</p>
          </section>
        ) : null}

        <section data-onboarding-key="client-home-stats" className="grid grid-cols-2 gap-2.5 sm:gap-4">
          <Link to="/client/assessments" className="rounded-2xl bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-xs border border-purple-100/60 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-500 transition-colors cursor-pointer flex items-center group">
            <div className="w-full">
              {loading ? <div className="skeleton h-7 sm:h-8 w-12 rounded-md mb-1" /> : <div className="text-xl sm:text-2xl font-extrabold text-purple-800 dark:text-purple-400 animate-[cymonModalFade_0.4s_ease-out]">{data?.stats?.assignedAssessments ?? 0}</div>}
              <div className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Pending Assessments</div>
            </div>
          </Link>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-xs border border-purple-100/60 dark:border-slate-800 flex items-center group transition-colors duration-300">
            <div className="w-full">
              {loading ? (
                <div className="skeleton h-7 sm:h-8 w-16 rounded-md mb-1" />
              ) : !data?.patient?.allow_journal_entry ? (
                <div className="text-xl sm:text-2xl font-extrabold text-slate-400 dark:text-slate-500 animate-[cymonModalFade_0.4s_ease-out]">Locked</div>
              ) : (
                <div className={`text-xl sm:text-2xl font-extrabold ${submittedToday ? 'text-green-600 dark:text-green-500' : 'text-amber-500 dark:text-amber-400'} animate-[cymonModalFade_0.4s_ease-out]`}>{submittedToday ? 'Submitted' : 'Pending'}</div>
              )}
              <div className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Turn in Daily Journal</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs transition-colors duration-300">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
            My Support Plan
          </h3>
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-6 w-24" rounded="rounded-full" />
              <Skeleton className="h-2.5 w-full" rounded="rounded-full" />
            </div>
          ) : data?.clinical ? (
            <div className="animate-[cymonModalFade_0.4s_ease-out]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-3 py-1 text-[11px] font-bold text-purple-800 dark:text-purple-200">
                  {data.clinical.support_level || data.clinical.iep_level || 'Support level to be set'}
                </span>
                {data.clinical.milestone_progress != null ? (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{data.clinical.milestone_progress}% milestone progress</span>
                ) : null}
              </div>
              {data.clinical.milestone_progress != null ? (
                <div
                  className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-purple-100 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuenow={data.clinical.milestone_progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Milestone progress ${data.clinical.milestone_progress} percent`}
                >
                  <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, data.clinical.milestone_progress))}%` }} />
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Your psychologist will post milestone updates here.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Your support plan will appear here once set by your care team.</p>
          )}
        </section>

        <div data-onboarding-key="client-home-care-team" className="rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs transition-colors duration-300">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
            Assigned Clinical Care Team
          </h3>
          {loading ? (
             <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
               {[0, 1].map((i) => (
                 <div key={i} className="flex items-center gap-3.5 rounded-xl border border-purple-100/50 bg-purple-50/40 p-3 sm:p-4">
                   <div className="skeleton h-12 w-12 shrink-0 rounded-full" />
                   <div className="flex-1 space-y-2">
                     <Skeleton className="h-2.5 w-20" rounded="rounded-full" />
                     <Skeleton className="h-4 w-28" rounded="rounded-md" />
                     <Skeleton className="h-2.5 w-32" rounded="rounded-md" />
                   </div>
                 </div>
               ))}
             </div>
          ) : data?.patient && (data.patient.treating_psychologist || data.patient.treating_psychometrician) ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-[cymonModalFade_0.4s_ease-out]">
              {[data.patient.treating_psychologist, data.patient.treating_psychometrician].filter(Boolean).map((p, i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-xl border border-purple-100/50 dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/50 p-3 sm:p-4 transition-colors">
                  <div className="shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-purple-100" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-200 text-lg font-bold text-purple-700 shadow-sm ring-2 ring-purple-100">
                        {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">{i === 0 ? 'Psychologist' : 'Psychometrician'}</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold uppercase text-slate-800 dark:text-slate-100">{p.name}</div>
                    <div className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">PRC License No: {p.prc_id || 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="rounded-xl border border-dashed border-purple-200 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800/50 px-3.5 py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 animate-[cymonModalFade_0.4s_ease-out]">No assigned team.</div>}
        </div>

        <section className="grid grid-cols-1 gap-3.5 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs lg:col-span-2 transition-colors duration-300">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-300">My Feelings This Week</div>
            </div>
            <FeelingsWeek 
              points={data?.moodSeries} 
              loading={loading} 
              allowJournalEntry={data?.patient?.allow_journal_entry} 
            />
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <AppointmentCard title="Next Appointment" appt={data?.nextAppointment} loading={loading} emptyText="No upcoming appointment." />
            <AppointmentCard title="Last Appointment" appt={data?.lastAppointment} loading={loading} tone="slate" emptyText="No past appointment." />
          </div>
        </section>

        {data?.announcements?.length > 0 && (
          <section className="rounded-2xl border border-rose-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs animate-[cymonModalFade_0.4s_ease-out] transition-colors duration-300">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">
              Recent Announcements
            </h3>
            <div className="space-y-3">
              {data.announcements.map(a => (
                <div key={a.id} className="rounded-xl border border-rose-50 dark:border-slate-700 bg-rose-50/40 dark:bg-slate-800/50 p-3.5 transition-colors">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{a.title}</h4>
                  {a.body && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{a.body}</p>}
                </div>
              ))}
            </div>
            <Link to="/client/announcements" className="mt-4 block text-center text-[11px] font-bold text-rose-600 hover:text-rose-800 transition-colors">
              View all announcements →
            </Link>
          </section>
        )}
      </div>
    </>
  )
}

export default HomeProgress
