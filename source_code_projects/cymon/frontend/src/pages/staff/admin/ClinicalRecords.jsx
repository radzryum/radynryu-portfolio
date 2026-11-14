import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import RowAction from '../../../components/ui/RowAction'
import Pagination from '../../../components/ui/Pagination'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import { shortBranchName } from '../../../lib/branches'
import { compareStudentsAZ } from '../../../lib/format'
import { api, saveBlob } from '../../../lib/api'
import { useAuth } from '../../../auth/useAuth'
import { toast } from 'react-hot-toast'
import { cycleInfoFor } from '../../../lib/iep'

const PAGE_SIZE = 20

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Distinguishing subtitle so same-type rows tell apart: IEPs show
// Initial Plan/Renewal + plan number, monthlies show their month, and
// daily reports show session number + activity date.
function detailSubtitle(row) {
  const d = row.details || {}
  if (row.sourceTable === 'session_logs') {
    const bits = []
    if (d.session_number != null) bits.push(`Session ${d.session_number}`)
    if (d.session_date) bits.push(fmtDate(d.session_date))
    if (d.activity_title) bits.push(d.activity_title)
    return bits.join(' · ') || null
  }
  if (row.sourceTable === 'assessment_reports') {
    const isMonthly = (d.report_type || '') === 'progress_summary'
    if (!isMonthly && /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(`${row.type || ''} ${d.title || ''}`)) {
      const info = cycleInfoFor(row.period ?? d.period, d.content)
      return `${info.kindLabel} · ${info.label}`
    }
    return row.period ?? d.period ?? null
  }
  return null
}

function DocumentViewer({ row, onClose }) {
  return (
    <OfficialPdfPreview
      title={`${row.type || 'Clinical document'} · ${row.name || 'Student'}`}
      filename={`${row.sid || 'student'}-${row.code || 'CMPS-form'}.pdf`}
      loadPdf={() => api.admin.downloadDocumentPdf(row.sourceTable, row.id)}
      loadCtcPdf={() => api.admin.downloadDocumentCtcPdf(row.sourceTable, row.id)}
      onClose={onClose}
    />
  )
}

function ClinicalRecords() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [active, setActive] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('student') || '')
  const highlightType = searchParams.get('highlight')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState(null)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])

  const handleDownload = async (r) => {
    if (downloadingId) return
    setDownloadingId(r.id)
    try {
      const blob = await api.admin.downloadDocumentPdf(r.sourceTable, r.id)
      saveBlob(blob, `${r.sid || 'student'}-${r.code || 'CMPS-form'}.pdf`)
    } catch (err) {
      toast.error(err.message || 'Download failed. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    let on = true
    setLoading(true)
    api.admin
      .documents(branchFilter)
      .then((d) => on && setRows(d.documents.map((x) => ({ ...x, date: fmtDate(x.finalized_at) }))))
      .catch(() => {})
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
    }
  }, [branchFilter])

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const types = [...new Set(rows.map((r) => r.type).filter(Boolean))]
  const q = query.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    const mq = !q || (r.name || '').toLowerCase().includes(q)
    const mt = typeFilter === 'all' || r.type === typeFilter
    return mq && mt
  }).sort(compareStudentsAZ)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <StaffHeader title="Clinical Records" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="clinical-records-workspace">
        <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Clinical Records</h1>
        <PageSubtitle>Finalized clinic document records</PageSubtitle>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <SearchBar
              value={query}
              onChange={(v) => {
                setQuery(v)
                setPage(1)
              }}
              placeholder="Search student name"
              className="flex-1"
            />
            <AnimatedSelect
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All Document Types' },
                ...types.map((t) => ({ value: t, label: t }))
              ]}
            />
            {isSuperAdmin && branchOptions.length > 1 ? (
              <AnimatedSelect
                value={branchFilter || 'all'}
                onChange={(val) => {
                  setBranchFilter(val === 'all' ? '' : val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...branchOptions.map((b) => ({ value: b.id, label: shortBranchName(b) })),
                ]}
              />
            ) : null}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 transition-colors">
                  <th className="px-4 py-3 text-left">Student Name</th>
                  <th className="px-4 py-3 text-left">Document Type</th>
                  <th className="px-4 py-3 text-left">Date Finalized</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody key={loading ? 'loading' : 'loaded'} className="divide-y divide-purple-100 animate-content-fade-in">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`s${i}`}>
                        <td colSpan={4} className="px-4 py-3">
                          <Skeleton className="h-11 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                      No documents match your search.
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  pageRows.map((r) => {
                    const isSelected = active && active.id === r.id
                    const isHighlighted = highlightType && r.type?.toLowerCase().includes(highlightType.toLowerCase())
                    const subtitle = detailSubtitle(r)
                    return (
                      <tr
                        key={r.id}
                        className={
                            isSelected
                              ? 'bg-purple-100/70 dark:bg-purple-900/40 font-medium transition-colors'
                              : isHighlighted
                              ? 'bg-amber-100/70 dark:bg-amber-900/40 font-medium transition-colors ring-2 ring-amber-300 dark:ring-amber-700 ring-inset'
                              : 'transition-colors hover:bg-purple-50/50 dark:hover:bg-slate-800/60'
                        }
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 transition-colors">
                          {r.name}
                          {isSuperAdmin && r.clinic_name ? (
                            <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {shortBranchName({ code: r.clinic_code, name: r.clinic_name })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 transition-colors">
                          <div>{r.type}</div>
                          {subtitle ? (
                            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 transition-colors">{subtitle}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 transition-colors">{r.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <RowAction variant="view" onClick={() => setActive(r)} data-onboarding-key="clinical-records-view">
                              View
                            </RowAction>
                            <RowAction
                              variant="download"
                              onClick={() => handleDownload(r)}
                              disabled={downloadingId === r.id}
                              data-onboarding-key="clinical-records-download"
                            >
                              {downloadingId === r.id ? 'Saving…' : 'Download'}
                            </RowAction>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </section>

        {active ? <DocumentViewer row={active} onClose={() => setActive(null)} /> : null}
      </div>
    </>
  )
}

export default ClinicalRecords
