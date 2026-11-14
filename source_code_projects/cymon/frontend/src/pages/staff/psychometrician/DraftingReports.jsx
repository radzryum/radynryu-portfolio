import { useEffect, useState } from 'react'
import StaffHeader from '../StaffHeader'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedActionBtn from '../../../components/ui/AnimatedActionBtn'
import Pagination from '../../../components/ui/Pagination'
import RowAction from '../../../components/ui/RowAction'
import BehavioralAssessmentForm from './BehavioralAssessmentForm'
import ProgressSummaryReportForm from '../psychologist/ProgressSummaryReportForm'

const PAGE_SIZE = 20

const STATUS_META = {
  draft: { label: 'DRAFT', tone: 'bg-amber-100 text-amber-700' },
  submitted: { label: 'SUBMITTED', tone: 'bg-sky-100 text-sky-700' },
  approved: { label: 'APPROVED', tone: 'bg-emerald-100 text-emerald-700' },
  revise_requested: { label: 'RETURNED FOR REVISION', tone: 'bg-orange-100 text-orange-800' },
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

const Stat = ({ value, label, loading }) => (
  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
    {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{value}</div>}
    <div className="text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors">{label}</div>
  </div>
)

function DraftingReports() {
  const { profile } = useAuth()
  // Drafts are the psychometrician's work-in-progress: the psychologist only
  // ever sees work actually submitted for review.
  const isPsychologist = profile?.role === 'psychologist'
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [activeReport, setActiveReport] = useState(null)

  const loadData = () => {
    setLoading(true)
    api.psychometrician
      .draftingReports()
      .then((d) => {
        setRows(d.rows)
        setSummary(d.summary)
        setPatients(d.patients || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  // Live-refresh drafts when reports or submissions change elsewhere (e.g.
  // psychologist review). Neither table has a clinic_id column — RLS
  // already limits delivery to own-clinic patients.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId ? [{ table: 'assessment_reports' }, { table: 'assessment_submissions' }] : [],
    loadData,
  )

  // Keep activeReport in sync with rows so that when loadData() finishes,
  // the form receives the freshly fetched content rather than stale local state.
  useEffect(() => {
    if (activeReport?.id && rows.length > 0) {
      const updated = rows.find(r => r.id === activeReport.id && r.type === activeReport.type)
      if (updated && updated.date !== activeReport.date) {
        setActiveReport(updated)
      }
    }
  }, [rows, activeReport?.id, activeReport?.type, activeReport?.date])

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const filteredPatients = patients.filter((p) => {
    const matchesSearch = !q || `${p.name || ''} ${formatLastFirstMI(p)}`.toLowerCase().replace(/,/g, ' ').includes(q)
    return matchesSearch
  }).sort(compareStudentsAZ)

  // Auto-select the first student from the filtered list if none is selected
  useEffect(() => {
    if (!loading && filteredPatients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(filteredPatients[0].id)
    }
  }, [loading, filteredPatients, selectedPatientId])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  const visibleRows = isPsychologist
    ? rows.filter((r) => !['draft', 'in_progress'].includes(r.status))
    : rows
  const patientReports = selectedPatient
    ? visibleRows.filter(
        (r) =>
          (String(r.patient_id) === String(selectedPatient.id) || r.name.toLowerCase() === selectedPatient.name.toLowerCase()) &&
          (statusFilter === 'all' || r.status === statusFilter)
      )
    : []
  const hasBehavioralReport = visibleRows.some(
    (report) => String(report.patient_id) === String(selectedPatient?.id),
  )
  const visibleDraftCount = visibleRows.filter((r) => r.status === 'draft').length

  const isAdmissionApproved = selectedPatient?.admission_form_status === 'complete'
  const isConsentApproved = selectedPatient?.waiver_submissions?.some(
    (s) => s.document_type_code === 'CMPS:SE-FO-02' && s.status === 'approved'
  )
  const hasCompletedRequirements = isAdmissionApproved && isConsentApproved

  return (
    <>
      <StaffHeader title="Behavioral Reports" />
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4 sm:p-6 lg:p-7">
        <div className="mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-purple-100 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Behavioral Assessment Reports</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-1">
                {isPsychologist
                  ? 'Review submitted clinical behavioral assessment reports (CMPS:SE-FO-06) for SPED students.'
                  : 'Draft, review, and complete clinical behavioral assessment reports (CMPS:SE-FO-06) for SPED students.'}
              </p>
            </div>
            {selectedPatient && !isPsychologist && !hasBehavioralReport && (
              <div title={!hasCompletedRequirements ? 'Admission and Consent waivers must be approved first.' : ''}>
                <AnimatedActionBtn
                  onClick={() => setOpenForm('behavioral')}
                  disabled={!hasCompletedRequirements}
                  className={!hasCompletedRequirements ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Write Behavioral Assessment Report
                </AnimatedActionBtn>
              </div>
            )}
          </div>

          {/* Stats Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat value={isPsychologist ? visibleDraftCount : summary?.draft ?? '—'} label="Draft" loading={loading} />
            <Stat value={summary?.submitted ?? '—'} label="Submitted" loading={loading} />
            <Stat value={summary?.approved ?? '—'} label="Approved" loading={loading} />
          </div>

          {/* Main Layout Grid */}
          <div className="grid min-h-0 lg:flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Panel: Student Directory */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 transition-colors border border-purple-200 dark:border-slate-700 transition-colors p-5 shadow-sm min-h-[34rem] flex min-h-0 flex-col lg:h-full lg:sticky lg:top-0">
              <div className="border-b border-purple-100 pb-3 shrink-0">
                <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">Student Directory</h2>
                <div className="mt-3">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Search students…"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 px-1.5 -mx-1.5 space-y-2 p-2 -m-2">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 w-full animate-pulse bg-slate-100 rounded-xl" />
                  ))
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">No students found.</div>
                ) : (
                  filteredPatients.map((p) => {
                    const isSelected = selectedPatientId === p.id
                    const studentReports = visibleRows.filter((r) => String(r.patient_id) === String(p.id))
                    const draftsCount = studentReports.filter((r) => r.status === 'draft').length
                    const isPendingSign = studentReports.filter((r) => r.status === 'submitted').length > 0

                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group ${
                          isSelected ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-sm scale-[1.02] transform' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {p.photo_url || p.patients?.photo_url ? (
                            <img src={p.photo_url || p.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ isSelected ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                          <div className={`font-semibold text-sm flex items-center gap-1.5 ${
                            isSelected ? 'text-purple-950 dark:text-purple-100' : 'text-slate-800 dark:text-slate-100 transition-colors'
                          }`}>
                            <span>{formatLastFirstMI(p) || p.name}</span>
                            {isPendingSign && (
                              <span className="h-2 w-2 rounded-full bg-amber-500" title="Pending Psychologist review" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>Reports: {studentReports.length}</span>
                            {draftsCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                {draftsCount} Draft
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

            {/* Right Panel: Student Reports Checklist */}
            <div key={selectedPatientId || 'empty'} className="student-directory-panel lg:col-span-2 min-h-0 lg:overflow-y-auto lg:overscroll-contain space-y-6 p-2 -m-2">
              {selectedPatient ? (
                <>
                  {/* Selected Student details */}
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">{selectedPatient.name}</h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-1">
                          {isPsychologist
                            ? 'View submitted and finalized behavioral assessment reports for this student.'
                            : 'View drafts and finalized behavioral assessment reports for this student.'}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="h-9 rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 text-xs font-semibold text-purple-700 focus:outline-none cursor-pointer"
                        >
                          <option value="all">All Statuses</option>
                          {!isPsychologist && <option value="draft">Draft</option>}
                           <option value="revise_requested">Returned for Revision</option>
                           <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Reports list */}
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm min-h-[400px]">
                    <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider mb-4">
                      Behavioral Assessment Report
                    </h3>
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
                              <td colSpan={4} className="py-12 text-center text-xs text-slate-400">
                                No behavioral assessment reports found matching this criteria.
                              </td>
                            </tr>
                          ) : (
                            patientReports.map((r) => {
                              const meta = STATUS_META[r.status] || STATUS_META.draft
                              return (
                                <tr key={`${r.type}-${r.id}`} className="hover:bg-purple-50/10 transition-colors">
                                  <td className="py-3.5 px-2 font-medium text-slate-800 dark:text-slate-100 transition-colors">
                                    <div>{r.title}</div>
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
                                  <td className="py-3.5 px-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">{fmtDate(r.date)}</td>
                                  <td className="py-3.5 px-2">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                                      {meta.label}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-2 text-right">
                                    <AnimatedActionBtn
                                      onClick={() => {
                                        setActiveReport(r)
                                        setOpenForm('viewBehavioral')
                                      }}
                                      title="View Form"
                                      variant="view"
                                      className="whitespace-nowrap"
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
                </>
              ) : (
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm flex flex-col items-center justify-center">
                  <svg className="h-16 w-16 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
                    />
                  </svg>
                  <p className="mt-4 text-sm font-medium">Please select a student from the directory to track report drafts.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {openForm === 'behavioral' ? (
        <BehavioralAssessmentForm
          patient={selectedPatient}
          onClose={() => setOpenForm(null)}
          onSaved={loadData}
        />
      ) : null}
      {openForm === 'viewBehavioral' && activeReport ? (
        <BehavioralAssessmentForm
          patient={selectedPatient}
          detail={activeReport}
          readOnly={
            !['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(activeReport.status)
          }
          onSaved={loadData}
          onClose={() => {
            setOpenForm(null)
            loadData()
          }}
        />
      ) : null}
    </>
  )
}

export default DraftingReports
