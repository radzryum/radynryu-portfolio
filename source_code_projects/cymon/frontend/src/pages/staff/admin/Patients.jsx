import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import { api } from '../../../lib/api'
import { SkeletonTableRow } from '../../../components/ui/Skeleton'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import SearchBar from '../../../components/ui/SearchBar'
import RowAction from '../../../components/ui/RowAction'
import Pagination from '../../../components/ui/Pagination'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import StudentAdmissionForm, { StudentRegisteredSlipModal } from './StudentAdmissionForm'
import StudentAdmissionEditForm from './StudentAdmissionEditForm'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import DatePicker from '../../../components/ui/DatePicker'
import { shortBranchName } from '../../../lib/branches'
import { formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { passwordError } from '../../../lib/password'
import PasswordChecklist from '../../../components/ui/PasswordChecklist'

const PAGE_SIZE = 20

const tone = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 transition-colors',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 transition-colors',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors',
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

const Section = ({ title, hint, children }) => (
  <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
    <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">{title}</div>
    {hint ? <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{hint}</div> : null}
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  </section>
)

const Field = ({ label, value }) => {
  if (value == null || value === '') return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">{label}</div>
      <div className="font-medium text-purple-800 dark:text-purple-300 transition-colors">{value}</div>
    </div>
  )
}

const FORM_LABEL = { complete: 'Complete', pending: 'Pending', in_progress: 'In Progress' }

// IDs the user has already seen (previous visits). Anything not in here is a
// fresh update and gets pinned on top; once displayed it is saved, so the next
// refresh falls back to pure alphabetical order.
const STUDENT_SEEN_KEY = 'cymon_seen_student_uuids_v1'
const readSeenIds = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}
const hasSeenKey = (key) => {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}
const rememberIds = (key, ids) => {
  try {
    const merged = new Set([...JSON.parse(localStorage.getItem(key) || '[]'), ...ids])
    localStorage.setItem(key, JSON.stringify([...merged]))
  } catch {
    // Storage unavailable (private mode) — list still renders, just without memory.
  }
}

function toRow(p) {
  return {
    id: p.patient_id,
    uuid: p.id,
    name: p.name,
    first_name: p.first_name,
    middle_name: p.middle_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    rawSex: p.sex,
    rawStatus: p.status,
    age: p.age,
    sex: cap(p.sex),
    status: cap(p.status),
    tone: p.status === 'active' ? 'emerald' : p.status === 'inactive' ? 'slate' : 'amber',
    form: FORM_LABEL[p.admission_form_status] || p.admission_form_status,
    formTone: p.admission_form_status === 'complete' ? 'text-emerald-600' : 'text-amber-600',
    treating_psychologist_id: p.treating_psychologist_id,
    treating_psychometrician_id: p.treating_psychometrician_id,
    treating_psychologist_name: p.treating_psychologist_name || 'Unassigned',
    treating_psychometrician_name: p.treating_psychometrician_name || 'Unassigned',
    created_at: p.created_at,
    photo_url: p.photo_url,
    is_archived: !!p.is_archived,
    clinic_id: p.clinic_id || null,
    clinic_code: p.clinic_code || null,
    clinic_name: p.clinic_name || null,
  }
}

