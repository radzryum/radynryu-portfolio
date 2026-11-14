import { useEffect, useState } from 'react'
import FormShell from '../../../components/ui/FormShell'
import PhotoCapture from '../../../components/ui/PhotoCapture'
import SignaturePad from '../../../components/ui/SignaturePad'
import DatePicker from '../../../components/ui/DatePicker'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Button from '../../../components/ui/Button'
import Radio from '../../../components/ui/Radio'
import { api } from '../../../lib/api'
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

const ENROLLMENT = [
  { value: 'HSN', code: 'HSN', color: '#B4524A', label: 'Higher Support Needs Program', detail: '48 hours per month' },
  { value: 'MSN', code: 'MSN', color: '#B8873A', label: 'Moderate Support Needs Program', detail: '36 hours per month' },
  { value: 'LSN', code: 'LSN', color: '#5B8C6E', label: 'Low Support Needs Program', detail: '24 hours per month' },
  { value: 'Individual', code: 'IND', color: '#3457A6', label: 'Individual Session', detail: '' },
]

const sanitizeName = (val) => val.replace(/[^\p{L}\s.\-']/gu, '')
const formatPHMobile = (raw) => {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('63')) d = `0${d.slice(2)}`
  d = d.slice(0, 11)
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' ')
}
const isValidPHMobile = (val) => /^09\d{9}$/.test(val.replace(/\D/g, ''))
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const todayISO = () => new Date().toISOString().slice(0, 10)

const Card = ({ eyebrow, title, children }) => (
  <div className="rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
    <h3 className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-purple-950">
      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-purple-600">{eyebrow}</span>
      {title}
    </h3>
    {children}
  </div>
)

