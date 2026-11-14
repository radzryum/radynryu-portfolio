import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import { shortBranchName } from '../../../lib/branches'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import { api } from '../../../lib/api'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import Skeleton from '../../../components/ui/Skeleton'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import ComplianceAnswerForm from './ComplianceAnswerForm'

const EXPECTED_FORMS = [
  { code: 'CMPS:SE-FO-01', title: 'Student Admission Form' },
  { code: 'CMPS:SE-FO-02', title: 'SPED Consent and Waiver' },
]

const STATUS_LABEL = {
  overdue: 'OVERDUE',
  pending_signature: 'PENDING SIG.',
  submitted: 'SUBMITTED',
  approved: 'APPROVED',
  returned: 'RETURNED',
  not_started: 'NOT STARTED',
}

const statusTone = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
  if (status === 'submitted') return 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800'
  if (status === 'returned') return 'bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800'
  if (status === 'overdue') return 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'
  if (status === 'pending_signature') return 'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
  if (status === 'not_started') return 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
}

function getStudentForms(student) {
  if (!student) return []
  return EXPECTED_FORMS.map((f) => {
    const existing = (student.waivers || []).find((w) => w.code === f.code)
    if (existing) return { ...existing, patientUuid: student.patientUuid, treating_psychometrician_name: student.treating_psychometrician_name }
    if (f.code === 'CMPS:SE-FO-01' && student.admission_form_status === 'complete') {
      return {
        id: `admission_${student.key}`,
        student: student.name,
        sid: student.sid,
        patientUuid: student.patientUuid,
        parent: student.parent,
        email: student.email,
        doc: f.title,
        code: f.code,
        status: 'approved',
        label: STATUS_LABEL.approved,
        provisions_agreed: null,
        signature_text: null,
        signed_at: null,
        treating_psychometrician_name: student.treating_psychometrician_name,
      }
    }
    return {
      id: `mock_${student.key}_${f.code}`,
      student: student.name,
      sid: student.sid,
      patientUuid: student.patientUuid,
      parent: student.parent,
      email: student.email,
      doc: f.title,
      code: f.code,
      status: 'not_started',
      label: STATUS_LABEL.not_started,
      provisions_agreed: null,
      signature_text: null,
      signed_at: null,
      treating_psychometrician_name: student.treating_psychometrician_name,
    }
  })
}