function EditPatientModal({ row, onClose, onSaved }) {
  const [f, setF] = useState({
    first_name: row.first_name || '',
    middle_name: row.middle_name || '',
    last_name: row.last_name || '',
    date_of_birth: row.date_of_birth || '',
    sex: row.rawSex || '',
    status: row.rawStatus || '',
    treating_psychologist_id: row.treating_psychologist_id || '',
    treating_psychometrician_id: row.treating_psychometrician_id || '',
  })
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    api.admin.employees()
      .then((data) => {
        setEmployees(data.employees || [])
      })
      .catch(() => { })
      .finally(() => setLoadingEmployees(false))
  }, [])

  const psychologists = employees.filter(e => e.role === 'psychologist' || (e.extra_roles || []).includes('psychologist'))
  const psychometricians = employees.filter(e => e.role === 'psychometrician' || (e.extra_roles || []).includes('psychometrician'))

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!f.first_name || !f.last_name) {
      setErr('First and last name are required.')
      return
    }
    setBusy(true)
    try {
      await api.admin.updatePatient(row.uuid, f)
      onSaved()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Edit Patient"
      subtitle={row.id}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors">
            Cancel
          </button>
          <Button type="submit" form="edit-patient-form" size="lg" disabled={busy}>
            {busy ? 'Saving' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form id="edit-patient-form" onSubmit={submit} className="space-y-5">
        <Section title="Child" hint="Student record">
          <Input label="First Name" tone="purple" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} />
          <Input label="Middle Name (optional)" tone="purple" value={f.middle_name} onChange={(e) => set('middle_name', e.target.value)} />
          <Input label="Last Name" tone="purple" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet dark:text-purple-400">Date of Birth</span>
            <DatePicker value={f.date_of_birth} onChange={(v) => set('date_of_birth', v)} max={new Date().toISOString().slice(0, 10)} ariaLabel="Date of birth" />
          </div>
          <Select label="Sex" value={f.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
          <Select label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Section>

        <Section title="Staff Assignments" hint="Assign clinical personnel responsible for this student">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-purple-800 dark:text-purple-400 transition-colors">Assigned Psychologist</span>
            <SearchableSelect
              value={f.treating_psychologist_id}
              onChange={(v) => set('treating_psychologist_id', v)}
              options={[
                { value: '', label: 'Unassigned' },
                ...psychologists.map((e) => ({ value: e.id, label: formatLastFirstMI(e) || e.display_name || e.email })),
              ]}
              placeholder="Unassigned"
              searchPlaceholder="Search psychologist..."
              disabled={loadingEmployees}
              ariaLabel="Assigned Psychologist"
            />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-purple-700 mb-1">Assigned Psychometrician (RPm)</div>
            <div className="rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-100/60 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 transition-colors">
              {loadingEmployees ? 'Loading' : (formatLastFirstMI(psychometricians.find((e) => e.id === f.treating_psychometrician_id)) || 'Not assigned')}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">RPm assignment is locked after creation.</div>
          </div>
        </Section>

        {err ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div> : null}
      </form>
    </Modal>
  )
}

