import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import PhotoCapture from '../components/ui/PhotoCapture'
import SignaturePad from '../components/ui/SignaturePad'
import DatePicker from '../components/ui/DatePicker'
import Button from '../components/ui/Button'
import { api } from '../lib/api'
import { branchApplyLabel } from '../lib/branches'
import { SUFFIX_OPTIONS, SUFFIX_OTHERS, suffixChoiceOf } from '../lib/suffix'
import {
  OTHER_VALUE,
  PH_BIRTH_PLACES,
  PH_PROVINCE_CITIES,
  EMERGENCY_RELATIONS,
  CITIZENSHIPS,
  RELIGIONS,
  finalOption,
  finalBirthplace,
} from '../lib/admissionOptions'

// 3-tier responsive: XS base → phone min-[360px]: → tablet+ sm:.
// Inputs stay text-base: anything below 16px makes iOS Safari auto-zoom on
// focus, which breaks the layout on guardians' phones.
const inputCls = 'w-full rounded-lg border border-purple-200 bg-purple-50/30 px-3 py-2.5 text-base text-slate-800 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 sm:py-2 sm:text-sm'
const TODAY = new Date().toISOString().slice(0, 10)

const ENROLLMENT = [
  { value: 'HSN', code: 'HSN', color: '#B4524A', label: 'Higher Support Needs Program', detail: '48 hours per month' },
  { value: 'MSN', code: 'MSN', color: '#B8873A', label: 'Moderate Support Needs Program', detail: '36 hours per month' },
  { value: 'LSN', code: 'LSN', color: '#5B8C6E', label: 'Low Support Needs Program', detail: '24 hours per month' },
  { value: 'Individual', code: 'IND', color: '#3457A6', label: 'Individual Session', detail: '' },
]

// Unicode letters (ñ, é, …), spaces, and common name punctuation only.
const sanitizeName = (val) => val.replace(/[^\p{L}\s.\-']/gu, '')
const formatPHMobile = (raw) => {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('63')) d = `0${d.slice(2)}`
  d = d.slice(0, 11)
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' ')
}
const isValidPHMobile = (val) => /^09\d{9}$/.test(val.replace(/\D/g, ''))

