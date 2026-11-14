import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRef } from 'react'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedActionBtn from '../../../components/ui/AnimatedActionBtn'
import Checkbox from '../../../components/ui/Checkbox'
import { api } from '../../../lib/api'
import { capitalizeName, compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import { focusReviewerComment } from '../../../lib/focusReviewerComment'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import BehavioralAssessmentForm from '../psychometrician/BehavioralAssessmentForm'
import ProgressSummaryReportForm from '../psychologist/ProgressSummaryReportForm'
import IepSpedForm from '../psychometrician/IepSpedForm'
import AnswerAssessment from '../psychometrician/AnswerAssessment'
import SignaturePad from '../../../components/ui/SignaturePad'
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-')
const isComplianceComplete = (patient) =>
  patient?.admission_form_status === 'complete' &&
  (patient?.waiver_submissions || []).some(
    (w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved',
  )
const toDateKey = (value) => {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}
const isWeekdayDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (![year, month, day].every(Number.isInteger)) return false
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday !== 0 && weekday !== 6
}
const todayDateKey = () => {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const monthKeyFor = (value) => (toDateKey(value) || todayDateKey()).slice(0, 7)
const shiftMonthKey = (value, amount) => {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
const calendarModel = (value) => {
  const [year, month] = value.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const total = new Date(year, month, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return {
    label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    cells,
  }
}
const COMMENT_LIMIT = 100
const clampComment = (value) => (value || '').slice(0, COMMENT_LIMIT)
const normalizeText = (value) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim()
const samePersonName = (a, b) => normalizeText(a) && normalizeText(a) === normalizeText(b)

const STATUS_META = {
  draft: { label: 'DRAFT', tone: 'bg-amber-100 text-amber-700 border border-amber-200' },
  submitted: { label: 'SUBMITTED', tone: 'bg-sky-100 text-sky-700 border border-sky-200' },
  ready_for_review: { label: 'PENDING REVIEW', tone: 'bg-sky-100 text-sky-700 border border-sky-200' },
  approved: { label: 'APPROVED', tone: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  revise_requested: { label: 'RETURNED', tone: 'bg-rose-100 text-rose-700 border border-rose-200' },
}

function Approvals() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const deepLinkPatientId = searchParams.get('patientId') || ''
  const deepLinkSection = searchParams.get('section') || ''
  const deepLinkReportId = searchParams.get('reportId') || ''
  const deepLinkSubmissionId = searchParams.get('submissionId') || ''
  const studentCardRefs = useRef({})
  const sectionRefs = useRef({})
  const [highlightReport, setHighlightReport] = useState(null)
  const [patients, setPatients] = useState([])
  const [tests, setTests] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [reports, setReports] = useState([])
  const [viewRequests, setViewRequests] = useState([])
  const [activeReport, setActiveReport] = useState(null)
  const [reviewerProfile, setReviewerProfile] = useState(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [viewRequestBusyId, setViewRequestBusyId] = useState(null)
  const [query, setQuery] = useState('')
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [openForm, setOpenForm] = useState(null)
  const [viewSub, setViewSub] = useState(null)
  const [commentId, setCommentId] = useState(null)
  const [submissionAction, setSubmissionAction] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [submissionSignature, setSubmissionSignature] = useState(null)
  const [behavioralComment, setBehavioralComment] = useState('')
  const [behavioralSignature, setBehavioralSignature] = useState(null)
  const [behavioralSaving, setBehavioralSaving] = useState(false)
  const [iepComment, setIepComment] = useState('')
  const [iepSignature, setIepSignature] = useState(null)
  const [iepSaving, setIepSaving] = useState(false)
  const [monthlyComment, setMonthlyComment] = useState('')
  const [monthlySignature, setMonthlySignature] = useState(null)
  const [monthlySaving, setMonthlySaving] = useState(false)
  const [headerActionsTarget, setHeaderActionsTarget] = useState(null)
  const navigate = useNavigate()

  // Tell StaffLayout to refetch nav badges immediately instead of waiting
  // for the 30s poll, so the Approvals badge clears as soon as the last
  // pending item is decided.
  const notifyBadgeRefresh = () => {
    try {
      window.dispatchEvent(new Event('cymon-badge-update'))
    } catch {
      // ignore event errors
    }
  }

  const loadData = async () => {
    try {
      // One round of parallel fetches instead of sequential awaits. The
      // roster call is lean (patients + tests only) and drafting-reports is
      // skipped entirely: /psychologist/approvals already returns every
      // non-draft behavioral/IEP row, so merging drafting rows only
      // re-downloaded the same reports with their full content payloads.
      const [meData, approvalsData, rosterData] = await Promise.all([
        api.me(),
        api.psychologist.approvals(),
        api.psychometrician.assessmentsLean(),
      ])
      const myRoles = [meData.profile?.role, ...(meData.profile?.extra_roles || [])]
      const isAdminView = myRoles.includes('admin')
      setReviewerProfile(meData.profile || null)
      const rosterPatients = rosterData.patients || []
      const fetchedSubmissions = approvalsData.submissions || []
      // Pending review work must stay visible even when enrollment compliance
      // is incomplete — otherwise a notification deep link lands on an empty
      // directory ("No students found") with the student filtered out.
      const pendingPatientIds = new Set([
        ...fetchedSubmissions
          .filter((s) => s.status === 'submitted')
          .map((s) => String(s.patient_id)),
        ...((approvalsData.reports || []))
          .filter((r) => r.status === 'ready_for_review')
          .map((r) => String(r.patient_id)),
      ])
      const visiblePatients = isAdminView
        ? rosterPatients
        : rosterPatients.filter((p) => isComplianceComplete(p) || pendingPatientIds.has(String(p.id)))
      const patientIds = new Set(visiblePatients.map((p) => String(p.id)))
      setSubmissions((approvalsData.submissions || []).filter((s) => isAdminView || patientIds.has(String(s.patient_id))))
      // Document release scheduling is owned by the administrator now.
      setViewRequests([])
      
      setPatients(visiblePatients)
      setTests(rosterData.tests || [])

      const combinedReports = [...(approvalsData.reports || [])]
        .filter(Boolean)
        .filter((report) => isAdminView || patientIds.has(String(report.patient_id)))
      const seen = new Set()
      setReports(
        combinedReports
          .filter((report) => !['draft', 'in_progress'].includes(report?.status))
          .filter((report) => ['behavioral', 'iep'].includes(report?.report_type || report?.type || 'behavioral'))
          .filter((report) => {
            const key = `${report?.report_type || report?.type || 'report'}:${report?.id}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }),
      )
    } catch (e) {
      console.error(e)
      toast.error('Error loading data')
    }
  }

  const resolveOnsiteRequest = async (request, status, options = request.options || []) => {
    const busyKey = `${request.source_table}:${request.source_id}`
    setViewRequestBusyId(busyKey)
    try {
      await api.psychologist.resolveAssessmentOnsiteViewRequest(
        request.source_table,
        request.source_id,
        status,
        options,
      )
      setViewRequests((current) => status === 'options_proposed'
        ? current.map((item) => item.id === request.id ? { ...item, status, options, options_draft: options, calendar_open: false } : item)
        : status === 'completed'
          ? current.map((item) => item.id === request.id ? { ...item, status, options: [], options_draft: [], calendar_open: false } : item)
          : current.filter((item) => item.id !== request.id))
      toast.success(
        status === 'options_proposed'
          ? 'Available onsite viewing dates sent to the client.'
          : status === 'completed'
            ? 'Onsite viewing marked as done.'
          : status === 'cancelled'
            ? 'Onsite viewing schedule cancelled.'
            : 'Onsite viewing request denied.',
      )
    } catch (error) {
      toast.error(error.message || 'Unable to resolve the onsite viewing request.')
    } finally {
      setViewRequestBusyId(null)
    }
  }

  useEffect(() => {
    let on = true
    setLoading(true)
    loadData().finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
  }, [])

  // Live-refresh the directory and queues when review work changes
  // elsewhere. Submissions/reports carry no clinic_id column, so they
  // subscribe unfiltered — RLS still delivers only own-clinic assigned rows.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId
      ? [
          { table: 'patients', filter: `clinic_id=eq.${clinicId}` },
          { table: 'assessment_submissions' },
          { table: 'assessment_reports' },
        ]
      : [],
    () => {
      loadData()
    },
  )

  // Smart auto-selection of the first patient with a pending submission
  useEffect(() => {
    if (!loading && patients.length > 0 && !selectedPatientId) {
      const pendingPatient = patients.find((p) => {
        const hasPendingSubmission = submissions.some(
          (s) => String(s.patient_id) === String(p.id) && s.status === 'submitted',
        )
        const hasPendingReport = reports.some(
          (r) =>
            String(r.patient_id) === String(p.id) &&
            r.status === 'ready_for_review' &&
            (r.report_type === 'behavioral' || r.report_type === 'iep' || /report/i.test(r.type || '')),
        )
        const hasViewRequest = viewRequests.some((request) => String(request.patient_id) === String(p.id))
        return hasPendingSubmission || hasPendingReport || hasViewRequest
      })
      setSelectedPatientId(pendingPatient ? pendingPatient.id : patients[0].id)
    }
  }, [loading, patients, submissions, reports, viewRequests, selectedPatientId])

  useEffect(() => {
    if (loading || !deepLinkPatientId) return
    const patient = patients.find((item) => String(item.id) === String(deepLinkPatientId))
    if (!patient) return
    // A notification deep link must land on the student even when the
    // directory search box or the pending-only toggle would hide them.
    setQuery('')
    setShowOnlyPending(false)
    setSelectedPatientId(patient.id)
  }, [loading, patients, deepLinkPatientId])

  useEffect(() => {
    if (!deepLinkPatientId || String(selectedPatientId) !== String(deepLinkPatientId)) return
    requestAnimationFrame(() => {
      studentCardRefs.current[deepLinkPatientId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [selectedPatientId, deepLinkPatientId])

  useEffect(() => {
    if (!deepLinkSection || !deepLinkPatientId || String(selectedPatientId) !== String(deepLinkPatientId)) return
    const sectionKey = deepLinkSection === 'iep' ? 'iepDocs'
      : deepLinkSection === 'behavioral' ? 'behavioralReports'
      : 'submissions'
    requestAnimationFrame(() => {
      sectionRefs.current[sectionKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    if (deepLinkReportId || deepLinkSubmissionId) {
      setHighlightReport(deepLinkReportId || deepLinkSubmissionId)
      const timer = setTimeout(() => setHighlightReport(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [selectedPatientId, deepLinkSection, deepLinkPatientId, deepLinkReportId, deepLinkSubmissionId])

  const handleUpdateStatus = async (id, status, comment, signature) => {
    const cleanedComment = clampComment(comment).trim()
    if (status === 'scored' && !signature) {
      toast.error('Please add the psychologist signature before approving.')
      return
    }
    if (status === 'revalidation' && !cleanedComment) {
      toast.error('Please add a comment before returning this submission.')
      return
    }
    setBusyId(id)
    try {
      const payload = { status }
      if (comment !== undefined) payload.reviewer_comment = cleanedComment || null
      if (signature !== undefined) payload.reviewer_signature_image = signature
      await api.psychologist.updateSubmission(id, payload)
      toast.success(status === 'scored' ? 'Assessment approved and signed.' : 'Assessment returned as draft.')
      setViewSub((current) =>
        current && current.id === id
          ? {
              ...current,
              status,
              reviewer_comment: cleanedComment || null,
              reviewer_signature_image: signature || null,
            }
          : current,
      )
      setCommentId(null)
      setSubmissionAction(null)
      setCommentText('')
      setSubmissionSignature(null)
      await loadData()
      notifyBadgeRefresh()
    } catch (e) {
      toast.error(`Error updating status: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleBehavioralDecision = async (status) => {
    if (!activeReport) return
    const cleanedComment = clampComment(behavioralComment).trim()
    if (status === 'approved' && !behavioralSignature) {
      toast.error('Please add the psychologist signature before approving.')
      return
    }
    if (status === 'revise_requested' && !cleanedComment) {
      toast.error('Please add a comment before returning this report.')
      focusReviewerComment()
      return
    }
    setBehavioralSaving(true)
    try {
      await api.psychologist.updateReport(activeReport.id, {
        status,
        reviewer_comment: cleanedComment || null,
        reviewer_signature_image: behavioralSignature || null,
      })
      toast.success(status === 'approved' ? 'Behavioral report approved and signed.' : 'Behavioral report returned for revision.')
      setBehavioralComment('')
      setBehavioralSignature(null)
      setOpenForm(null)
      setActiveReport(null)
      await loadData()
      notifyBadgeRefresh()
    } catch (e) {
      toast.error(`Error updating behavioral report: ${e.message}`)
    } finally {
      setBehavioralSaving(false)
    }
  }

  const handleIepDecision = async (status) => {
    if (!activeReport) return
    const cleanedComment = clampComment(iepComment).trim()
    if (status === 'approved' && !iepSignature) {
      toast.error('Please add the psychologist signature before approving the IEP.')
      return
    }
    if (status === 'revise_requested' && !cleanedComment) {
      toast.error('Please add a comment before returning this IEP.')
      focusReviewerComment()
      return
    }
    setIepSaving(true)
    try {
      await api.psychologist.updateReport(activeReport.id, {
        status,
        reviewer_comment: cleanedComment || null,
        reviewer_signature_image: iepSignature || null,
      })
      toast.success(status === 'approved' ? 'IEP approved and signed.' : 'IEP returned for revision.')
      setIepComment('')
      setIepSignature(null)
      setOpenForm(null)
      setActiveReport(null)
      await loadData()
      notifyBadgeRefresh()
    } catch (e) {
      toast.error(`Error updating IEP: ${e.message}`)
    } finally {
      setIepSaving(false)
    }
  }

  const handleMonthlyDecision = async (status) => {
    if (!activeReport) return
    const cleanedComment = clampComment(monthlyComment).trim()
    if (status === 'approved' && !monthlySignature) {
      toast.error('Please add the psychologist signature before approving the monthly report.')
      return
    }
    if (status === 'revise_requested' && !cleanedComment) {
      toast.error('Please add a comment before returning the monthly report.')
      focusReviewerComment()
      return
    }
    setMonthlySaving(true)
    try {
      await api.psychologist.updateReport(activeReport.id, {
        status,
        reviewer_comment: cleanedComment || null,
        reviewer_signature_image: status === 'approved' ? monthlySignature : null,
      })
      toast.success(
        status === 'approved'
          ? 'Monthly Assessment Report approved and signed.'
          : 'Monthly Assessment Report returned for revision.',
      )
      setMonthlyComment('')
      setMonthlySignature(null)
      setOpenForm(null)
      setActiveReport(null)
      await loadData()
      notifyBadgeRefresh()
    } catch (e) {
      toast.error(`Error updating monthly report: ${e.message}`)
    } finally {
      setMonthlySaving(false)
    }
  }

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const filteredPatients = pinStudentFirst(patients.filter((p) => {
    const matchesSearch = !q || [p.name, formatLastFirstMI(p), p.patient_id].some((v) => String(v || '').toLowerCase().replace(/,/g, ' ').includes(q))
    if (!matchesSearch) return false

    if (showOnlyPending) {
      const hasPending = submissions.some(s => s.patient_id === p.id && s.status === 'submitted')
      const hasPendingReport = reports.some(
        (report) =>
          String(report.patient_id) === String(p.id) &&
          report.status === 'ready_for_review',
      )
      const hasViewRequest = viewRequests.some((request) => String(request.patient_id) === String(p.id))
      return hasPending || hasPendingReport || hasViewRequest
    }
    return true
  }).sort(compareStudentsAZ), deepLinkPatientId)

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  const patientSubmissions = submissions.filter(
    (s) => String(s.patient_id) === String(selectedPatientId) || samePersonName(s.student_name, selectedPatient?.name),
  )
  const patientPendingSubmissions = patientSubmissions.filter((s) => s.status === 'submitted')
  const patientViewRequests = viewRequests.filter(
    (request) => String(request.patient_id) === String(selectedPatientId),
  )
  const totalPendingSubmissions = submissions.filter(s => s.status === 'submitted').length
  const isViewingForm = Boolean(openForm || viewSub)
  // Matches the psychometrician Assessment Services behavior: the directory
  // track collapses to 0 and the panel slides away once a form is opened.
  const formExpanded = isViewingForm
  // Centered form title + code in the form header bar (same as Assessment
  // Services). Resolved from the already-loaded test/report lists.
  const headerTest = viewSub
    ? (Array.isArray(tests) ? tests : []).find((t) => String(t?.id) === String(viewSub.template_id))
    : null
  const formHeaderTitle = viewSub
    ? (headerTest?.title || 'Assessment')
    : (activeReport?.title || 'Report')
  const formHeaderSubtitle = viewSub
    ? (headerTest?.code || headerTest?.document_type_code || '')
    : ''

  const patientReports = selectedPatient
    ? reports.filter(
        (r) =>
          String(r.patient_id) === String(selectedPatient.id) ||
          samePersonName(r.name, selectedPatient.name) ||
          samePersonName(r.sid, selectedPatient.patient_id),
      )
    : []
  const iepReports = patientReports.filter((r) => (r.report_type || r.type) === 'iep')
  const behavioralReports = patientReports.filter((r) => (r.report_type || r.type || 'behavioral') === 'behavioral')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StaffHeader title="Approvals" />
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden p-6"
        data-onboarding-key="psychologist-approvals-workspace"
      >
        <div className={`mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full flex-col gap-6 ${formExpanded ? 'max-w-none' : 'max-w-7xl'}`}>

          {/* Main Layout Grid: directory track collapses to 0 in form view */}
          <div className={`grid min-h-0 lg:flex-1 grid-cols-1 items-start gap-6 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none ${formExpanded ? 'lg:grid-cols-[0fr_minmax(0,1fr)]' : 'lg:grid-cols-3'}`}>

            {/* Left Panel: Student Directory (slides away in form view) */}
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${formExpanded ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={isViewingForm || undefined}
            >
            <div
              className="flex min-h-0 flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm lg:h-full lg:sticky lg:top-0"
              data-onboarding-key="psychologist-approvals-directory"
            >
              <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors border-b border-purple-100 pb-3 shrink-0">
                Student Directory
              </h2>
              <div className="mt-3 shrink-0 space-y-3">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search students…"
                  className="w-full"
                />
                <Checkbox
                  checked={showOnlyPending}
                  onChange={(e) => setShowOnlyPending(e.target.checked)}
                  label="Show only pending submissions"
                  className="font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                />
              </div>
              <div key={loading ? 'loading' : 'loaded'} className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 px-1.5 -mx-1.5 space-y-2 p-2 -m-2 animate-content-fade-in">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
                  ))
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">
                    No students found.
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isActive = selectedPatientId === p.id
                    const patientPending = submissions.filter((s) => String(s.patient_id) === String(p.id) && s.status === 'submitted')
                    const pendingReports = reports.filter(
                      (report) =>
                        String(report.patient_id) === String(p.id) &&
                        report.status === 'ready_for_review',
                    )
                    const hasPendingReport = pendingReports.length > 0
                    const hasViewRequest = viewRequests.some((request) => String(request.patient_id) === String(p.id))
                    const hasPending = patientPending.length > 0 || hasPendingReport
                    // Name WHAT is pending so an approved IEP next to a
                    // still-pending behavioral report is never confusing.
                    const pendingBits = [
                      patientPending.length > 0 ? `${patientPending.length} assessment${patientPending.length === 1 ? '' : 's'}` : null,
                      ...pendingReports.map((report) => {
                        const kind = report.report_type === 'iep' ? 'IEP' : 'behavioral report'
                        return `1 ${kind}`
                      }),
                    ].filter(Boolean)
                    const pendingTitle = hasPending
                      ? `Awaiting review: ${pendingBits.join(', ') || 'pending items'}`
                      : ''

                      return (
                        <button
                          key={p.id}
                          ref={(element) => {
                            studentCardRefs.current[p.id] = element
                          }}
                          disabled={isViewingForm}
                          onClick={() => {
                            if (isViewingForm) return
                            setSelectedPatientId(p.id)
                          }}
                          className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group ${
                            isActive ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-sm text-purple-950 dark:text-purple-100 font-bold animate-fadeIn scale-[1.02] shadow-md' : 'border-transparent'
                          } ${isViewingForm ? 'cursor-not-allowed opacity-60 hover:bg-white dark:bg-slate-900 transition-colors' : ''}`}
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
                          <div className={`font-semibold text-sm ${isActive ? 'text-purple-950 dark:text-purple-100 font-bold' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                            {formatLastFirstMI(p) || p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>ID: {p.patient_id || 'N/A'}</span>
                            {hasPending && (
                              <span
                                title={pendingTitle}
                                className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700 animate-pulse"
                              >
                                Pending Approval{patientPending.length + pendingReports.length > 1 ? ` (${patientPending.length + pendingReports.length})` : ''}
                              </span>
                            )}
                            {hasViewRequest && (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700 animate-pulse">
                                Client PDF Request
                              </span>
                            )}
                          </div>
                        </div>
                      
                        </div></button>
                    )
                  })
                )}
              </div>
            </div>
            </div>

            {/* Right Panel: Student Actions (single track when the directory is collapsed) */}
            <div
              key={selectedPatientId || 'empty'}
              className={`student-directory-panel flex min-h-0 flex-col lg:h-full ${formExpanded ? '' : 'lg:col-span-2'}`}
              data-onboarding-key="psychologist-approvals-panel"
            >
              {selectedPatient ? (
                openForm || viewSub ? (
                  <div className="flex min-h-0 flex-1 flex-col animate-view-slide-in">
                    <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          setOpenForm(null)
                          setViewSub(null)
                        }}
                        className="group flex shrink-0 items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow"
                      >
                        <span className="transition-transform duration-300 group-hover:-translate-x-1">&larr;</span>
                        <span>Back to Dashboard Tables</span>
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
                    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
                      {openForm === 'viewBehavioral' && activeReport && (
                        <BehavioralAssessmentForm
                          patient={selectedPatient}
                          detail={activeReport}
                          readOnly={true}
                          inline={true}
                          headerActionsTarget={headerActionsTarget}
                          reviewerMode={
                            activeReport.report_type === 'behavioral' &&
                            activeReport.status === 'ready_for_review'
                          }
                          reviewerProfile={reviewerProfile || profile}
                          reviewerSignature={behavioralSignature}
                          reviewerComment={behavioralComment}
                          reviewerBusy={behavioralSaving}
                          onReviewerSignatureChange={setBehavioralSignature}
                          onReviewerCommentChange={(value) => setBehavioralComment(clampComment(value))}
                          onReviewerReturn={() => handleBehavioralDecision('revise_requested')}
                          onReviewerApprove={() => handleBehavioralDecision('approved')}
                          onClose={() => {
                            setOpenForm(null)
                            setBehavioralComment('')
                            setBehavioralSignature(null)
                            loadData()
                          }}
                        />
                      )}
                      {openForm === 'viewProgress' && activeReport && (
                        <ProgressSummaryReportForm
                          patient={selectedPatient}
                          detail={activeReport}
                          readOnly={true}
                          patients={patients}
                          inline={true}
                          headerActionsTarget={headerActionsTarget}
                          reviewerMode={activeReport.status === 'ready_for_review'}
                          reviewerProfile={reviewerProfile || profile}
                          reviewerSignature={monthlySignature}
                          reviewerComment={monthlyComment}
                          reviewerBusy={monthlySaving}
                          onReviewerSignatureChange={setMonthlySignature}
                          onReviewerCommentChange={(value) =>
                            setMonthlyComment(clampComment(value))
                          }
                          onReviewerReturn={() =>
                            handleMonthlyDecision('revise_requested')
                          }
                          onReviewerApprove={() => handleMonthlyDecision('approved')}
                          onClose={() => {
                            setOpenForm(null)
                            setMonthlyComment('')
                            setMonthlySignature(null)
                            loadData()
                          }}
                        />
                      )}
                      {openForm === 'viewIep' && activeReport && (
                        <IepSpedForm
                          patient={selectedPatient}
                          report={activeReport}
                          inline={true}
                          headerActionsTarget={headerActionsTarget}
                          readOnly={true}
                          reviewerMode={activeReport.status === 'ready_for_review'}
                          reviewerProfile={reviewerProfile || profile}
                          reviewerSignature={iepSignature}
                          reviewerComment={iepComment}
                          reviewerBusy={iepSaving}
                          onReviewerSignatureChange={setIepSignature}
                          onReviewerCommentChange={(value) => setIepComment(clampComment(value))}
                          onReviewerReturn={() => handleIepDecision('revise_requested')}
                          onReviewerApprove={() => handleIepDecision('approved')}
                          onClose={() => {
                            setOpenForm(null)
                            setIepComment('')
                            setIepSignature(null)
                            loadData()
                          }}
                        />
                      )}
                      {viewSub && (
                        <AnswerAssessment
                          tests={tests}
                          patients={patients}
                          prefilledPatientId={viewSub.patient_id}
                          prefilledTemplateId={viewSub.template_id}
                          submission={viewSub}
                          readOnly={true}
                          inline={true}
                          splitLayout={true}
                          headerActionsTarget={headerActionsTarget}
                          reviewerMode={viewSub.status === 'submitted' || viewSub.status === 'ready_for_review'}
                          reviewerProfile={reviewerProfile || profile}
                          reviewerSignature={submissionSignature}
                          reviewerComment={commentText}
                          reviewerBusy={busyId === viewSub.id}
                          onReviewerSignatureChange={setSubmissionSignature}
                          onReviewerCommentChange={setCommentText}
                          onReviewerReturn={() => handleUpdateStatus(viewSub.id, 'revalidation', commentText, null)}
                          onReviewerApprove={() => handleUpdateStatus(viewSub.id, 'scored', commentText, submissionSignature)}
                          onClose={() => setViewSub(null)}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-6 animate-view-slide-in-left">
                  {/* Selected Student header */}
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">
                          {selectedPatient.name}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-1">
                          Manage and approve completed standardized assessment reports for this student.
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end items-center" />
                    </div>
                  </div>

                  {patientViewRequests.length > 0 ? (
                    <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">
                            Onsite Document Viewing
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                            Toggle available clinic dates for approved documents. The client selects one mutual date; no digital copy is released.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Pending"
                            aria-label={`Pending: ${patientViewRequests.filter((request) => request.status === 'pending').length}`}
                          >
                            <Clock3 size={13} strokeWidth={2.5} aria-hidden="true" />
                            {patientViewRequests.filter((request) => request.status === 'pending').length}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Awaiting client selection"
                            aria-label={`Awaiting client selection: ${patientViewRequests.filter((request) => request.status === 'options_proposed').length}`}
                          >
                            <CalendarDays size={13} strokeWidth={2.5} aria-hidden="true" />
                            {patientViewRequests.filter((request) => request.status === 'options_proposed').length}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Scheduled"
                            aria-label={`Scheduled: ${patientViewRequests.filter((request) => request.status === 'scheduled').length}`}
                          >
                            <CalendarCheck size={13} strokeWidth={2.5} aria-hidden="true" />
                            {patientViewRequests.filter((request) => request.status === 'scheduled').length}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Completed"
                            aria-label={`Completed: ${patientViewRequests.filter((request) => request.status === 'completed').length}`}
                          >
                            <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden="true" />
                            {patientViewRequests.filter((request) => request.status === 'completed').length}
                          </span>
                        </span>
                      </div>
                      <div className="space-y-3">
                        {patientViewRequests.map((request) => {
                          const busy = viewRequestBusyId === `${request.source_table}:${request.source_id}`
                          const isScheduled = request.status === 'scheduled'
                          const isDone = request.status === 'completed'
                          const isProposed = request.status === 'options_proposed'
                          const submitOptions = [...new Set((request.options_draft || request.options || []).map(toDateKey).filter((value) => value && isWeekdayDate(value)))].sort()
                          const calendarMonth = request.calendar_month || monthKeyFor(submitOptions[0] || todayDateKey())
                          const calendar = calendarModel(calendarMonth)
                          const today = todayDateKey()
                          const currentMonth = today.slice(0, 7)
                          return (
                            <div key={request.id} className={`flex flex-col gap-2 rounded-xl border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${isDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-purple-100 bg-purple-50/40'}`}>
                              <div className="min-w-0">
                                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 transition-colors">{request.document_title}</div>
                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                                  {request.document_code || 'Assessment'} - Requested {fmtDate(request.requested_at)}
                                </div>
                                {isDone ? (
                                  <div className="hidden">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">✓</span>
                                      Onsite viewing completed
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Visit date: {fmtDate(request.scheduled_date || request.selected_at)}</div>
                                  </div>
                                ) : isScheduled ? (
                                  <div className="mt-1 text-xs font-bold text-emerald-700">
                                    Client selected {fmtDate(request.scheduled_date || request.selected_at)}
                                  </div>
                                ) : !request.calendar_open ? (
                                  <span className="hidden" />
                                ) : (
                                  <div
                                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
                                    role="presentation"
                                    onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                      ? { ...item, calendar_open: false }
                                      : item))}
                                  >
                                    <div
                                      role="dialog"
                                      aria-modal="true"
                                      aria-label="Set onsite viewing dates"
                                      onClick={(event) => event.stopPropagation()}
                                      className="w-full max-w-[390px] rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-2xl"
                                    >
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors">Set clinic dates</div>
                                          <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 transition-colors">Select any future weekdays.</div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                            ? { ...item, calendar_open: false }
                                            : item))}
                                          className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100"
                                        >
                                          Close
                                        </button>
                                      </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        aria-label="Previous month"
                                        disabled={calendarMonth <= currentMonth}
                                        onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                          ? { ...item, calendar_month: shiftMonthKey(calendarMonth, -1) }
                                          : item))}
                                        className="rounded-lg px-2 py-1 text-sm font-bold text-transparent hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-30 after:font-bold after:text-purple-700 after:content-['Prev']"
                                      >
                                        ‹
                                      </button>
                                      <div className="text-xs font-bold text-purple-800 dark:text-purple-300 transition-colors">{calendar.label}</div>
                                      <button
                                        type="button"
                                        aria-label="Next month"
                                        onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                          ? { ...item, calendar_month: shiftMonthKey(calendarMonth, 1) }
                                          : item))}
                                        className="rounded-lg px-2 py-1 text-sm font-bold text-transparent hover:bg-purple-50 after:font-bold after:text-purple-700 after:content-['Next']"
                                      >
                                        ›
                                      </button>
                                    </div>
                                    <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-slate-400">
                                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                                    </div>
                                    <div className="mt-1 grid grid-cols-7 gap-1">
                                      {calendar.cells.map((day, index) => {
                                        if (!day) return <span key={`empty-${index}`} className="h-8" />
                                        const selected = submitOptions.includes(day)
                                        const past = day <= today
                                        const weekend = !isWeekdayDate(day)
                                        return (
                                          <button
                                            key={day}
                                            type="button"
                                            disabled={past || weekend || busy}
                                            aria-label={`${fmtDate(day)}${selected ? ', available' : ', unavailable'}`}
                                            aria-pressed={selected}
                                            onClick={() => {
                                              setViewRequests((current) => current.map((item) => {
                                                if (item.id !== request.id) return item
                                                const currentOptions = [...new Set((item.options_draft || item.options || []).map(toDateKey).filter((value) => value && isWeekdayDate(value)))]
                                                const next = currentOptions.includes(day)
                                                  ? currentOptions.filter((value) => value !== day)
                                                  : [...currentOptions, day].sort()
                                                return { ...item, options_draft: next }
                                              }))
                                            }}
                                            className={`h-8 rounded-lg border text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${past || weekend
                                              ? 'border-transparent bg-slate-50 dark:bg-slate-950 transition-colors text-slate-300'
                                              : selected
                                                ? 'border-purple-700 bg-purple-700 text-white shadow-sm'
                                                : 'border-purple-100 bg-purple-50/30 text-slate-600 dark:text-slate-300 transition-colors hover:border-purple-400 hover:bg-purple-50'}`}
                                          >
                                            {Number(day.slice(-2))}
                                          </button>
                                        )
                                      })}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 transition-colors">
                                      <span>Click weekdays to toggle availability.</span>
                                      <span className="font-bold text-purple-700">{submitOptions.length} selected</span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-purple-100 pt-3">
                                      <button
                                        type="button"
                                        onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                          ? { ...item, calendar_open: false }
                                          : item))}
                                        className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-[11px] font-bold text-purple-700 transition-colors hover:bg-purple-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy || submitOptions.length === 0}
                                        onClick={() => resolveOnsiteRequest(request, 'options_proposed', submitOptions)}
                                        className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {busy ? 'Saving...' : isProposed ? 'Save Dates' : 'Send Dates'}
                                      </button>
                                    </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {isDone ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-emerald-700">{fmtDate(request.scheduled_date || request.selected_at)}</span>
                                    <span className="rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white">Done</span>
                                  </div>
                                ) : isScheduled ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => resolveOnsiteRequest(request, 'cancelled')}
                                      className="rounded-lg border border-rose-200 bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Cancel Schedule
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => resolveOnsiteRequest(request, 'completed')}
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {busy ? 'Saving...' : 'Mark as Done'}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {!request.calendar_open ? (
                                      <button
                                        type="button"
                                        onClick={() => setViewRequests((current) => current.map((item) => item.id === request.id
                                          ? { ...item, calendar_open: true }
                                          : item))}
                                        className="rounded-lg bg-purple-700 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-purple-800"
                                      >
                                        {isProposed ? 'Edit Dates' : 'Set Dates'}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => resolveOnsiteRequest(request, 'denied')}
                                      className="rounded-lg border border-rose-200 bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Deny
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Standardized Assessment Submissions Panel */}
                  <div ref={(el) => { sectionRefs.current.submissions = el }} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider mb-2">
                        Standardized Assessment Submissions
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 border-b border-purple-100 dark:border-slate-800 pb-2 text-left">
                              <th className="pb-3 px-2">Assessment Tool</th>
                              <th className="pb-3 px-2">Submitter / Date</th>
                              <th className="pb-3 px-2">Status</th>
                              <th className="pb-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/40 dark:divide-slate-800">
                            {patientSubmissions.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                  No assessment submissions recorded for this student.
                                </td>
                              </tr>
                            ) : (
                              patientSubmissions.map((s) => {
                                const isBusy = busyId === s.id
                                const isHighlighted = highlightReport && String(highlightReport) === String(s.id)
                                return (
                                  <tr key={s.id} className={`transition-colors ${isHighlighted ? 'bg-purple-50 dark:bg-purple-900/40 ring-2 ring-inset ring-purple-300 dark:ring-purple-600' : 'hover:bg-purple-50/10 dark:hover:bg-slate-800/60'}`}>
                                    <td className="py-3 px-2">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">{s.assessment_name}</div>
                                      {s.reviewer_comment ? (
                                        <div className="mt-1 max-w-[18rem] rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/70 px-3 py-2 text-[11px] leading-4 text-purple-700 shadow-sm">
                                          <span className="font-semibold uppercase tracking-wide">Psychologist note:</span>{' '}
                                          <span className="break-words whitespace-pre-wrap">{s.reviewer_comment}</span>
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="py-3 px-2 text-xs text-slate-600 dark:text-slate-300 transition-colors">
                                      <div>{capitalizeName(s.submitted_by) || 'Psychometrician'}</div>
                                      <div className="text-[10px] text-purple-600 dark:text-purple-400 transition-colors font-medium">{fmtDate(s.date)}</div>
                                    </td>
                                    <td className="py-3 px-2">
                                      {s.status === 'scored' ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                                          Approved
                                        </span>
                                      ) : s.status === 'revalidation' ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 animate-pulse border border-rose-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          Revalidation Required
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 animate-pulse border border-amber-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          Pending Approval
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <AnimatedActionBtn
                                          onClick={() => {
                                            setViewSub(s)
                                            setCommentText('')
                                            setSubmissionSignature(null)
                                            setCommentId(null)
                                            setSubmissionAction(null)
                                          }}
                                          title="View Form"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
                                        </AnimatedActionBtn>
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
                  </div>

                  {/* IEP Documents Panel */}
                  <div ref={(el) => { sectionRefs.current.iepDocs = el }} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider mb-2">
                        IEP Document
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors text-xs font-semibold tracking-wider text-purple-700 border-b border-purple-100 pb-2 text-left">
                              <th className="pb-3 px-2">Document Title</th>
                              <th className="pb-3 px-2">Submitter / Date</th>
                              <th className="pb-3 px-2">Status</th>
                              <th className="pb-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/40">
                            {iepReports.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                  No IEP documents recorded for this student.
                                </td>
                              </tr>
                            ) : (
                              iepReports.map((r) => {
                                  const meta = STATUS_META[r.status] || STATUS_META.draft
                                  const isHighlighted = String(highlightReport) === String(r.id)
                                  return (
                                    <tr key={`iep-${r.id}`} className={`transition-colors ${isHighlighted ? 'bg-purple-50 dark:bg-purple-900/40 ring-2 ring-inset ring-purple-300 dark:ring-purple-600' : 'hover:bg-purple-50/10'}`}>
                                      <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-100 transition-colors">
                                        <div>{r.title}</div>
                                        {r.period ? (
                                          <div className="mt-0.5 inline-block rounded-full bg-purple-50 px-2 py-px text-[10px] font-bold text-purple-700">
                                            {r.period}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="py-3 px-2 text-xs text-slate-600 dark:text-slate-300 transition-colors">
                                        <div>{capitalizeName(r.submitted_by) || 'Psychometrician'}</div>
                                        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">{fmtDate(r.date)}</div>
                                      </td>
                                      <td className="py-3 px-2">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                                          {meta.label}
                                        </span>
                                      </td>
                                      <td className="py-3 px-2 text-right">
                                        <AnimatedActionBtn
                                          onClick={() => {
                                            setActiveReport(r)
                                            setIepComment(clampComment(r.reviewer_comment || ''))
                                            setIepSignature(r.status === 'ready_for_review' ? null : r.reviewer_signature_image || null)
                                            setOpenForm('viewIep')
                                          }}
                                          title="View Form"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
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

                  {/* Behavioral Reports Ledger Panel */}
                  <div ref={(el) => { sectionRefs.current.behavioralReports = el }} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm flex max-h-[34rem] flex-col">
                    <div className="flex min-h-0 flex-1 flex-col space-y-4">
                      <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider mb-2">
                        Behavioral Assessment Report
                      </h3>
                      <div className="min-h-0 flex-1 overflow-auto pr-1">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="sticky top-0 bg-white dark:bg-slate-900 transition-colors text-xs font-semibold tracking-wider text-purple-700 border-b border-purple-100 pb-2 text-left">
                              <th className="pb-3 px-2">Report Title</th>
                              <th className="pb-3 px-2">Last Updated Date</th>
                              <th className="pb-3 px-2">Status</th>
                              <th className="pb-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/40">
                            {behavioralReports.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                  No clinical reports drafted or pending for this student.
                                </td>
                              </tr>
                            ) : (
                              behavioralReports.map((r) => {
                                const meta = STATUS_META[r.status] || STATUS_META.draft
                                const isHighlighted = String(highlightReport) === String(r.id)
                                return (
                                  <tr key={`${r.report_type || 'behavioral'}-${r.id}`} className={`transition-colors ${isHighlighted ? 'bg-purple-50 dark:bg-purple-900/40 ring-2 ring-inset ring-purple-300 dark:ring-purple-600' : 'hover:bg-purple-50/10'}`}>
                                    <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-100 transition-colors">
                                      <div>{r.title}</div>
                                    </td>
                                    <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">{fmtDate(r.date)}</td>
                                    <td className="py-3 px-2">
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                                        {meta.label}
                                      </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <AnimatedActionBtn
                                          onClick={() => {
                                            setActiveReport(r)
                                            if (r.report_type === 'progress_summary') {
                                              setMonthlyComment(clampComment(r.reviewer_comment || ''))
                                              setMonthlySignature(
                                                r.status === 'ready_for_review'
                                                  ? null
                                                  : r.reviewer_signature_image || null,
                                              )
                                              setOpenForm('viewProgress')
                                            } else if (r.report_type === 'iep') {
                                              setIepComment(clampComment(r.reviewer_comment || ''))
                                              setIepSignature(r.status === 'ready_for_review' ? null : r.reviewer_signature_image || null)
                                              setOpenForm('viewIep')
                                            } else {
                                              setBehavioralComment(clampComment(r.reviewer_comment || ''))
                                              setBehavioralSignature(r.status === 'ready_for_review' ? null : r.reviewer_signature_image || null)
                                              setOpenForm('viewBehavioral')
                                            }
                                          }}
                                          title="View Form"
                                          variant="view"
                                          className="whitespace-nowrap"
                                        >
                                          View Form
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
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm flex flex-col items-center justify-center h-full">
                  <svg className="h-16 w-16 text-purple-200 dark:text-purple-900/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0 2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                  </svg>
                  <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Please select a student from the directory to configure clinical approvals.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default Approvals;
