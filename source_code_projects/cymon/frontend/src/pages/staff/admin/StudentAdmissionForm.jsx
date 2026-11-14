import { useState, useEffect } from 'react'
import Radio from '../../../components/ui/Radio'
import FormShell from '../../../components/ui/FormShell'
import Modal from '../../../components/ui/Modal'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import PhotoCapture from '../../../components/ui/PhotoCapture'
import SignaturePad from '../../../components/ui/SignaturePad'
import DatePicker from '../../../components/ui/DatePicker'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Button from '../../../components/ui/Button'
import { api, saveBlob } from '../../../lib/api'
import { branchOptionLabel } from '../../../lib/branches'
import { useAuth } from '../../../auth/useAuth'
import { toast } from 'react-hot-toast'
import {
  OTHER_VALUE,
  PH_BIRTH_PLACES,
  PH_PROVINCE_CITIES,
  EMERGENCY_RELATIONS,
  CITIZENSHIPS,
  RELIGIONS,
  splitOption,
  finalOption,
  splitBirthplace,
  finalBirthplace,
} from '../../../lib/admissionOptions'
import { capitalizeName, formatLastFirstMI } from '../../../lib/format'
import { printSlipHtml } from '../../../lib/printSlip'
import { passwordError } from '../../../lib/password'
import PasswordChecklist from '../../../components/ui/PasswordChecklist'
import { SUFFIX_OPTIONS, SUFFIX_OTHERS, suffixChoiceOf } from '../../../lib/suffix'

const ENROLLMENT = [
  { value: 'HSN', code: 'HSN', color: '#B4524A', label: 'Higher Support Needs Program', detail: '48 hours per month' },
  { value: 'MSN', code: 'MSN', color: '#B8873A', label: 'Moderate Support Needs Program', detail: '36 hours per month' },
  { value: 'LSN', code: 'LSN', color: '#5B8C6E', label: 'Low Support Needs Program', detail: '24 hours per month' },
  { value: 'Individual', code: 'IND', color: '#3457A6', label: 'Individual Session', detail: '' },
]

