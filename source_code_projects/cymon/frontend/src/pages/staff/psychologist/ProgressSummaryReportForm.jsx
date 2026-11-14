import { useEffect, useMemo, useRef, useState } from 'react'
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
const DIAGNOSIS_LIMIT = 100
const SHORT_LIMIT = 100
const COMMENT_LIMIT = 100
const todayIso = () => new Date().toISOString().slice(0, 10)

const DATA_DOMAINS = [
  'Conceptual Domain',
  'Social Domain',
  'Bodily Kinesthetics Domain',
  'Practical Domain',
]

const emptyRow = () => ({
  objective: '',
  activities: '',
  timeFrame: '',
  responsible: '',
  outcome: '',
})

const emptyForm = (period = '') => ({
  period,
  patientName: '',
  age: '',
  sex: '',
  diagnosis: '',
  selectedDomains: [...DATA_DOMAINS],
  dataNarrative: '',
  generalOverview: '',
  domainAssessments: Object.fromEntries(DATA_DOMAINS.map((domain) => [domain, ''])),
  planRows: [emptyRow()],
  preparedDate: todayIso(),
})

const parseContent = (content) => {
  if (!content) return null
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    return parsed?.form || parsed?.monthly || parsed
  } catch {
    return null
  }
}

const formFromDetail = (detail, initialPeriod = '') => {
  const saved = parseContent(detail?.content)
  const base = emptyForm(detail?.period || initialPeriod)
  if (!saved || typeof saved !== 'object') {
    return {
      ...base,
      patientName: detail?.name || detail?.patient_name || '',
    }
  }
  return {
    ...base,
    ...saved,
    diagnosis: String(saved.diagnosis ?? '').slice(0, DIAGNOSIS_LIMIT),
    selectedDomains:
      Array.isArray(saved.selectedDomains) && saved.selectedDomains.length
        ? saved.selectedDomains.filter((domain) => DATA_DOMAINS.includes(domain))
        : [...DATA_DOMAINS],
    domainAssessments: {
      ...base.domainAssessments,
      ...(saved.domainAssessments || {}),
    },
    planRows:
      Array.isArray(saved.planRows) && saved.planRows.length
        ? saved.planRows.map((row) => ({ ...emptyRow(), ...row }))
        : [emptyRow()],
    preparedDate: saved.preparedDate || todayIso(),
  }
}

const profileName = (profile) =>
  capitalizeName(profile?.display_name || profile?.name || profile?.full_name) || 'NA'
const profileProfession = (profile, fallback) =>
  profile?.title || profile?.profession || fallback
const profileLicense = (profile) =>
  profile?.license_no || profile?.prc_no || profile?.prc_number || 'NA'

const patientDiagnosis = (patient) => {
  const clinical = Array.isArray(patient?.clinical_profiles)
    ? patient.clinical_profiles[0]
    : patient?.clinical_profiles
  return clinical?.working_diagnosis || patient?.diagnosis || ''
}

