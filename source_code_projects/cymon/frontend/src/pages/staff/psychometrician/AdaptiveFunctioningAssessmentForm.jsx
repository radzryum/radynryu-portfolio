import { useEffect, useMemo, useState } from 'react'
import SignaturePad, { SavedSignature } from '../../../components/ui/SignaturePad'
import { isSealedStatus } from '../../../lib/signatures'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import FormSectionNav from '../../../components/ui/FormSectionNav'
import ReviewSessionNotice from '../../../components/ui/ReviewSessionNotice'
import { api } from '../../../lib/api'
import { capitalizeName } from '../../../lib/format'

const PROFILE_NAME = (profile) => capitalizeName(profile?.display_name || profile?.name) || 'NA'
const PROFILE_TITLE = (profile) => profile?.title || profile?.profession || ''
const PROFILE_LICENSE = (profile) => profile?.license_no || profile?.prc_no || 'NA'
const RESPONSE_LIMIT = 200
const REVIEWER_COMMENT_LIMIT = 100

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function isoDate(value) {
  return value ? String(value).slice(0, 10) : ''
}

function profileLine(profile, fallbackProfession = 'Psychometrician') {
  const name = PROFILE_NAME(profile)
  const profession = PROFILE_TITLE(profile) || fallbackProfession
  const lowerProfession = profession.toLowerCase()
  const honorific = lowerProfession.includes('psychologist') || lowerProfession.includes('rpsy') ? 'RPsy' : 'RPm'
  const cleanName = /\bRPm\b|\bRPsy\b/i.test(name) ? name : `${name}, ${honorific}`
  return `${cleanName} - PRC No. ${PROFILE_LICENSE(profile)}`
}

function assessorLine(profile, isClient) {
  return profile ? profileLine(profile) : (isClient ? 'Parent / Caregiver' : profileLine(profile))
}

const displayOption = (value) => {
  const labels = {
    yes: 'YES',
    no: 'NO',
    left: 'LEFT',
    right: 'RIGHT',
    both: 'BOTH',
    fisted: 'FISTED',
    four_finger: '4-FINGER',
    static_tripod: 'STATIC TRIPOD',
    dynamic_tripod: 'DYNAMIC TRIPOD',
  }
  return labels[value] || value
}

function ProfileSummary({ label, profile, signature, editable, onSignatureChange, signatureLabel, sealed = false, signedAt = '' }) {
  return (
    <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 transition-colors p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 transition-colors">{label}</div>
      <div className="mt-1 break-words text-[11px] leading-4 text-slate-600 dark:text-slate-300 transition-colors">
        {profileLine(profile, label.toLowerCase().includes('psychologist') ? 'Psychologist' : 'Psychometrician')}
      </div>
      <div className="mt-2">
        {editable ? (
          <div className="w-full">
            <SignaturePad label={signatureLabel} value={signature} onChange={onSignatureChange} sealed={sealed} signedAt={signedAt} />
          </div>
        ) : signature ? (
          <SavedSignature image={signature} alt={`${label} signature`} sealed={sealed} signedAt={signedAt} />
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-purple-200 bg-white p-2 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">No signature recorded yet.</div>
        )}
      </div>
    </div>
  )
}

function Stimuli({ values = [] }) {
  // Empty stimuli rendered a stray bordered box beside the item label —
  // render nothing when there is nothing to show.
  if (!values || values.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-purple-100 bg-slate-50 dark:bg-slate-950 transition-colors p-2">
      {values.map((value) => (
        <span key={value} className="rounded bg-white dark:bg-slate-900 transition-colors px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors shadow-sm">
          {value}
        </span>
      ))}
    </div>
  )
}