function Compliance() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [patientsData, setPatientsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')
  const honoredDeepLink = useRef(null)
  const itemRefs = useRef({})
  const [selectedStudentUuid, setSelectedStudentUuid] = useState(urlPatientId || '')
  const [pdfPreview, setPdfPreview] = useState(null)
  const [answerWaiver, setAnswerWaiver] = useState(null)
  const [answerSaving, setAnswerSaving] = useState(false)
  const [returnDialog, setReturnDialog] = useState(null)
  const [returnComment, setReturnComment] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const answerFormRef = useRef(null)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])

  const load = (branch = branchFilter) =>
    Promise.all([api.admin.compliance(branch), api.admin.patients(false, branch)])
      .then(([complianceData, patients]) => {
        setData(complianceData)
        setPatientsData(patients)
      })
      .catch((e) => {
        toast.error(e.message)
      })

  // Live-refresh the directory when waivers are signed or students change.
  // waiver_submissions carries no clinic_id, so it rides unfiltered (RLS
  // still gates every event).
  const complianceScope = branchFilter || profile?.clinic_id || ''
  const complianceSubs = complianceScope
    ? [
      { table: 'waiver_submissions' },
      { table: 'patients', filter: `clinic_id=eq.${complianceScope}` },
    ]
    : (isSuperAdmin ? [{ table: 'waiver_submissions' }, { table: 'patients' }] : [])
  useRealtimeRefresh(profile?.id, complianceSubs, () => {
    load()
  })

  useEffect(() => {
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter])

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((d) => setBranchOptions(d?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAnswer = (row) => {
    if (!row || row.status === 'approved') return
    setAnswerWaiver(row)
  }

  const canPreviewOfficialPdf = (row) => {
    if (!row) return false
    if (row.code === 'CMPS:SE-FO-01') return Boolean(row.patientUuid)
    return Boolean(row.id && !String(row.id).startsWith('mock_'))
  }

  const previewOfficialPdf = (row) => {
    if (!canPreviewOfficialPdf(row)) {
      toast.error('Save the compliance form first so the official PDF can load its database record.')
      return
    }
    const isAdmission = row.code === 'CMPS:SE-FO-01'
    setPdfPreview({
      title: `${row.doc || 'Official CMPS Form'} · ${row.student || 'Student'}`,
      filename: `${row.sid || 'student'}-${row.code || 'CMPS-form'}.pdf`,
      loadPdf: isAdmission
        ? () => api.admin.downloadPatientPdf(row.patientUuid)
        : () => api.admin.downloadDocumentPdf('waiver_submissions', row.id),
      loadCtcPdf: isAdmission
        ? () => api.admin.downloadPatientCtcPdf(row.patientUuid)
        : () => api.admin.downloadDocumentCtcPdf('waiver_submissions', row.id),
    })
  }

  const saveAnswer = async (payload) => {
    if (!answerWaiver) return
    setAnswerSaving(true)
    try {
      await api.admin.saveCompliance(answerWaiver.patientUuid, answerWaiver.code, payload)
      toast.success('Compliance form completed and saved.')
      setAnswerWaiver(null)
      await load()
      window.dispatchEvent(new Event('cymon-badge-update'))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAnswerSaving(false)
    }
  }

  const openReturnDialog = (row) => {
    setReturnDialog(row)
    setReturnComment('')
  }

  const submitReturn = async () => {
    if (!returnDialog) return
    if (!returnComment.trim()) {
      toast.error('Please write a comment explaining what needs to change.')
      return
    }
    setReturnSaving(true)
    try {
      await api.admin.returnCompliance(returnDialog.id, returnComment.trim())
      toast.success('Form returned to the client for revision.')
      setReturnDialog(null)
      setReturnComment('')
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReturnSaving(false)
    }
  }

  const rows = (data?.rows || []).map((r) => ({
    ...r,
    label: STATUS_LABEL[r.status] || r.status,
  }))
  const patients = patientsData?.patients || []

  const studentMap = {}
  rows.forEach((r) => {
    const key = r.patient_id
    if (!studentMap[key]) {
      studentMap[key] = {
        key,
        patientUuid: r.patient_id,
        sid: r.sid,
        name: r.student,
        parent: r.parent,
        email: r.email,
        clinic_name: r.clinic_name || null,
        created_at: r.created_at || r.submitted_at || null,
        waivers: [],
      }
    }
    const prev = studentMap[key].created_at ? new Date(studentMap[key].created_at).getTime() : 0
    const cur = r.created_at || r.submitted_at ? new Date(r.created_at || r.submitted_at).getTime() : 0
    if (cur > prev) studentMap[key].created_at = r.created_at || r.submitted_at
    studentMap[key].waivers.push(r)
  })

  patients.forEach((p) => {
    const key = p.id
    if (!key) return
    if (studentMap[key]) {
      studentMap[key].sid = p.patient_id || studentMap[key].sid || '—'
      studentMap[key].patientUuid = p.id
      // Carry the name parts so the directory can render "Last, First M."
      // from structured fields instead of parsing the composed string.
      studentMap[key].first_name = p.first_name || studentMap[key].first_name || ''
      studentMap[key].middle_name = p.middle_name || studentMap[key].middle_name || ''
      studentMap[key].last_name = p.last_name || studentMap[key].last_name || ''
      studentMap[key].admission_form_status = p.admission_form_status || null
      studentMap[key].treating_psychometrician_name = p.treating_psychometrician_name || null
      studentMap[key].photo_url = p.photo_url || null
      studentMap[key].clinic_name = studentMap[key].clinic_name || p.clinic_name || null
      // Prefer the patient registration date for ordering (newest first).
      if (p.created_at) {
        const prev = studentMap[key].created_at ? new Date(studentMap[key].created_at).getTime() : 0
        if (new Date(p.created_at).getTime() > prev) studentMap[key].created_at = p.created_at
      }
      return
    }
    studentMap[key] = {
      key,
      patientUuid: p.id,
      sid: p.patient_id || '—',
      name: p.name,
      first_name: p.first_name || '',
      middle_name: p.middle_name || '',
      last_name: p.last_name || '',
      parent: '—',
      email: null,
      admission_form_status: p.admission_form_status || null,
      treating_psychometrician_name: p.treating_psychometrician_name || null,
      photo_url: p.photo_url || null,
      clinic_name: p.clinic_name || null,
      created_at: p.created_at || null,
      waivers: [],
    }
  })

  // Directory order is always A–Z by "LAST, FIRST M." (never backend order).
  const studentsList = Object.values(studentMap).sort(compareStudentsAZ)
  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const filteredStudents = pinStudentFirst(studentsList.filter((s) => {
    // Match against both "First M. Last" and "Last, First M." so either
    // typing order finds the student.
    const nameHaystack = `${s.name || ''} ${formatLastFirstMI(s)}`.toLowerCase().replace(/,/g, ' ')
    return (
      !q ||
      nameHaystack.includes(q) ||
      (s.parent || '').toLowerCase().includes(q) ||
      (s.sid || '').toLowerCase().includes(q)
    )
  }), urlPatientId, 'key')

  useEffect(() => {
    if (loading || filteredStudents.length === 0) {
      if (!loading && filteredStudents.length === 0) setSelectedStudentUuid('')
      return
    }
    // Notification deep links (?patientId=) take priority the first time they
    // appear — afterwards the user is free to pick another student without
    // snapping back.
    if (urlPatientId && honoredDeepLink.current !== urlPatientId && filteredStudents.some((s) => String(s.key) === String(urlPatientId))) {
      honoredDeepLink.current = urlPatientId
      if (String(selectedStudentUuid) !== String(urlPatientId)) setSelectedStudentUuid(urlPatientId)
      return
    }
    const alreadySelected = filteredStudents.some((s) => s.key === selectedStudentUuid)
    if (!alreadySelected) setSelectedStudentUuid(filteredStudents[0].key)
  }, [loading, filteredStudents, selectedStudentUuid, urlPatientId])

  // Notification deep links land on the right student, but the directory is
  // scrollable — the highlight can sit below the fold (user must scroll to
  // find it). Bring the target into view so the highlight is visible agad.
  // Scoped to the deep-linked student only, so manual browsing never jumps.
  useEffect(() => {
    if (loading || !urlPatientId) return
    if (String(selectedStudentUuid) !== String(urlPatientId)) return
    const el = itemRefs.current[selectedStudentUuid]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [loading, urlPatientId, selectedStudentUuid, filteredStudents.length])

  const selectedStudent = studentMap[selectedStudentUuid]

  const selectedStudentWaivers = useMemo(() => {
    return getStudentForms(selectedStudent)
  }, [selectedStudent])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <StaffHeader title="Compliance &amp; Waivers" />
      <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto lg:overflow-hidden flex flex-col" data-onboarding-key="compliance-workspace">
        <div className="max-w-7xl w-full mx-auto min-h-full lg:min-h-0 lg:flex-1 flex flex-col overflow-hidden space-y-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Compliance &amp; Waiver Tracking</h1>
            <PageSubtitle>
              Monitor student registration forms, parent consent waivers, and signature status.
            </PageSubtitle>
          </div>

          <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v)
                  setSelectedStudentUuid('')
                }}
                placeholder="Search students"
                className="flex-1"
              />
              {isSuperAdmin && branchOptions.length > 1 ? (
                <AnimatedSelect
                  value={branchFilter || 'all'}
                  onChange={(val) => {
                    setBranchFilter(val === 'all' ? '' : val)
                    setSelectedStudentUuid('')
                  }}
                  options={[
                    { value: 'all', label: 'All Branches' },
                    ...branchOptions.map((b) => ({ value: b.id, label: shortBranchName(b) })),
                  ]}
                />
              ) : null}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 flex-1 overflow-hidden min-h-0">
            <div className="rounded-2xl bg-white dark:bg-slate-900 transition-colors border border-purple-200 dark:border-slate-700 transition-colors p-5 shadow-sm h-full flex flex-col overflow-hidden lg:sticky lg:top-0" data-onboarding-key="compliance-directory">
              <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors border-b border-purple-100 pb-3 shrink-0">
                Student Directory
              </h2>
              <div key={loading ? 'loading' : 'loaded'} className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 px-1.5 -mx-1.5 space-y-2 p-2 -m-2 animate-content-fade-in">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" rounded="rounded-xl" />
                  ))
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">No students found.</div>
                ) : (
                  filteredStudents.map((s) => {
                    const isSelected = selectedStudentUuid === s.key
                    const sForms = getStudentForms(s)
                    const notStartedCount = sForms.filter((f) => f.status === 'not_started').length
                    const approvedCount = sForms.filter((f) => f.status === 'approved').length
                    const hasOverdue = sForms.some((w) => w.status === 'overdue')
                    const hasPendingSig = sForms.some((w) => w.status === 'pending_signature')
                    return (
                      <button
                        key={s.key}
                        ref={(el) => {
                          if (el) itemRefs.current[s.key] = el
                          else delete itemRefs.current[s.key]
                        }}
                        onClick={() => setSelectedStudentUuid(s.key)}
                        className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group scroll-mt-2 scroll-mb-2 ${isSelected ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-md scale-[1.02]' : 'border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {s.photo_url || s.patients?.photo_url ? (
                            <img src={s.photo_url || s.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ isSelected ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <div
                              className={`font-semibold text-sm flex items-center gap-1.5 ${isSelected ? 'text-purple-950 dark:text-purple-100' : 'text-slate-800 dark:text-slate-100 transition-colors'
                                }`}
                            >
                              <span>{formatLastFirstMI(s) || s.name}</span>
                              {hasOverdue ? (
                                <span className="h-2 w-2 rounded-full bg-rose-500" title="Has Overdue Waivers" />
                              ) : hasPendingSig ? (
                                <span className="h-2 w-2 rounded-full bg-amber-500" title="Has Pending Signatures" />
                              ) : notStartedCount > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-slate-300" title={`${notStartedCount} Forms Not Started`} />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-emerald-500" title={`All ${EXPECTED_FORMS.length} Forms Complete`} />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between gap-1">
                              <span>ID: {s.sid}</span>{notStartedCount > 0 ? (
                              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 transition-colors">
                                {notStartedCount} Not Started
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {approvedCount}/{EXPECTED_FORMS.length} Done
                              </span>
                            )}
                          </div>
                            {isSuperAdmin && s.clinic_name ? (
                              <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                {shortBranchName(s.clinic_name)}
                              </div>
                            ) : null}
                        </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div key={selectedStudentUuid || 'empty'} className="student-directory-panel lg:col-span-2 flex flex-col h-full overflow-hidden lg:overscroll-contain">
              {selectedStudent ? (
                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">{selectedStudent.name}</h1>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 dark:border-slate-700 transition-colors px-3 py-1.5 text-xs font-semibold text-purple-700">
                          Student ID: {selectedStudent.sid}
                        </span>
                        {(() => {
                          const sForms = selectedStudentWaivers
                          const approvedCount = sForms.filter((f) => f.status === 'approved').length
                          const notStartedCount = sForms.filter((f) => f.status === 'not_started').length
                          const overdueCount = sForms.filter((f) => f.status === 'overdue').length
                          const pendingSigCount = sForms.filter((f) => f.status === 'pending_signature').length
                          return (
                            <>
                              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                {approvedCount}/{EXPECTED_FORMS.length} Completed
                              </span>
                              {notStartedCount > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 dark:border-slate-800 transition-colors px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
                                  {notStartedCount} Not Started
                                </span>
                              ) : null}
                              {overdueCount > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">
                                  {overdueCount} Overdue
                                </span>
                              ) : null}
                              {pendingSigCount > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                  {pendingSigCount} Pending Signature
                                </span>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">

                    <div className="overflow-x-auto pb-4">
                      <table className="w-full table-auto text-sm">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors">
                          <tr className="border-b border-purple-100 text-left text-xs font-semibold tracking-wider text-purple-700">
                            <th className="pb-3 px-2">Document Title</th>
                            <th className="w-[140px] pb-3 px-2">Form Code</th>
                            <th className="w-[160px] pb-3 px-2">Status</th>
                            <th className="pb-3 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/40">
                          {selectedStudentWaivers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                No waivers tracked for this student.
                              </td>
                            </tr>
                          ) : (
                            selectedStudentWaivers.map((w) => {
                              const rowKey = w.id || `${selectedStudentUuid || selectedStudent?.patientUuid || 'student'}:${w.code}`
                              return (
                                <tr key={rowKey} className="transition-colors hover:bg-purple-50/20">
                                  <td className="px-2 py-3.5 font-medium text-slate-800 dark:text-slate-100 transition-colors">{w.doc}</td>
                                  <td className="px-2 py-3.5 text-xs text-slate-500 dark:text-slate-400 transition-colors">{w.code}</td>
                                  <td className="px-2 py-3.5">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(
                                        w.status
                                      )}`}
                                    >
                                      {w.label}
                                    </span>
                                  </td>
                                  <td className="px-2 py-3.5 text-right whitespace-nowrap">
                                    {w.status === 'returned' && w.review_comment ? (
                                      <span
                                        className="ml-auto mb-2 flex w-fit max-w-[260px] items-center gap-1 truncate rounded-full bg-violet-50 border border-violet-200 dark:bg-violet-900/30 dark:border-violet-800 transition-colors px-2.5 py-1 text-[10px] font-medium text-violet-700 dark:text-violet-300 transition-colors"
                                        title={w.review_comment}
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                        <span className="truncate">{w.review_comment}</span>
                                      </span>
                                    ) : null}
                                    {/* Right-aligned row of only the buttons that exist:
                                        Preview always hugs the right edge, so it lines up
                                        across rows without empty placeholder gaps. */}
                                    <div className="flex items-center justify-end gap-2">
                                      {w.status === 'submitted' ? (
                                        <Button
                                          onClick={() => openReturnDialog(w)}
                                          variant="secondary"
                                          size="sm"
                                          className="min-w-[118px] !h-[32px] !rounded-[40px] px-3 text-xs shadow-sm transition-colors"
                                        >
                                          Return to Client
                                        </Button>
                                      ) : null}
                                      {w.status !== 'approved' ? (
                                        <Button
                                          onClick={() => openAnswer(w)}
                                          variant="secondary"
                                          size="sm"
                                          className="min-w-[118px] !h-[32px] !rounded-[40px] px-3 text-xs shadow-sm transition-colors"
                                        >
                                          Complete Form
                                        </Button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => previewOfficialPdf(w)}
                                        disabled={!canPreviewOfficialPdf(w)}
                                        className={`cymon-preview-btn ${!canPreviewOfficialPdf(w) ? 'disabled' : ''}`}
                                        title={!canPreviewOfficialPdf(w) ? 'Save the form before previewing the official PDF.' : 'Preview the official PDF'}
                                      >
                                        <span className="IconContainer">
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <line x1="10" y1="9" x2="8" y2="9"></line>
                                          </svg>
                                        </span>
                                        <span className="text">Preview</span>
                                      </button>
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
              ) : (
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm flex flex-col items-center justify-center h-full">
                  <svg className="h-16 w-16 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
                    />
                  </svg>
                  <p className="mt-4 text-sm font-medium">
                    Please select a student from the directory to track compliance forms.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
      {answerWaiver ? (
        <Modal
          title="Complete Compliance Form"
          subtitle={`${answerWaiver.doc} · ${answerWaiver.sid}`}
          onClose={() => setAnswerWaiver(null)}
          maxWidth="max-w-6xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAnswerWaiver(null)} disabled={answerSaving}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => answerFormRef.current?.save()} disabled={answerSaving}>
                {answerSaving ? 'Saving…' : 'Complete Form'}
              </Button>
            </div>
          }
        >
          <ComplianceAnswerForm
            ref={answerFormRef}
            row={answerWaiver}
            onSubmit={saveAnswer}
          />
        </Modal>
      ) : null}
      {returnDialog ? (
        <Modal
          title="Return Form to Client"
          subtitle={`${returnDialog.doc} · ${returnDialog.sid}`}
          onClose={() => setReturnDialog(null)}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setReturnDialog(null)} disabled={returnSaving}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={submitReturn} disabled={returnSaving}>
                {returnSaving ? 'Returning…' : 'Return to Client'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300 transition-colors">
              This returns the client's submitted form so they can make changes. Write a comment explaining what needs to be corrected.
            </p>
            <label className="block text-xs font-semibold text-purple-800 dark:text-purple-300 transition-colors" htmlFor="return-comment">
              Comment for the client
            </label>
            <textarea
              id="return-comment"
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              rows={4}
              placeholder="e.g. The parent contact number is missing. Please complete it and re-submit."
              className="w-full rounded-xl border border-purple-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition-colors px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

export default Compliance
