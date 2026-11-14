import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Download, FileSpreadsheet, FileText, Files, Users } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import { api, saveBlob } from '../../../lib/api'

const todayStamp = () => new Date().toISOString().slice(0, 10)

const FORMATS = [
  { value: 'csv', label: 'CSV (Excel-ready)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'json', label: 'JSON' },
]

function ExportCard({ icon: Icon, title, desc, meta, action }) {
  return (
    <section className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
          <Icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
          {meta ? <p className="mt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">{meta}</p> : null}
        </div>
      </div>
      <div className="mt-4">{action}</div>
    </section>
  )
}

function FormatDownload({ onDownload, busy, fileBase }) {
  const [format, setFormat] = useState('csv')
  return (
    <div className="flex flex-col gap-2 min-[480px]:flex-row">
      <select
        aria-label="Export format"
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        className="h-10 flex-1 rounded-xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
      >
        {FORMATS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDownload(format, `${fileBase}-${todayStamp()}.${format}`)}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-60 active:scale-[0.98] transition-colors"
      >
        <Download size={14} /> {busy ? 'Preparing…' : 'Download'}
      </button>
    </div>
  )
}

function DataExport() {
  const [busyKey, setBusyKey] = useState('')

  const runDownload = async (key, downloadFn, filename) => {
    if (busyKey) return
    setBusyKey(key)
    try {
      const blob = await downloadFn()
      await saveBlob(blob, filename)
      toast.success(`${filename} downloaded.`)
    } catch (err) {
      toast.error(err.message || 'Download failed. Please try again.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <>
      <StaffHeader title="Data Export" />
      <div className="flex-1 overflow-y-auto p-4 min-[360px]:p-4 sm:p-6" data-onboarding-key="admin-data-export">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 sm:text-2xl">Clinic Backup Downloads</h1>
          <PageSubtitle>
            One-click copies of student records, staff accounts, and finalized documents for safekeeping.
            Super Admins export all branches; regular admins export their own branch. Every download is recorded in the Audit Trail.
          </PageSubtitle>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ExportCard
              icon={Users}
              title="Students"
              desc="Every student record including archived ones: IDs, names, birthdate, admission and consent status, program, assigned clinicians, and primary guardian."
              meta="Includes archived records"
              action={(
                <FormatDownload
                  busy={busyKey === 'students'}
                  fileBase="cymon-students"
                  onDownload={(format, filename) => runDownload('students', () => api.admin.exportStudents(format), filename)}
                />
              )}
            />
            <ExportCard
              icon={FileText}
              title="Employees"
              desc="Every staff account including deactivated ones: roles, contact details, license numbers, and branch assignment. No passwords are stored or exported."
              meta="Includes deactivated accounts"
              action={(
                <FormatDownload
                  busy={busyKey === 'employees'}
                  fileBase="cymon-employees"
                  onDownload={(format, filename) => runDownload('employees', () => api.admin.exportEmployees(format), filename)}
                />
              )}
            />
            <ExportCard
              icon={FileSpreadsheet}
              title="Completed Documents (ledger)"
              desc="One row per finalized document — approved/finalized reports, scored assessments, approved activity logs — with student, form code, status, and dates."
              meta="Contents live in the PDF archive below"
              action={(
                <FormatDownload
                  busy={busyKey === 'documents'}
                  fileBase="cymon-documents"
                  onDownload={(format, filename) => runDownload('documents', () => api.admin.exportDocuments(format), filename)}
                />
              )}
            />
            <ExportCard
              icon={Files}
              title="Completed Documents (PDF archive)"
              desc="A ZIP of every finalized document rendered as an official PDF, plus a manifest.json index. Large archives may take a few minutes to prepare."
              meta="Same PDFs as single downloads, in one file"
              action={(
                <button
                  type="button"
                  disabled={!!busyKey}
                  onClick={() => runDownload('zip', () => api.admin.exportDocumentsZip(), `cymon-documents-${todayStamp()}.zip`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-60 active:scale-[0.98] transition-colors"
                >
                  <Download size={14} /> {busyKey === 'zip' ? 'Preparing ZIP…' : 'Download ZIP'}
                </button>
              )}
            />
          </div>

        </div>
      </div>
    </>
  )
}

export default DataExport