const genPassword = () => {
  // Same unambiguous charset (no 0/O/1/l). Guarantee at least one char
  // from each class so generated passwords always satisfy the policy.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const pool = `${upper}${lower}${digits}`
  const pick = (s) => s[Math.floor(Math.random() * s.length)]
  const chars = [pick(upper), pick(lower), pick(digits)]
  for (let i = chars.length; i < 10; i += 1) chars.push(pick(pool))
  // Fisher-Yates shuffle so the guaranteed classes aren't positionally fixed.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// Unicode letters (ñ, é, …), spaces, and common name punctuation only — no digits or symbols.
const sanitizeName = (val) => val.replace(/[^\p{L}\s.\-']/gu, '')

// Philippine mobile: accepts 09XX or +63 9XX input, stores as "09XX XXX XXXX".
const formatPHMobile = (raw) => {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('63')) d = `0${d.slice(2)}`
  d = d.slice(0, 11)
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' ')
}

// A filled PH mobile must be 11 digits starting with 09.
const isValidPHMobile = (val) => /^09\d{9}$/.test(val.replace(/\D/g, ''))

const Card = ({ eyebrow, title, children }) => (
  <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
    <h3 className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-purple-950 dark:text-purple-300 transition-colors">
      <span className="rounded-full bg-purple-50 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-purple-600 dark:text-purple-400 transition-colors">{eyebrow}</span>
      {title}
    </h3>
    {children}
  </div>
)

const Field = ({ label, children, hint }) => (
  <div className="flex h-full flex-col">
    {/* Label zone fits two lines with text pinned to the bottom: a two-line
        label (e.g. "Place of Birth (Province)") no longer pushes its input
        below its one-line row-mates. */}
    <label className="mb-1.5 flex min-h-8 items-end text-[11.5px] leading-4 font-semibold uppercase tracking-wider text-purple-900 dark:text-purple-400 transition-colors">
      {label}
    </label>
    <div>{children}</div>
    {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
  </div>
)

const inputCls = 'w-full rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 transition-colors placeholder-slate-400 focus:border-purple-400 dark:focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/20'
const todayISO = () => new Date().toISOString().slice(0, 10)

const getPrimaryGuardian = (guardians = [], relationship) =>
  guardians.find((g) => g.relationship === relationship) || guardians[relationship === 'Mother' ? 0 : 1] || {}

// Local autosave draft (Google-Forms-like safety net): the admission form
// creates records only on submit, so an interrupted session (brownout, dead
// tab, weak internet) would otherwise lose everything. Persisting to
// localStorage survives all of those with no backend changes.
const ADMISSION_DRAFT_KEY = 'cymon.admissionDraft.v1'
const readAdmissionDraft = () => {
  try {
    const raw = localStorage.getItem(ADMISSION_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.f || typeof parsed.f !== 'object') return null
    return parsed
  } catch {
    return null
  }
}
const draftHasContent = (draft) =>
  !!draft && !!draft.f && Object.values(draft.f).some((v) => typeof v === 'string' ? v.trim() !== '' : v != null && v !== false)
const removeAdmissionDraft = () => {
  try {
    localStorage.removeItem(ADMISSION_DRAFT_KEY)
  } catch {
    // Private mode / quota — autosave is best-effort only.
  }
}

const buildFormState = (detail = null) => {
  const patient = detail?.patient || {}
  const clinical = detail?.clinical || {}
  const guardians = detail?.guardians || []
  const mother = getPrimaryGuardian(guardians, 'Mother')
  const father = getPrimaryGuardian(guardians, 'Father')
  const emergency = detail?.emergency || {}
  const sameAddress = patient.home_address && patient.permanent_address
    ? patient.home_address === patient.permanent_address
    : null

  const pob = splitBirthplace(patient.place_of_birth)
  const cit = splitOption(CITIZENSHIPS, patient.citizenship)
  const rel = splitOption(RELIGIONS, patient.religion)
  const erl = splitOption(EMERGENCY_RELATIONS, emergency.relationship)

  return {
    lastName: patient.last_name || '',
    firstName: patient.first_name || '',
    middleName: patient.middle_name || '',
    suffixName: patient.suffix_name || '',
    birthdate: patient.date_of_birth || '',
    sex: patient.sex || '',
    nickName: patient.nick_name || '',
    presentAddress: patient.home_address || '',
    placeOfBirth: pob.province,
    placeOfBirthOther: pob.provinceOther,
    placeOfBirthCity: pob.city,
    placeOfBirthCityOther: pob.cityOther,
    citizenship: cit.select,
    citizenshipOther: cit.other,
    religion: rel.select,
    religionOther: rel.other,
    motherName: mother.full_name || '',
    motherOccupation: mother.occupation || '',
    motherMobile: mother.contact_number || '',
    motherEmail: mother.email || '',
    fatherName: father.full_name || '',
    fatherOccupation: father.occupation || '',
    fatherMobile: father.contact_number || '',
    fatherEmail: father.email || '',
    emergencyName: emergency.full_name || '',
    emergencyContact: emergency.contact_number || '',
    emergencyRelation: erl.select,
    emergencyRelationOther: erl.other,
    diagnosis: clinical.primary_diagnosis || '',
    disability: clinical.secondary_diagnosis || '',
    allergies: clinical.allergies || '',
    iepLevel: clinical.iep_level || '',
    accountEmail: detail?.caregiver?.email || mother.email || father.email || '',
    accountHandlerName: detail?.caregiver?.display_name || mother.full_name || father.full_name || '',
    accountPassword: genPassword(),
    permanentAddress: patient.permanent_address || '',
    previouslyDiagnosed: patient.previously_diagnosed ?? null,
    sameAddressPresentPermanent: sameAddress,
    otherDisability: patient.other_disability ?? null,
    parentSignature: patient.parent_signature || null,
    parentPrintedName: patient.parent_printed_name || mother.full_name || '',
    parentSignatureDate: todayISO(),
    repSignature: patient.rep_signature || null,
    repPrintedName: patient.rep_printed_name || detail?.patient?.treating_psychometrician?.display_name || detail?.patient?.treating_psychologist?.display_name || '',
    repSignatureDate: todayISO(),
    treating_psychologist_id: patient.treating_psychologist_id || '',
    treating_psychometrician_id: patient.treating_psychometrician_id || '',
  }
}

const TogglePill = ({ options, value, onChange }) => (
  <div className="flex gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? null : opt)}
        className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${value === opt
          ? 'border-purple-400 bg-purple-50 text-purple-800 dark:text-purple-300 transition-colors'
          : 'border-purple-200 dark:border-slate-700 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:border-purple-300 hover:bg-purple-50/50'
          }`}
      >
        {opt}
      </button>
    ))}
  </div>
)

const RadioCard = ({ color, code, label, detail, checked, onChange }) => (
  <Radio
    name="enrollment"
    checked={checked}
    onChange={onChange}
    colorClass="border-purple-400 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500"
    unselectedClass="border-purple-200 dark:border-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-slate-800"
    className="rounded-lg p-3 w-full"
    label={
      <div className="flex items-center gap-3 w-full">
        <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
          {code}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors">{label}</div>
          <div className={`text-[11px] ${detail ? 'text-slate-500 dark:text-slate-400 transition-colors' : 'opacity-0 select-none'}`}>
            {detail || '\u00A0'}
          </div>
        </div>
      </div>
    }
  />
)

// Success slip rendered by PARENTS (Patients / Applications), not inside the
// admission form: the parent closes the big admission modal on success, so no
// stale form is left stacked behind this slip.
export function StudentRegisteredSlipModal({ created, onClose }) {
  if (!created) return null
  const handlePrintSlip = () => {
    const slipHtml = `
      <html>
        <head>
          <title>Student Registration Slip - ${created.name}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; }
            .slip { border: 2px dashed #cbd5e1; border-radius: 16px; padding: 32px; }
            .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
            .clinic-name { font-weight: 700; font-size: 18px; color: #6b21a8; margin-bottom: 4px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 16px; align-items: center; }
            .label { font-size: 14px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
            .value { font-size: 18px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; line-height: 1.5; }
            @media print {
              body { padding: 0; }
              .slip { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="header">
              <div class="clinic-name">ClearMind Psychological Services</div>
              <h1 class="title">Registration Slip</h1>
              <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Please keep these credentials secure.</div>
            </div>
            <div class="row">
              <span class="label">Student Name</span>
              <span class="value" style="font-family: inherit;">${created.name}</span>
            </div>
            <div class="row">
              <span class="label">Student User ID</span>
              <span class="value">${created.patientId}</span>
            </div>
            ${created.hasEmail ? `
            <div class="row" style="margin-top: 32px;">
              <span class="label">Parent Login Email</span>
              <span class="value">${created.email}</span>
            </div>
            ` : `
            <div style="margin-top: 32px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 13px; color: #1e40af; margin-bottom: 16px;">
              <strong>No email address provided.</strong> The student can log in using their Student Number and Password.
            </div>
            `}
            <div class="row">
              <span class="label">${created.hasEmail ? 'Parent Password' : 'Password'}</span>
              <span class="value">${created.password}</span>
            </div>
            <div class="footer">
              <p>You can use these credentials to log in to cymon-clearmindpsychologicalservices.vercel.app<br>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
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
    <Modal title="Student Registered Successfully" onClose={onClose} maxWidth="max-w-md">
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
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">Student ID</span>
              <span className="font-mono text-sm font-bold text-purple-700 select-all">{created.patientId}</span>
            </div>
            {created.hasEmail && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors p-3 border border-slate-100 dark:border-slate-800 transition-colors">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">Parent Email</span>
                <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors select-all">{created.email}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors p-3 border border-slate-100 dark:border-slate-800 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider">{created.hasEmail ? 'Parent Password' : 'Password'}</span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors select-all">{created.password}</span>
            </div>
          </div>
          <div className="relative z-10 mt-5">
            {created.hasEmail ? (
              created.welcomeEmailSent ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Welcome email successfully sent.
                </p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Welcome email failed to send. Please share credentials manually or print the slip.
                </p>
              )
            ) : (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700">
                No email provided. The student can log in using their Student Number and Password. Please share credentials manually or print the slip.
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
          <Button onClick={onClose} size="lg" className="!bg-emerald-600 hover:!bg-emerald-700 shadow-sm min-w-[120px]">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
function StudentAdmissionForm({ onSaved, onClose, inline = false, mode = 'create', initialDetail = null, initialPhoto = null, patientId = null }) {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [f, setF] = useState(() => buildFormState(initialDetail))
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  // Branch scoping: badge shows this admin's branch; Super Admin may target
  // another branch via selector. Regular admins are locked to their own.
  const [ownClinic, setOwnClinic] = useState(null)
  const [branchOptions, setBranchOptions] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [photo, setPhoto] = useState(initialPhoto)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  // Wet-signature path: print the blank form, collect ink on paper, upload
  // the scan. Kept outside `f` so the text-only draft autosave ignores it —
  // a fresh upload is cheap and always re-verifiable.
  const [sigMode, setSigMode] = useState('esign')
  const [scanPath, setScanPath] = useState(null)
  const [scanName, setScanName] = useState('')
  const [uploadingScan, setUploadingScan] = useState(false)
  const [downloadingBlank, setDownloadingBlank] = useState(false)
  const [dirty, setDirty] = useState(false)
  // Tracks an explicit "Others" pick for the suffix dropdown (a custom saved
  // suffix still resolves to Others via suffixChoiceOf without this flag).
  const [suffixOthers, setSuffixOthers] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [pendingDraft, setPendingDraft] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [draftNotice, setDraftNotice] = useState('')
  const isEdit = mode === 'edit'
  const setFDirty = (updater) => {
    setDirty(true)
    setF(updater)
  }
  const handleClose = () => {
    if (!created && dirty) {
      setConfirmingDiscard(true)
      return
    }
    onClose?.()
  }

  useEffect(() => {
    api.admin.employees()
      .then((data) => {
        // Staff names are typed by hand at registration, so a lowercase
        // display_name ("jerome Dela Cruz") would leak into every assignment
        // dropdown. Normalize on receipt so labels, values, and the printed
        // representative name stay consistent (ids are untouched).
        setEmployees((data.employees || []).map((e) => ({
          ...e,
          name: capitalizeName(e.name),
          display_name: capitalizeName(e.display_name || e.name),
        })))
      })
      .catch(() => toast.error('Could not load staff list. Assignments may be incomplete.'))
      .finally(() => setLoadingEmployees(false))
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

  useEffect(() => {
    const next = buildFormState(initialDetail)
    setF(next)
    // Imported applications carry an already-uploaded photo URL; keep it so
    // staff don't re-take the 2x2 (submit re-sends it as a data URL).
    setPhoto(next.photo || initialPhoto || null)
    setCreated(null)
    setError(null)
    setDirty(false)
  }, [initialDetail, initialPhoto, mode])

  // Offer to resume an interrupted create session (create mode only — edits
  // always load from the database record instead).
  useEffect(() => {
    if (mode !== 'create' || initialDetail) return
    const draft = readAdmissionDraft()
    if (draftHasContent(draft)) setPendingDraft(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced autosave of the in-progress create form + photo.
  useEffect(() => {
    if (isEdit || !dirty || created) return undefined
    const timer = setTimeout(() => {
      const payload = { savedAt: Date.now(), f, photo }
      try {
        localStorage.setItem(ADMISSION_DRAFT_KEY, JSON.stringify(payload))
        setDraftSavedAt(payload.savedAt)
        setDraftNotice('')
      } catch {
        // Quota (ID photo / signature blobs too big) — retry text-only.
        try {
          const { parentSignature, repSignature, ...rest } = f
          const slim = { savedAt: Date.now(), f: { ...rest, parentSignature: null, repSignature: null }, photo: null }
          localStorage.setItem(ADMISSION_DRAFT_KEY, JSON.stringify(slim))
          setDraftSavedAt(slim.savedAt)
          setDraftNotice('Photo and signatures are not kept in the auto-draft.')
        } catch {
          // Private mode etc. — stay silent, submit still works.
        }
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [f, photo, dirty, isEdit, created])

  const resumeDraft = () => {
    if (!pendingDraft) return
    const merged = { ...buildFormState(null), ...pendingDraft.f }
    // Migrate pre-dropdown drafts (free-text POB/citizenship/religion/
    // emergency relation) so they load as Others + custom text instead
    // of a blank select.
    for (const [key, otherKey, list] of [
      ['placeOfBirth', 'placeOfBirthOther', PH_BIRTH_PLACES],
      ['citizenship', 'citizenshipOther', CITIZENSHIPS],
      ['religion', 'religionOther', RELIGIONS],
      ['emergencyRelation', 'emergencyRelationOther', EMERGENCY_RELATIONS],
    ]) {
      const v = merged[key]
      if (v && v !== OTHER_VALUE && !list.includes(v)) {
        merged[otherKey] = merged[otherKey] || v
        merged[key] = OTHER_VALUE
      }
    }
    setF(merged)
    setPhoto(pendingDraft.photo || null)
    setDirty(true)
    setError(null)
    setPendingDraft(null)
  }

  const discardDraft = () => {
    removeAdmissionDraft()
    setPendingDraft(null)
    setDraftSavedAt(null)
    setDraftNotice('')
  }

  // Branch-scoped assignment: only clinicians designated to the admission
  // branch are offered. Multi-branch staff appear in every branch they serve;
  // rows without branch info (legacy) are kept so old accounts still assign.
  const admissionBranchId = selectedBranchId || ownClinic?.id || ''
  const inAdmissionBranch = (e) => {
    if (!admissionBranchId) return true
    if (!e.clinic_id && !(e.branches || []).length) return true
    if (String(e.clinic_id || '') === String(admissionBranchId)) return true
    return (e.branches || []).some((b) => String(b?.id ?? b) === String(admissionBranchId))
  }
  const branchEmployees = employees.filter(inAdmissionBranch)
  const psychologists = branchEmployees.filter((e) => e.role === 'psychologist' || (e.extra_roles || []).includes('psychologist'))
  const psychometricians = branchEmployees.filter((e) => e.role === 'psychometrician' || (e.extra_roles || []).includes('psychometrician'))
  // The assigned psychometrician doubles as the CMPS representative: the rep
  // name below is read-only text mirrored from the RPm dropdown above, so
  // there is only one picker to maintain.
  const assignedRpm = psychometricians.find((e) => String(e.id) === String(f.treating_psychometrician_id))
  const selectedRepresentative = assignedRpm || employees.find(
    (e) => e.name === f.repPrintedName || e.display_name === f.repPrintedName
  )
  const representativeMeta = selectedRepresentative
    ? {
        rep_printed_name: selectedRepresentative.display_name || selectedRepresentative.name || f.repPrintedName || null,
        rep_profession: selectedRepresentative.staff_title || selectedRepresentative.title || null,
        rep_license_no: selectedRepresentative.license_no || null,
      }
    : {
        rep_printed_name: f.repPrintedName || null,
        rep_profession: null,
        rep_license_no: null,
      }

  useEffect(() => {
    if (!f.treating_psychometrician_id && psychometricians.length === 1) {
      setFDirty((s) => ({ ...s, treating_psychometrician_id: psychometricians[0].id }))
    }
  }, [psychometricians, f.treating_psychometrician_id])

  // Switching branches prunes a clinician pick that doesn't serve the new
  // branch, so a stale id can never be submitted.
  useEffect(() => {
    setFDirty((s) => {
      const keepPsy = !s.treating_psychologist_id || psychologists.some((e) => String(e.id) === String(s.treating_psychologist_id))
      const keepRpm = !s.treating_psychometrician_id || psychometricians.some((e) => String(e.id) === String(s.treating_psychometrician_id))
      if (keepPsy && keepRpm) return s
      return {
        ...s,
        treating_psychologist_id: keepPsy ? s.treating_psychologist_id : '',
        treating_psychometrician_id: keepRpm ? s.treating_psychometrician_id : '',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionBranchId])

  const set = (k) => (e) => {
    const val = e.target.value
    setFDirty((s) => ({ ...s, [k]: val }))
  }

  // The assigned psychometrician doubles as the CMPS representative: picking
  // an RPm auto-fills the read-only rep name below (create and edit), so the
  // two can never drift out of sync. Clearing the RPm clears the rep name.
  useEffect(() => {
    if (isEdit) return
    const name = assignedRpm?.display_name || assignedRpm?.name || ''
    if (name !== (f.repPrintedName || '')) {
      setFDirty((s) => ({ ...s, repPrintedName: name }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.treating_psychometrician_id, psychometricians, isEdit])

  const setName = (k) => (e) => setFDirty((s) => ({ ...s, [k]: sanitizeName(e.target.value) }))
  const setPhone = (k) => (e) => setFDirty((s) => ({ ...s, [k]: formatPHMobile(e.target.value) }))

  // Entity shapes shared by account creation and the pre-filled wet-sign
  // PDF, so the printout always matches what would be saved. Includes the
  // printed names + representative credentials so the printout only lacks
  // ink signatures — families just sign on paper.
  const buildAdmissionEntities = () => ({
    permanent_address: f.permanentAddress || null,
    previously_diagnosed: f.previouslyDiagnosed,
    other_disability: f.otherDisability,
    parent_printed_name: f.parentPrintedName || f.motherName || null,
    ...representativeMeta,
    child: {
      first_name: f.firstName,
      middle_name: f.middleName,
      last_name: f.lastName,
      suffix_name: f.suffixName || null,
      nick_name: f.nickName?.trim() || null,
      date_of_birth: f.birthdate,
      sex: f.sex,
      home_address: f.presentAddress,
      place_of_birth: finalBirthplace(f.placeOfBirth, f.placeOfBirthOther, f.placeOfBirthCity, f.placeOfBirthCityOther),
      citizenship: finalOption(f.citizenship, f.citizenshipOther),
      religion: finalOption(f.religion, f.religionOther),
      photo,
    },
    clinical: {
      iep_level: f.iepLevel || null,
      primary_diagnosis: f.previouslyDiagnosed ? f.diagnosis || null : null,
      secondary_diagnosis: f.otherDisability ? f.disability || null : null,
      allergies: f.allergies || null,
    },
    guardians: [
      {
        full_name: f.motherName,
        relationship: 'Mother',
        occupation: f.motherOccupation,
        contact_number: f.motherMobile,
        email: f.motherEmail,
      },
      {
        full_name: f.fatherName,
        relationship: 'Father',
        occupation: f.fatherOccupation,
        contact_number: f.fatherMobile,
        email: f.fatherEmail,
      },
    ],
    emergency: {
      full_name: f.emergencyName,
      relationship: finalOption(f.emergencyRelation, f.emergencyRelationOther),
      contact_number: f.emergencyContact,
    },
  })

  // Every field that must be filled before registering — reused by the
  // pre-filled PDF gate so nothing half-empty can be printed.
  const getMissingRequired = () => {
    const required = [
      ['Last name', f.lastName],
      ['First name', f.firstName],
      ['Middle name', f.middleName],
      ['Birthdate', f.birthdate],
      ['Place of birth', finalBirthplace(f.placeOfBirth, f.placeOfBirthOther, f.placeOfBirthCity, f.placeOfBirthCityOther)],
      ['Sex', f.sex],
      ['Citizenship', finalOption(f.citizenship, f.citizenshipOther)],
      ['Religion', finalOption(f.religion, f.religionOther)],
      ['Present address', f.presentAddress],
      ['Mother/Guardian name', f.motherName],
      ['Mother occupation', f.motherOccupation],
      ['Mother mobile number', f.motherMobile],
      ['Father/Guardian name', f.fatherName],
      ['Father occupation', f.fatherOccupation],
      ['Father mobile number', f.fatherMobile],
      ['Emergency contact person', f.emergencyName],
      ['Emergency contact number', f.emergencyContact],
      ['Emergency contact relation', finalOption(f.emergencyRelation, f.emergencyRelationOther)],
      ['Allergies', f.allergies],
      ['Enrollment type', f.iepLevel],
      ['Account Handler Name', f.accountHandlerName],
      ['Parent printed name', f.parentPrintedName],
      ['CMPS representative', f.repPrintedName],
    ]
    return required
      .filter(([, val]) => !val || !String(val).trim())
      .map(([label]) => label)
  }

  const handlePrefillDownload = async () => {
    // The pre-filled PDF is the wet-signature path: block it until every
    // required field is filled so no half-empty form can be printed.
    const missing = getMissingRequired()
    if (missing.length > 0) {
      const message = `Fill out all required fields before downloading the pre-filled PDF. Missing: ${missing.join(', ')}.`
      setError(message)
      toast.error(message)
      return
    }
    setDownloadingBlank(true)
    try {
      const blob = await api.admin.admissionPrefillPdf(buildAdmissionEntities())
      saveBlob(blob, 'CMPS-SE-FO-01-prefilled.pdf')
    } catch (err) {
      setError(err.message || 'Could not download the pre-filled form.')
    } finally {
      setDownloadingBlank(false)
    }
  }

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const okTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!okTypes.includes(file.type)) {
      setError('Only PDF, JPG, PNG, or WebP scans are accepted.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Scan is too large (max 10MB).')
      return
    }
    setUploadingScan(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Could not read the file. Please try again.'))
        reader.readAsDataURL(file)
      })
      const up = await api.admin.uploadAdmissionScan({ file_base64: dataUrl, content_type: file.type })
      if (!up?.url) throw new Error('Upload returned no file. Please try again.')
      setScanPath(up.url)
      setScanName(file.name)
      setError(null)
    } catch (err) {
      setError(err.message || 'Scan upload failed. Please try again.')
    } finally {
      setUploadingScan(false)
    }
  }

  const register = async () => {
    setError(null)
    const email = f.accountEmail.trim()
    const password = f.accountPassword.trim()
    const psychologistId = String(f.treating_psychologist_id || '').trim()
    const psychometricianId = String(f.treating_psychometrician_id || '').trim()

    // All fields are required: list every missing field at once so the
    // staff knows exactly what still needs to be filled out.
    const missing = getMissingRequired()
    if (missing.length > 0) {
      setError(`Please fill out all required fields. Missing: ${missing.join(', ')}.`)
      return
    }
    if (f.sameAddressPresentPermanent === null) {
      setError('Please answer whether the present address is also the permanent address.')
      return
    }
    if (f.sameAddressPresentPermanent === false && !f.permanentAddress.trim()) {
      setError('Permanent address is required.')
      return
    }
    if (f.previouslyDiagnosed === null) {
      setError('Please answer whether the student was previously diagnosed / assessed.')
      return
    }
    if (f.previouslyDiagnosed && !f.diagnosis.trim()) {
      setError('Diagnosis is required.')
      return
    }
    if (f.otherDisability === null) {
      setError('Please answer whether the student has other disability/impairment.')
      return
    }
    if (f.otherDisability && !f.disability.trim()) {
      setError('Disability/impairment diagnosis is required.')
      return
    }
    if (!photo) {
      setError('A 2×2 ID photo is required.')
      return
    }
    const pwErr = passwordError(password)
    if (pwErr) {
      setError(pwErr)
      return
    }
    const phones = [
      ['Mother mobile', f.motherMobile],
      ['Father mobile', f.fatherMobile],
      ['Emergency contact number', f.emergencyContact],
    ]
    for (const [label, num] of phones) {
      if (num && !isValidPHMobile(num)) {
        setError(`${label} must be a valid Philippine mobile number (e.g. 0917 123 4567).`)
        return
      }
    }
    if (!psychologistId) {
      setError('An assigned psychologist is required.')
      return
    }
    if (!psychometricianId) {
      setError(
        psychometricians.length === 0
          ? 'No RPm is available yet. Please ask the admin to register or assign one first.'
          : 'An assigned psychometrician (RPm) is required.'
      )
      return
    }
    const wet = sigMode === 'wet'
    if (wet && !scanPath) {
      setError('Please upload the scanned wet-signed form first.')
      return
    }
    if (!wet && !f.parentSignature) {
      setError('Parent signature is required.')
      return
    }
    if (!wet && !f.repSignature) {
      setError('CMPS representative signature is required.')
      return
    }
    setSaving(true)
    try {
      const entities = buildAdmissionEntities()
      const data = await api.admin.createPatient({
        parent_email: email,
        parent_password: password,
        parent_display_name: f.accountHandlerName.trim(),
        notify_parent: true,
        // Branch scoping: only Super Admin may target another branch.
        // Regular admins omit this and land in their own clinic server-side.
        ...(isSuperAdmin && selectedBranchId ? { clinic_id: selectedBranchId } : {}),
        permanent_address: entities.permanent_address,
        previously_diagnosed: entities.previously_diagnosed,
        other_disability: entities.other_disability,
        parent_signature: f.parentSignature,
        parent_printed_name: f.parentPrintedName || f.motherName || null,
        parent_signature_date: f.parentSignatureDate || null,
        rep_signature: f.repSignature,
        rep_signature_date: f.repSignatureDate || null,
        admission_scan_url: wet ? scanPath : null,
        ...representativeMeta,
        treating_psychologist_id: psychologistId || null,
        treating_psychometrician_id: psychometricianId || null,
        child: entities.child,
        clinical: entities.clinical,
        guardians: entities.guardians,
        emergency: entities.emergency,
      })
      const createdPayload = {
        name: `${f.firstName} ${f.lastName}`,
        email,
        password,
        patientId: data?.patient?.patient_id,
        welcomeEmailSent: data?.welcome_email_sent === true,
        hasEmail: Boolean(email),
      }
      setCreated(createdPayload)
      // The new admission lands in Compliance awaiting FO-02; refresh the
      // sidebar badge now instead of waiting for the 30s poll.
      window.dispatchEvent(new Event('cymon-badge-update'))
      removeAdmissionDraft()
      setPendingDraft(null)
      setDraftSavedAt(null)
      setDraftNotice('')
      // Pass the slip data up: parents close the big admission modal and
      // render StudentRegisteredSlipModal themselves, so no stale form modal
      // is left stacked behind the success slip.
      onSaved?.(createdPayload)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">{error}</div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 transition-colors">
          Registration generates database records.
          {!isEdit && dirty && draftSavedAt ? ` Draft autosaved ${new Date(draftSavedAt).toLocaleTimeString()}.` : ''}
          {draftNotice ? ` ${draftNotice}` : ''}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={register}
            disabled={saving}
            size="lg"
            className="!h-auto min-h-[48px] whitespace-nowrap !bg-purple-700 py-3 hover:!bg-purple-800"
          >
            {saving ? 'Registering\u2026' : 'Save & Create Account'}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
    <FormShell
      title="Student Admission Form"
      code="CMPS:SE-FO-01 rev.0 02192026"
      confidential={false}
      actions={actions}
      onClose={handleClose}
      multiPage={true}
      inline={inline}
    >
      <div className="space-y-4">
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
        {pendingDraft && !isEdit ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20 transition-colors">
            <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Unsaved admission draft{pendingDraft.savedAt ? ` from ${new Date(pendingDraft.savedAt).toLocaleString()}` : ''} found.
            </div>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Your last session was interrupted before registering. Resume where you left off, or discard it to start fresh.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resumeDraft}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:scale-[0.98] transition cursor-pointer"
              >
                Resume draft
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 active:scale-[0.98] transition cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
        {/* 01 — Personal Information */}
        <Card eyebrow="01" title="Personal Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Last Name"><input className={inputCls} value={f.lastName} onChange={setName('lastName')} maxLength={30} /></Field>
              <Field label="First Name"><input className={inputCls} value={f.firstName} onChange={setName('firstName')} maxLength={30} /></Field>
              <Field label="Middle Name"><input className={inputCls} value={f.middleName} onChange={setName('middleName')} maxLength={30} /></Field>
              <Field label="Suffix Name">
                <select
                  className={inputCls}
                  value={suffixChoiceOf(f.suffixName, suffixOthers)}
                  onChange={(e) => {
                    const choice = e.target.value
                    if (choice === SUFFIX_OTHERS) {
                      setSuffixOthers(true)
                    } else {
                      setSuffixOthers(false)
                      setFDirty((s) => ({ ...s, suffixName: choice }))
                    }
                  }}
                >
                  <option value="">Select suffix (optional)</option>
                  {SUFFIX_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={SUFFIX_OTHERS}>Others (specify)</option>
                </select>
                {suffixChoiceOf(f.suffixName, suffixOthers) === SUFFIX_OTHERS ? (
                  <input
                    className={`${inputCls} mt-2`}
                    value={SUFFIX_OPTIONS.includes(String(f.suffixName || '').trim()) ? '' : (f.suffixName || '')}
                    onChange={setName('suffixName')}
                    placeholder="Specify suffix"
                    maxLength={30}
                  />
                ) : null}
              </Field>
              <Field label="Birthdate"><DatePicker value={f.birthdate} onChange={(v) => setFDirty((s) => ({ ...s, birthdate: v }))} max={new Date().toISOString().slice(0, 10)} ariaLabel="Birthdate" /></Field>
              <Field label="Place of Birth (Province)">
                <select
                  className={inputCls}
                  value={f.placeOfBirth}
                  onChange={(e) => setFDirty((s) => ({
                    ...s,
                    placeOfBirth: e.target.value,
                    placeOfBirthCity: '',
                    placeOfBirthCityOther: '',
                  }))}
                >
                  <option value="">Select</option>
                  {PH_BIRTH_PLACES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value={OTHER_VALUE}>Others (specify)</option>
                </select>
                {f.placeOfBirth === OTHER_VALUE ? (
                  <input className={`${inputCls} mt-2`} value={f.placeOfBirthOther} onChange={set('placeOfBirthOther')} placeholder="Specify place of birth" maxLength={60} />
                ) : null}
              </Field>
              {f.placeOfBirth && f.placeOfBirth !== OTHER_VALUE ? (
                <Field label="Place of Birth (City)">
                  {(PH_PROVINCE_CITIES[f.placeOfBirth] || []).length > 0 ? (
                    <>
                      <select className={inputCls} value={f.placeOfBirthCity} onChange={set('placeOfBirthCity')}>
                        <option value="">Select</option>
                        {(PH_PROVINCE_CITIES[f.placeOfBirth] || []).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value={OTHER_VALUE}>Others (specify)</option>
                      </select>
                      {f.placeOfBirthCity === OTHER_VALUE ? (
                        <input className={`${inputCls} mt-2`} value={f.placeOfBirthCityOther} onChange={set('placeOfBirthCityOther')} placeholder="Specify city / municipality" maxLength={60} />
                      ) : null}
                    </>
                  ) : (
                    <input className={inputCls} value={f.placeOfBirthCityOther} onChange={set('placeOfBirthCityOther')} placeholder="Specify city / municipality (optional)" maxLength={60} />
                  )}
                </Field>
              ) : null}
              <Field label="Sex">
                <select className={inputCls} value={f.sex} onChange={set('sex')}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Nickname"><input className={inputCls} value={f.nickName} onChange={setName('nickName')} maxLength={30} placeholder="Optional" /></Field>
              <Field label="Citizenship">
                <select className={inputCls} value={f.citizenship} onChange={set('citizenship')}>
                  <option value="">Select</option>
                  {CITIZENSHIPS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value={OTHER_VALUE}>Others (specify)</option>
                </select>
                {f.citizenship === OTHER_VALUE ? (
                  <input className={`${inputCls} mt-2`} value={f.citizenshipOther} onChange={set('citizenshipOther')} placeholder="Specify citizenship" maxLength={60} />
                ) : null}
              </Field>
            </div>
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wider text-purple-900">2×2 ID Photo</label>
              <PhotoCapture value={photo} onChange={(v) => { setDirty(true); setPhoto(v) }} square />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Present Address"><input className={inputCls} value={f.presentAddress} onChange={set('presentAddress')} maxLength={255} /></Field>
            <Field label="Religion">
              <select className={inputCls} value={f.religion} onChange={set('religion')}>
                <option value="">Select</option>
                {RELIGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={OTHER_VALUE}>Others (specify)</option>
              </select>
              {f.religion === OTHER_VALUE ? (
                <input className={`${inputCls} mt-2`} value={f.religionOther} onChange={set('religionOther')} placeholder="Specify religion" maxLength={60} />
              ) : null}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Is your Present Address also your Permanent Address?">
              <TogglePill
                options={['Yes', 'No']}
                value={f.sameAddressPresentPermanent === null ? null : f.sameAddressPresentPermanent ? 'Yes' : 'No'}
                onChange={(v) => setFDirty((s) => {
                  const same = v === 'Yes'
                  return {
                    ...s,
                    sameAddressPresentPermanent: same,
                    permanentAddress: same ? s.presentAddress : '',
                  }
                })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Permanent Address (if not same as present address)">
              <input
                className={inputCls}
                value={f.sameAddressPresentPermanent ? f.presentAddress : f.permanentAddress}
                onChange={set('permanentAddress')}
                placeholder="Same"
                maxLength={255}
                readOnly={f.sameAddressPresentPermanent === true}
                tabIndex={f.sameAddressPresentPermanent ? -1 : 0}
              />
            </Field>
          </div>
        </Card>

        {/* 02 — Parent Information */}
        <Card eyebrow="02" title="Parent Information">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">Mother / Guardian</div>
              <div className="space-y-3">
                <Field label="Name"><input className={inputCls} value={f.motherName} onChange={setName('motherName')} maxLength={30} /></Field>
                <Field label="Occupation"><input className={inputCls} value={f.motherOccupation} onChange={set('motherOccupation')} maxLength={30} /></Field>
                <Field label="Mobile Number"><input className={inputCls} inputMode="tel" value={f.motherMobile} onChange={setPhone('motherMobile')} placeholder="09** *** ****" maxLength={13} /></Field>
                <Field label="Email Address" hint="Optional"><input type="email" className={inputCls} value={f.motherEmail} onChange={set('motherEmail')} maxLength={255} placeholder="Optional" /></Field>
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">Father / Guardian</div>
              <div className="space-y-3">
                <Field label="Name"><input className={inputCls} value={f.fatherName} onChange={setName('fatherName')} maxLength={30} /></Field>
                <Field label="Occupation"><input className={inputCls} value={f.fatherOccupation} onChange={set('fatherOccupation')} maxLength={30} /></Field>
                <Field label="Mobile Number"><input className={inputCls} inputMode="tel" value={f.fatherMobile} onChange={setPhone('fatherMobile')} placeholder="09** *** ****" maxLength={13} /></Field>
                <Field label="Email Address" hint="Optional"><input type="email" className={inputCls} value={f.fatherEmail} onChange={set('fatherEmail')} maxLength={255} placeholder="Optional" /></Field>
              </div>
            </div>
          </div>
        </Card>

        {/* 03 — Emergency Contact */}
        <Card eyebrow="03" title="Emergency Contact Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name of Emergency Contact Person"><input className={inputCls} value={f.emergencyName} onChange={setName('emergencyName')} maxLength={30} /></Field>
            <Field label="Contact Number"><input className={inputCls} inputMode="tel" value={f.emergencyContact} onChange={setPhone('emergencyContact')} placeholder="09** *** ****" maxLength={13} /></Field>
            <Field label="Relation to the Client">
              <select className={inputCls} value={f.emergencyRelation} onChange={set('emergencyRelation')}>
                <option value="">Select</option>
                {EMERGENCY_RELATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={OTHER_VALUE}>Others (specify)</option>
              </select>
              {f.emergencyRelation === OTHER_VALUE ? (
                <input className={`${inputCls} mt-2`} value={f.emergencyRelationOther} onChange={set('emergencyRelationOther')} placeholder="Specify relationship" maxLength={30} />
              ) : null}
            </Field>
          </div>
        </Card>

        {/* 04 — Diagnosis & Disability */}
        <Card eyebrow="04" title="Diagnosis & Disability">
          <div className="space-y-4">
            <div>
              <Field label="Was the student previously diagnosed / assessed?">
                <TogglePill
                  options={['Yes', 'No']}
                  value={f.previouslyDiagnosed === null ? null : f.previouslyDiagnosed ? 'Yes' : 'No'}
                  onChange={(v) => {
                    if (v == null) return
                    setFDirty((s) => ({ ...s, previouslyDiagnosed: v === 'Yes', diagnosis: v === 'Yes' ? s.diagnosis : '' }))
                  }}
                />
              </Field>
            </div>
            {f.previouslyDiagnosed && (
              <Field label="Diagnosis"><input className={inputCls} value={f.diagnosis} onChange={set('diagnosis')} maxLength={255} /></Field>
            )}

            <div>
              <Field label="Does the student have other disability/impairment that will hinder the program?">
                <TogglePill
                  options={['Yes', 'No']}
                  value={f.otherDisability === null ? null : f.otherDisability ? 'Yes' : 'No'}
                  onChange={(v) => {
                    if (v == null) return
                    setFDirty((s) => ({ ...s, otherDisability: v === 'Yes', disability: v === 'Yes' ? s.disability : '' }))
                  }}
                />
              </Field>
            </div>
            {f.otherDisability && (
              <Field label="Diagnosis"><input className={inputCls} value={f.disability} onChange={set('disability')} maxLength={255} /></Field>
            )}

            <Field label="Allergies">
              <textarea className={`${inputCls} min-h-[60px]`} value={f.allergies} onChange={set('allergies')} maxLength={255} />
            </Field>
          </div>
        </Card>

        {/* 05 — Enrollment Type */}
        <Card eyebrow="05" title="Enrollment Type">
          <div className="space-y-2">
            {ENROLLMENT.map((opt) => (
              <RadioCard
                key={opt.value}
                color={opt.color}
                code={opt.code}
                label={opt.label}
                detail={opt.detail}
                checked={f.iepLevel === opt.value}
                onChange={() => setFDirty((s) => ({ ...s, iepLevel: opt.value }))}
              />
            ))}
          </div>
        </Card>

        {/* 06 — Account Registration */}
        <Card eyebrow="06" title="Account Registration">
          <div className="rounded-lg bg-purple-50/50 dark:bg-purple-900/10 p-4">
            <div className="mb-3 text-[11.5px] font-semibold text-purple-800 dark:text-purple-300 transition-colors">
              This creates the portal login the parent/guardian will use to view their child’s IEP, assessments, and session records.
            </div>
            <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 p-3 text-[11.5px] text-amber-800 dark:text-amber-200 font-medium">
              If the parent has no email address, leave the Login Email blank. The student can log in using their <strong>Student Number</strong> and <strong>Password</strong> instead.
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Student Number" hint="Auto-assigned on registration">
                <input className={`${inputCls} cursor-not-allowed bg-purple-100/50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors`} value="Auto-assigned (CMPS-BRANCH-YEAR-###)" disabled />
              </Field>
              <Field label="Account Handler Name" hint="Required (Parent or Guardian name)">
                <input className={inputCls} value={f.accountHandlerName} onChange={setName('accountHandlerName')} placeholder="e.g. Elena Dela Cruz" maxLength={50} />
              </Field>
              <Field label="Temporary Password" hint="Auto-generated by default">
                <input className={inputCls} value={f.accountPassword} onChange={set('accountPassword')} maxLength={30} />
                <PasswordChecklist password={f.accountPassword} />
              </Field>
              <Field label="Login Email" hint="Optional — leave blank if parent has no email">
                <input type="email" className={inputCls} value={f.accountEmail} onChange={set('accountEmail')} placeholder="parent@example.com (optional)" maxLength={255} />
              </Field>
            </div>
          </div>
        </Card>

        {/* Sign-off */}
        <Card eyebrow="" title="Staff Assignments & Sign-off">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Assigned Psychologist">
              <SearchableSelect
                value={f.treating_psychologist_id}
                onChange={(v) => setFDirty((s) => ({ ...s, treating_psychologist_id: v }))}
                options={[
                  { value: '', label: 'Select psychologist' },
                  ...psychologists.map((e) => ({ value: e.id, label: formatLastFirstMI(e) })),
                ]}
                placeholder="Select psychologist"
                searchPlaceholder="Search psychologist..."
                emptyText={psychologists.length === 0 ? 'No psychologist available.' : 'No match found.'}
                disabled={loadingEmployees}
                ariaLabel="Assigned Psychologist"
              />
            </Field>
            <Field label="Assigned Psychometrician (RPm)">
              <SearchableSelect
                value={f.treating_psychometrician_id}
                onChange={(v) => setFDirty((s) => ({ ...s, treating_psychometrician_id: v }))}
                options={[
                  { value: '', label: 'Select psychometrician' },
                  ...psychometricians.map((e) => ({ value: e.id, label: formatLastFirstMI(e) })),
                ]}
                placeholder="Select psychometrician"
                searchPlaceholder="Search psychometrician..."
                emptyText={psychometricians.length === 0 ? 'No RPm available.' : 'No match found.'}
                disabled={loadingEmployees}
                ariaLabel="Assigned Psychometrician"
              />
            </Field>
          </div>

          {!isEdit ? (
          <>
          <div className="mt-6 flex gap-2 rounded-full bg-purple-50 dark:bg-slate-800 p-1" role="tablist" aria-label="Signature method">
            <button
              type="button"
              role="tab"
              aria-selected={sigMode === 'esign'}
              onClick={() => setSigMode('esign')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs sm:text-sm font-bold cursor-pointer transition ${sigMode === 'esign' ? 'bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              E-Signature
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sigMode === 'wet'}
              onClick={() => setSigMode('wet')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs sm:text-sm font-bold cursor-pointer transition ${sigMode === 'wet' ? 'bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Wet signature (print &amp; scan)
            </button>
          </div>

          {sigMode === 'wet' ? (
            <div className="mt-4 rounded-2xl border border-purple-200 dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/50 p-4 sm:p-5 space-y-4 transition-colors">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">1</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Download &amp; print the filled-out form</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Everything you typed is already printed on it — only the two signatures are blank for ink signing.</p>
                  <button
                    type="button"
                    onClick={handlePrefillDownload}
                    disabled={downloadingBlank}
                    className="mt-2 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {downloadingBlank ? 'Preparing…' : 'Download pre-filled admission PDF'}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Upload the scanned signed copy</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">PDF, JPG, PNG, or WebP, max 10MB.</p>
                  {scanPath ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-emerald-800 dark:text-emerald-200">✓ {scanName || 'Scan uploaded'}</span>
                      <button
                        type="button"
                        onClick={() => { setScanPath(null); setScanName('') }}
                        className="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors">
                      {uploadingScan ? 'Uploading…' : 'Choose scan file'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={uploadingScan} onChange={handleScanFile} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">3</span>
                <p className="text-[11px] sm:text-xs leading-relaxed text-slate-500 dark:text-slate-400 pt-1">
                  After the scan is uploaded, <span className="font-bold text-slate-700 dark:text-slate-200">Save &amp; Create Account</span> below becomes available — the scan replaces both e-signatures.
                </p>
              </div>
            </div>
          ) : null}
          </>
          ) : null}

          <div className={`mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 ${sigMode === 'wet' && !isEdit ? 'hidden' : ''}`}>
            <div>
              <label className="mb-1.5 flex min-h-[35px] items-end text-[11.5px] font-semibold uppercase tracking-wider text-purple-900 dark:text-purple-400">Signature over Printed Name of Parent</label>
              <div className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 dark:bg-slate-800 p-3">
                <SignaturePad value={f.parentSignature} onChange={(v) => setFDirty((s) => ({ ...s, parentSignature: v }))} label="" />
                <div className="mt-3 space-y-2">
                  <input className={inputCls} value={f.parentPrintedName} onChange={setName('parentPrintedName')} placeholder="Printed Name" maxLength={30} />
                  <DatePicker value={f.parentSignatureDate} onChange={(v) => setFDirty((s) => ({ ...s, parentSignatureDate: v }))} ariaLabel="Parent signature date" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex min-h-[35px] items-end text-[11.5px] font-semibold uppercase tracking-wider text-purple-900 dark:text-purple-400">Signature over Printed Name of CMPS Representative</label>
              <div className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 dark:bg-slate-800 p-3">
                <SignaturePad value={f.repSignature} onChange={(v) => setFDirty((s) => ({ ...s, repSignature: v }))} label="" />
                <div className="mt-3 space-y-2">
                  <div
                    aria-live="polite"
                    className={`${inputCls} flex min-h-[42px] items-center bg-slate-50 dark:bg-slate-800/60 ${f.repPrintedName ? 'font-medium' : 'text-slate-400'}`}
                  >
                    {f.repPrintedName || 'Select a psychometrician above…'}
                  </div>
                  <div className="text-[11px] text-slate-400">Automatic — mirrors the Assigned Psychometrician (RPm) above.</div>
                  <DatePicker value={f.repSignatureDate} onChange={(v) => setFDirty((s) => ({ ...s, repSignatureDate: v }))} ariaLabel="Representative signature date" />
                  {selectedRepresentative ? (
                    <div className="rounded-lg border border-purple-100 bg-white dark:bg-slate-900 transition-colors/80 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 transition-colors">
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        <div>
                          <div className="uppercase tracking-wider text-slate-400">PRC License No.</div>
                          <div className="font-medium text-purple-800 dark:text-purple-300 transition-colors">{selectedRepresentative.license_no || '—'}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wider text-slate-400">Profession</div>
                          <div className="font-medium text-purple-800 dark:text-purple-300 transition-colors">{selectedRepresentative.staff_title || selectedRepresentative.title || '—'}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </FormShell>
    {confirmingDiscard ? (
      <ConfirmDialog
        title="Discard Changes?"
        message="You have unsaved changes. Written data is not yet saved. Are you sure you want to close?"
        confirmLabel="Yes"
        cancelLabel="No"
        tone="red"
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={() => {
          setConfirmingDiscard(false)
          onClose?.()
        }}
      />
    ) : null}
    </>
  )
}

export default StudentAdmissionForm

