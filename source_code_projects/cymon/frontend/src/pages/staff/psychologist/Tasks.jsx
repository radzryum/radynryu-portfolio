import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, ClipboardList, CheckSquare,
  BookOpenText, LineChart, BookOpen,
  Clock, CheckCircle2, ArrowRight, FileText, ChevronDown, Users
} from 'lucide-react'
import StaffHeader from '../StaffHeader'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'
import { capitalizeName } from '../../../lib/format'
import { toast } from 'react-hot-toast'
import Skeleton from '../../../components/ui/Skeleton'
import Avatar from '../../../components/ui/Avatar'

const statusTone = {
  SCHEDULED: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  submitted: 'bg-amber-100 text-amber-700 border border-amber-200',
  ready_for_review: 'bg-amber-100 text-amber-700 border border-amber-200',
  processed: 'bg-blue-100 text-blue-700 border border-blue-200',
  draft: 'bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 transition-colors',
  in_progress: 'bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 transition-colors',
  revise_requested: 'bg-orange-100 text-orange-700 border border-orange-200',
}

// Group bookings show a Users icon instead of one child's photo —
// picking a single photo looks like an individual session.
const TaskAvatar = ({ task }) => {
  if (task?.format === 'group') {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 ring-1 ring-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-800"
        aria-label={`Group session with ${task?.name || 'students'}`}
        title={task?.name || 'Group session'}
      >
        <Users className="h-6 w-6" />
      </div>
    )
  }
  return <Avatar name={task?.name} src={task?.photo_url} size="md" />
}

const MetricCard = ({ title, value, icon: Icon, tone, bgTone }) => (
  <div className={`relative flex flex-col justify-center rounded-2xl border ${tone} bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md h-full transition-colors`}>
    <div className="relative z-10 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${bgTone}`}>
        <Icon className={`h-6 w-6 ${tone.replace('border-', 'text-').replace('-200', '-700').replace('-100', '-700')} dark:${tone.replace('border-', 'text-').replace('-200', '-300').replace('-100', '-300')}`} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">{title}</div>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors">{value}</div>
      </div>
    </div>
  </div>
)