function StudentDetailModal({ active, detail, onClose, onEdit, onPreviewPdf, onManageParentAccount, onDeleteClick, onArchiveClick, onStatusChange }) {
  const archived = !!active.is_archived
  const [changingStatus, setChangingStatus] = useState(false)
  const currentStatus = detail?.patient?.status || active.rawStatus || 'pending'
  const statusDot = currentStatus === 'active' ? 'bg-emerald-500' : currentStatus === 'inactive' ? 'bg-slate-400' : 'bg-amber-500'
  return (
    <Modal
      title="Student Details"
      subtitle={`ID: ${active.id}${archived ? ' · Archived' : ''}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex gap-2">
            {archived ? (
              <button
                onClick={() => onArchiveClick(active, 'restore')}
                className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 px-5 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
              >
                Restore Record
              </button>
            ) : (
              <button
                onClick={() => onArchiveClick(active, 'archive')}
                className="rounded-lg border border-amber-200 dark:border-amber-800/50 px-5 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
              >
                Archive Record
              </button>
            )}
            <button
              onClick={() => onDeleteClick(active)}
              className="rounded-lg border border-red-200 dark:border-red-800/50 px-5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
            >
              Delete Student
            </button>
          </div>
          <div className="flex gap-2">
            {detail?.patient?.caregiver_id && !archived ? (
              <button
                onClick={() => onManageParentAccount(detail.patient)}
                className="rounded-lg border border-purple-300 dark:border-purple-800/60 px-5 py-2.5 text-sm font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                Manage Student Account
              </button>
            ) : null}
            <button
              onClick={onPreviewPdf}
              disabled={!detail}
              className="rounded-lg border border-purple-300 dark:border-purple-800/60 px-5 py-2.5 text-sm font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              Preview PDF
            </button>
            {!archived ? (
              <button
                onClick={onEdit}
                className="rounded-lg bg-purple-700 dark:bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 dark:hover:bg-purple-700 transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-sm"
              >
                Edit Details
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      {detail?.patient?.photo_url ? (
        <div className="mb-6 flex justify-center sm:justify-start">
          <img src={detail.patient.photo_url} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-purple-100 shadow-sm" />
        </div>
      ) : null}

      {!archived ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-purple-100 dark:border-purple-800/30 bg-purple-50/40 dark:bg-purple-900/10 p-4 transition-colors">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-800/30 px-3 py-1 text-[11px] font-bold text-purple-900 dark:text-purple-200 transition-colors">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            {cap(currentStatus)}
          </span>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
            Change status
            <select
              value={currentStatus}
              disabled={changingStatus}
              onChange={async (e) => {
                setChangingStatus(true)
                try {
                  await onStatusChange?.(e.target.value)
                } finally {
                  setChangingStatus(false)
                }
              }}
              className="cursor-pointer rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-purple-800 dark:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 transition-colors"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {changingStatus ? (
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 transition-colors">Updating…</span>
          ) : null}
          <p className="w-full text-[11px] leading-snug text-slate-500 dark:text-slate-400 transition-colors">
            Active / Pending auto-sync with enrollment requirements; Inactive sticks until changed back.
          </p>
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="text-xs font-bold tracking-wider text-purple-700 border-b border-purple-100 dark:border-purple-800/30 pb-2 mb-4">PERSONAL INFORMATION</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm bg-purple-50/40 dark:bg-purple-900/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30">
            <Field label="Full Name" value={detail?.patient?.full_name || active.name} />
            <Field label="Age" value={detail?.patient?.age ?? active.age} />
            <Field label="Sex" value={cap(detail?.patient?.sex || active.rawSex)} />
            <Field label="Birthdate" value={detail?.patient?.date_of_birth} />
            <div className="col-span-2">
              <Field label="Place of Birth" value={detail?.patient?.place_of_birth} />
            </div>
            <Field label="Nickname" value={detail?.patient?.nick_name} />
            <Field label="Citizenship" value={detail?.patient?.citizenship} />
            <Field label="Religion" value={detail?.patient?.religion} />
            <Field label="Status" value={active.status} />
            <div className="col-span-2">
              <Field label="Present Address" value={detail?.patient?.home_address} />
            </div>
          </dl>
        </div>

        <div className="space-y-8">
          <div>
            <div className="text-xs font-bold tracking-wider text-purple-700 border-b border-purple-100 dark:border-purple-800/30 pb-2 mb-4">PARENT / GUARDIAN</div>
            <div className="bg-white dark:bg-slate-900 transition-colors p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
              {(detail?.guardians || []).length ? (
                <div className="space-y-4 text-sm">
                  {detail.guardians.map((g) => (
                    <div key={g.id}>
                      <div className="font-semibold text-purple-900">
                        {g.full_name}{' '}
                        {g.relationship ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400 transition-colors">({g.relationship})</span> : null}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 transition-colors mt-1">
                        {[g.occupation, g.contact_number, g.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">—</p>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold tracking-wider text-purple-700 border-b border-purple-100 dark:border-purple-800/30 pb-2 mb-4">EMERGENCY CONTACT</div>
            <div className="bg-white dark:bg-slate-900 transition-colors p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
              {detail?.emergency ? (
                <div className="text-sm">
                  <div className="font-semibold text-purple-900">
                    {detail.emergency.full_name}{' '}
                    {detail.emergency.relationship ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400 transition-colors">({detail.emergency.relationship})</span> : null}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 transition-colors mt-1">{detail.emergency.contact_number || '—'}</div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs font-bold tracking-wider text-purple-700 border-b border-purple-100 dark:border-purple-800/30 pb-2 mb-4">CLINICAL & ENROLLMENT</div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 text-sm bg-white dark:bg-slate-900 transition-colors p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
        <div className="col-span-2">
          <Field
            label="Diagnosis"
            value={detail?.clinical?.primary_diagnosis || detail?.clinical?.working_diagnosis}
          />
        </div>
        <div className="col-span-2">
          <Field label="Disability / Impairment" value={detail?.clinical?.secondary_diagnosis} />
        </div>
        <Field label="Enrollment (IEP)" value={detail?.clinical?.iep_level} />
        <Field label="Allergies" value={detail?.clinical?.allergies} />
        <Field label="Assigned Psychologist" value={detail?.patient?.treating_psychologist?.display_name || 'Unassigned'} />
        <Field label="Assigned Psychometrician" value={detail?.patient?.treating_psychometrician?.display_name || 'Unassigned'} />
      </dl>

      <div className="mt-8 rounded-2xl border border-purple-100 dark:border-purple-800/30 bg-purple-50/50 dark:bg-purple-900/10 p-5">
        <div className="text-xs font-bold tracking-wider text-purple-700 mb-4">ACCOUNT REGISTRATION</div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 text-sm">
          {(detail?.caregiver?.email || detail?.caregiver_email || '').startsWith('noemail_') ? (
            <Field label="Student ID" value={active.id || '—'} />
          ) : (
            <Field label="Login Email" value={detail?.caregiver?.email || detail?.caregiver_email || '—'} />
          )}
          <Field label="Registered On" value={fmtDate(detail?.patient?.created_at || active.created_at)} />
          <Field label="Account Status" value={cap(active.status)} />
          <Field label="Admission Form Status" value={cap(active.form)} />
        </dl>
      </div>
    </Modal>
  )
}

function DeleteStudentModal({ name, onConfirm, onClose }) {
  const [phase, setPhase] = useState('confirm')

  const doDelete = async () => {
    setPhase('loading')
    try {
      await onConfirm()
      setPhase('success')
      setTimeout(onClose, 1800)
    } catch (err) {
      setPhase('confirm')
      toast.error(err.message || 'Failed to delete')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76, 29, 149, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <style>{`
        @keyframes em-spin { to { transform: rotate(360deg); } }
        @keyframes em-scale-in { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes em-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes em-check { from { stroke-dashoffset: 50; } to { stroke-dashoffset: 0; } }
      `}</style>
      <div className="bg-white dark:bg-slate-900 rounded-[28px] p-[40px] max-w-[420px] w-[92%] text-center shadow-[0_40px_80px_rgba(88,28,135,0.25),0_0_0_1px_rgba(139,92,246,0.1)] dark:shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] transition-colors duration-300" style={{
        animation: 'em-fade-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {phase === 'confirm' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Student Record?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors mb-8">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-slate-100">{name}</strong>? This action cannot be undone and removes all associated logs.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors transition-all duration-200 active:scale-[0.98]">Cancel</button>
              <button onClick={doDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-200 active:scale-[0.98]">Delete</button>
            </div>
          </>
        ) : phase === 'loading' ? (
          <>
            <div className="flex justify-center mb-7">
              <div className="w-[76px] h-[76px] rounded-full border-[4px] border-red-100 border-t-red-600 animate-[em-spin_0.75s_linear_infinite]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Deleting Student...</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">Please wait.</p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-7">
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'em-scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none"><path d="M4.5 12.5l5 5 10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'em-check 0.5s ease 0.1s both' }}/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Deletion Successful!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors mb-6"><strong className="text-slate-900 dark:text-slate-100">{name}</strong> has been removed.</p>
          </>
        )}
      </div>
    </div>
  )
}

function Patients() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [active, setActive] = useState(null)
  const [detail, setDetail] = useState(null)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [editing, setEditing] = useState(null)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openAdmissionForm, setOpenAdmissionForm] = useState(false)
  const [studentSlip, setStudentSlip] = useState(null)
  const [manageAccountUserId, setManageAccountUserId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(null)
  const [archiving, setArchiving] = useState(false)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  // Assigned-clinician filters: '' = all, 'unassigned' = no RPm/RPsy, else employee id.
  const [psyFilter, setPsyFilter] = useState('')
  const [rpmFilter, setRpmFilter] = useState('')
  // 'recent' = newest-first on created_at (exact mirror of 'oldest');
  // 'oldest' | 'name' keep their explicit order.
  const [sortMode, setSortMode] = useState('recent')
  const [staffOptions, setStaffOptions] = useState([])
  // Snapshot from the previous visit — frozen for this render so the `New`
  // badge marks rows unseen until the next refresh.
  const [seenStudentIds] = useState(() => readSeenIds(STUDENT_SEEN_KEY))
  const [hasStudentSnapshot] = useState(() => hasSeenKey(STUDENT_SEEN_KEY))

  const load = (archived = showArchived, branch = branchFilter) =>
    api.admin
      .patients(archived, branch)
      .then((d) => setRows(d.patients.map(toRow)))
      .catch((e) => setError(e.message))

  // Live-refresh the roster when another admin registers or edits students.
  const patientScope = branchFilter || profile?.clinic_id || ''
  const patientSubs = patientScope
    ? [{ table: 'patients', filter: `clinic_id=eq.${patientScope}` }]
    : (isSuperAdmin ? [{ table: 'patients' }] : [])
  useRealtimeRefresh(profile?.id, patientSubs, () => {
    load()
  })

  // Remember every displayed row so the next visit/refresh treats them as
  // already seen (no separate "mark as read" click needed).
  useEffect(() => {
    if (!rows.length) return
    rememberIds(STUDENT_SEEN_KEY, rows.map((r) => r.uuid).filter(Boolean))
  }, [rows])

  const openDetail = (r) => {
    setActive(r)
    setDetail(null)
    setShowDeleteConfirm(false)
    if (r?.uuid) rememberIds(STUDENT_SEEN_KEY, [r.uuid])
    api.admin.patient(r.uuid).then(setDetail).catch(() => { })
  }
  const openEditForm = async () => {
    if (!active) return
    setShowDeleteConfirm(false)
    try {
      const full = detail || await api.admin.patient(active.uuid)
      setEditing(full)
    } catch (err) {
      toast.error(err.message || 'Failed to load student record.')
    }
  }
  const previewOfficialPdf = () => {
    if (!active?.uuid) return
    setPdfPreview({
      title: `Student Admission Form · ${detail?.patient?.full_name || active.name || active.id}`,
      filename: `${detail?.patient?.patient_id || active.id || 'student'}-CMPS-SE-FO-01.pdf`,
      loadPdf: () => api.admin.downloadPatientPdf(active.uuid),
    })
  }
  const closeDetail = () => {
    setActive(null)
    setDetail(null)
    setPdfPreview(null)
    setShowDeleteConfirm(false)
    setConfirmArchive(null)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.admin.deletePatient(active.uuid)
      // Removing success toast since the animation handles it.
      // toast.success('Student record deleted permanently.')
      setActive(null)
      setDetail(null)
      setShowDeleteConfirm(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to delete student.')
      throw err // Bubble up to modal
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (nextStatus) => {
    if (!active || !nextStatus) return
    try {
      await api.admin.updatePatient(active.uuid, { status: nextStatus })
      // Re-read: the server recomputes Active/Pending from requirements,
      // so the toast reports the authoritative value, not the request.
      const fresh = await api.admin.patient(active.uuid).catch(() => null)
      if (fresh) setDetail(fresh)
      const s = fresh?.patient?.status || nextStatus
      setActive((a) => a && ({
        ...a,
        rawStatus: s,
        status: cap(s),
        tone: s === 'active' ? 'emerald' : s === 'inactive' ? 'slate' : 'amber',
      }))
      load()
      toast.success(`Status is now ${cap(s)}.`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status.')
      throw err
    }
  }

  const handleArchive = async () => {    if (!confirmArchive) return
    const { row, action } = confirmArchive
    setArchiving(true)
    try {
      if (action === 'restore') await api.admin.restorePatient(row.uuid)
      else await api.admin.archivePatient(row.uuid)
      toast.success(action === 'restore' ? 'Student record restored.' : 'Student record archived.')
      setConfirmArchive(null)
      closeDetail()
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to update archive status.')
    } finally {
      setArchiving(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setPage(1)
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived, branchFilter])

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    api.admin.employees()
      .then((data) => setStaffOptions(data?.employees || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Name search supports "Last, First M." as well as plain "First Last":
  // commas become spaces, then every token must appear somewhere in the
  // full "first middle last id" haystack.
  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const qTokens = q.split(/\s+/).filter(Boolean)
  const filtered = rows
    .filter((r) => {
      if (showArchived ? !r.is_archived : !!r.is_archived) return false
      if (psyFilter === 'unassigned' && r.treating_psychologist_id) return false
      if (psyFilter && psyFilter !== 'unassigned' && r.treating_psychologist_id !== psyFilter) return false
      if (rpmFilter === 'unassigned' && r.treating_psychometrician_id) return false
      if (rpmFilter && rpmFilter !== 'unassigned' && r.treating_psychometrician_id !== rpmFilter) return false
      if (!qTokens.length) return true
      const haystack = [r.first_name, r.middle_name, r.last_name, r.name, r.id].filter(Boolean).join(' ').toLowerCase()
      return qTokens.every((t) => haystack.includes(t))
    })
    .sort((a, b) => {
      // Match the displayed "LAST, FIRST M." order (backend `name` is
      // "First M. Last", so sorting by it looks wrong on screen).
      const keyA = formatLastFirstMI(a) || a.name || ''
      const keyB = formatLastFirstMI(b) || b.name || ''
      if (sortMode === 'name') return keyA.localeCompare(keyB)
      const at = new Date(a.created_at || 0).getTime()
      const bt = new Date(b.created_at || 0).getTime()
      if (sortMode === 'oldest') return at - bt
      // 'recent' is the exact mirror of 'oldest': pure newest-first on
      // created_at. (Unseen-row pinning used to live here, but it pushed
      // fresh rows back into A–Z after one refresh — see the `New` badge
      // below for the remaining unseen marker.)
      if (sortMode === 'recent') return bt - at
      return keyA.localeCompare(keyB)
    })
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const psychologists = staffOptions.filter((e) => e.role === 'psychologist' || (e.extra_roles || []).includes('psychologist'))
  const psychometricians = staffOptions.filter((e) => e.role === 'psychometrician' || (e.extra_roles || []).includes('psychometrician'))

  const handleExport = () => {
    if (!filtered || filtered.length === 0) {
      toast.error('No student records to export.')
      return
    }
    const headers = ['Student ID', 'Full Name', 'Age', 'Sex', 'Assigned Psychologist', 'Assigned Psychometrician', 'Registered', 'Date of Birth', 'Admission Form']
    const csvRows = filtered.map((r) => [
      r.id,
      r.name,
      r.age,
      r.sex,
      r.treating_psychologist_name,
      r.treating_psychometrician_name,
      fmtDate(r.created_at),
      r.date_of_birth,
      r.form,
    ])
    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `students_export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <StaffHeader title="Student Management" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="students-workspace">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Student Management</h1>
            <PageSubtitle>Manage student records, statuses, and admission forms.</PageSubtitle>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Status is automatic: <strong className="font-semibold">Active</strong> = admission complete + waiver approved ·
              <strong className="font-semibold"> Pending</strong> = requirements incomplete ·
              <strong className="font-semibold"> Inactive</strong> = set manually by an admin.
            </p>
          </div>
          <Button
            onClick={() => setOpenAdmissionForm(true)}
            data-onboarding-key="student-admission-form"
          >
            Open Student Admission Form
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
        ) : null}

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v)
                  setPage(1)
                }}
                placeholder="Search name (Last, First M.) or ID"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={handleExport}
                className="cymon-export-btn shrink-0 self-start sm:self-center"
                data-onboarding-key="student-export-list"
              >
                <span className="IconContainer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </span>
                <span className="text">Export List</span>
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-purple-200 dark:border-slate-700 bg-purple-50/50 dark:bg-slate-800 p-1">
                {[
                  { value: false, label: 'Active' },
                  { value: true, label: 'Archived' },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setShowArchived(t.value)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${showArchived === t.value
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-slate-700'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
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
              <AnimatedSelect
                value={psyFilter || 'all'}
                onChange={(val) => {
                  setPsyFilter(val === 'all' ? '' : val)
                  setPage(1)
                }}
                searchable
                searchPlaceholder="Search psychologist..."
                options={[
                  { value: 'all', label: 'All RPsy' },
                  { value: 'unassigned', label: 'No RPsy' },
                  ...psychologists.map((e) => ({ value: e.id, label: formatLastFirstMI(e) || e.display_name || e.email })),
                ]}
              />
              <AnimatedSelect
                value={rpmFilter || 'all'}
                onChange={(val) => {
                  setRpmFilter(val === 'all' ? '' : val)
                  setPage(1)
                }}
                searchable
                searchPlaceholder="Search psychometrician..."
                options={[
                  { value: 'all', label: 'All RPm' },
                  { value: 'unassigned', label: 'No RPm' },
                  ...psychometricians.map((e) => ({ value: e.id, label: formatLastFirstMI(e) || e.display_name || e.email })),
                ]}
              />
              <AnimatedSelect
                value={sortMode}
                onChange={(val) => {
                  setSortMode(val)
                  setPage(1)
                }}
                options={[
                  { value: 'recent', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'name', label: 'Name A–Z' },
                ]}
              />
            </div>
          </div>
        </section>

        <div className="mt-5 flex gap-6">
          <section className="min-w-0 flex-1 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="text-xs font-semibold tracking-wider text-purple-700">
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left">Age</th>
                  <th className="py-3 px-4 text-left" title="Automatic: Active = admission complete + waiver approved; Pending = requirements incomplete">Status</th>
                  <th className="py-3 px-4 text-left">Assigned Psychologist</th>
                  <th className="py-3 px-4 text-left">Assigned Psychometrician</th>
                  <th className="py-3 px-4 text-left">Registered</th>
                  <th className="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody key={loading ? 'loading' : 'loaded'} className="divide-y divide-purple-100 animate-content-fade-in">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonTableRow key={i} cells={6} hasAvatar={true} />
                  ))
                  : null}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                      {showArchived ? 'No archived students.' : 'No patients match your search.'}
                    </td>
                  </tr>
                ) : null}
                {!loading && pageRows.map((r) => {
                  const isSelected = active && active.id === r.id
                  return (
                    <tr
                      key={r.id}
                      className={isSelected ? 'bg-purple-100/70 dark:bg-purple-900/40 transition-colors font-medium' : 'hover:bg-purple-50/50 dark:hover:bg-slate-800 transition-colors'}
                    >
                      <td className="py-3 px-4 align-top whitespace-normal break-words">
                        <div className="flex items-center gap-3">
                          {r.photo_url ? (
                            <img src={r.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-purple-100" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-700 ring-2 ring-white">
                              {(formatLastFirstMI(r) || r.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold uppercase text-slate-800 dark:text-slate-100 transition-colors">
                              {formatLastFirstMI(r) || r.name}
                              {sortMode === 'recent' && hasStudentSnapshot && !seenStudentIds.has(r.uuid) ? (
                                <span className="ml-2 inline-flex items-center rounded-full bg-purple-700 px-2 py-0.5 align-middle text-[10px] font-bold normal-case text-white">
                                  New
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">ID: {r.patient_id || r.id}</div>
                            {isSuperAdmin && r.clinic_name ? (
                              <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                {shortBranchName({ code: r.clinic_code, name: r.clinic_name })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-normal break-words text-slate-800 dark:text-slate-100 transition-colors">{r.age ?? '—'}</td>
                      <td className="py-3 px-4 align-top whitespace-normal break-words">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone[r.tone]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-normal break-words">
                        <div className="max-w-[12rem] truncate whitespace-nowrap font-medium uppercase text-slate-800 dark:text-slate-100 transition-colors" title={r.treating_psychologist_name}>{r.treating_psychologist_name}</div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-normal break-words">
                        <div className="max-w-[12rem] truncate whitespace-nowrap font-medium uppercase text-slate-800 dark:text-slate-100 transition-colors" title={r.treating_psychometrician_name}>{r.treating_psychometrician_name}</div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-normal break-words text-slate-800 dark:text-slate-100 transition-colors">{fmtDate(r.created_at)}</td>
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center justify-start">
                          <RowAction variant="view" onClick={() => openDetail(r)} data-onboarding-key="student-view-record">
                            View
                          </RowAction>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </section>

          {active ? (
            <StudentDetailModal
              active={active}
              detail={detail}
              onClose={closeDetail}
              onEdit={openEditForm}
              onPreviewPdf={previewOfficialPdf}
              onManageParentAccount={(p) => setManageAccountUserId({
                id: p.caregiver_id,
                name: p.full_name + "'s Parent",
                email: detail?.caregiver?.email || detail?.caregiver_email || '',
              })}
              onDeleteClick={(r) => setShowDeleteConfirm(r)}
              onArchiveClick={(r, action) => setConfirmArchive({ row: r, action })}
              onStatusChange={handleStatusChange}
            />
          ) : null}
          {showDeleteConfirm ? (
            <DeleteStudentModal
              name={showDeleteConfirm.name || showDeleteConfirm.full_name}
              onClose={() => setShowDeleteConfirm(false)}
              onConfirm={handleDelete}
            />
          ) : null}
          {confirmArchive ? (
            <Modal
              title={confirmArchive.action === 'restore' ? 'Restore Student Record?' : 'Archive Student Record?'}
              subtitle={confirmArchive.row.name}
              onClose={() => (archiving ? null : setConfirmArchive(null))}
              footer={
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(null)}
                    disabled={archiving}
                    className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <Button size="lg" disabled={archiving} onClick={handleArchive}>
                    {archiving ? 'Saving…' : confirmArchive.action === 'restore' ? 'Restore' : 'Archive'}
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-slate-600 dark:text-slate-300 transition-colors">
                {confirmArchive.action === 'restore'
                  ? 'This student will return to the active list and the parent account will work again.'
                  : 'This student will move to the Archived tab and the parent account will be blocked from signing in. The record is kept and can be restored later.'}
              </p>
            </Modal>
          ) : null}
        </div>

      </div>
      {openAdmissionForm ? (
        <Modal
          title="Student Admission Form"
          subtitle="CMPS:SE-FO-01 rev.0 02192026"
          onClose={() => setOpenAdmissionForm(false)}
          maxWidth="max-w-6xl"
        >
          <StudentAdmissionForm
            inline={true}
            onClose={() => setOpenAdmissionForm(false)}
            onSaved={(created) => {
              // Close the big admission modal first so the success slip is
              // the only dialog on screen (no stale form stacked behind).
              setOpenAdmissionForm(false)
              if (created?.patientId) setStudentSlip(created)
              else toast.success('Student registered. The parent can now sign in.')
              load()
            }}
          />
        </Modal>
      ) : null}
      {studentSlip ? (
        <StudentRegisteredSlipModal created={studentSlip} onClose={() => setStudentSlip(null)} />
      ) : null}
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
      {editing ? (
        <Modal
          title="Edit Student Admission Form"
          subtitle={editing?.patient?.patient_id || 'Update student details'}
          onClose={() => setEditing(null)}
          maxWidth="max-w-6xl"
        >
          <StudentAdmissionEditForm
            inline={true}
            detail={editing}
            patientId={editing?.patient?.id}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null)
              toast.success('Student record updated.')
              load()
              // Re-read the open detail modal too: without this it keeps
              // showing pre-edit values despite the success toast.
              if (active?.uuid) {
                const fresh = await api.admin.patient(active.uuid).catch(() => null)
                if (fresh) setDetail(fresh)
              }
            }}
          />
        </Modal>
      ) : null}
      {manageAccountUserId ? (
        <AdminManageAccountModal
          userId={manageAccountUserId.id}
          userName={manageAccountUserId.name}
          currentEmail={manageAccountUserId.email}
          onClose={() => setManageAccountUserId(null)}
          onSaved={() => {
            setManageAccountUserId(null)
            toast.success('Parent account updated successfully.')
          }}
        />
      ) : null}
    </>
  )
}

function AdminManageAccountModal({ userId, userName, currentEmail = '', onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const hasNoEmail = !currentEmail || currentEmail.startsWith('noemail_')

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!hasNoEmail && !email && !password) {
      setErr('Please provide an email or password to update.')
      return
    }
    if (hasNoEmail && !password) {
      setErr('Please provide a new password.')
      return
    }
    if (password) {
      const pwErr = passwordError(password)
      if (pwErr) {
        setErr(pwErr)
        return
      }
    }
    if (password && password !== confirm) {
      setErr('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const payload = { password }
      if (!hasNoEmail && email) payload.email = email
      await api.admin.manageUserAccount(userId, payload)
      onSaved()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Manage Student Account"
      subtitle={hasNoEmail ? `Change password for ${userName}` : `Update login credentials for ${userName}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors">
            Cancel
          </button>
          <Button type="submit" form="manage-user-account-form" size="lg" disabled={busy}>
            {busy ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form id="manage-user-account-form" onSubmit={submit} className="space-y-4">
        {!hasNoEmail && (
          <Input
            label="New Email"
            type="email"
            tone="purple"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={currentEmail || 'Leave blank to keep existing'}
          />
        )}
        <Input
          label="New Temporary Password"
          type="password"
          tone="purple"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to keep existing"
        />
        <PasswordChecklist password={password} />
        <Input
          label="Confirm Password"
          type="password"
          tone="purple"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {err ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div> : null}
      </form>
    </Modal>
  )
}

export default Patients

