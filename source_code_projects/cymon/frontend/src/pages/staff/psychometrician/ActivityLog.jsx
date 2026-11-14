import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { ArrowLeft, ChevronRight, Maximize2, PanelLeftOpen, Trash2 } from 'lucide-react'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import DeleteModal from '../../../components/ui/DeleteModal'
import StaffHeader from '../StaffHeader'
import { SkeletonText, SkeletonStudentDirectoryItem } from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import DailyActivityReportForm from './DailyActivityReportForm'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'
import { focusReviewerComment } from '../../../lib/focusReviewerComment'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'

const todayIso = () => new Date().toISOString().slice(0, 10)
const COMMENT_LIMIT = 100

const STATUS_META = {
  draft: { label: 'Not submitted', tone: 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors' },
  pending: { label: 'Pending approval', tone: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
  revise_requested: { label: 'Returned for revision', tone: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  approved: { label: 'Approved & completed', tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
}

function ActivityLog() {
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')
  const { profile } = useAuth()
  // This page serves /psychologist/activity (approval-only), /psychometrician/activity
  // (creation), and /admin/activity. The route declares the purpose — checking
  // only the primary role wrongly shows the creation UI to dual-role staff
  // (primary psychometrician) working on the psychologist side.
  const { pathname } = useLocation()
  const reviewMode = pathname.startsWith('/psychologist')
  const canPrepare = [profile?.role, ...(profile?.extra_roles || [])].includes('psychometrician')
  const [rows, setRows] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState(urlPatientId || '')
  // One tracker entry per day: null = auto (latest), 'new' = blank composer.
  const [selectedEntryId, setSelectedEntryId] = useState(null)
  const [query, setQuery] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSignature, setReviewSignature] = useState(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null)
  // Fullscreen mode: the directory slides away so the form takes the full
  // width — same collapse pattern as the IEP workspace.
  const [directoryHidden, setDirectoryHidden] = useState(false)
  // Entries-first flow: picking a student shows the daily list; opening an
  // entry slides the list out and the report takes the full width with a
  // Back button, so staff never mistake one day's report for another.
  const [entryOpened, setEntryOpened] = useState(false)
  const [photoViewer, setPhotoViewer] = useState(null)

  const load = async () => {
    const data = await api.psychometrician.activityLogs()
    const roster = data.patients || []
    setRows(data.rows || [])
    setPatients(roster)
    setSelectedPatientId((current) => {
      if (urlPatientId && roster.some((p) => String(p.id) === String(urlPatientId))) return urlPatientId
      if (current && roster.some((patient) => String(patient.id) === String(current))) return current
      return roster[0]?.id || ''
    })
  }

  useEffect(() => {
    let mounted = true
    load()
      .catch((error) => toast.error(error.message || 'Unable to load Daily Activity Reports.'))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const refresh = () => load().catch(() => {})
    window.addEventListener('focus', refresh)
    window.addEventListener('cymon:workflow-refresh', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('cymon:workflow-refresh', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-refresh entries and directory counts when session activity logs
  // change elsewhere (e.g. psychologist review). session_logs has no
  // clinic_id column — RLS already limits delivery to accessible patients.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId ? [{ table: 'session_logs' }] : [],
    () => load().catch(() => {}),
  )

  // Follow notification deep links (?patientId=) even when the page is
  // already open on another student.
  useEffect(() => {
    if (!urlPatientId || String(selectedPatientId) === String(urlPatientId)) return
    if (!patients.some((patient) => String(patient.id) === String(urlPatientId))) return
    const nextReport = rows.find((row) => String(row.patient_id) === String(urlPatientId))
    setSelectedPatientId(urlPatientId)
    setSelectedEntryId(nextReport ? nextReport.id : null)
    // Notification deep links land straight on the linked entry detail.
    setEntryOpened(Boolean(nextReport))
    setDirectoryHidden(Boolean(nextReport))
    setReviewComment((nextReport?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(nextReport?.reviewer_signature_image || null)
  }, [urlPatientId, patients, rows, selectedPatientId])

  const selectedPatient = patients.find(
    (patient) => String(patient.id) === String(selectedPatientId),
  )
  // Every day is its own independently submitted/tracked entry — no limit.
  const patientEntries = rows
    .filter((row) => String(row.patient_id) === String(selectedPatientId))
    .slice()
    .sort((a, b) => String(b.date || '') .localeCompare(String(a.date || '')))
  // Drafts are the psychometrician's work-in-progress: never show their
  // contents to the psychologist, only work actually submitted for review.
  const visibleEntries = reviewMode
    ? patientEntries.filter((row) => !['draft', 'in_progress'].includes(row.status))
    : patientEntries
  const currentLog = selectedEntryId === 'new'
    ? null
    : (visibleEntries.find((row) => String(row.id) === String(selectedEntryId)) || visibleEntries[0] || null)
  const isUnsubmittedDraft = ['draft', 'in_progress'].includes(currentLog?.status)
  const visibleLog = reviewMode && isUnsubmittedDraft ? null : currentLog

  const fmtEntryDate = (d) => {
    if (!d) return 'Undated'
    const dt = new Date(`${d}T00:00:00`)
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isAdmissionApproved = selectedPatient?.admission_form_status === 'complete'
  const isConsentApproved = selectedPatient?.waiver_submissions?.some(
    (s) => s.document_type_code === 'CMPS:SE-FO-02' && s.status === 'approved'
  )
  const hasCompletedRequirements = isAdmissionApproved && isConsentApproved

  const filteredPatients = pinStudentFirst(patients.filter((patient) =>
    [patient.name, formatLastFirstMI(patient), patient.patient_id].some((value) =>
      String(value || '').toLowerCase().replace(/,/g, ' ').includes(query.trim().toLowerCase().replace(/,/g, ' ')),
    ),
  ).sort(compareStudentsAZ), urlPatientId)

  const selectPatient = (patientId) => {
    setSelectedPatientId(patientId)
    setSelectedEntryId(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    const nextReport = rows.find((row) => String(row.patient_id) === String(patientId))
    setReviewComment((nextReport?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(nextReport?.reviewer_signature_image || null)
  }

  const selectEntry = (entryId) => {
    setSelectedEntryId(entryId)
    setEntryOpened(true)
    setDirectoryHidden(true)
    const row = visibleEntries.find((r) => String(r.id) === String(entryId))
    setReviewComment((row?.reviewer_comment || '').slice(0, COMMENT_LIMIT))
    setReviewSignature(row?.reviewer_signature_image || null)
  }

  const backToEntries = () => {
    setEntryOpened(false)
    setDirectoryHidden(false)
  }

  const handleSaved = () => {
    // After saving, jump back to the daily entries list.
    setSelectedEntryId(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    return load().catch(() => {})
  }

  // Delete state: which entry is awaiting confirmation in the modal. Only
  // drafts (or returned entries) can be deleted — sent/approved ones are
  // locked, enforced again on the backend.
  const [deletingEntry, setDeletingEntry] = useState(null)
  const canDeleteEntry = (row) =>
    !reviewMode && canPrepare && ['draft', 'in_progress', 'revise_requested'].includes(row?.status)

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return
    // Rejection propagates to DeleteModal, which toasts the backend message.
    // NOTE: do NOT clear deletingEntry here — the modal owns its lifecycle
    // (loading → success check → auto-close). Clearing it unmounts the modal
    // mid-flight so the success animation never plays.
    await api.psychometrician.deleteActivityLog(deletingEntry.id)
    setSelectedEntryId(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    await load().catch(() => {})
  }

  const handleReviewDecision = async (status) => {
    if (!currentLog) return
    const cleanedComment = reviewComment.trim().slice(0, COMMENT_LIMIT)
    if (status === 'approved' && !reviewSignature) {
      toast.error('Please add your signature before approving the DAR.')
      return
    }
    if (status === 'revise_requested' && !cleanedComment) {
      toast.error('Please add a revision comment before returning the DAR.')
      focusReviewerComment()
      return
    }

    setReviewSaving(true)
    try {
      await api.psychologist.updateActivityLog(currentLog.id, {
        status,
        reviewer_comment: cleanedComment || null,
        reviewer_signature_image: status === 'approved' ? reviewSignature : null,
      })
      toast.success(status === 'approved' ? 'DAR approved and signed.' : 'DAR returned for revision.')
      setReviewComment('')
      setReviewSignature(null)
      await load()
      try {
        window.dispatchEvent(new Event('cymon-badge-update'))
      } catch {
        // ignore event errors
      }
    } catch (error) {
      toast.error(error.message || 'Unable to update the Daily Activity Report.')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StaffHeader title="Daily Activity Report" />
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden transition-[padding] duration-300 ease-in-out motion-reduce:transition-none ${directoryHidden ? 'px-2 min-[360px]:px-3 sm:px-4 py-4 sm:py-6' : 'p-4 sm:p-6'}`}
        data-onboarding-key="daily-activity-workspace"
      >
        <div className={`mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full flex-col gap-6 ${directoryHidden ? 'max-w-none' : 'max-w-7xl'}`}>
          <div className={`grid min-h-0 lg:flex-1 grid-cols-1 items-start gap-6 ${directoryHidden ? 'lg:grid-cols-[0fr_minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-3'}`}>
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${directoryHidden ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={directoryHidden || undefined}
            >
            <aside
              className="flex min-h-0 flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm lg:h-full lg:sticky lg:top-0"
              data-onboarding-key="daily-activity-directory"
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
                  <div className="py-12 text-center text-xs text-slate-400">No students found.</div>
                ) : (
                  filteredPatients.map((patient) => {
                    const active = String(selectedPatientId) === String(patient.id)
                    // Per-status counts so staff sees at a glance how many
                    // entries are drafts, pending, returned, or done. Drafts
                    // are the psychometrician's work-in-progress: never count
                    // them for the psychologist, only submitted work.
                    const patientRows = rows.filter((row) => String(row.patient_id) === String(patient.id))
                    const countRows = reviewMode
                      ? patientRows.filter((row) => !['draft', 'in_progress'].includes(row.status))
                      : patientRows
                    const draftCount = countRows.filter((row) => !row.status || ['draft', 'in_progress'].includes(row.status)).length
                    const pendingCount = countRows.filter((row) => row.status === 'pending').length
                    const revisionCount = countRows.filter((row) => row.status === 'revise_requested').length
                    const doneCount = countRows.filter((row) => ['approved', 'completed'].includes(row.status)).length
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => selectPatient(patient.id)}
                        className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition hover:bg-purple-50/50 dark:hover:bg-slate-800/60 ${
                          active
                            ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 font-bold text-purple-950 dark:text-purple-100 shadow-sm scale-[1.02] transform'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {patient.photo_url || patient.patients?.photo_url ? (
                            <img src={patient.photo_url || patient.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ active ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <div className={`truncate text-sm font-semibold ${active ? 'text-purple-950 dark:text-purple-100' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                              {formatLastFirstMI(patient) || patient.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              ID: {patient.patient_id || 'N/A'}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {countRows.length === 0 ? (
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
              data-onboarding-key="daily-activity-form"
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
                          <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">{selectedPatient.name}</h1>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                            {reviewMode
                              ? 'Review the Daily Activity Report submitted by the assigned psychometrician.'
                            : 'Complete one Daily Activity Report for this student and send it for psychologist review.'}
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

                  {!reviewMode && !hasCompletedRequirements ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm min-h-[400px]">
                      <svg className="h-16 w-16 text-amber-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 transition-colors">Requirements Pending</h3>
                      <p className="mt-2 text-sm font-medium max-w-md">
                        Admission and Consent waivers must be approved before you can submit a Daily Activity Report for this student.
                      </p>
                    </div>
                  ) : !entryOpened ? (
                    /* Entries list: each day is submitted/reviewed on its own */
                    <div key="dar-entries" className="animate-view-slide-in-left flex min-h-0 flex-col gap-3">
                      <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          Daily entries
                        </div>
                        {!reviewMode && canPrepare ? (
                          <button
                            type="button"
                            onClick={() => selectEntry('new')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200 transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40"
                          >
                            + Add daily report
                          </button>
                        ) : null}
                        <div className="mt-3 space-y-2">
                          {visibleEntries.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-purple-200 dark:border-slate-700 px-4 py-8 text-center text-xs text-slate-400">
                              {reviewMode
                                ? 'The assigned psychometrician has not sent a Daily Activity Report for this student.'
                                : 'No daily reports yet. Tap the Add button above to create the first one.'}
                            </div>
                          ) : (
                            visibleEntries.map((entry) => {
                              const entryMeta = STATUS_META[entry.status] || STATUS_META.draft
                              const title = entry.detail || entry.activity_title || ''
                              const domain = entry.target_domain || ''
                              const signed = Boolean(entry.prepared_signature_image)
                              const reviewed = Boolean(entry.reviewer_signature_image)
                              const revisionNote = entry.status === 'revise_requested' ? (entry.reviewer_comment || '') : ''
                              return (
                                <div
                                  key={entry.id}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Open report for ${fmtEntryDate(entry.date)}${entry.session_number ? ` session ${entry.session_number}` : ''}`}
                                  onClick={() => selectEntry(entry.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      selectEntry(entry.id)
                                    }
                                  }}
                                  className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50/60 dark:hover:bg-slate-800"
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                      {fmtEntryDate(entry.date)}
                                      {entry.session_number ? ` · Session ${entry.session_number}` : ''}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                      {title || 'Untitled activity'}
                                    </span>
                                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      {domain ? (
                                        <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[9px] font-bold text-purple-700 dark:text-purple-300">
                                          {domain}
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
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${entryMeta.tone}`}>
                                      {entryMeta.label}
                                    </span>
                                    {canDeleteEntry(entry) ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeletingEntry(entry)
                                        }}
                                        title="Delete this draft"
                                        aria-label={`Delete report for ${fmtEntryDate(entry.date)}`}
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
                  ) : reviewMode && !visibleLog ? (
                    <div className="rounded-2xl border border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-6 py-16 text-center shadow-sm">
                      <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 transition-colors">Not yet submitted</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 transition-colors">
                        The assigned psychometrician has not sent a Daily Activity Report for this student.
                      </p>
                    </div>
                  ) : (
                    /* Entry detail: list slides out, report takes the full width */
                    <div key={`dar-detail-${selectedEntryId}`} className="animate-view-slide-in flex min-h-0 flex-col gap-4">
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={backToEntries}
                          className="inline-flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to entries
                        </button>
                        {canDeleteEntry(currentLog) ? (
                          <button
                            type="button"
                            onClick={() => setDeletingEntry(currentLog)}
                            title="Delete this draft report"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete draft
                          </button>
                        ) : null}
                      </div>
                      {selectedEntryId === 'new' ? (
                        <div className="rounded-2xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200">
                          Creating a NEW daily report for {fmtEntryDate(todayIso())} — not yet saved. Go back to open an existing entry instead.
                        </div>
                      ) : currentLog ? (
                        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {reviewMode ? 'Reviewing submitted entry' : 'Editing existing entry'} · <strong>{fmtEntryDate(currentLog.date)}</strong> · {(STATUS_META[currentLog.status] || STATUS_META.draft).label}
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
                      <DailyActivityReportForm
                        key={`${selectedPatientId}-${selectedEntryId === 'new' ? 'new' : visibleLog?.id || 'new'}-${visibleLog?.date || ''}`}
                        patient={selectedPatient}
                        patients={patients}
                        initialPatientId={selectedPatientId}
                        initialDate={visibleLog?.date || todayIso()}
                        detail={selectedEntryId === 'new' ? null : visibleLog}
                        readOnly={reviewMode || !canPrepare}
                        embedded={true}
                        reviewerMode={reviewMode && visibleLog?.status === 'pending'}
                        reviewerProfile={reviewMode ? profile : null}
                        reviewerSignature={reviewSignature}
                        reviewerComment={reviewComment}
                        reviewerBusy={reviewSaving}
                        headerActionsTarget={headerActionsTarget}
                        onReviewerSignatureChange={setReviewSignature}
                        onReviewerCommentChange={(value) => setReviewComment(value.slice(0, COMMENT_LIMIT))}
                        onReviewerReturn={() => handleReviewDecision('revise_requested')}
                        onReviewerApprove={() => handleReviewDecision('approved')}
                        onSaved={handleSaved}
                      />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-96 items-center justify-center rounded-2xl border-2 border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  Select a student to open the Daily Activity Report.
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
      {deletingEntry ? (
        <DeleteModal
          title="Delete daily report?"
          text={`This will permanently delete the report for ${fmtEntryDate(deletingEntry.date)}${deletingEntry.session_number ? ` (Session ${deletingEntry.session_number})` : ''}. Reports already sent for review or approved cannot be deleted.`}
          itemName={selectedPatient?.name || ''}
          onClose={() => setDeletingEntry(null)}
          onConfirm={handleDeleteEntry}
        />
      ) : null}
    </div>
  )
}

export default ActivityLog
