import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import Input from '../../../components/ui/Input'
import Button from '../../../components/ui/Button'
import Skeleton from '../../../components/ui/Skeleton'
import Modal from '../../../components/ui/Modal'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import RowAction from '../../../components/ui/RowAction'
import Pagination from '../../../components/ui/Pagination'
import PhotoCapture from '../../../components/ui/PhotoCapture'
import Checkbox from '../../../components/ui/Checkbox'
import { api } from '../../../lib/api'
import { shortBranchName, branchOptionLabel } from '../../../lib/branches'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import { useAuth } from '../../../auth/useAuth'
import { formatLastFirstMI, formatPHMobile, normalizePHMobile, PH_MOBILE_RE } from '../../../lib/format'
import { printSlipHtml } from '../../../lib/printSlip'
import { passwordError } from '../../../lib/password'
import { SUFFIX_OPTIONS, suffixChoiceOf } from '../../../lib/suffix'
import PasswordChecklist from '../../../components/ui/PasswordChecklist'

const PAGE_SIZE = 20

// IDs the user has already seen (previous visits). Unseen rows pin on top;
// once displayed they are saved, so the next refresh is pure A–Z.
const EMPLOYEE_SEEN_KEY = 'cymon_seen_employee_ids_v1'
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

// All roles that can ever exist. Note: 'super_admin' is only shown to super admins.
// 'admin' is only available for registration by super admins.
const ROLES = [
  { value: 'psychologist', label: 'Psychologist / Clinician' },
  { value: 'psychometrician', label: 'Psychometrician (RPm)' },
  { value: 'admin', label: 'Administrator' },
  { value: 'super_admin', label: 'Super Admin' },
]

const ROLE_META = {
  super_admin: { label: 'Super Admin', tone: 'bg-yellow-100 text-yellow-700' },
  admin: { label: 'Administrator', tone: 'bg-purple-100 text-purple-700' },
  psychologist: { label: 'Psychologist', tone: 'bg-sky-100 text-sky-700' },
  psychometrician: { label: 'Psychometrician', tone: 'bg-amber-100 text-amber-700' },
  // Keep legacy entries so existing data still renders correctly
  occupational_therapist: { label: 'Occupational Therapist', tone: 'bg-emerald-100 text-emerald-700' },
  speech_therapist: { label: 'Speech Therapist', tone: 'bg-rose-100 text-rose-700' },
}

const STAFF_ROLES = ['psychologist', 'psychometrician']
const isStaff = (r) => STAFF_ROLES.includes(r)

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const initialsOf = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

// Table display name: "LAST, FIRST M. SUFFIX" on one line so long names don't
// wrap into a second row (same convention as the Students list). The saved
// display_name in the database stays whole (certificates, PDFs, audit) —
// this only affects the list rendering.
const employeeListName = (emp) => formatLastFirstMI(emp) || emp.name || '—'

const Section = ({ title, hint, children }) => (
  <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm relative overflow-hidden">
    <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-300 via-purple-500 to-purple-300" />
    <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">{title}</div>
    {hint ? <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-0.5">{hint}</div> : null}
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  </section>
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX = {
  email: 120,
  phone: 13,
  name: 20,
  employeeId: 30,
  position: 80,
  licenseNo: 40,
  profession: 80,
  password: 64,
}

const sanitizeNameInput = (value) => String(value || '').replace(/\d/g, '').slice(0, MAX.name)

const empty = {
  email: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix_name: '',
  roles: [],
  phone: '',
  employee_id: '',
  position: '',
  license_no: '',
  title: '',
}

const generatePassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%'
  const pool = upper + lower + digits + symbols
  const rand = (s) => s[Math.floor(Math.random() * s.length)]
  const chars = [
    rand(upper), rand(lower), rand(digits), rand(symbols),
    ...Array.from({ length: 8 }, () => rand(pool)),
  ]
  return chars.sort(() => Math.random() - 0.5).join('')
}

const RoleChips = ({ role, extra = [], disabled = [] }) => {
  const all = [role, ...extra].filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((r) => {
        const meta = ROLE_META[r] || { label: r, tone: 'bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors' }
        const off = disabled.includes(r)
        return (
          <span
            key={r}
            title={off ? `${meta.label} (disabled)` : meta.label}
            className={`rounded-full px-3 py-0.5 text-xs font-semibold ${off ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500' : meta.tone}`}
          >
            {meta.label}
            {off ? ' · Off' : ''}
          </span>
        )
      })}
    </div>
  )
}