function Field({ label, children, hint, fieldId }) {
  // fieldId anchors the submit-error auto-scroll: fail() scrolls to
  // `#apply-<fieldId>` and focuses its first input, so guardians on long
  // phone screens land exactly on the missing field.
  // No h-full here: inside grid columns each Field would resolve 100% of
  // the stretched column height and blow the layout apart (every field as
  // tall as the whole column, spilling past the card).
  // The label zone fits two lines with text pinned to the bottom, so a
  // two-line label never pushes its input below its one-line row-mates.
  return (
    <div className="flex flex-col" id={fieldId ? `apply-${fieldId}` : undefined} style={{ scrollMarginTop: '1rem' }}>
      <label className="mb-1.5 flex min-h-8 items-end text-[11.5px] leading-4 font-semibold uppercase tracking-wider text-purple-900">
        {label}
      </label>
      <div>{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-slate-400">{hint}</div> : null}
    </div>
  )
}

function Card({ eyebrow, title, children }) {
  return (
    <div className="rounded-xl border border-purple-100 bg-white p-3.5 shadow-sm min-[360px]:p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-950 min-[360px]:mb-4 min-[360px]:gap-2.5">
        <span className="shrink-0 rounded-full bg-purple-50 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-purple-600">{eyebrow}</span>
        <span className="min-w-0">{title}</span>
      </h3>
      {children}
    </div>
  )
}

function TogglePill({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? null : opt)}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${value === opt
            ? 'border-purple-400 bg-purple-50 text-purple-800'
            : 'border-purple-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50/50'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// Anonymous admission application (opened from the clinic's QR/link).
// No account needed: sections 01–05 plus the parent e-signature. Staff
// import the submission into the full admission form on their side.
function Apply() {
  const { clinicCode } = useParams()
  const code = String(clinicCode || 'CLEARMIND').toUpperCase()
  const [clinicName, setClinicName] = useState('')
  const [codeError, setCodeError] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [photo, setPhoto] = useState(null)
  // Tracks an explicit "Others" pick for the suffix dropdown.
  const [suffixOthers, setSuffixOthers] = useState(false)
  const [f, setF] = useState({
    firstName: '', middleName: '', lastName: '', suffixName: '', nickName: '',
    birthdate: '', sex: '',
    placeOfBirth: '', placeOfBirthOther: '', placeOfBirthCity: '', placeOfBirthCityOther: '',
    citizenship: '', citizenshipOther: '', religion: '', religionOther: '',
    presentAddress: '', sameAddress: null, permanentAddress: '',
    motherName: '', motherOccupation: '', motherMobile: '', motherEmail: '',
    fatherName: '', fatherOccupation: '', fatherMobile: '', fatherEmail: '',
    emergencyName: '', emergencyContact: '', emergencyRelation: '',
    previouslyDiagnosed: null, diagnosis: '', otherDisability: null, disability: '', allergies: '',
    iepLevel: '',
    parentSignature: null, parentPrintedName: '',
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const setName = (k) => (e) => setF((s) => ({ ...s, [k]: sanitizeName(e.target.value) }))
  const setPhone = (k) => (e) => setF((s) => ({ ...s, [k]: formatPHMobile(e.target.value) }))

  // Submit-error spotlight: which field group failed validation. Drives the
  // red highlight; fail() also toasts (the inline error box sits at the top
  // of a long form, invisible from the Submit button) and scrolls to +
  // focuses the field. Cleared on every submit attempt, replaced on failure.
  const [fieldErr, setFieldErr] = useState(null)
  const inputClsFor = (key) => (fieldErr === key
    ? 'w-full rounded-lg border-2 border-rose-400 bg-rose-50/60 px-3 py-2.5 text-base text-slate-800 placeholder-slate-400 ring-2 ring-rose-200 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 sm:py-2 sm:text-sm'
    : inputCls)
  const spotlightCls = (key) => (fieldErr === key ? 'rounded-lg ring-2 ring-rose-400 ring-offset-2' : '')
  const fail = (key, message) => {
    setFieldErr(key)
    setErr(message)
    toast.error(message)
    // Let React paint the highlight first, then bring the field into view.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const anchor = document.getElementById(`apply-${key}`)
        if (!anchor) return
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
        anchor.querySelector('input, select, textarea, button')?.focus({ preventScroll: true })
      })
    })
  }

  useEffect(() => {
    let on = true
    api
      .applyMeta(code)
      .then((d) => {
        if (on) setClinicName(d.clinic?.name || '')
      })
      .catch(() => {
        if (on) setCodeError('Unknown clinic code. Please scan the QR code again or ask the clinic for the correct link.')
      })
    return () => {
      on = false
    }
  }, [code])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setFieldErr(null)
    if (!f.lastName.trim() || !f.firstName.trim()) return fail('childName', 'Last name and first name are required.')
    if (!f.birthdate) return fail('birthdate', 'Birthdate is required.')
    if (new Date(f.birthdate) > new Date()) return fail('birthdate', 'Birthdate cannot be in the future.')
    if (!f.sex) return fail('sex', 'Sex is required.')
    if (!finalBirthplace(f.placeOfBirth, f.placeOfBirthOther, f.placeOfBirthCity, f.placeOfBirthCityOther)) return fail('placeOfBirth', 'Place of birth is required.')
    if (!finalOption(f.citizenship, f.citizenshipOther)) return fail('citizenship', 'Citizenship is required.')
    if (!finalOption(f.religion, f.religionOther)) return fail('religion', 'Religion is required.')
    if (!f.presentAddress.trim()) return fail('presentAddress', 'Present address is required.')
    if (!f.motherName.trim() || !f.motherOccupation.trim() || !isValidPHMobile(f.motherMobile)) return fail('mother', 'Mother/guardian name, occupation, and a valid 09xx mobile number are required.')
    if (!f.fatherName.trim() || !f.fatherOccupation.trim() || !isValidPHMobile(f.fatherMobile)) return fail('father', 'Father/guardian name, occupation, and a valid 09xx mobile number are required.')
    if (!f.emergencyName.trim() || !isValidPHMobile(f.emergencyContact) || !finalOption(f.emergencyRelation, '')) return fail('emergency', 'Emergency contact name, valid mobile number, and relation are required.')
    if (f.previouslyDiagnosed === null) return fail('previouslyDiagnosed', 'Please answer whether the student was previously diagnosed.')
    if (f.previouslyDiagnosed && !f.diagnosis.trim()) return fail('diagnosis', 'Please specify the diagnosis.')
    if (f.otherDisability === null) return fail('otherDisability', 'Please answer whether the student has another disability.')
    if (f.otherDisability && !f.disability.trim()) return fail('disability', 'Please specify the disability or impairment.')
    if (!f.allergies.trim()) return fail('allergies', 'Allergies are required (write "None" if there are none).')
    if (!f.iepLevel) return fail('iepLevel', 'Please choose an enrollment type.')
    if (!f.parentSignature) return fail('parentSignature', 'Parent signature is required.')
    if (!f.parentPrintedName.trim()) return fail('parentPrintedName', 'Parent printed name is required.')

    setBusy(true)
    try {
      await api.submitApplication({
        clinic_code: code,
        child: {
          first_name: f.firstName.trim(),
          middle_name: f.middleName.trim() || null,
          last_name: f.lastName.trim(),
          suffix_name: f.suffixName.trim() || null,
          nick_name: f.nickName.trim() || null,
          date_of_birth: f.birthdate,
          sex: f.sex,
          home_address: f.presentAddress.trim(),
          permanent_address: f.sameAddress ? f.presentAddress.trim() : f.permanentAddress.trim() || f.presentAddress.trim(),
          place_of_birth: finalBirthplace(f.placeOfBirth, f.placeOfBirthOther, f.placeOfBirthCity, f.placeOfBirthCityOther),
          citizenship: finalOption(f.citizenship, f.citizenshipOther),
          religion: finalOption(f.religion, f.religionOther),
        },
        mother: {
          full_name: f.motherName.trim(),
          occupation: f.motherOccupation.trim(),
          contact_number: f.motherMobile,
          email: f.motherEmail.trim() || null,
        },
        father: {
          full_name: f.fatherName.trim(),
          occupation: f.fatherOccupation.trim(),
          contact_number: f.fatherMobile,
          email: f.fatherEmail.trim() || null,
        },
        emergency: {
          full_name: f.emergencyName.trim(),
          contact_number: f.emergencyContact,
          relationship: finalOption(f.emergencyRelation, ''),
        },
        clinical: {
          previously_diagnosed: f.previouslyDiagnosed,
          other_disability: f.otherDisability,
          primary_diagnosis: f.previouslyDiagnosed ? f.diagnosis.trim() : null,
          secondary_diagnosis: f.otherDisability ? f.disability.trim() : null,
          allergies: f.allergies.trim(),
        },
        iep_level: f.iepLevel,
        photo_data_url: photo,
        parent_signature: f.parentSignature,
        parent_printed_name: f.parentPrintedName.trim(),
      })
      setDone(true)
      window.scrollTo(0, 0)
    } catch (e2) {
      const message = e2.message || 'Submission failed. Please try again.'
      setErr(message)
      toast.error(message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  if (codeError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-purple-50/50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="font-bold text-rose-700">Invalid application link</p>
          <p className="mt-2 text-sm text-slate-600">{codeError}</p>
        </div>
      </main>
    )
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-purple-50/50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">✓</div>
          <p className="mt-3 font-bold text-slate-800">Application received!</p>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. {clinicName || 'The clinic'} will review your admission details and contact you for the next steps.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-purple-50/50">
      <div className="mx-auto w-full max-w-3xl px-2 py-4 min-[360px]:px-3 min-[360px]:py-5 sm:px-6 sm:py-6">
        <div className="mb-4 min-[360px]:mb-5 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <img src="/logo-cymon.png" alt="ClearMind logo" className="h-10 w-10 object-contain min-[360px]:h-12 min-[360px]:w-12" />
            <span className="text-2xl tracking-wider text-purple-950 min-[360px]:text-3xl" style={{ fontFamily: 'Against' }}>ClearMind</span>
          </div>
          <h1 className="mt-2 text-lg font-extrabold tracking-tight text-purple-950 min-[360px]:text-xl sm:text-2xl">Student Admission Application</h1>
          {clinicName ? (
            <p className="mx-auto mt-2 w-fit rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-800">
              Applying to: {branchApplyLabel({ code, name: clinicName })}
            </p>
          ) : null}
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{err}</div>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <Card eyebrow="01" title="Personal Information">
            <div className="grid grid-cols-1 gap-3 min-[360px]:gap-4 sm:grid-cols-2">
              <Field label="Last Name" fieldId="childName"><input className={inputClsFor('childName')} value={f.lastName} onChange={setName('lastName')} maxLength={30} /></Field>
              <Field label="First Name"><input className={inputClsFor('childName')} value={f.firstName} onChange={setName('firstName')} maxLength={30} /></Field>
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
                      setF((s) => ({ ...s, suffixName: choice }))
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
              <Field label="Birthdate" fieldId="birthdate"><div className={spotlightCls('birthdate')}><DatePicker value={f.birthdate} onChange={(v) => setF((s) => ({ ...s, birthdate: v }))} max={TODAY} ariaLabel="Birthdate" /></div></Field>
              <Field label="Sex" fieldId="sex">
                <select className={inputClsFor('sex')} value={f.sex} onChange={set('sex')}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Place of Birth (Province)" fieldId="placeOfBirth">
                <select
                  className={inputClsFor('placeOfBirth')}
                  value={f.placeOfBirth}
                  onChange={(e) => setF((s) => ({ ...s, placeOfBirth: e.target.value, placeOfBirthCity: '', placeOfBirthCityOther: '' }))}
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
                      <select className={inputClsFor('placeOfBirth')} value={f.placeOfBirthCity} onChange={set('placeOfBirthCity')}>
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
                    <input className={inputClsFor('placeOfBirth')} value={f.placeOfBirthCityOther} onChange={set('placeOfBirthCityOther')} placeholder="Specify city / municipality (optional)" maxLength={60} />
                  )}
                </Field>
              ) : null}
              <Field label="Nickname"><input className={inputCls} value={f.nickName} onChange={setName('nickName')} maxLength={30} placeholder="Optional" /></Field>
              <Field label="Citizenship" fieldId="citizenship">
                <select className={inputClsFor('citizenship')} value={f.citizenship} onChange={set('citizenship')}>
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
              <Field label="Present Address" fieldId="presentAddress"><input className={inputClsFor('presentAddress')} value={f.presentAddress} onChange={set('presentAddress')} maxLength={255} /></Field>
              <Field label="Religion" fieldId="religion">
                <select className={inputClsFor('religion')} value={f.religion} onChange={set('religion')}>
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
                  value={f.sameAddress === null ? null : f.sameAddress ? 'Yes' : 'No'}
                  onChange={(v) => setF((s) => {
                    const same = v === 'Yes'
                    return { ...s, sameAddress: same, permanentAddress: same ? s.presentAddress : '' }
                  })}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Permanent Address (if not same as present address)">
                <input
                  className={inputCls}
                  value={f.sameAddress ? f.presentAddress : f.permanentAddress}
                  onChange={set('permanentAddress')}
                  placeholder="Same"
                  maxLength={255}
                  readOnly={f.sameAddress === true}
                />
              </Field>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wider text-purple-900">2×2 ID Photo (optional)</span>
              <PhotoCapture value={photo} onChange={setPhoto} square />
            </div>
          </Card>

          <Card eyebrow="02" title="Parent Information">
            <div className="grid grid-cols-1 gap-3 min-[360px]:gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-700">Mother / Guardian</div>
                <Field label="Name" fieldId="mother"><input className={inputClsFor('mother')} value={f.motherName} onChange={setName('motherName')} maxLength={60} /></Field>
                <Field label="Occupation"><input className={inputClsFor('mother')} value={f.motherOccupation} onChange={set('motherOccupation')} maxLength={60} /></Field>
                <Field label="Mobile Number"><input className={inputClsFor('mother')} value={f.motherMobile} onChange={setPhone('motherMobile')} placeholder="09xx xxx xxxx" inputMode="numeric" /></Field>
                <Field label="Email Address"><input type="email" className={inputCls} value={f.motherEmail} onChange={set('motherEmail')} placeholder="Optional" maxLength={80} /></Field>
              </div>
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-700">Father / Guardian</div>
                <Field label="Name" fieldId="father"><input className={inputClsFor('father')} value={f.fatherName} onChange={setName('fatherName')} maxLength={60} /></Field>
                <Field label="Occupation"><input className={inputClsFor('father')} value={f.fatherOccupation} onChange={set('fatherOccupation')} maxLength={60} /></Field>
                <Field label="Mobile Number"><input className={inputClsFor('father')} value={f.fatherMobile} onChange={setPhone('fatherMobile')} placeholder="09xx xxx xxxx" inputMode="numeric" /></Field>
                <Field label="Email Address"><input type="email" className={inputCls} value={f.fatherEmail} onChange={set('fatherEmail')} placeholder="Optional" maxLength={80} /></Field>
              </div>
            </div>
          </Card>

          <Card eyebrow="03" title="Emergency Contact Information">
            <div className="grid grid-cols-1 gap-3 min-[360px]:gap-4 sm:grid-cols-3">
              <Field label="Name of Emergency Contact Person" fieldId="emergency"><input className={inputClsFor('emergency')} value={f.emergencyName} onChange={setName('emergencyName')} maxLength={60} /></Field>
              <Field label="Contact Number"><input className={inputClsFor('emergency')} value={f.emergencyContact} onChange={setPhone('emergencyContact')} placeholder="09xx xxx xxxx" inputMode="numeric" /></Field>
              <Field label="Relation to the Client">
                <select className={inputClsFor('emergency')} value={f.emergencyRelation} onChange={set('emergencyRelation')}>
                  <option value="">Select</option>
                  {EMERGENCY_RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card eyebrow="04" title="Diagnosis & Disability">
            <div className="space-y-4">
              <Field label="Was the student previously diagnosed / assessed?" fieldId="previouslyDiagnosed">
                <div className={spotlightCls('previouslyDiagnosed')}>
                <TogglePill options={['Yes', 'No']} value={f.previouslyDiagnosed === null ? null : f.previouslyDiagnosed ? 'Yes' : 'No'} onChange={(v) => { if (v == null) return; setF((s) => ({ ...s, previouslyDiagnosed: v === 'Yes', diagnosis: v === 'Yes' ? s.diagnosis : '' })) }} />
                </div>
              </Field>
              {f.previouslyDiagnosed ? (
                <Field label="Diagnosis" fieldId="diagnosis"><input className={inputClsFor('diagnosis')} value={f.diagnosis} onChange={set('diagnosis')} placeholder="Specify the diagnosis" maxLength={255} /></Field>
              ) : null}
              <Field label="Does the student have other disability/impairment that will hinder the program?" fieldId="otherDisability">
                <div className={spotlightCls('otherDisability')}>
                <TogglePill options={['Yes', 'No']} value={f.otherDisability === null ? null : f.otherDisability ? 'Yes' : 'No'} onChange={(v) => { if (v == null) return; setF((s) => ({ ...s, otherDisability: v === 'Yes', disability: v === 'Yes' ? s.disability : '' })) }} />
                </div>
              </Field>
              {f.otherDisability ? (
                <Field label="Disability / Impairment" fieldId="disability"><input className={inputClsFor('disability')} value={f.disability} onChange={set('disability')} placeholder="Specify the disability or impairment" maxLength={255} /></Field>
              ) : null}
              <Field label="Allergies" fieldId="allergies">
                <textarea className={`${inputClsFor('allergies')} min-h-20`} value={f.allergies} onChange={set('allergies')} placeholder='Write "None" if there are none' maxLength={500} />
              </Field>
            </div>
          </Card>

          <Card eyebrow="05" title="Enrollment Type">
            <div id="apply-iepLevel" style={{ scrollMarginTop: '1rem' }} className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${spotlightCls('iepLevel')}`}>
              {ENROLLMENT.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setF((s) => ({ ...s, iepLevel: o.value }))}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${f.iepLevel === o.value ? 'border-purple-400 bg-purple-50' : 'border-purple-200 hover:border-purple-300 hover:bg-purple-50/50'}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${f.iepLevel === o.value ? 'border-purple-600' : 'border-slate-300'}`}>
                    {f.iepLevel === o.value ? <span className="h-2 w-2 rounded-full bg-purple-600" /> : null}
                  </span>
                  <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: o.color }}>
                    {o.code}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{o.label}</span>
                    {o.detail ? <span className="block text-[11px] text-slate-500">{o.detail}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card eyebrow="06" title="Parent E-Signature">
            <Field label="Signature over printed name of parent" fieldId="parentSignature">
              <div className={spotlightCls('parentSignature')}>
              <SignaturePad label="Parent signature" value={f.parentSignature} onChange={(v) => setF((s) => ({ ...s, parentSignature: v }))} />
              </div>
            </Field>
            <div className="mt-3">
              <Field label="Printed Name" fieldId="parentPrintedName"><input className={inputClsFor('parentPrintedName')} value={f.parentPrintedName} onChange={setName('parentPrintedName')} placeholder="Printed Name" maxLength={60} /></Field>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              By signing, you confirm the details above are true and allow the clinic to process this admission application.
            </p>
          </Card>

          <Button type="submit" disabled={busy} className="w-full py-3 text-base">
            {busy ? 'Submitting…' : 'Submit Application'}
          </Button>
          <p className="pb-4 text-center text-[11px] text-slate-400">
            The clinic will review your application and contact you for the next steps.
          </p>
        </form>
      </div>
    </main>
  )
}

export default Apply
