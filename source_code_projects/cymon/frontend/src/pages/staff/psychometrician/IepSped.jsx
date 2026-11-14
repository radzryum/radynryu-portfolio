import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Maximize2, PanelLeftOpen, Trash2 } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import { SkeletonText, SkeletonStudentDirectoryItem } from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import DeleteModal from '../../../components/ui/DeleteModal'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import {
  cycleInfoFor,
  cycleLabel,
  cycleProgressOf,
  endDateOf,
  fmtDate as fmtIepDate,
  lastLevelOf,
  nextCycleNumber,
  parseIepForm,
  startDateOf,
} from '../../../lib/iep'
import IepSpedForm from './IepSpedForm'

const STATUS_META = {
  draft: { label: 'Not submitted', tone: 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors' },
  in_progress: { label: 'In progress', tone: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  ready_for_review: { label: 'Pending approval', tone: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
  revise_requested: { label: 'Returned for revision', tone: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  approved: { label: 'Approved & completed', tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  finalized: { label: 'Approved & completed', tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
}

function IepSped() {
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')
  const [rows, setRows] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState(urlPatientId || '')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [query, setQuery] = useState('')
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null)
  // Fullscreen mode: the directory slides away so the IEP form takes the
  // full width. Same collapse pattern as Assessment Services / Approvals.
  const [directoryHidden, setDirectoryHidden] = useState(false)
  // Entries-first flow: picking a student shows the month list; opening a
  // month slides the list out and the form takes the full width with a
  // Back button, so staff never mistake one month's plan for another.
  const [entryOpened, setEntryOpened] = useState(false)
  const [photoViewer, setPhotoViewer] = useState(null)

  const applyRoster = (roster) => {
    setPatients(roster)
    setSelectedPatientId((current) => {
      if (urlPatientId && roster.some((p) => p.id === urlPatientId)) return urlPatientId
      if (current && roster.some((patient) => patient.id === current)) return current
      return roster[0]?.id || ''
    })
  }

  // Staged load: the directory paints from the IEP endpoint alone. The
  // assessments roster is only a fallback for clinics with no IEP data yet —
  // awaiting both (Promise.allSettled) held the whole directory hostage
  // behind the heavier assessments payload.
  const load = async () => {
    let iepData = { rows: [], patients: [] }
    let iepFailed = false
    try {
      iepData = await api.psychometrician.iep()
    } catch {
      iepFailed = true
    }

    const roster = iepData.patients && iepData.patients.length > 0 ? iepData.patients : []
    setRows(iepData.rows || [])
    if (roster.length > 0) {
      applyRoster(roster)
    } else {
      // No IEP roster yet — fall back to the assessments roster so the
      // directory still lists assignable students.
      try {
        const assessmentData = await api.psychometrician.assessments()
        applyRoster(assessmentData.patients || [])
      } catch {
        applyRoster([])
        if (iepFailed) throw new Error('Unable to load IEP students.')
      }
    }
  }

  // Prefill for a brand-new cycle (Renew carries the last support level over;
  // Add starts blank). Consumed by the form when opening the 'new' entry.
  const [cyclePrefill, setCyclePrefill] = useState(null)
  // Which cycle the Information card shows. Defaults to the latest; tapping
  // a cycle card focuses it instead without opening the form.
  const [focusedPeriod, setFocusedPeriod] = useState(null)

  const selectPatientMonth = (patientId, period) => {
    setSelectedPatientId(patientId)
    setSelectedPeriod(period)
    setCyclePrefill(null)
    setFocusedPeriod(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
  }

  const openMonth = (period, prefill = null) => {
    setSelectedPeriod(period)
    setCyclePrefill(period === 'new' ? prefill : null)
    setEntryOpened(true)
    setDirectoryHidden(true)
  }

  const backToEntries = () => {
    setEntryOpened(false)
    setDirectoryHidden(false)
    setCyclePrefill(null)
  }

  useEffect(() => {
    let on = true
    load()
      .catch((err) => {
        toast.error(err.message || 'Unable to load IEP page.')
      })
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
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

  // Follow notification deep links (?patientId=) even when the page is
  // already open on another student.
  useEffect(() => {
    if (!urlPatientId || String(selectedPatientId) === String(urlPatientId)) return
    if (!patients.some((p) => String(p.id) === String(urlPatientId))) return
    selectPatientMonth(urlPatientId, null)
  }, [urlPatientId, patients, selectedPatientId])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  // One tracker entry per cycle: each cycle holds its own week plan (length =
  // its duration) and is submitted/reviewed independently. Null = auto latest.
  // Legacy "Month N" rows map onto cycles 1-based (Month 1 = Plan 1) so history
  // keeps rendering without a data migration.
  const patientMonths = rows
    .filter((r) => r.patient_id === selectedPatientId)
    .map((r) => {
      const form = parseIepForm(r.content)
      const info = cycleInfoFor(r.period, form)
      const progress = cycleProgressOf(form)
      return {
        ...r,
        cycleNumber: info.number,
        cycleKind: info.kind,
        cycleKindLabel: info.kindLabel,
        cycleLabel: info.label,
        cycleLegacy: info.legacy,
        cycleStart: startDateOf(form),
        cycleEnd: endDateOf(form),
        cycleWeeks: progress.total,
        cycleDone: progress.done,
        cyclePct: progress.pct,
        cycleForm: form,
      }
    })
    .slice()
    .sort((a, b) => a.cycleNumber - b.cycleNumber || String(b.date || '').localeCompare(String(a.date || '')))
  const currentIep = selectedPeriod === 'new'
    ? null
    : (patientMonths.find((r) => (r.period || 'Month 1') === selectedPeriod) || patientMonths[patientMonths.length - 1] || null)
  const activePeriod = selectedPeriod === 'new' ? 'new' : (currentIep?.period || 'Month 1')
  const nextNumber = nextCycleNumber(patientMonths)
  const nextCycleLabel = cycleLabel(nextNumber)
  const latestCycle = patientMonths[patientMonths.length - 1] || null
  const focusedCycle = (focusedPeriod
    ? patientMonths.find((r) => (r.period || 'Month 1') === focusedPeriod)
    : null) || latestCycle
  const isFocusedLatest = focusedCycle && latestCycle && focusedCycle.id === latestCycle.id

  const todayIso = () => new Date().toISOString().slice(0, 10)

  const openRenewCycle = () => {
    const carriedLevel = latestCycle ? lastLevelOf(latestCycle.cycleForm) : ''
    openMonth('new', {
      period: nextCycleLabel,
      durationWeeks: latestCycle?.cycleWeeks || 4,
      startDate: todayIso(),
      carriedLevel,
      renew: true,
    })
  }

  const openBlankCycle = () => {
    openMonth('new', {
      period: nextCycleLabel,
      durationWeeks: 4,
      startDate: todayIso(),
      carriedLevel: '',
      renew: false,
    })
  }

  const handleIepSaved = () => {
    // After sending, jump back to the plan list.
    setSelectedPeriod(null)
    setCyclePrefill(null)
    setFocusedPeriod(null)
    setEntryOpened(false)
    setDirectoryHidden(false)
    return load().catch(() => {})
  }

  // Background refresh after an in-form draft save: the form stays open and
  // keeps its state — only the list behind it updates so Back shows the
  // saved row. (Plain Save used to close the form, which made saved work
  // feel like it vanished.)
  const handleDraftSaved = () => load().catch(() => {})

  // Delete state: which plan is awaiting confirmation in the modal.
  const [deletingPlan, setDeletingPlan] = useState(null)
  const canDeletePlan = (row) => ['draft', 'in_progress', 'revise_requested'].includes(row?.status)

  const handleDeletePlan = async () => {
    if (!deletingPlan) return
    // Rejection propagates to DeleteModal, which toasts the backend message.
    // NOTE: do NOT clear deletingPlan here (and no manual success toast) —
    // the modal owns its lifecycle (loading → success check → auto-close).
    // Clearing it unmounts the modal mid-flight so the success animation
    // never plays.
    await api.psychometrician.deleteIepReport(deletingPlan.id)
    setFocusedPeriod(null)
    await load().catch(() => {})
  }

  const filteredPatients = pinStudentFirst(patients.filter((p) =>
    [p.name, formatLastFirstMI(p), p.patient_id].some((v) => String(v || '').toLowerCase().replace(/,/g, ' ').includes(query.trim().toLowerCase().replace(/,/g, ' '))),
  ).sort(compareStudentsAZ), urlPatientId)

  const isAdmissionApproved = selectedPatient?.admission_form_status === 'complete'
  const isConsentApproved = selectedPatient?.waiver_submissions?.some(
    (s) => s.document_type_code === 'CMPS:SE-FO-02' && s.status === 'approved'
  )
  const hasCompletedRequirements = isAdmissionApproved && isConsentApproved

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StaffHeader title="Individualized Education Plan (IEP)" />
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden transition-[padding] duration-500 ease-in-out motion-reduce:transition-none ${directoryHidden ? 'px-2 min-[360px]:px-3 sm:px-4 py-4 sm:py-6' : 'p-4 sm:p-6'}`}
        data-onboarding-key="psychometrician-iep-workspace"
      >
        <div className={`mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full flex-col gap-6 ${directoryHidden ? 'max-w-none' : 'max-w-7xl'}`}>
          {/* Tracks snap instantly; the motion is the classic panel slide
              (directory slides left out, slides right back in). */}
          <div className={`grid min-h-0 lg:flex-1 grid-cols-1 items-start gap-6 ${directoryHidden ? 'lg:grid-cols-[0fr_minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-3'}`}>
            {/* Sidebar List (slides away in fullscreen mode) */}
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${directoryHidden ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={directoryHidden || undefined}
            >
              <div
                className="flex min-h-0 flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm lg:h-full lg:sticky lg:top-0"
                data-onboarding-key="psychometrician-iep-directory"
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
                  <div className="py-8 text-center text-xs text-slate-400">
                    No students found.
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isActive = selectedPatientId === p.id
                    const monthRows = rows.filter((r) => r.patient_id === p.id)
                    const draftCount = monthRows.filter((r) => !r.status || ['draft', 'in_progress'].includes(r.status)).length
                    const pendingCount = monthRows.filter((r) => r.status === 'ready_for_review').length
                    const revisionCount = monthRows.filter((r) => r.status === 'revise_requested').length
                    const doneCount = monthRows.filter((r) => ['approved', 'finalized'].includes(r.status)).length
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatientMonth(p.id, null)}
                        className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer ${
                          isActive
                            ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 font-bold shadow-sm text-purple-950 dark:text-purple-100 scale-[1.02] transform'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {p.photo_url || p.patients?.photo_url ? (
                            <img src={p.photo_url || p.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ isActive ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <div className={`truncate text-sm font-semibold ${isActive ? 'text-purple-950 dark:text-purple-100 font-bold' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                              {formatLastFirstMI(p) || p.name}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-slate-400">
                              ID: {p.patient_id || 'N/A'}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {monthRows.length === 0 ? (
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
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            </div>

            {/* Main Form View Area (spans the two content tracks in both modes) */}
            <div
              key={selectedPatientId || 'empty'}
              className="student-directory-panel flex min-h-0 flex-col lg:h-full lg:overflow-y-auto lg:overscroll-contain p-2 -m-2 lg:col-span-2 lg:col-start-2"
              data-onboarding-key="psychometrician-iep-form"
            >
              {directoryHidden ? (
                <div className="mb-2 shrink-0 print:hidden">
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
                hasCompletedRequirements ? (
                  <div className="flex min-h-0 flex-col gap-4 lg:min-h-max">
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
                              Complete one IEP plan per student and send each plan to the assigned psychologist for review.
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
                      /* Entries list: pick a plan to open it fullscreen */
                      <div key="iep-entries" className="animate-view-slide-in-left flex min-h-0 flex-col gap-3">
                        {focusedCycle ? (
                          <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-purple-900 dark:text-purple-200">
                                IEP Information
                                {isFocusedLatest ? (
                                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                    Latest
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setFocusedPeriod(null)}
                                    className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500 transition hover:bg-purple-100 hover:text-purple-700"
                                  >
                                    Viewing {focusedCycle.cycleLabel} · Show latest
                                  </button>
                                )}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openMonth(focusedCycle.period || 'Month 1')}
                                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 transition hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                                >
                                  Open {focusedCycle.cycleLabel}
                                </button>
                                {canDeletePlan(focusedCycle) ? (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingPlan(focusedCycle)}
                                    title={`Delete ${focusedCycle.cycleLabel} (draft only)`}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={openRenewCycle}
                                  title="Start a new plan, carrying the last support level over"
                                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800"
                              >
                                <span aria-hidden="true">↻</span> Renew IEP
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-400">
                              Tap a plan below to preview its details here.
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">IEP Plan</div>
                                <div className="mt-1 inline-flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{focusedCycle.cycleLabel}</span>
                                  <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                    {focusedCycle.cycleKindLabel}
                                  </span>
                                </div>
                                <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Start date</div>
                                <div className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtIepDate(focusedCycle.cycleStart)}</div>
                                <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">End date</div>
                                <div className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtIepDate(focusedCycle.cycleEnd)}</div>
                                <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Duration</div>
                                <div className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{focusedCycle.cycleWeeks} week{focusedCycle.cycleWeeks === 1 ? '' : 's'}</div>
                              </div>
                              <div className="sm:col-span-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</div>
                                <div className="mt-1">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${(STATUS_META[focusedCycle.status] || STATUS_META.draft).tone}`}>
                                    {(STATUS_META[focusedCycle.status] || STATUS_META.draft).label}
                                  </span>
                                </div>
                                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-purple-100 dark:bg-slate-700">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all"
                                    style={{ width: `${focusedCycle.cyclePct}%` }}
                                  />
                                </div>
                                <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  <span>{focusedCycle.cycleDone} / {focusedCycle.cycleWeeks} weeks</span>
                                  <span>{focusedCycle.cyclePct}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                              IEP plans
                            </div>
                            {patientMonths.length > 0 ? (
                              <button
                                type="button"
                                onClick={openBlankCycle}
                                className="inline-flex items-center gap-1 rounded-lg border border-purple-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 transition hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                              >
                                + Add New IEP
                              </button>
                            ) : null}
                          </div>
                          {patientMonths.length === 0 ? (
                            <button
                              type="button"
                              onClick={openBlankCycle}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200 transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40"
                            >
                              + Add {nextCycleLabel} (Initial Plan)
                            </button>
                          ) : (
                            <div className="space-y-2">
                              {patientMonths.slice().reverse().map((m) => {
                                const mMeta = STATUS_META[m.status] || STATUS_META.draft
                                const isFocused = focusedCycle && focusedCycle.id === m.id
                                return (
                                  <div
                                    key={m.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={isFocused || undefined}
                                    aria-label={`Show ${m.cycleLabel} details`}
                                    onClick={() => setFocusedPeriod(m.period || 'Month 1')}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        setFocusedPeriod(m.period || 'Month 1')
                                      }
                                    }}
                                    className={`group flex w-full cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50/60 dark:hover:bg-slate-800 sm:flex-row sm:items-center sm:justify-between ${
                                      isFocused
                                        ? 'border-purple-400 dark:border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-1 ring-purple-400'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                          {m.cycleLabel}
                                        </span>
                                        <span className="rounded-full bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-300">
                                          {m.cycleKindLabel}
                                        </span>
                                        {m.cycleLegacy ? (
                                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                            {m.period}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="mt-0.5 block text-[11px] text-slate-400">
                                        {fmtIepDate(m.cycleStart)} – {fmtIepDate(m.cycleEnd)} ({m.cycleWeeks} week{m.cycleWeeks === 1 ? '' : 's'})
                                      </span>
                                      <span className="mt-2 block h-1.5 w-full max-w-55 overflow-hidden rounded-full bg-purple-100 dark:bg-slate-700">
                                        <span
                                          className="block h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700"
                                          style={{ width: `${m.cyclePct}%` }}
                                        />
                                      </span>
                                      <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                                        {m.cycleDone} / {m.cycleWeeks} weeks completed · {m.cyclePct}%
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${mMeta.tone}`}>
                                        {mMeta.label}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openMonth(m.period || 'Month 1')
                                        }}
                                        className="rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 transition hover:border-purple-400 hover:bg-purple-50"
                                      >
                                        View
                                      </button>
                                      <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-500" />
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Entry detail: list slides out, form takes the full width */
                      <div key={`iep-detail-${activePeriod}`} className="animate-view-slide-in flex min-h-0 flex-col gap-4">
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={backToEntries}
                            className="inline-flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back to plans
                          </button>
                        </div>
                        {activePeriod === 'new' ? (
                          <div className="rounded-2xl border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 text-sm font-bold text-purple-800 dark:text-purple-200">
                            Creating a NEW IEP for {cyclePrefill?.period || nextCycleLabel}
                            {cyclePrefill ? ` (${cyclePrefill.durationWeeks} week${cyclePrefill.durationWeeks === 1 ? '' : 's'})` : ''} — not yet saved.
                            {cyclePrefill?.renew && cyclePrefill?.carriedLevel ? ` Last support level (${cyclePrefill.carriedLevel}) is carried over to Week 1.` : ''}
                            {' '}Go back to open an existing plan instead.
                          </div>
                        ) : currentIep ? (
                          <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            Editing existing plan · <strong>{currentIep.cycleLabel} ({currentIep.cycleKindLabel})</strong> · {(STATUS_META[currentIep.status] || STATUS_META.draft).label}
                          </div>
                        ) : null}
                        <div className="min-h-[42rem] rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
                          <IepSpedForm
                            key={`${selectedPatientId}-${activePeriod === 'new' ? `new-${cyclePrefill?.period || nextCycleLabel}-${cyclePrefill?.renew ? 'renew' : 'blank'}` : currentIep?.id || 'new'}`}
                            patient={selectedPatient}
                            report={currentIep}
                            period={activePeriod === 'new' ? (cyclePrefill?.period || nextCycleLabel) : (currentIep?.period || 'Month 1')}
                            cyclePrefill={activePeriod === 'new' ? cyclePrefill : null}
                            onSaved={handleIepSaved}
                            onDraftSaved={handleDraftSaved}
                            inline={true}
                            embedded={true}
                            headerActionsTarget={headerActionsTarget}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm">
                    <svg className="h-16 w-16 text-amber-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 transition-colors">Requirements Pending</h3>
                    <p className="mt-2 text-sm font-medium max-w-md">
                      Admission and Consent waivers must be approved before you can create or edit an IEP for this student.
                    </p>
                  </div>
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-8 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
                  Please select a student from the list to view the IEP form.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {deletingPlan ? (
        <DeleteModal
          title={`Delete ${deletingPlan.cycleLabel}?`}
          text={`This will permanently delete ${deletingPlan.cycleLabel} (${deletingPlan.cycleKindLabel}) with all of its weeks. Plans already sent for review or approved cannot be deleted.`}
          itemName={selectedPatient?.name || ''}
          onClose={() => setDeletingPlan(null)}
          onConfirm={handleDeletePlan}
        />
      ) : null}
    </div>
  )
}

export default IepSped
