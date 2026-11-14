import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FormShell from '../../../components/ui/FormShell'
import FormHeading from '../../../components/ui/FormHeading'
import BlankField from '../../../components/ui/BlankField'
import SignaturePad, { SavedSignature } from '../../../components/ui/SignaturePad'
import Checkbox from '../../../components/ui/Checkbox'
import DatePicker from '../../../components/ui/DatePicker'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import FormActionButtons from '../../../components/ui/FormActionButtons'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import FormSectionNav from '../../../components/ui/FormSectionNav'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import ReviewSessionNotice from '../../../components/ui/ReviewSessionNotice'
import ScrollTopButton from '../../../components/ui/ScrollTopButton'
import { scoreCaregiverGuide } from '../../../lib/caregiverGuide'
import { api } from '../../../lib/api'
import { capitalizeName } from '../../../lib/format'
import { toast } from 'react-hot-toast'

const TABLE_CELL_LIMIT = 40
const REVIEW_COMMENT_LIMIT = 100
const VERBAL_INTERPRETATIONS = [
  'Significantly Below Average',
  'Below Average',
  'Low Average',
  'Average',
  'High Average',
  'Above Average',
]
const REPORT_SCHEMA_VERSION = 3
// Suggested verbal interpretations derived from the FO-03 scoring guide.
// The dropdown options in Section IV accept exactly these strings, so an
// approved suggestion auto-matches without any manual retyping.
const CORE_SUGGEST_LABEL = {
  severe: 'Significant Difficulty',
  moderate: 'Moderate Difficulty',
  mild: 'Mild Difficulty',
  good: 'Age-appropriate Skills',
}
const MOTOR_SUGGEST_LABEL = {
  severe: 'Severe Motor Impairment',
  moderate: 'Moderate Coordination Difficulty',
  mild: 'Mild Motor Difficulty',
  good: 'Age-appropriate Motor Skills',
}
const BAND_RANK = { good: 0, mild: 1, moderate: 2, severe: 3 }

// Maps a scored FO-03 guide onto the five Section IV caregiver rows.
// Motor Skills uses the worse of gross/fine motor; Total uses the global band.
function caregiverRowsFromGuide(guide) {
  const byKey = Object.fromEntries((guide.domains || []).map((d) => [d.key, d]))
  const gross = byKey.gross_motor
  const fine = byKey.fine_motor
  const motorBand =
    gross && fine
      ? (BAND_RANK[gross.band] >= BAND_RANK[fine.band] ? gross.band : fine.band)
      : (gross || fine)?.band || null
  const rows = [
    { row: 'Practical Domain', band: byKey.practical?.band || null, motor: false },
    { row: 'Social Domain', band: byKey.social?.band || null, motor: false },
    { row: 'Conceptual Domain', band: byKey.conceptual?.band || null, motor: false },
    { row: 'Motor Skills', band: motorBand, motor: true },
    { row: 'Total', band: guide.global?.band || null, motor: false },
  ]
  return rows.map(({ row, band, motor }, i) => ({
    row,
    band,
    value: band ? (motor ? MOTOR_SUGGEST_LABEL[band] : CORE_SUGGEST_LABEL[band]) : '',
    cellKey: `${i}:0`,
  }))
}
const ADMINISTERED_TESTS = [
  { id: 'caregiver_observation', label: 'Caregiver Behavioral Observation Checklist' },
  { id: 'mmse', label: 'Mini-Mental Status Examination (MMSE)' },
  { id: 'adaptive_functioning', label: 'Child Adaptive Functioning Assessment Tool' },
  { id: 'ctoni_2', label: 'Comprehensive Test of Nonverbal Intelligence-2 (CTONI-2)' },
  { id: 'gars_3', label: "Gilliam's Autism Rating Scale-3 (GARS-3)" },
]
const ADMINISTERED_TEST_IDS = new Set(ADMINISTERED_TESTS.map((test) => test.id))
const ADMINISTERED_TEST_LABELS = new Map(ADMINISTERED_TESTS.map((test) => [test.label, test.id]))

