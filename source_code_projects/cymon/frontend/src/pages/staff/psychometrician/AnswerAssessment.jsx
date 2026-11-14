import { useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { createPortal } from 'react-dom'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import { api } from '../../../lib/api'
import { capitalizeName, formatLastFirstMI } from '../../../lib/format'
import FormActionButtons from '../../../components/ui/FormActionButtons'
import Skeleton from '../../../components/ui/Skeleton'
import SignaturePad, { SavedSignature } from '../../../components/ui/SignaturePad'
import { isSealedStatus } from '../../../lib/signatures'
import ClientSubmissionConfirmation from '../../../components/ui/ClientSubmissionConfirmation'
import AdaptiveFunctioningAssessmentForm from './AdaptiveFunctioningAssessmentForm'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import FormSectionNav from '../../../components/ui/FormSectionNav'
import ReviewSessionNotice from '../../../components/ui/ReviewSessionNotice'
import ScrollTopButton from '../../../components/ui/ScrollTopButton'
import CaregiverScoringGuide from '../../../components/ui/CaregiverScoringGuide'

const selectClass =
  'mt-1 h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 text-sm disabled:bg-purple-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:text-slate-400 transition-colors'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-300 transition-colors'
const COMMENT_LIMIT = 100
const clampComment = (value) => (value || '').slice(0, COMMENT_LIMIT)

function DomainCard({ domain, answers, onAnswer, readOnly = false, isMmse = false, highlightedItemKey = null }) {
  const items = Array.isArray(domain?.items) ? domain.items : []
  
  return (
    <section id={`form-section-${domain.key}`} className="overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
      <header className="flex items-center justify-between border-b border-purple-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 px-6 py-4 transition-colors">
        <div className="text-sm font-black tracking-tight text-purple-900 dark:text-purple-300 transition-colors">{domain.title}</div>
        <span className="flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50 px-3 py-1 text-xs font-bold text-purple-800 dark:text-purple-300 transition-colors">
          {items.filter((it) => answers[it.key] === 'yes').length} / {items.length} Yes
        </span>
      </header>
      <div className="divide-y divide-purple-50 dark:divide-slate-800 transition-colors">
        {items.map((it) => {
          const hasRemarks = isMmse || domain.title.toLowerCase().includes('perceptual') || domain.title.toLowerCase().includes('stimming')
          
          return (
            <div key={it.key} id={`item-${it.key}`} className={`flex flex-col gap-4 px-6 py-5 transition-colors ${
              highlightedItemKey === it.key
                ? 'bg-rose-50/50 dark:bg-rose-900/20 ring-2 ring-inset ring-rose-400 dark:ring-rose-500 shadow-sm animate-[pulse_1.5s_ease-in-out_2]'
                : 'hover:bg-purple-50/30 dark:hover:bg-slate-800/40'
            }`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 transition-colors pr-4">
                  {it.label}
                </div>
                
                <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 transition-colors p-1">
                  <button
                    type="button"
                    onClick={() => !readOnly && onAnswer(it.key, 'yes')}
                    disabled={readOnly}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      answers[it.key] === 'yes'
                        ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600'
                        : readOnly
                        ? 'cursor-not-allowed text-slate-400'
                        : 'text-slate-600 dark:text-slate-300 transition-colors hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => !readOnly && onAnswer(it.key, 'no')}
                    disabled={readOnly}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      answers[it.key] === 'no'
                        ? 'bg-rose-500 text-white shadow-sm ring-1 ring-rose-600'
                        : readOnly
                        ? 'cursor-not-allowed text-slate-400'
                        : 'text-slate-600 dark:text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    No
                  </button>
                  {!domain.title.toLowerCase().includes('stimming') && (
                    <button
                      type="button"
                      onClick={() => !readOnly && onAnswer(it.key, 'na')}
                      disabled={readOnly}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                        answers[it.key] === 'na'
                          ? 'bg-slate-600 text-white shadow-sm ring-1 ring-slate-700'
                          : readOnly
                          ? 'cursor-not-allowed text-slate-400'
                          : 'text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200'
                      }`}
                    >
                      N/A
                    </button>
                  )}
                </div>
              </div>
              
              {hasRemarks && (
                <div className="w-full">
                  <textarea
                    placeholder="Add observations or remarks here..."
                    value={answers[`${it.key}_remarks`] || ''}
                    onChange={(e) => !readOnly && onAnswer(`${it.key}_remarks`, e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 dark:focus:border-slate-600 focus:ring-4 focus:ring-purple-400/10 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Loading placeholder that mirrors DomainCard's exact shell (rounded-3xl
// section, gradient header with title + Yes-count pill, item rows with label
// lines and a Yes/No/N/A pill group) so content doesn't jump when data lands.
function DomainCardSkeleton({ items = 3, showCount = true }) {
  return (
    <section aria-hidden="true" className="overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm">
      <header className="flex items-center justify-between border-b border-purple-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 px-6 py-4 transition-colors">
        <Skeleton className="h-4 w-1/3" />
        {showCount ? <Skeleton className="h-6 w-20" rounded="rounded-full" /> : null}
      </header>
      <div className="divide-y divide-purple-50 dark:divide-slate-800 transition-colors">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2 pr-4">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 transition-colors p-1">
                <Skeleton className="h-8 w-14" rounded="rounded-lg" />
                <Skeleton className="h-8 w-14" rounded="rounded-lg" />
                <Skeleton className="h-8 w-14" rounded="rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Mirrors the Required Signatures section shell (header + 2-col signature
// cards with profile lines and a signature paper box).
function SignaturesSkeleton() {
  return (
    <section aria-hidden="true" className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 transition-colors p-3">
            <Skeleton className="h-3 w-40" />
            <div className="mt-2 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="mt-2 h-28 w-full" rounded="rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  )
}

// Mirrors one adaptive domain item: label + option pills row, then an
// OBSERVATION label with counter and a textarea box — the exact shape of a
// loaded FO-05 item.
function AdaptiveItemSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-2 pr-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 transition-colors p-1">
          <Skeleton className="h-8 w-14" rounded="rounded-lg" />
          <Skeleton className="h-8 w-14" rounded="rounded-lg" />
          <Skeleton className="h-8 w-14" rounded="rounded-lg" />
        </div>
      </div>
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-14" />
        </div>
        <Skeleton className="h-28 w-full" rounded="rounded-xl" />
      </div>
    </div>
  )
}

function AdaptiveDomainSkeleton() {
  return (
    <section aria-hidden="true" className="overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm">
      <header className="border-b border-purple-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 px-6 py-4 transition-colors">
        <Skeleton className="h-4 w-1/4" />
      </header>
      <div className="divide-y divide-purple-50 dark:divide-slate-800 transition-colors">
        <AdaptiveItemSkeleton />
        <AdaptiveItemSkeleton />
      </div>
    </section>
  )
}

// Mirrors the adaptive form's internal split (sticky student-details column +
// scrollable content column) while its structure is still loading.
function AdaptiveLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="grid w-full items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <Skeleton rounded="rounded-full" style={{ width: 56, height: 56, minWidth: 56 }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-11 w-full" rounded="rounded-xl" />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm p-4 sm:p-5">
          <Skeleton className="mb-3 h-2.5 w-20" />
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </section>
      </div>
      <div className="min-w-0 space-y-6">
        <AdaptiveDomainSkeleton />
        <AdaptiveDomainSkeleton />
        <SignaturesSkeleton />
      </div>
    </div>
  )
}

function SignatureCard({ label, profile, signature, emptyText, editable = false, onSignatureChange = null, signatureLabel = 'Signature', sealed = false, signedAt = '', sealedPadProps = null }) {
  // display_name is hand-typed at registration and may be lowercase.
  const name = capitalizeName(profile?.display_name) || 'NA'
  const profession = profile?.title || 'NA'
  const prcNo = profile?.license_no || 'NA'

  return (
    <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 transition-colors p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 transition-colors">{label}</div>
      <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300 transition-colors">
        <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Name:</span> {name}</div>
        <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Profession:</span> {profession}</div>
        <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">PRC No.:</span> {prcNo}</div>
      </div>
      <div className="mt-2">
        {editable ? (
          <div className="w-full">
            <SignaturePad
              label={signatureLabel}
              value={signature}
              onChange={onSignatureChange}
              sealed={sealed}
              signedAt={signedAt}
              {...(sealedPadProps || {})}
            />
          </div>
        ) : signature ? (
          <SavedSignature image={signature} alt={`${label} signature`} sealed={sealed} signedAt={signedAt} />
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-purple-200 bg-white p-2 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

function AnswerAssessment({
  tests,
  patients,
  prefilledPatientId,
  prefilledPatient = null,
  prefilledTemplateId,
  isClient = false,
  prefilledPatientName = '',
  prefilledTemplateName = '',
  onClose,
  onSubmitted,
  onDraftSaved,
  readOnly = false,
  submission = null,
  inline = false,
  currentSigner = null,
  reviewerMode = false,
  reviewerProfile = null,
  reviewerSignature = null,
  onReviewerSignatureChange = null,
  reviewerComment = '',
  onReviewerCommentChange = null,
  onReviewerApprove = null,
  onReviewerReturn = null,
  reviewerBusy = false,
  headerActionsTarget = null,
  splitLayout = false,
}) {
  const [patientId, setPatientId] = useState(prefilledPatientId || '')
  const [templateId, setTemplateId] = useState(prefilledTemplateId || '')
  const [template, setTemplate] = useState(null)
  const [loadingTpl, setLoadingTpl] = useState(false)
  const [answers, setAnswers] = useState({})
  const [metadata, setMetadata] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingDraftManually, setSavingDraftManually] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [respondentSignature, setRespondentSignature] = useState('')
  const [reviewerCommentDraft, setReviewerCommentDraft] = useState(reviewerComment || '')
  const [infoPhotoViewer, setInfoPhotoViewer] = useState(null)
  const [confirmingStaffSubmit, setConfirmingStaffSubmit] = useState(false)
  const [previewingPdf, setPreviewingPdf] = useState(false)
  // Preview silently saves a draft then generates the PDF server-side, which
  // takes seconds — surface a loading state so the click feels acknowledged.
  const handlePreviewPdf = async () => {
    if (previewingPdf) return
    setPreviewingPdf(true)
    try {
      await previewOfficialPdf()
    } finally {
      setPreviewingPdf(false)
    }
  }
  const [resolvedSubmission, setResolvedSubmission] = useState(submission)
  // Unsaved-edit tracking. Every save response mints a brand-new submission
  // object, and reseeding the form from it is what wiped rapid Yes/No/N/A
  // taps moments after tapping. dirtyRef marks clinician edits since the last
  // successful save; appliedSubmissionRef remembers which server snapshot
  // already seeded the form; saveInFlightRef serializes writers so an older
  // in-flight save can never resolve over a newer one.
  const dirtyRef = useRef(false)
  const editSeqRef = useRef(0)
  const appliedSubmissionRef = useRef({ id: null, updated_at: null })
  const saveInFlightRef = useRef(false)
  const markEdited = () => {
    dirtyRef.current = true
    editSeqRef.current += 1
  }
  const [pdfPreview, setPdfPreview] = useState(null)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [highlightedItemKey, setHighlightedItemKey] = useState(null)
  const [fo03Info, setFo03Info] = useState({
    respondent: '',
    othersText: '',
    previouslyDiagnosed: null,
  })

  const activeTests = Array.isArray(tests) ? tests.filter((t) => t.active !== false) : []
  const hasPrefill = Boolean(prefilledPatientId || prefilledTemplateId)
  const selectedPatient = Array.isArray(patients) ? patients.find((p) => p.id === patientId) : null
  const selectedTemplate = activeTests.find((t) => t.id === templateId)
  const canEditSelection = !isClient && !hasPrefill && !readOnly
  const requiresPsychometricianSignature = !isClient && !readOnly
  const activeSubmission = resolvedSubmission || submission
  const statusLocksForm = Boolean(
    activeSubmission && !['draft', 'revalidation'].includes(activeSubmission.status),
  )
  const formReadOnly = readOnly || statusLocksForm
  const isRevisionDraft = !formReadOnly && activeSubmission?.status === 'revalidation'

  const raiseError = (message) => {
    toast.error(message)
  }

  const previewOfficialPdf = async () => {
    if (isClient) {
      raiseError('Save and submit the assessment first so the official PDF can load its database record.')
      return
    }
    // Preview the current work as-is: silently save a draft first so the PDF
    // can render it. No signature or submit required just to check the output.
    let submissionId = activeSubmission?.id
    // If another save is in flight, preview from the current submission — the
    // in-flight save will persist the latest taps without a racing write.
    if (!formReadOnly && canSubmitAssessment && patientId && templateId && !saveInFlightRef.current) {
      saveInFlightRef.current = true
      const seqAtStart = editSeqRef.current
      try {
        const { answersPayload, domain_scores } = buildAssessmentPayload(answers)
        const result = await api.psychometrician.saveDraftAssessment(templateId, {
          patient_id: patientId,
          answers: answersPayload,
          domain_scores,
          total_score: total,
          max_score: max,
          metadata,
          respondent_signature_image: respondentSignature || null,
          status: 'draft',
        })
        const saved = result?.submission || {}
        submissionId = saved.id || submissionId
        setResolvedSubmission((current) => ({
          ...(current || {}),
          ...saved,
          patient_id: saved.patient_id || current?.patient_id || patientId,
          template_id: saved.template_id || current?.template_id || templateId,
          answers: answersPayload,
          metadata,
          respondent_signature_image: respondentSignature || current?.respondent_signature_image || null,
          status: saved.status || 'draft',
        }))
        if (editSeqRef.current === seqAtStart) dirtyRef.current = false
        setLastSaved(new Date())
      } catch (e) {
        saveInFlightRef.current = false
        raiseError(e.message || 'Could not save a draft for preview.')
        return
      }
      saveInFlightRef.current = false
    }
    if (!submissionId) {
      raiseError('Select a student and an assessment first before previewing.')
      return
    }
    setPdfPreview({
      title: `Assessment Form · ${selectedPatient?.name || selectedPatient?.full_name || 'Student'}`,
      filename: `${selectedPatient?.patient_id || patientId}-assessment.pdf`,
      loadPdf: () => api.psychometrician.downloadDocumentPdf('assessment_submissions', submissionId),
    })
  }

  const pickTemplate = async (id) => {
    setTemplateId(id)
    setTemplate(null)
    if (!submission) {
      setAnswers({})
      setMetadata({})
    }
    if (!id) return
    setLoadingTpl(true)
    try {
      const d = isClient ? await api.client.assessmentTemplate(id) : await api.psychometrician.assessmentTemplate(id)
      setTemplate(d.template)
    } catch (e) {
      setConfirmingSubmit(false)
      raiseError(e.message)
    } finally {
      setLoadingTpl(false)
    }
  }

  useEffect(() => {
    setPatientId(prefilledPatientId || '')
    setTemplateId(prefilledTemplateId || '')
    if (prefilledTemplateId) {
      pickTemplate(prefilledTemplateId)
    } else {
      setTemplate(null)
    }
    if (!submission) {
      setAnswers({})
      setRespondentSignature('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledPatientId, prefilledTemplateId])

  useEffect(() => {
    const sub = activeSubmission
    const applied = appliedSubmissionRef.current
    // Never reseed the same snapshot twice, and never reseed over the
    // clinician's unsaved edits — both wiped rapid taps after save responses.
    if (sub && applied.id === sub.id && (applied.updated_at === sub.updated_at || dirtyRef.current)) return
    appliedSubmissionRef.current = { id: sub?.id || null, updated_at: sub?.updated_at || null }
    if (sub) {
      const initialAnswers = {}
      if (sub.answers) {
        Object.entries(sub.answers).forEach(([key, val]) => {
          initialAnswers[key] = val?.response || ''
          if (val?.remarks) initialAnswers[`${key}_remarks`] = val.remarks
        })
      }
      setAnswers(initialAnswers)
      setMetadata(sub.metadata || {})
      setRespondentSignature(
        !readOnly && sub.status === 'revalidation'
          ? ''
          : sub.respondent_signature_image || '',
      )
      dirtyRef.current = false
    } else if (!prefilledTemplateId) {
      setAnswers({})
      setMetadata({})
      setRespondentSignature('')
      dirtyRef.current = false
    }
  }, [activeSubmission, prefilledTemplateId, readOnly])

  // Pre-fill diagnosis / medical / family history from the patient's clinical profile.
  // When the admission record says No prior diagnosis, show "None" so the
  // form never renders an empty Diagnosis box for a No answer.
  const patientClinical = (patient) => (
    patient?.clinical ||
    patient?.clinical_profiles?.[0] ||
    patient?.clinical_profile ||
    null
  )
  const patientFlag = (patient) => {
    const v = patient?.previously_diagnosed
    if (v === true || v === 'true') return true
    if (v === false || v === 'false') return false
    return null
  }
  const isMeaningfulDiagnosis = (text) => {
    const t = String(text || '').trim()
    return t !== '' && t.toLowerCase() !== 'none' && t.toLowerCase() !== 'n/a'
  }
  useEffect(() => {
    if (activeSubmission?.metadata && Object.keys(activeSubmission.metadata).length > 0) return
    const clinical = patientClinical(prefilledPatient) || patientClinical(selectedPatient) || null
    const flag = patientFlag(prefilledPatient) ?? patientFlag(selectedPatient) ?? null
    if (!clinical && flag === null) return
    const recordedDiagnosis =
      clinical?.primary_diagnosis || clinical?.working_diagnosis || clinical?.secondary_diagnosis || ''
    setMetadata((prev) => {
      let diagnosis = prev.diagnosis
      if (!isMeaningfulDiagnosis(diagnosis)) {
        if (flag === false) diagnosis = 'None'
        else diagnosis = recordedDiagnosis || (flag === null ? '' : prev.diagnosis || '')
      }
      const next = {
        ...prev,
        diagnosis: diagnosis || '',
        medical_history: prev.medical_history || clinical?.medical_history || '',
        family_history: prev.family_history || clinical?.family_history || '',
      }
      if (
        prev.diagnosis === next.diagnosis &&
        prev.medical_history === next.medical_history &&
        prev.family_history === next.family_history
      ) {
        return prev
      }
      return next
    })
    // Pre-select Yes/No from the admission record (or from the recorded
    // diagnosis text when the flag is missing) so a stored diagnosis never
    // renders with neither pill selected.
    setFo03Info((prev) => {
      if (prev.previouslyDiagnosed !== null) return prev
      const inferred = flag ?? (isMeaningfulDiagnosis(recordedDiagnosis) ? true : null)
      if (inferred === null) return prev
      return { ...prev, previouslyDiagnosed: inferred }
    })
  }, [prefilledPatient, selectedPatient, activeSubmission])

  // Pre-fill FO-03 respondent info from submission metadata. When an older
  // submission stored a diagnosis but no Yes/No flag, infer Yes so the form
  // stays consistent instead of showing text with neither pill selected.
  useEffect(() => {
    if (!activeSubmission) return
    const rel = (activeSubmission.respondent_relationship || activeSubmission.metadata?.respondent_relationship || '').toLowerCase()
    const respondentOption = rel.includes('guardian') ? 'Guardian'
      : rel.includes('teacher') ? 'Teacher'
      : rel.includes('parent') || rel.includes('mother') || rel.includes('father') || rel.includes('caregiver') ? 'Parent'
      : rel ? 'Others' : ''
    const diag = activeSubmission.metadata?.previously_diagnosed
    let previouslyDiagnosed = diag === true || diag === 'true' ? true : diag === false || diag === 'false' ? false : null
    if (previouslyDiagnosed === null) {
      const storedDiagnosis = activeSubmission.metadata?.diagnosis || ''
      if (isMeaningfulDiagnosis(storedDiagnosis)) previouslyDiagnosed = true
      else if (String(storedDiagnosis || '').trim().toLowerCase() === 'none') previouslyDiagnosed = false
    }
    setFo03Info({
      respondent: respondentOption,
      othersText: respondentOption === 'Others' ? (activeSubmission.respondent_relationship || activeSubmission.metadata?.respondent_relationship || '') : '',
      previouslyDiagnosed,
    })
  }, [activeSubmission])

  useEffect(() => {
    setMetadata((prev) => {
      const next = { ...prev }
      if (fo03Info.respondent === 'Others') {
        next.respondent_relationship = fo03Info.othersText
      } else if (fo03Info.respondent) {
        next.respondent_relationship = fo03Info.respondent
      }
      
      if (fo03Info.previouslyDiagnosed !== null) {
        next.previously_diagnosed = fo03Info.previouslyDiagnosed
      }
      
      if (
        prev.respondent_relationship === next.respondent_relationship &&
        prev.previously_diagnosed === next.previously_diagnosed
      ) {
        return prev
      }
      return next
    })
  }, [fo03Info])

  useEffect(() => {
    let alive = true
    const fetchResolvedSubmission = async () => {
      const pId = patientId || submission?.patient_id
      const tId = templateId || submission?.template_id
      if (!pId || !tId || isClient) return
      try {
        const d = await api.psychometrician.assessmentSubmission(pId, tId)
        if (!alive) return
        if (d?.submission) {
          setResolvedSubmission((current) => {
            if (current?.id === d.submission.id && current?.updated_at === d.submission.updated_at) return current
            return d.submission
          })
          if (
            !respondentSignature &&
            d.submission.status !== 'revalidation' &&
            d.submission.respondent_signature_image
          ) {
            setRespondentSignature(d.submission.respondent_signature_image)
          }
        }
      } catch {
        // If the fetch fails, we keep using the passed-in submission prop/state.
      }
    }
    
    // Always fetch latest to prevent stale data when reopened from an outdated list state
    if (hasPrefill || submission?.id || (patientId && templateId)) fetchResolvedSubmission()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, templateId, hasPrefill, isClient])

  // Sync a newer server snapshot pushed through the submission prop. The
  // parent review workspace (Approvals) updates its copy on approve/return —
  // status flips and reviewer ink arrives — but this form renders from the
  // internal resolvedSubmission snapshot, so without this sync it keeps
  // showing the pre-decision state ("No psychologist signature yet" right
  // after a successful approve). Same-id only: row switches are handled by
  // the fetch above. Untouched when nothing actually changed, so unsaved
  // clinician edits are never clobbered.
  useEffect(() => {
    if (!submission?.id) return
    setResolvedSubmission((current) => {
      if (!current || String(current.id) !== String(submission.id)) return current
      const propTime = new Date(submission.updated_at || 0).getTime()
      const curTime = new Date(current.updated_at || 0).getTime()
      const newerByTime = !Number.isNaN(propTime) && !Number.isNaN(curTime) && propTime > curTime
      const statusChanged = submission.status !== current.status
      const reviewerChanged =
        (submission.reviewer_signature_image || null) !== (current.reviewer_signature_image || null) ||
        (submission.reviewer_comment || null) !== (current.reviewer_comment || null)
      if (newerByTime || statusChanged || reviewerChanged) {
        return { ...current, ...submission }
      }
      return current
    })
  }, [submission])

  useEffect(() => {
    setReviewerCommentDraft(reviewerComment || '')
  }, [submission?.id, reviewerMode])

  const structure = useMemo(() => (Array.isArray(template?.structure) ? template.structure : []), [template])
  const canSubmitAssessment = structure.length > 0 && !formReadOnly && (
    !activeSubmission || ['draft', 'revalidation'].includes(activeSubmission.status)
  )
  const isAdaptive = template?.document_type_code === 'CMPS:SE-FO-05'
  // Resolve the form code from the already-known test list so the split
  // two-column layout (and info panel) is correct even while the template
  // structure is still loading — otherwise the skeleton renders single-column
  // and the whole page jumps when data lands.
  // Look up the unfiltered test list with loose id matching: selectedTemplate
  // comes from the assigned-templates-filtered list, so an unassigned form
  // would resolve to '' and lose its split skeleton.
  const lookupTemplate = (Array.isArray(tests) ? tests : []).find(
    (t) => String(t?.id) === String(templateId || prefilledTemplateId),
  )
  const selectedTemplateCode =
    lookupTemplate?.code ||
    lookupTemplate?.document_type_code ||
    selectedTemplate?.code ||
    selectedTemplate?.document_type_code ||
    ''
  const resolvedTemplateCode = template?.document_type_code || selectedTemplateCode
  const isCaregiverChecklist = resolvedTemplateCode === 'CMPS:SE-FO-03'
  const isMmse = resolvedTemplateCode === 'CMPS:SE-FO-04'
  const isAdaptiveResolved = resolvedTemplateCode === 'CMPS:SE-FO-05'
  const isInfoPanelForm = isCaregiverChecklist || isMmse
  const assessmentItems = useMemo(
    () =>
      structure.flatMap((domain) =>
        (domain.items || []).map((item) => ({
          ...item,
          key: item.key,
          label: item.label,
          domain: domain.title,
        })),
      ),
    [structure],
  )
  const incompleteItems = useMemo(
    () =>
      assessmentItems.filter((item) => {
        const response = answers[item.key]
        const normalized = String(response || '').trim().toLowerCase()
        if (item.response_type === 'text') return !normalized
        if (item.response_type === 'select') {
          return !(item.options || []).some((option) => String(option).toLowerCase() === normalized)
        }
        return !['yes', 'no', 'na'].includes(normalized)
      }),
    [assessmentItems, answers],
  )
  const adaptiveMetadataComplete = !isAdaptive || ['student_name', 'age_gender', 'guardian_name', 'assessor_name']
    .every((field) => String(metadata?.[field] || '').trim())
  const allAnswered = (assessmentItems.length === 0 ? true : incompleteItems.length === 0) && adaptiveMetadataComplete
  // FO-03 (Caregiver checklist) requires a respondent — otherwise the official
  // PDF renders with no checkbox marked.
  const caregiverRespondentComplete = !isCaregiverChecklist || (
    Boolean(fo03Info.respondent) &&
    (fo03Info.respondent !== 'Others' || Boolean(String(fo03Info.othersText || '').trim()))
  )

  const buildAssessmentPayload = (sourceAnswers) => {
    const answersPayload = {}
    for (const d of structure) {
      for (const it of Array.isArray(d?.items) ? d.items : []) {
        if (sourceAnswers[it.key] || sourceAnswers[`${it.key}_remarks`]) {
          answersPayload[it.key] = {
            response: sourceAnswers[it.key] || '',
            remarks: sourceAnswers[`${it.key}_remarks` ] || ''
          }
        }
      }
    }
    const domain_scores = {}
    for (const d of structure) {
      const items = Array.isArray(d?.items) ? d.items : []
      const scoreItems = items.filter((it) => !isAdaptive || it.response_type === 'yes_no')
      const score = scoreItems.filter((it) => sourceAnswers[it.key] === 'yes').length
      domain_scores[d.key] = { score, max: scoreItems.length }
    }
    return { answersPayload, domain_scores }
  }
  const { total, max } = useMemo(() => {
    let t = 0
    let m = 0
    for (const d of structure) {
      for (const it of Array.isArray(d?.items) ? d.items : []) {
        if (isAdaptive && it.response_type !== 'yes_no') continue
        m += 1
        if (answers[it.key] === 'yes') t += 1
      }
    }
    return { total: t, max: m }
  }, [isAdaptive, structure, answers])

  const setAnswer = (key, val) => {
    markEdited()
    setAnswers((a) => ({ ...a, [key]: val }))
  }

  // Replacing a signature must clear BOTH the local state and the loaded
  // submission ink. The display prefers the saved value, so clearing state
  // alone leaves stale ink on screen while submit (correctly) demands a new
  // signature — the "Replace does nothing until refresh" bug. Server data is
  // untouched until the next save/submit.
  const handleRespondentSignatureChange = (next) => {
    markEdited()
    setRespondentSignature(next || '')
    if (!next) {
      setResolvedSubmission((current) =>
        current ? { ...current, respondent_signature_image: null } : current,
      )
    }
  }

  const buildAnswersPayload = () => {
    const payload = {}
    for (const d of structure) {
      const items = Array.isArray(d?.items) ? d.items : []
      for (const it of items) {
        if (answers[it.key] || answers[`${it.key}_remarks`]) {
          payload[it.key] = {
            response: answers[it.key] || '',
            remarks: answers[`${it.key}_remarks`] || '',
          }
        }
      }
    }
    return payload
  }

  const buildDomainScores = () => {
    const scores = {}
    for (const d of structure) {
      const items = Array.isArray(d?.items) ? d.items : []
      const scoreItems = items.filter((it) => !isAdaptive || it.response_type === 'yes_no')
      const score = scoreItems.filter((it) => answers[it.key] === 'yes').length
      scores[d.key] = { score, max: scoreItems.length }
    }
    return scores
  }

  const saveDraft = async () => {
    if (isClient || formReadOnly || !templateId) return
    // Serialize writers: an older in-flight save resolving last is what
    // reverted rapid taps to stale answers.
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    const seqAtStart = editSeqRef.current
    setSavingDraft(true)
    try {
      const result = await api.psychometrician.saveDraftAssessment(templateId, {
        patient_id: patientId,
        answers: buildAnswersPayload(),
        domain_scores: buildDomainScores(),
        total_score: total,
        max_score: max,
        metadata,
        respondent_signature_image: respondentSignature || null,
        status: 'draft',
      })
      const savedSubmission = result?.submission || {}
      setResolvedSubmission((current) => ({
        ...(current || {}),
        ...savedSubmission,
        patient_id: savedSubmission.patient_id || current?.patient_id || patientId,
        template_id: savedSubmission.template_id || current?.template_id || templateId,
        answers: buildAnswersPayload(),
        metadata,
        respondent_signature_image: respondentSignature || current?.respondent_signature_image || null,
        status: savedSubmission.status || 'draft',
      }))
      setLastSaved(new Date())
      // The server now holds everything as of flight start — but only clear
      // the dirty flag if nothing newer was tapped mid-flight.
      if (editSeqRef.current === seqAtStart) dirtyRef.current = false
      await onDraftSaved?.()
      toast.success('Draft saved.')
    } catch (e) {
      toast.error('Could not save draft: ' + e.message)
    } finally {
      saveInFlightRef.current = false
      setSavingDraft(false)
    }
  }

  const saveDraftRef = useRef(saveDraft)
  useEffect(() => {
    saveDraftRef.current = saveDraft
  })

  useEffect(() => () => {
    const { answers: lastAnswers, metadata: lastMetadata } = latestDataRef.current
    if (
      Object.keys(lastAnswers || {}).length === 0 &&
      Object.keys(lastMetadata || {}).length === 0
    ) {
      return
    }
    saveDraftRef.current().catch(() => {})
  }, [])

  const latestDataRef = useRef({ answers, metadata, total, max })
  useEffect(() => {
    // Ref mirror for the autosave interval — the canonical ref-write pattern.
    // eslint-disable-next-line react-hooks/immutability
    latestDataRef.current = { answers, metadata, total, max }
  }, [answers, metadata, total, max])

  useEffect(() => {
    if (isClient || formReadOnly || !templateId) return
    const timer = setInterval(async () => {
      const { answers: currentAnswers, metadata: currentMetadata, total: currentTotal, max: currentMax } = latestDataRef.current
      if (Object.keys(currentAnswers).length === 0 && Object.keys(currentMetadata).length === 0) return
      // Skip the tick while another save is in flight — overlapping writes
      // resolving out of order reverted rapid taps. The next tick picks up
      // the newer answers instead.
      if (saveInFlightRef.current) return
      saveInFlightRef.current = true
      const seqAtStart = editSeqRef.current
      try {
        const payload = {}
        for (const d of structure) {
          const items = Array.isArray(d?.items) ? d.items : []
          for (const it of items) {
            if (currentAnswers[it.key] || currentAnswers[`${it.key}_remarks`]) {
              payload[it.key] = {
                response: currentAnswers[it.key] || '',
                remarks: currentAnswers[`${it.key}_remarks`] || ''
              }
            }
          }
        }
        const scores = {}
        for (const d of structure) {
          const items = Array.isArray(d?.items) ? d.items : []
          const scoreItems = items.filter((it) => !isAdaptive || it.response_type === 'yes_no')
          const score = scoreItems.filter((it) => currentAnswers[it.key] === 'yes').length
          scores[d.key] = { score, max: scoreItems.length }
        }

        const result = await api.psychometrician.saveDraftAssessment(templateId, {
          patient_id: patientId,
          answers: payload,
          domain_scores: scores,
          total_score: currentTotal,
          max_score: currentMax,
          metadata: currentMetadata,
          respondent_signature_image: respondentSignature || null,
          status: 'draft',
        })
        const savedSubmission = result?.submission || {}
        setResolvedSubmission((current) => ({
          ...(current || {}),
          ...savedSubmission,
          patient_id: savedSubmission.patient_id || current?.patient_id || patientId,
          template_id: savedSubmission.template_id || current?.template_id || templateId,
          answers: payload,
          metadata: currentMetadata,
          respondent_signature_image: respondentSignature || current?.respondent_signature_image || null,
          status: savedSubmission.status || 'draft',
        }))
        if (editSeqRef.current === seqAtStart) dirtyRef.current = false
        setLastSaved(new Date())
      } catch (e) {
        console.error('Auto-save failed:', e)
      } finally {
        saveInFlightRef.current = false
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [isClient, formReadOnly, templateId, patientId, structure, isAdaptive, respondentSignature])

  const submit = async () => {
    if (formReadOnly) return
    if (!isClient && !patientId) {
      raiseError('Select a patient first.')
      return
    }
    if (requiresPsychometricianSignature && !respondentSignature) {
      raiseError('Psychometrician signature is required before sending this assessment.')
      return
    }
    if (isCaregiverChecklist && !caregiverRespondentComplete) {
      raiseError(!fo03Info.respondent
        ? 'Please select the respondent (Parent, Guardian, Teacher, or Others) before sending this assessment.'
        : 'Please specify the other respondent before sending this assessment.')
      return
    }

    if (!allAnswered) {
      const missing = incompleteItems.length
      const firstMissingKey = incompleteItems[0]?.key
      const domain = incompleteItems[0]?.domain || ''
      const label = incompleteItems[0]?.label || 'item'
      setHighlightedItemKey(firstMissingKey)
      setTimeout(() => setHighlightedItemKey(null), 3000)
      document.getElementById(`item-${firstMissingKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (missing > 0) {
        raiseError(
          `Please answer all assessment items before sending. ${missing} item${missing === 1 ? '' : 's'} still need a response` +
            (label && label !== 'item' ? ` (starting with "${label}"${domain ? ` in ${domain}` : ''})` : '') +
            '.',
        )
      } else {
        raiseError('This assessment requires additional required information. Review the highlighted fields above.')
      }
      return
    }
    if (isClient) {
      setConfirmingSubmit(true)
      return
    }
    setConfirmingStaffSubmit(true)
  }

  const saveDraftManually = async () => {
    if (formReadOnly || isClient || !patientId || !templateId) return
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    const seqAtStart = editSeqRef.current
    setSavingDraftManually(true)
    try {
      const { answersPayload, domain_scores } = buildAssessmentPayload(answers)
      const result = await api.psychometrician.saveDraftAssessment(templateId, {
        patient_id: patientId,
        answers: answersPayload,
        domain_scores,
        total_score: total,
        max_score: max,
        metadata,
        respondent_signature_image: respondentSignature || null,
        status: 'draft',
      })
      const savedSubmission = result?.submission || {}
      setResolvedSubmission((current) => ({
        ...(current || {}),
        ...savedSubmission,
        patient_id: savedSubmission.patient_id || current?.patient_id || patientId,
        template_id: savedSubmission.template_id || current?.template_id || templateId,
        answers: answersPayload,
        metadata,
        respondent_signature_image: respondentSignature || current?.respondent_signature_image || null,
        status: savedSubmission.status || 'draft',
      }))
      setLastSaved(new Date())
      if (editSeqRef.current === seqAtStart) dirtyRef.current = false
      toast.success('Draft saved.')
    } catch (e) {
      console.error(e)
      toast.error('Failed to save draft.')
    } finally {
      saveInFlightRef.current = false
      setSavingDraftManually(false)
    }
  }

  const submitAssessment = async () => {
    setSubmitting(true)
    try {
      const { answersPayload, domain_scores } = buildAssessmentPayload(answers)
      let result
      if (isClient) {
        result = await api.client.submitAssessment(templateId, {
          answers: answersPayload,
          domain_scores,
          total_score: total,
          max_score: max,
          metadata,
        })
      } else {
        result = await api.psychometrician.submitAssessment(templateId, {
          patient_id: patientId,
          answers: answersPayload,
          domain_scores,
          total_score: total,
          max_score: max,
          metadata,
          respondent_signature_image: respondentSignature || null,
        })
      }
      const savedSubmission = result?.submission || {}
      setResolvedSubmission((current) => ({
        ...(current || {}),
        ...savedSubmission,
        patient_id: savedSubmission.patient_id || current?.patient_id || patientId,
        template_id: savedSubmission.template_id || current?.template_id || templateId,
        answers: answersPayload,
        metadata,
        respondent_signature_image: respondentSignature || current?.respondent_signature_image || null,
        status: savedSubmission.status || 'submitted',
      }))
      // Submitted — the form locks, so the status-change reseed must apply.
      dirtyRef.current = false
      await onSubmitted?.()
      setConfirmingSubmit(false)
      toast.success(isClient ? 'Assessment submitted.' : 'Assessment sent to psychologist.')
    } catch (e) {
      raiseError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderActionButtons = (compact = false) => (
    <div className={compact ? 'flex flex-wrap items-center justify-end gap-2' : 'mt-4 flex flex-col gap-3 border-t border-purple-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'}>
      <FormActionButtons
        compact={compact}
        previewOfficialPdf={handlePreviewPdf}
        previewingPdf={previewingPdf}
        reviewerMode={reviewerMode}
        reviewerBusy={reviewerBusy}
        reviewerSignature={reviewerSignature}
        onReviewerReturn={onReviewerReturn}
        onReviewerApprove={onReviewerApprove}
        canSubmit={canSubmitAssessment}
        onSubmit={submit}
        submitting={submitting}
        submitDisabled={!patientId || !canSubmitAssessment}
        submitLabel={isClient ? 'Submit Assessment' : 'Send to Psychologist'}
        onSaveDraft={!isClient && !formReadOnly && structure.length > 0 ? saveDraftManually : undefined}
        savingDraft={savingDraftManually}
        lastSaved={lastSaved}
      />
    </div>
  )

  // Split-screen composition (fullscreen staff view): the section blocks below
  // are the exact same JSX as the single-column flow — only their placement
  // changes (sticky info column + scrollable content column). No state or
  // handlers are affected.
  // Split needs a real info panel for the left column, so generic templates
  // without one stay single-column even in fullscreen.
  const useSplitLayout = splitLayout && !isClient && !isAdaptive && hasPrefill && isInfoPanelForm
  // The prefill card is redundant in any fullscreen split composition because
  // the header bar already shows the assessment + student.
  const hidePrefillCard = splitLayout && !isClient && hasPrefill
  // Lift the outer width cap whenever any fullscreen split composition is
  // active (including the adaptive form, which splits internally).
  // isAdaptiveResolved (from the test list) keeps the wide outer frame while
  // the template is still loading — otherwise the skeleton renders squeezed
  // in max-w-3xl and the page jumps wide when data lands.
  const splitOuterLift = splitLayout && !isClient && hasPrefill && (isAdaptive || isAdaptiveResolved || isInfoPanelForm)
  const infoStudentPhoto = prefilledPatient?.photo_url || prefilledPatient?.patients?.photo_url || selectedPatient?.photo_url || selectedPatient?.patients?.photo_url || ''
  const infoStudentName = prefilledPatientName || prefilledPatient?.full_name || prefilledPatient?.name || selectedPatient?.name || 'Student'
  const infoPanel = isInfoPanelForm ? (
    <div id="form-section-info" className="rounded-3xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm scroll-mt-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">Personal Information of Student</div>
        {useSplitLayout ? (
          <div className="flex shrink-0 items-center gap-2.5">
            {infoStudentPhoto ? (
              <button
                type="button"
                onClick={() => setInfoPhotoViewer(infoStudentPhoto)}
                aria-label="View student photo"
                className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <img src={infoStudentPhoto} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-purple-200 dark:ring-slate-700" />
              </button>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-base font-bold text-purple-700 dark:text-purple-300 transition-colors">
                {(infoStudentName || 'ST').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <div className="max-w-44 leading-tight">
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">
                {infoStudentName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                ID: {prefilledPatient?.patient_id || selectedPatient?.patient_id || 'N/A'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <AvatarViewer src={infoPhotoViewer} alt={infoStudentName} onClose={() => setInfoPhotoViewer(null)} />
      <div className={`grid gap-3 ${useSplitLayout ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Full Name</div>
          <div className="rounded-md border border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            {prefilledPatientName || selectedPatient?.name || '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Birthday</div>
          <div className="rounded-md border border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            {(() => {
              const raw = prefilledPatient?.date_of_birth || selectedPatient?.date_of_birth
              if (!raw) return '—'
              try { return new Date(raw).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) }
              catch { return raw }
            })()}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Age / Sex</div>
          <div className="rounded-md border border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            {[
              prefilledPatient?.age ?? selectedPatient?.age,
              prefilledPatient?.sex || selectedPatient?.sex,
            ].filter((v) => v !== null && v !== undefined && v !== '').join(' / ') || '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Date</div>
          <div className="rounded-md border border-purple-100 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            {activeSubmission?.created_at
              ? new Date(activeSubmission.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {isCaregiverChecklist && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-2">Respondent <span className="text-rose-500">*</span></div>
          <div className="flex flex-wrap gap-2">
            {['Parent', 'Guardian', 'Teacher', 'Others'].map((r) => (
              <button
                key={r}
                type="button"
                disabled={formReadOnly}
                onClick={() => setFo03Info((s) => ({ ...s, respondent: r, othersText: r !== 'Others' ? '' : s.othersText }))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                  fo03Info.respondent === r
                    ? 'border-purple-500 bg-purple-600 text-white'
                    : 'border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {fo03Info.respondent === 'Others' && (
            <input
              type="text"
              disabled={formReadOnly}
              placeholder="Specify other respondent..."
              value={fo03Info.othersText || ''}
              onChange={(e) => setFo03Info((s) => ({ ...s, othersText: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors transition-colors focus:border-purple-400 focus:bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50 dark:bg-slate-950 transition-colors disabled:text-slate-500 dark:text-slate-400 transition-colors"
            />
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-2">Was the student previously diagnosed/assessed?</div>
        <div className="flex gap-3">
          {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
            <button
              key={label}
              type="button"
              disabled={formReadOnly}
              onClick={() => {
                markEdited()
                setFo03Info((s) => ({ ...s, previouslyDiagnosed: value }))
                // Keep the Diagnosis box consistent with the pill: No always
                // reads "None"; switching back to Yes restores the recorded
                // diagnosis (or a blank box when there is none).
                setMetadata((prev) => {
                  if (value === false) {
                    if (prev.diagnosis === 'None') return prev
                    return { ...prev, diagnosis: 'None' }
                  }
                  const recorded = patientClinical(prefilledPatient)?.primary_diagnosis
                    || patientClinical(prefilledPatient)?.working_diagnosis
                    || patientClinical(prefilledPatient)?.secondary_diagnosis
                    || patientClinical(selectedPatient)?.primary_diagnosis
                    || patientClinical(selectedPatient)?.working_diagnosis
                    || patientClinical(selectedPatient)?.secondary_diagnosis
                    || ''
                  if (String(prev.diagnosis || '').trim().toLowerCase() === 'none') {
                    return { ...prev, diagnosis: recorded || '' }
                  }
                  return prev
                })
              }}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                fo03Info.previouslyDiagnosed === value
                  ? 'border-purple-500 bg-purple-600 text-white'
                  : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Diagnosis</label>
          <textarea
            disabled={formReadOnly}
            className="w-full resize-none rounded-xl border border-purple-200 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-purple-400 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400"
            rows={2}
            placeholder="Enter diagnosis (if any)..."
            value={metadata?.diagnosis || ''}
            onChange={(e) => { markEdited(); setMetadata((prev) => ({ ...prev, diagnosis: e.target.value })) }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Medical History</label>
          <textarea
            disabled={formReadOnly}
            className="w-full resize-none rounded-xl border border-purple-200 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-purple-400 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400"
            rows={2}
            placeholder="Enter medical history..."
            value={metadata?.medical_history || ''}
            onChange={(e) => { markEdited(); setMetadata((prev) => ({ ...prev, medical_history: e.target.value })) }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Family History</label>
          <textarea
            disabled={formReadOnly}
            className="w-full resize-none rounded-xl border border-purple-200 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-purple-400 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-400"
            rows={2}
            placeholder="Enter family history..."
            value={metadata?.family_history || ''}
            onChange={(e) => { markEdited(); setMetadata((prev) => ({ ...prev, family_history: e.target.value })) }}
          />
        </div>
      </div>
    </div>
  ) : null
  const domainsBlock = (
    <div key={loadingTpl ? 'loading' : 'loaded'} className="flex flex-col gap-4 animate-content-fade-in">
      {loadingTpl ? (
        <>
          <DomainCardSkeleton items={4} />
          <DomainCardSkeleton items={3} />
          <DomainCardSkeleton items={3} />
        </>
        ) : null}
      {!loadingTpl && template && structure.length === 0 ? (
        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 text-sm text-slate-500 dark:text-slate-400 transition-colors">
          This assessment has no question structure to display.
        </div>
      ) : null}
      {!loadingTpl &&
        structure.map((domain) => (
          <DomainCard
            key={domain.key}
            domain={domain}
            answers={answers}
            onAnswer={setAnswer}
            readOnly={formReadOnly}
            isMmse={isMmse}
            highlightedItemKey={highlightedItemKey}
          />
        ))}
    </div>
  )
  // Scoring guide for the Yes/No/N/A checklists (FO-03 Caregiver and the
  // clinic-adapted FO-04 MMSE, which share the same domain keys and answer
  // format). Staff only — never shown to parents/guardians. Suggestion and
  // viewing aid: it reads the live answers, never edits them, and never
  // touches submissions, approvals, or official PDFs.
  const isGuideForm = isCaregiverChecklist || isMmse
  const guideBlock = !isClient && isGuideForm && !loadingTpl && structure.length > 0 ? (
    <CaregiverScoringGuide
      structure={structure}
      answers={answers}
      sourceLabel={
        isMmse
          ? 'Mini-Mental Status Examination (FO-04) — clinic-adapted checklist; bands follow the FO-03 screening method pending psychologist validation'
          : 'Caregiver Observation Checklist (FO-03)'
      }
    />
  ) : null
  const signaturesBlock = !isClient && assessmentItems.length > 0 ? (    <section id="form-section-signatures" className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm scroll-mt-4">
      <div className="mb-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">
          Required Signatures
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
          The assigned psychometrician signs before submission. The assigned psychologist
          signs during approval.
        </p>
        {isRevisionDraft ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This assessment was returned for revision. Review the psychologist&apos;s
            comment and add a new psychometrician signature before resubmitting.
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SignatureCard
          label="Psychometrician Signature"
          profile={activeSubmission?.respondent_profile || currentSigner}
          // A returned-for-revision assessment needs a FRESH signature (the
          // old ink attested the pre-revision answers, and submit rejects
          // without new ink). Showing the stale saved ink here as "saved
          // successfully" while submit demands a new signature is the
          // contradiction behind the "signature required" toast. So during
          // revision the old ink is hidden until the user actually re-signs —
          // the amber note above explains why the pad is empty.
          signature={respondentSignature || (!isRevisionDraft ? activeSubmission?.respondent_signature_image : '')}
          emptyText="No signature recorded yet."
          editable={requiresPsychometricianSignature && !formReadOnly}
          onSignatureChange={handleRespondentSignatureChange}
          signatureLabel=""
          sealed={isSealedStatus(activeSubmission?.status)}
          signedAt={String(activeSubmission?.submitted_at || '').slice(0, 10)}
        />
        {reviewerMode ? (
          <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 transition-colors p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 transition-colors">
              Psychologist Review
            </div>
            <div className="mt-2">
              <ReviewSessionNotice />
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300 transition-colors">
              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Name:</span>{' '}
                {capitalizeName(reviewerProfile?.display_name || currentSigner?.display_name) || 'NA'}
              </div>
              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Profession:</span>{' '}
                {reviewerProfile?.title || currentSigner?.title || 'NA'}
              </div>
              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">PRC No.:</span>{' '}
                {reviewerProfile?.license_no || currentSigner?.license_no || 'NA'}
              </div>
            </div>
            <div className="mt-3">
              <SignaturePad
                label="Psychologist Signature"
                value={reviewerSignature}
                onChange={onReviewerSignatureChange}
              />
            </div>
          </div>
        ) : (
          <SignatureCard
            label="Psychologist Review"
            profile={activeSubmission?.reviewer_profile || reviewerProfile}
            signature={activeSubmission?.reviewer_signature_image}
            emptyText="No psychologist signature yet."
            sealed
            signedAt={String(activeSubmission?.reviewed_at || '').slice(0, 10)}
          />
        )}
      </div>
    </section>
  ) : null
  const reviewerCommentBlock = reviewerMode ? (
    <section id="form-section-reviewer" className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm scroll-mt-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">
        Reviewer Comment
      </div>
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
        Comment for revision, if any
      </label>
      <textarea
        className="mt-2 w-full rounded-xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        rows={3}
        maxLength={COMMENT_LIMIT}
        placeholder="Write the concern or revision note for the psychometrician..."
        value={reviewerCommentDraft}
        onChange={(e) => {
          const next = clampComment(e.target.value)
          setReviewerCommentDraft(next)
          onReviewerCommentChange?.(next)
        }}
      />
      <div className="text-right text-[11px] text-slate-400">
        {reviewerCommentDraft.length}/{COMMENT_LIMIT}
      </div>
    </section>
  ) : null
  // Left-rail jump list for the fullscreen split view. Items mirror exactly
  // what is rendered below so every link always has a live target.
  const navSections = [
    ...(isInfoPanelForm ? [{ id: 'form-section-info', label: 'Personal Information' }] : []),
    ...structure.map((domain) => ({ id: `form-section-${domain.key}`, label: domain.title })),
    ...(guideBlock ? [{ id: 'form-section-guide', label: 'Scoring Guide' }] : []),
    ...(!isClient && assessmentItems.length > 0 ? [{ id: 'form-section-signatures', label: 'Signatures' }] : []),
    ...(reviewerMode ? [{ id: 'form-section-reviewer', label: 'Reviewer Comment' }] : []),
  ]



  return (
    <div
      id="assessment-answer-shell"
      className={
        inline
          ? 'cmps-print-document cmps-print-page relative flex h-full min-h-0 w-full flex-col bg-[#F5F1FA]'
          : 'cmps-print-document cmps-print-page fixed inset-0 z-50 flex flex-col bg-slate-900/80'
      }
      role="dialog"
      aria-modal="true"
      aria-label="Assessment form"
    >
      {isClient ? (
        <ClientSubmissionConfirmation
          open={confirmingSubmit}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={submitAssessment}
          submitting={submitting}
          title="Confirm assessment submission"
          confirmLabel="Yes, submit assessment"
        />
      ) : null}
      {!isClient && confirmingStaffSubmit ? (
        <ConfirmDialog
          title="Submit Assessment?"
          message={`Are you sure you want to send "${selectedTemplate?.title || template?.title || 'this assessment'}" for ${selectedPatient?.name || prefilledPatientName || 'this student'} to the psychologist for review?`}
          confirmLabel="Yes"
          cancelLabel="No"
          busy={submitting}
          onClose={() => {
            if (!submitting) setConfirmingStaffSubmit(false)
          }}
          onConfirm={async () => {
            setConfirmingStaffSubmit(false)
            await submitAssessment()
          }}
        />
      ) : null}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #assessment-answer-shell, #assessment-answer-shell * { visibility: visible !important; }
          #assessment-answer-shell {
            position: relative !important;
            inset: auto !important;
            background-color: #fff !important;
            background-image: url('/cmps-form-template.png') !important;
            width: 8.5in !important;
            min-height: 13in !important;
            margin: 0 !important;
          }
          #assessment-answer-shell .assessment-print-content {
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
          }
          #assessment-answer-shell .no-print {
            display: none !important;
          }
        }
      `}</style>

      {!inline ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white print:hidden">
          <div className="text-sm font-semibold">{formReadOnly ? 'View Assessment' : 'Administer Assessment'}</div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      ) : null}

      <div className={`${inline ? 'flex-1 min-h-0 overflow-y-auto bg-[#efeaf7] dark:bg-slate-950 p-2 min-[360px]:p-4 sm:p-6' : 'flex-1 overflow-y-auto bg-[#efeaf7] dark:bg-slate-950 p-2 min-[360px]:p-4 sm:p-6'} assessment-print-content transition-colors`}>
        <div className={`mx-auto ${splitOuterLift ? 'max-w-none' : isAdaptive ? 'max-w-6xl' : 'max-w-3xl'} space-y-5`}>
          {headerActionsTarget
            ? createPortal(
                <div className="w-full print:hidden">{renderActionButtons(true)}</div>,
                headerActionsTarget,
              )
            : null}
          {!headerActionsTarget ? (
            <div className="no-print sticky top-0 z-30 -mx-1 mb-4 bg-[#efeaf7]/95 dark:bg-slate-950/95 px-1 pb-1 pt-1 backdrop-blur sm:-mx-2 sm:px-2 transition-colors">
              {renderActionButtons(true)}
            </div>
          ) : null}

          {!reviewerMode && activeSubmission?.reviewer_comment ? (
            <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 border-b border-red-100 pb-3 text-red-800">
                <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-sm font-bold uppercase tracking-widest">Psychologist's Note for Revision</h3>
              </div>
              <div className="mt-3 text-sm font-medium leading-relaxed text-red-900 whitespace-pre-wrap break-words">
                {activeSubmission.reviewer_comment}
              </div>
            </section>
          ) : null}

          {hidePrefillCard ? null : hasPrefill ? (
            <div className="rounded-3xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="space-y-2">
                <div className={labelClass}>Assessment</div>
                <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-purple-900 dark:text-purple-100">
                  {prefilledTemplateName || selectedTemplate?.title || template?.title || 'Selected assessment'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{isClient ? 'Student' : 'Patient'}</label>
                  <select
                    className={selectClass}
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    disabled={!canEditSelection}
                  >
                    <option value="">Select patient</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatLastFirstMI(p) || p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Assessment</label>
                  <select
                    className={selectClass}
                    value={templateId}
                    onChange={(e) => pickTemplate(e.target.value)}
                    disabled={!canEditSelection}
                  >
                    <option value="">Select assessment</option>
                    {activeTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {loadingTpl && (isAdaptive || isAdaptiveResolved) && splitLayout && !isClient ? (
              <AdaptiveLoadingSkeleton />
            ) : isAdaptive ? (
              <div key="adaptive-loaded" className="animate-content-fade-in">
              <AdaptiveFunctioningAssessmentForm
                structure={structure}
                answers={answers}
                onAnswer={setAnswer}
                metadata={metadata}
                onMetadataChange={setMetadata}
                patientId={patientId}
                patient={prefilledPatient}
                patientName={prefilledPatientName || selectedPatient?.name || ''}
                isClient={isClient}
                readOnly={formReadOnly}
                currentSigner={currentSigner}
                activeSubmission={activeSubmission}
                respondentSignature={respondentSignature}
                onRespondentSignatureChange={handleRespondentSignatureChange}
                reviewerMode={reviewerMode}
                reviewerProfile={reviewerProfile}
                reviewerSignature={reviewerSignature}
                onReviewerSignatureChange={onReviewerSignatureChange}
                reviewerComment={reviewerCommentDraft}
                onReviewerCommentChange={(value) => {
                  const next = clampComment(value)
                  setReviewerCommentDraft(next)
                  onReviewerCommentChange?.(next)
                }}
                onReviewerReturn={onReviewerReturn}
                onReviewerApprove={onReviewerApprove}
                reviewerBusy={reviewerBusy}
                renderActionButtons={renderActionButtons}
                splitLayout={splitLayout}
                highlightedItemKey={highlightedItemKey}
              />
              </div>
            ) : useSplitLayout ? (
              <div className="mx-auto grid w-full max-w-none items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6 pb-6 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:pb-8">
                  {infoPanel}
                  {useSplitLayout && navSections.length > 0 ? <FormSectionNav sections={navSections} /> : null}
                </div>
                <div className="min-w-0 space-y-6">
                  {domainsBlock}
                  {guideBlock}
                  {signaturesBlock}
                  {loadingTpl && !isClient ? <SignaturesSkeleton /> : null}
                  {reviewerCommentBlock}
                </div>
              </div>
            ) : (
              <>
            {/* Personal info + question blocks live in the consts above; composed per layout. */}
            {infoPanel}

            {domainsBlock}

            {guideBlock}

            {signaturesBlock}

            {loadingTpl && !isClient ? <SignaturesSkeleton /> : null}

            {reviewerCommentBlock}
              </>
            )}
        </div>
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
      <ScrollTopButton />
    </div>
  )
}

export default AnswerAssessment
