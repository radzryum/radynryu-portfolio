import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-hot-toast'
import DatePicker from '../../../components/ui/DatePicker'
import FormShell from '../../../components/ui/FormShell'
import FormHeading from '../../../components/ui/FormHeading'
import SignaturePad, { SavedSignature } from '../../../components/ui/SignaturePad'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import FormActionButtons from '../../../components/ui/FormActionButtons'
import ReviewSessionNotice from '../../../components/ui/ReviewSessionNotice'
import ScrollTopButton from '../../../components/ui/ScrollTopButton'
import { api } from '../../../lib/api'
import { capitalizeName } from '../../../lib/format'

const TEXT_LIMIT = 400
const TITLE_LIMIT = 100
const COMMENT_LIMIT = 100
const todayIso = () => new Date().toISOString().slice(0, 10)

const DOMAINS = [
  'Cognitive',
  'Emotional Regulation',
  'Social Skills',
  'Communication',
  'Attention & Focus',
  'Self-Help / Adaptive',
  'Sensory',
  'Behavioral',
  'Academic Readiness',
]

const emptyForm = (patientId = '', date = '') => ({
  session_number: '',
  patient_id: patientId,
  activity_title: '',
  target_domain: '',
  objectives: '',
  procedure: '',
  session_date: date || todayIso(),
  observations: '',
})

const formFromDetail = (detail, patientId, date) =>
  detail
    ? {
        id: detail.id,
        session_number: detail.session_number ?? '',
        patient_id: detail.patient_id || patientId || '',
        activity_title: detail.detail || detail.activity_title || '',
        target_domain: detail.target_domain || '',
        objectives: detail.objectives || '',
        procedure: detail.procedure || '',
        session_date: detail.date ? String(detail.date).slice(0, 10) : date || todayIso(),
        observations: detail.observations || '',
      }
    : emptyForm(patientId, date)

const profileName = (profile) =>
  capitalizeName(profile?.display_name || profile?.name || profile?.full_name) || 'NA'
const profileProfession = (profile, fallback) =>
  profile?.title || profile?.profession || fallback
const profileLicense = (profile) =>
  profile?.license_no || profile?.prc_no || profile?.prc_number || 'NA'