function SectionCard({ numeral, title, subtitle, children, id, highlighted }) {
  return (
    <section
      id={id}
      className={`space-y-4 rounded-2xl border bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm scroll-mt-28 transition ${
        highlighted
          ? 'border-rose-400 ring-2 ring-rose-400 dark:ring-rose-500'
          : 'border-purple-100'
      }`}
    >
      <FormHeading numeral={numeral}>{title}</FormHeading>
      {subtitle ? <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">{subtitle}</p> : null}
      {children}
    </section>
  )
}

function Counter({ value, limit = TEXT_LIMIT }) {
  return (
    <span className="block text-right text-[11px] text-slate-400">
      {String(value || '').length}/{limit}
    </span>
  )
}

function ProgressSummaryReportForm({
  patient = null,
  patients = [],
  onSaved,
  onClose,
  detail = null,
  readOnly = false,
  initialPatientId = '',
  initialPeriod = '',
  inline = false,
  embedded = false,
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

  const [form, setForm] = useState(() => {
    const initial = formFromDetail(detail, initialPeriod)
    return {
      ...initial,
      patientName:
        initial.patientName || selectedPatient?.name || detail?.name || '',
    }
  })
  const [currentProfile, setCurrentProfile] = useState(null)
  const [patientDetails, setPatientDetails] = useState(selectedPatient)
  const [preparedSignature, setPreparedSignature] = useState(
    detail?.prepared_signature_image || null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [highlightedField, setHighlightedField] = useState(null)

  // Extra tone applied to the field (or section) missing a value on submit.
  const fieldTone = (id) =>
    highlightedField === id
      ? ' !border-rose-400 ring-2 ring-rose-400 dark:ring-rose-500 bg-rose-50/60 dark:bg-rose-900/20'
      : ''

  const focusField = (id) => {
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
      setTimeout(() => el.focus({ preventScroll: true }), 350)
    }
  }
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
    if (!patientId) return undefined
    let active = true
    api.psychometrician
      .patient(patientId)
      .then((data) => {
        if (!active) return
        const nextPatient = data.patient || null
        setPatientDetails(nextPatient)
        if (!nextPatient) return
        setForm((current) => ({
          ...current,
          patientName:
            current.patientName ||
            nextPatient.full_name ||
            selectedPatient?.name ||
            detail?.name ||
            '',
          age:
            String(current.age ?? '').trim() ||
            (nextPatient.age === null || nextPatient.age === undefined
              ? ''
              : String(nextPatient.age)),
          sex: current.sex || String(nextPatient.sex || '').toLowerCase(),
          diagnosis: String(current.diagnosis || patientDiagnosis(nextPatient)).slice(0, DIAGNOSIS_LIMIT),
        }))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [patientId, selectedPatient?.name, detail?.name])

  const editableStatuses = ['draft', 'in_progress', 'revise_requested']
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
    let reportIdToUse = draftId || detail?.id
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
      toast.error('Save the report first so the official PDF can load its database record.')
      return
    }

    setPdfPreview({
      title: `Monthly Assessment Report – ${patientDetails?.full_name || 'Student'}`,
      filename: `${patientDetails?.patient_id || detail?.patient_id || patientId}-CMPS-SE-FO-09.pdf`,
      loadPdf: () => api.psychometrician.monthlyProgressPdf(patientId),
    })
  }

  const selectedDomainSet = useMemo(
    () => new Set(form.selectedDomains || []),
    [form.selectedDomains],
  )

  const setValue = (key, value) => {
    const nextValue = key === 'diagnosis'
      ? String(value ?? '').slice(0, DIAGNOSIS_LIMIT)
      : value
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  const toggleDomain = (domain) => {
    setForm((current) => {
      const selected = current.selectedDomains || []
      return {
        ...current,
        selectedDomains: selected.includes(domain)
          ? selected.filter((value) => value !== domain)
          : [...selected, domain],
      }
    })
  }

  const setDomainAssessment = (domain, value) => {
    setForm((current) => ({
      ...current,
      domainAssessments: {
        ...current.domainAssessments,
        [domain]: value.slice(0, TEXT_LIMIT),
      },
    }))
  }

  const updatePlan = (index, key, value) => {
    setForm((current) => ({
      ...current,
      planRows: current.planRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value.slice(0, TEXT_LIMIT) } : row,
      ),
    }))
  }

  const addPlanRow = () => {
    setForm((current) => ({
      ...current,
      planRows: [...current.planRows, emptyRow()],
    }))
  }

  const removePlanRow = (index) => {
    setForm((current) => ({
      ...current,
      planRows:
        current.planRows.length > 1
          ? current.planRows.filter((_, rowIndex) => rowIndex !== index)
          : current.planRows,
    }))
  }

  // Collects every problem (not just the first) so the submit error can list
  // them all and jump straight to the first one, like AnswerAssessment does.
  const collectIssues = () => {
    const issues = []
    const required = [
      ['mrf-period', 'Reporting period', form.period, 'I'],
      ['mrf-age', 'Age', form.age, 'I'],
      ['mrf-sex', 'Sex', form.sex, 'I'],
      ['mrf-diagnosis', 'Diagnosis', form.diagnosis, 'I'],
      ['mrf-dataNarrative', 'Data narrative', form.dataNarrative, 'II'],
      ['mrf-generalOverview', 'General overview', form.generalOverview, 'III'],
      ['mrf-preparedDate', 'Psychometrician signature date', form.preparedDate, 'V'],
    ]
    if (!String(form.patientName ?? '').trim()) {
      issues.push({ id: 'mrf-section-1', label: 'Student name', section: 'I' })
    }
    for (const [id, label, value, section] of required) {
      if (!String(value ?? '').trim()) issues.push({ id, label, section })
    }

    const age = Number(form.age)
    if (String(form.age ?? '').trim() && (!Number.isInteger(age) || age < 0 || age > 150)) {
      issues.push({ id: 'mrf-age', label: 'Age must be a whole number from 0 to 150', section: 'I' })
    }
    if (String(form.sex ?? '').trim() && !['male', 'female'].includes(String(form.sex).toLowerCase())) {
      issues.push({ id: 'mrf-sex', label: 'Sex must be Male or Female', section: 'I' })
    }
    if (!form.selectedDomains.length) {
      issues.push({ id: 'mrf-domains', label: 'At least one assessment domain', section: 'II' })
    }
    form.selectedDomains.forEach((domain, domainIndex) => {
      if (!String(form.domainAssessments?.[domain] || '').trim()) {
        issues.push({ id: `mrf-domain-${domainIndex}`, label: `${domain} assessment`, section: 'III' })
      }
    })

    const planFields = ['objective', 'activities', 'timeFrame', 'responsible', 'outcome']
    const planLabels = { objective: 'Objective', activities: 'Activities', timeFrame: 'Time Frame', responsible: 'Responsible Person', outcome: 'Expected Outcome' }
    form.planRows.forEach((row, index) => {
      planFields.forEach((key) => {
        if (!String(row?.[key] || '').trim()) {
          issues.push({ id: `mrf-plan-${index}-${key}`, label: `Activity plan row ${index + 1} — ${planLabels[key]}`, section: 'IV' })
        }
      })
    })
    if (!preparedSignature) {
      issues.push({ id: 'mrf-signature', label: 'Psychometrician signature', section: 'V' })
    }
    if (String(form.preparedDate ?? '').trim() && form.preparedDate > todayIso()) {
      issues.push({ id: 'mrf-preparedDate', label: 'Signature date cannot be in the future', section: 'V' })
    }
    return issues
  }

  const describeIssues = (issues) => {
    const shown = issues.slice(0, 5).map((issue) => `${issue.label} (Sec. ${issue.section})`)
    const rest = issues.length > shown.length ? ` (+${issues.length - shown.length} more)` : ''
    return `Incomplete monthly report — ${issues.length} item${issues.length === 1 ? '' : 's'} need${issues.length === 1 ? 's' : ''} attention: ${shown.join('; ')}${rest}.`
  }

  const saveDraft = async (silent = false) => {
    if (reviewerMode || effectiveReadOnly) return null
    if (!patientId) return null

    if (!silent) setSavingDraft(true)
    try {
      const payloadForm = {
        ...form,
        diagnosis: String(form.diagnosis || '').slice(0, DIAGNOSIS_LIMIT),
      }
      const payload = {
        id: draftId || undefined,
        patient_id: patientId,
        title: 'Monthly Assessment Report',
        period: form.period,
        status: detail?.status === 'revise_requested' ? 'revise_requested' : 'draft',
        content: {
          schema_version: 1,
          form: payloadForm,
        },
        prepared_signature_image: preparedSignature || undefined,
      }
      const res = await api.psychologist.addProgressReport(payload)
      if (res?.report?.id) {
        setDraftId(res.report.id)
      }
      setLastSaved(new Date())
      if (!silent) await onSaved?.()
      if (!silent) toast.success('Draft saved successfully.')
      return res?.report || null
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
  }, [form, preparedSignature])

  const send = async () => {
    const issues = collectIssues()
    if (issues.length) {
      const validationError = describeIssues(issues)
      setError(validationError)
      toast.error(validationError)
      const first = issues[0]
      setHighlightedField(first.id)
      setTimeout(() => setHighlightedField((current) => (current === first.id ? null : current)), 3500)
      focusField(first.id)
      return
    }

    setSaving(true)
    setError('')
    setHighlightedField(null)
    try {
      const payloadForm = {
        ...form,
        diagnosis: String(form.diagnosis || '').slice(0, DIAGNOSIS_LIMIT),
      }
      await api.psychologist.addProgressReport({
        id: draftId || undefined,
        patient_id: patientId,
        title: 'Monthly Assessment Report',
        period: form.period,
        status: 'ready_for_review',
        content: {
          schema_version: 1,
          form: payloadForm,
        },
        prepared_signature_image: preparedSignature,
      })
      toast.success('Monthly Assessment Report sent to the psychologist.')
      await onSaved?.()
      onClose?.()
    } catch (requestError) {
      const message = requestError.message || 'Unable to send the monthly report.'
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
      title="Monthly Assessment Report"
      subtitle="Special Education Program"
      code="CMPS:SE-FO-09 rev.0 03172026"
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
          <h1 className="text-2xl font-black tracking-tight text-purple-900 uppercase">Monthly Assessment Report</h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-purple-600 uppercase">Special Education Program</p>
        </div>
        {!headerActionsTarget ? (
          <div className="no-print sticky top-0 z-30 -mx-3 mb-2 bg-[#efeaf7]/95 px-3 pb-1 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {footerActions}
          </div>
        ) : null}
        <fieldset disabled={effectiveReadOnly} className="space-y-6">
          <SectionCard
            id="mrf-section-1"
            numeral="I"
            title="Student and Reporting Information"
            subtitle="This monthly report belongs only to the selected student."
            highlighted={['mrf-section-1', 'mrf-period', 'mrf-age', 'mrf-sex', 'mrf-diagnosis'].includes(highlightedField)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                  Name of Student
                </span>
                <input className={inputClass} value={form.patientName} disabled readOnly />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                  Reporting Period
                </span>
                <input
                  id="mrf-period"
                  className={`${inputClass}${fieldTone('mrf-period')} scroll-mt-28`}
                  maxLength={SHORT_LIMIT}
                  value={form.period}
                  onChange={(event) => setValue('period', event.target.value.slice(0, SHORT_LIMIT))}
                  placeholder="e.g. July 2026"
                />
                <Counter value={form.period} limit={SHORT_LIMIT} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Age</span>
                <input
                  id="mrf-age"
                  type="number"
                  min="0"
                  max="150"
                  step="1"
                  className={`${inputClass}${fieldTone('mrf-age')} scroll-mt-28`}
                  value={form.age}
                  onChange={(event) =>
                    setValue('age', event.target.value.replace(/\D/g, '').slice(0, 3))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">Sex</span>
                <select
                  id="mrf-sex"
                  className={`${inputClass}${fieldTone('mrf-sex')} scroll-mt-28`}
                  value={form.sex}
                  onChange={(event) => setValue('sex', event.target.value)}
                >
                  <option value="">Select sex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                  Diagnosis
                </span>
                <input
                  id="mrf-diagnosis"
                  className={`${inputClass}${fieldTone('mrf-diagnosis')} scroll-mt-28`}
                  maxLength={DIAGNOSIS_LIMIT}
                  value={form.diagnosis}
                  onChange={(event) => setValue('diagnosis', event.target.value)}
                />
                <Counter value={form.diagnosis} limit={DIAGNOSIS_LIMIT} />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            id="mrf-section-2"
            numeral="II"
            title="Data"
            subtitle="Select the domains covered during this reporting period."
            highlighted={['mrf-domains', 'mrf-dataNarrative'].includes(highlightedField)}
          >
            <div
              id="mrf-domains"
              className={`flex flex-wrap gap-2 scroll-mt-28 rounded-xl transition ${highlightedField === 'mrf-domains' ? 'ring-2 ring-rose-400 dark:ring-rose-500 bg-rose-50/60 dark:bg-rose-900/20 p-2 -m-1' : ''}`}
            >
              {DATA_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedDomainSet.has(domain)
                      ? 'border-purple-600 bg-purple-700 text-white'
                      : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-50'
                  }`}
                >
                  {domain}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                Activities and Data Narrative
              </span>
              <textarea
                id="mrf-dataNarrative"
                rows={5}
                maxLength={TEXT_LIMIT}
                className={`${textareaClass}${fieldTone('mrf-dataNarrative')} scroll-mt-28`}
                value={form.dataNarrative}
                onChange={(event) =>
                  setValue('dataNarrative', event.target.value.slice(0, TEXT_LIMIT))
                }
                placeholder="Describe the activities conducted and the data gathered."
              />
              <Counter value={form.dataNarrative} />
            </label>
          </SectionCard>

          <SectionCard
            id="mrf-section-3"
            numeral="III"
            title="Assessment"
            highlighted={Boolean(highlightedField) && (highlightedField === 'mrf-generalOverview' || highlightedField.startsWith('mrf-domain-'))}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                General Overview
              </span>
              <textarea
                id="mrf-generalOverview"
                rows={5}
                maxLength={TEXT_LIMIT}
                className={`${textareaClass}${fieldTone('mrf-generalOverview')} scroll-mt-28`}
                value={form.generalOverview}
                onChange={(event) =>
                  setValue('generalOverview', event.target.value.slice(0, TEXT_LIMIT))
                }
                placeholder="Summarize engagement, functioning, and progress during the reporting period."
              />
              <Counter value={form.generalOverview} />
            </label>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {form.selectedDomains.map((domain, domainIndex) => (
                <label key={domain} className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                    {domain}
                  </span>
                  <textarea
                    id={`mrf-domain-${domainIndex}`}
                    rows={5}
                    maxLength={TEXT_LIMIT}
                    className={`${textareaClass}${fieldTone(`mrf-domain-${domainIndex}`)} scroll-mt-28`}
                    value={form.domainAssessments?.[domain] || ''}
                    onChange={(event) => setDomainAssessment(domain, event.target.value)}
                    placeholder={`Record observations for ${domain}.`}
                  />
                  <Counter value={form.domainAssessments?.[domain]} />
                </label>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            id="mrf-section-4"
            numeral="IV"
            title="Activity Plan"
            subtitle="Add the activities to be implemented during the next reporting period."
            highlighted={Boolean(highlightedField) && highlightedField.startsWith('mrf-plan-')}
          >
            <div className="space-y-4">
              {form.planRows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-purple-100 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800/40 transition-colors p-4"
                  >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">
                      Plan {index + 1}
                    </h3>
                    {!effectiveReadOnly && form.planRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removePlanRow(index)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {[
                      ['objective', 'Objective'],
                      ['activities', 'Activities'],
                      ['timeFrame', 'Time Frame'],
                      ['responsible', 'Responsible Person'],
                      ['outcome', 'Expected Outcome'],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className={`block space-y-1.5 ${key === 'outcome' ? 'lg:col-span-2' : ''}`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 transition-colors">
                          {label}
                        </span>
                        <textarea
                          id={`mrf-plan-${index}-${key}`}
                          rows={3}
                          maxLength={TEXT_LIMIT}
                          className={`${textareaClass}${fieldTone(`mrf-plan-${index}-${key}`)} scroll-mt-28`}
                          value={row[key]}
                          onChange={(event) => updatePlan(index, key, event.target.value)}
                        />
                        <Counter value={row[key]} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!effectiveReadOnly && (
              <button
                type="button"
                onClick={addPlanRow}
                className="rounded-xl border border-dashed border-purple-300 bg-white dark:bg-slate-900 transition-colors px-4 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50"
              >
                Add activity plan
              </button>
            )}
          </SectionCard>
        </fieldset>

        <SectionCard
            id="mrf-section-5"
            numeral="V"
            title="Signatories"
            highlighted={['mrf-signature', 'mrf-preparedDate'].includes(highlightedField)}
          >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Prepared by</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                Assigned psychometrician who prepared and submitted this report.
              </p>
              <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 transition-colors">
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Name:</span> {profileName(preparedProfile)}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Profession:</span> {profileProfession(preparedProfile, 'Psychometrician')}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">PRC No.:</span> {profileLicense(preparedProfile)}</div>
              </div>
              <div className="mt-4">
                {effectiveReadOnly ? (
                  preparedSignature ? (
                    <SavedSignature image={preparedSignature} alt="Psychometrician signature" sealed signedAt={form.preparedDate} />
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                      <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
                        No psychometrician signature recorded.
                      </span>
                    </div>
                  )
                ) : (
                  <div
                    id="mrf-signature"
                    className={`scroll-mt-28 rounded-2xl transition ${highlightedField === 'mrf-signature' ? 'ring-2 ring-rose-400 dark:ring-rose-500 bg-rose-50/60 dark:bg-rose-900/20 p-1 -m-1' : ''}`}
                  >
                    <SignaturePad
                      label=""
                      value={preparedSignature}
                      onChange={setPreparedSignature}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3">
                {!effectiveReadOnly ? (
                  <div id="mrf-preparedDate" className="scroll-mt-28">
                    <DatePicker
                      value={form.preparedDate}
                      onChange={(value) => setValue('preparedDate', value)}
                      max={todayIso()}
                      ariaLabel="Psychometrician signature date"
                      className={fieldTone('mrf-preparedDate')}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Psychologist review</div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                The assigned psychologist reviews, signs, and either approves or returns this report.
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
                    onChange={(event) =>
                      onReviewerCommentChange?.(event.target.value.slice(0, COMMENT_LIMIT))
                    }
                    placeholder="Write a revision note for the psychometrician..."
                  />
                  <Counter value={reviewerCommentProp} limit={COMMENT_LIMIT} />
                </div>
              ) : reviewerComment ? (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                  <span className="font-semibold">Comment:</span> {reviewerComment}
                </div>
              ) : null}

              <div className="mt-4">
                {reviewerMode ? (
                  <SignaturePad
                    label="Psychologist Signature"
                    value={reviewerSignatureProp}
                    onChange={onReviewerSignatureChange}
                  />
                ) : reviewerSignature ? (
                  <SavedSignature image={reviewerSignature} alt="Psychologist signature" sealed signedAt={String(detail?.finalized_at || detail?.updated_at || detail?.date || '').slice(0, 10)} />
                ) : (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                    <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
                      No psychologist signature yet.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="pb-2 pt-1 print:hidden"></div>
        <ScrollTopButton />
      </div>
      {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
    </FormShell>
  )
}

export default ProgressSummaryReportForm
