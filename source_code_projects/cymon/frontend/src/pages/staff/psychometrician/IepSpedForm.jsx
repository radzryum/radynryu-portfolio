import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Radio from '../../../components/ui/Radio'
import FormShell from '../../../components/ui/FormShell'
import BlankField from '../../../components/ui/BlankField'
import DatePicker from '../../../components/ui/DatePicker'
import FormHeading from '../../../components/ui/FormHeading'
import SignaturePad, { SavedSignature } from '../../../components/ui/SignaturePad'
import { blankInput } from '../../../components/ui/formStyles'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import FormActionButtons from '../../../components/ui/FormActionButtons'
import ReviewSessionNotice from '../../../components/ui/ReviewSessionNotice'
import ScrollTopButton from '../../../components/ui/ScrollTopButton'
import { api } from '../../../lib/api'
import { capitalizeName } from '../../../lib/format'
import { toast } from 'react-hot-toast'
import {
  IEP_DOMAINS,
  IEP_FIELD_HINTS,
  IEP_LEVELS,
  IEP_MAX_WEEKS,
  IEP_MIN_WEEKS,
  clampWeeks,
  cycleInfoFor,
  durationWeeksOf,
  endDateOf,
  fmtDate as fmtIepDate,
  isWeekStarted as isWeekStartedShared,
  kindForCycleNumber,
} from '../../../lib/iep'

const TEXT_LIMIT = 400
const SHORT_TEXT_LIMIT = 100
const REVIEW_COMMENT_LIMIT = 100
const NO_SESSION_REASON_LIMIT = 400
const todayIso = () => new Date().toISOString().slice(0, 10)

// Plain-language helper shown beside clinical terms (the team asked for these:
// support levels, domain names, and what each field is actually asking for).
function Tip({ text, label = 'What does this mean?' }) {
  if (!text) return null
  return (
    <span
      title={text}
      aria-label={`${label} ${text}`}
      className="ml-1.5 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-purple-100 align-middle text-[10px] font-black text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
    >
      ?
    </span>
  )
}

const INITIAL_WEEK_STATE = {
  level: '',
  noSession: false,
  noSessionReason: '',
  practical: { activity: '', objectives: '', materials: '', notes: '' },
  social: { activity: '', objectives: '', materials: '', notes: '' },
  conceptual: { activity: '', objectives: '', materials: '', notes: '' },
  kinFine: { activity: '', objectives: '', materials: '', notes: '' },
  kinGross: { activity: '', objectives: '', materials: '', notes: '' },
}

const cloneWeekState = () => JSON.parse(JSON.stringify(INITIAL_WEEK_STATE))

// First three domains render in the shared domain list; bodily kinesthetics
// (fine + gross motor) renders in its own cards below.
const CORE_DOMAINS = IEP_DOMAINS.slice(0, 3)

const buildWeeks = (duration, carriedLevel = '') => {
  const weeks = {}
  for (let w = 1; w <= clampWeeks(duration); w += 1) {
    weeks[w] = cloneWeekState()
  }
  if (carriedLevel && weeks[1]) weeks[1].level = carriedLevel
  return weeks
}

const createInitialForm = (patient = null, period = 'Month 1', prefill = null) => {
  const duration = clampWeeks(prefill?.durationWeeks ?? 4)
  const info = cycleInfoFor(prefill?.period || period, null)
  return {
    title: 'Individualized Education Plan',
    learnerName: patient?.full_name || patient?.name || '',
    learnerDob: patient?.date_of_birth || '',
    planStart: prefill?.startDate || todayIso(),
    techName: '',
    diagnosis: '',
    caseRef: '',
    cycle: {
      number: prefill?.period ? (cycleInfoFor(prefill.period, null).number) : info.number,
      kind: prefill?.period ? kindForCycleNumber(cycleInfoFor(prefill.period, null).number) : info.kind,
      durationWeeks: duration,
    },
    weeks: buildWeeks(duration, prefill?.carriedLevel || ''),
  }
}

const normalizeWeek = (value = {}) => ({
  ...cloneWeekState(),
  ...value,
  noSession: Boolean(value.noSession),
  noSessionReason: String(value.noSessionReason || '').slice(0, NO_SESSION_REASON_LIMIT),
  practical: { ...cloneWeekState().practical, ...(value.practical || {}) },
  social: { ...cloneWeekState().social, ...(value.social || {}) },
  conceptual: { ...cloneWeekState().conceptual, ...(value.conceptual || {}) },
  kinFine: { ...cloneWeekState().kinFine, ...(value.kinFine || {}) },
  kinGross: { ...cloneWeekState().kinGross, ...(value.kinGross || {}) },
})

