import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from './PageHeader'
import { FileText } from 'lucide-react'
import Input from '../../components/ui/Input'
import DatePicker from '../../components/ui/DatePicker'
import Checkbox from '../../components/ui/Checkbox'
import Button from '../../components/ui/Button'
import SignaturePad, { SavedSignature } from '../../components/ui/SignaturePad'
import { SkeletonWaiverDetail } from '../../components/ui/Skeleton'
import FormHeading from '../../components/ui/FormHeading'
import OfficialPdfPreview from '../../components/ui/OfficialPdfPreview'
import { api } from '../../lib/api'
import { formatPHMobile } from '../../lib/format'
import { SPED_CLAUSES, SPED_HOUSE_RULES } from '../../lib/waiverClauses'

const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '—')
const PROVISIONS = SPED_CLAUSES.map((c) => ({
  title: c.numeral ? `${c.numeral}. ${c.title}` : c.title,
  body: c.body.join(' '),
}))
const RULES = SPED_HOUSE_RULES.map((r) => `${r.title}: ${r.text}`)

const Line = ({ label, value, labelClassName = 'w-56' }) => (
  <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(210px,260px)_1fr] sm:items-center sm:gap-3 py-0.5">
    <div className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors ${labelClassName}`}>
      {label}
    </div>
    <div className="min-w-0 border-b border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[12px] font-medium text-purple-950 dark:text-purple-300 transition-colors">
      {value || '—'}
    </div>
  </div>
)

const SectionBlock = ({ title, children, className = '' }) => (
  <section className={`space-y-2 ${className}`}>
    <FormHeading numeral="">{title}</FormHeading>
    <div>{children}</div>
  </section>
)

const SignatureBox = ({ label, signature, name, meta = [] }) => (
  <div className="rounded-md border border-slate-900/20 dark:border-slate-700 p-3 transition-colors">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">{label}</div>
    <div className="mt-2">
      {signature ? (
        <SavedSignature image={signature} alt={label} sealed />
      ) : (
        <div className="flex min-h-24 items-center justify-center overflow-hidden rounded bg-white p-2 text-sm italic text-slate-400 dark:text-slate-500 transition-colors">No signature on record</div>
      )}
    </div>
    <div className="mt-2 text-center">
      <div className="text-[11px] font-semibold text-purple-950 dark:text-purple-300 transition-colors">{name || '—'}</div>
      {meta.length ? (
        <div className="mt-1 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 transition-colors">
          {meta.map((item) => (
            <div key={item.label}>
              <span className="font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 transition-colors">{item.label}: </span>
              <span className="font-medium text-slate-600 dark:text-slate-300 transition-colors">{item.value || '—'}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
    <div className="mt-2 border-t border-slate-700 dark:border-slate-600 transition-colors" />
    <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 transition-colors">
      Signature over Printed Name / Date
    </div>
  </div>
)

function WaiverDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const code = decodeURIComponent(id || '')
  const [signature, setSignature] = useState(null)
  const [agreed, setAgreed] = useState({})
  const [houseRules, setHouseRules] = useState(false)
  const [ack, setAck] = useState({ parent_name: '', date: '', child_name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [patientData, setPatientData] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [repSignature, setRepSignature] = useState(null)
  const [repName, setRepName] = useState('')
  const [repDate, setRepDate] = useState('')

  useEffect(() => {
    let on = true

    const loadWaiver = async () => {
      try {
        const d = await api.client.waiverDetails(code)
        if (!on) return
        if (d.submission) {
          setSubmission(d.submission)
          const sa = d.submission.provisions_agreed || {}
          const storedAcknowledgements = sa.acknowledgements || sa
          const sourceClauses = PROVISIONS
          setAgreed(
            Object.fromEntries(
              sourceClauses.map((_, index) => [
                String(index),
                storedAcknowledgements[`clause_${index}`] ?? storedAcknowledgements[String(index)] ?? false,
              ]),
            ),
          )
          setHouseRules(d.submission.house_rules_agreed)
          setAck({
            parent_name: sa.parent_name || d.submission.signature_text || '',
            parent_contact: sa.parent_contact || '',
            date: sa.parent_date
              ? sa.parent_date.slice(0, 10)
              : sa.date
                ? sa.date.slice(0, 10)
                : (d.submission.signed_at ? d.submission.signed_at.slice(0, 10) : ''),
            child_name: sa.child_name || '',
          })
          setSignature(sa.signature_image || null)
          setRepSignature(sa.rep_signature_image || null)
          setRepName(sa.rep_name || '')
          setRepDate(sa.rep_date ? sa.rep_date.slice(0, 10) : '')
        }
      } catch {
        // Keep showing the form shell when an optional prefill fetch fails.
      }

      if (['CMPS:SE-FO-01', 'CMPS:SE-FO-02'].includes(code)) {
        try {
          const pd = await api.client.getPatient()
          if (!on) return
          setPatientData(pd)
          setAck((prev) => ({
            ...prev,
            parent_name: prev.parent_name || pd.guardian?.full_name || pd.guardians?.[0]?.full_name || '',
            child_name: prev.child_name || `${pd.patient?.first_name || ''} ${pd.patient?.last_name || ''}`.trim(),
            date: prev.date || new Date().toISOString().slice(0, 10),
          }))
          // NOTE: the saved parent_signature is deliberately NOT auto-applied
          // here. Each document needs its own deliberate signing act — silently
          // reusing the admission ink on a new waiver misrepresents consent.
          // The form offers an explicit "Use saved signature" button instead.
        } catch {
          // Prefill is best-effort; the guardian can still type the fields.
        }
      }

      if (on) setLoading(false)
    }

    loadWaiver()
    return () => {
      on = false
    }
  }, [code])

  const [searchParams] = useSearchParams()
  const isViewMode = searchParams.get('view') === 'true'
  const isAdmissionForm = code === 'CMPS:SE-FO-01'
  const isAdmissionComplete = isAdmissionForm && patientData?.patient?.admission_form_status === 'complete'
  const isReadOnly = isViewMode || isAdmissionComplete || Boolean(submission && ['submitted', 'approved'].includes(submission.status))
  const [pdfPreview, setPdfPreview] = useState(null)

  const previewOfficialPdf = () => {
    setPdfPreview({
      title: `${formTitle} · ${patientData?.patient?.full_name || patientData?.patient?.patient_id || 'Student'}`,
      filename: `${patientData?.patient?.patient_id || 'student'}-${code.replace(/[:]/g, '-')}.pdf`,
      loadPdf: () => api.client.downloadFormPdf(code),
    })
  }

  const provisionsList = PROVISIONS
  const rulesList = RULES

  const formTitle = isAdmissionForm
    ? 'STUDENT ADMISSION & REGISTRATION'
    : 'SPECIAL EDUCATION (SPED) PROGRAM PARENT / CAREGIVER CONSENT AND WAIVER FORM'

  const formCode = isAdmissionForm
    ? 'CMPS:SE-FO-01 rev.0 02192026'
    : 'CMPS:SE-FO-02 rev.0 02192026'

  const loadOfficialPdf = useCallback(() => api.client.downloadFormPdf(code), [code])

  const provisionKeys = provisionsList.map((_, index) => String(index))

  const toggleProvision = (key) => {
    if (isReadOnly) return
    setAgreed((a) => ({ ...a, [key]: !a[key] }))
    setError(null)
  }

  const setAckField = (k) => (e) => {
    if (isReadOnly) return
    setAck((x) => ({ ...x, [k]: e.target.value }))
    setError(null)
  }

  const setPhoneField = (k) => (e) => {
    if (isReadOnly) return
    setAck((x) => ({ ...x, [k]: formatPHMobile(e.target.value) }))
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!isAdmissionForm) {
      if (!provisionKeys.every((k) => agreed[k])) {
        setError('Please agree to all provisions before submitting.')
        return
      }
      if (!houseRules) {
        setError('Please acknowledge the clinic house rules.')
        return
      }
      if (!ack.parent_name.trim()) {
        const msg = 'Parent / guardian full name is required.'
        setError(msg)
        toast.error(msg)
        return
      }
      if (!ack.parent_contact?.trim()) {
        const msg = 'Parent / guardian contact number is required.'
        setError(msg)
        toast.error(msg)
        return
      }
    }
    if (!signature) {
      const msg = 'Parent / guardian e-signature is required.'
      setError(msg)
      toast.error(msg)
      return
    }

    setSubmitting(true)
    try {
      await api.client.submitWaiver(code, {
        provisions_agreed: {
          ...agreed,
          parent_name: ack.parent_name.trim(),
          parent_contact: ack.parent_contact?.trim(),
          date: ack.date || new Date().toISOString().slice(0, 10),
          child_name: ack.child_name.trim(),
          signature_image: signature,
          rep_signature_image: repSignature,
          rep_name: repName.trim(),
          rep_date: repDate || new Date().toISOString().slice(0, 10),
        },
        house_rules_agreed: isAdmissionForm ? true : houseRules,
        signature_text: ack.parent_name.trim(),
      })
      navigate('/client/waivers')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderAdmissionForm = () => {
    const p = patientData?.patient || {}
    const g = patientData?.guardian || patientData?.guardians?.[0] || {}
    const em = patientData?.emergency || {}
    const cl = patientData?.clinical || {}
    const assignedPsychologist = p.treating_psychologist || cl.treating_psychologist || null
    const assignedPsychometrician = p.treating_psychometrician || cl.treating_psychometrician || null
    const repPerson = assignedPsychometrician || assignedPsychologist

    return (
      <div className="space-y-5">
        <SectionBlock title="Personal Information">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_170px]">
            <div className="space-y-0.5">
              <Line label="Last Name" value={p.last_name} />
              <Line label="First Name" value={p.first_name} />
              <Line label="Middle Name" value={p.middle_name} />
              <Line label="Birthdate (Month/Day/Date)" value={p.date_of_birth} />
              <Line label="Place of Birth" value={p.place_of_birth} />
              <Line label="Age" value={p.age} />
              <Line label="Sex" value={cap(p.sex)} />
              <Line label="Nickname" value={p.nick_name} />
              <Line label="Present Address" value={p.home_address} />
              <Line label="Permanent Address" value={p.permanent_address || 'Same as present address'} />
              <Line label="Citizenship" value={p.citizenship} />
              <Line label="Religion" value={p.religion} />
            </div>

            <div className="shrink-0">
              <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                2X2 ID Picture
              </div>
              <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden border border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-400 dark:text-slate-500 transition-colors sm:h-40 sm:w-40">
                {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : '2X2'}
              </div>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock title="Parent Information">
          <div className="space-y-0.5">
            <Line label="Name of Mother / Guardian" value={g.full_name || g.name} />
            <Line label="Occupation" value={g.occupation} />
            <Line label="Mobile Number" value={g.contact_number} />
            <Line label="Email Address" value={g.email} />
            <Line label="Name of Father / Guardian" value={patientData?.guardians?.find((x) => x.relationship === 'Father')?.full_name} />
            <Line label="Occupation" value={patientData?.guardians?.find((x) => x.relationship === 'Father')?.occupation} />
            <Line label="Mobile Number" value={patientData?.guardians?.find((x) => x.relationship === 'Father')?.contact_number} />
            <Line label="Email Address" value={patientData?.guardians?.find((x) => x.relationship === 'Father')?.email} />
          </div>
        </SectionBlock>

        <SectionBlock title="Emergency Contact Information">
          <div className="space-y-0.5">
            <Line label="Name of Emergency Contact Person" value={em.full_name} labelClassName="w-64" />
            <Line label="Contact Number" value={em.contact_number} labelClassName="w-64" />
            <Line label="Relation to the Client" value={em.relationship} labelClassName="w-64" />
          </div>
        </SectionBlock>

        <SectionBlock title="Clinical Details">
          <div className="space-y-0.5">
            <Line label="Diagnosis" value={cl.primary_diagnosis} />
            <Line label="Disability / Impairment" value={cl.secondary_diagnosis} />
            <Line label="Allergies" value={cl.allergies || 'None'} />
            <Line label="Enrollment Type" value={cl.iep_level || '—'} />
          </div>
        </SectionBlock>

        <SectionBlock title="Signatures">
          <div className="grid gap-4 sm:grid-cols-2">
            {isReadOnly ? (
              <SignatureBox
                label="Parent / Guardian Signature"
                signature={signature || p.parent_signature}
                name={ack.parent_name || g.full_name || '—'}
              />
            ) : (
              <div className="rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 transition-colors">
                <SignaturePad
                  label="Parent / Guardian E-Signature"
                  value={signature}
                  onChange={(val) => {
                    setSignature(val)
                    setError(null)
                  }}
                />
              </div>
            )}
            <SignatureBox
              label="CMPS Representative Signature"
              signature={repSignature || p.rep_signature}
              name={repName || repPerson?.name || p.rep_printed_name || '—'}
              meta={[
                { label: 'Profession', value: repPerson?.profession || '—' },
                { label: 'PRC No.', value: repPerson?.prc_id || '—' },
              ]}
            />
          </div>
        </SectionBlock>
      </div>
    )
  }

  const renderConsentForm = () => {
    const progressTotal = provisionKeys.length + (rulesList.length > 0 ? 1 : 0)
    const progressDone = provisionKeys.filter((k) => agreed[k]).length + (houseRules ? 1 : 0)
    const progressPct = progressTotal ? (progressDone / progressTotal) * 100 : 0

    return (
      <div className="space-y-5">
        <section className="sticky top-0 z-20 rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-4 shadow-sm sm:p-5 shadow-purple-900/5 transition-colors">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
            <span className="font-semibold text-[#8B6BAE] dark:text-purple-400 transition-colors">Acknowledgment status</span>
            <span className="text-right">{progressDone}/{progressTotal} items acknowledged</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 transition-colors">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-purple-700 dark:bg-purple-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {provisionKeys.every((k) => agreed[k]) && houseRules ? (
            <div className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors">✓ All sections have been read and acknowledged</div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-5 transition-colors">
          <FormHeading numeral="">Read each section and confirm</FormHeading>
          <div className="flex flex-col gap-4">
            {provisionsList.map((p, idx) => {
              const itemKey = idx.toString()
              return (
                <div key={itemKey} className="rounded-xl border border-[#E4DCEF] dark:border-slate-800 bg-[#FCFAFF] dark:bg-slate-800/50 p-4 transition-colors">
                  <div className="text-sm font-semibold text-[#38224F] dark:text-purple-300 transition-colors">{p.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300 transition-colors">{p.body}</p>
                  <Checkbox
                    className="mt-2"
                    label={`I have read, understood, and agree to the terms as cited in ${p.title.split('.')[0] ? `Item ${p.title.split('.')[0]}.` : 'this document.'}`}
                    checked={!!agreed[itemKey]}
                    onChange={() => toggleProvision(itemKey)}
                    disabled={isReadOnly}
                  />
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-5 transition-colors">
          <FormHeading numeral="">Cymon's House Rules</FormHeading>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300 transition-colors">
            {rulesList.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
          <Checkbox
            className="mt-3"
            label="I have read, understood, and agree to the terms as cited in the House Rules."
            checked={houseRules}
            onChange={(e) => {
              if (isReadOnly) return
              setHouseRules(e.target.checked)
              setError(null)
            }}
            disabled={isReadOnly}
          />
        </section>

        <section className="rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-[#F5F1FA] dark:bg-slate-800/50 p-4 shadow-sm sm:p-5 transition-colors">
          <div className="text-base font-semibold text-[#38224F] dark:text-purple-300 transition-colors" style={{ fontFamily: 'Fraunces, serif' }}>
            Parent / Caregiver Acknowledgement Form
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300 transition-colors">
            I, <strong>{ack.parent_name || '______________________'}</strong>, the parent/legal guardian of{' '}
            <strong>{ack.child_name || '______________________'}</strong>, hereby voluntarily enroll my child
            in the Special Education (SPED) Program of{' '}
            <strong>CLEARMIND PSYCHOLOGICAL SERVICES</strong>. By signing below, I affirm that I have read and
            understood the contents of this consent and waiver form and voluntarily agree to its terms.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Parent / Guardian Full Name" tone="purple" value={ack.parent_name} onChange={setAckField('parent_name')} disabled={isReadOnly} />
            <Input label="Parent Contact Number" tone="purple" type="tel" inputMode="numeric" maxLength={13} placeholder="09** *** ****" value={ack.parent_contact || ''} onChange={setPhoneField('parent_contact')} disabled={isReadOnly} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-violet dark:text-purple-400">Date</label>
              <DatePicker value={ack.date} onChange={(v) => { if (isReadOnly) return; setAck((x) => ({ ...x, date: v })); setError(null) }} disabled={isReadOnly} ariaLabel="Acknowledgement date" />
            </div>
            <Input label="Child / Student Full Name" tone="purple" value={ack.child_name} onChange={setAckField('child_name')} disabled={isReadOnly} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 transition-colors">
              <div className="mb-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 transition-colors">Parent / Guardian Signature</div>
              {isReadOnly ? (
                <>
                  {signature ? (
                    <SavedSignature image={signature} alt="Signature" sealed />
                  ) : (
                    <div className="text-sm italic text-slate-400 dark:text-slate-500 transition-colors">No signature image submitted</div>
                  )}
                  {/* Printed name + signing date, mirroring the CMPS
                      Representative side — the sealed box alone hides who
                      signed and when. */}
                  <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{ack.parent_name || '—'}</div>
                  {ack.date ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">Date: {ack.date}</div> : null}
                </>
              ) : (
                <SignaturePad label="Parent / Guardian E-Signature" value={signature} onChange={(val) => {
                  setSignature(val)
                  setError(null)
                }} />
              )}
              {!isReadOnly ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-violet dark:text-purple-400">Date</label>
                  <DatePicker value={ack.date} onChange={(v) => { if (isReadOnly) return; setAck((x) => ({ ...x, date: v })); setError(null) }} disabled={isReadOnly} ariaLabel="Acknowledgement date" />
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 transition-colors">
              <div className="mb-2 text-xs font-semibold text-purple-800 dark:text-purple-400 transition-colors">CMPS Representative</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{repName || '—'}</div>
              {repSignature ? (
                // Anti-forgery: the client never sees the representative's ink —
                // same sealed indicator as the parent side. The full signature
                // stays visible solely on the admin-generated official PDF.
                <div className="mt-2">
                  <SavedSignature image={repSignature} alt="Rep Signature" sealed />
                </div>
              ) : (
                <div className="mt-2 text-sm italic text-slate-400 dark:text-slate-500 transition-colors">Pending clinic representative signature</div>
              )}
              {repDate ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">Date: {repDate}</div> : null}
            </div>
          </div>
        </section>
      </div>
    )
  }

  const footer = isReadOnly ? (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-purple-900 dark:text-purple-300 transition-colors">Ready to export</div>
        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400 transition-colors">
          Preview the generated database-backed PDF before downloading it.
        </div>
      </div>
      <button
        onClick={previewOfficialPdf}
        className="cymon-preview-btn w-full sm:w-auto"
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
  ) : (
    <div className="flex items-center justify-between">
      <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
        {submission?.status === 'returned' ? 'Update the form per the clinic note above, then re-submit.' : 'Please complete all required fields and signatures above.'}
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {submitting ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="relative z-10">{submitting ? 'Submitting...' : 'Submit Form'}</span>
      </button>
    </div>
  )


  /* The legacy React-rendered form remains below for reference only. */
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #waiver-detail-shell, #waiver-detail-shell * { visibility: visible !important; }
          #waiver-detail-shell {
            position: relative !important;
            inset: auto !important;
            width: 8.5in !important;
            min-height: 13in !important;
            background-color: #fff !important;
            background-image: url('/cmps-form-template.png') !important;
          }
          #waiver-detail-shell .no-print {
            display: none !important;
          }
        }
      `}</style>
      <PageHeader title="Consents & Waivers" />
      <div id="waiver-detail-shell" className="cmps-print-document cmps-print-page flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <div className="no-print flex items-center justify-between gap-3">
            <button
              onClick={() => navigate('/client/waivers')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 shadow-sm hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="rounded-3xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-6 lg:p-8 print:border-0 print:bg-transparent print:p-0 print:shadow-none transition-colors">
            <div className="border-b border-purple-50 dark:border-slate-800 pb-4 transition-colors">
              <div className="text-2xl font-bold text-[#4C1D95] dark:text-purple-300 transition-colors">{formTitle}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">{formCode}</div>
            </div>

            {submission?.status === 'returned' && submission.review_comment ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-4 py-3.5 transition-colors">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                <div>
                  <div className="text-sm font-bold text-violet-800 dark:text-violet-300 transition-colors">Returned for Revision</div>
                  <div className="mt-1 text-sm leading-6 text-violet-700 dark:text-violet-200 transition-colors">
                    <span className="font-semibold">Clinic note:</span> {submission.review_comment}
                  </div>
                  <div className="mt-2 text-xs text-violet-600/70 dark:text-violet-300/70 transition-colors">
                    Please update the details above and re-submit the form.
                  </div>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="pt-5">
                <SkeletonWaiverDetail />
              </div>
            ) : (
              <div className="space-y-6 pt-5 animate-content-fade-in">
                {isAdmissionForm ? renderAdmissionForm() : renderConsentForm()}
                {error ? <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 transition-colors">{error}</div> : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="no-print print:hidden sticky bottom-0 border-t border-purple-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-3 shadow-[0_-8px_24px_rgba(88,28,135,0.08)] backdrop-blur sm:px-6 transition-colors">
        <div className="mx-auto max-w-6xl">{footer}</div>
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
    </>
  )
}

export default WaiverDetail
