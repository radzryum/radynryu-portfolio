import { useEffect, useState } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ArrowLeft, ChevronRight, Maximize2, PanelLeftOpen, Trash2 } from 'lucide-react'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import DeleteModal from '../../../components/ui/DeleteModal'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import StaffHeader from '../StaffHeader'
import { SkeletonText, SkeletonStudentDirectoryItem } from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import ProgressSummaryReportForm from './ProgressSummaryReportForm'
import { api } from '../../../lib/api'
import { focusReviewerComment } from '../../../lib/focusReviewerComment'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'

const COMMENT_LIMIT = 100

const fmtReportDate = (d) => {
  if (!d) return 'No date yet'
  const raw = String(d)
  const dt = new Date(raw.length <= 10 ? `${raw.slice(0, 10)}T00:00:00` : raw)
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_META = {
  draft: {
    label: 'Not submitted',
    tone: 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors',
  },
  in_progress: {
    label: 'Not submitted',
    tone: 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors',
  },
  ready_for_review: {
    label: 'Pending approval',
    tone: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  },
  revise_requested: {
    label: 'Returned for revision',
    tone: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  },
  approved: {
    label: 'Approved & completed',
    tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  finalized: {
    label: 'Approved & completed',
    tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
}

function Progress() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId') || ''
  const roles = [profile?.role, ...(profile?.extra_roles || [])]
  // Same shared-page rule as the Daily Activity Report: this component also
  // serves /psychometrician/progress and /admin/progress, so the route — not
  // the primary role — decides approval-only mode. Psychologists never
  // create monthly reports; the psychometrician prepares them.
  const { pathname } = useLocation()
  const reviewMode = pathname.startsWith('/psychologist')
  const canPrepare = roles.includes('psychometrician')
  const [items, setItems] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState(
    searchParams.get('patientId') || '',
  )
  // One tracker row per month: null = auto (latest), 'new' = blank composer
  // for the current month.
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSignature, setReviewSignature] = useState(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null)
  // Fullscreen mode: the directory slides away so the form takes the full
  // width — same collapse pattern as the IEP workspace.
  const [directoryHidden, setDirectoryHidden] = useState(false)
  // Entries-first flow: picking a student shows the monthly list; opening a
  // report slides the list out and the report takes the full width with a
  // Back button, so staff never mistake one month's report for another.
  const [entryOpened, setEntryOpened] = useState(false)
  const [photoViewer, setPhotoViewer] = useState(null)

  const load = async () => {
    const data = await api.psychologist.progress()
    const roster = data.patients || []
    setItems(data.items || [])
    setPatients(roster)
    setSelectedPatientId((current) =>
      current && roster.some((patient) => String(patient.id) === String(current))
        ? current
        : roster[0]?.id || '',
    )
  }

  useEffect(() => {
    let mounted = true
    Promise.resolve()
      .then(() => load())
      .catch((error) =>
        toast.error(error.message || 'Unable to load Monthly Assessment Reports.'),
      )
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const refresh = () => load().catch(() => {})
    window.addEventListener('focus', refresh)
    window.addEventListener('cymon:workflow-refresh', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('cymon:workflow-refresh', refresh)
    }
  }, [])

  // Live-refresh the directory and monthly reports when they change
  // elsewhere. assessment_reports carries no clinic_id column, so it
  // subscribes unfiltered — RLS still delivers only own-clinic assigned rows.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId
      ? [
          { table: 'patients', filter: `clinic_id=eq.${clinicId}` },
          { table: 'assessment_reports' },
        ]
      : [],
    () => {
      load().catch(() => {})
    },
  )

  // Follow notification deep links (?patientId=) even when the page is
  // already open on another student.
  useEffect(() => {
    if (!urlPatientId || String(selectedPatientId) === String(urlPatientId)) return
    if (!patients.some((patient) => String(patient.id) === String(urlPatientId))) return
    const nextReport = items.find((item) => String(item.patient_id) === String(urlPatientId))
    setSelectedPatientId(urlPatientId)
    // Notification deep links land straight on the linked report detail.
    if (nextReport) {
      setSelectedPeriod(nextReport.period)
      setEntryOpened(true)
      setDirectoryHidden(true)
    } else {
      setSelectedPeriod(null)
    }
    setReviewComment((nextReport?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(null)
  }, [urlPatientId, patients, items, selectedPatientId])

  const selectedPatient = patients.find(
    (patient) => String(patient.id) === String(selectedPatientId),
  )
  // Every month is its own independently submitted/tracked report.
  const patientReports = items
    .filter((item) => String(item.patient_id) === String(selectedPatientId))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  // Drafts are the psychometrician's work-in-progress: never show their
  // contents to the psychologist, only work actually submitted for review.
  const visibleReports = reviewMode
    ? patientReports.filter((item) => !['draft', 'in_progress'].includes(item.status))
    : patientReports
  const currentReport = selectedPeriod === 'new'
    ? null
    : (visibleReports.find((item) => String(item.period) === String(selectedPeriod)) || visibleReports[0] || null)
  const isUnsubmittedDraft = ['draft', 'in_progress'].includes(currentReport?.status)
  const visibleReport = reviewMode && isUnsubmittedDraft ? null : currentReport

  const filteredPatients = pinStudentFirst(patients.filter((patient) =>
    [patient.name, formatLastFirstMI(patient), patient.patient_id].some((value) =>
      String(value || '').toLowerCase().replace(/,/g, ' ').includes(query.trim().toLowerCase().replace(/,/g, ' ')),
    ),
  ).sort(compareStudentsAZ), urlPatientId)

  const selectPatient = (patientId) => {
    setSelectedPatientId(patientId)
    setSelectedPeriod(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    const nextReport = items.find(
      (item) => String(item.patient_id) === String(patientId),
    )
    setReviewComment((nextReport?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(null)
  }

  const selectPeriod = (period) => {
    setSelectedPeriod(period)
    setEntryOpened(true)
    setDirectoryHidden(true)
    const row = visibleReports.find((item) => String(item.period) === String(period))
    setReviewComment((row?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(row?.reviewer_signature_image || null)
  }

  const backToEntries = () => {
    setEntryOpened(false)
    setDirectoryHidden(false)
  }

  const handleSaved = () => {
    // After saving, jump back to the monthly reports list.
    setSelectedPeriod(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    return load().catch(() => {})
  }

  // Delete state: which report is awaiting confirmation in the modal. Only
  // drafts (or returned reports) can be deleted — sent/approved ones are
  // locked, enforced again on the backend.
  const [deletingReport, setDeletingReport] = useState(null)
  const canDeleteReport = (row) =>
    !reviewMode && canPrepare && ['draft', 'in_progress', 'revise_requested'].includes(row?.status)

  const handleDeleteReport = async () => {
    if (!deletingReport) return
    // Rejection propagates to DeleteModal, which toasts the backend message.
    // NOTE: do NOT clear deletingReport here — the modal owns its lifecycle
    // (loading → success check → auto-close). Clearing it unmounts the modal
    // mid-flight so the success animation never plays.
    await api.psychologist.deleteProgressReport(deletingReport.id)
    setSelectedPeriod(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    await load().catch(() => {})
  }

  const handleReviewDecision = async (status) => {
    if (!currentReport) return
    const cleanedComment = reviewComment.trim().slice(0, COMMENT_LIMIT)
    if (status === 'approved' && !reviewSignature) {
      toast.error('Please add your signature before approving the monthly report.')
      return
    }
    if (status === 'revise_requested' && !cleanedComment) {
      toast.error('Please add a revision comment before returning the monthly report.')
      focusReviewerComment()
      return
    }

    setReviewSaving(true)
    try {
      await api.psychologist.updateReport(currentReport.id, {
        status,
        reviewer_comment: cleanedComment || null,
        reviewer_signature_image: status === 'approved' ? reviewSignature : null,
      })
      toast.success(
        status === 'approved'
          ? 'Monthly Assessment Report approved and signed.'
          : 'Monthly Assessment Report returned for revision.',
      )
      setReviewComment('')
      setReviewSignature(null)
      await load()
      try {
        window.dispatchEvent(new Event('cymon-badge-update'))
      } catch {
        // ignore event errors
      }
    } catch (error) {
      toast.error(error.message || 'Unable to update the monthly report.')
    } finally {
      setReviewSaving(false)
    }
  }

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StaffHeader title="Monthly Assessment Report" />
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden transition-[padding] duration-300 ease-in-out motion-reduce:transition-none ${directoryHidden ? 'px-2 min-[360px]:px-3 sm:px-4 py-4 sm:py-6' : 'p-4 sm:p-6'}`}
        data-onboarding-key="monthly-assessment-workspace"
      >
        <div className={`mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full flex-col gap-6 ${directoryHidden ? 'max-w-none' : 'max-w-7xl'}`}>
          <div className={`grid min-h-0 lg:flex-1 grid-cols-1 items-start gap-6 ${directoryHidden ? 'lg:grid-cols-[0fr_minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-3'}`}>
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${directoryHidden ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={directoryHidden || undefined}
            >
            <aside
              className="flex min-h-0 flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm lg:h-full lg:sticky lg:top-0"
              data-onboarding-key="monthly-assessment-directory"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-purple-100 pb-3">
                <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">
                  Student Directory
                </h2>
                <button
                  type="button"
                  onClick={() => setDirectoryHidden(true)}
                  title="Fullscreen — hide directory"
                  aria-label="Fullscreen — hide student directory"
                  className="rounded-md p-1.5 text-purple-500 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 shrink-0">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search students"
                  className="w-full"
                />
              </div>
              <div key={loading ? 'loading' : 'loaded'} className="mt-4 flex-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain p-2 -m-2 animate-content-fade-in">
                {/* Render from data once it exists — the skeleton is only for
                    the true first load, so the directory can never lag behind
                    the detail panel during refreshes. */}
                {loading && patients.length === 0 ? (
                  <div className="space-y-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonStudentDirectoryItem key={i} />
                    ))}
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No students found.
                  </div>
                ) : (
                  filteredPatients.map((patientItem) => {
                    const active =
                      String(selectedPatientId) === String(patientItem.id)
                    // Per-status counts so staff sees at a glance how many
                    // reports are drafts, pending, returned, or done. Drafts
                    // are the psychometrician's work-in-progress: never count
                    // them for the psychologist, only submitted work.
                    const patientItems = items.filter(
                      (item) => String(item.patient_id) === String(patientItem.id),
                    )
                    const countItems = reviewMode
                      ? patientItems.filter((item) => !['draft', 'in_progress'].includes(item.status))
                      : patientItems
                    const draftCount = countItems.filter((item) => !item.status || ['draft', 'in_progress'].includes(item.status)).length
                    const pendingCount = countItems.filter((item) => item.status === 'ready_for_review').length
                    const revisionCount = countItems.filter((item) => item.status === 'revise_requested').length
                    const doneCount = countItems.filter((item) => ['approved', 'finalized'].includes(item.status)).length
                    return (
                      <button
                        key={patientItem.id}
                        type="button"
                        onClick={() => selectPatient(patientItem.id)}
                        className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition hover:bg-purple-50/50 dark:hover:bg-slate-800/60 ${
                          active
                            ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 font-bold text-purple-950 dark:text-purple-100 shadow-sm scale-[1.02] transform'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {patientItem.photo_url || patientItem.patients?.photo_url ? (
                            <img src={patientItem.photo_url || patientItem.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ active ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <div className={`truncate text-sm font-semibold ${active ? 'text-purple-950 dark:text-purple-100' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                              {formatLastFirstMI(patientItem) || patientItem.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              ID: {patientItem.patient_id || 'N/A'}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {countItems.length === 0 ? (
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Not Yet Started</span>
                              ) : (
                                <>
                                  {draftCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">{draftCount} Draft{draftCount === 1 ? '' : 's'}</span> : null}
                                  {pendingCount > 0 ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-700">{pendingCount} Pending</span> : null}
                                  {revisionCount > 0 ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-bold text-orange-700">{revisionCount} Revision{revisionCount === 1 ? '' : 's'}</span> : null}
                                  {doneCount > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">{doneCount} Done</span> : null}
                                </>
                              )}
                            </div>
                        </div>
                      
                        </div></button>
                    )
                  })
                )}
              </div>
            </aside>
            </div>

            <main
              key={selectedPatientId || 'empty'}
              className={`student-directory-panel flex min-h-0 flex-col gap-4 lg:h-full lg:overflow-y-auto lg:overscroll-contain p-2 -m-2 lg:col-span-2 ${directoryHidden ? 'lg:col-start-2' : ''}`}
              data-onboarding-key="monthly-assessment-form"
            >
              {directoryHidden ? (
                <div className="shrink-0 print:hidden">
                  <button
                    type="button"
                    onClick={() => setDirectoryHidden(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                    Show directory
                  </button>
                </div>
              ) : null}
              {selectedPatient ? (
                <>
                  <div className="sticky top-0 z-30 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1 flex items-center gap-4">
                        {selectedPatient.photo_url || selectedPatient.patients?.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setPhotoViewer(selectedPatient.photo_url || selectedPatient.patients?.photo_url)}
                            aria-label="View student photo"
                            title="View student photo"
                            className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          >
                            <img src={selectedPatient.photo_url || selectedPatient.patients?.photo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-purple-200 dark:ring-slate-700 shadow-sm" />
                          </button>
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-xl font-bold text-purple-700 dark:text-purple-300">
                            {(selectedPatient.name || 'ST').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">
                            {selectedPatient.name}
                          </h1>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                            {reviewMode
                              ? 'Review the Monthly Assessment Report submitted by the assigned psychometrician.'
                            : 'Complete one Monthly Assessment Report for this student and send it for psychologist review.'}
                          </p>
                        </div>
                      </div>
                      <AvatarViewer src={photoViewer} alt={selectedPatient.name} onClose={() => setPhotoViewer(null)} />
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
                        <div
                          ref={setHeaderActionsTarget}
                          className="flex min-w-0 flex-1 items-center justify-end sm:flex-initial"
                        />
                      </div>
                    </div>
                  </div>

                  {!entryOpened ? (
                    /* Entries list: each month is submitted/reviewed on its own */
                    <div key="monthly-entries" className="animate-view-slide-in-left flex min-h-0 flex-col gap-3">
                      <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          Monthly reports
                        </div>
                        {!reviewMode && canPrepare ? (
                          <button
                            type="button"
                            onClick={() => selectPeriod('new')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200 transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40"
                          >
                            + Add month
                          </button>
                        ) : null}
                        <div className="mt-3 space-y-2">
                          {visibleReports.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-purple-200 dark:border-slate-700 px-4 py-8 text-center text-xs text-slate-400">
                              {reviewMode
                                ? 'The assigned psychometrician has not sent a Monthly Assessment Report for this student.'
                                : 'No monthly reports yet. Tap the Add button above to create the first one.'}
                            </div>
                          ) : (
                            visibleReports.map((rep) => {
                              const repMeta = STATUS_META[rep.status] || STATUS_META.draft
                              const signed = Boolean(rep.prepared_signature_image)
                              const reviewed = Boolean(rep.reviewer_signature_image)
                              const revisionNote = rep.status === 'revise_requested' ? (rep.reviewer_comment || '') : ''
                              return (
                                <div
                                  key={rep.id}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Open report for ${rep.period || 'unspecified period'}`}
                                  onClick={() => selectPeriod(rep.period)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      selectPeriod(rep.period)
                                    }
                                  }}
                                  className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50/60 dark:hover:bg-slate-800"
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                      {rep.period || 'Unspecified'}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] text-slate-400">
                                      {fmtReportDate(rep.date)}
                                    </span>
                                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      {rep.trend ? (
                                        <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[9px] font-bold text-purple-700 dark:text-purple-300">
                                          {rep.trend}
                                        </span>
                                      ) : null}
                                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${signed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {signed ? 'Signed' : 'Unsigned'}
                                      </span>
                                      {reviewed ? (
                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-700">
                                          Reviewed
                                        </span>
                                      ) : null}
                                    </span>
                                    {revisionNote ? (
                                      <span className="mt-1.5 block truncate text-[10px] font-medium text-orange-700 dark:text-orange-300">
                                        Psychologist&apos;s note: {revisionNote}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1.5">
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${repMeta.tone}`}>
                                      {repMeta.label}
                                    </span>
                                    {canDeleteReport(rep) ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeletingReport(rep)
                                        }}
                                        title="Delete this draft"
                                        aria-label={`Delete report for ${rep.period || 'unspecified period'}`}
                                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    ) : null}
                                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-500" />
                                  </span>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ) : reviewMode && !visibleReport ? (
                    <div className="rounded-2xl border border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-6 py-16 text-center shadow-sm">
                      <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 transition-colors">
                        Not yet submitted
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 transition-colors">
                        The assigned psychometrician has not sent a Monthly Assessment
                        Report for this student.
                      </p>
                    </div>
                  ) : (
                    /* Entry detail: list slides out, report takes the full width */
                    <div key={`monthly-detail-${selectedPeriod}`} className="animate-view-slide-in flex min-h-0 flex-col gap-4">
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={backToEntries}
                          className="inline-flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to reports
                        </button>
                        {canDeleteReport(currentReport) ? (
                          <button
                            type="button"
                            onClick={() => setDeletingReport(currentReport)}
                            title="Delete this draft report"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete draft
                          </button>
                        ) : null}
                      </div>
                      {selectedPeriod === 'new' ? (
                        <div className="rounded-2xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200">
                          Creating a NEW monthly report for {currentPeriod} — not yet saved. Go back to open an existing report instead.
                        </div>
                      ) : currentReport ? (
                        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {reviewMode ? 'Reviewing submitted report' : 'Editing existing report'} · <strong>{currentReport.period || 'Unspecified'}</strong> · {(STATUS_META[currentReport.status] || STATUS_META.draft).label}
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
                      <ProgressSummaryReportForm
                        key={`${selectedPatientId}-${selectedPeriod === 'new' ? 'new' : visibleReport?.id || 'new'}-${visibleReport?.date || ''}`}
                        patient={selectedPatient}
                        patients={patients}
                        initialPatientId={selectedPatientId}
                        initialPeriod={selectedPeriod === 'new' ? currentPeriod : (visibleReport?.period || currentPeriod)}
                        detail={selectedPeriod === 'new' ? null : visibleReport}
                        readOnly={reviewMode || !canPrepare}
                        embedded={true}
                        reviewerMode={
                          reviewMode && visibleReport?.status === 'ready_for_review'
                        }
                        // In review mode the reviewer is the logged-in
                        // psychologist. Otherwise (psychometrician preparing)
                        // leave it null so the form resolves the ASSIGNED
                        // psychologist — passing the preparer's own profile
                        // here rendered the RPm under the Psychologist review
                        // heading.
                        reviewerProfile={reviewMode ? profile : null}
                        reviewerSignature={reviewSignature}
                        reviewerComment={reviewComment}
                        reviewerBusy={reviewSaving}
                        headerActionsTarget={headerActionsTarget}
                        onReviewerSignatureChange={setReviewSignature}
                        onReviewerCommentChange={(value) =>
                          setReviewComment(value.slice(0, COMMENT_LIMIT))
                        }
                        onReviewerReturn={() =>
                          handleReviewDecision('revise_requested')
                        }
                        onReviewerApprove={() => handleReviewDecision('approved')}
                        onSaved={handleSaved}
                      />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-96 items-center justify-center rounded-2xl border-2 border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  Select a student to open the Monthly Assessment Report.
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
      {deletingReport ? (
        <DeleteModal
          title="Delete monthly report?"
          text={`This will permanently delete the report for ${deletingReport.period || 'this period'}. Reports already sent for review or approved cannot be deleted.`}
          itemName={selectedPatient?.name || ''}
          onClose={() => setDeletingReport(null)}
          onConfirm={handleDeleteReport}
        />
      ) : null}
    </div>
  )
}

export default Progress