// Every branch an employee may act in (home + granted). Home is solid,
// granted branches are outlined — one email, many branches.
const BranchChips = ({ branches = [] }) => {
  if (!branches.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {branches.map((b) => (
        <span
          key={b.id}
          title={b.name || b.code}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.is_primary
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            : 'border border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400'}`}
        >
          {shortBranchName({ code: b.code, name: b.name })}{b.is_primary ? '' : ' +'}
        </span>
      ))}
    </div>
  )
}

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">{label}</div>
    <div className="font-medium text-purple-800 dark:text-purple-300 transition-colors">{value || '—'}</div>
  </div>
)

// `others` is owned by the parent form next to the value.
function SuffixField({ label = 'Suffix Name (optional)', value, others, onPick, onCustomChange, error }) {
  const choice = suffixChoiceOf(value, others)
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-violet dark:text-purple-400 transition-colors">
        {label}
      </label>
      <select
        value={choice}
        onChange={(e) => onPick(e.target.value)}
        className="h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/30 transition-colors"
      >
        <option value="">Select suffix</option>
        {SUFFIX_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value="Others">Others</option>
      </select>
      {choice === 'Others' ? (
        <Input
          tone="purple"
          placeholder="Specify suffix"
          value={SUFFIX_OPTIONS.includes(String(value || '').trim()) ? '' : (value || '')}
          onChange={(e) => onCustomChange(sanitizeNameInput(e.target.value))}
          maxLength={MAX.name}
        />
      ) : null}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  )
}

function EmployeeDetailModal({ emp, onClose, onDeleteClick, onStatusClick, onUpdateEmployee, onOverridePassword, isSuperAdmin, branches = [], allEmployees = [], grantableBranches = [], onChanged = null }) {
  const [disableRole, setDisableRole] = useState(null)
  const [roleBusy, setRoleBusy] = useState('')
  const [editingRoles, setEditingRoles] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsErr, setDetailsErr] = useState(null)
  const [details, setDetails] = useState({
    first_name: emp.first_name || '',
    middle_name: emp.middle_name || '',
    last_name: emp.last_name || '',
    suffix_name: emp.suffix_name || '',
    phone: emp.phone || '',
    employee_id: emp.employee_id || '',
    position: emp.position || '',
    license_no: emp.license_no || '',
    title: emp.staff_title || ''
  })
  const [showLicense, setShowLicense] = useState(false)
  const [detailsOthers, setDetailsOthers] = useState(() => {
    const s = String(emp.suffix_name || '').trim()
    return s !== '' && !SUFFIX_OPTIONS.includes(s)
  })
  const [role, setRole] = useState(emp.role)
  const [extra, setExtra] = useState(emp.extra_roles || [])
  const [branch, setBranch] = useState(emp.clinic_id || '')
  const [savingRoles, setSavingRoles] = useState(false)
  const [roleErr, setRoleErr] = useState(null)
  const isAdmin = emp.role === 'admin' || emp.role === 'super_admin'
  const canManage = isSuperAdmin || !isAdmin
  // Credential sections follow EVERY held role (primary + additional), not
  // just the primary: a super admin who is also a psychologist edits both a
  // Position (admin side) and License/Profession (clinical side). Mirrors the
  // Register Employee form, which shows both sections when both apply.
  const heldRoles = [emp.role, ...(emp.extra_roles || [])]
  const hasAdminRole = heldRoles.includes('admin') || heldRoles.includes('super_admin')
  const hasStaffRole = heldRoles.some(isStaff)

  // Refresh the editable copies whenever a different employee is opened.
  useEffect(() => {
    setDetails({
      first_name: emp.first_name || '',
      middle_name: emp.middle_name || '',
      last_name: emp.last_name || '',
      suffix_name: emp.suffix_name || '',
      phone: emp.phone || '',
      employee_id: emp.employee_id || '',
      position: emp.position || '',
      license_no: emp.license_no || '',
      title: emp.staff_title || '',
    })
    setDetailsOthers(() => {
      const s = String(emp.suffix_name || '').trim()
      return s !== '' && !SUFFIX_OPTIONS.includes(s)
    })
    setRole(emp.role)
    setExtra(emp.extra_roles || [])
    setBranch(emp.clinic_id || '')
    setEditingDetails(false)
    setEditingRoles(false)
    setDetailsErr(null)
    setRoleErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.id])

  const toggleExtra = (r) => setExtra((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  const startEdit = () => {
    setRoleErr(null)
    setRole(emp.role)
    setExtra(emp.extra_roles || [])
    setBranch(emp.clinic_id || '')
    setEditingRoles(true)
  }

  const saveRoles = async () => {
    setRoleErr(null)
    setSavingRoles(true)
    try {
      await onUpdateEmployee(emp.id, {
        role,
        extra_roles: extra.filter((r) => r !== role),
        // Branch moves are Super Admin-only; the backend 403s anyone else.
        ...(isSuperAdmin && branch && branch !== emp.clinic_id ? { clinic_id: branch } : {}),
      })
      setEditingRoles(false)
    } catch (e) {
      setRoleErr(e.message)
    } finally {
      setSavingRoles(false)
    }
  }

  const enableRole = async (r) => {
    setRoleErr(null)
    setRoleBusy(r)
    try {
      await api.admin.enableEmployeeRole(emp.id, r)
      toast.success(`The ${CLINICAL_ROLE_LABEL[r] || r} role has been re-enabled.`)
      if (onChanged) await onChanged()
    } catch (e) {
      setRoleErr(e.message)
      toast.error(e.message || 'Failed to re-enable the role.')
    } finally {
      setRoleBusy('')
    }
  }

  const saveDetails = async () => {
    setDetailsErr(null)
    const suffixText = String(details.suffix_name || '').trim()
    const suffixIsOthers = detailsOthers || (suffixText !== '' && !SUFFIX_OPTIONS.includes(suffixText))
    if (suffixIsOthers && !suffixText) {
      setDetailsErr('Please specify the suffix name.')
      return
    }
    setSavingDetails(true)
    try {
      await onUpdateEmployee(emp.id, details)
      setEditingDetails(false)
    } catch (e) {
      setDetailsErr(e.message)
    } finally {
      setSavingDetails(false)
    }
  }

  return (
    <>
    <Modal
      title="Employee Details"
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          {canManage && (
            <button
              type="button"
              onClick={() => onOverridePassword(emp)}
              className="rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 transition-colors px-5 py-2.5 text-sm font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm"
            >
              Manage Account
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onStatusClick(emp)}
              className={emp.is_disabled
                ? 'rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-slate-900 transition-colors px-5 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm'
                : 'rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-slate-900 transition-colors px-5 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm'}
            >
              {emp.is_disabled ? 'Reactivate Account' : 'Deactivate Account'}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onDeleteClick(emp)}
              className="rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-900 transition-colors px-5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 active:scale-[0.98] shadow-sm"
            >
              Delete Account
            </button>
          )}
        </div>
      }
    >
      <div className="-mt-2 flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-100 to-purple-200 text-4xl font-bold text-purple-700 shadow-inner ring-4 ring-purple-100 relative z-10">
          {emp.avatar_url ? <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" /> : initialsOf(emp.name)}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left mt-2 sm:mt-0">
          <div className="text-xl font-bold text-purple-950 truncate uppercase">{employeeListName(emp)}</div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors break-all">{emp.email}</div>
          <div className="mt-3 flex justify-center sm:justify-start">
            <RoleChips role={emp.role} extra={emp.extra_roles} disabled={emp.disabled_roles} />
          </div>
          <div className="mt-2 flex justify-center sm:justify-start">
            <BranchChips branches={emp.branches} />
          </div>
        </div>
      </div>

      {editingDetails ? (
        <>
        <div className="mt-6 bg-purple-50/40 dark:bg-purple-900/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30 relative">
            <Input label="First Name" tone="purple" value={details.first_name} onChange={(e) => setDetails({...details, first_name: e.target.value})} />
            <Input label="Middle Name" tone="purple" value={details.middle_name} onChange={(e) => setDetails({...details, middle_name: e.target.value})} />
            <Input label="Last Name" tone="purple" value={details.last_name} onChange={(e) => setDetails({...details, last_name: e.target.value})} />
            <SuffixField
              label="Suffix Name"
              value={details.suffix_name}
              others={detailsOthers}
              onPick={(choice) => {
                if (choice === 'Others') {
                  setDetailsOthers(true)
                } else {
                  setDetailsOthers(false)
                  setDetails({ ...details, suffix_name: choice })
                }
              }}
              onCustomChange={(text) => setDetails({ ...details, suffix_name: text })}
            />
            <Input label="Phone" tone="purple" value={details.phone} onChange={(e) => setDetails({...details, phone: e.target.value})} />
            <Input label="Employee ID" tone="purple" value={details.employee_id} onChange={(e) => setDetails({...details, employee_id: e.target.value})} />
            <Info label="Assigned Branch" value={emp.clinic_name || '—'} />
            {hasAdminRole ? (
              <Input label="Position (admin job title)" tone="purple" value={details.position} onChange={(e) => setDetails({...details, position: e.target.value})} />
            ) : null}
            {hasStaffRole ? (
              <>
                <Input label="PRC License No." tone="purple" value={details.license_no} onChange={(e) => setDetails({...details, license_no: e.target.value})} />
                <Input label="Profession (e.g. Clinical Psychologist)" tone="purple" value={details.title} onChange={(e) => setDetails({...details, title: e.target.value})} />
              </>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setEditingDetails(false)} className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors transition-colors">Cancel</button>
            <button onClick={saveDetails} disabled={savingDetails} className="rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-60 transition-colors">
              {savingDetails ? 'Saving...' : 'Save Details'}
            </button>
          </div>
          {detailsErr && <div className="mt-3 text-xs text-red-600">{detailsErr}</div>}
        </>
      ) : (
        <div className="mt-6 relative">
          {canManage && (
            <div className="absolute -top-3 right-2 z-20">
              <button onClick={() => setEditingDetails(true)} className="rounded-md bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors shadow-sm">Edit Profile</button>
            </div>
          )}
            <Info label="First Name" value={emp.first_name} />
            <Info label="Middle Name" value={emp.middle_name} />
            <Info label="Last Name" value={emp.last_name} />
            <Info label="Suffix Name" value={emp.suffix_name} />
            <Info label="Phone" value={emp.phone} />
            <Info label="Employee ID" value={emp.employee_id} />
            <Info label="Assigned Branch" value={emp.clinic_name || '—'} />
            {hasAdminRole ? (
              <Info label="Position (admin job title)" value={emp.position} />
            ) : null}
            {hasStaffRole ? (
              <>
                <Info label="PRC License No." value={emp.license_no} />
                <Info label="Profession" value={emp.staff_title} />
              </>
            ) : null}
            <Info label="Joined" value={fmtDate(emp.created_at)} />
          </div>
      )}

      {hasStaffRole && emp.license_id_url ? (
        <div className="mt-5 rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Professional License ID</div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors">Uploaded copy available</div>
            </div>
            <button
              onClick={() => setShowLicense(!showLicense)}
              className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-4 py-2 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
            >
              {showLicense ? 'Hide License' : 'View License'}
            </button>
          </div>
          {showLicense ? (
            <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors mt-2 p-1">
              <img src={emp.license_id_url} alt="License" className="w-full h-auto object-contain rounded-md" style={{ maxHeight: '300px' }} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-purple-100 dark:border-purple-800/30 bg-purple-50/50 dark:bg-purple-900/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold tracking-wider text-purple-700 dark:text-purple-300">ASSIGNED ROLES</div>
          {canManage && !editingRoles && (
            <button onClick={startEdit} className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-900 transition-colors px-3 py-1.5 rounded-md border border-purple-200 dark:border-slate-700 transition-colors shadow-sm transition-colors">
              Edit Roles
            </button>
          )}
        </div>
        {/* Read-only fallback: viewers without role actions (or locked
            accounts) still see the held roles here; managers get the
            actionable rows below instead of a duplicate badge strip. */}
        {!editingRoles && !(canManage && !emp.is_disabled) ? (
          <div className="mt-2">
            <RoleChips role={emp.role} extra={emp.extra_roles} disabled={emp.disabled_roles} />
          </div>
        ) : null}
        {!editingRoles && canManage && !emp.is_disabled ? (
          <div className="mt-3 space-y-1.5">
            {[emp.role, ...(emp.extra_roles || [])].filter(Boolean).map((r) => {
              const off = (emp.disabled_roles || []).includes(r)
              const isMain = r === emp.role
              return (
                <div key={r} className="flex items-center justify-between gap-2 rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-semibold text-slate-600 dark:text-slate-300" title={isMain ? 'Main role' : 'Additional role'}>
                    {ROLE_META[r]?.label || r}
                    {isMain ? (
                      <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        Main
                      </span>
                    ) : null}
                    {off ? <span className="ml-1 text-slate-400">(disabled)</span> : null}
                  </span>
                  {off ? (
                    <button
                      type="button"
                      onClick={() => enableRole(r)}
                      disabled={roleBusy === r}
                      className="font-bold text-emerald-600 hover:text-emerald-800 disabled:opacity-60"
                    >
                      {roleBusy === r ? 'Enabling…' : 'Enable'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisableRole(r)}
                      className="font-bold text-amber-600 hover:text-amber-800"
                    >
                      Disable
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}

        {editingRoles ? (
          <div className="mt-4 rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Primary Role</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors px-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {ROLES.filter(r => {
                    if (r.value === 'super_admin') return isSuperAdmin
                    if (r.value === 'admin') return isSuperAdmin
                    return true
                  }).map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Additional Roles</div>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLES.filter((r) => r.value !== role && (r.value !== 'super_admin' || isSuperAdmin) && (r.value !== 'admin' || isSuperAdmin)).map((r) => (
                  <Checkbox 
                    key={r.value} 
                    checked={extra.includes(r.value)} 
                    onChange={() => toggleExtra(r.value)} 
                    label={r.label}
                    className="flex items-center gap-2 rounded-lg border border-purple-100 dark:border-slate-700 bg-purple-50/50 dark:bg-slate-800 px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-200 cursor-pointer hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors"
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Assigned Branch</div>
              {isSuperAdmin && branches.length > 1 ? (
                <>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors px-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{shortBranchName(b)}</option>
                    ))}
                  </select>
                  {(role === 'super_admin' || extra.includes('super_admin')) ? (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                      Super Admins see all branches — this only sets the home branch shown on records.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                      Staff only see data from their home branch. Move them here to reassign.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
                  {emp.clinic_name || 'Current branch'} — branch moves are done by a Super Admin.
                </p>
              )}
            </div>
            {roleErr ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{roleErr}</div> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingRoles(false)} className="rounded-lg border border-slate-200 dark:border-slate-800 transition-colors px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors transition-colors">
                Cancel
              </button>
              <button onClick={saveRoles} disabled={savingRoles} className="rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-60 transition-colors">
                {savingRoles ? 'Saving…' : 'Save Roles'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BranchAccessManager
        emp={emp}
        grantableBranches={grantableBranches}
        canManage={canManage}
        onChanged={onChanged}
      />
      {hasStaffRole ? (
        <PractitionerSchedules
          empId={emp.id}
          branches={emp.branches?.length ? emp.branches : (emp.clinic_id ? [{ id: emp.clinic_id, code: emp.clinic_code, name: emp.clinic_name }] : [])}
          canManage={canManage && !emp.is_disabled}
        />
      ) : null}
    </Modal>
    {disableRole ? (
      <RoleDisableModal
        emp={emp}
        role={disableRole}
        employees={allEmployees}
        onClose={() => setDisableRole(null)}
        onDone={async () => {
          setDisableRole(null)
          if (onChanged) await onChanged()
        }}
      />
    ) : null}
  </>
  )
}

const CLINICAL_ROLE_LABEL = {
  psychologist: 'Psychologist (RPsy)',
  psychometrician: 'Psychometrician (RPm)',
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const fmtTime = (value) => {
  if (!value) return '-'
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

// Active clinicians holding one role, excluding the clinician being edited.
function candidatesFor(employees, role, excludeId) {
  return (employees || []).filter((e) =>
    !e.is_disabled &&
    e.id !== excludeId &&
    [e.role, ...(e.extra_roles || [])].includes(role) &&
    !(e.disabled_roles || []).includes(role),
  )
}

// Per-role replacement pickers: shown only for roles that still handle
// students. Nothing to reassign → renders nothing.
function ReassignSelects({ assignments, employees, excludeId, replacements, onPick }) {
  const roles = ['psychologist', 'psychometrician'].filter((r) => (assignments?.[r] || []).length > 0)
  if (!roles.length) return null
  return (
    <div className="space-y-4">
      {roles.map((r) => {
        const students = assignments[r]
        const options = candidatesFor(employees, r, excludeId)
        return (
          <div key={r} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {students.length} student{students.length === 1 ? '' : 's'} under {CLINICAL_ROLE_LABEL[r]}
            </div>
            <div className="mt-1 max-h-20 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
              {students.slice(0, 8).map((s) => s.name).join(' · ')}{students.length > 8 ? ` · +${students.length - 8} more` : ''}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Reassign to
            </div>
            <AnimatedSelect
              value={replacements[r] || ''}
              onChange={(val) => onPick(r, val)}
              placeholder={`Select replacement ${CLINICAL_ROLE_LABEL[r]}…`}
              options={options.map((e) => ({ value: e.id, label: `${formatLastFirstMI(e) || e.name} (${e.employee_id || e.email})` }))}
            />
            {!options.length ? (
              <div className="mt-1 text-xs text-red-600">No active {CLINICAL_ROLE_LABEL[r]} available — register one first.</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// Full-account deactivation with the reassignment gate: when the clinician
// still handles students, replacements are required before confirming.
// A stale 409 from the server (assignments changed mid-modal) refreshes
// the counts instead of dead-ending.
function DeactivateModal({ emp, employees, onClose, onDone }) {
  const [assignments, setAssignments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replacements, setReplacements] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let on = true
    api.admin.employeeAssignments(emp.id)
      .then((d) => { if (on) setAssignments(d.assignments || { psychologist: [], psychometrician: [] }) })
      .catch(() => { if (on) setAssignments({ psychologist: [], psychometrician: [] }) })
      .finally(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [emp.id])

  const needed = ['psychologist', 'psychometrician'].filter((r) => (assignments?.[r] || []).length > 0)
  const ready = needed.every((r) => replacements[r])

  const confirm = async () => {
    setErr(null)
    setBusy(true)
    try {
      const payload = {}
      if (replacements.psychologist) payload.reassign_psychologist_id = replacements.psychologist
      if (replacements.psychometrician) payload.reassign_psychometrician_id = replacements.psychometrician
      await api.admin.deactivateEmployee(emp.id, Object.keys(payload).length ? payload : null)
      toast.success(`${emp.name}'s account has been deactivated.`)
      onDone()
    } catch (e) {
      if (e.details?.code === 'REASSIGNMENT_REQUIRED' && e.details?.assignments) {
        setAssignments(e.details.assignments)
        setReplacements({})
      }
      setErr(e.message || 'Failed to deactivate the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Deactivate Account?"
      subtitle={emp.name}
      onClose={() => (busy ? null : onClose())}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400"
          >
            Cancel
          </button>
          <Button size="lg" disabled={busy || loading || !ready} onClick={confirm}>
            {busy ? 'Saving…' : 'Deactivate'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        This account will be blocked from signing in immediately, but the record is kept and can be reactivated later.
      </p>
      {loading ? (
        <div className="mt-4"><Skeleton className="h-20 w-full" /></div>
      ) : needed.length ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {emp.name} still handles students. Reassign them first — deactivation never leaves students without a clinician.
          </p>
          <ReassignSelects
            assignments={assignments}
            employees={employees}
            excludeId={emp.id}
            replacements={replacements}
            onPick={(r, val) => setReplacements((s) => ({ ...s, [r]: val }))}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No students are assigned to this account.</p>
      )}
      {err ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div> : null}
    </Modal>
  )
}

// Disable ONE role on a multi-role account (other roles keep working).
// Same reassignment gate as full deactivation, scoped to that role.
function RoleDisableModal({ emp, role, employees, onClose, onDone }) {
  const [assignments, setAssignments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replacement, setReplacement] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let on = true
    api.admin.employeeAssignments(emp.id)
      .then((d) => { if (on) setAssignments(d.assignments || { psychologist: [], psychometrician: [] }) })
      .catch(() => { if (on) setAssignments({ psychologist: [], psychometrician: [] }) })
      .finally(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [emp.id])

  const students = assignments?.[role] || []
  const ready = !students.length || !!replacement

  const confirm = async () => {
    setErr(null)
    setBusy(true)
    try {
      const payload = { role }
      if (replacement) {
        if (role === 'psychologist') payload.reassign_psychologist_id = replacement
        else payload.reassign_psychometrician_id = replacement
      }
      await api.admin.disableEmployeeRole(emp.id, payload)
      toast.success(`The ${CLINICAL_ROLE_LABEL[role] || role} role has been disabled. Other roles stay active.`)
      onDone()
    } catch (e) {
      if (e.details?.code === 'REASSIGNMENT_REQUIRED' && e.details?.assignments) {
        setAssignments(e.details.assignments)
        setReplacement('')
      }
      setErr(e.message || 'Failed to disable the role.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Disable ${CLINICAL_ROLE_LABEL[role] || role} role?`}
      subtitle={emp.name}
      onClose={() => (busy ? null : onClose())}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400"
          >
            Cancel
          </button>
          <Button size="lg" disabled={busy || loading || !ready} onClick={confirm}>
            {busy ? 'Saving…' : 'Disable role'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {emp.name} will keep signing in with their other roles — only {CLINICAL_ROLE_LABEL[role] || role} is switched off.
      </p>
      {loading ? (
        <div className="mt-4"><Skeleton className="h-20 w-full" /></div>
      ) : students.length ? (
        <div className="mt-4">
          <ReassignSelects
            assignments={{ [role]: students }}
            employees={employees}
            excludeId={emp.id}
            replacements={{ [role]: replacement }}
            onPick={(_, val) => setReplacement(val)}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No students are assigned under this role.</p>
      )}
      {err ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div> : null}
    </Modal>
  )
}

// Extra-branch access on one account (one email, many branches).
function BranchAccessManager({ emp, grantableBranches = [], canManage, onChanged }) {
  const [grantId, setGrantId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const memberIds = new Set((emp.branches || []).map((b) => b.id))
  const options = (grantableBranches || []).filter((b) => !memberIds.has(b.id))

  const grant = async () => {
    if (!grantId) return
    setErr(null)
    setBusy(true)
    try {
      await api.admin.grantBranchAccess(emp.id, grantId)
      toast.success(`${emp.name} can now work in ${shortBranchName(options.find((b) => b.id === grantId) || {})} with the same email.`)
      setGrantId('')
      await onChanged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (branchId, label) => {
    setErr(null)
    setBusy(true)
    try {
      await api.admin.revokeBranchAccess(emp.id, branchId)
      toast.success(`Access to ${label} revoked.`)
      await onChanged()
    } catch (e) {
      setErr(e.message)
      toast.error(e.message || 'Failed to revoke branch access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/50 p-5 dark:border-purple-800/30 dark:bg-purple-900/10">
      <div className="text-xs font-bold tracking-wider text-purple-700 dark:text-purple-300">BRANCH ACCESS</div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">One email works in every branch listed here.</p>
      <div className="mt-3 space-y-2">
        {(emp.branches || []).map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {shortBranchName({ code: b.code, name: b.name })}
              {b.is_primary ? <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Home</span> : null}
            </span>
            {canManage && !b.is_primary ? (
              <button
                type="button"
                onClick={() => revoke(b.id, shortBranchName({ code: b.code, name: b.name }))}
                disabled={busy}
                className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {canManage && options.length ? (
        <div className="mt-3 flex gap-2">
          <select
            value={grantId}
            onChange={(e) => setGrantId(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-purple-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Grant access to…</option>
            {options.map((b) => (
              <option key={b.id} value={b.id}>{shortBranchName(b)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={grant}
            disabled={busy || !grantId}
            className="rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Grant'}
          </button>
        </div>
      ) : null}
      {err ? <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div> : null}
    </div>
  )
}

// Weekly branch schedule for one clinician (booking follows the weekday).
function PractitionerSchedules({ empId, branches = [], canManage }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState('1')
  const [branchId, setBranchId] = useState(() => branches[0]?.id || '')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('17:00')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const d = await api.admin.employeeSchedules(empId)
      setSchedules(d.schedules || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId])

  const add = async () => {
    setErr(null)
    if (!branchId) {
      setErr('Choose a branch for this schedule.')
      return
    }
    setBusy(true)
    try {
      await api.admin.createEmployeeSchedule(empId, {
        clinic_id: branchId,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
      })
      toast.success('Schedule saved. Bookings on that weekday will suggest this branch.')
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setErr(null)
    try {
      await api.admin.deleteEmployeeSchedule(empId, id)
      await load()
    } catch (e) {
      setErr(e.message)
      toast.error(e.message || 'Failed to remove the schedule.')
    }
  }

  const byDay = WEEKDAYS.map((label, i) => ({ label, rows: schedules.filter((s) => Number(s.day_of_week) === i) }))

  return (
    <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/50 p-5 dark:border-purple-800/30 dark:bg-purple-900/10">
      <div className="text-xs font-bold tracking-wider text-purple-700 dark:text-purple-300">WEEKLY BRANCH SCHEDULE</div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Front Desk bookings on these weekdays suggest this branch automatically.</p>
      {loading ? (
        <div className="mt-3"><Skeleton className="h-16 w-full" /></div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {byDay.map(({ label, rows }) => (
            <div key={label} className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-slate-900">
              <span className="w-24 shrink-0 font-bold text-slate-600 dark:text-slate-300">{label}</span>
              <span className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">
                {rows.length
                  ? rows.map((s) => (
                    <span key={s.id} className="mr-1 mb-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                      {shortBranchName({ code: s.clinic_code, name: s.clinic_name })} {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                      {canManage ? (
                        <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${label} schedule`} className="font-bold hover:text-red-600">×</button>
                      ) : null}
                    </span>
                  ))
                  : <span className="text-slate-400">—</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {canManage && branches.length ? (
        <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:grid-cols-3">
          <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Weekday" className="h-10 min-w-0 rounded-lg border border-purple-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {WEEKDAYS.map((label, i) => <option key={label} value={String(i)}>{label}</option>)}
          </select>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Branch" className="h-10 min-w-0 rounded-lg border border-purple-200 bg-white px-2 text-xs sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {branches.map((b) => <option key={b.id} value={b.id}>{shortBranchName(b)}</option>)}
          </select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" className="h-10 min-w-0 rounded-lg border border-purple-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time" className="h-10 min-w-0 rounded-lg border border-purple-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          <button type="button" onClick={add} disabled={busy} className="h-10 rounded-lg bg-purple-700 px-3 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-60 min-[360px]:col-span-2 sm:col-span-1">
            {busy ? 'Saving…' : 'Add'}
          </button>
        </div>
      ) : null}
      {err ? <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div> : null}
    </div>
  )
}

function DeleteModal({ name, onConfirm, onClose }) {
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
        @keyframes em-appear { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div className="bg-white dark:bg-slate-900" style={{
        borderRadius: '28px', padding: '40px', maxWidth: '420px', width: '92%',
        textAlign: 'center', boxShadow: '0 40px 80px rgba(88, 28, 135, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.1)',
        animation: 'em-fade-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {phase === 'confirm' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Employee?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors mb-8">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">{name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors transition-all duration-200 active:scale-[0.98]">Cancel</button>
              <button onClick={doDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-200 active:scale-[0.98]">Delete</button>
            </div>
          </>
        ) : phase === 'loading' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', border: '4px solid #fee2e2', borderTopColor: '#dc2626', animation: 'em-spin 0.75s linear infinite' }} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Deleting Employee…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">Please wait.</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'em-scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none"><path d="M4.5 12.5l5 5 10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'em-check 0.5s ease 0.1s both' }}/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Deletion Successful!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors mb-6"><strong className="text-slate-900 dark:text-slate-100">{name}</strong> has been removed.</p>
          </>
        )}
      </div>
    </div>
  )
}

function RegistrationSlipModal({ created, onClose }) {
  const handlePrintSlip = () => {
    const slipHtml = `
      <html>
        <head>
          <title>Employee Registration Slip</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #1e293b; background: #f8fafc; }
            .slip { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 2px dashed #cbd5e1; }
            .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
            .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 16px; }
            .subtitle { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
            .emp-name { font-size: 24px; font-weight: 800; color: #4c1d95; margin-bottom: 32px; text-align: center; }
            .field { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #f1f5f9; }
            .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
            .val { font-size: 14px; font-weight: 700; color: #0f172a; font-family: monospace; }
            .val.highlight { color: #6d28d9; }
            .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="header">
              <div style="text-align:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div class="title">ClearMind Psychological Services</div>
                <div class="subtitle">Official Registration Slip</div>
              </div>
            </div>
            <div class="emp-name">${created.name}</div>
            <div class="field">
              <span class="label">Employee ID</span>
              <span class="val highlight">${created.employeeId}</span>
            </div>
            <div class="field">
              <span class="label">Email</span>
              <span class="val">${created.email}</span>
            </div>
            <div class="field">
              <span class="label">Temporary Password</span>
              <span class="val">${created.password}</span>
            </div>
            <div class="footer">Please keep this slip for your records.</div>
          </div>
        </body>
      </html>
    `
    // Iframe printing (see lib/printSlip): window.open is silently killed by
    // popup blockers, which is why Print Slip used to do nothing.
    if (!printSlipHtml(slipHtml)) {
      toast.error('Could not open the print dialog. Please try again.')
    }
  }

  return (
    <Modal title="Staff Registered Successfully" onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-emerald-200 bg-white dark:bg-slate-900 transition-colors p-6 shadow-sm">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-50/50 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 h-32 w-32 rounded-full bg-purple-50/50 blur-3xl"></div>
          
          <div className="relative z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 transition-colors pb-4 mb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Registration Complete</div>
              <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 transition-colors">{created.name}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors p-3 border border-slate-100 dark:border-slate-800 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">Employee ID</span>
              <span className="font-mono text-sm font-bold text-purple-700 select-all">{created.employeeId}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors p-3 border border-slate-100 dark:border-slate-800 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">Email</span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors select-all">{created.email}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors p-3 border border-slate-100 dark:border-slate-800 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">Password</span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors select-all">{created.password}</span>
            </div>
          </div>

          <div className="relative z-10 mt-5">
            {created.welcomeEmailSent ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Welcome email successfully sent.
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Welcome email failed to send. Please share credentials manually or print the slip.
              </p>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handlePrintSlip}
            className="flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            Print Slip
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SuccessModal({ name, email, title, message, loadingTitle, loadingMessage, onClose }) {
  const [phase, setPhase] = useState('loading')

  useEffect(() => {
    const t = setTimeout(() => setPhase('success'), 1800)
    return () => clearTimeout(t)
  }, [])

  const displayTitle = title || 'Account Registered!'
  const displayMessage = message || (
    <><strong style={{ color: '#0f172a' }}>{name}</strong> has been added as <span style={{ color: '#64748b' }}>{email}</span></>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76, 29, 149, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <style>{`
        @keyframes em-spin { to { transform: rotate(360deg); } }
        @keyframes em-scale-in { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes em-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes em-check { from { stroke-dashoffset: 50; } to { stroke-dashoffset: 0; } }
        @keyframes em-appear { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div style={{
        background: 'white',
        borderRadius: '28px',
        padding: '52px 40px',
        maxWidth: '420px',
        width: '92%',
        textAlign: 'center',
        boxShadow: '0 40px 80px rgba(88, 28, 135, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.1)',
        animation: 'em-fade-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          {phase === 'loading' ? (
            <div style={{
              width: '76px', height: '76px', borderRadius: '50%',
              border: '4px solid #ede9fe', borderTopColor: '#7c3aed',
              animation: 'em-spin 0.75s linear infinite',
            }} />
          ) : (
            <div style={{
              width: '76px', height: '76px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 36px rgba(124, 58, 237, 0.4)',
              animation: 'em-scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <svg viewBox="0 0 24 24" width="38" height="38" fill="none" style={{ overflow: 'visible' }}>
                <path
                  d="M4.5 12.5l5 5 10-10"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'em-check 0.5s ease 0.1s both' }}
                />
              </svg>
            </div>
          )}
        </div>
        <h2 style={{
          fontSize: '22px', fontWeight: 800, color: '#4c1d95',
          marginBottom: '8px', letterSpacing: '-0.02em',
          opacity: phase === 'loading' ? 0.5 : 1, transition: 'opacity 0.4s',
        }}>
          {phase === 'loading' ? (loadingTitle || 'Creating Account…') : displayTitle}
        </h2>
        <p style={{
          fontSize: '15px', color: '#64748b', lineHeight: 1.5, marginBottom: '32px',
          opacity: phase === 'loading' ? 0 : 1, transform: phase === 'loading' ? 'translateY(8px)' : 'translateY(0)', transition: 'all 0.5s ease 0.1s',
        }}>
          {phase === 'loading' ? (loadingMessage || 'Please wait while we set up the employee account…') : displayMessage}
        </p>
        {phase === 'success' ? (
          <div style={{ animation: 'em-appear 0.3s ease' }}>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
                color: 'white', fontWeight: 700, fontSize: '15px',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(124, 58, 237, 0.4)',
              }}
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Employees() {
  const { profile, reloadProfile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [employees, setEmployees] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(empty)
  // Tracks an explicit "Others" pick for the suffix dropdown, including the
  // not-yet-typed state where the value is still empty.
  const [suffixOthers, setSuffixOthers] = useState(false)
  const [error, setError] = useState(null)
  // Set when registration fails because the email belongs to a DEACTIVATED
  // employee — the form then offers Reactivate instead of a dead-end error.
  const [deactivatedConflict, setDeactivatedConflict] = useState(null)
  const [reactivating, setReactivating] = useState(false)
  // Set when the email already belongs to staff of ANOTHER branch — the
  // form offers one-click branch access (same email, no re-registering).
  const [branchConflict, setBranchConflict] = useState(null)
  const [grantingBranch, setGrantingBranch] = useState(false)
  const [passwordResetUserId, setPasswordResetUserId] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [licenseIdImage, setLicenseIdImage] = useState(null)
  const [successState, setSuccessState] = useState(null)
  const [deletingEmp, setDeletingEmp] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [listError, setListError] = useState(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [confirmStatus, setConfirmStatus] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)

  const [page, setPage] = useState(1)
  const [fieldErrors, setFieldErrors] = useState({})
  // Snapshot from the previous visit — frozen for this render so fresh rows
  // stay pinned until the next refresh, when they join the A–Z order.
  const [seenEmployeeIds] = useState(() => readSeenIds(EMPLOYEE_SEEN_KEY))
  const [hasEmployeeSnapshot] = useState(() => hasSeenKey(EMPLOYEE_SEEN_KEY))
  const licenseIdRef = useRef(null)
  // Branch scoping: badge shows this admin's branch; Super Admin may target
  // another branch via selector. Regular admins are locked to their own.
  const [ownClinic, setOwnClinic] = useState(null)
  const [branchOptions, setBranchOptions] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleRole = (r) =>
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
    }))

  const removeEmployee = async (id) => {
    await api.admin.deleteEmployee(id)
    setViewing(null)
    await loadList()
  }

  const updateEmployee = async (id, payload) => {
    await api.admin.updateEmployee(id, payload)
    const d = await api.admin.employees(statusFilter !== 'active', branchFilter).catch(() => null)
    if (d) {
      setEmployees(d.employees)
      const updated = d.employees.find((e) => e.id === id)
      if (updated) setViewing(updated)
    }
    // Own record changed (e.g. assigned an Employee ID to yourself): refresh
    // the session profile so the sidebar badge updates without re-login.
    if (id === profile?.id && reloadProfile) {
      await reloadProfile().catch(() => {})
    }
  }

  // Reactivate path of the status toggle (deactivation goes through
  // DeactivateModal so its reassignment gate is never skipped).
  const runStatusChange = async () => {
    if (!confirmStatus) return
    const { emp, action } = confirmStatus
    if (action !== 'reactivate') return
    setStatusBusy(true)
    try {
      await api.admin.reactivateEmployee(emp.id)
      toast.success(`${emp.name}'s account has been reactivated.`)
      setConfirmStatus(null)
      setViewing(null)
      await loadList(statusFilter !== 'active')
    } catch (e) {
      toast.error(e.message || 'Failed to update account status.')
    } finally {
      setStatusBusy(false)
    }
  }

  const refreshEmployee = async (id) => {
    const d = await api.admin.employees(statusFilter !== 'active', branchFilter).catch(() => null)
    if (d) {
      setEmployees(d.employees)
      const updated = d.employees.find((e) => e.id === id)
      if (updated) setViewing(updated)
    }
    if (id === profile?.id && reloadProfile) {
      await reloadProfile().catch(() => {})
    }
  }

  const loadList = (showDisabled = statusFilter !== 'active', branch = branchFilter) =>
    api.admin
      .employees(showDisabled, branch)
      .then((d) => {
        setEmployees(d.employees)
        setListError(null)
      })
      .catch((e) => setListError(e.message))
  useEffect(() => {
    setLoadingList(true)
    loadList().finally(() => setLoadingList(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, branchFilter])

  // Remember every displayed row so the next visit/refresh treats them as
  // already seen (no separate "mark as read" click needed).
  useEffect(() => {
    if (!employees.length) return
    rememberIds(EMPLOYEE_SEEN_KEY, employees.map((e) => e.id).filter(Boolean))
  }, [employees])

  useEffect(() => {
    // Branch badge for everyone; branch list for Super Admin only (backend
    // 403s other roles, so a tampered UI can never list other branches).
    api.admin.clinic()
      .then((data) => {
        if (data?.clinic) {
          setOwnClinic(data.clinic)
          setSelectedBranchId((prev) => prev || data.clinic.id || '')
        }
      })
      .catch(() => {})
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLicenseId = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Professional licensed ID must be a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Professional licensed ID must be 5 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLicenseIdImage(reader.result)
    reader.readAsDataURL(file)
  }

  const validateForm = () => {
    const next = {}
    const email = form.email.trim()
    const firstName = form.first_name.trim()
    const middleName = form.middle_name.trim()
    const lastName = form.last_name.trim()
    const suffixName = form.suffix_name?.trim() || ''
    const employeeId = form.employee_id.trim()
    const position = form.position.trim()
    const licenseNo = form.license_no.trim()
    const profession = form.title.trim()
    const phone = form.phone.trim()
    const phoneDigits = normalizePHMobile(phone)
    const staffSelected = form.roles.some(isStaff)

    if (!email) next.email = 'Email address is required.'
    else if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address.'
    else if (email.length > MAX.email) next.email = `Email must be ${MAX.email} characters or fewer.`

    if (!firstName) next.first_name = 'First name is required.'
    else if (firstName.length > MAX.name) next.first_name = `First name must be ${MAX.name} characters or fewer.`

    if (!lastName) next.last_name = 'Last name is required.'
    else if (lastName.length > MAX.name) next.last_name = `Last name must be ${MAX.name} characters or fewer.`

    if (middleName.length > MAX.name) next.middle_name = `Middle name must be ${MAX.name} characters or fewer.`
    if (suffixName.length > MAX.name) next.suffix_name = `Suffix name must be ${MAX.name} characters or fewer.`
    const suffixIsOthers = suffixOthers || (suffixName !== '' && !SUFFIX_OPTIONS.includes(suffixName))
    if (suffixIsOthers && !suffixName) next.suffix_name = 'Please specify the suffix name.'
    if (phone && !PH_MOBILE_RE.test(phoneDigits)) next.phone = 'Use a valid Philippine mobile number like 0917 123 4567.'

    if (form.roles.length === 0) next.roles = 'Select at least one role.'

    if (form.roles.includes('admin') || form.roles.includes('super_admin')) {
      if (employeeId.length > MAX.employeeId) next.employee_id = `Employee ID must be ${MAX.employeeId} characters or fewer.`
      if (position.length > MAX.position) next.position = `Position must be ${MAX.position} characters or fewer.`
    }

    if (staffSelected) {
      if (!licenseNo) next.license_no = 'PRC License No. is required for staff roles.'
      else if (licenseNo.length > MAX.licenseNo) next.license_no = `PRC License No. must be ${MAX.licenseNo} characters or fewer.`

      if (!profession) next.title = 'Profession is required for staff roles.'
      else if (profession.length > MAX.profession) next.title = `Profession must be ${MAX.profession} characters or fewer.`

      if (!licenseIdImage) next.license_id_image = 'Professional licensed ID is required for staff roles.'
    }

    return next
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setDeactivatedConflict(null)
    const nextErrors = validateForm()
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setError('Please fix the highlighted fields before registering this employee.')
      return
    }
    const email = form.email.trim()
    const first_name = form.first_name.trim()
    const middle_name = form.middle_name.trim()
    const last_name = form.last_name.trim()
    const suffix_name = form.suffix_name?.trim() || ''
    const phone = form.phone.trim()
    const employee_id = form.employee_id.trim()
    const position = form.position.trim()
    const license_no = form.license_no.trim()
    const title = form.title.trim()
    const [primaryRole, ...extraRoles] = form.roles
    const password = generatePassword()
    setSubmitting(true)
    try {
      const resp = await api.admin.createEmployee({
        email,
        password,
        first_name,
        middle_name,
        last_name,
        suffix_name,
        role: primaryRole,
        extra_roles: extraRoles,
        // Branch scoping: only Super Admin may target another branch.
        // "All Branches" leaves clinic_id unset (employee not bound to one branch).
        // Regular admins omit this and land in their own clinic server-side.
        ...(isSuperAdmin && selectedBranchId && selectedBranchId !== 'all' ? { clinic_id: selectedBranchId } : {}),
        phone,
        employee_id,
        position,
        license_no,
        title,
        avatar,
        license_id_image: licenseIdImage,
      })
      setForm(empty)
      setSuffixOthers(false)
      setAvatar(null)
      setLicenseIdImage(null)
      setFieldErrors({})
      setShowForm(false)
      setSuccessState({
        isSlip: true,
        name: [first_name, middle_name, last_name, suffix_name].filter(Boolean).join(' '),
        email,
        password,
        employeeId: resp.employee_id || '-',
        welcomeEmailSent: resp.welcome_email_sent 
      })
      await loadList()
    } catch (err) {
      // Deactivated-email conflict: keep the message but attach the employee
      // so the form can offer a one-click Reactivate instead.
      if (err.details?.code === 'EMPLOYEE_DEACTIVATED' && err.details?.employee?.id) {
        setDeactivatedConflict(err.details.employee)
      } else {
        setDeactivatedConflict(null)
      }
      // Other-branch conflict: offer one-click branch access on the same
      // email instead of a dead-end error.
      if (err.details?.code === 'EMAIL_OTHER_CLINIC' && err.details?.employee?.id) {
        setBranchConflict(err.details.employee)
      } else {
        setBranchConflict(null)
      }
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const grantBranchConflict = async () => {
    if (!branchConflict?.id) return
    const targetBranch = selectedBranchId || ownClinic?.id || ''
    if (!targetBranch) {
      toast.error('Could not determine this branch. Reload and try again.')
      return
    }
    setGrantingBranch(true)
    try {
      await api.admin.grantBranchAccess(branchConflict.id, targetBranch)
      toast.success(`${branchConflict.name || 'The account'} can now work in this branch with the same email.`)
      setBranchConflict(null)
      setError(null)
      setShowForm(false)
      await loadList(true)
    } catch (e) {
      toast.error(e.message || 'Failed to grant branch access.')
    } finally {
      setGrantingBranch(false)
    }
  }

  const reactivateConflict = async () => {
    if (!deactivatedConflict?.id) return
    setReactivating(true)
    try {
      await api.admin.reactivateEmployee(deactivatedConflict.id)
      toast.success(`${deactivatedConflict.name || 'The account'} has been reactivated.`)
      setDeactivatedConflict(null)
      setError(null)
      setShowForm(false)
      await loadList(true)
    } catch (e) {
      toast.error(e.message || 'Failed to reactivate the account.')
    } finally {
      setReactivating(false)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = employees.filter((e) => {
    if (!isSuperAdmin && e.role === 'super_admin') return false
    const matchesQ =
      !q || (e.name || '').toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q)
    // A role filter matches anyone who HOLDS the role — primary `role`
    // or any of `extra_roles` (same as candidatesFor below). Filtering on
    // primary only hid every dual-role holder (e.g. RPsy stored as extra).
    const matchesRole = roleFilter === 'all' || [e.role, ...(e.extra_roles || [])].includes(roleFilter)
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'deactivated' ? !!e.is_disabled : !e.is_disabled)
    return matchesQ && matchesRole && matchesStatus
  })
    // Unseen updates pinned on top (newest first), the rest alphabetical.
    // No unseen rows → pure A–Z, so a refresh after seeing the update
    // settles the list into alphabetical order automatically.
    .sort((a, b) => {
      const aNew = hasEmployeeSnapshot && !seenEmployeeIds.has(a.id)
      const bNew = hasEmployeeSnapshot && !seenEmployeeIds.has(b.id)
      if (aNew !== bNew) return aNew ? -1 : 1
      if (aNew && bNew) return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      // Match the displayed "LAST, FIRST M." order in the table.
      return employeeListName(a).localeCompare(employeeListName(b))
    })
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleExport = () => {
    if (!filtered || filtered.length === 0) {
      toast.error('No employee records to export.')
      return
    }
    const headers = ['Employee ID', 'Name', 'Email', 'Phone', 'Primary Role', 'Extra Roles', 'License No', 'Profession', 'Joined']
    const csvRows = filtered.map((e) => [
      e.employee_id || '—',
      e.name,
      e.email,
      e.phone || '—',
      ROLE_META[e.role]?.label || e.role,
      (e.extra_roles || []).map((x) => ROLE_META[x]?.label || x).join('; '),
      e.license_no || '—',
      e.staff_title || '—',
      fmtDate(e.created_at),
    ])
    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `employees_export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <StaffHeader title="Employees" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="employees-workspace">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Employee Management</h1>
            <PageSubtitle>
              Registered clinicians, therapists, and administrators.
            </PageSubtitle>
          </div>
          <Button
            data-onboarding-key="employee-register"
            onClick={() => {
              setError(null)
              setFieldErrors({})
              setSuffixOthers(false)
              setShowForm(true)
            }}
          >
            Register Employee
          </Button>
        </div>


        {listError ? (
          <div className="mt-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Couldn&apos;t load employees: {listError}
          </div>
        ) : null}

        {successState ? (
          successState.isSlip ? (
            <RegistrationSlipModal 
              created={successState} 
              onClose={() => setSuccessState(null)} 
            />
          ) : (
            <SuccessModal
              name={successState.name}
              email={successState.email}
              title={successState.title}
              message={successState.message}
              loadingTitle={successState.loadingTitle}
              loadingMessage={successState.loadingMessage}
              onClose={() => setSuccessState(null)}
            />
          )
        ) : null}

        {deletingEmp ? (
          <DeleteModal
            name={deletingEmp.name}
            onClose={() => setDeletingEmp(null)}
            onConfirm={() => removeEmployee(deletingEmp.id)}
          />
        ) : null}

        {showForm ? (
          <Modal
            title="Register Employee"
            subtitle="Create a clinician, therapist, or administrator account"
            onClose={() => setShowForm(false)}
            footer={
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" form="register-employee-form" size="lg" disabled={submitting}>
                  {submitting ? 'Registering…' : 'Register Employee'}
                </Button>
              </div>
            }
          >
            <form id="register-employee-form" onSubmit={submit} className="space-y-5" autoComplete="off">
              {ownClinic?.name ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                  {isSuperAdmin && branchOptions.length > 1 ? (
                    <>
                      <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Register to:</span>
                      <select
                        aria-label="Register to branch"
                        className="ml-auto rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                      >
                      <option value="all" className="bg-white font-bold text-purple-700">
                        All Branches
                      </option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>{branchOptionLabel(b)}</option>
                      ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Branch:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{ownClinic.name}</span>
                    </>
                  )}
                </div>
              ) : null}
              <section className="flex items-center gap-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-300 via-purple-500 to-purple-300" />
                <PhotoCapture value={avatar} onChange={(value) => { setAvatar(value); setError(null) }} />
                <div>
                  <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">Profile Photo</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 transition-colors">
                    Use the camera button to take a webcam photo, or upload an image.
                    <br />JPG, PNG, or WEBP — optional.
                  </div>
                </div>
              </section>

              <Section title="Account" hint="Used to sign in to the portal">
                <div className="space-y-1.5">
                  <Input
                    label="Email address"
                    type="email"
                    tone="purple"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    autoComplete="new-email"
                    name="employee-email"
                    maxLength={MAX.email}
                    inputMode="email"
                  />
                  {fieldErrors.email ? <div className="text-xs text-red-600">{fieldErrors.email}</div> : null}
                </div>
                <div className="space-y-1.5">
                  <Input
                    label="Phone (optional)"
                    tone="purple"
                    value={form.phone}
                    onChange={(e) => set('phone', formatPHMobile(e.target.value))}
                    maxLength={MAX.phone}
                    inputMode="tel"
                    placeholder="09** *** ****"
                  />
                  {fieldErrors.phone ? <div className="text-xs text-red-600">{fieldErrors.phone}</div> : null}
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-200 dark:border-slate-700 transition-colors px-4 py-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">✦</div>
                    <div>
                      <div className="text-xs font-semibold text-purple-800 dark:text-purple-300 transition-colors">Temporary password will be auto-generated</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-0.5 leading-relaxed">A secure 12-character password will be created and emailed to the employee along with their login instructions.</div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Profile" hint="Identity and role within the clinic">
                <div className="space-y-1.5">
                  <Input
                    label="First Name"
                    tone="purple"
                    value={form.first_name}
                    onChange={(e) => set('first_name', sanitizeNameInput(e.target.value))}
                    maxLength={MAX.name}
                  />
                  {fieldErrors.first_name ? <div className="text-xs text-red-600">{fieldErrors.first_name}</div> : null}
                </div>
                <div className="space-y-1.5">
                  <Input
                    label="Middle Name (optional)"
                    tone="purple"
                    value={form.middle_name}
                    onChange={(e) => set('middle_name', sanitizeNameInput(e.target.value))}
                    maxLength={MAX.name}
                  />
                  {fieldErrors.middle_name ? <div className="text-xs text-red-600">{fieldErrors.middle_name}</div> : null}
                </div>
                <div className="space-y-1.5">
                  <Input
                    label="Last Name"
                    tone="purple"
                    value={form.last_name}
                    onChange={(e) => set('last_name', sanitizeNameInput(e.target.value))}
                    maxLength={MAX.name}
                  />
                  {fieldErrors.last_name ? <div className="text-xs text-red-600">{fieldErrors.last_name}</div> : null}
                </div>
                <SuffixField
                  value={form.suffix_name || ''}
                  others={suffixOthers}
                  onPick={(choice) => {
                    if (choice === 'Others') {
                      setSuffixOthers(true)
                    } else {
                      setSuffixOthers(false)
                      set('suffix_name', choice)
                    }
                  }}
                  onCustomChange={(text) => set('suffix_name', text)}
                  error={fieldErrors.suffix_name}
                />
                <div className="sm:col-span-2">
                  <div className="mb-3">
                    <div className="text-xs font-semibold tracking-wider text-purple-700 uppercase">
                      Roles <span className="normal-case font-normal text-slate-400">(select at least one)</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-0.5">Assign every role this employee will hold.</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {ROLES.filter(r => {
                        // Super admin role is only shown to super admins
                        if (r.value === 'super_admin') return isSuperAdmin
                        // Admin role can only be registered by super admins
                        if (r.value === 'admin') return isSuperAdmin
                        return true
                      }).map((r) => {
                      const selected = form.roles.includes(r.value)
                      const selectedClass = {
                        admin: 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-100',
                        super_admin: 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200',
                        psychologist: 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-100',
                        psychometrician: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100',
                      }[r.value] || 'bg-purple-600 text-white border-purple-600'
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => toggleRole(r.value)}
                          className={`flex items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-semibold transition-all duration-150 cursor-pointer ${
                            selected
                              ? `${selectedClass} scale-105`
                              : 'border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-500 dark:text-slate-400 transition-colors hover:border-purple-300 hover:text-purple-700'
                          }`}
                        >
                          {selected ? (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                              <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                  {fieldErrors.roles ? <div className="mt-2 text-xs text-red-600">{fieldErrors.roles}</div> : null}
                </div>
              </Section>

              {form.roles.includes('admin') || form.roles.includes('super_admin') ? (
                <Section title="Administrator Details" hint="Stored on the admin profile">
                  <div className="space-y-1.5">
                    <Input
                      label="Employee ID (Leave blank to auto-generate)"
                      tone="purple"
                      value={form.employee_id}
                      onChange={(e) => set('employee_id', e.target.value)}
                      maxLength={MAX.employeeId}
                    />
                    {fieldErrors.employee_id ? <div className="text-xs text-red-600">{fieldErrors.employee_id}</div> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      label="Position"
                      tone="purple"
                      value={form.position}
                      onChange={(e) => set('position', e.target.value)}
                      maxLength={MAX.position}
                    />
                    {fieldErrors.position ? <div className="text-xs text-red-600">{fieldErrors.position}</div> : null}
                  </div>
                </Section>
              ) : null}

              {form.roles.some(isStaff) ? (
                <Section title="Professional Credentials" hint="Stored on the staff record">
                  <div className="space-y-1.5">
                    <Input
                      label="PRC License No."
                      tone="purple"
                      value={form.license_no}
                      onChange={(e) => set('license_no', e.target.value)}
                      maxLength={MAX.licenseNo}
                    />
                    {fieldErrors.license_no ? <div className="text-xs text-red-600">{fieldErrors.license_no}</div> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      label="Profession (e.g. Clinical Psychologist)"
                      tone="purple"
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      maxLength={MAX.profession}
                    />
                    {fieldErrors.title ? <div className="text-xs text-red-600">{fieldErrors.title}</div> : null}
                  </div>
                  <div className="sm:col-span-2 mt-2">
                    <div className="text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 mb-1">Professional Licensed ID</div>
                    <div className="flex items-center gap-4 rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 dark:bg-slate-800 p-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-slate-900 transition-colors ring-1 ring-purple-200 dark:ring-slate-600">
                        {licenseIdImage ? (
                          <img src={licenseIdImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-8 w-8 text-purple-400" fill="none">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => licenseIdRef.current?.click()}
                          className="rounded-md border border-purple-200 dark:border-slate-600 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                        >
                          {licenseIdImage ? 'Change Image' : 'Upload Image'}
                        </button>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">Upload a photo of the professional license ID for verification</div>
                      </div>
                      <input
                        ref={licenseIdRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={onLicenseId}
                        className="hidden"
                      />
                    </div>
                    {fieldErrors.license_id_image ? <div className="mt-1 text-xs text-red-600">{fieldErrors.license_id_image}</div> : null}
                  </div>
                </Section>
              ) : null}

              {error ? (
                <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                  {deactivatedConflict ? (
                    <button
                      type="button"
                      onClick={reactivateConflict}
                      disabled={reactivating}
                      className="mt-2 w-full rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-800 disabled:opacity-60"
                    >
                      {reactivating ? 'Reactivating…' : `Reactivate ${deactivatedConflict.name || 'account'} instead`}
                    </button>
                  ) : null}
                  {branchConflict ? (
                    <button
                      type="button"
                      onClick={grantBranchConflict}
                      disabled={grantingBranch}
                      className="mt-2 w-full rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-800 disabled:opacity-60"
                    >
                      {grantingBranch ? 'Granting…' : `Grant ${branchConflict.name || 'account'} access to this branch instead`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </form>
          </Modal>
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
                placeholder="Search by name or email…"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={handleExport}
                className="cymon-export-btn shrink-0 self-start sm:self-center"
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
              <AnimatedSelect
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...ROLES.map((r) => ({ value: r.value, label: ROLE_META[r.value]?.label || r.label }))
                ]}
              />
              <AnimatedSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val)
                  setPage(1)
                }}
                options={[
                  { value: 'active', label: 'Active Accounts' },
                  { value: 'deactivated', label: 'Deactivated' },
                  { value: 'all', label: 'All Statuses' },
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
          </div>
        </section>

        <div className="mt-5 flex gap-6 lg:gap-0">
          <section className="min-w-0 flex-1 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm transition-all duration-300">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-400">
                    <th className="py-3 px-4 text-left">Employee</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Employee ID</th>
                    <th className="py-3 px-4 text-left">Role</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">License / PRC</th>
                    <th className="py-3 px-4 text-left">Profession</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Joined</th>
                    <th className="py-3 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody key={loadingList ? 'loading' : 'loaded'} className="divide-y divide-purple-100 animate-content-fade-in">
                  {loadingList
                    ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="py-3 px-4">
                          <Skeleton className="h-11 w-full" />
                        </td>
                      </tr>
                    ))
                    : null}
                  {!loadingList && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 px-4 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                        {employees.length === 0
                          ? 'No employees registered yet.'
                          : 'No employees match your search.'}
                      </td>
                    </tr>
                  ) : null}
                  {!loadingList &&
                    pageRows.map((emp) => {
                      const isSelected = viewing && viewing.id === emp.id
                      return (
                        <tr
                          key={emp.id}
                          className={isSelected ? 'bg-purple-100/70 dark:bg-purple-900/40 transition-colors font-medium' : 'hover:bg-purple-50/50 dark:hover:bg-slate-800 transition-colors'}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                                {emp.avatar_url ? (
                                  <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  initialsOf(emp.name)
                                )}
                              </div>
                              <div>
                                <div className="max-w-[16rem] truncate whitespace-nowrap font-medium uppercase text-slate-800 dark:text-slate-100 transition-colors" title={emp.name}>
                                  {employeeListName(emp)}{' '}
                                  {hasEmployeeSnapshot && !seenEmployeeIds.has(emp.id) ? (
                                    <span className="ml-1 rounded-full bg-purple-700 px-2 py-0.5 text-[10px] font-bold normal-case text-white">
                                      New
                                    </span>
                                  ) : null}
                                  {emp.is_disabled ? (
                                    <span className="ml-1 rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                      Deactivated
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{emp.email}</div>
                                {emp.branches?.length ? (
                                  <div className="mt-1">
                                    <BranchChips branches={emp.branches} />
                                  </div>
                                ) : isSuperAdmin && emp.clinic_name ? (
                                  <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                    {shortBranchName({ code: emp.clinic_code, name: emp.clinic_name })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex max-w-[9rem] truncate font-mono text-xs font-semibold text-purple-700 dark:text-purple-400 align-middle">
                              {emp.employee_id || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <RoleChips role={emp.role} extra={emp.extra_roles} disabled={emp.disabled_roles} />
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-200 transition-colors">{emp.license_no || '—'}</td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-200 transition-colors">{emp.title || '—'}</td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 transition-colors">{fmtDate(emp.created_at)}</td>
                          <td className="py-3 px-4">
                            <RowAction variant="view" onClick={() => { if (emp?.id) rememberIds(EMPLOYEE_SEEN_KEY, [emp.id]); setViewing(emp) }}>
                              View
                            </RowAction>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </section>

          {viewing ? (
            <EmployeeDetailModal
              emp={viewing}
              onClose={() => setViewing(null)}
              onDeleteClick={(emp) => setDeletingEmp(emp)}
              onStatusClick={(emp) => setConfirmStatus({ emp, action: emp.is_disabled ? 'reactivate' : 'deactivate' })}
              onUpdateEmployee={updateEmployee}
              onOverridePassword={(emp) => setPasswordResetUserId({ id: emp.id, name: emp.name, email: emp.email })}
              isSuperAdmin={profile?.role === 'super_admin'}
              branches={branchOptions}
              allEmployees={employees}
              grantableBranches={profile?.role === 'super_admin' ? branchOptions : (ownClinic ? [ownClinic] : [])}
              onChanged={() => refreshEmployee(viewing.id)}
            />
          ) : null}
          {confirmStatus?.action === 'deactivate' ? (
            <DeactivateModal
              emp={confirmStatus.emp}
              employees={employees}
              onClose={() => (setConfirmStatus(null))}
              onDone={async () => {
                setConfirmStatus(null)
                setViewing(null)
                await loadList(statusFilter !== 'active')
              }}
            />
          ) : null}
          {confirmStatus?.action === 'reactivate' ? (
            <Modal
              title="Reactivate Account?"
              subtitle={confirmStatus.emp.name}
              onClose={() => (statusBusy ? null : setConfirmStatus(null))}
              footer={
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmStatus(null)}
                    disabled={statusBusy}
                    className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <Button size="lg" disabled={statusBusy} onClick={runStatusChange}>
                    {statusBusy ? 'Saving…' : 'Reactivate'}
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-slate-600 dark:text-slate-300 transition-colors">
                This account will be allowed to sign in again immediately.
              </p>
            </Modal>
          ) : null}
          {passwordResetUserId ? (
            <AdminChangePasswordModal
              userId={passwordResetUserId.id}
              userName={passwordResetUserId.name}
              currentEmail={passwordResetUserId.email}
              onClose={() => setPasswordResetUserId(null)}
              onSaved={() => {
                const name = passwordResetUserId.name
                setPasswordResetUserId(null)
                setSuccessState({
                  title: 'Account Updated!',
                  message: <><strong style={{ color: '#0f172a' }}>{name}'s</strong> login credentials have been successfully updated.</>,
                  loadingTitle: 'Updating Account…',
                  loadingMessage: `Please wait while we securely update the credentials…`
                })
              }}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}

function AdminChangePasswordModal({ userId, userName, currentEmail = '', onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // Placeholder/system accounts have no real email to change.
  const canEditEmail = Boolean(currentEmail) && !currentEmail.startsWith('noemail_')

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!email && !password) {
      setErr('Please provide an email or password to update.')
      return
    }
    const payload = {}
    if (canEditEmail && email) payload.email = email.trim()
    if (password) {
      const pwErr = passwordError(password)
      if (pwErr) {
        setErr(pwErr)
        return
      }
      if (password !== confirm) {
        setErr('Passwords do not match.')
        return
      }
      payload.password = password
    }
    if (Object.keys(payload).length === 0) {
      setErr('Please provide an email or password to update.')
      return
    }
    setBusy(true)
    try {
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
      title="Manage Account"
      subtitle={`Update login credentials for ${userName}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors">
            Cancel
          </button>
          <Button type="submit" form="change-user-pw-form" size="lg" disabled={busy}>
            {busy ? 'Updating…' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form id="change-user-pw-form" onSubmit={submit} className="space-y-4">
        {canEditEmail ? (
          <Input
            label="Email Address"
            type="email"
            tone="purple"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={currentEmail || 'Leave blank to keep existing'}
          />
        ) : null}
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
          placeholder="Repeat the new password"
        />
        {err ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div> : null}
      </form>
    </Modal>
  )
}

export default Employees