const normalizeContent = (raw, patient, period = 'Month 1', prefill = null) => {
  const initial = createInitialForm(patient, period, prefill)
  if (!raw) return initial
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const source = parsed?.form || parsed?.iep || parsed || {}

    // Strip legacy signature fields so they don't trigger backend text length validation (400 chars)
    const cleanSource = { ...source }
    delete cleanSource.preparedSignature
    delete cleanSource.reviewerSignature
    delete cleanSource.signatures

    // Duration: explicit metadata wins; otherwise keep the legacy 4-week
    // shape unless stored weeks reach further.
    let duration = clampWeeks(source.cycle?.durationWeeks)
    if (source.cycle?.durationWeeks == null) {
      const keys = Object.keys(source.weeks || {})
        .map((k) => Number(k))
        .filter((k) => Number.isInteger(k) && k >= 1 && k <= IEP_MAX_WEEKS)
      duration = keys.length && Math.max(...keys) > 4 ? clampWeeks(Math.max(...keys)) : 4
    }
    const storedCycle = source.cycle || {}
    const info = cycleInfoFor(period, source)
    const weeks = {}
    for (let w = 1; w <= duration; w += 1) {
      weeks[w] = normalizeWeek(source.weeks?.[w] || source.weeks?.[String(w)])
    }
    return {
      ...initial,
      ...cleanSource,
      // Old rows saved the therapist name lowercase — normalize on load so
      // the field displays correctly. Typing is unaffected (onChange never
      // capitalizes), and the next save heals the stored value.
      techName: capitalizeName(source.techName || ''),
      cycle: {
        number: storedCycle.number ?? info.number,
        kind: storedCycle.kind || info.kind,
        durationWeeks: duration,
      },
      weeks,
    }
  } catch {
    return initial
  }
}

const profileName = (profile) =>
  capitalizeName(profile?.display_name || profile?.name || profile?.full_name) || 'NA'

const profileProfession = (profile, fallback) =>
  profile?.title || profile?.profession || fallback

const profileLicense = (profile) =>
  profile?.license_no || profile?.prc_no || profile?.prc_number || 'NA'

