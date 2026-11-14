import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, ClipboardList, FileSignature,
  Lightbulb, Clock, CheckCircle2, FileText,
  ArrowRight, ChevronDown, Users
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
  <div className={`relative flex flex-col justify-center rounded-2xl border ${tone} bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm transition-all hover:shadow-md h-full`}>
    <div className="relative z-10 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${bgTone}`}>
        <Icon className={`h-6 w-6 ${tone.replace('border-', 'text-').replace('-200', '-700').replace('-100', '-700')} dark:${tone.replace('border-', 'text-').replace('-200', '-300').replace('-100', '-300')}`} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors">{title}</div>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{value}</div>
      </div>
    </div>
  </div>
)

const QuickAction = ({ title, description, icon: Icon, onClick, color }) => {
  const colorMap = {
    purple: { border: 'hover:border-purple-200 dark:hover:border-purple-700 transition-colors', bg: 'bg-purple-50 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400', hoverBg: 'group-hover:bg-purple-100 dark:group-hover:bg-purple-900/60' },
    emerald: { border: 'hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors', bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400', hoverBg: 'group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60' },
    sky: { border: 'hover:border-sky-200 dark:hover:border-sky-700 transition-colors', bg: 'bg-sky-50 dark:bg-sky-900/40', text: 'text-sky-600 dark:text-sky-400', hoverBg: 'group-hover:bg-sky-100 dark:group-hover:bg-sky-900/60' },
    orange: { border: 'hover:border-orange-200 dark:hover:border-orange-700 transition-colors', bg: 'bg-orange-50 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400', hoverBg: 'group-hover:bg-orange-100 dark:group-hover:bg-orange-900/60' },
  }
  const c = colorMap[color] || colorMap.purple
  return (
    <button 
      onClick={onClick}
      className={`group flex w-full flex-col items-start rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 text-left shadow-sm transition-all ${c.border} hover:shadow-md active:scale-[0.98]`}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text} ${c.hoverBg} transition-colors`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">{title}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">{description}</div>
    </button>
  )
}

function Tasks() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [assessments, setAssessments] = useState([])
  const [submissionDrafts, setSubmissionDrafts] = useState([])
  const [draftReports, setDraftReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sessions')
  const [expanded, setExpanded] = useState({})
  const [doneBusyId, setDoneBusyId] = useState(null)

  const loadTasks = async () => {
    try {
      const d = await api.psychometrician.tasks()
      const nextTasks = d.tasks || []
      const nextAssessments = d.assessments || []
      const nextSubmissionDrafts = d.submissionDrafts || []
      const nextDraftReports = d.draftReports || []
      setTasks(nextTasks)
      setAssessments(nextAssessments)
      setSubmissionDrafts(nextSubmissionDrafts)
      setDraftReports(nextDraftReports)
      // Land on the most urgent non-empty queue: today's sessions first,
      // then upcoming bookings, then documents. Otherwise keep the open tab.
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
      } else if (nextAssessments.length || nextSubmissionDrafts.length || nextDraftReports.length) {
        setActiveTab('assessments')
      } else {
        // Everything is empty (e.g. right after submitting the last draft) —
        // fall back to Sessions so the queue doesn't strand the user on an
        // empty Documents tab that looks broken.
        setActiveTab('sessions')
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

  // Live-refresh the queue when assignments, submissions, bookings, or
  // permissions change elsewhere. assessment_assignments/submissions carry
  // no clinic_id column, so those rely on RLS (own-clinic assigned rows);
  // appointments/permissions filter on clinic_id directly.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId
      ? [
          { table: 'assessment_assignments' },
          { table: 'assessment_submissions' },
          { table: 'appointments', filter: `clinic_id=eq.${clinicId}` },
          { table: 'assessment_permissions', filter: `clinic_id=eq.${clinicId}` },
        ]
      : [],
    loadTasks,
  )

  const markSessionDone = async (id) => {
    setDoneBusyId(id)
    try {
      await api.psychometrician.completeAppointment(id, { status: 'completed' })
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
  const documents = useMemo(() => [...assessments, ...submissionDrafts, ...draftReports], [assessments, submissionDrafts, draftReports])

  const groupedDocuments = useMemo(() => {
    const map = new Map()
    for (const doc of documents) {
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
  }, [documents])

  const navigateToDoc = (doc) => {
    const pid = encodeURIComponent(doc.patientId || '')
    const code = (doc.code || '').toUpperCase()
    const rType = (doc.reportType || '').toLowerCase()
    if (doc.type === 'submission' && doc.templateId) {
      // Standardized-test draft / revalidation — deep-link the exact template
      // row (highlighted) on the Assessment Services page.
      navigate(`/psychometrician/assessments?patientId=${pid}&templateId=${encodeURIComponent(doc.templateId)}`)
    } else if (code === 'CMPS:SE-FO-06' || rType === 'behavioral') {
      navigate(`/psychometrician/assessments?patientId=${pid}`)
    } else if (code === 'CMPS:SE-FO-10' || rType === 'iep') {
      navigate(`/psychometrician/iep?patientId=${pid}`)
    } else if (code === 'CMPS:SE-FO-07' || rType === 'daily_activity') {
      navigate(`/psychometrician/activity?patientId=${pid}`)
    } else if (code === 'CMPS:SE-FO-09' || code === 'CMPS:SE-FO-08' || rType === 'progress_summary') {
      navigate(`/psychometrician/progress?patientId=${pid}`)
    } else {
      navigate(`/psychometrician/assessments?patientId=${pid}`)
    }
  }

  return (
    <>
      <StaffHeader title={`Good Day, ${capitalizeName(profile?.display_name) || 'Doctor'}!`} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors" data-onboarding-key="psychometrician-task-workspace">
        
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
            title="Pending Assessments" 
            value={loading ? '-' : documents.length} 
            icon={ClipboardList} 
            tone="border-amber-200 dark:border-amber-800" 
            bgTone="bg-amber-50 dark:bg-amber-900/40" 
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 items-start">
          
          {/* Main Task Area */}
          <div className="xl:col-span-2 h-full">
            <section
              className="flex h-full flex-col rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm overflow-hidden"
              data-onboarding-key="psychometrician-task-controls"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 transition-colors p-5 bg-slate-50 dark:bg-slate-950 transition-colors/50 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">Today's Queue</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors sm:pl-7">
                    Sessions booked for you by the Front Desk · {todayLabel}
                  </p>
                </div>
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-sm font-semibold">
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
                    <span>Documents</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'assessments' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {documents.length}
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
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors p-4 mb-3">
                                <CheckCircle2 className="h-8 w-8 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">No sessions scheduled for today.</p>
                              <p className="text-xs text-slate-400 mt-1">Sessions booked for you by the Front Desk will appear here.</p>
                            </li>
                          ) : null}
                          {scheduledTasks.map((t) => (
                            <li key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                              <div className="flex items-center gap-4">
                                <TaskAvatar task={t} />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-slate-100 transition-colors"><span>{capitalizeName(t.name)}</span>{t.format === 'group' ? (<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Group</span>) : null}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                                    <span className="font-medium">{t.detail}</span>
                                    <span>·</span>
                                    <span>{t.meta.split('·')[1] || t.meta}</span>
                                    <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800 transition-colors">
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
                              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 transition-colors pt-3 sm:border-0 sm:pt-0">
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">{t.time}</div>
                                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[t.status]}`}>
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
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors p-4 mb-3">
                                <Calendar className="h-8 w-8 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">No upcoming sessions.</p>
                              <p className="text-xs text-slate-400 mt-1">Future sessions booked for you by the Front Desk will appear here.</p>
                            </li>
                          ) : null}
                          {upcomingTasks.map((t) => (
                            <li key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                              <div className="flex items-center gap-4">
                                <TaskAvatar task={t} />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-slate-100 transition-colors"><span>{capitalizeName(t.name)}</span>{t.format === 'group' ? (<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Group</span>) : null}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                                    <span className="font-medium">{t.detail}</span>
                                    <span>·</span>
                                    <span>{t.meta.split('·')[1] || t.meta}</span>
                                    <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800 transition-colors">
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
                              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 transition-colors pt-3 sm:border-0 sm:pt-0">
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">{upcomingWhen(t.starts_at)}</div>
                                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[t.status]}`}>
                                    {t.status}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </>
                      ) : (
                        <>
                          {documents.length === 0 ? (
                            <li className="flex h-full flex-col items-center justify-center py-12 text-center min-h-[300px]">
                              <div className="rounded-full bg-slate-50 dark:bg-slate-950 transition-colors p-4 mb-3">
                                <ClipboardList className="h-8 w-8 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">No pending assessments.</p>
                              <p className="text-xs text-slate-400 mt-1">Assessments assigned to you and draft reports will appear here. Submitted items move to the psychologist for review.</p>
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
                                  <Avatar name={group.patientName} src={group.photo_url} size="md" className="ring-2 ring-white dark:ring-slate-800 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 transition-colors truncate">{capitalizeName(group.patientName)}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                                      {group.docs.length} Document{group.docs.length !== 1 ? 's' : ''} Pending
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="rounded-full bg-purple-100 dark:bg-purple-900/50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                      {group.docs.length}
                                    </span>
                                    <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="mt-3 ml-16 space-y-2 border-l-2 border-purple-100 dark:border-purple-800 pl-4">
                                    {group.docs.map((doc) => {
                                      const isDraftReport = doc.type === 'draft_report'
                                      const isSubmission = doc.type === 'submission'
                                      const isAssigned = doc.code && !isDraftReport && !isSubmission
                                      let statusBg = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                      if (doc.status === 'draft' || doc.status === 'in_progress') statusBg = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                      else if (doc.status === 'revise_requested' || doc.status === 'revalidation') statusBg = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                      else if (doc.status === 'assigned') statusBg = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                      return (
                                        <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-slate-900 transition-colors border border-slate-100 dark:border-slate-800 transition-colors px-3 py-2.5 shadow-sm">
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors truncate">
                                              {doc.title}
                                              {doc.code && <span className="ml-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors">{doc.code}</span>}
                                              <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusBg}`}>
                                                ({doc.status === 'revise_requested' ? 'revision needed' : doc.status === 'revalidation' ? 'revalidation required' : (doc.status || '').replace(/_/g, ' ')})
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              navigateToDoc(doc)
                                            }}
                                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
                                          >
                                            {isDraftReport ? 'Continue Draft' : isSubmission ? (doc.status === 'revalidation' ? 'Revise & Resubmit' : doc.status === 'draft' ? 'Continue' : 'Open') : isAssigned ? 'Administer' : 'Open'}
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
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 transition-colors">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction 
                  title="Assessments" 
                  description="View all forms"
                  icon={ClipboardList} 
                  color="purple"
                  onClick={() => navigate('/psychometrician/assessments')} 
                />
                <QuickAction 
                  title="Draft Reports" 
                  description="Pending drafts"
                  icon={FileText} 
                  color="emerald"
                  onClick={() => navigate('/psychometrician/assessments')} 
                />
                <QuickAction 
                  title="Data Review" 
                  description="Score logs"
                  icon={CheckCircle2} 
                  color="sky"
                  onClick={() => navigate('/psychometrician/data-review')} 
                />
                <QuickAction 
                  title="IEP Workspace" 
                  description="Special Ed plans"
                  icon={FileSignature} 
                  color="orange"
                  onClick={() => navigate('/psychometrician/iep')} 
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
