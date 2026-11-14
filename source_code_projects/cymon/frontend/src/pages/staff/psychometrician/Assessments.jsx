import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffHeader from '../StaffHeader'
import { api } from '../../../lib/api'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedActionBtn from '../../../components/ui/AnimatedActionBtn'
import AnswerAssessment from './AnswerAssessment'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import BehavioralAssessmentForm from './BehavioralAssessmentForm'
import { toast } from 'react-hot-toast'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

const STATUS_META = {
  draft: { label: 'DRAFT', tone: 'bg-amber-100 text-amber-700 border border-amber-200' },
  submitted: { label: 'SUBMITTED', tone: 'bg-sky-100 text-sky-700 border border-sky-200' },
  approved: { label: 'APPROVED', tone: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  revise_requested: {
    label: 'RETURNED FOR REVISION',
    tone: 'bg-orange-100 text-orange-800 border border-orange-200',
  },
  revalidation: {
    label: 'REVALIDATION REQUIRED',
    tone: 'bg-orange-100 text-orange-800 border border-orange-200',
  },
}

function Assessments() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const deepLinkPatientId = searchParams.get('patientId') || ''
  const deepLinkSection = searchParams.get('section') || ''
  const deepLinkTemplateId = searchParams.get('templateId') || ''
  const deepLinkReportId = searchParams.get('reportId') || ''
  const studentCardRefs = useRef({})
  const sectionRefs = useRef({})
  const [highlightItem, setHighlightItem] = useState(null)
  const [tests, setTests] = useState([])
  const [patients, setPatients] = useState([])
  const [permissions, setPermissions] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [employees, setEmployees] = useState([])
  const [reports, setReports] = useState([])
  const [activeReport, setActiveReport] = useState(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [loading, setLoading] = useState(true)
  // Distinguishes "the request failed" from "there really are no students" —
  // a failed load must never masquerade as an empty directory.
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [openForm, setOpenForm] = useState(null)
  const [answerPrefill, setAnswerPrefill] = useState(null)
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null)

  // `silent` = background refresh (window focus / workflow notification).
  // Those must update the inline error state only — toasting on every focus
  // event stacks duplicate "server error" pills when the backend is down.
  // A shared toast id also collapses repeats into one pill.
  // The directory must not wait for the reports ledger: the ledger fetch runs
  // after the directory is already painted, otherwise the left panel stays a
  // skeleton while the right panel already shows the selected student.
  const load = async (silentFlag = false) => {
    const silent = silentFlag === true
    setLoadError('')
    try {
      const d = await api.psychometrician.assessments()
      setLoadError('')
      setTests(d.tests || [])
      setPatients(d.patients || [])
      setPermissions(d.permissions || [])
      setSubmissions(d.submissions || [])
      setEmployees(d.employees || [])
      setSelectedPatientId((current) => {
        if (current) return current
        const populatedPatient = (d.patients || []).find((patient) =>
          (d.submissions || []).some(
            (submission) => String(submission.patient_id) === String(patient.id),
          ),
        )
        return populatedPatient?.id || d.patients?.[0]?.id || ''
      })
    } catch (error) {
      console.error('[assessments] Failed to load assessment templates and submissions', error)
      setLoadError(error.message || 'Could not load assessments.')
      if (!silent) toast.error(error.message || 'Could not load assessments.', { id: 'pm-assessments-load' })
    } finally {
      // Paint the directory as soon as its own data lands — don't hold it
      // hostage while the behavioral-reports ledger below is still fetching.
      if (!silent) setLoading(false)
    }

    try {
      const draftingData = await api.psychometrician.draftingReports()
      setReports(draftingData.rows || [])
    } catch (error) {
      console.error('[assessments] Failed to load behavioral reports', error)
      if (!silent) toast.error(error.message || 'Could not load behavioral reports.', { id: 'pm-assessments-reports' })
    }
  }

  useEffect(() => {
    let on = true
    setLoading(true)
    load().finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
  }, [])

  // Live-refresh the directory and tables when submissions or assignments
  // change elsewhere (e.g. psychologist approval). Silent: background events
  // must not toast. Neither table has a clinic_id column — RLS already
  // limits delivery to own-clinic patients.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId ? [{ table: 'assessment_submissions' }, { table: 'assessment_assignments' }] : [],
    () => load(true),
  )

  useEffect(() => {
    const refreshOnFocus = () => load(true)
    const refreshFromNotification = (event) => {
      const pathname = String(event.detail?.link || '').split('?')[0]
      if (!event.detail?.link || pathname === '/psychometrician/assessments') {
        load(true)
      }
    }
    window.addEventListener('focus', refreshOnFocus)
    window.addEventListener('cymon:workflow-refresh', refreshFromNotification)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      window.removeEventListener('cymon:workflow-refresh', refreshFromNotification)
    }
  }, [])

  useEffect(() => {
    if (loading || !deepLinkPatientId) return
    const patient = patients.find((item) => String(item.id) === String(deepLinkPatientId))
    if (patient) setSelectedPatientId(patient.id)
  }, [loading, patients, deepLinkPatientId])

  useEffect(() => {
    if (!deepLinkPatientId || String(selectedPatientId) !== String(deepLinkPatientId)) return
    requestAnimationFrame(() => {
      studentCardRefs.current[deepLinkPatientId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [selectedPatientId, deepLinkPatientId])

  useEffect(() => {
    if (!deepLinkSection || !deepLinkPatientId || String(selectedPatientId) !== String(deepLinkPatientId)) return
    const target = deepLinkSection === 'behavioral' ? 'behavioralReports' : 'assessmentTemplates'
    requestAnimationFrame(() => {
      sectionRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [selectedPatientId, deepLinkSection, deepLinkPatientId])

  // Highlight the exact assessment / report row a notification points to.
  useEffect(() => {
    const target = deepLinkTemplateId || deepLinkReportId
    if (!target || !deepLinkPatientId || String(selectedPatientId) !== String(deepLinkPatientId)) return
    setHighlightItem(target)
    const timer = setTimeout(() => setHighlightItem(null), 3000)
    return () => clearTimeout(timer)
  }, [selectedPatientId, deepLinkPatientId, deepLinkTemplateId, deepLinkReportId])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  const activeTests = tests.filter((t) =>
    t.active !== false &&
    (!selectedPatient || (selectedPatient.assigned_template_ids || []).includes(t.id)),
  )
  const isViewingForm = Boolean(openForm || answerPrefill)
  // Staged exit: the form slides/fades out and the directory slides back in
  // first; only then is the form unmounted and the tables shown again.
  const [isClosingForm, setIsClosingForm] = useState(false)
  const closeTimer = useRef(null)
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  const closeFormView = () => {
    if (isClosingForm) return
    setIsClosingForm(true)
    closeTimer.current = setTimeout(() => {
      setOpenForm(null)
      setAnswerPrefill(null)
      setIsClosingForm(false)
    }, 280)
  }
  const formExpanded = isViewingForm && !isClosingForm
  // Unified fullscreen header: form title + subtitle and the student, shared
  // by every assessment form (standardized, adaptive, behavioral).
  const activeTemplate = answerPrefill
    ? tests.find((t) => String(t.id) === String(answerPrefill.templateId))
    : null
  const formHeaderTitle =
    openForm === 'behavioral' || openForm === 'viewBehavioral'
      ? activeReport?.title || 'Behavioral Assessment Report'
      : activeTemplate?.title || 'Assessment'
  const formHeaderSubtitle =
    openForm === 'behavioral' || openForm === 'viewBehavioral'
      ? 'Special Education Program'
      : activeTemplate?.code || ''
  const canWriteBehavioral =
    selectedPatient &&
    (
      selectedPatient.treating_psychometrician_id === profile?.id ||
      selectedPatient.treating_psychometrician_id === profile?.employee_id
    )

  const isAdmissionApproved = selectedPatient?.admission_form_status === 'complete'
  const isConsentApproved = selectedPatient?.waiver_submissions?.some(
    (s) => s.document_type_code === 'CMPS:SE-FO-02' && s.status === 'approved'
  )
  const hasCompletedRequirements = isAdmissionApproved && isConsentApproved

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const filteredPatients = pinStudentFirst(patients.filter((p) =>
    !q || [p.name, formatLastFirstMI(p), p.patient_id].some((v) => String(v || '').toLowerCase().replace(/,/g, ' ').includes(q))
  ).sort(compareStudentsAZ), deepLinkPatientId)

  const patientReports = selectedPatient
    ? reports.filter((r) => r.patient_id === selectedPatient.id)
    : []

  const getSubmissionFor = (patientId, templateId) =>
    submissions.find(
      (s) =>
        String(s.patient_id) === String(patientId) &&
        String(s.template_id) === String(templateId),
    ) || null

  const openAssessment = (patientId, templateId, readOnly = false) => {
    const submission = getSubmissionFor(patientId, templateId)
    const nextReadOnly = readOnly || Boolean(submission && !['draft', 'revalidation'].includes(submission.status))
    setSelectedPatientId(patientId)
    setAnswerPrefill({
      patientId,
      templateId,
      submission,
      readOnly: nextReadOnly,
    })
  }

  const handleStudentSelect = (patientId) => {
    if (isViewingForm) return
    setSelectedPatientId(patientId)
    if (answerPrefill) {
      const submission = getSubmissionFor(patientId, answerPrefill.templateId)
      setAnswerPrefill((current) => {
        if (!current) return current
        const nextReadOnly = current.readOnly || Boolean(submission && !['draft', 'revalidation'].includes(submission.status))
        return {
          ...current,
          patientId,
          submission,
          readOnly: nextReadOnly,
        }
      })
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <StaffHeader title="Assessment Services" />
      <div
        className={`flex-1 min-h-0 overflow-y-auto flex flex-col ${isViewingForm ? 'px-2 min-[360px]:px-4 sm:px-6 pt-2 sm:pt-3 pb-2 min-[360px]:pb-4 sm:pb-6' : 'p-2 min-[360px]:p-4 sm:p-6 lg:overflow-hidden'}`}
        data-onboarding-key="psychometrician-assessments-workspace"
      >
        <div className={`w-full mx-auto min-h-full lg:min-h-0 lg:flex-1 flex flex-col gap-6 ${isViewingForm ? 'max-w-none' : 'max-w-7xl'}`}>
          {/* Main Layout Grid: directory track collapses to 0 in form view.
              Tracks snap instantly (same as the psychologist Approvals page);
              the motion comes from the directory slide-fade + form slide-in. */}
          <div className={`grid grid-cols-1 gap-6 min-h-0 lg:flex-1 items-start ${formExpanded ? 'lg:grid-cols-[0fr_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'}`}>

            {/* Left Panel: Student Directory (slides away in form view) */}
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${formExpanded ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={isViewingForm || undefined}
            >
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 transition-colors border border-purple-200 dark:border-slate-700 transition-colors p-5 shadow-sm flex min-h-0 flex-col lg:h-full lg:sticky lg:top-0"
              data-onboarding-key="psychometrician-assessments-directory"
            >
              <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors border-b border-purple-100 pb-3 shrink-0">
                Student Directory
              </h2>
              <div className="mt-3 shrink-0">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search students"
                  className="w-full"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 px-1.5 -mx-1.5 space-y-2 p-2 -m-2">
                {/* Render from data once it exists — the skeleton is only for
                    the true first load, so the directory can never lag behind
                    the detail panel during refreshes. */}
                {loading && patients.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
                  ))
                ) : loadError && patients.length === 0 ? (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-6 text-center">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300">Couldn&apos;t load the directory</div>
                    <div className="mt-1 text-[11px] leading-5 text-rose-600 dark:text-rose-400">{loadError}</div>
                    <button
                      type="button"
                      onClick={() => load()}
                      className="mt-3 rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">
                    No students found.
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isActive = selectedPatientId === p.id
                    return (
                        <button
                          key={p.id}
                          ref={(element) => {
                            studentCardRefs.current[p.id] = element
                          }}
                          onClick={() => handleStudentSelect(p.id)}
                          disabled={isViewingForm}
                          aria-disabled={isViewingForm}
                          className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group ${isActive ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-sm text-purple-950 dark:text-purple-100 font-bold animate-fadeIn scale-[1.02] shadow-md' : 'border-transparent'
                          } ${isViewingForm ? 'cursor-not-allowed opacity-60 hover:bg-transparent' : ''}`}
                        >
                        <div className="flex items-center gap-3 w-full">
                          {p.photo_url || p.patients?.photo_url ? (
                            <img src={p.photo_url || p.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ isActive ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                          <div className={`font-semibold text-sm ${isActive ? 'text-purple-950 dark:text-purple-100 font-bold' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                            {formatLastFirstMI(p) || p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            ID: {p.patient_id || 'N/A'}
                          </div>
                        </div>
                      
                        </div></button>
                    )
                  })
                )}
              </div>
            </div>
            </div>

            {/* Right Panel: Student Actions */}
            <div
              key={selectedPatientId || 'empty'}
              className="student-directory-panel flex min-h-0 flex-col lg:h-full"
              data-onboarding-key="psychometrician-assessments-panel"
            >
              {selectedPatient ? (
                openForm || answerPrefill ? (
                  <div className={`flex min-h-0 flex-1 flex-col relative animate-view-slide-in transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${isClosingForm ? 'opacity-0 translate-x-8 pointer-events-none' : ''}`}>
                    <div className="sticky top-0 z-30 mb-4 flex shrink-0 items-center gap-3 bg-[#F5F1FA] dark:bg-slate-950 pb-2 pt-2 shadow-sm rounded-xl px-3 transition-colors">
                      <button
                        onClick={closeFormView}
                        className="group flex shrink-0 items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 dark:hover:border-slate-600 hover:bg-purple-50 dark:hover:bg-slate-800 hover:shadow"
                      >
                        <span className="transition-transform duration-300 group-hover:-translate-x-1">&larr;</span>
                        <span className="hidden sm:inline">Back to Dashboard Tables</span>
                        <span className="sm:hidden">Back</span>
                      </button>
                      <div className="hidden min-w-0 flex-1 sm:block">
                        <div className="truncate text-center text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors sm:text-base">
                          {formHeaderTitle}
                        </div>
                        {formHeaderSubtitle ? (
                          <div className="truncate text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                            {formHeaderSubtitle}
                          </div>
                        ) : null}
                      </div>
                      <div
                        ref={setHeaderActionsTarget}
                        className="flex min-w-0 shrink-0 items-center justify-end"
                      />
                    </div>
                    <div className="flex-1 min-h-0 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors overflow-hidden bg-white dark:bg-slate-900 transition-colors shadow-sm">



                      {openForm === 'behavioral' && (
                        <BehavioralAssessmentForm
                          patient={selectedPatient}
                          inline={true}
                          splitLayout={true}
                          headerActionsTarget={headerActionsTarget}
                          onSaved={() => load()}
                          onClose={() => {
                            closeFormView()
                            load()
                          }}
                        />
                      )}
                      {openForm === 'viewBehavioral' && activeReport && (
                        <BehavioralAssessmentForm
                          patient={selectedPatient}
                          detail={activeReport}
                          readOnly={
                            !['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(
                              activeReport.status,
                            )
                          }
                          inline={true}
                          splitLayout={true}
                          headerActionsTarget={headerActionsTarget}
                          onSaved={() => load()}
                          onClose={() => {
                            closeFormView()
                            load()
                          }}
                        />
                      )}
                      {answerPrefill && (
                        <ErrorBoundary>
                          <AnswerAssessment
                              tests={tests}
                              patients={patients}
                              prefilledPatientId={answerPrefill.patientId}
                              prefilledTemplateId={answerPrefill.templateId}
                              prefilledPatient={selectedPatient}
                              prefilledPatientName={selectedPatient?.name || ''}
                              submission={answerPrefill.submission}
                              readOnly={answerPrefill.readOnly}
                              inline={true}
                              splitLayout={true}
                              currentSigner={{
                                display_name: profile?.display_name || profile?.name || 'NA',
                                title: profile?.title || 'Psychometrician (RPm)',
                                license_no: profile?.license_no || 'NA',
                              }}
                              reviewerProfile={selectedPatient.treating_psychologist || null}
                              headerActionsTarget={headerActionsTarget}
                              onSubmitted={() => load()}
                              onDraftSaved={() => load()}
                              onClose={() => {
                                closeFormView()
                                load()
                              }}
                            />
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6 animate-view-slide-in-left">
                    {/* Selected Student header */}
                    <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">
                            {selectedPatient.name}
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-1">
                            Select and administer standardized clinical assessments for this student. Submissions will be forwarded to the supervising Psychologist for final signature.
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end items-center" />
                      </div>
                    </div>

                    {/* Assessment Tool Catalog Table */}
                    <div ref={(el) => { sectionRefs.current.assessmentTemplates = el }} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                      <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider mb-3">
                        Standardized Assessment Templates
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors">
                            <tr className="text-xs font-semibold tracking-wider text-purple-700 border-b border-purple-100">
                              <th className="py-2.5 px-3 text-left">Assessment Tool</th>
                              <th className="py-2.5 px-3 text-left">Status</th>
                              <th className="py-3.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/40">
                            {activeTests.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                                  No assessment templates configured.
                                </td>
                              </tr>
                            ) : (
                              activeTests.map((t) => {
                                const sub = getSubmissionFor(selectedPatientId, t.id)
                                const canAnswer = hasCompletedRequirements

                                let statusBadge = null
                                let actionBtn = null

                                if (sub) {
                                  if (sub.status === 'scored') {
                                    statusBadge = (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Approved &amp; Completed
                                      </span>
                                    )
                                    actionBtn = (
                                      <div className="flex items-center justify-end gap-2">
                                        <AnimatedActionBtn
                                          onClick={() => openAssessment(selectedPatientId, t.id, true)}
                                          title="View Answers"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
                                        </AnimatedActionBtn>
                                      </div>
                                    )
                                  } else if (sub.status === 'revalidation') {
                                    statusBadge = (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        Revalidation Required
                                      </span>
                                    )
                                    actionBtn = (
                                      <div className="flex items-center justify-end gap-2">
                                        <AnimatedActionBtn
                                          onClick={() => openAssessment(selectedPatientId, t.id, true)}
                                          title="View Answers"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
                                        </AnimatedActionBtn>
                                      <AnimatedActionBtn
                                        onClick={() => canAnswer && openAssessment(selectedPatientId, t.id, false)}
                                        disabled={!canAnswer}
                                        title={!canAnswer ? 'Admission and Consent waivers must be approved first.' : ''}
                                        className="whitespace-nowrap"
                                        variant="write"
                                      >
                                        Answer (Revalidate)
                                      </AnimatedActionBtn>
                                      </div>
                                    )
                                  } else if (sub.status === 'draft') {
                                    statusBadge = (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                        Draft
                                      </span>
                                    )
                                    actionBtn = (
                                      <div className="flex items-center justify-end gap-2">
                                      <AnimatedActionBtn
                                        onClick={() => canAnswer && openAssessment(selectedPatientId, t.id, false)}
                                        disabled={!canAnswer}
                                        title={!canAnswer ? 'Admission and Consent waivers must be approved first.' : ''}
                                        className="whitespace-nowrap"
                                        variant="write"
                                      >
                                        Continue Assessment
                                      </AnimatedActionBtn>
                                      </div>
                                    )
                                  } else {
                                    statusBadge = (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 dark:bg-sky-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                        Pending Approval
                                      </span>
                                    )
                                    actionBtn = (
                                      <div className="flex items-center justify-end gap-2">
                                        <AnimatedActionBtn
                                          onClick={() => openAssessment(selectedPatientId, t.id, true)}
                                          title="View Answers"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
                                        </AnimatedActionBtn>
                                      </div>
                                    )
                                  }
                                } else {
                                  statusBadge = (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                      Not Started
                                    </span>
                                  )
                                  actionBtn = (
                                    <AnimatedActionBtn
                                      onClick={() => canAnswer && openAssessment(selectedPatientId, t.id, false)}
                                      disabled={!canAnswer}
                                      title={!canAnswer ? 'Admission and Consent waivers must be approved first.' : ''}
                                      className="whitespace-nowrap"
                                    >
                                      Answer Assessment
                                    </AnimatedActionBtn>
                                  )
                                }

                                return (
                                  <tr key={t.id} className={`transition-colors ${highlightItem && String(highlightItem) === String(t.id) ? 'bg-purple-50 dark:bg-purple-900/40 ring-2 ring-inset ring-purple-300 dark:ring-purple-600' : 'hover:bg-purple-50/20'}`}>
                                    <td className="py-3.5 px-3">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">{t.title}</div>
                                      <div className="text-[11px] text-slate-400">{t.desc}</div>
                                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-purple-500">
                                        {t.code}{t.duration ? ` · ${t.duration}` : ''}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3">
                                      {statusBadge}
                                      {sub?.status === 'revalidation' && sub?.reviewer_comment ? (
                                        <div className="mt-1.5 max-w-55 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 text-[11px] leading-4 text-orange-800 dark:text-orange-200">
                                          <span className="font-bold">Psychologist&apos;s note: </span>
                                          {sub.reviewer_comment}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="py-3.5 px-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {actionBtn}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Behavioral Assessment Reports Panel */}
                    <div ref={(el) => { sectionRefs.current.behavioralReports = el }} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider">
                            Behavioral Assessment Reports ledger
                          </h3>
                          {canWriteBehavioral && patientReports.length === 0 ? (
                            <div className="self-start sm:self-auto" title={!hasCompletedRequirements ? 'Admission and Consent waivers must be approved first.' : ''}>
                              <AnimatedActionBtn
                                onClick={() => setOpenForm('behavioral')}
                                disabled={!hasCompletedRequirements}
                                className={`whitespace-nowrap ${!hasCompletedRequirements ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Write Behavioral Assessment Report
                              </AnimatedActionBtn>
                            </div>
                          ) : null}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors">
                            <tr className="text-xs font-semibold tracking-wider text-purple-700 border-b border-purple-100 pb-2 text-left">
                              <th className="pb-3 px-2">Report Title</th>
                              <th className="pb-3 px-2">Last Updated Date</th>
                              <th className="pb-3 px-2">Status</th>
                              <th className="pb-3 px-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-50/40">
                            {patientReports.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                  No behavioral assessment reports drafted for this student.
                                </td>
                              </tr>
                              ) : (
                                patientReports.map((r) => {
                                  const meta = STATUS_META[r.status] || STATUS_META.draft
                                return (
                                  <tr key={`${r.type}-${r.id}`} className={`transition-colors ${highlightItem && String(highlightItem) === String(r.id) ? 'bg-purple-50 dark:bg-purple-900/40 ring-2 ring-inset ring-purple-300 dark:ring-purple-600' : 'hover:bg-purple-50/10'}`}>
                                    <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-100 transition-colors">
                                      <div>{r.title}</div>
                                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-500">
                                        Behavioral Assessment Report
                                      </div>
                                      {r.status === 'revise_requested' && r.reviewer_comment ? (
                                        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
                                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          <div className="flex-1">
                                            <div className="text-[11px] font-bold uppercase tracking-widest text-red-800">Psychologist's Note</div>
                                            <div className="mt-1 text-xs font-medium leading-relaxed text-red-900 break-words">{r.reviewer_comment}</div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">{fmtDate(r.date)}</td>
                                      <td className="py-3 px-2">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                                          {meta.label}
                                        </span>
                                      </td>
                                      <td className="py-3 px-2 text-right">
                                        <AnimatedActionBtn
                                          variant="view"
                                          onClick={() => {
                                            setActiveReport(r)
                                            setOpenForm('viewBehavioral')
                                          }}
                                        >
                                          {['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(r.status)
                                              ? 'View & Edit'
                                              : 'View Form'}
                                        </AnimatedActionBtn>
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm flex min-h-[320px] flex-col items-center justify-center">
                  <svg className="h-16 w-16 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                  </svg>
                  <p className="mt-4 text-sm font-medium">Please select a student from the directory to configure assessment actions.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default Assessments;
