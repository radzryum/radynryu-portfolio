import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import FormShell from '../../../components/ui/FormShell'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import DatePicker from '../../../components/ui/DatePicker'
import DeleteModal from '../../../components/ui/DeleteModal'
import FormSection from '../../../components/ui/FormSection'
import FormField from '../../../components/ui/FormField'
import SignaturePad from '../../../components/ui/SignaturePad'
import ScrollTopButton from '../../../components/ui/ScrollTopButton'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Radio from '../../../components/ui/Radio'
import { fieldInput, fieldTextarea } from '../../../components/ui/formStyles'
import { api } from '../../../lib/api'
import { capitalizeName, compareStudentsAZ, formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'

const RUBRIC = [
  {
    key: 'assistance',
    title: 'Assistance',
    sub: '(Physical Support)',
    min: 'Completes task independently; 1–2 instances of physical assistance.',
    mod: 'Requires 3–4 brief physical assists (e.g., HOHA positioning).',
    max: 'Requires 5+ physical assists OR sustained hand-over-hand/full physical support for most of the task.',
  },
  {
    key: 'prompts',
    title: 'Prompts',
    sub: '(Instructional Guidance)',
    min: 'Follows task after 1–2 simple prompt.',
    mod: 'Requires 3–4 structured prompts (e.g., step reminders).',
    max: 'Requires 5+ prompts OR full step-by-step prompting for majority of task components.',
  },
  {
    key: 'cues',
    title: 'Cues',
    sub: '(Verbal/Visual Signals)',
    min: 'Responds appropriately after 1–2 cue.',
    mod: 'Requires 3–4 cues to initiate or complete task.',
    max: 'Requires 5+ cues OR continuous cueing throughout the task.',
  },
  {
    key: 'prodding',
    title: 'Prodding',
    sub: '(Motivation/Redirection)',
    min: 'Needs 1–2 redirection to stay engaged.',
    mod: 'Needs 3–4 redirections to sustain participation.',
    max: 'Needs 5+ redirections OR continuous motivational support to remain on task.',
  },
]

const DOMAINS = [
  'Practical Domain',
  'Social Domain',
  'Conceptual Domain',
  'Fine Motor Skills',
  'Gross Motor Skills',
]

const PROGRAM_LABELS = {
  HSN: 'Higher Support Needs (HSN)',
  MSN: 'Moderate Support Needs (MSN)',
  LSN: 'Low Support Needs (LSN)',
  Individual: 'Individual Session',
}

const getProgramLabel = (value) => PROGRAM_LABELS[value] || value || ''

const emptyAttendance = () => ({ date: '', status: '', timeIn: '', timeOut: '', remarks: '' })
const emptySession = () => ({
  date: '',
  domain: '',
  activity: '',
  assistance: '',
  prompts: '',
  cues: '',
  prodding: '',
  notes: '',
})

const parseMonthYear = (str) => {
  if (!str) {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  }
  const dateObj = new Date(str.includes('-') ? str : `1 ${str}`)
  if (!isNaN(dateObj.getTime())) {
    return { year: dateObj.getFullYear(), month: dateObj.getMonth() }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

const formatMonthYearStr = (y, m) => {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const monthLabelFromKey = (key) => {
  if (!key) return ''
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return ''
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function AttendanceSessionForm({
  patientId,
  patientName,
  program,
  date,
  monthKey,
  onMonthChange,
  onSaved,
  onDeleted,
  inline = false,
  monthLocked = false,
  attendanceApi = api.admin,
  defaultFacilitatorName = '',
}) {
  const { profile } = useAuth()
  // The recorder IS the facilitator, except when an admin/superadmin records
  // attendance on someone's behalf (pansamantala). Only admins get the
  // dropdown; everyone else is auto-named with no way to pick another person.
  const recorderRoles = [profile?.role, ...(profile?.extra_roles || [])].filter(Boolean)
  const isAdminRecorder =
    recorderRoles.includes('admin') || recorderRoles.includes('super_admin')
  const ownFacilitatorName = () => capitalizeName(profile?.display_name || '')
  const newFormFacilitatorName = () =>
    isAdminRecorder ? capitalizeName(defaultFacilitatorName) : ownFacilitatorName()
  const defaultMonthYear = () => {
    if (monthKey) {
      return monthLabelFromKey(monthKey)
    }
    if (!date) {
      const now = new Date()
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const [studentId, setStudentId] = useState(patientId || '')
  const [studentName, setStudentName] = useState(patientName || '')
  const [programEnrolled, setProgramEnrolled] = useState(getProgramLabel(program))
  const [monthYear, setMonthYear] = useState(defaultMonthYear())
  const [activeDate, setActiveDate] = useState('')
  const [formId, setFormId] = useState(null)
  // Month finalize/lock: a finalized month is read-only until reopened.
  const [isFinalized, setIsFinalized] = useState(false)
  const [finalizedAt, setFinalizedAt] = useState('')
  const [confirmingFinalize, setConfirmingFinalize] = useState(false)

  const [attendance, setAttendance] = useState([])
  const [sessions, setSessions] = useState([emptySession()])
  const [facilitatorName, setFacilitatorName] = useState('')
  const [facilitatorSig, setFacilitatorSig] = useState(null)
  const [signoffDate, setSignoffDate] = useState(new Date().toISOString().slice(0, 10))
  const [additionalNotes, setAdditionalNotes] = useState('')

  const [patients, setPatients] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const resetMonthData = () => {
    setSessions([emptySession()])
    setAttendance([])
    setFacilitatorName(newFormFacilitatorName())
    setFacilitatorSig(null)
    setAdditionalNotes('')
    setConfirmingReset(false)
  }

  useEffect(() => {
    if (!patientId) {
      api.admin
        .patients()
        .then((d) => setPatients(d.patients || []))
        .catch(() => {})
    }
  }, [patientId])

  useEffect(() => {
    api.admin
      .employees()
      .then((d) => {
        // Normalize on receipt (hand-typed records may be lowercase) so the
        // strict facilitator select below always matches stored values.
        const staff = (d.employees || [])
          .filter((p) => p.role !== 'client')
          .map((p) => ({ ...p, name: capitalizeName(p.name) }))
        setEmployees(staff)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (monthKey) {
      setMonthYear(monthLabelFromKey(monthKey) || defaultMonthYear())
    }
  }, [monthKey])

  useEffect(() => {
    if (!studentId || !monthYear) return
    setLoading(true)
    attendanceApi
      .getAttendanceSessionForm(studentId, monthYear)
      .then((d) => {
        if (d.form) {
          setFormId(d.form.id)
          setProgramEnrolled(d.form.program_enrolled || '')
          setFacilitatorName(capitalizeName(d.form.facilitator_name || ''))
          setFacilitatorSig(d.form.facilitator_signature || null)
          setSignoffDate(d.form.signoff_date ? d.form.signoff_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setAdditionalNotes(d.form.additional_notes || '')
          setIsFinalized(!!d.form.is_finalized)
          setFinalizedAt(d.form.finalized_at ? d.form.finalized_at.slice(0, 10) : '')

          if (d.attendance && d.attendance.length > 0) {
            setAttendance(
              d.attendance.map((r) => ({
                date: r.date ? r.date.slice(0, 10) : '',
                status: r.status,
                timeIn: r.time_in || '',
                timeOut: r.time_out || '',
                remarks: r.remarks || '',
              }))
            )
          } else {
            setAttendance([emptyAttendance()])
          }

          if (d.sessions && d.sessions.length > 0) {
            setSessions(
              d.sessions.map((r) => ({
                date: r.date ? r.date.slice(0, 10) : '',
                domain: r.domain || '',
                activity: r.activity || '',
                assistance: r.assistance || '',
                prompts: r.prompts || '',
                cues: r.cues || '',
                prodding: r.prodding || '',
                notes: r.notes || '',
              }))
            )
          } else {
            setSessions([emptySession()])
          }
        } else {
          setFormId(null)
          setProgramEnrolled(getProgramLabel(program))
          setAttendance([])
          setSessions([emptySession()])
          setFacilitatorName(newFormFacilitatorName())
          setFacilitatorSig(null)
          setSignoffDate(new Date().toISOString().slice(0, 10))
          setAdditionalNotes('')
          setIsFinalized(false)
          setFinalizedAt('')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, monthYear])

  const setAttendanceCell = (i, key, value) =>
    setAttendance((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  const setSessionCell = (i, key, value) =>
    setSessions((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))

  const selectStudent = (selId) => {
    setStudentId(selId)
    const sel = patients.find((p) => p.id === selId)
    setStudentName(sel?.name || '')
    setProgramEnrolled(getProgramLabel(sel?.enrollment_type))
  }

  const shiftFormMonth = (delta) => {
    const { year, month } = parseMonthYear(monthYear)
    const newStr = formatMonthYearStr(year, month + delta)
    setMonthYear(newStr)
    const nextKey = new Date(year, month + delta, 1)
    onMonthChange?.(
      `${nextKey.getFullYear()}-${String(nextKey.getMonth() + 1).padStart(2, '0')}`,
    )
  }

  const resetToCurrentMonth = () => {
    const now = new Date()
    const nextKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setMonthYear(
      now.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    )
    onMonthChange?.(nextKey)
  }

  const presentCount = attendance.filter((r) => r.status === 'Present').length
  const absentCount = attendance.filter((r) => r.status === 'Absent').length
  const excusedCount = attendance.filter((r) => r.status === 'Excused').length

  // A finalized month is read-only until reopened.
  const locked = isFinalized
  // Header badge: none (no record) → unsigned → signed → finalized.
  const monthStatus = !formId ? 'none' : locked ? 'finalized' : facilitatorSig ? 'signed' : 'unsigned'
  const staffNames = employees.map((e) => e.name).filter(Boolean)
  // Facilitator picker shows "Last, First M." labels but keeps the stored
  // full display name as the value, so saved records and the printed
  // sign-off name stay in full-name form.
  const staffOptions = employees
    .filter((e) => e.name)
    .map((e) => ({ value: e.name, label: formatLastFirstMI(e) || e.name }))

  // Auto-name non-admin recorders: once the profile and any saved form have
  // loaded, an empty facilitator means "nobody recorded yet" — and that
  // somebody is the recorder themself. Never stomps a saved value, never
  // touches finalized months.
  useEffect(() => {
    if (isAdminRecorder || locked || !profile?.display_name) return
    if (facilitatorName.trim()) return
    setFacilitatorName(ownFacilitatorName())
  }, [isAdminRecorder, locked, profile?.display_name, facilitatorName])

  const runFinalize = async (finalized) => {
    if (!studentId || !monthYear) return
    if (finalized && !facilitatorSig) {
      toast.error('Facilitator signature is required to finalize this month.')
      return
    }
    setSaving(true)
    try {
      await attendanceApi.finalizeAttendanceSessionForm(studentId, monthYear.trim(), finalized)
      toast.success(finalized ? 'Month finalized. The record is now read-only.' : 'Month reopened for editing.')
      setConfirmingFinalize(false)
      await onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Failed to update month status.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (locked) {
      toast.error('This month is finalized. Reopen it to make changes.')
      return
    }
    if (!studentId) {
      toast.error('Student is required.')
      return
    }
    if (!monthYear.trim()) {
      toast.error('Month / Year is required.')
      return
    }
    if (!facilitatorName.trim()) {
      toast.error('Facilitator name is required.')
      return
    }
    // Strict staff-list membership for admin-picked names (skipped only if
    // the staff list failed to load, so a network blip never blocks saving
    // entirely). Auto-named non-admin recorders skip it — the recorder IS
    // the facilitator by definition.
    if (isAdminRecorder && staffNames.length > 0 && !staffNames.includes(facilitatorName.trim())) {
      toast.error('Please select a facilitator from the staff list.')
      return
    }
    setSaving(true)
    try {
      const cleanAttendance = attendance.filter((r) => r.date && r.status)
      const cleanSessions = sessions.filter((s) => s.date && (s.domain || s.activity))

      const saveResult = await attendanceApi.saveAttendanceSessionForm({
        patient_id: studentId,
        month_year: monthYear.trim(),
        program_enrolled: programEnrolled,
        facilitator_name: facilitatorName.trim(),
        facilitator_signature: facilitatorSig,
        signoff_date: signoffDate,
        additional_notes: additionalNotes,
        attendance: cleanAttendance,
        sessions: cleanSessions,
      })
      toast.success(
        saveResult?.facilitatorNameStored === false
          ? 'Attendance saved. Apply the latest database migration to save the facilitator name too.'
          : 'Attendance & Session Record saved successfully.',
      )
      await onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Failed to save record.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!formId || !studentId || !monthYear) return
    if (locked) {
      toast.error('This month is finalized. Reopen it before deleting.')
      return
    }
    setSaving(true)
    try {
      await attendanceApi.deleteAttendanceSessionForm(studentId, monthYear)
      setFormId(null)
      setAttendance([])
      setSessions([emptySession()])
      setFacilitatorName('')
      setFacilitatorSig(null)
      setAdditionalNotes('')
      toast.success('Monthly attendance record deleted.')
      await onDeleted?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell
      title="Attendance & Session Record"
      subtitle="Special Education Program"
      code="CMPS:SE-FO-11 rev.0 03092026"
      multiPage={true}
      inline={inline}
      hideActions={true}
      wide
    >
      <div>
        <FormSection eyebrow="01" title="Student Information">
          {locked ? (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Finalized{finalizedAt ? ` · ${finalizedAt}` : ''} — this month is read-only.
              </div>
              <button
                type="button"
                onClick={() => runFinalize(false)}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg border border-purple-400 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Working…' : 'Reopen Month'}
              </button>
            </div>
          ) : null}
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-purple-100 dark:border-purple-800/30 bg-purple-50/40 dark:bg-purple-900/10 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                Month / Year
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">
                {monthYear || 'Select month'}
                {monthStatus === 'finalized' ? (
                  <span className="rounded-full bg-purple-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Finalized</span>
                ) : monthStatus === 'signed' ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Signed</span>
                ) : monthStatus === 'unsigned' ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Unsigned</span>
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">No record yet</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => shiftFormMonth(-1)}
                className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50"
              >
                &larr; Previous
              </button>
              <input
                type="month"
                value={monthKey || ''}
                onChange={(event) => {
                  const nextKey = event.target.value
                  if (!nextKey) return
                  onMonthChange?.(nextKey)
                }}
                className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-sm font-semibold text-purple-900 outline-none focus:border-purple-500"
                readOnly={monthLocked}
                disabled={monthLocked}
              />
              <button
                type="button"
                onClick={() => shiftFormMonth(1)}
                className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50"
              >
                Next &rarr;
              </button>
              <button
                type="button"
                onClick={resetToCurrentMonth}
                className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-800"
              >
                Current Month
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Name of Student" className="md:col-span-1">
              {patientId ? (
                <input className={fieldInput} value={studentName} readOnly disabled />
              ) : (
                <SearchableSelect
                  value={studentId}
                  onChange={(v) => selectStudent(v)}
                  options={[
                    { value: '', label: 'Select Student' },
                    ...[...patients].sort(compareStudentsAZ).map((p) => ({ value: p.id, label: formatLastFirstMI(p) || p.name })),
                  ]}
                  placeholder="Select Student"
                  searchPlaceholder="Search student..."
                  ariaLabel="Name of Student"
                />
              )}
            </FormField>
            <FormField label="Program Enrolled">
              <input
                className={fieldInput}
                value={programEnrolled}
                readOnly
                placeholder="Auto-filled from student record"
              />
            </FormField>
          </div>
        </FormSection>

        {(() => {
          const { year: currentYear, month: currentMonth } = parseMonthYear(monthYear)
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          const offset = new Date(currentYear, currentMonth, 1).getDay()

          return (
            <FormSection eyebrow="02" title="Attendance Record">
              {loading ? (
                <div className="flex items-center justify-center py-4 text-xs font-medium text-purple-700">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-purple-200 dark:border-slate-700 transition-colors border-t-purple-700"></div>
                  Loading form details...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs" role="group" aria-label="Monthly attendance calendar. Activate a day to cycle its status.">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                      <div key={d} className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors py-1">
                        {d}
                      </div>
                    ))}

                    {Array.from({ length: offset }).map((_, i) => (
                      <div key={`blank_${i}`} className="aspect-square bg-slate-50 dark:bg-slate-950 transition-colors/40 rounded-lg border border-transparent" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                      const existingRow = attendance.find((r) => r.date === dateStr)
                      const status = existingRow?.status || ''
                      const isSelectedDay = activeDate === dateStr

                      const cycleMap = { '': 'Present', Present: 'Absent', Absent: 'Excused', Excused: '' }
                      const cls =
                        status === 'Present'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : status === 'Absent'
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : status === 'Excused'
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-white dark:bg-slate-900 transition-colors border-slate-200 dark:border-slate-800 transition-colors text-slate-500 dark:text-slate-400 transition-colors'

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          aria-label={`${dateStr}: ${status || 'no status'}. Activate to change status.`}
                          aria-pressed={isSelectedDay}
                          disabled={locked}
                          onClick={() => {
                            setActiveDate(dateStr)
                            const nextStatus = cycleMap[status] || 'Present'
                            setAttendance((prev) => {
                              const idx = prev.findIndex((r) => r.date === dateStr)
                              if (idx >= 0) {
                                return prev.map((r, k) => (k === idx ? { ...r, status: nextStatus } : r))
                              } else {
                                return [
                                  ...prev,
                                  { date: dateStr, status: nextStatus, timeIn: '08:00', timeOut: '12:00', remarks: '' },
                                ]
                              }
                            })
                          }}
                          className={`aspect-square rounded-lg border flex flex-col items-center justify-between p-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-1 ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${cls} ${
                            isSelectedDay ? 'ring-2 ring-purple-600 shadow-md' : 'hover:shadow-sm'
                          }`}
                        >
                          <span className="font-extrabold text-sm">{dayNum}</span>
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            {status || <span className="text-slate-300 font-normal">+</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Selected Day Time/Remarks Detail Panel */}
                  {activeDate ? (
                    <div className="mt-4 rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30 p-4">
                      {(() => {
                        const row = attendance.find((r) => r.date === activeDate) || {
                          date: activeDate,
                          status: 'Present',
                          timeIn: '08:00',
                          timeOut: '12:00',
                          remarks: '',
                        }
                        const updateActiveRow = (key, val) => {
                          setAttendance((prev) => {
                            const idx = prev.findIndex((r) => r.date === activeDate)
                            if (idx >= 0) {
                              return prev.map((r, k) => (k === idx ? { ...r, [key]: val } : r))
                            } else {
                              return [...prev, { ...row, [key]: val }]
                            }
                          })
                        }

                        return (
                          <div>
                            <div className="flex items-center justify-between border-b border-purple-100 pb-2 mb-3">
                              <span className="text-xs font-bold text-purple-900">
                                Editing Attendance for {activeDate}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveDate('')}
                                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                Close
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">
                                  Status
                                </label>
                                <select
                                  className={fieldInput}
                                  value={row.status || ''}
                                  onChange={(e) => updateActiveRow('status', e.target.value)}
                                  disabled={locked}
                                >
                                  <option value="">(Unset / Clear)</option>
                                  <option value="Present">Present</option>
                                  <option value="Absent">Absent</option>
                                  <option value="Excused">Excused</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">
                                  Time In
                                </label>
                                <input
                                  type="time"
                                  className={fieldInput}
                                  value={row.timeIn || ''}
                                  onChange={(e) => updateActiveRow('timeIn', e.target.value)}
                                  disabled={locked}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">
                                  Time Out
                                </label>
                                <input
                                  type="time"
                                  className={fieldInput}
                                  value={row.timeOut || ''}
                                  onChange={(e) => updateActiveRow('timeOut', e.target.value)}
                                  disabled={locked}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">
                                  Remarks
                                </label>
                                <input
                                  type="text"
                                  className={fieldInput}
                                  placeholder="e.g. On-time, Sick leave"
                                  value={row.remarks || ''}
                                  onChange={(e) => updateActiveRow('remarks', e.target.value)}
                                  disabled={locked}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}

                  {/* Quick Actions & Live Stats Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-purple-100 pt-3">
                    <div className="flex gap-2 print:hidden">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          const newAttendance = []
                          for (let d = 1; d <= daysInMonth; d++) {
                            const dayDate = new Date(currentYear, currentMonth, d)
                            const dow = dayDate.getDay()
                            if (dow !== 0 && dow !== 6) {
                              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                              const existing = attendance.find((r) => r.date === dateStr)
                              newAttendance.push({
                                date: dateStr,
                                status: existing?.status || 'Present',
                                timeIn: existing?.timeIn || '08:00',
                                timeOut: existing?.timeOut || '12:00',
                                remarks: existing?.remarks || '',
                              })
                            }
                          }
                          setAttendance(newAttendance)
                        }}
                        className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Mark All Weekdays Present
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => setAttendance([])}
                        className="rounded-md border border-slate-200 dark:border-slate-800 transition-colors px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear Month
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
                      <span className="rounded-md bg-emerald-100 px-3 py-1 text-emerald-700">
                        Present: {presentCount}
                      </span>
                      <span className="rounded-md bg-rose-100 px-3 py-1 text-rose-700">
                        Absent: {absentCount}
                      </span>
                      <span className="rounded-md bg-amber-100 px-3 py-1 text-amber-700">
                        Excused: {excusedCount}
                      </span>
                      <span className="rounded-md bg-purple-100 px-3 py-1 text-purple-700">
                        Total Hours:{' '}
                        {attendance
                          .filter((r) => r.status === 'Present')
                          .reduce((sum, r) => {
                            if (r.timeIn && r.timeOut) {
                              const [hi, mi] = r.timeIn.split(':').map(Number)
                              const [ho, mo] = r.timeOut.split(':').map(Number)
                              return sum + (ho * 60 + mo - (hi * 60 + mi)) / 60
                            }
                            return sum
                          }, 0)
                          .toFixed(1)}
                        h
                      </span>
                    </div>
                  </div>
                </>
              )}
            </FormSection>
          )
        })()}
      </div>

      <div>
        <FormSection eyebrow="03" title={`Session Log${studentName ? ` — ${studentName}` : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-4 text-xs font-medium text-purple-700">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-purple-200 dark:border-slate-700 transition-colors border-t-purple-700"></div>
              Loading session details...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {sessions.map((row, i) => (
                  <div key={i} className="rounded-2xl border border-purple-200 dark:border-slate-700/60 transition-colors bg-purple-50/20 dark:bg-slate-800/20 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">Session {i + 1}</div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">
                        {row.date ? row.date : 'mm/dd/yyyy'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <FormField label="Date">
                        <DatePicker
                          value={row.date}
                          onChange={(v) => setSessionCell(i, 'date', v)}
                          disabled={locked}
                          className="w-full"
                          ariaLabel="Session date"
                        />
                      </FormField>
                      <FormField label="Targeted Domain">
                        <select
                          className={fieldInput}
                          value={row.domain}
                          onChange={(e) => setSessionCell(i, 'domain', e.target.value)}
                          disabled={locked}
                        >
                          <option value="">Select</option>
                          {DOMAINS.map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Title of Activity">
                        <input
                          className={fieldInput}
                          value={row.activity}
                          onChange={(e) => setSessionCell(i, 'activity', e.target.value)}
                          disabled={locked}
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-4">
                      {['assistance', 'prompts', 'cues', 'prodding'].map((k) => {
                        const rub = RUBRIC.find((r) => r.key === k)
                        const val = row[k]
                        return (
                          <div key={k} className="rounded-xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                              {rub?.title}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                              {[{ key: 'min', label: 'Min' }, { key: 'mod', label: 'Mod' }, { key: 'max', label: 'Max' }].map((tier) => (
                                <Radio
                                  key={tier.key}
                                  name={`rubric-${i}-${k}`}
                                  value={tier.key}
                                  checked={val === tier.key}
                                  disabled={locked}
                                  onChange={() => setSessionCell(i, k, tier.key)}
                                  label={tier.label}
                                  colorClass="border-purple-700 bg-purple-700 text-white"
                                  unselectedClass="border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-500 dark:text-slate-400 transition-colors hover:bg-purple-50 dark:hover:bg-slate-800"
                                  className="rounded-md px-1 py-1 text-[11px] font-bold w-full justify-center"
                                />
                              ))}
                            </div>
                            {val && rub ? (
                              <div className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400 transition-colors">
                                {rub[val]}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">Notes</div>
                        <div className="text-[11px] text-slate-400">
                          {row.notes ? row.notes.trim().split(/\s+/).filter(Boolean).length : 0}/200 words
                        </div>
                      </div>
                      <textarea
                        className={`${fieldTextarea} mt-2`}
                        rows={3}
                        value={row.notes}
                        onChange={(e) => {
                          const v = e.target.value
                          const words = v.trim() ? v.trim().split(/\s+/).filter(Boolean).length : 0
                          if (words <= 200) setSessionCell(i, 'notes', v)
                        }}
                        placeholder="Observed behaviors, concerns, or notable progress..."
                        disabled={locked}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {!locked ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setSessions((rows) => [...rows, emptySession()])}
                    className="rounded-md border border-purple-300 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 cursor-pointer print:hidden"
                  >
                    Add row
                  </button>
                </div>
              ) : null}
            </>
          )}
        </FormSection>

        <FormSection eyebrow="Reference" title="Support Level Guide">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-purple-100 dark:bg-purple-950 text-left font-semibold text-purple-800 dark:text-purple-100">
                  <th className="border border-purple-200 dark:border-purple-800 px-2 py-2">Category</th>
                  <th className="border border-purple-200 dark:border-purple-800 px-2 py-2">Minimum Support</th>
                  <th className="border border-purple-200 dark:border-purple-800 px-2 py-2">Moderate Support</th>
                  <th className="border border-purple-200 dark:border-purple-800 px-2 py-2">Maximum Support</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC.map((r) => (
                  <tr key={r.key}>
                    <td className="border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 dark:bg-slate-800/40 px-2 py-2 font-bold text-slate-700 dark:text-slate-200 transition-colors">
                      {r.title}
                      <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400 transition-colors">{r.sub}</span>
                    </td>
                    <td className="border border-purple-200 dark:border-slate-700 transition-colors px-2 py-2 align-top text-slate-700 dark:text-slate-200 transition-colors">{r.min}</td>
                    <td className="border border-purple-200 dark:border-slate-700 transition-colors px-2 py-2 align-top text-slate-700 dark:text-slate-200 transition-colors">{r.mod}</td>
                    <td className="border border-purple-200 dark:border-slate-700 transition-colors px-2 py-2 align-top text-slate-700 dark:text-slate-200 transition-colors">{r.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>

        <FormSection eyebrow="Sign-off" title="Facilitator Sign-off">
          <div className="max-w-md space-y-3">
            <FormField label="Facilitator Name">
              {isAdminRecorder ? (
                <SearchableSelect
                  value={facilitatorName}
                  onChange={(v) => setFacilitatorName(v)}
                  options={[
                    { value: '', label: 'Select facilitator' },
                    ...staffOptions,
                    ...(facilitatorName && !staffNames.includes(facilitatorName)
                      ? [{ value: facilitatorName, label: `${formatLastFirstMI(facilitatorName)} (previous — please reselect)` }]
                      : []),
                  ]}
                  placeholder="Select facilitator"
                  searchPlaceholder="Search facilitator..."
                  disabled={locked}
                  ariaLabel="Facilitator Name"
                />
              ) : (
                <input
                  className={fieldInput}
                  value={facilitatorName}
                  readOnly
                  placeholder="Facilitator"
                  aria-label="Facilitator Name"
                />
              )}
            </FormField>
            <SignaturePad
              label="Signature over Printed Name of Facilitator"
              value={facilitatorSig}
              onChange={setFacilitatorSig}
              sealed={Boolean(formId)}
              signedAt={signoffDate}
            />
            {formId && facilitatorSig ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                Signed · {signoffDate} — daily rows don&apos;t need re-signing.
              </div>
            ) : null}
            <FormField label="Date">
              <DatePicker
                value={signoffDate}
                onChange={(v) => setSignoffDate(v)}
                disabled={locked}
                className="w-full"
                ariaLabel="Sign-off date"
              />
            </FormField>
            <FormField label="Additional Notes (optional)">
              <textarea
                className={fieldTextarea}
                placeholder="Anything else worth recording about this month"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                disabled={locked}
              />
            </FormField>

            <div className="pt-3 flex flex-wrap gap-3">
              {!locked ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="rounded-md border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    ↺ Reset
                  </button>
                  {formId ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={saving}
                      className="rounded-md border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Delete Monthly Record
                    </button>
                  ) : null}
                  {formId ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingFinalize(true)}
                      disabled={saving}
                      title={facilitatorSig ? 'Lock this month as read-only' : 'Sign first — finalizing requires the facilitator signature'}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                    >
                      Finalize Month
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !studentId || !monthYear || loading}
                    className="flex-1 rounded-md bg-purple-700 py-3 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : formId ? 'Update Monthly Record' : 'Save Monthly Record'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </FormSection>
      </div>
      {confirmingReset ? (
        <ConfirmDialog
          title="Reset Month Data?"
          message="Are you sure you want to reset all session data for this month? Unsaved entries will be lost."
          confirmLabel="Yes"
          cancelLabel="No"
          tone="red"
          onClose={() => setConfirmingReset(false)}
          onConfirm={resetMonthData}
        />
      ) : null}
      {confirmingDelete ? (
        <DeleteModal
          title="Delete Monthly Record?"
          text="Are you sure you want to delete the complete FO-11 record? This cannot be undone."
          itemName={monthYear}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      ) : null}
      {confirmingFinalize ? (
        <ConfirmDialog
          title="Finalize this month?"
          message="The month becomes read-only: daily edits and deletion will be blocked until reopened. Finalizing requires the facilitator signature."
          confirmLabel="Finalize Month"
          cancelLabel="Cancel"
          tone="green"
          busy={saving}
          onClose={() => setConfirmingFinalize(false)}
          onConfirm={() => runFinalize(true)}
        />
      ) : null}
      <ScrollTopButton />
    </FormShell>
  )
}

export default AttendanceSessionForm