function AdaptiveFunctioningAssessmentForm({
  structure,
  answers,
  onAnswer,
  metadata,
  onMetadataChange,
  patientId,
  patient = null,
  patientName,
  isClient,
  readOnly,
  currentSigner,
  activeSubmission,
  respondentSignature,
  onRespondentSignatureChange,
  reviewerMode,
  reviewerProfile,
  reviewerSignature,
  onReviewerSignatureChange,
  reviewerComment,
  onReviewerCommentChange,
  onReviewerReturn,
  onReviewerApprove,
  reviewerBusy,
  renderActionButtons,
  splitLayout = false,
  highlightedItemKey = null,
}) {
  const [patientDetails, setPatientDetails] = useState(patient)
  const [metaPhotoViewer, setMetaPhotoViewer] = useState(null)

  useEffect(() => {
    let active = true
    const applyPatient = (nextPatient) => {
      if (!active || !nextPatient) return
      setPatientDetails(nextPatient)
      const guardian = (nextPatient?.guardians || []).find((item) => item.is_primary)?.full_name
        || nextPatient?.guardians?.[0]?.full_name
        || ''
      onMetadataChange((current) => ({
        ...current,
        assessment_date: current.assessment_date || isoDate(activeSubmission?.created_at) || todayIso(),
        student_name: current.student_name || nextPatient?.full_name || patientName || '',
        age_gender: current.age_gender || [nextPatient?.age, nextPatient?.sex].filter(Boolean).join(' / '),
        guardian_name: current.guardian_name || guardian,
        assessor_name: currentSigner ? profileLine(currentSigner) : current.assessor_name || assessorLine(null, isClient),
      }))
    }

    if (patient) {
      applyPatient(patient)
      // The roster row has no `guardians`, so the full record is fetched once
      // to auto-fill Name of Guardian. The merge keeps anything already
      // typed, so this never clobbers user input.
      if (!isClient && patientId && !Array.isArray(patient?.guardians)) {
        api.psychometrician.patient(patientId)
          .then((data) => {
            if (active && data?.patient) applyPatient({ ...patient, ...data.patient })
          })
          .catch(() => {})
      }
      return () => {
        active = false
      }
    }
    if (isClient || !patientId) return undefined

    api.psychometrician.patient(patientId)
      .then((data) => applyPatient(data.patient || null))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [
    isClient,
    patientId,
    patient,
    patientName,
    currentSigner?.display_name,
    currentSigner?.title,
    currentSigner?.license_no,
    activeSubmission,
    onMetadataChange,
  ])

  const setMetadata = (key, value) => {
    onMetadataChange((current) => ({ ...current, [key]: value }))
  }

  const effectiveMetadata = useMemo(() => ({
    student_name: metadata?.student_name || patientDetails?.full_name || patientName || '',
    assessment_date: metadata?.assessment_date || isoDate(activeSubmission?.created_at) || todayIso(),
    age_gender: metadata?.age_gender || [patientDetails?.age, patientDetails?.sex].filter(Boolean).join(' / '),
    guardian_name: metadata?.guardian_name || '',
    assessor_name: currentSigner ? profileLine(currentSigner) : metadata?.assessor_name || assessorLine(null, isClient),
  }), [metadata, patientDetails, patientName, currentSigner, isClient, activeSubmission])
  const assessorSignature = activeSubmission?.status === 'revalidation'
    ? respondentSignature
    : activeSubmission?.respondent_signature_image || respondentSignature

  // Split-screen composition (fullscreen staff view): the section blocks below
  // are the exact same JSX as the single-column flow — only their placement
  // changes (sticky info column + scrollable content column). No state or
  // handlers are affected.
  const useSplitLayout = splitLayout && !isClient
  const metaStudentPhoto = patientDetails?.photo_url || patientDetails?.patients?.photo_url || patient?.photo_url || ''
  const metaStudentName = effectiveMetadata.student_name || patientName || 'Student'
  const metaCard = (
    <section id="form-section-details" className={`relative overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm transition-shadow hover:shadow-md scroll-mt-4 ${useSplitLayout ? 'p-4 sm:p-5' : 'p-6'}`}>
      {useSplitLayout ? (
        <div className="mb-4 flex items-center gap-2.5">
          {metaStudentPhoto ? (
            <button
              type="button"
              onClick={() => setMetaPhotoViewer(metaStudentPhoto)}
              aria-label="View student photo"
              className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <img src={metaStudentPhoto} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-purple-200 dark:ring-slate-700" />
            </button>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-base font-bold text-purple-700 dark:text-purple-300 transition-colors">
              {(metaStudentName || 'ST').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          <div className="max-w-44 leading-tight">
            <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">
              {metaStudentName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
              ID: {patientDetails?.patient_id || patient?.patient_id || 'N/A'}
            </div>
          </div>
        </div>
      ) : null}
      <AvatarViewer src={metaPhotoViewer} alt={metaStudentName} onClose={() => setMetaPhotoViewer(null)} />
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl" />
      <div className="relative">
        {useSplitLayout ? null : (
          <div className="mb-6 flex items-center justify-between border-b border-purple-50 pb-4">
            <h2 className="text-base font-black tracking-tight text-purple-900 dark:text-purple-300 transition-colors">
              Child Adaptive Functioning Assessment Tool
            </h2>
          </div>
        )}
        <div className={`grid ${useSplitLayout ? 'grid-cols-1 gap-4' : 'gap-5 sm:grid-cols-2'}`}>
          {[
            ['assessment_date', 'Date'],
            ['student_name', 'Name of Student'],
            ['age_gender', 'Age/Gender'],
            ['guardian_name', 'Name of Guardian'],
            ['assessor_name', 'Name of Assessor'],
          ].map(([key, label]) => (
            <label key={key} className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors">{label}</span>
              <input
                type={key === 'assessment_date' ? 'date' : 'text'}
                className="h-11 w-full rounded-xl border border-purple-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors focus:border-purple-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-purple-400/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400"
                value={effectiveMetadata[key]}
                disabled={readOnly || key === 'student_name' || key === 'assessor_name'}
                onChange={(event) => setMetadata(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  )
  const domainSections = structure.map((domain) => (
    <section key={domain.key} id={`form-section-${domain.key}`} className="overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
      <header className="flex items-center justify-between border-b border-purple-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 px-6 py-4 transition-colors">
        <div className="text-sm font-black tracking-tight text-purple-900 dark:text-purple-300 transition-colors">{domain.title}</div>
      </header>
      <div className="divide-y divide-purple-50 dark:divide-slate-800 transition-colors">
        {(domain.items || []).map((item) => {
          const value = answers[item.key] || ''
          if (item.response_type === 'text') {
            return (
              <div key={item.key} id={`item-${item.key}`} className={`flex flex-col gap-4 px-6 py-6 transition-colors ${
                highlightedItemKey === item.key
                  ? 'bg-rose-50/50 dark:bg-rose-900/20 ring-2 ring-inset ring-rose-400 dark:ring-rose-500 shadow-sm animate-[pulse_1.5s_ease-in-out_2]'
                  : 'hover:bg-purple-50/30 dark:hover:bg-slate-800/40'
              }`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors leading-snug">{item.label}</div>
                  <Stimuli values={item.stimuli} />
                </div>
                <div className="w-full">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-purple-400">
                    <span>Observation</span>
                    <span className="text-slate-400">
                      {value.length}/{RESPONSE_LIMIT}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={RESPONSE_LIMIT}
                    disabled={readOnly}
                    className="w-full resize-y rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors px-4 py-3 text-sm text-slate-700 dark:text-slate-200 transition-colors outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-950 transition-colors disabled:text-slate-500 dark:text-slate-400 transition-colors"
                    value={value}
                    onChange={(event) => onAnswer(item.key, event.target.value.slice(0, RESPONSE_LIMIT))}
                    placeholder={`Record an observation for ${item.label.toLowerCase()}...`}
                  />
                </div>
              </div>
            )
          }
          return (
            <div key={item.key} id={`item-${item.key}`} className={`flex flex-col gap-4 px-6 py-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
              highlightedItemKey === item.key
                ? 'bg-rose-50/50 dark:bg-rose-900/20 ring-2 ring-inset ring-rose-400 dark:ring-rose-500 shadow-sm animate-[pulse_1.5s_ease-in-out_2]'
                : 'hover:bg-purple-50/30 dark:hover:bg-slate-800/40'
            }`}>
              <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 transition-colors pr-4">{item.label}</div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 transition-colors p-1">
                {(item.options || []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onAnswer(item.key, option)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      value === option
                        ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-700'
                        : readOnly
                        ? 'cursor-not-allowed text-slate-400'
                        : 'text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-100 hover:text-purple-700'
                    }`}
                  >
                    {displayOption(option)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  ))
  const signaturesSection = !isClient ? (
    <section id="form-section-signatures" className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm scroll-mt-4">
      <div className="mb-4 text-sm font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">Required Signatures</div>
      <p className="mb-4 -mt-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        The assigned psychometrician signs before submission. The assigned psychologist signs during approval.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSummary
          label="Psychometrician Signature"
          profile={activeSubmission?.respondent_profile || currentSigner}
          signature={assessorSignature}
          editable={!readOnly && !reviewerMode}
          onSignatureChange={onRespondentSignatureChange}
          signatureLabel=""
          sealed={isSealedStatus(activeSubmission?.status)}
          signedAt={String(activeSubmission?.submitted_at || '').slice(0, 10)}
        />
        {reviewerMode ? (
          <div className="rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/60 dark:bg-slate-800/60 transition-colors p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 transition-colors">Psychologist Review</div>
            <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-300 transition-colors">
              <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Name:</span> {PROFILE_NAME(reviewerProfile)}</div>
              <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">Profession:</span> {PROFILE_TITLE(reviewerProfile)}</div>
              <div><span className="font-semibold text-slate-500 dark:text-slate-400 transition-colors">PRC No.:</span> {PROFILE_LICENSE(reviewerProfile)}</div>
            </div>
            <div className="mt-3">
              <SignaturePad label="Psychologist Signature" value={reviewerSignature} onChange={onReviewerSignatureChange} />
            </div>
          </div>
        ) : (
          <ProfileSummary
            label="Psychologist Review"
            profile={activeSubmission?.reviewer_profile || reviewerProfile}
            signature={activeSubmission?.reviewer_signature_image}
            editable={false}
            signatureLabel="Psychologist Signature"
            sealed
            signedAt={String(activeSubmission?.reviewed_at || '').slice(0, 10)}
          />
        )}
      </div>
    </section>
  ) : null
  const reviewerSection = reviewerMode ? (
    <section id="form-section-reviewer" className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm scroll-mt-4">
      <div className="mb-3">
        <ReviewSessionNotice />
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">Reviewer Comment</div>
      <textarea
        className="mt-3 w-full resize-none overflow-hidden rounded-xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm leading-6 text-slate-800 dark:text-slate-100 outline-none transition focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        rows={4}
        maxLength={REVIEWER_COMMENT_LIMIT}
        value={reviewerComment || ''}
        onChange={(event) => onReviewerCommentChange?.(event.target.value.slice(0, REVIEWER_COMMENT_LIMIT))}
        placeholder="Write the concern or revision note for the psychometrician..."
      />
      <div className="mt-1 text-right text-[11px] text-slate-400">
        {(reviewerComment || '').length}/{REVIEWER_COMMENT_LIMIT}
      </div>
    </section>
  ) : null
  // Left-rail jump list for the fullscreen split view. Items mirror exactly
  // what is rendered below so every link always has a live target.
  const navSections = [
    { id: 'form-section-details', label: 'Student Details' },
    ...structure.map((domain) => ({ id: `form-section-${domain.key}`, label: domain.title })),
    ...(!isClient ? [{ id: 'form-section-signatures', label: 'Signatures' }] : []),
    ...(reviewerMode ? [{ id: 'form-section-reviewer', label: 'Reviewer Comment' }] : []),
  ]

  return (
    useSplitLayout ? (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6 pb-6 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:pb-8">
          {metaCard}
          {useSplitLayout && navSections.length > 0 ? <FormSectionNav sections={navSections} /> : null}
        </div>
        <div className="min-w-0 space-y-6">
          {domainSections}
          {signaturesSection}
          {reviewerSection}
        </div>
      </div>
    ) : (
    <div className="space-y-5">
      {/* Meta header lives in the metaCard const above. */}
      {metaCard}
      {/* Meta body moved to the metaCard const above. */}

      {/* Domain sections moved to the domainSections const above. */}
      {domainSections}

      {/* Signatures moved to the signaturesSection const above. */}
      {signaturesSection}

      {/* Reviewer comment moved to the reviewerSection const above. */}
      {reviewerSection}
    </div>
    )
  )
}

export default AdaptiveFunctioningAssessmentForm