const QuickAction = ({ title, description, icon: Icon, onClick, color }) => {
  const colorMap = {
    indigo: { border: 'hover:border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600', hoverBg: 'group-hover:bg-indigo-100' },
    blue: { border: 'hover:border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600', hoverBg: 'group-hover:bg-blue-100' },
    emerald: { border: 'hover:border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600', hoverBg: 'group-hover:bg-emerald-100' },
    purple: { border: 'hover:border-purple-200 dark:border-slate-700 transition-colors', bg: 'bg-purple-50', text: 'text-purple-600', hoverBg: 'group-hover:bg-purple-100' },
  }
  const c = colorMap[color] || colorMap.indigo
  return (
    <button 
      onClick={onClick}
      className={`group flex w-full flex-col items-start rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${c.border.replace('hover:border-', 'hover:border-').split(' ')[0]} dark:hover:border-slate-600`}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} dark:bg-slate-800 ${c.text} dark:text-slate-300 ${c.hoverBg.split(' ')[0]} dark:group-hover:bg-slate-700 transition-colors`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors">{title}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">{description}</div>
    </button>
  )
}

function Tasks() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sessions')
  const [expanded, setExpanded] = useState({})
  const [doneBusyId, setDoneBusyId] = useState(null)

  const loadTasks = async () => {
    try {
      const d = await api.psychologist.tasks()
      const nextTasks = d.tasks || []
      const nextAssessments = d.assessments || []
      setTasks(nextTasks)
      setAssessments(nextAssessments)
      // Land on the most urgent non-empty queue: today's sessions first,
      // then upcoming bookings, then approvals. Otherwise keep the open tab.
      const ref = new Date()
      const isTodayRef = (iso) => {
        const dd = new Date(iso)
        return dd.getFullYear() === ref.getFullYear() && dd.getMonth() === ref.getMonth() && dd.getDate() === ref.getDate()
      }
      const hasToday = nextTasks.some((t) => t.status === 'SCHEDULED' && isTodayRef(t.starts_at))
      const hasUpcoming = nextTasks.some(
        (t) => t.status === 'SCHEDULED' && !isTodayRef(t.starts_at) && new Date(t.starts_at) > ref,
      )
      if (hasToday) {
        setActiveTab('sessions')
      } else if (hasUpcoming) {
        setActiveTab('upcoming')
      } else if (nextAssessments.length) {
        setActiveTab('assessments')
      }
    } catch {
      /* keep the previous list when a background refresh fails */
    }
  }

  useEffect(() => {
    let on = true
    setLoading(true)
    loadTasks().finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
  }, [])

  // Live-refresh the queue when bookings or review work change elsewhere.
  // assessment_submissions/assessment_reports carry no clinic_id column, so
  // they subscribe unfiltered — RLS still delivers only own-clinic assigned
  // rows. Refetch keeps the view server-truth.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId
      ? [
          { table: 'appointments', filter: `clinic_id=eq.${clinicId}` },
          { table: 'assessment_submissions' },
          { table: 'assessment_reports' },
        ]
      : [],
    () => {
      loadTasks()
    },
  )

  const markSessionDone = async (id) => {
    setDoneBusyId(id)
    try {
      await api.psychologist.completeAppointment(id, { status: 'completed' })
      toast.success('Session marked as done.')
      await loadTasks()
    } catch (e) {
      toast.error(e.message || 'Failed to update the session.')
    } finally {
      setDoneBusyId(null)
    }
  }

  const now = new Date()
  const isToday = (iso) => {
    const d = new Date(iso)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }
  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const scheduledTasks = tasks.filter((t) => t.status === 'SCHEDULED' && isToday(t.starts_at))
  // Future bookings the Front Desk made for you — invisible before this tab
  // existed (the queue only ever showed today). Sorted oldest-first already
  // by the API; cancelled sessions never reach here (status CANCELLED).
  const upcomingTasks = tasks
    .filter((t) => t.status === 'SCHEDULED' && !isToday(t.starts_at) && new Date(t.starts_at) > now)
    .slice()
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const upcomingWhen = (iso) => {
    const d = new Date(iso)
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  }
  const pendingDocuments = assessments.filter((a) =>
    ['submitted', 'processed', 'ready_for_review'].includes(a.status) &&
    (a.type === 'submission' || a.type === 'report'),
  )

  const groupedDocuments = useMemo(() => {
    const map = new Map()
    for (const doc of pendingDocuments) {
      const key = doc.patientId
      if (!map.has(key)) {
        map.set(key, {
          patientId: key,
          patientName: doc.patientName,
          photo_url: doc.photo_url,
          meta: doc.meta,
          docs: [],
        })
      }
      map.get(key).docs.push(doc)
    }
    return Array.from(map.values())
  }, [pendingDocuments])

  const navigateToDoc = (doc) => {
    const pid = encodeURIComponent(doc.patientId || '')
    const rid = encodeURIComponent(doc.id || '')
    const code = (doc.code || '').toUpperCase()
    const rType = (doc.reportType || '').toLowerCase()
    if (doc.type === 'submission') {
      navigate(`/psychologist/approvals?patientId=${pid}&section=submissions&reportId=${rid}`)
    } else if (code === 'CMPS:SE-FO-06' || rType === 'behavioral') {
      navigate(`/psychologist/approvals?patientId=${pid}&section=behavioral&reportId=${rid}`)
    } else if (code === 'CMPS:SE-FO-10' || rType === 'iep') {
      navigate(`/psychologist/approvals?patientId=${pid}&section=iep&reportId=${rid}`)
    } else if (code === 'CMPS:SE-FO-07' || rType === 'daily_activity') {
      navigate(`/psychologist/activity?patientId=${pid}`)
    } else if (code === 'CMPS:SE-FO-09' || code === 'CMPS:SE-FO-08' || rType === 'progress_summary') {
      navigate(`/psychologist/progress?patientId=${pid}`)
    } else {
      navigate(`/psychologist/approvals?patientId=${pid}`)
    }
  }

  return (
    <>
      <StaffHeader title={`Good Day, ${capitalizeName(profile?.display_name) || 'Doctor'}!`} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors dark:bg-slate-950 transition-colors" data-onboarding-key="psychologist-tasks-workspace">
        
        {/* Metrics Row */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard 
            title="Sessions Today" 
            value={loading ? '-' : scheduledTasks.length} 
            icon={Calendar} 
            tone="border-indigo-200 dark:border-indigo-800" 
            bgTone="bg-indigo-50 dark:bg-indigo-900/40" 
          />
          <MetricCard 
            title="Pending Approvals" 
            value={loading ? '-' : pendingDocuments.length} 
            icon={ClipboardList} 
            tone="border-amber-200 dark:border-amber-800" 
            bgTone="bg-amber-50 dark:bg-amber-900/40" 
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 items-start">
          
          {/* Main Task Area */}
          <div className="xl:col-span-2 h-full">
            <section
              className="flex h-full flex-col rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 shadow-sm overflow-hidden transition-colors"
              data-onboarding-key="psychologist-tasks-queue"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950 transition-colors/50 dark:bg-slate-900/50 shrink-0 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors">Today's Queue</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors sm:pl-7">
                    Sessions booked for you by the Front Desk · {todayLabel}
                  </p>
                </div>
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-sm font-semibold transition-colors">
                  <button
                    onClick={() => setActiveTab('sessions')}
                    className={`flex items-center gap-2 rounded-md px-4 py-1.5 transition-all cursor-pointer ${
                      activeTab === 'sessions' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Sessions</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'sessions' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {scheduledTasks.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex items-center gap-2 rounded-md px-4 py-1.5 transition-all cursor-pointer ${
                      activeTab === 'upcoming' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Upcoming</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'upcoming' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {upcomingTasks.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('assessments')}
                    className={`flex items-center gap-2 rounded-md px-4 py-1.5 transition-all cursor-pointer ${
                      activeTab === 'assessments' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Approvals</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'assessments' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {pendingDocuments.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-2 flex-1 overflow-y-auto overflow-x-hidden">
                <ul key={activeTab} className="divide-y divide-slate-100 dark:divide-slate-800 h-full motion-safe:animate-[cymonModalFade_0.2s_ease-out_both]">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="p-4">
                        <Skeleton className="h-16 w-full rounded-xl" />
                      </li>
                    ))
                  ) : (
                    <>
                      {activeTab === 'sessions' ? (
                        <>
                          {scheduledTasks.length === 0 ? (
                            <li className="flex h-full flex-col items-center justify-center py-12 text-center min-h-[300px]">
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors dark:bg-slate-800 p-4 mb-3 transition-colors">
                                <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400">No sessions scheduled for today.</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Sessions booked for you by the Front Desk will appear here.</p>
                            </li>
                          ) : null}
                          {scheduledTasks.map((t) => (
                            <li key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 dark:bg-slate-950 transition-colors dark:hover:bg-slate-800/50">
                              <div className="flex items-center gap-4">
                                <TaskAvatar task={t} />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors"><span>{capitalizeName(t.name)}</span>{t.format === 'group' ? (<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Group</span>) : null}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">
                                    <span className="font-medium">{t.detail}</span>
                                    <span>·</span>
                                    <span>{t.meta.split('·')[1] || t.meta}</span>
                                    <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800 transition-colors">
                                      {t.room}
                                    </span>
                                  </div>
                                  {t.booked_by ? (
                                    <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 transition-colors">
                                      Booked by {capitalizeName(t.booked_by)} · Front Desk
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-800 pt-3 sm:border-0 sm:pt-0 transition-colors">
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors dark:text-slate-300 transition-colors">{t.time}</div>
                                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${statusTone[t.status] || 'bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                                    {t.status}
                                  </span>
                                </div>
                                <button
                                  onClick={() => markSessionDone(t.id)}
                                  disabled={doneBusyId === t.id}
                                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                                >
                                  {doneBusyId === t.id ? 'Saving…' : 'Mark as Done'}
                                </button>
                              </div>
                            </li>
                          ))}
                        </>
                      ) : activeTab === 'upcoming' ? (
                        <>
                          {upcomingTasks.length === 0 ? (
                            <li className="flex h-full flex-col items-center justify-center py-12 text-center min-h-[300px]">
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors dark:bg-slate-800 p-4 mb-3 transition-colors">
                                <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400">No upcoming sessions.</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Future sessions booked for you by the Front Desk will appear here.</p>
                            </li>
                          ) : null}
                          {upcomingTasks.map((t) => (
                            <li key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 dark:bg-slate-950 transition-colors dark:hover:bg-slate-800/50">
                              <div className="flex items-center gap-4">
                                <TaskAvatar task={t} />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors"><span>{capitalizeName(t.name)}</span>{t.format === 'group' ? (<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Group</span>) : null}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">
                                    <span className="font-medium">{t.detail}</span>
                                    <span>·</span>
                                    <span>{t.meta.split('·')[1] || t.meta}</span>
                                    <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800 transition-colors">
                                      {t.room}
                                    </span>
                                  </div>
                                  {t.booked_by ? (
                                    <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 transition-colors">
                                      Booked by {capitalizeName(t.booked_by)} · Front Desk
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-800 pt-3 sm:border-0 sm:pt-0 transition-colors">
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors dark:text-slate-300 transition-colors">{upcomingWhen(t.starts_at)}</div>
                                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${statusTone[t.status] || 'bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                                    {t.status}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </>
                      ) : (
                        <>
                          {pendingDocuments.length === 0 ? (
                            <li className="flex h-full flex-col items-center justify-center py-12 text-center min-h-[300px]">
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors dark:bg-slate-800 p-4 mb-3 transition-colors">
                                <ClipboardList className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400">No pending approvals for review.</p>
                            </li>
                          ) : null}
                          {groupedDocuments.map((group) => {
                            const isExpanded = expanded[group.patientId]
                            return (
                              <li key={group.patientId} className="rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                                <button
                                  onClick={() => setExpanded((prev) => ({ ...prev, [group.patientId]: !prev[group.patientId] }))}
                                  className="flex w-full items-center gap-4 text-left cursor-pointer"
                                >
                                  <Avatar name={group.patientName} src={group.photo_url} size="md" className="ring-2 ring-white dark:ring-slate-900 shrink-0 transition-colors" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 truncate transition-colors">{capitalizeName(group.patientName)}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">
                                        {group.docs.length} Approval{group.docs.length !== 1 ? 's' : ''} Pending
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 transition-colors">
                                      {group.docs.length}
                                    </span>
                                    <ChevronDown className={`h-5 w-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="mt-3 ml-16 space-y-2 border-l-2 border-indigo-100 dark:border-indigo-900/30 pl-4 transition-colors">
                                    {group.docs.map((doc) => {
                                      let statusBg = 'bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors dark:bg-slate-800 dark:text-slate-300'
                                      if (doc.status === 'submitted' || doc.status === 'ready_for_review') statusBg = 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                                      else if (doc.status === 'draft' || doc.status === 'in_progress') statusBg = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                      else if (doc.status === 'revise_requested') statusBg = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                      else if (doc.status === 'processed') statusBg = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      return (
                                        <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-slate-900 transition-colors dark:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-700 px-3 py-2.5 shadow-sm transition-colors">
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 truncate transition-colors">
                                              {doc.title}
                                              {doc.code && <span className="ml-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 transition-colors">{doc.code}</span>}
                                              <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${statusBg}`}>
                                                ({doc.status === 'ready_for_review' ? 'pending review' : (doc.status || '').replace(/_/g, ' ')})
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              navigateToDoc(doc)
                                            }}
                                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-indigo-700 dark:hover:bg-indigo-600 hover:shadow-md active:scale-[0.98]"
                                          >
                                            Review
                                            <ArrowRight className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </>
                      )}
                    </>
                  )}
                </ul>
              </div>
            </section>
          </div>

          {/* Side Panel Area */}
          <div className="xl:w-full">
            
            {/* Quick Actions */}
            <section 
              className="rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 p-5 shadow-sm transition-colors"
              data-onboarding-key="psychologist-tasks-actions"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 transition-colors">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction 
                  title="Approvals" 
                  description="Pending reports"
                  icon={CheckSquare} 
                  color="indigo"
                  onClick={() => navigate('/psychologist/approvals')} 
                />
                <QuickAction 
                  title="Activity" 
                  description="Daily reports"
                  icon={BookOpenText} 
                  color="blue"
                  onClick={() => navigate('/psychologist/activity')} 
                />
                <QuickAction 
                  title="Progress" 
                  description="Monthly reports"
                  icon={LineChart} 
                  color="emerald"
                  onClick={() => navigate('/psychologist/progress')} 
                />
                <QuickAction 
                  title="Journal" 
                  description="Student entries"
                  icon={BookOpen} 
                  color="purple"
                  onClick={() => navigate('/psychologist/student-journal')} 
                />
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  )
}

export default Tasks