function SectionCard({ numeral, title, subtitle, children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
      <FormHeading numeral={numeral}>{title}</FormHeading>
      {subtitle ? <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">{subtitle}</p> : null}
      {children}
    </section>
  )
}

function DailyActivityReportForm({
  patient = null,
  patients = [],
  onSaved,
  onClose,
  detail = null,
  readOnly = false,
  initialPatientId = '',
  initialDate = '',
  embedded = false,
  inline = false,
  reviewerMode = false,
  reviewerProfile: reviewerProfileProp = null,
  reviewerSignature: reviewerSignatureProp = null,
  reviewerComment: reviewerCommentProp = '',
  reviewerBusy = false,
  onReviewerSignatureChange,
  onReviewerCommentChange,
  onReviewerReturn,
  onReviewerApprove,
  headerActionsTarget = null,
}) {
  const patientId = patient?.id || initialPatientId || detail?.patient_id || ''
  const selectedPatient =
    patient ||
    patients.find((item) => String(item.id) === String(patientId)) ||
    null

  const [form, setForm] = useState(() => formFromDetail(detail, patientId, initialDate))
  const [currentProfile, setCurrentProfile] = useState(null)
  const [patientDetails, setPatientDetails] = useState(selectedPatient)
  const [preparedSignature, setPreparedSignature] = useState(detail?.prepared_signature_image || null)
  const [preparedDate, setPreparedDate] = useState(detail?.prepared_signature_date || todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftId, setDraftId] = useState(detail?.id || null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  useEffect(() => {
    if (detail?.id) setDraftId(detail.id)
  }, [detail?.id])

  useEffect(() => {
    api.me()
      .then((data) => setCurrentProfile(data.profile || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const nextPatientId = patient?.id || initialPatientId || detail?.patient_id || ''
    setForm(formFromDetail(detail, nextPatientId, initialDate))
    setPreparedSignature(detail?.prepared_signature_image || null)
    setPreparedDate(detail?.prepared_signature_date || todayIso())
    setPatientDetails(
      patient ||
      patients.find((item) => String(item.id) === String(nextPatientId)) ||
      null,
    )
    setError('')

    if (!nextPatientId) return
    api.psychometrician
      .patient(nextPatientId)
      .then((data) => setPatientDetails(data.patient || null))
      .catch(() => {})
  }, [patient?.id, initialPatientId, detail?.id, detail?.date])

  const editableStatuses = ['draft', 'revise_requested']
  const effectiveReadOnly =
    readOnly ||
    (detail?.status ? !editableStatuses.includes(detail.status) : false)

  const preparedProfile =
    detail?.prepared_profile ||
    patientDetails?.treating_psychometrician ||
    currentProfile
  const reviewerProfile =
    reviewerProfileProp ||
    detail?.reviewer_profile ||
    patientDetails?.treating_psychologist ||
    null
  const reviewerSignature =
    reviewerSignatureProp ||
    detail?.reviewer_signature_image ||
    null
  const reviewerComment =
    reviewerCommentProp ||
    detail?.reviewer_comment ||
    ''
  const [pdfPreview, setPdfPreview] = useState(null)
  const [previewingPdf, setPreviewingPdf] = useState(false)
  
  const previewOfficialPdf = async () => {
    let reportIdToUse = draftId || detail?.id || form.id
    if (!effectiveReadOnly && !reviewerMode) {
      setPreviewingPdf(true)
      try {
        const res = await saveDraft(true)
        if (res?.id) reportIdToUse = res.id
      } catch (err) {
        toast.error('Failed to save draft before previewing.')
        setPreviewingPdf(false)
        return
      }
      setPreviewingPdf(false)
    }

    if (!reportIdToUse) {
      toast.error('Save the Daily Activity Report first so the official PDF can load its database record.')
      return
    }
    setPdfPreview({
      title: `Daily Activity Report – ${patientDetails?.full_name || 'Student'}`,
      filename: `${patientDetails?.patient_id || patientId}-CMPS-SE-FO-07.pdf`,
      loadPdf: () => api.psychometrician.downloadDocumentPdf('session_logs', reportIdToUse),
    })
  }

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const toggleDomain = (domain) => {
    const current = form.target_domain
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const next = current.includes(domain)
      ? current.filter((value) => value !== domain)
      : [...current, domain]
    setValue('target_domain', next.join(', '))
  }

  const validate = () => {
    const required = [
      ['session number', form.session_number],
      ['activity date', form.session_date],
      ['title of the activity', form.activity_title],
      ['at least one targeted domain', form.target_domain],
      ['objectives', form.objectives],
      ['activity procedure', form.procedure],
      ['responses / observations', form.observations],
    ]
    const missing = required.find(([, value]) => !String(value ?? '').trim())
    if (missing) return `Please complete ${missing[0]} before sending the DAR.`

    const sessionNumber = Number(form.session_number)
    if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 9999) {
      return 'Session number must be a whole number from 1 to 9999.'
    }
    if (form.session_date > todayIso()) return 'Activity date cannot be in the future.'
    if (!preparedSignature) return 'Please add the psychometrician signature before sending the DAR.'
    if (!preparedDate) return 'Please add the psychometrician signature date before sending the DAR.'
    return ''
  }

  const saveDraft = async (silent = false) => {
    if (reviewerMode || effectiveReadOnly) return null
    if (!patientId) return null

    if (!silent) setSavingDraft(true)
    try {
      const payload = {
        ...form,
        id: draftId || form.id || undefined,
        patient_id: patientId,
        status: detail?.status === 'revise_requested' ? 'revise_requested' : 'draft',
        prepared_signature_image: preparedSignature || undefined,
        prepared_signature_date: preparedDate,
      }
      const res = await api.psychometrician.addActivityLog(payload)
      if (res?.log?.id) {
        setDraftId(res.log.id)
      }
      setLastSaved(new Date())
      if (!silent) await onSaved?.()
      if (!silent) toast.success('Draft saved successfully.')
      return res?.log || null
    } catch (err) {
      if (!silent) toast.error('Failed to save draft.')
      throw err
    } finally {
      if (!silent) setSavingDraft(false)
    }
  }

  const saveDraftRef = useRef(saveDraft)
  useEffect(() => {
    saveDraftRef.current = saveDraft
  })

  useEffect(() => () => {
    saveDraftRef.current(true).catch(() => {})
  }, [])

  useEffect(() => {
    if (reviewerMode || effectiveReadOnly) return
    if (!patientId) return
    
    const timer = setTimeout(() => {
      saveDraft(true).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, preparedDate, preparedSignature])

  const send = async () => {
    if (!patientId) {
      const message = 'Please select a student before sending the DAR.'
      setError(message)
      toast.error(message)
      return
    }
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      toast.error(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.psychometrician.addActivityLog({
        ...form,
        id: draftId || form.id || undefined,
        patient_id: patientId,
        status: 'pending',
        prepared_signature_image: preparedSignature,
        prepared_signature_date: preparedDate,
      })
      toast.success('Daily Activity Report sent to the psychologist.')
      await onSaved?.()
      onClose?.()
    } catch (requestError) {
      const message = requestError.message || 'Unable to send the Daily Activity Report.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/20 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 transition-colors'
  const textareaClass =
    'w-full resize-y rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100 outline-none transition focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/20 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-400 transition-colors'

  const footerActions = (
    <div className="flex w-full flex-col gap-3 border-t border-purple-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-4 text-xs text-rose-600">{error}</div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={previewOfficialPdf}
          className="inline-flex min-w-40 items-center justify-center rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-5 py-3 text-sm font-semibold text-purple-700 shadow-sm transition hover:border-purple-300 hover:bg-purple-50"
        >
          Preview Official PDF
        </button>
        {reviewerMode ? (
          <>
            <button
              type="button"
              onClick={onReviewerReturn}
              disabled={reviewerBusy}
              className="inline-flex min-w-40 items-center justify-center rounded-xl border border-rose-300 bg-white dark:bg-slate-900 transition-colors px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewerBusy ? 'Saving...' : 'Return as Draft'}
            </button>
            <button
              type="button"
              onClick={onReviewerApprove}
              disabled={reviewerBusy || !reviewerSignatureProp}
              className="inline-flex min-w-52 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200"
            >
              {reviewerBusy
                ? 'Saving...'
                : reviewerSignatureProp
                  ? 'Approve & Sign'
                  : 'Add Signature to Approve'}
            </button>
          </>
        ) : !effectiveReadOnly ? (
          <>
            <button
              type="button"
              onClick={() => saveDraft()}
              disabled={saving || savingDraft}
              className="inline-flex min-w-32 items-center justify-center rounded-xl border border-slate-300 bg-white dark:bg-slate-900 transition-colors px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm transition hover:bg-slate-50 dark:bg-slate-950 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={saving || savingDraft}
              className="inline-flex min-w-52 items-center justify-center rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Sending...' : 'Send to Psychologist'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <FormActionButtons
        compact={true}
        previewOfficialPdf={previewOfficialPdf}
        previewingPdf={previewingPdf}
        reviewerMode={reviewerMode}
        reviewerBusy={reviewerBusy}
        reviewerSignature={reviewerSignatureProp}
        onReviewerReturn={onReviewerReturn}
        onReviewerApprove={onReviewerApprove}
        canSubmit={!effectiveReadOnly}
        onSubmit={send}
        submitting={saving}
        onSaveDraft={() => saveDraft()}
        savingDraft={savingDraft}
        lastSaved={lastSaved}
      />
    </div>
  )

  return (
    <FormShell
      title="Daily Activity Report"
      subtitle="Special Education Program"
      code="CMPS:SE-FO-08 rev.0 03032026"
      inline={embedded || inline}
      scrollable={!embedded}
      onClose={onClose}
      hideActions={true}
      wide
    >
      {headerActionsTarget
        ? createPortal(
            <div className="w-full print:hidden">{headerActions}</div>,
            headerActionsTarget,
          )
        : null}
      <div className="space-y-6 px-3 py-6 sm:px-6 lg:px-8">
        <div className="mb-2 text-center print:hidden">
          <h1 className="text-2xl font-black tracking-tight text-purple-900 uppercase">Daily Activity Report</h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-purple-600 uppercase">Special Education Program</p>
        </div>
        {!headerActionsTarget ? (
          <div className="no-print sticky top-0 z-30 -mx-3 mb-2 bg-[#efeaf7]/95 dark:bg-slate-900/95 px-3 pb-1 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {footerActions}
          </div>
        ) : null}

        {!reviewerMode && reviewerComment ? (
          <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-red-100 pb-3 text-red-800">
              <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-bold uppercase tracking-widest">Psychologist's Note for Revision</h3>
            </div>
            <div className="mt-3 text-sm font-medium leading-relaxed text-red-900 whitespace-pre-wrap break-words">
              {reviewerComment}
            </div>
          </div>
        ) : null}

        <fieldset disabled={effectiveReadOnly} className="space-y-6">
          <SectionCard
            numeral="I"
            title="Student and Session Information"
            subtitle="This report belongs only to the selected student."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Name of Student</span>
                <input
                  className={inputClass}
                  value={patientDetails?.full_name || selectedPatient?.name || detail?.name || 'NA'}
                  disabled
                  readOnly
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Session Number</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  className={inputClass}
                  value={form.session_number}
                  onChange={(event) => setValue('session_number', event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Date of Activity</span>
                <DatePicker
                  value={form.session_date}
                  onChange={(value) => setValue('session_date', value)}
                  max={todayIso()}
                  disabled={effectiveReadOnly}
                  ariaLabel="Date of Activity"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Title of Activity</span>
                <input
                  className={inputClass}
                  maxLength={TITLE_LIMIT}
                  value={form.activity_title}
                  onChange={(event) => setValue('activity_title', event.target.value.slice(0, TITLE_LIMIT))}
                />
                <span className="block text-right text-[11px] text-slate-400">
                  {form.activity_title.length}/{TITLE_LIMIT}
                </span>
              </label>
            </div>
          </SectionCard>

          <SectionCard numeral="II" title="Targeted Domains">
            <input
              className={inputClass}
              maxLength={TEXT_LIMIT}
              value={form.target_domain}
              onChange={(event) => setValue('target_domain', event.target.value.slice(0, TEXT_LIMIT))}
              placeholder="Select below or enter another domain"
            />
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map((domain) => {
                const selected = form.target_domain
                  .split(',')
                  .map((value) => value.trim())
                  .includes(domain)
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-purple-600 bg-purple-700 text-white'
                        : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-50'
                    }`}
                  >
                    {domain}
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard numeral="III" title="Activity Plan and Observations">
            {[
              ['objectives', 'Objectives', 4],
              ['procedure', 'Activity Procedure', 6],
              ['observations', 'Responses / Observations', 5],
            ].map(([key, label, rows]) => (
              <label key={key} className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">{label}</span>
                <textarea
                  rows={rows}
                  maxLength={TEXT_LIMIT}
                  className={textareaClass}
                  value={form[key]}
                  onChange={(event) => setValue(key, event.target.value.slice(0, TEXT_LIMIT))}
                />
                <span className="block text-right text-[11px] text-slate-400">
                  {form[key].length}/{TEXT_LIMIT}
                </span>
              </label>
            ))}
          </SectionCard>
        </fieldset>

        <SectionCard numeral="IV" title="Signatories">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Prepared by</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                Psychometrician assigned to prepare and submit this DAR.
              </p>
              <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 transition-colors">
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Name:</span> {profileName(preparedProfile)}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Profession:</span> {profileProfession(preparedProfile, 'Psychometrician')}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">PRC No.:</span> {profileLicense(preparedProfile)}</div>
              </div>
              <div className="mt-4">
                {effectiveReadOnly ? (
                  preparedSignature ? (
                    <SavedSignature image={preparedSignature} alt="Psychometrician signature" sealed signedAt={preparedDate} />
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                      <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No psychometrician signature recorded.</span>
                    </div>
                  )
                ) : (
                  <SignaturePad label="" value={preparedSignature} onChange={setPreparedSignature} />
                )}
              </div>
              <div className="mt-3">
                {!effectiveReadOnly ? (
                  <DatePicker
                    value={preparedDate}
                    onChange={(value) => setPreparedDate(value)}
                    max={todayIso()}
                    ariaLabel="Psychometrician signature date"
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Psychologist review</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                The assigned psychologist reviews, signs, and either approves or returns this DAR.
              </p>
              <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 transition-colors">
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Name:</span> {profileName(reviewerProfile)}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Profession:</span> {profileProfession(reviewerProfile, 'Psychologist')}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">PRC No.:</span> {profileLicense(reviewerProfile)}</div>
              </div>

              {reviewerMode ? (
                <div className="mt-4">
                  <ReviewSessionNotice />
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                    Comment for revision, if any
                  </label>
                  <textarea
                    rows={3}
                    maxLength={COMMENT_LIMIT}
                    data-reviewer-comment="true"
                    className={textareaClass}
                    value={reviewerCommentProp}
                    onChange={(event) => onReviewerCommentChange?.(event.target.value.slice(0, COMMENT_LIMIT))}
                    placeholder="Write a revision note for the psychometrician..."
                  />
                  <div className="mt-1 text-right text-[11px] text-slate-400">
                    {reviewerCommentProp.length}/{COMMENT_LIMIT}
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                {reviewerMode ? (
                  <SignaturePad
                    label="Psychologist Signature"
                    value={reviewerSignatureProp || reviewerSignature}
                    onChange={onReviewerSignatureChange}
                  />
                ) : reviewerSignature ? (
                  <SavedSignature image={reviewerSignature} alt="Psychologist signature" sealed signedAt={String(detail?.reviewed_at || detail?.updated_at || detail?.date || '').slice(0, 10)} />
                ) : (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                    <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No psychologist signature yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="pb-2 pt-1"></div>
        <ScrollTopButton />
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
  </FormShell>
  )
}

export default DailyActivityReportForm