function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-6 sm:p-10 shadow-sm transition-all hover:shadow-md ${className}`}>
      <div className="mb-5 flex flex-col gap-1.5">
        <h3 className="text-sm font-bold uppercase tracking-widest text-purple-900">{title}</h3>
        {subtitle ? <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 transition-colors">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function FieldCardLabel({ children }) {
  return (
    <label className="mb-2 flex min-h-6 items-end text-xs font-bold uppercase leading-5 tracking-widest text-purple-800 dark:text-purple-300 transition-colors">
      {children}
    </label>
  )
}

function IepSpedForm({
  patient,
  report,
  period = 'Month 1',
  cyclePrefill = null,
  onSaved,
  // Background list refresh after a plain draft save (stays in the form).
  // onSaved still means "done" (Send/approve flows) and may close the form.
  onDraftSaved = null,
  onClose,
  inline = true,
  readOnly = false,
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
  embedded = false,
}) {
  const [f, setF] = useState(() => createInitialForm(patient, period, cyclePrefill))
  const [currentProfile, setCurrentProfile] = useState(null)
  const [patientDetails, setPatientDetails] = useState(null)
  const [preparedSignature, setPreparedSignature] = useState(null)
  const [preparedDate, setPreparedDate] = useState(todayIso())
  const [currentWeek, setCurrentWeek] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Last silent-autosave failure, shown persistently (no toast spam) so a
  // rejected autosave can never masquerade as saved work.
  const [saveError, setSaveError] = useState('')
  const [draftId, setDraftId] = useState(report?.id || null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [levelSuggestion, setLevelSuggestion] = useState(null)
  const [levelSuggestionLoading, setLevelSuggestionLoading] = useState(false)
  // Unsaved-edit tracking. Background refreshes (window-focus reload, slow
  // autosaves landing late) must never reseed the form over in-progress
  // typing — that is the "type исчезает / form resets" bug. dirtyRef marks
  // local edits since the last successful save; seededTargetRef remembers
  // which patient/report snapshot already seeded the form; saveChainRef
  // serializes autosaves so snapshots always persist newest-last on slow
  // networks instead of racing out of order.
  const dirtyRef = useRef(false)
  const seededTargetRef = useRef({ patientId: null, reportId: null })
  const saveChainRef = useRef(Promise.resolve())
  // True while a Send is in flight. A pending autosave timer firing mid-send
  // posts a draft snapshot that races the review status commit — the loser
  // silently reverted a submission to draft. Skip the timer and double-taps
  // while sending; the Send payload already carries the latest form state.
  const sendInFlightRef = useRef(false)
  const markDirty = () => {
    dirtyRef.current = true
  }

  useEffect(() => {
    if (report?.id) setDraftId(report.id)
  }, [report?.id])

  useEffect(() => {
    api.me()
      .then((d) => setCurrentProfile(d.profile || null))
      .catch(() => toast.error('Could not load your profile. Signature may be unavailable.'))
  }, [])

  useEffect(() => {
    const targetPatientId = patient?.id || ''
    const targetReportId = report?.id || ''
    const switchedTarget =
      seededTargetRef.current.patientId !== targetPatientId ||
      seededTargetRef.current.reportId !== targetReportId
    // Same patient/report with unsaved typing: a background refresh (focus
    // reload, autosave shifting updated_at) must not wipe the form or yank
    // the week tab back to 1. Only a real target switch reseeds.
    if (!switchedTarget && dirtyRef.current) return
    const targetId = patient?.id || report?.patient_id
    const initialPatient = {
      ...(patient || {}),
      full_name: patient?.full_name || patient?.name || report?.name || '',
    }
    setPatientDetails(initialPatient)
    setF(normalizeContent(report?.content, initialPatient, report?.period || period, report?.content ? null : cyclePrefill))
    let parsedContent = null
    try {
      parsedContent = typeof report?.content === 'string' ? JSON.parse(report.content) : report?.content
    } catch {
      parsedContent = null
    }
    setPreparedSignature(
      report?.prepared_signature_image ||
      parsedContent?.preparedSignature ||
      parsedContent?.signatures?.preparedSignature ||
      parsedContent?.signatures?.prepared ||
      null,
    )
    setPreparedDate(parsedContent?.preparedDate || parsedContent?.signatures?.preparedDate || todayIso())
    // Keep the clinician's week tab on plain data refreshes; reset only when
    // they actually switched patient/report.
    if (switchedTarget) setCurrentWeek(1)
    setError('')
    seededTargetRef.current = { patientId: targetPatientId, reportId: targetReportId }
    dirtyRef.current = false

    if (!targetId) return
    setLevelSuggestionLoading(true)
    api.psychologist.rosterSuggestion(targetId)
      .then((d) => setLevelSuggestion(d.suggestion || null))
      .catch(() => setLevelSuggestion(null))
      .finally(() => setLevelSuggestionLoading(false))
    api.psychometrician
      .patient(targetId)
      .then((data) => {
        const resolved = data.patient || initialPatient
        setPatientDetails(resolved)
        setF((current) => ({
          ...current,
          learnerName: current.learnerName || resolved.full_name || patient?.name || '',
          learnerDob: current.learnerDob || resolved.date_of_birth || '',
        }))
      })
      .catch(() => toast.error('Could not load patient details. Showing saved draft data.'))
  }, [patient?.id, report?.id, report?.date])

  // Auto-fill Diagnosis from the clinical profile's working_diagnosis, like
  // the Monthly form does — it is the same answer on every form, so the
  // clinician should not retype it. Fills only when empty; never overwrites
  // typing.
  useEffect(() => {
    const clinical = patientDetails?.clinical_profiles
    const workingDiagnosis = Array.isArray(clinical)
      ? clinical[0]?.working_diagnosis
      : clinical?.working_diagnosis
    if (!workingDiagnosis) return
    markDirty()
    setF((current) => ({
      ...current,
      diagnosis: String(current.diagnosis || workingDiagnosis).slice(0, SHORT_TEXT_LIMIT),
    }))
  }, [patientDetails])

  const setVal = (k, v) => {
    markDirty()
    setF((s) => ({ ...s, [k]: v }))
  }

  const setWeekField = (domain, field, val) => {
    markDirty()
    setF((s) => {
      const nextWeeks = { ...s.weeks }
      nextWeeks[currentWeek] = {
        ...nextWeeks[currentWeek],
        [domain]: {
          ...nextWeeks[currentWeek][domain],
          [field]: val,
        },
      }
      return { ...s, weeks: nextWeeks }
    })
  }

  const setWeekLevel = (val) => {
    markDirty()
    setF((s) => {
      const nextWeeks = { ...s.weeks }
      nextWeeks[currentWeek] = {
        ...nextWeeks[currentWeek],
        level: val,
      }
      return { ...s, weeks: nextWeeks }
    })
  }

  // Cycle length in weeks. Weeks are never deleted with content in them —
  // shortening below a started week is blocked so work can't silently vanish.
  const totalWeeks = durationWeeksOf(f)

  const setDuration = (next) => {
    markDirty()
    const clamped = clampWeeks(next)
    if (clamped === totalWeeks) return
    if (clamped < totalWeeks) {
      for (let w = clamped + 1; w <= totalWeeks; w += 1) {
        if (isWeekStartedShared(f.weeks?.[w] || f.weeks?.[String(w)])) {
          toast.error(`Week ${w} already has entries — clear it first before shortening the plan.`)
          return
        }
      }
      if (currentWeek > clamped) setCurrentWeek(clamped)
    }
    setF((s) => {
      const nextWeeks = { ...s.weeks }
      for (let w = 1; w <= clamped; w += 1) {
        if (!nextWeeks[w]) nextWeeks[w] = cloneWeekState()
      }
      for (const key of Object.keys(nextWeeks)) {
        if (Number(key) > clamped) delete nextWeeks[key]
      }
      return { ...s, weeks: nextWeeks, cycle: { ...(s.cycle || {}), durationWeeks: clamped } }
    })
  }

  const setWeekNoSession = (val) => {
    markDirty()
    setF((s) => {
      const nextWeeks = { ...s.weeks }
      nextWeeks[currentWeek] = {
        ...nextWeeks[currentWeek],
        noSession: val,
      }
      return { ...s, weeks: nextWeeks }
    })
  }

  const setWeekNoSessionReason = (val) => {
    markDirty()
    const sliced = String(val || '').slice(0, NO_SESSION_REASON_LIMIT)
    setF((s) => {
      const nextWeeks = { ...s.weeks }
      nextWeeks[currentWeek] = {
        ...nextWeeks[currentWeek],
        noSessionReason: sliced,
      }
      return { ...s, weeks: nextWeeks }
    })
  }

  useEffect(() => {
    if (!currentProfile || report?.content) return
    markDirty()
    setF((current) => ({
      ...current,
      techName: current.techName || profileName(currentProfile),
    }))
  }, [currentProfile, report?.content])

  const editableStatuses = ['draft', 'in_progress', 'revise_requested', 'revalidation']
  const effectiveReadOnly =
    readOnly ||
    (report?.status ? !editableStatuses.includes(report.status) : false)

  const preparedProfile =
    report?.prepared_profile ||
    report?.prepared_by ||
    patientDetails?.treating_psychometrician ||
    currentProfile
  const reviewerProfile =
    reviewerProfileProp ||
    report?.reviewer_profile ||
    report?.noted_by ||
    patientDetails?.treating_psychologist ||
    null
  const reviewerSignature =
    reviewerSignatureProp ||
    report?.reviewer_signature_image ||
    (() => {
      try {
        const parsed = typeof report?.content === 'string' ? JSON.parse(report.content) : report?.content
        return parsed?.reviewerSignature || parsed?.signatures?.notedSignature || parsed?.signatures?.noted || null
      } catch {
        return null
      }
    })() ||
    null
  const reviewerComment =
    reviewerCommentProp ||
    report?.reviewer_comment ||
    ''
  const [pdfPreview, setPdfPreview] = useState(null)
  const [previewingPdf, setPreviewingPdf] = useState(false)
  
  const previewOfficialPdf = async () => {
    let reportIdToUse = draftId || report?.id
    if (!effectiveReadOnly && !reviewerMode) {
      setPreviewingPdf(true)
      try {
        const res = await saveDraft(true)
        if (res?.id) reportIdToUse = res.id
      } catch (err) {
        toast.error(err.message || 'Failed to save draft before previewing.')
        setPreviewingPdf(false)
        return
      }
      setPreviewingPdf(false)
    }

    if (!reportIdToUse) {
      toast.error('Save the report first so the official PDF can load its database record.')
      return
    }

    setPdfPreview({
      title: `Individualized Educational Plan – ${patientDetails?.full_name || 'Student'}`,
      filename: `${patientDetails?.patient_id || report?.patient_id || patient?.patient_id || 'Student'}-CMPS-SE-FO-10.pdf`,
      loadPdf: () => api.psychometrician.downloadDocumentPdf('assessment_reports', reportIdToUse),
    })
  }

  const isWeekStarted = (weekData) => isWeekStartedShared(weekData)

  const noSessionWeek = (weekData) => Boolean(weekData?.noSession)

  const findMissingField = () => {
    const basics = [
      ["learner's name", f.learnerName],
      ['date of birth', f.learnerDob],
      ['plan start date', f.planStart],
      ['behavioral therapist', f.techName],
      ['diagnosis / profile', f.diagnosis],
    ]
    const missingBasic = basics.find(([, value]) => !String(value || '').trim())
    if (missingBasic) return missingBasic[0]

    const domainLabels = {
      practical: 'Practical Domain',
      social: 'Social Domain',
      conceptual: 'Conceptual Domain',
      kinFine: 'Fine Motor Skills',
      kinGross: 'Gross Motor Skills',
    }
    for (let week = 1; week <= totalWeeks; week += 1) {
      const weekData = f.weeks?.[week] || f.weeks?.[String(week)]
      // Week 1 is always required for review. Later weeks are optional until
      // started, so a Week 1-only IEP can be sent for checking while the
      // rest stay as draft. A no-session week only needs its reason.
      if (week > 1 && !isWeekStarted(weekData)) continue
      if (noSessionWeek(weekData)) {
        if (!String(weekData?.noSessionReason || '').trim()) {
          return `Week ${week} no-session reason`
        }
        continue
      }
      if (!weekData?.level) return `Week ${week} support level`
      for (const domain of Object.keys(domainLabels)) {
        for (const field of ['activity', 'objectives', 'materials']) {
          if (!String(weekData?.[domain]?.[field] || '').trim()) {
            return `Week ${week} ${domainLabels[domain]} ${field}`
          }
        }
      }
    }
    return ''
  }

  // Cycle metadata travels inside content so legacy rows (no cycle key)
  // keep rendering. The plan start date doubles as the plan's start date.
  const cycleForSave = () => ({
    ...(f.cycle || {}),
    durationWeeks: totalWeeks,
    startDate: f.planStart,
  })

  const saveDraft = async (silent = false) => {
    if (reviewerMode || effectiveReadOnly) return null
    const targetPatientId = patient?.id || patientDetails?.id || report?.patient_id
    if (!targetPatientId) return null

    if (!silent) setSavingDraft(true)
    try {
      const payload = {
        id: draftId || undefined,
        patient_id: targetPatientId,
        title: f.title || 'Individualized Education Plan',
        period: report?.period || period,
        status: report?.status === 'revise_requested' ? 'revise_requested' : 'draft',
        content: {
          schema_version: 1,
          ...f,
          cycle: cycleForSave(),
          preparedDate,
        },
        prepared_signature_image: preparedSignature || undefined,
      }
      const res = await api.psychometrician.addIepReport(payload)
      if (res?.report?.id) {
        setDraftId(res.report.id)
      }
      setLastSaved(new Date())
      // The server now holds these edits — a later background refresh may
      // reseed again without wiping anything.
      dirtyRef.current = false
      setSaveError('')
      if (!silent) {
        // Stay in the form after a plain draft save: kicking the clinician
        // back to the list on every Save is what made saved work feel like
        // it "disappeared". Only refresh the parent list in the background
        // so Back shows the saved row.
        toast.success('Draft saved successfully.')
        await onDraftSaved?.()
      }
      return res?.report || null
    } catch (err) {
      if (silent) {
        // Silent autosaves must never toast-spam, but they must never fail
        // invisibly either — otherwise the clinician believes work is saved
        // while every attempt is being rejected (e.g. overlong text).
        setSaveError(err.message || 'Auto-save failed.')
      } else {
        toast.error(err.message || 'Failed to save draft.')
      }
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
    saveChainRef.current
      .then(() => saveDraftRef.current(true))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (reviewerMode || effectiveReadOnly) return
    const targetPatientId = patient?.id || patientDetails?.id || report?.patient_id
    if (!targetPatientId) return

    const timer = setTimeout(() => {
      // Never autosave mid-send (see sendInFlightRef): the draft snapshot
      // would race the review-status commit.
      if (sendInFlightRef.current) return
      // Chain autosaves so slow networks persist newest-last instead of
      // racing out of order (an older snapshot resolving last would silently
      // roll back newer typing server-side). Always run the latest saveDraft
      // so a queued retry carries the freshest form state.
      saveChainRef.current = saveChainRef.current
        .then(() => saveDraftRef.current(true))
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [f, preparedDate, preparedSignature, patientDetails?.full_name])

  const handleSend = async () => {
    // Double-tap guard: a second Send racing the first is pointless (the
    // row flips to review on the first commit) and confusing on failure.
    if (sendInFlightRef.current || busy) return
    const missing = findMissingField()
    if (missing) {
      const message = `Please complete ${missing} before sending the IEP.`
      setError(message)
      toast.error(message)
      return
    }
    if (!preparedSignature) {
      const message = 'Please add the psychometrician signature before sending the IEP.'
      setError(message)
      toast.error(message)
      return
    }
    if (!preparedDate) {
      const message = 'Please add the psychometrician signature date before sending the IEP.'
      setError(message)
      toast.error(message)
      return
    }

    setBusy(true)
    setError('')
    sendInFlightRef.current = true
    try {
      // Drain any in-flight autosave first so no stale draft snapshot can
      // commit after this review status (that race silently reverted a
      // submission to draft with zero audit trace).
      await saveChainRef.current.catch(() => {})
      const payload = {
        id: draftId || undefined,
        patient_id: patient?.id || patientDetails?.id || report?.patient_id,
        title: f.title || 'Individualized Education Plan',
        period: report?.period || period,
        status: 'ready_for_review',
        content: {
          schema_version: 1,
          ...f,
          cycle: cycleForSave(),
          preparedDate,
        },
        prepared_signature_image: preparedSignature,
      }
      await api.psychometrician.addIepReport(payload)
      toast.success('IEP sent to the psychologist for review.')
      await onSaved?.()
    } catch (err) {
      const message = err.message || 'Failed to send the IEP.'
      setError(message)
      toast.error(message)
    } finally {
      sendInFlightRef.current = false
      setBusy(false)
    }
  }

  const fieldInputStyle = "w-full rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-200/50 hover:border-purple-300"
  const fieldTextareaStyle = "w-full min-h-[120px] resize-y rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100 transition-colors outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-200/50 hover:border-purple-300"

  const footerActions = (
    <div className="flex w-full flex-col gap-3 border-t border-purple-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-4 text-xs text-rose-600">{error || (saveError ? `Auto-save failed: ${saveError} Your latest typing is only on this screen.` : '')}</div>
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
              disabled={busy || savingDraft}
              className="inline-flex min-w-32 items-center justify-center rounded-xl border border-slate-300 bg-white dark:bg-slate-900 transition-colors px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm transition hover:bg-slate-50 dark:bg-slate-950 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || savingDraft}
              className="inline-flex min-w-48 items-center justify-center rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending...' : 'Send to Psychologist'}
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
        onSubmit={handleSend}
        submitting={busy}
        onSaveDraft={() => saveDraft()}
        savingDraft={savingDraft}
        lastSaved={lastSaved}
      />
    </div>
  )

  return (
    <FormShell
      title="Individualized Education Plan (IEP)"
      subtitle="Weekly activity and progress record for the Special Education (SPED) program"
      code="CMPS:SE-FO-10 rev.0 03182026"
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
          <h1 className="text-2xl font-black tracking-tight text-purple-900 uppercase">Individualized Education Plan (IEP)</h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-purple-600 uppercase">Special Education Program</p>
        </div>
        {!headerActionsTarget ? (
          <div className="no-print sticky top-0 z-30 -mx-3 mb-2 bg-[#efeaf7]/95 px-3 pb-1 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {footerActions}
          </div>
        ) : null}


        {!reviewerMode && reviewerComment ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
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

      <fieldset disabled={effectiveReadOnly} className="space-y-4">
        <SectionCard
          title="Learner Information"
          subtitle="Core student demographics and referral details."
        >
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-3">
            <div className="flex flex-col">
              <FieldCardLabel>Learner's Name</FieldCardLabel>
              <input className={fieldInputStyle} value={f.learnerName} maxLength={SHORT_TEXT_LIMIT} onChange={(e) => setVal('learnerName', e.target.value.slice(0, SHORT_TEXT_LIMIT))} />
            </div>
            <div className="flex flex-col">
              <FieldCardLabel>Date of Birth</FieldCardLabel>
              <DatePicker value={f.learnerDob} onChange={(value) => setVal('learnerDob', value)} disabled={effectiveReadOnly} ariaLabel="Date of Birth" />
            </div>
            <div className="flex flex-col">
              <FieldCardLabel>Plan Start Date</FieldCardLabel>
              <DatePicker value={f.planStart} onChange={(value) => setVal('planStart', value)} disabled={effectiveReadOnly} ariaLabel="Plan Start Date" />
            </div>
            <div className="flex flex-col">
              <FieldCardLabel>Behavioral Therapist</FieldCardLabel>
              <input className={fieldInputStyle} value={f.techName} maxLength={SHORT_TEXT_LIMIT} onChange={(e) => setVal('techName', e.target.value.slice(0, SHORT_TEXT_LIMIT))} placeholder="Prepared by" />
            </div>
            <div className="flex flex-col">
              <FieldCardLabel>Diagnosis / Profile</FieldCardLabel>
              <input className={fieldInputStyle} value={f.diagnosis} maxLength={SHORT_TEXT_LIMIT} onChange={(e) => setVal('diagnosis', e.target.value.slice(0, SHORT_TEXT_LIMIT))} placeholder="e.g. ASD, Level 1" />
            </div>
            <div className="flex flex-col">
              <FieldCardLabel>Case Ref No.</FieldCardLabel>
              <input className={fieldInputStyle} value={f.caseRef} maxLength={SHORT_TEXT_LIMIT} onChange={(e) => setVal('caseRef', e.target.value.slice(0, SHORT_TEXT_LIMIT))} />
            </div>
          </div>
        </SectionCard>
      </fieldset>

        <SectionCard
          title="Weekly Activities & Domains"
          subtitle="Select a week tab below to review or update domain activities."
        >
          {/* Plan summary: which plan this is, its kind, dates, and length.
              The duration stepper adds/removes weeks (1–12). */}
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-purple-200 dark:border-slate-700 bg-purple-50/60 dark:bg-purple-900/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="font-bold text-purple-800 dark:text-purple-200">
                {cycleInfoFor(report?.period || period, f).label}
              </span>
              {' '}· {cycleInfoFor(report?.period || period, f).kindLabel}
              {' '}· {fmtIepDate(f.planStart)} – {fmtIepDate(endDateOf(f))}
              {' '}· {totalWeeks} week{totalWeeks === 1 ? '' : 's'}
              <Tip text="A plan is one IEP period. Plan 1 is the initial plan, and later plans are renewals. Weeks = how many weekly sessions this plan covers." />
            </div>
            {!effectiveReadOnly && !reviewerMode ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Weeks</span>
                <button
                  type="button"
                  onClick={() => setDuration(totalWeeks - 1)}
                  disabled={totalWeeks <= IEP_MIN_WEEKS}
                  aria-label="Remove last week"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-200 bg-white text-base font-bold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-sm font-black text-purple-800" aria-live="polite">{totalWeeks}</span>
                <button
                  type="button"
                  onClick={() => setDuration(totalWeeks + 1)}
                  disabled={totalWeeks >= IEP_MAX_WEEKS}
                  aria-label="Add a week"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-200 bg-white text-base font-bold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
          {/* Week stepper: each tab shows its number, selected level, and a
              filled dot once the week has any content — so it is always
              obvious which week you are answering and which are done. */}
          <div className="flex gap-3 overflow-x-auto border-b border-purple-100 pb-5">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((wk) => {
              const wkData = f.weeks[wk] || f.weeks[String(wk)] || {}
              const wkStarted = isWeekStarted(wkData)
              const wkLevel = wkData.level || ''
              const wkNoSession = noSessionWeek(wkData)
              const isCurrent = currentWeek === wk
              return (
                <button
                  key={wk}
                  type="button"
                  onClick={() => setCurrentWeek(wk)}
                  aria-current={isCurrent || undefined}
                  title={wkNoSession ? `Week ${wk} · no session` : wkLevel ? `Week ${wk} · ${wkLevel}` : `Week ${wk} · not started`}
                  className={`cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-bold transition-all whitespace-nowrap ${
                    isCurrent
                      ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                      : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-purple-700 hover:bg-purple-50 hover:border-purple-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${wkNoSession ? 'bg-slate-400' : wkStarted ? 'bg-emerald-400' : isCurrent ? 'bg-white/60' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    Week {wk}
                    {wkNoSession ? (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        NO SESSION
                      </span>
                    ) : wkLevel ? (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${isCurrent ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                        {wkLevel}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Week banner: everything below this band belongs to the active
              week — mirrors the WEEK band in the PDF preview. */}
          <div className={`rounded-2xl px-5 py-3.5 shadow-sm ${noSessionWeek(f.weeks[currentWeek] || f.weeks[String(currentWeek)]) ? 'bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500' : 'bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-black tracking-wide text-white">
                WEEK {currentWeek}
                {noSessionWeek(f.weeks[currentWeek] || f.weeks[String(currentWeek)]) ? ' · NO SESSION' : ''}
              </div>
              <div className="text-xs font-semibold text-purple-100">
                {noSessionWeek(f.weeks[currentWeek] || f.weeks[String(currentWeek)])
                  ? 'No session this week — only the reason below is needed'
                  : (f.weeks[currentWeek] || f.weeks[String(currentWeek)] || {})?.level
                    ? `Level: ${(f.weeks[currentWeek] || f.weeks[String(currentWeek)]).level} · all fields below belong to Week ${currentWeek}`
                    : `All fields below belong to Week ${currentWeek} — pick its support level to begin`}
              </div>
            </div>
          </div>

          <fieldset disabled={effectiveReadOnly}>
          <div className="mt-4 space-y-4">
            {/* No-session toggle: for weeks with no therapy session (holiday,
                absence). Skips the activity fields; the reason prints on the
                official PDF. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 transition-colors hover:border-purple-300">
              <input
                type="checkbox"
                checked={Boolean((f.weeks[currentWeek] || f.weeks[String(currentWeek)] || {}).noSession)}
                onChange={(e) => setWeekNoSession(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-purple-700"
              />
              <span>
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                  No session for Week {currentWeek}
                  <Tip text="Check this when no therapy session happened this week (holiday, learner absence). You only need to write the reason — the activity boxes are skipped and the PDF shows this week as NO SESSION." />
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Skips the activities below; only a reason is required.
                </span>
              </span>
            </label>
            {noSessionWeek(f.weeks[currentWeek] || f.weeks[String(currentWeek)]) ? (
              <div className="flex flex-col gap-2">
                <FieldCardLabel>Reason for no session<Tip text={IEP_FIELD_HINTS.noSessionReason} /></FieldCardLabel>
                <textarea
                  rows={3}
                  maxLength={NO_SESSION_REASON_LIMIT}
                  className={fieldTextareaStyle}
                  placeholder='e.g. "Holiday break — clinic closed", "Learner was sick"'
                  value={(f.weeks[currentWeek] || f.weeks[String(currentWeek)] || {}).noSessionReason || ''}
                  onChange={(e) => setWeekNoSessionReason(e.target.value)}
                />
                <div className="text-right text-[11px] text-slate-400">
                  {((f.weeks[currentWeek] || f.weeks[String(currentWeek)] || {}).noSessionReason || '').length}/{NO_SESSION_REASON_LIMIT}
                </div>
              </div>
            ) : null}
            {levelSuggestionLoading ? (
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3 text-xs text-slate-500">Loading FO-03 reference…</div>
            ) : levelSuggestion?.fo03 ? (
              <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="font-bold text-purple-800 dark:text-purple-200">FO-03 screening reference — not IEP completion.</span>
                {' '}Latest Caregiver Checklist (FO-03): {levelSuggestion.fo03.total}/{levelSuggestion.fo03.max} Yes ({levelSuggestion.fo03.pct}%) · {levelSuggestion.fo03.date}.
                {(() => {
                  const firstDate = levelSuggestion.firstFo03?.date
                  const multi = levelSuggestion.fo03.count != null
                    ? levelSuggestion.fo03.count > 1
                    : (firstDate && firstDate !== levelSuggestion.fo03.date)
                  if (multi && levelSuggestion.fo03.delta != null) {
                    const d = levelSuggestion.fo03.delta
                    return (
                      <> Change since the first FO-03{firstDate ? ` (${firstDate})` : ''}: {d >= 0 ? '+' : ''}{d} percentage points.</>
                    )
                  }
                  return (
                    <> Only one FO-03 on file — no earlier score to compare yet.</>
                  )
                })()}
                {' '}Monthly reports on file: {levelSuggestion.progressReports}.
                This % comes from the caregiver checklist only — set the Week support level from clinical judgment. Final leveling stays with the licensed psychologist.
              </div>
            ) : null}
            <div>
              <FieldCardLabel>
                Week {currentWeek} Support Needs Program Level
                <Tip text="Support level = how much help the learner needs this week. Pick the level that fits most of the week's sessions." />
              </FieldCardLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-2">
                {IEP_LEVELS.map(({ key: lvl, name, plain }) => {
                  const checked = (f.weeks[currentWeek] || f.weeks[String(currentWeek)] || {})?.level === lvl
                  return (
                    <Radio
                      key={lvl}
                      name={`support-level-wk-${currentWeek}`}
                      checked={checked}
                      onChange={() => setWeekLevel(lvl)}
                      colorClass="border-purple-600 bg-purple-50 shadow-sm ring-1 ring-purple-600"
                      unselectedClass="border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors"
                      className="p-4 rounded-xl transition-all hover:bg-purple-50/50"
                      label={
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-block rounded-md px-2 py-1 text-xs font-bold font-mono text-white shadow-sm ${
                                lvl === 'LSN' ? 'bg-emerald-600' : lvl === 'MSN' ? 'bg-amber-600' : 'bg-rose-600'
                              }`}
                            >
                              {lvl}
                            </span>
                            <span className={`text-sm font-semibold ${checked ? 'text-purple-900' : 'text-slate-700 dark:text-slate-200 transition-colors'}`}>
                              {name}
                            </span>
                          </div>
                          <span className="text-[11px] font-normal leading-relaxed text-slate-500 dark:text-slate-400">
                            {plain}
                          </span>
                        </div>
                      }
                    />
                  )
                })}
              </div>
            </div>

            {/* Targeted Domains List (replaces table to avoid horizontal scroll).
                Hidden for no-session weeks — the reason above is all the PDF prints. */}
            {noSessionWeek(f.weeks[currentWeek] || f.weeks[String(currentWeek)]) ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-5 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Week {currentWeek} is marked as no session. Activity boxes are skipped — write the reason above.
              </div>
            ) : (
            <div className="mt-6 space-y-6">
              {CORE_DOMAINS.map((d) => (
                <div key={d.key} className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors overflow-hidden shadow-sm">
                  <div className="bg-purple-800 px-5 py-3">
                    <h4 className="font-bold text-white tracking-wide text-sm">{d.name}</h4>
                    <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-purple-200">{d.plain}</p>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <FieldCardLabel>Name of Activity<Tip text={IEP_FIELD_HINTS.activity} /></FieldCardLabel>
                      <textarea
                        rows={3}
                        maxLength={TEXT_LIMIT}
                        className={fieldTextareaStyle}
                        value={f.weeks[currentWeek]?.[d.key]?.activity || ''}
                        onChange={(e) => setWeekField(d.key, 'activity', e.target.value.slice(0, TEXT_LIMIT))}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <FieldCardLabel>Objectives<Tip text={IEP_FIELD_HINTS.objectives} /></FieldCardLabel>
                      <textarea
                        rows={3}
                        maxLength={TEXT_LIMIT}
                        className={fieldTextareaStyle}
                        value={f.weeks[currentWeek]?.[d.key]?.objectives || ''}
                        onChange={(e) => setWeekField(d.key, 'objectives', e.target.value.slice(0, TEXT_LIMIT))}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <FieldCardLabel>Instructional Materials Needed<Tip text={IEP_FIELD_HINTS.materials} /></FieldCardLabel>
                      <textarea
                        rows={3}
                        maxLength={TEXT_LIMIT}
                        className={fieldTextareaStyle}
                        value={f.weeks[currentWeek]?.[d.key]?.materials || ''}
                        onChange={(e) => setWeekField(d.key, 'materials', e.target.value.slice(0, TEXT_LIMIT))}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <FieldCardLabel>Notes<Tip text={IEP_FIELD_HINTS.notes} /></FieldCardLabel>
                      <textarea
                        rows={3}
                        maxLength={TEXT_LIMIT}
                        className={fieldTextareaStyle}
                        value={f.weeks[currentWeek]?.[d.key]?.notes || ''}
                        onChange={(e) => setWeekField(d.key, 'notes', e.target.value.slice(0, TEXT_LIMIT))}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Bodily Kinesthetics - Fine Motor Skills */}
              <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors overflow-hidden shadow-sm">
                <div className="bg-purple-800 px-5 py-3">
                  <h4 className="font-bold text-white tracking-wide text-sm">Bodily Kinesthetics — Fine Motor Skills</h4>
                  <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-purple-200">{IEP_DOMAINS[3].plain}</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Name of Activity<Tip text={IEP_FIELD_HINTS.activity} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinFine?.activity || ''} onChange={(e) => setWeekField('kinFine', 'activity', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Objectives<Tip text={IEP_FIELD_HINTS.objectives} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinFine?.objectives || ''} onChange={(e) => setWeekField('kinFine', 'objectives', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Instructional Materials Needed<Tip text={IEP_FIELD_HINTS.materials} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinFine?.materials || ''} onChange={(e) => setWeekField('kinFine', 'materials', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Notes<Tip text={IEP_FIELD_HINTS.notes} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinFine?.notes || ''} onChange={(e) => setWeekField('kinFine', 'notes', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                </div>
              </div>

              {/* Bodily Kinesthetics - Gross Motor Skills */}
              <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors overflow-hidden shadow-sm">
                <div className="bg-purple-800 px-5 py-3">
                  <h4 className="font-bold text-white tracking-wide text-sm">Bodily Kinesthetics — Gross Motor Skills</h4>
                  <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-purple-200">{IEP_DOMAINS[4].plain}</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Name of Activity<Tip text={IEP_FIELD_HINTS.activity} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinGross?.activity || ''} onChange={(e) => setWeekField('kinGross', 'activity', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Objectives<Tip text={IEP_FIELD_HINTS.objectives} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinGross?.objectives || ''} onChange={(e) => setWeekField('kinGross', 'objectives', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Instructional Materials Needed<Tip text={IEP_FIELD_HINTS.materials} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinGross?.materials || ''} onChange={(e) => setWeekField('kinGross', 'materials', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <FieldCardLabel>Notes<Tip text={IEP_FIELD_HINTS.notes} /></FieldCardLabel>
                    <textarea rows={3} maxLength={TEXT_LIMIT} className={fieldTextareaStyle} value={f.weeks[currentWeek]?.kinGross?.notes || ''} onChange={(e) => setWeekField('kinGross', 'notes', e.target.value.slice(0, TEXT_LIMIT))} />
                  </div>
                </div>
              </div>
            </div>
            )}


          </div>
          </fieldset>
        </SectionCard>        <section className="space-y-4 pt-6">
          <FormHeading numeral="X">Signatories</FormHeading>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Prepared by</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                Psychometrician assigned to prepare and submit this IEP.
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
                  <SignaturePad label="" value={preparedSignature} onChange={(next) => { markDirty(); setPreparedSignature(next) }} />
                )}
              </div>
              <div className="mt-3">
                {!effectiveReadOnly ? (
                  <DatePicker
                    value={preparedDate}
                    onChange={(value) => { markDirty(); setPreparedDate(value) }}
                    ariaLabel="Psychometrician signature date"
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Psychologist review</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                The assigned psychologist reviews, signs, and either approves or returns this IEP.
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
                    maxLength={REVIEW_COMMENT_LIMIT}
                    data-reviewer-comment="true"
                    className={fieldTextareaStyle}
                    value={reviewerCommentProp}
                    onChange={(e) => onReviewerCommentChange?.(e.target.value.slice(0, REVIEW_COMMENT_LIMIT))}
                    placeholder="Write a revision note for the psychometrician..."
                  />
                  <div className="mt-1 text-right text-[11px] text-slate-400">
                    {reviewerCommentProp.length}/{REVIEW_COMMENT_LIMIT}
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
                  <SavedSignature image={reviewerSignature} alt="Psychologist signature" sealed signedAt={String(report?.finalized_at || report?.updated_at || report?.date || '').slice(0, 10)} />
                ) : (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                    <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No psychologist signature yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="pb-2 pt-1">
          
        </div>
        <ScrollTopButton />
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
    </FormShell>
  )
}

export default IepSpedForm