function ScoreTable({ tableKey, headers, rows, values = {}, onChange, readOnly = false, cellMaxLength = TABLE_CELL_LIMIT, getDropdownOptions }) {
  const dataCols = headers.length - 1

  return (
    <div className="overflow-x-auto rounded-2xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-purple-100/70 dark:bg-slate-800">
            {headers.map((header, headerIndex) => (
              <th
                key={header}
                className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200 ${headerIndex === 0 ? 'w-[34%]' : ''}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-50 dark:divide-slate-800">
          {rows.map((label, rowIndex) => (
            <tr key={label} className={rowIndex % 2 === 1 ? 'bg-purple-50/40 dark:bg-slate-800/40' : ''}>
              <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</td>
              {Array.from({ length: dataCols }).map((_, columnIndex) => {
                const cellKey = `${rowIndex}:${columnIndex}`
                const value = values?.[cellKey] || ''
                const maxLength = Array.isArray(cellMaxLength)
                  ? cellMaxLength[columnIndex] || TABLE_CELL_LIMIT
                  : cellMaxLength
                const isVerbalInterpretation =
                  headers[columnIndex + 1] === 'Verbal Interpretation'
                const options = getDropdownOptions ? getDropdownOptions(label, headers[columnIndex + 1]) : VERBAL_INTERPRETATIONS
                return (
                  <td key={cellKey} className="px-3 py-2 align-middle">
                    {isVerbalInterpretation && readOnly ? (
                      <span className="block px-1 py-1.5 text-[13px] text-slate-700 dark:text-slate-200">{value || '—'}</span>
                    ) : isVerbalInterpretation ? (
                      <select
                        className="w-full cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] text-slate-900 dark:text-slate-100 transition-colors hover:border-purple-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-500/20"
                        value={value}
                        disabled={readOnly}
                        onChange={(event) =>
                          onChange?.(tableKey, cellKey, event.target.value)
                        }
                      >
                        <option value="" className="bg-white text-slate-500">Select interpretation</option>
                        {value && !options.includes(value) ? (
                          <option value={value} className="bg-white text-slate-800">{value}</option>
                        ) : null}
                        {options.map((interpretation) => (
                          <option key={interpretation} value={interpretation} className="bg-white text-slate-800">
                            {interpretation}
                          </option>
                        ))}
                      </select>
                    ) : readOnly ? (
                      <span className="block px-1 py-1.5 text-[13px] tabular-nums text-slate-700 dark:text-slate-200">{value || '—'}</span>
                    ) : (
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[13px] tabular-nums text-slate-900 dark:text-slate-100 transition-colors hover:border-purple-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-500/20"
                        value={value}
                        maxLength={maxLength}
                        disabled={readOnly}
                        onChange={(event) =>
                          onChange?.(tableKey, cellKey, event.target.value.slice(0, maxLength))
                        }
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const blankReportDraft = {
  background: '',
  observationsA: '',
  observationsB: '',
  observationsC: '',
  ctoniSubtests: '',
  ctoniComposite: '',
  garsSubscales: '',
  garsComposites: '',
  diagnosis: '',
  recommendations: '',
  administeredTests: [],
  tableValues: {},
}

const createBlankReportDraft = () => ({
  ...blankReportDraft,
  tableValues: {},
})

const normalizeTableValues = (value, schemaVersion = 1) => {
  const source = value && typeof value === 'object' ? value : {}
  const normalized = { ...source }
  const version = Number(schemaVersion) || 1

  // The official FO-06 layout uses Practical/Social/Conceptual/Motor Skills
  // for MMSE as well. Old drafts used a different set of row labels, so do not
  // silently display those values beside the wrong labels.
  if (version < REPORT_SCHEMA_VERSION) normalized.mmse = {}

  if (version < REPORT_SCHEMA_VERSION && source.garsComposite && typeof source.garsComposite === 'object') {
    normalized.garsComposite = {}
    for (const rowIndex of [0, 1]) {
      const severity = source.garsComposite?.[`${rowIndex}:1`] || source.garsComposite?.[`${rowIndex}:0`] || ''
      if (severity) normalized.garsComposite[`${rowIndex}:0`] = severity
    }
  }

  if (version < REPORT_SCHEMA_VERSION && source.ctoniComposite && typeof source.ctoniComposite === 'object') {
    normalized.ctoniComposite = {
      '0:0': source.ctoniComposite['0:0'] || '',
      '0:1': source.ctoniComposite['0:1'] || '',
      '1:0': source.ctoniComposite['1:0'] || '',
      '1:1': source.ctoniComposite['1:1'] || '',
    }
  }

  return normalized
}

const normalizeAdministeredTests = (value, schemaVersion = 1) => {
  const source = Array.isArray(value) ? value : []
  const normalized = [...new Set(source
    .map((item) => ADMINISTERED_TEST_LABELS.get(String(item)) || String(item))
    .filter((item) => ADMINISTERED_TEST_IDS.has(item)))]
  return Number(schemaVersion) < REPORT_SCHEMA_VERSION && normalized.length === 0
    ? ADMINISTERED_TESTS.map((test) => test.id)
    : normalized
}

const normalizeReportDraft = (value, schemaVersion = 1) => {
  const draft = value && typeof value === 'object' ? value : {}
  const cleanDraft = { ...draft }
  delete cleanDraft.reason
  delete cleanDraft.summary
  delete cleanDraft.concerns
  delete cleanDraft.tables
  return {
    ...createBlankReportDraft(),
    ...cleanDraft,
    administeredTests: normalizeAdministeredTests(draft.administeredTests, schemaVersion),
    tableValues:
      draft.tableValues && typeof draft.tableValues === 'object'
        ? normalizeTableValues(draft.tableValues, schemaVersion)
        : draft.tables && typeof draft.tables === 'object'
          ? normalizeTableValues(draft.tables, schemaVersion)
          : {},
  }
}

const normalizePatient = (patient, report, fallback = {}) => {
  const first = patient?.first_name || patient?.firstName || fallback.first_name || ''
  const middle = patient?.middle_name || patient?.middleName || fallback.middle_name || ''
  const last = patient?.last_name || patient?.lastName || fallback.last_name || ''
  const middleInitial = middle ? `${middle.charAt(0).toUpperCase()}.` : ''
  const firstMiddle = [first, middleInitial].filter(Boolean).join(' ')
  
  let formattedName = ''
  if (last && firstMiddle) {
    formattedName = `${last}, ${firstMiddle}`
  } else if (last || firstMiddle) {
    formattedName = last || firstMiddle
  }

  const displayName =
    formattedName ||
    patient?.full_name ||
    patient?.name ||
    report?.name ||
    fallback.name ||
    'NA'

  const dob = patient?.date_of_birth || patient?.dob || fallback.date_of_birth || ''
  const rawSex = patient?.sex || fallback.sex || ''
  const sex = rawSex ? rawSex.charAt(0).toUpperCase() + rawSex.slice(1).toLowerCase() : ''
  const age = patient?.age ?? fallback.age ?? ''

  return {
    ...patient,
    full_name: displayName,
    date_of_birth: dob,
    sex,
    age,
  }
}

function BehavioralAssessmentForm({
  onClose,
  onSaved,
  patient = null,
  report = null,
  detail = null,
  readOnly = false,
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
  splitLayout = false,
}) {
  const activeReport = report || detail || null
  const effectiveReadOnly =
    readOnly ||
    (activeReport?.status
      ? !['draft', 'in_progress', 'revalidation', 'revise_requested'].includes(activeReport.status)
      : false)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [patientDetails, setPatientDetails] = useState(null)
  const [infoPhotoViewer, setInfoPhotoViewer] = useState(null)
  const [birthdate, setBirthdate] = useState('')
  const [evalDate, setEvalDate] = useState('')
  const [ageValue, setAgeValue] = useState('')
  const [sex, setSex] = useState('')
  const [reportDraft, setReportDraft] = useState(createBlankReportDraft)
  const [preparedById, setPreparedById] = useState('')
  const [preparedSig, setPreparedSig] = useState(null)
  const [preparedDate, setPreparedDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [error, setError] = useState(null)
  const [draftId, setDraftId] = useState(activeReport?.id || null)

  useEffect(() => {
    if (activeReport?.id) setDraftId(activeReport.id)
  }, [activeReport?.id])

  useEffect(() => {
    api.me()
      .then((d) => setCurrentProfile(d.profile || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const targetId = patient?.id || patient?.patient_id || activeReport?.patient_id || activeReport?.patient?.id
    if (!targetId) return
    const fallbackPatient = normalizePatient(patient, activeReport, {
      full_name: activeReport?.patient_name || activeReport?.name,
      date_of_birth: activeReport?.date_of_birth,
      sex: activeReport?.sex,
      age: activeReport?.age,
    })
    setPatientDetails(fallbackPatient)
    setBirthdate(fallbackPatient.date_of_birth || '')
    setSex(fallbackPatient.sex || '')
    setEvalDate(todayIso())
    setAgeValue(fallbackPatient.age != null && fallbackPatient.age !== '' ? String(fallbackPatient.age) : '')
    setReportDraft(createBlankReportDraft())
    api.psychometrician
      .patient(targetId)
      .then((d) => {
        const resolved = normalizePatient(d.patient || null, activeReport, fallbackPatient)
        setPatientDetails(resolved)
        setBirthdate(resolved?.date_of_birth || '')
        setSex(resolved?.sex || '')
        setAgeValue(resolved?.age != null && resolved.age !== '' ? String(resolved.age) : '')
      })
      .catch(() => {})
  }, [patient?.id, patient?.patient_id, activeReport?.patient_id, activeReport?.patient?.id])

  useEffect(() => {
    const raw = activeReport?.content
    if (!raw) return
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const nextDraft = parsed?.report_draft || parsed?.draft || parsed?.form || parsed || {}
      setReportDraft(normalizeReportDraft(nextDraft, parsed?.schema_version))
      if (parsed?.patient_name) {
        setPatientDetails((prev) => ({
          ...(prev || {}),
          full_name: parsed.patient_name,
        }))
      }
      if (parsed?.birthdate) setBirthdate(parsed.birthdate)
      if (parsed?.sex) setSex(parsed.sex)
      if (parsed?.evalDate) setEvalDate(parsed.evalDate)
      if (parsed?.age !== undefined && parsed?.age !== null) setAgeValue(String(parsed.age))
      if (parsed?.preparedById) setPreparedById(String(parsed.preparedById))
      if (parsed?.preparedDate) setPreparedDate(parsed.preparedDate)
    } catch (err) {
      console.error('Failed to parse behavioral report content:', err)
    }
  }, [activeReport])

  useEffect(() => {
    setPreparedSig(activeReport?.prepared_signature_image || null)
  }, [activeReport?.id, activeReport?.prepared_signature_image])

  useEffect(() => {
    if (preparedById || !currentProfile?.id) return
    const isPsychometrician =
      currentProfile?.role === 'psychometrician' ||
      (currentProfile?.title || '').toLowerCase().includes('psychometrician')
    if (isPsychometrician) {
      setPreparedById(String(currentProfile.id))
    }
  }, [currentProfile, preparedById])

  const submittedPreparedProfile =
    activeReport?.prepared_profile ||
    activeReport?.prepared_by ||
    null
  const preparedProfile =
    effectiveReadOnly
      ? submittedPreparedProfile
      : currentProfile?.id
      ? {
          id: currentProfile.id,
          display_name: currentProfile.display_name || currentProfile.name || currentProfile.full_name || 'NA',
          title: currentProfile.title || 'Psychometrician',
          license_no: currentProfile.license_no || currentProfile.prc_no || 'NA',
        }
      : null
  const resolvedReviewerProfile =
    reviewerProfileProp ||
    activeReport?.reviewer_profile ||
    activeReport?.noted_by ||
    patientDetails?.treating_psychologist ||
    null
  const resolvedReviewerSignature =
    reviewerSignatureProp ||
    activeReport?.reviewer_signature_image ||
    activeReport?.reviewed_signature_image ||
    activeReport?.noted_signature_image ||
    null
  const resolvedReviewerComment =
    reviewerCommentProp ||
    activeReport?.reviewer_comment ||
    activeReport?.comment ||
    ''
  const [pdfPreview, setPdfPreview] = useState(null)
  const previewOfficialPdf = () => {
    const reportIdToUse = draftId || activeReport?.id
    if (!reportIdToUse) {
      toast.error('Save the report first so the official PDF can load its database record.')
      return
    }
    setPdfPreview({
      title: `Behavioral Assessment Report · ${patientDetails?.full_name || 'Student'}`,
      filename: `${patientDetails?.patient_id || activeReport?.patient_id || patient?.patient_id}-CMPS-SE-FO-06.pdf`,
      loadPdf: () => api.psychometrician.downloadDocumentPdf('assessment_reports', reportIdToUse),
    })
  }
  const patientName = patientDetails?.full_name || patient?.name || activeReport?.name || ''
  const selectedAdministeredTests = new Set(reportDraft.administeredTests || [])
  const isTestSelected = (testId) => selectedAdministeredTests.has(testId)
  const hasSelectedObservationTests = ['caregiver_observation', 'mmse', 'adaptive_functioning']
    .some((testId) => isTestSelected(testId))
  const handleSummaryChange = (key, value) => {
    setReportDraft((s) => ({ ...s, [key]: value }));
  }
  const updateTableCell = (tableKey, cellKey, value) => {
    setReportDraft((current) => ({
      ...current,
      tableValues: {
        ...(current.tableValues || {}),
        [tableKey]: {
          ...(current.tableValues?.[tableKey] || {}),
          [cellKey]: value,
        },
      },
    }))
  }

  // Suggest-only auto-scoring for the Section IV caregiver table. Pulls the
  // student's latest FO-03 submission, scores it with the shared guide, and
  // shows a preview — nothing is written until the user presses Apply, and
  // every applied cell stays manually editable afterwards.
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState(null)
  const [suggestPreview, setSuggestPreview] = useState(null)

  const openCaregiverSuggest = async () => {
    const targetPatientId = patient?.id || activeReport?.patient_id
    if (!targetPatientId) {
      toast.error('Select a student first.')
      return
    }
    setSuggestError(null)
    setSuggestLoading(true)
    try {
      const dir = await api.psychometrician.assessments()
      const tests = dir.tests || []
      // Match the FO-03 template tolerantly: live databases may carry a
      // different code format than seeds, so fall back to title keywords.
      const isFo03 = (t) =>
        /FO-?0?3\b/.test(String(t.document_type_code || '')) ||
        /caregiver/i.test(String(t.title || '')) && /observ|checklist/i.test(String(t.title || ''))
      const fo03 = tests.find((t) => isFo03(t) && t.is_active !== false)
        || tests.find((t) => isFo03(t))
      if (!fo03) {
        const seen = tests.map((t) => t.document_type_code || t.title).filter(Boolean).slice(0, 6)
        throw new Error(
          seen.length > 0
            ? `No FO-03 template found (available: ${seen.join(', ')}). Ask the admin to register the Caregiver Checklist template.`
            : 'No assessment templates found. Ask the admin to register the Caregiver Checklist (FO-03) template.',
        )
      }
      const candidates = (dir.submissions || [])
        .filter((s) => String(s.patient_id) === String(targetPatientId) && String(s.template_id) === String(fo03.id) && s.answers && Object.keys(s.answers).length > 0)
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      const latest = candidates[0]
      if (!latest) throw new Error('This student has no answered FO-03 submission yet.')
      const tpl = await api.psychometrician.assessmentTemplate(fo03.id)
      const structure = Array.isArray(tpl?.template?.structure) ? tpl.template.structure : []
      if (structure.length === 0) throw new Error('The FO-03 template has no question structure.')
      const flat = {}
      for (const [key, ans] of Object.entries(latest.answers || {})) {
        flat[key] = typeof ans === 'string' ? ans : ans?.response || ''
      }
      const guide = scoreCaregiverGuide(structure, flat)
      setSuggestPreview({
        rows: caregiverRowsFromGuide(guide),
        sourceStatus: latest.status || '—',
        sourceDate: String(latest.updated_at || latest.created_at || '').slice(0, 10) || '—',
        coverage: `${guide.answeredCount}/${guide.itemCount} items answered`,
        partial: guide.answeredCount < guide.itemCount,
        total: `${guide.global.total}/${guide.global.max} (${guide.global.pct}%)`,
      })
      setSuggestOpen(true)
    } catch (e) {
      setSuggestError(e.message || 'Could not load the FO-03 suggestion.')
    } finally {
      setSuggestLoading(false)
    }
  }

  const applyCaregiverSuggest = () => {
    if (!suggestPreview) return
    for (const r of suggestPreview.rows) {
      if (r.value) updateTableCell('caregiver', r.cellKey, r.value)
    }
    setSuggestOpen(false)
    setSuggestPreview(null)
    toast.success('Suggestion applied — each dropdown is still editable.')
  }

  const toggleAdministeredTest = (testId) => {
    setReportDraft((current) => {
      const selected = new Set(current.administeredTests || [])
      if (selected.has(testId)) selected.delete(testId)
      else selected.add(testId)
      return { ...current, administeredTests: [...selected] }
    })
  }

  const calcAge = () => {
    if (!birthdate || !evalDate) return ''
    const bd = new Date(birthdate)
    const ed = new Date(evalDate)
    let age = ed.getFullYear() - bd.getFullYear()
    const monthDiff = ed.getMonth() - bd.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && ed.getDate() < bd.getDate())) age--
    return age >= 0 ? String(age) : ''
  }

  const saveDraft = async (silent = false) => {
    if (reviewerMode || effectiveReadOnly) return
    const targetPatientId = patient?.id || activeReport?.patient_id
    if (!targetPatientId) return
    
    if (!silent) setSavingDraft(true)
    try {
      const res = await api.psychometrician.addBehavioralReport({
        id: draftId || undefined,
        patient_id: targetPatientId,
        title: activeReport?.title || 'Behavioral Assessment Report',
        status: activeReport?.status === 'revise_requested' ? 'revise_requested' : 'draft',
        content: {
          schema_version: REPORT_SCHEMA_VERSION,
          patient_id: targetPatientId,
          patient_name: patientDetails?.full_name || patient?.name || activeReport?.name || '',
          birthdate,
          evalDate,
          age: ageValue !== '' ? ageValue : calcAge(),
          sex,
          preparedById,
          preparedDate,
          report_draft: reportDraft,
        },
        prepared_by_id: preparedById || undefined,
        prepared_signature_image: preparedSig || undefined,
      })
      if (res?.report?.id) {
        setDraftId(res.report.id)
      }
      setLastSaved(new Date())
      if (!silent) await onSaved?.()
      if (!silent) toast.success('Draft saved successfully.')
    } catch (err) {
      if (!silent) toast.error(err.message || 'Failed to save draft.')
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
    const targetPatientId = patient?.id || activeReport?.patient_id
    if (!targetPatientId) return
    
    const timer = setTimeout(() => {
      saveDraft(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [reportDraft, evalDate, birthdate, sex, ageValue, preparedSig, preparedById, patientDetails?.full_name])

  const sendReport = async () => {
    setError(null)
    const targetPatientId = patient?.id || activeReport?.patient_id
    if (!targetPatientId) {
      const message = 'Please select a student before sending this report.'
      setError(message)
      toast.error(message)
      return
    }
    if (!preparedById) {
      const message = 'Please assign the psychometrician before sending.'
      setError(message)
      toast.error(message)
      return
    }
    if (!preparedSig) {
      const message = 'Please add the psychometrician signature before sending.'
      setError(message)
      toast.error(message)
      return
    }

    setSaving(true)
    try {
      await api.psychometrician.addBehavioralReport({
        id: draftId || undefined,
        patient_id: targetPatientId,
        title: activeReport?.title || 'Behavioral Assessment Report',
        status: 'ready_for_review',
          content: {
            schema_version: REPORT_SCHEMA_VERSION,
            patient_id: targetPatientId,
            patient_name: patientDetails?.full_name || patient?.name || activeReport?.name || '',
            birthdate,
            evalDate,
            age: ageValue !== '' ? ageValue : calcAge(),
            sex,
            preparedById,
            preparedDate,
            report_draft: reportDraft,
          },
          prepared_by_id: preparedById,
          prepared_signature_image: preparedSig,
        })
      toast.success('Behavioral report sent to the psychologist.')
      onClose?.()
    } catch (err) {
      const message = err.message || 'Failed to send behavioral report.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const footerActions = (
    <div className="flex w-full flex-col gap-3 border-t border-purple-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-4 text-xs text-rose-600">{error || ''}</div>
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
              onClick={sendReport}
              disabled={saving || savingDraft}
              className="inline-flex min-w-48 items-center justify-center rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
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
        reviewerMode={reviewerMode}
        reviewerBusy={reviewerBusy}
        reviewerSignature={reviewerSignatureProp}
        onReviewerReturn={onReviewerReturn}
        onReviewerApprove={onReviewerApprove}
        canSubmit={!effectiveReadOnly}
        onSubmit={sendReport}
        submitting={saving}
        onSaveDraft={() => saveDraft()}
        savingDraft={savingDraft}
        lastSaved={lastSaved}
      />
    </div>
  )

  // Split-screen composition (fullscreen staff view): the section blocks below
  // are the exact same JSX as the single-column flow — only their placement
  // changes (sticky info column + scrollable content column). No state or
  // handlers are affected. The split branch reuses the surrounding fieldset
  // (kept as the grid container) so the read-only/disabled grouping is kept.
  const useSplitLayout = Boolean(splitLayout)
  const infoStudentPhoto = patient?.photo_url || patient?.patients?.photo_url || ''
  const personalInfoSection = (
    <section id="form-section-info" className={`relative overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors shadow-sm transition-shadow hover:shadow-md scroll-mt-4 ${useSplitLayout ? 'space-y-4 p-4 sm:p-5' : 'space-y-5 p-7'}`}>
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
      <div className="flex items-start justify-between gap-4">
        <FormHeading numeral="I">Personal Information</FormHeading>
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
                {(patientName || 'ST').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <div className="max-w-44 leading-tight">
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">
                {patientName || 'Student'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                ID: {patient?.patient_id || activeReport?.patient_id || 'N/A'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <AvatarViewer src={infoPhotoViewer} alt={patientName || 'Student'} onClose={() => setInfoPhotoViewer(null)} />
      <BlankField label="Full Name (LN, FN MI):" labelClassName="w-48" stacked={useSplitLayout}>
        <input
          className="w-full rounded-xl border border-purple-100 bg-slate-50 dark:bg-slate-950 transition-colors/50 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors outline-none cursor-default"
          value={patientName}
          readOnly
        />
      </BlankField>
      <BlankField label="Birthdate:" labelClassName="w-48" stacked={useSplitLayout}>
        <DatePicker value={birthdate} disabled ariaLabel="Birthdate" />
      </BlankField>
      <BlankField label="Age/Sex:" labelClassName="w-48" stacked={useSplitLayout}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            className="w-full rounded-xl border border-purple-100 bg-slate-50 dark:bg-slate-950 transition-colors/50 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors outline-none cursor-default"
            value={ageValue !== '' ? ageValue : calcAge()}
            placeholder="Age"
            readOnly
          />
          <select
            className="w-full rounded-xl border border-purple-100 bg-slate-50 dark:bg-slate-950 transition-colors/50 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors outline-none cursor-default"
            value={sex}
            disabled
          >
            <option value="">Select sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </BlankField>
      <BlankField label="Date of Evaluation:" labelClassName="w-48" stacked={useSplitLayout}>
        <DatePicker value={evalDate} disabled ariaLabel="Date of Evaluation" />
      </BlankField>
    </section>
  )
  const bodySections = (
    <>
      <section id="form-section-background" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
        <FormHeading numeral="II">Background Information</FormHeading>
        <p className="text-xs italic leading-snug text-slate-500 dark:text-slate-400 transition-colors">
          Relevant developmental, medical, academic, and behavioral history as reported by the parent/guardian and/or teacher.
          Include previous diagnoses (if any), interventions received, and pertinent family or school information.
        </p>
        <textarea
          rows={6}
          className="mt-1 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
          value={reportDraft.background}
          onChange={(e) => setReportDraft((s) => ({ ...s, background: e.target.value }))}
        />
      </section>

      <section id="form-section-tests" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
        <FormHeading numeral="III">Behavioral Tests Administered</FormHeading>
        <div className="grid gap-2 sm:grid-cols-2">
          {ADMINISTERED_TESTS.map((test) => (
            <Checkbox
              key={test.id}
              checked={(reportDraft.administeredTests || []).includes(test.id)}
              onChange={() => toggleAdministeredTest(test.id)}
              disabled={effectiveReadOnly}
              label={test.label}
              className="cursor-pointer items-start gap-3 rounded-2xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors px-4 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-md"
            />
          ))}
        </div>
      </section>

      {hasSelectedObservationTests ? (
        <section id="form-section-observations" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
          <FormHeading numeral="IV">Behavioral Observations</FormHeading>

          {isTestSelected('caregiver_observation') ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 transition-colors">Observation Checklist Results</div>
                {!effectiveReadOnly ? (
                  <Button variant="secondary" size="sm" onClick={openCaregiverSuggest} disabled={suggestLoading}>
                    {suggestLoading ? 'Loading FO-03…' : 'Suggest auto-scoring'}
                  </Button>
                ) : null}
              </div>
              {suggestError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{suggestError}</div>
              ) : null}
              <ScoreTable
                tableKey="caregiver"
                headers={['Domain', 'Verbal Interpretation']}
                rows={['Practical Domain', 'Social Domain', 'Conceptual Domain', 'Motor Skills', 'Total']}
                values={reportDraft.tableValues?.caregiver}
                onChange={updateTableCell}
                readOnly={effectiveReadOnly}
                getDropdownOptions={(label) => {
                  if (label === 'Motor Skills') {
                    return ['Severe Motor Impairment', 'Moderate Coordination Difficulty', 'Mild Motor Difficulty', 'Age-appropriate Motor Skills']
                  }
                  return ['Significant Difficulty', 'Moderate Difficulty', 'Mild Difficulty', 'Age-appropriate Skills']
                }}
              />
              <textarea
                rows={2}
                className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
                placeholder="Summary for the Caregiver Behavioral Observation Checklist..."
                value={reportDraft.observationsA}
                onChange={(e) => handleSummaryChange('observationsA', e.target.value)}
              />
            </div>
          ) : null}

          {isTestSelected('mmse') ? (
            <div className="space-y-2">
              <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 transition-colors">Mini-Mental Status Examination (MMSE)</div>
              <textarea
                rows={2}
                className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
                placeholder="Summary for the Mini-Mental Status Examination..."
                value={reportDraft.observationsB}
                onChange={(e) => handleSummaryChange('observationsB', e.target.value)}
              />
            </div>
          ) : null}

          {isTestSelected('adaptive_functioning') ? (
            <div className="space-y-2">
              <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 transition-colors">
                Child Adaptive Functioning Assessment Tool
              </div>
              <textarea
                rows={6}
                className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
                placeholder="Summary for the Child Adaptive Functioning Assessment Tool..."
                value={reportDraft.observationsC}
                onChange={(e) => setReportDraft((s) => ({ ...s, observationsC: e.target.value }))}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {isTestSelected('ctoni_2') ? (
        <section id="form-section-ctoni" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
          <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 transition-colors">
            Comprehensive Test of Nonverbal Intelligence-2 (CTONI-2)
          </div>
          <ScoreTable
            tableKey="ctoniSubtests"
            headers={['Subtest', 'Age Equivalent', 'Descriptive Term']}
            rows={[
              'Pictorial Analogies (PA)',
              'Geometric Analogies (GA)',
              'Pictorial Categories (PC)',
              'Geometric Categories (GC)',
              'Pictorial Sequences (PS)',
              'Geometric Sequences (GS)',
            ]}
            values={reportDraft.tableValues?.ctoniSubtests}
            onChange={updateTableCell}
            cellMaxLength={[18, 36]}
            readOnly={effectiveReadOnly}
          />
          <textarea
            rows={6}
            className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
            placeholder="Summary for the CTONI-2 subtests table..."
            value={reportDraft.ctoniSubtests}
            onChange={(e) => setReportDraft((s) => ({ ...s, ctoniSubtests: e.target.value }))}
          />
          <div className="space-y-2">
            <ScoreTable
              tableKey="ctoniComposite"
              headers={['Composite', 'Descriptive Term']}
              rows={['Pictorial Scale', 'Geometric Scale']}
              values={reportDraft.tableValues?.ctoniComposite}
              onChange={updateTableCell}
              cellMaxLength={36}
              readOnly={effectiveReadOnly}
            />
            <textarea
              rows={6}
              className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
              placeholder="Summary for the CTONI-2 composite table..."
              value={reportDraft.ctoniComposite}
              onChange={(e) => setReportDraft((s) => ({ ...s, ctoniComposite: e.target.value }))}
            />
          </div>
        </section>
      ) : null}

      {isTestSelected('gars_3') ? (
        <section id="form-section-gars" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
          <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 transition-colors">Gilliam&apos;s Autism Rating Scale-3 (GARS-3)</div>
          <ScoreTable
            tableKey="garsSubscales"
            headers={['Subscales', 'Verbal Interpretation']}
            rows={[
              'Restricted/Repetitive Behaviors (RB)',
              'Social Interaction (SI)',
              'Social Communication (SC)',
              'Emotional Responses (ER)',
              'Cognitive Style (CS)',
              'Maladaptive Speech (MS)',
            ]}
            values={reportDraft.tableValues?.garsSubscales}
            onChange={updateTableCell}
            readOnly={effectiveReadOnly}
          />
          <textarea
            rows={6}
            className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
            placeholder="Summary for the GARS-3 subscales table..."
            value={reportDraft.garsSubscales}
            onChange={(e) => setReportDraft((s) => ({ ...s, garsSubscales: e.target.value }))}
          />
          <div className="space-y-2">
            <ScoreTable
              tableKey="garsComposite"
              headers={['Composites', 'Severity Level']}
              rows={['4 scores', '6 scores']}
              values={reportDraft.tableValues?.garsComposite}
              onChange={updateTableCell}
              readOnly={effectiveReadOnly}
            />
            <textarea
              rows={6}
              className="mt-3 w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
              placeholder="Summary for the GARS-3 composites table..."
              value={reportDraft.garsComposites}
              onChange={(e) => setReportDraft((s) => ({ ...s, garsComposites: e.target.value }))}
            />
          </div>
        </section>
      ) : null}

      <section id="form-section-diagnosis" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
        <FormHeading numeral="V">Working Diagnosis</FormHeading>
        <textarea
          rows={3}
          className="w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
          placeholder="Clinical impression / working diagnosis..."
          value={reportDraft.diagnosis}
          onChange={(e) => setReportDraft((s) => ({ ...s, diagnosis: e.target.value }))}
        />
      </section>

      <section id="form-section-recommendations" className="relative overflow-hidden space-y-5 rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-7 shadow-sm transition-shadow hover:shadow-md scroll-mt-4">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 opacity-40 blur-3xl pointer-events-none" />
        <FormHeading numeral="VI">Recommendations</FormHeading>
        <textarea
          rows={6}
          className="w-full rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 text-sm outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 placeholder:text-slate-400"
          value={reportDraft.recommendations}
          onChange={(e) => setReportDraft((s) => ({ ...s, recommendations: e.target.value }))}
        />
      </section>
    </>
  )
  const signaturesArea = (
    <section id="form-section-signatures" className="space-y-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-5 shadow-sm scroll-mt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Prepared by</div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
            {effectiveReadOnly
              ? 'Psychometrician who prepared and submitted this report.'
              : 'Current logged-in psychometrician assigned to this report.'}
          </p>
          <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Name:</span> {capitalizeName(preparedProfile?.display_name) || 'NA'}
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Profession:</span>{' '}
              {preparedProfile?.title || 'Psychometrician'}
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">PRC No.:</span>{' '}
              {preparedProfile?.license_no || 'NA'}
            </div>
          </div>
          <div className="mt-4">
            {effectiveReadOnly ? (
              preparedSig ? (
                <SavedSignature image={preparedSig} alt="Psychometrician signature" sealed />
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                  <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No psychometrician signature recorded.</div>
                </div>
              )
            ) : (
              <SignaturePad label="Signature" value={preparedSig} onChange={setPreparedSig} />
            )}
          </div>
          <div className="mt-3">
            {effectiveReadOnly ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                Date: {preparedDate || 'Not recorded'}
              </div>
            ) : (
              <DatePicker
                value={preparedDate}
                onChange={(value) => setPreparedDate(value)}
                ariaLabel="Psychometrician signature date"
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">Psychologist review</div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 transition-colors">
            The psychologist will review, sign, and either approve or return this report.
          </p>
          <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 transition-colors">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Name:</span>{' '}
              {capitalizeName(resolvedReviewerProfile?.display_name || resolvedReviewerProfile?.name) || 'NA'}
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">Profession:</span>{' '}
              {resolvedReviewerProfile?.title || resolvedReviewerProfile?.profession || 'Psychologist'}
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100 transition-colors">PRC No.:</span>{' '}
              {resolvedReviewerProfile?.license_no || resolvedReviewerProfile?.prc_no || 'NA'}
            </div>
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
                className="mt-2 w-full rounded-xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all focus:border-purple-400 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-400/10 dark:focus:ring-purple-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="Write a revision note for the psychometrician..."
                value={reviewerCommentProp}
                onChange={(e) => onReviewerCommentChange?.(e.target.value.slice(0, REVIEW_COMMENT_LIMIT))}
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
                value={reviewerSignatureProp || resolvedReviewerSignature}
                onChange={onReviewerSignatureChange}
              />
            ) : resolvedReviewerSignature ? (
              <SavedSignature image={resolvedReviewerSignature} alt="Psychologist signature" sealed />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
                <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No psychologist signature yet.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
  // Left-rail jump list for the fullscreen split view. Items mirror exactly
  // what is rendered below so every link always has a live target.
  const navSections = [
    { id: 'form-section-info', label: 'I. Personal Information' },
    { id: 'form-section-background', label: 'II. Background Information' },
    { id: 'form-section-tests', label: 'III. Tests Administered' },
    ...(hasSelectedObservationTests ? [{ id: 'form-section-observations', label: 'IV. Observations' }] : []),
    ...(isTestSelected('ctoni_2') ? [{ id: 'form-section-ctoni', label: 'CTONI-2' }] : []),
    ...(isTestSelected('gars_3') ? [{ id: 'form-section-gars', label: 'GARS-3' }] : []),
    { id: 'form-section-diagnosis', label: 'V. Diagnosis' },
    { id: 'form-section-recommendations', label: 'VI. Recommendations' },
    { id: 'form-section-signatures', label: 'Signatures' },
  ]

  return (
    <FormShell
      title="BEHAVIORAL ASSESSMENT REPORT"
      subtitle="SPECIAL EDUCATION PROGRAM"
      code="CMPS:SE-FO-06 rev.0 03032026"
      onClose={onClose}
      hideActions={true}
      multiPage={true}
      inline={inline}
      wide={useSplitLayout || inline}
    >
      <>
        {headerActionsTarget
          ? createPortal(
              <div className="w-full print:hidden">{headerActions}</div>,
              headerActionsTarget,
            )
          : null}
        <div className="space-y-6 px-2 min-[360px]:px-3 py-4 min-[360px]:py-6 sm:px-6 lg:px-8">
          {!headerActionsTarget ? (
            <div className="no-print sticky top-0 z-30 -mx-3 mb-2 bg-[#efeaf7]/95 px-3 pb-1 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              {footerActions}
            </div>
          ) : null}
          
          {/* The hero title only renders in the standalone modal, where no
              host page titles the document. Inline dashboard views (Approvals,
              Assessment Services) already show the report title, so rendering
              it again would stack three identical headings. Error and
              revision notices always render. */}
          {!useSplitLayout && !inline && (
          <div className="mx-auto max-w-4xl mb-8 text-center print:hidden">
            <h1 className="text-3xl font-black tracking-tight text-purple-950 dark:text-purple-100 uppercase">Behavioral Assessment Report</h1>
            <p className="mt-2 text-sm font-bold tracking-widest text-purple-500 dark:text-purple-400 uppercase">Special Education Program</p>
          </div>
          )}
          {(error || (!reviewerMode && resolvedReviewerComment)) && (
          <div className="mx-auto max-w-4xl space-y-6 mb-6">
            
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : null}

            {!reviewerMode && resolvedReviewerComment ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-red-100 pb-3 text-red-800">
                  <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Psychologist's Note for Revision</h3>
                </div>
                <div className="mt-3 text-sm font-medium leading-relaxed text-red-900 whitespace-pre-wrap break-words">
                  {resolvedReviewerComment}
                </div>
              </div>
            ) : null}
          </div>
          )}

          {useSplitLayout ? (
            <fieldset disabled={effectiveReadOnly} className="mx-auto grid w-full max-w-none min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-6 pb-6 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:pb-8">
                {personalInfoSection}
                {useSplitLayout && navSections.length > 0 ? <FormSectionNav sections={navSections} /> : null}
              </div>
              <div className="min-w-0 space-y-6">
                {bodySections}
                {signaturesArea}
              </div>
            </fieldset>
          ) : (
          <fieldset disabled={effectiveReadOnly} className="space-y-6">
            {/* Personal info lives in the personalInfoSection const above. */}
            {personalInfoSection}
          {/* Personal info fields moved to the personalInfoSection const above. */}

          {/* Body sections (II–VI) moved to the bodySections const above. */}
          {bodySections}

        </fieldset>
          )}

          {/* Signatures area lives in the signaturesArea const above (split view
              renders it inside the right column instead). */}
          {useSplitLayout ? null : signaturesArea}

        <div className="pb-2 pt-1">
          
        </div>
        </div>
        {pdfPreview ? <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} /> : null}
        {suggestOpen && suggestPreview ? (
          <Modal
            title="FO-03 auto-scoring suggestion"
            subtitle={`Latest FO-03 · ${suggestPreview.sourceDate} · status: ${suggestPreview.sourceStatus} · ${suggestPreview.coverage}`}
            onClose={() => setSuggestOpen(false)}
            footer={
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" size="md" onClick={() => setSuggestOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" onClick={applyCaregiverSuggest}>
                  Apply to table
                </Button>
              </div>
            }
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review each mapped interpretation below. Applying fills the five dropdowns — you can still change any of them
              afterwards, and the official report PDF only uses what is saved in the table.
            </p>
            {suggestPreview.partial ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                The source submission is incomplete ({suggestPreview.coverage}) — treat this suggestion as partial.
              </div>
            ) : null}
            <table className="mt-3 w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-purple-100 px-3 py-2 text-xs font-bold tracking-wider text-purple-900">Domain</th>
                  <th className="border-b border-purple-100 px-3 py-2 text-xs font-bold tracking-wider text-purple-900">Suggested interpretation</th>
                </tr>
              </thead>
              <tbody>
                {suggestPreview.rows.map((r) => (
                  <tr key={r.row}>
                    <td className="border-b border-purple-50 px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.row}</td>
                    <td className="border-b border-purple-50 px-3 py-2 text-slate-600 dark:text-slate-300">{r.value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Source overall: {suggestPreview.total}. Screening reference only — confirm with clinical judgment.
            </p>
          </Modal>
        ) : null}
        <ScrollTopButton />
      </>
    </FormShell>
  )
}

export default BehavioralAssessmentForm