const Field = ({ label, children, hint }) => (
  <div className="flex h-full flex-col">
    <label className="mb-1.5 block flex-1 text-[11.5px] font-semibold uppercase tracking-wider text-purple-900">
      {label}
    </label>
    <div>{children}</div>
    {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
  </div>
)

const inputCls = 'w-full rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 transition-colors placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'

const TogglePill = ({ options, value, onChange }) => (
  <div className="flex gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? null : opt)}
        className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
          value === opt
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
    colorClass="border-purple-400 bg-purple-50"
    unselectedClass="border-purple-200 dark:border-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-50/50"
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

const primaryGuardian = (guardians = [], relationship) =>
  guardians.find((g) => g.relationship === relationship) || guardians[relationship === 'Mother' ? 0 : 1] || {}

const buildState = (detail = null) => {
  const patient = detail?.patient || {}
  const clinical = detail?.clinical || {}
  const guardians = detail?.guardians || []
  const mother = primaryGuardian(guardians, 'Mother')
  const father = primaryGuardian(guardians, 'Father')
  const emergency = detail?.emergency || {}
  const sameAddress = patient.home_address && patient.permanent_address
    ? patient.home_address === patient.permanent_address
    : null
  const pob = splitBirthplace(patient.place_of_birth)
  const cit = splitOption(CITIZENSHIPS, patient.citizenship)
  const rel = splitOption(RELIGIONS, patient.religion)
  const erl = splitOption(EMERGENCY_RELATIONS, emergency.relationship)

  return {
    firstName: patient.first_name || '',
    middleName: patient.middle_name || '',
    lastName: patient.last_name || '',
    status: patient.status || 'pending',
    birthdate: patient.date_of_birth || '',
    sex: patient.sex || '',
    nickName: patient.nick_name || '',
    presentAddress: patient.home_address || '',
    permanentAddress: patient.permanent_address || '',
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
    previouslyDiagnosed: patient.previously_diagnosed ?? null,
    otherDisability: patient.other_disability ?? null,
    treating_psychologist_id: patient.treating_psychologist_id || '',
    treating_psychometrician_id: patient.treating_psychometrician_id || '',
    parentSignature: patient.parent_signature || null,
    parentPrintedName: patient.parent_printed_name || mother.full_name || '',
    repSignature: patient.rep_signature || null,
    photo: patient.photo_url || null,
    sameAddressPresentPermanent: sameAddress,
    repPrintedName: patient.rep_printed_name || detail?.patient?.treating_psychometrician?.display_name || detail?.patient?.treating_psychologist?.display_name || '',
    parentSignatureDate: todayISO(),
    repSignatureDate: todayISO(),
  }
}

function StudentAdmissionEditForm({ detail, patientId, onSaved, onClose, inline = false }) {
  const [f, setF] = useState(() => buildState(detail))
  const [photo, setPhoto] = useState(() => buildState(detail).photo)
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const setFDirty = (updater) => setF((s) => (typeof updater === 'function' ? updater(s) : updater))

  useEffect(() => {
    const next = buildState(detail)
    setF(next)
    setPhoto(next.photo)
    setError(null)
  }, [detail])

  useEffect(() => {
    api.admin.employees()
      // Staff names are typed by hand at registration — normalize on receipt
      // so a lowercase display_name never leaks into assignment dropdowns.
      .then((data) => setEmployees((data.employees || []).map((e) => ({
        ...e,
        name: capitalizeName(e.name),
        display_name: capitalizeName(e.display_name || e.name),
      }))))
      .catch(() => toast.error('Could not load staff list. Assignments may be incomplete.'))
      .finally(() => setLoadingEmployees(false))
  }, [])

  const psychologists = employees.filter((e) => e.role === 'psychologist' || (e.extra_roles || []).includes('psychologist'))
  const psychometricians = employees.filter((e) => e.role === 'psychometrician' || (e.extra_roles || []).includes('psychometrician'))
  // Branch-scoped assignment: when the patient's branch is known, only
  // clinicians designated there are offered (same rule as the create form).
  const patientBranchId = detail?.patient?.clinic_id || ''
  const inPatientBranch = (e) => {
    if (!patientBranchId) return true
    if (!e.clinic_id && !(e.branches || []).length) return true
    if (String(e.clinic_id || '') === String(patientBranchId)) return true
    return (e.branches || []).some((b) => String(b?.id ?? b) === String(patientBranchId))
  }
  const branchPsychologists = psychologists.filter(inPatientBranch)
  const branchPsychometricians = psychometricians.filter(inPatientBranch)
  // The assigned psychometrician doubles as the CMPS representative: the rep
  // name below is read-only text mirrored from the RPm dropdown above, so
  // there is only one picker to maintain.
  const assignedRpm = branchPsychometricians.find((e) => String(e.id) === String(f.treating_psychometrician_id)) || psychometricians.find((e) => String(e.id) === String(f.treating_psychometrician_id))
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
    if (!f.treating_psychometrician_id && branchPsychometricians.length === 1) {
      setFDirty((s) => ({ ...s, treating_psychometrician_id: branchPsychometricians[0].id }))
    }
  }, [branchPsychometricians, f.treating_psychometrician_id])

  // Keep the read-only rep name mirrored from the RPm pick (create and edit),
  // so the two can never drift out of sync. Clearing the RPm clears the rep.
  useEffect(() => {
    const name = assignedRpm?.display_name || assignedRpm?.name || ''
    if (name !== (f.repPrintedName || '')) {
      setFDirty((s) => ({ ...s, repPrintedName: name }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.treating_psychometrician_id, psychometricians])

  const set = (k) => (e) => {
    const val = e.target.value
    setFDirty((s) => {
      const next = { ...s, [k]: val }
      return next
    })
  }

  const setName = (k) => (e) => setFDirty((s) => ({ ...s, [k]: sanitizeName(e.target.value) }))
  const setPhone = (k) => (e) => setFDirty((s) => ({ ...s, [k]: formatPHMobile(e.target.value) }))

  const submit = async () => {
    setError(null)
    const psychologistId = String(f.treating_psychologist_id || '').trim()
    const psychometricianId = String(f.treating_psychometrician_id || '').trim()
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
    ]

    // All fields are required: list every missing field at once so the
    // staff knows exactly what still needs to be filled out.
    const missing = required
      .filter(([, val]) => !val || !String(val).trim())
      .map(([label]) => label)
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
    if (!f.parentSignature) {
      setError('Parent signature is required.')
      return
    }
    if (!f.repSignature) {
      setError('CMPS representative signature is required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        status: f.status,
        permanent_address: f.permanentAddress || null,
        previously_diagnosed: f.previouslyDiagnosed,
        other_disability: f.otherDisability,
        parent_signature: f.parentSignature,
        parent_printed_name: f.parentPrintedName || f.motherName || null,
        parent_signature_date: f.parentSignatureDate || null,
        rep_signature: f.repSignature,
        rep_signature_date: f.repSignatureDate || null,
        ...representativeMeta,
        treating_psychologist_id: psychologistId || null,
        treating_psychometrician_id: psychometricianId || null,
        admission_form_status: 'complete',
        child: {
          first_name: f.firstName,
          middle_name: f.middleName,
          last_name: f.lastName,
          nick_name: f.nickName?.trim() || null,
          date_of_birth: f.birthdate,
          sex: f.sex,
          home_address: f.presentAddress,
          permanent_address: f.permanentAddress || null,
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
      }

      await api.admin.updatePatient(patientId || detail?.patient?.id || detail?.id, payload)
      window.dispatchEvent(new Event('cymon-badge-update'))
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell
      title="Edit Student Admission Form"
      code="CMPS:SE-FO-01 rev.0 02192026"
      confidential={false}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Update the saved admission record.</div>
          <div className="flex items-center gap-3">
            {error ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</div> : null}
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      }
      onClose={onClose}
      multiPage={true}
      inline={inline}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/70 px-4 py-3 text-sm text-purple-900">
          This is the editable admission form pulled from the database. You can update the student record, signatures, and staff assignments here.
        </div>

        <Card eyebrow="01" title="Personal Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Last Name"><input className={inputCls} value={f.lastName} onChange={setName('lastName')} maxLength={30} /></Field>
              <Field label="First Name"><input className={inputCls} value={f.firstName} onChange={setName('firstName')} maxLength={30} /></Field>
              <Field label="Middle Name"><input className={inputCls} value={f.middleName} onChange={setName('middleName')} maxLength={30} /></Field>
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
              <Field label="Status">
                <select className={inputCls} value={f.status} onChange={set('status')}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
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
              <PhotoCapture value={photo} onChange={(v) => setPhoto(v)} square />
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
                onChange={(v) => setFDirty((s) => ({
                  ...s,
                  sameAddressPresentPermanent: v === 'Yes',
                  permanentAddress: v === 'Yes' ? s.presentAddress : s.permanentAddress,
                }))}
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

        <Card eyebrow="02" title="Parent Information">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">Mother / Guardian</div>
              <div className="space-y-3">
                <Field label="Name"><input className={inputCls} value={f.motherName} onChange={setName('motherName')} maxLength={30} /></Field>
                <Field label="Occupation"><input className={inputCls} value={f.motherOccupation} onChange={set('motherOccupation')} maxLength={30} /></Field>
                <Field label="Mobile Number"><input className={inputCls} inputMode="tel" value={f.motherMobile} onChange={setPhone('motherMobile')} placeholder="09** *** ****" maxLength={13} /></Field>
                <Field label="Email Address"><input type="email" className={inputCls} value={f.motherEmail} onChange={set('motherEmail')} maxLength={255} /></Field>
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors">Father / Guardian</div>
              <div className="space-y-3">
                <Field label="Name"><input className={inputCls} value={f.fatherName} onChange={setName('fatherName')} maxLength={30} /></Field>
                <Field label="Occupation"><input className={inputCls} value={f.fatherOccupation} onChange={set('fatherOccupation')} maxLength={30} /></Field>
                <Field label="Mobile Number"><input className={inputCls} inputMode="tel" value={f.fatherMobile} onChange={setPhone('fatherMobile')} placeholder="09** *** ****" maxLength={13} /></Field>
                <Field label="Email Address"><input type="email" className={inputCls} value={f.fatherEmail} onChange={set('fatherEmail')} maxLength={255} /></Field>
              </div>
            </div>
          </div>
        </Card>

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

        <Card eyebrow="04" title="Diagnosis & Disability">
          <div className="space-y-4">
            <Field label="Was the student previously diagnosed / assessed?">
              <TogglePill
                options={['Yes', 'No']}
                value={f.previouslyDiagnosed === null ? null : f.previouslyDiagnosed ? 'Yes' : 'No'}
                onChange={(v) => {
                  // Required Yes/No: ignore the toggle-off (null) so tapping
                  // the selected pill can't silently flip Yes into No.
                  if (v == null) return
                  setFDirty((s) => ({ ...s, previouslyDiagnosed: v === 'Yes', diagnosis: v === 'Yes' ? s.diagnosis : '' }))
                }}
              />
            </Field>
            {f.previouslyDiagnosed ? (
              <Field label="Diagnosis"><input className={inputCls} value={f.diagnosis} onChange={set('diagnosis')} maxLength={255} /></Field>
            ) : null}

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
            {f.otherDisability ? (
              <Field label="Diagnosis"><input className={inputCls} value={f.disability} onChange={set('disability')} maxLength={255} /></Field>
            ) : null}

            <Field label="Allergies">
              <textarea className={`${inputCls} min-h-[60px]`} value={f.allergies} onChange={set('allergies')} maxLength={255} />
            </Field>
          </div>
        </Card>

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

        <Card eyebrow="06" title="Staff Assignments & Sign-off">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Assigned Psychologist">
              <SearchableSelect
                value={f.treating_psychologist_id}
                onChange={(v) => setFDirty((s) => ({ ...s, treating_psychologist_id: v }))}
                options={[
                  { value: '', label: 'Select psychologist' },
                  ...branchPsychologists.map((e) => ({ value: e.id, label: formatLastFirstMI(e) })),
                ]}
                placeholder="Select psychologist"
                searchPlaceholder="Search psychologist..."
                emptyText={branchPsychologists.length === 0 && patientBranchId ? 'No psychologist in this branch.' : 'No match found.'}
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
                  ...branchPsychometricians.map((e) => ({ value: e.id, label: formatLastFirstMI(e) })),
                ]}
                placeholder="Select psychometrician"
                searchPlaceholder="Search psychometrician..."
                emptyText={branchPsychometricians.length === 0 ? 'No RPm available.' : 'No match found.'}
                disabled={loadingEmployees}
                ariaLabel="Assigned Psychometrician"
              />
            </Field>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex min-h-[35px] items-end text-[11.5px] font-semibold uppercase tracking-wider text-purple-900">Signature over Printed Name of Parent</label>
              <div className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 p-3">
                <SignaturePad value={f.parentSignature} onChange={(v) => setFDirty((s) => ({ ...s, parentSignature: v }))} label="" />
                <div className="mt-3 space-y-2">
                  <input className={inputCls} value={f.parentPrintedName} onChange={setName('parentPrintedName')} placeholder="Printed Name" maxLength={30} />
                  <DatePicker value={f.parentSignatureDate} onChange={(v) => setFDirty((s) => ({ ...s, parentSignatureDate: v }))} ariaLabel="Parent signature date" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex min-h-[35px] items-end text-[11.5px] font-semibold uppercase tracking-wider text-purple-900">Signature over Printed Name of CMPS Representative</label>
              <div className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 p-3">
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
  )
}

export default StudentAdmissionEditForm
