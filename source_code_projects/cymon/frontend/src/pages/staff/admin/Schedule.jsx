import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import DatePicker from '../../../components/ui/DatePicker'
import Skeleton, { SkeletonText, SkeletonCalendarDay } from '../../../components/ui/Skeleton'
import Modal from '../../../components/ui/Modal'
import SearchBar from '../../../components/ui/SearchBar'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import Checkbox from '../../../components/ui/Checkbox'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import Radio from '../../../components/ui/Radio'
import Button from '../../../components/ui/Button'
import { api } from '../../../lib/api'
import { toast } from 'react-hot-toast'
import AssessmentDocumentReleases from './AssessmentDocumentReleases'
import { shortBranchName, branchOptionLabel } from '../../../lib/branches'
import { capitalizeName, compareStudentsAZ, formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'

const ROOM_OPTIONS = ['Counseling Room', 'Testing Area', 'Board Room']
const APPOINTMENT_MINUTES = 60

// Room part of a stored "City - Room" location, lowercased for comparison.
// A bare "City" location means no room was picked and can never clash.
const roomOfLocation = (value) => {
  const parts = String(value || '').split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ').trim().toLowerCase() : ''
}

// Display label for Room rows: strip the "City - " prefix since the branch
// is already shown separately (branch chip / Branch row). A bare "City"
// location (no room picked) is shown as-is so branch context is kept.
const roomDisplayLabel = (value) => {
  const text = String(value || '').trim()
  const parts = text.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : text
}

const SESSION_LABEL = {
  mmse: 'MMSE',
  cafat: 'CAFAT',
  gars: 'GARS',
  initial_assessment: 'Initial Assessment',
  follow_up: 'Follow-up Session',
  therapy: 'Therapy Session',
  parent_consultation: 'Parent Consultation',
}

const CAL_TONE = {
  purple: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 transition-colors',
  sky: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 transition-colors',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 transition-colors',
  amber: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 transition-colors',
  rose: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 transition-colors',
}

const COLOR_DOT = {
  purple: 'bg-purple-400',
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}

const COLOR_LEGEND = {
  purple: { label: 'Therapy Session', desc: 'Regular or scheduled therapy' },
  sky: { label: 'Follow-up', desc: 'Progress check or consultation' },
  emerald: { label: 'Assessment', desc: 'Initial testing or evaluation' },
  amber: { label: 'Parent Session', desc: 'Family or guardian meeting' },
  rose: { label: 'Urgent / Special', desc: 'High priority or special case' },
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const fieldCls = 'mt-1 h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-800/80 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors dark:[color-scheme:dark]'
const labelCls = 'text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 transition-colors'
const ENROLLMENT_LABEL = {
  HSN: 'Higher Support Needs Program (48 hrs/mo)',
  MSN: 'Moderate Support Needs Program (36 hrs/mo)',
  LSN: 'Low Support Needs Program (24 hrs/mo)',
  Individual: 'Individual Session',
}

const shortName = (name) => {
  const parts = (name || '').split(' ').filter(Boolean)
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const pad = (value) => String(value).padStart(2, '0')
const fmtTime = (value) => {
  if (!value) return '-'
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value
  return `${pad(hour % 12 || 12)}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`
}
const todayLocal = () => new Date().toLocaleDateString('en-CA')
const isBeforeToday = (dateStr) => dateStr && dateStr < todayLocal()
const isToday = (dateStr) => dateStr && dateStr === todayLocal()
const isComplianceComplete = (patient) =>
  patient?.admission_form_status === 'complete' &&
  (patient?.waiver_submissions || []).some(
    (w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved',
  )

// Short city label for the booking branch, used as the location prefix.
// Matches the previous free-text BRANCH options (Alabang / Cabuyao) so
// stored locations keep the same shape without asking twice.
const branchCityLabel = (branch) => {
  const haystack = `${branch?.code || ''} ${branch?.name || ''}`.toUpperCase()
  if (haystack.includes('ALABANG')) return 'Alabang'
  if (haystack.includes('CABUYAO')) return 'Cabuyao'
  return shortBranchName(branch) || 'Clinic'
}

const to12h = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return hhmm
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const pickerBtnCls = 'mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-md border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800/80 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors hover:border-purple-300 dark:hover:border-slate-600'
const pickerPopCls = 'absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl sm:right-auto'

const SLOT_START = 8 * 60 // 8:00 AM — clinic opening
const SLOT_END = 17 * 60 // 5:00 PM — last bookable start
const SLOT_STEP = 30
const TIME_SLOTS = Array.from({ length: (SLOT_END - SLOT_START) / SLOT_STEP + 1 }, (_, i) => {
  const mins = SLOT_START + i * SLOT_STEP
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
})

// Themed time-slot grid: quicker than typing, impossible to enter an
// invalid time, and past slots are disabled when booking for today.
function TimeSlotPicker({ value, onChange, date }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  const nowHHMM = (() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
  })()
  const forToday = date && isToday(date)

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className={pickerBtnCls}>
        <span className={value ? '' : 'text-slate-400 dark:text-slate-500'}>{value ? to12h(value) : 'Select time'}</span>
        <Clock size={16} className="shrink-0 text-purple-500 dark:text-purple-400" />
      </button>
      {open ? (
        <div role="dialog" aria-label="Choose appointment time" className={`${pickerPopCls} max-h-56 overflow-y-auto`}>
          <div className="grid grid-cols-3 gap-1.5">
            {TIME_SLOTS.map((slot) => {
              const disabled = forToday && slot <= nowHHMM
              const selected = value === slot
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(slot); setOpen(false) }}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    selected
                      ? 'border-purple-500 bg-purple-600 text-white shadow-sm'
                      : 'border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {to12h(slot)}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">Clinic hours · 8:00 AM – 5:00 PM</p>
        </div>
      ) : null}
    </div>
  )
}

function BookModal({ patients, practitioners, appointments, onClose, onBooked, isSuperAdmin, branchOptions, selectedBranchId, onSelectBranch, ownClinic }) {
  const [f, setF] = useState({
    patient_id: '',
    patient_ids: [],
    format: 'individual',
    practitioner_id: '',
    date: '',
    time: '',
    session_type: '',
    color_tag: 'purple',
    notes: '',
    location: '',
    location_type: '',
  })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  // The booking branch is the single source of truth — BOOK INTO already
  // picks it, so there is no separate BRANCH dropdown to drift out of sync.
  const bookingBranch = branchOptions.find((b) => b.id === selectedBranchId) || ownClinic || null
  const bookingBranchId = bookingBranch?.id || selectedBranchId || ''
  const branchCity = branchCityLabel(bookingBranch)

  // Only students and staff designated to the booking branch are offered.
  // Multi-branch clinicians (granted access, same email) appear in every
  // branch they serve. Rows without a clinic_id (legacy shapes) are kept.
  const inBookingBranch = (p) => !p.clinic_id || p.clinic_id === bookingBranchId || ((p.branches || []).includes(bookingBranchId))
  // Student pickers are always A–Z by "LAST, FIRST M." (never backend order).
  const visiblePatients = (bookingBranchId
    ? patients.filter(inBookingBranch)
    : [...patients]
  ).sort(compareStudentsAZ)
  const branchPractitioners = bookingBranchId
    ? practitioners.filter(inBookingBranch)
    : practitioners

  // Day-availability filter: clinicians are only offered on weekdays they are
  // actually scheduled at the booking branch. Staff with no schedule rows at
  // all stay visible (schedule setup is optional); staff with schedules but
  // none matching the picked day + branch are hidden. No date picked yet →
  // show everyone in the branch.
  const [practitionerSchedules, setPractitionerSchedules] = useState({})
  useEffect(() => {
    let on = true
    const ids = branchPractitioners.map((p) => p.id).filter(Boolean).slice(0, 40)
    Promise.all(
      ids.map((id) =>
        api.admin.employeeSchedules(id)
          .then((d) => ({ id, schedules: d?.schedules || [] }))
          .catch(() => ({ id, schedules: [] })),
      ),
    ).then((rows) => {
      if (!on) return
      const map = {}
      rows.forEach(({ id, schedules }) => { map[id] = schedules })
      setPractitionerSchedules(map)
    })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingBranchId, practitioners.length])
  const bookingWeekday = f.date ? new Date(`${f.date}T12:00:00`).getDay() : null
  const visiblePractitioners = (() => {
    if (bookingWeekday == null || Number.isNaN(bookingWeekday)) return branchPractitioners
    return branchPractitioners.filter((p) => {
      const scheds = practitionerSchedules[p.id]
      // Schedules not loaded yet, or clinician has no schedule rows: keep.
      if (!scheds || scheds.length === 0) return true
      return scheds.some((s) =>
        Number(s.day_of_week) === bookingWeekday &&
        (!bookingBranchId || !s.clinic_id || String(s.clinic_id) === String(bookingBranchId)),
      )
    })
  })()
  const hiddenBySchedule = branchPractitioners.length - visiblePractitioners.length

  // Group-booking student grid search (type to narrow, scroll still works).
  const [groupQuery, setGroupQuery] = useState('')
  const groupVisiblePatients = (() => {
    const tokens = groupQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return visiblePatients
    return visiblePatients.filter((p) =>
      tokens.every((t) => `${p.name || ''} ${formatLastFirstMI(p)}`.toLowerCase().replace(/,/g, ' ').includes(t.replace(/,/g, ''))),
    )
  })()

  // Schedule-based branch: the practitioner's weekday slot suggests the
  // booking branch (their schedule decides the clinic location, not the
  // admin's memory). Super Admins auto-switch BOOK INTO; everyone else gets
  // a hint naming the scheduled branch.
  const [suggestion, setSuggestion] = useState(null)
  const lastSuggestionKey = useRef('')
  useEffect(() => {
    setSuggestion(null)
    if (!f.practitioner_id || !f.date) return undefined
    let on = true
    api.admin.scheduleSuggestion(f.practitioner_id, f.date, f.time || '')
      .then((d) => { if (on) setSuggestion(d && d.matched ? d : null) })
      .catch(() => {})
    return () => { on = false }
  }, [f.practitioner_id, f.date, f.time])
  useEffect(() => {
    if (!suggestion || !isSuperAdmin) return
    const key = `${f.practitioner_id}|${f.date}|${f.time}|${suggestion.clinic_id}`
    if (lastSuggestionKey.current === key) return
    lastSuggestionKey.current = key
    if (suggestion.clinic_id && suggestion.clinic_id !== bookingBranchId) {
      onSelectBranch?.(suggestion.clinic_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion])

  // Rooms already taken at the chosen branch + date + time (same 60-minute
  // overlap the server enforces). Occupied rooms are hidden from the picker
  // entirely (front-desk feedback) so only bookable rooms can be picked.
  // The server still rejects overlaps, and the "Others" custom-room path
  // keeps its inline taken warning below.
  const newStart = f.date && f.time ? new Date(`${f.date}T${f.time}:00+08:00`).getTime() : null
  const occupiedRooms = (() => {
    const taken = new Set()
    if (!newStart || Number.isNaN(newStart) || !bookingBranchId) return taken
    for (const a of appointments || []) {
      if (a.clinic_id !== bookingBranchId || a.status !== 'scheduled') continue
      const s = new Date(a.starts_at).getTime()
      if (Number.isNaN(s)) continue
      if (s < newStart + APPOINTMENT_MINUTES * 60000 && s + APPOINTMENT_MINUTES * 60000 > newStart) {
        const room = roomOfLocation(a.location)
        if (room) taken.add(room)
      }
    }
    return taken
  })()
  const chosenRoom = (f.location_type === 'Others' ? (f.location || '').trim() : (f.location_type || '').trim()).toLowerCase()
  const chosenRoomTaken = Boolean(chosenRoom && f.date && f.time && occupiedRooms.has(chosenRoom))

  // Switching branches prunes any selected student/practitioner that does
  // not belong to the new branch, so a stale pick can never be submitted.
  const handleBranchChange = (nextBranchId) => {
    const belongs = (row) => !row.clinic_id || row.clinic_id === nextBranchId
    setF((s) => {
      const keepPatient = !s.patient_id || patients.some((p) => p.id === s.patient_id && belongs(p))
      const keptIds = (s.patient_ids || []).filter((id) => patients.some((p) => p.id === id && belongs(p)))
      const keepPract = !s.practitioner_id || practitioners.some((p) => p.id === s.practitioner_id && belongs(p))
      if (keepPatient && keepPract && keptIds.length === (s.patient_ids || []).length) return s
      return { ...s, patient_id: keepPatient ? s.patient_id : '', patient_ids: keptIds, practitioner_id: keepPract ? s.practitioner_id : '' }
    })
    onSelectBranch?.(nextBranchId)
  }

  const togglePatient = (id) => {
    setF((s) => ({
      ...s,
      patient_ids: s.patient_ids.includes(id)
        ? s.patient_ids.filter((x) => x !== id)
        : [...s.patient_ids, id],
    }))
  }

  const submit = async () => {
    setErr(null)
    if (!f.date) {
      setErr('Please choose a valid appointment date.')
      return
    }
    if (isBeforeToday(f.date)) {
      setErr('You cannot schedule an appointment in the past.')
      return
    }
    if (f.date === todayLocal()) {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (f.time && f.time < currentTime) {
        setErr('For today, the appointment time must be in the future.')
        return
      }
    }
    if (f.format === 'individual') {
      if (!f.patient_id || !f.practitioner_id || !f.date || !f.time || !f.session_type) {
        setErr('Patient, practitioner, date, time, and session type are required.')
        return
      }
    } else {
      if (f.patient_ids.length < 2 || !f.practitioner_id || !f.date || !f.time || !f.session_type) {
        setErr('At least 2 students, practitioner, date, time, and session type are required for group scheduling.')
        return
      }
    }
    if (isSuperAdmin && !bookingBranchId) {
      setErr('Please choose which branch to book into.')
      return
    }
    if (f.practitioner_id && bookingWeekday != null && !visiblePractitioners.some((p) => String(p.id) === String(f.practitioner_id))) {
      setErr('The selected clinician is not scheduled at this branch on the chosen date. Please pick an available clinician.')
      return
    }
    if (chosenRoomTaken) {
      const roomLabel = f.location_type === 'Others' ? (f.location || '').trim() : f.location_type
      setErr(`The ${roomLabel} is already booked at the selected date and time. Please choose another room or time.`)
      return
    }
    setBusy(true)
    try {
      const payload = { ...f }
      if (f.format === 'group') {
        delete payload.patient_id
      } else {
        delete payload.patient_ids
      }

      const combinedLocation = branchCity + (f.location_type && f.location_type !== 'Others' ? ` - ${f.location_type}` : (f.location ? ` - ${f.location}` : ''))
      payload.location = combinedLocation
      delete payload.location_type
      // Branch scoping: only a Super Admin may book into another branch.
      // Regular admins omit this and land in their own clinic server-side.
      if (isSuperAdmin && bookingBranchId) payload.clinic_id = bookingBranchId
      const res = await api.admin.createAppointment(payload)
      const bookedId = res?.appointment?.id || null
      const studentNames = f.format === 'group'
        ? patients.filter((p) => f.patient_ids.includes(p.id)).map((p) => p.name)
        : [patients.find((p) => p.id === f.patient_id)?.name || 'Student']
      const practitionerName = practitioners.find((p) => p.id === f.practitioner_id)?.name || 'Practitioner'
      toast.success(`Appointment booked for ${studentNames.join(', ')} on ${f.date} at ${f.time}.`)
      onBooked({
        id: bookedId,
        clinic_id: isSuperAdmin ? bookingBranchId : undefined,
        clinic_name: (branchOptions.find((b) => b.id === bookingBranchId)?.name) || bookingBranch?.name || undefined,
        patient: studentNames.join(', '),
        participants: f.format === 'group' ? studentNames : [],
        format: f.format,
        practitioner: practitionerName,
        starts_at: `${f.date}T${f.time}:00`,
        session_type: f.session_type,
        color_tag: f.color_tag,
        location: combinedLocation || '',
        notes: f.notes || '',
        status: 'scheduled',
      })
    } catch (e) {
      const message = e.message || 'Failed to book the appointment.'
      setErr(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Book New Appointment"
      subtitle="Fill in all required fields to schedule a session"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose} variant="secondary" className="px-4 py-2">
            Cancel
          </Button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-60"
          >
            {busy ? 'Booking' : 'Book Appointment'}
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
        <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Book into:</span>
        {isSuperAdmin && branchOptions.length > 1 ? (
          <select
            aria-label="Book into branch"
            className="ml-auto rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            value={selectedBranchId}
            onChange={(e) => handleBranchChange(e.target.value)}
          >
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{branchOptionLabel(b)}</option>
            ))}
          </select>
        ) : (
          <span className="ml-auto rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {bookingBranch ? branchOptionLabel(bookingBranch) : 'Your branch'}
          </span>
        )}
      </div>
      <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
        Only students and staff designated to {bookingBranch ? <strong className="text-purple-700 dark:text-purple-300">{branchCity}</strong> : 'this branch'} are listed below.
      </p>
      {suggestion && suggestion.clinic_id !== bookingBranchId ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-300">
          This practitioner is scheduled at <strong>{suggestion.clinic_name || suggestion.clinic_code || 'another branch'}</strong>
          {suggestion.day_label ? ` on ${suggestion.day_label}s` : ''} — the booking branch follows their schedule.
          {isSuperAdmin ? ' BOOK INTO was switched automatically.' : ' Switch acting branch (header) to book there.'}
        </p>
      ) : null}
      <div className="mb-4">
        <div className={labelCls}>SCHEDULING FORMAT</div>        <div className="mt-1 flex gap-3">
          {['individual', 'group'].map((fmt) => (
            <Radio
              key={fmt}
              name="format"
              value={fmt}
              checked={f.format === fmt}
              onChange={() => set('format', fmt)}
              label={fmt === 'individual' ? 'Individual Session' : 'Group Session (2+ students)'}
              colorClass="border-purple-500 bg-purple-100 dark:bg-purple-600 dark:border-purple-500 text-purple-800 dark:text-white"
              unselectedClass="border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800"
              className="px-3 py-2 text-sm font-medium"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {f.format === 'individual' ? (
          <div>
            <div className={labelCls}>STUDENT *</div>
            <SearchableSelect
              value={f.patient_id}
              onChange={(v) => set('patient_id', v)}
              options={[
                { value: '', label: 'Select' },
                ...visiblePatients.map((p) => ({
                  value: p.id,
                  label: `${formatLastFirstMI(p) || p.name}${p.enrollment_type ? ` — ${ENROLLMENT_LABEL[p.enrollment_type] || p.enrollment_type}` : ''}`,
                })),
              ]}
              placeholder="Select"
              searchPlaceholder="Search student..."
              emptyText={visiblePatients.length === 0 ? `No compliant students in ${branchCity} yet.` : 'No match found.'}
              ariaLabel="Student"
            />
            {visiblePatients.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">No compliant students in {branchCity} yet.</p>
            ) : null}
          </div>
        ) : (
          <div className="sm:col-span-2">
            <div className={labelCls}>STUDENTS * (select 2 or more)</div>
            <input
              type="text"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
              placeholder="Search students..."
              aria-label="Search students"
              className="mt-1 h-9 w-full rounded-md border border-purple-200 bg-purple-50/50 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-purple-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 dark:bg-slate-800/50 p-3">
              {groupVisiblePatients.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{groupQuery ? 'No match found.' : `No compliant students in ${branchCity} yet.`}</p>
              ) : null}
              {groupVisiblePatients.map((p) => {
                const checked = f.patient_ids.includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePatient(p.id)}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${checked ? 'border-purple-400 bg-purple-100 dark:bg-purple-700/70 dark:border-purple-500 font-medium text-purple-800 dark:text-white' : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-700 dark:text-slate-200 transition-colors hover:bg-purple-50'
                      }`}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => togglePatient(p.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div>{formatLastFirstMI(p) || p.name}</div>
                      {p.enrollment_type ? (
                        <div className={`text-[11px] transition-colors ${checked ? 'text-purple-700 dark:text-purple-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {ENROLLMENT_LABEL[p.enrollment_type] || p.enrollment_type}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {f.patient_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {f.patient_ids.map((id) => {
                  const p = patients.find((x) => x.id === id)
                  return p ? (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-200">
                      {formatLastFirstMI(p) || p.name}
                      <button type="button" onClick={() => togglePatient(id)} className="text-purple-500 hover:text-purple-800 dark:text-purple-300 transition-colors">&times;</button>
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
        )}
        <div>
          <div className={labelCls}>PRACTITIONER *</div>
          <SearchableSelect
            value={f.practitioner_id}
            onChange={(v) => set('practitioner_id', v)}
            options={[
              { value: '', label: 'Select' },
              ...visiblePractitioners.map((p) => ({ value: p.id, label: formatLastFirstMI(p) || p.name })),
            ]}
            placeholder="Select"
            searchPlaceholder="Search practitioner..."
            emptyText={visiblePractitioners.length === 0 ? `No staff designated to ${branchCity} yet.` : 'No match found.'}
            ariaLabel="Practitioner"
          />
          {visiblePractitioners.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">No staff designated to {branchCity} yet.</p>
          ) : null}
          {hiddenBySchedule > 0 && bookingWeekday != null ? (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {hiddenBySchedule} clinician{hiddenBySchedule === 1 ? '' : 's'} not scheduled at {branchCity} on {WEEKDAYS[bookingWeekday]} {hiddenBySchedule === 1 ? 'is' : 'are'} hidden. Pick another date to see them.
            </p>
          ) : null}
          {f.practitioner_id && !visiblePractitioners.some((p) => String(p.id) === String(f.practitioner_id)) ? (
            <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              The selected clinician is not scheduled at {branchCity} on this date. Please pick an available clinician.
            </p>
          ) : null}
        </div>
        <div>
          <div className={labelCls}>DATE *</div>
          <DatePicker value={f.date} onChange={(v) => set('date', v)} min={todayLocal()} />
        </div>
        <div>
          <div className={labelCls}>TIME *</div>
          <TimeSlotPicker value={f.time} onChange={(v) => set('time', v)} date={f.date} />
        </div>
        <div>
          <div className={labelCls}>ASSESSMENT / SESSION TYPE *</div>
          <select value={f.session_type} onChange={(e) => set('session_type', e.target.value)} className={fieldCls}>
            <option value="">Select</option>
            {Object.entries(SESSION_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>ROOM NAME / NUMBER</div>
          <select
            value={f.location_type}
            onChange={(e) => {
              set('location_type', e.target.value)
              if (e.target.value !== 'Others') set('location', '')
            }}
            className={fieldCls}
          >
            <option value="">Select Room</option>
            {ROOM_OPTIONS.filter((room) => !(f.date && f.time && occupiedRooms.has(room.toLowerCase()))).map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
            <option value="Others">Others</option>
          </select>
          {chosenRoomTaken && f.location_type !== 'Others' ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              This room is already booked at the selected date and time. Please choose another room or time.
            </p>
          ) : null}
          {f.location_type === 'Others' && (
            <>
              <input
                value={f.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Please specify room"
                className={`${fieldCls} mt-2`}
              />
              {chosenRoomTaken ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  This room is already booked at the selected date and time. Please choose another room or time.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className={labelCls}>NOTES / SPECIAL INSTRUCTIONS</div>
        <textarea
          rows={3}
          maxLength={200}
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any additional notes"
          className="mt-1 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-800/80 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 transition-colors"
        />
        <div className="mt-1 text-right text-[10px] font-medium text-slate-500 dark:text-slate-400 transition-colors">
          {f.notes.length}/200 characters
        </div>
      </div>

      <div className="mt-4">
        <div className={labelCls}>COLOR TAG CATEGORY *</div>
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
          Select a color tag to categorize and easily identify this appointment on the calendar.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(COLOR_LEGEND).map(([c, info]) => {
            const isSelected = f.color_tag === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => set('color_tag', c)}
                className={`flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 shadow-sm ring-1 ring-purple-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`mt-0.5 shrink-0 h-4 w-4 rounded-full ${COLOR_DOT[c]} ${isSelected ? 'ring-2 ring-purple-200 dark:ring-purple-900 ring-offset-1 dark:ring-offset-slate-900' : ''}`} />
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-purple-800 dark:text-purple-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {info.label}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    {info.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {err ? <div className="mt-4 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300 transition-colors">{err}</div> : null}
    </Modal>
  )
}

const STATUS_TONE = {
  scheduled: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  cancelled: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function AppointmentDetailModal({ appointment, onClose, onDone, onDelete, busyId, showBranch }) {
  if (!appointment) return null
  const startDate = new Date(appointment.starts_at)
  const dateLabel = Number.isNaN(startDate.getTime())
    ? String(appointment.starts_at || '—')
    : startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const students = appointment.participants && appointment.participants.length > 0
    ? appointment.participants
    : [appointment.patient || appointment.name].filter(Boolean)
  const status = appointment.status || 'scheduled'
  const rows = [
    ['Student(s)', students.map((s) => capitalizeName(s)).join(', ') || '—'],
    ['Practitioner', capitalizeName(appointment.practitioner) || '—'],
    ...(showBranch && appointment.clinic_name ? [['Branch', appointment.clinic_name]] : []),
    ['Date', dateLabel],
    ['Time', timeOf(appointment.starts_at)],
    ['Session type', SESSION_LABEL[appointment.session_type] || appointment.session_type || '—'],
    ['Room', roomDisplayLabel(appointment.location) || '—'],
    ['Notes', appointment.notes || '—'],
  ]
  return (
    <Modal
      title="Appointment Details"
      subtitle="Complete booking information"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose} variant="secondary" className="px-4 py-2">
            Close
          </Button>
          {appointment.id ? (
            <>
              <Button
                onClick={onDelete}
                variant="danger"
                className="px-4 py-2"
                disabled={busyId === appointment.id}
              >
                Delete
              </Button>
              {status === 'scheduled' ? (
                <button
                  onClick={onDone}
                  disabled={busyId === appointment.id}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busyId === appointment.id ? 'Saving…' : 'Mark as Done'}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${STATUS_TONE[status] || STATUS_TONE.scheduled}`}>
          {status}
        </span>
        {appointment.format === 'group' ? (
          <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Group session
          </span>
        ) : null}
      </div>
      <dl className="divide-y divide-purple-100 dark:divide-slate-800 rounded-xl border border-purple-100 dark:border-slate-800 overflow-hidden">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[130px_1fr] gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm">
            <dt className="font-semibold text-purple-700 dark:text-purple-300">{label}</dt>
            <dd className="text-slate-800 dark:text-slate-100 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

function Schedule() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [open, setOpen] = useState(false)
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [query, setQuery] = useState('')
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [practFilter, setPractFilter] = useState('all')
  const [patients, setPatients] = useState([])
  const [staffList, setStaffList] = useState([])
  const [assessmentRequests, setAssessmentRequests] = useState([])
  const [detailAppt, setDetailAppt] = useState(null)
  const [markingDoneId, setMarkingDoneId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  // selectedBranchId is the booking target in the Book modal.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  // The admin's own branch (id + name + code) — the booking target for
  // regular admins and the location prefix when BOOK INTO has one option.
  const [ownClinic, setOwnClinic] = useState(null)

  const refreshSchedule = async (branch = branchFilter) => {
    const d = await api.admin.schedule(branch)
    setAppts(d.appointments)
  }

  // Live-refresh the calendar when another admin books, completes, or
  // deletes an appointment. appointment_participants carries no clinic_id,
  // so it rides unfiltered (RLS still gates every event).
  const scheduleScope = branchFilter || ownClinic?.id || profile?.clinic_id || ''
  const scheduleSubs = scheduleScope
    ? [
      { table: 'appointments', filter: `clinic_id=eq.${scheduleScope}` },
      { table: 'appointment_participants' },
    ]
    : (isSuperAdmin ? [{ table: 'appointments' }, { table: 'appointment_participants' }] : [])
  useRealtimeRefresh(profile?.id, scheduleSubs, () => {
    refreshSchedule().catch(() => {})
  })

  useEffect(() => {
    let on = true
    Promise.all([api.admin.schedule(branchFilter), api.admin.patients(), api.admin.employees()])
      .then(([s, p, e]) => {
        if (!on) return
        setAppts(s.appointments)
        setPatients((p.patients || []).filter(isComplianceComplete).map((x) => ({ id: x.id, name: x.name, enrollment_type: x.enrollment_type || null, clinic_id: x.clinic_id || null, clinic_name: x.clinic_name || null })))
        setStaffList(
          (e.employees || []).filter((x) => x.role !== 'admin').map((x) => ({ id: x.id, name: x.name, clinic_id: x.clinic_id || null, clinic_name: x.clinic_name || null, branches: (x.branches || []).map((b) => b.id) }))
        )
      })
      .catch(() => { })
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter])

  useEffect(() => {
    // Branch list + default booking target (own branch) for Super Admin.
    // Regular admins book into their own clinic server-side.
    api.admin.clinic()
      .then((data) => {
        if (data?.clinic?.id) {
          setOwnClinic(data.clinic)
          setSelectedBranchId((prev) => prev || data.clinic.id)
        }
      })
      .catch(() => {})
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onBooked = async (booked) => {
    setOpen(false)
    await refreshSchedule().catch(() => null)
    if (booked) setDetailAppt(booked)
  }

  const updateAppointmentStatus = async (appointmentId, status) => {
    if (!appointmentId) return
    setMarkingDoneId(appointmentId)
    try {
      await api.admin.updateAppointment(appointmentId, { status })
      toast.success(status === 'completed' ? 'Appointment marked as done.' : `Appointment ${status}.`)
      await refreshSchedule().catch(() => null)
      setDetailAppt((current) => (current && current.id === appointmentId ? { ...current, status } : current))
    } catch (e) {
      toast.error(e.message || 'Failed to update the appointment.')
    } finally {
      setMarkingDoneId(null)
    }
  }

  const confirmDeleteAppointment = async () => {
    const target = deleteTarget
    if (!target) return
    setActionError(null)
    setActionId(target.id)
    try {
      await api.admin.deleteAppointment(target.id)
      toast.success('Appointment deleted.')
      setDeleteTarget(null)
      setDetailAppt((current) => (current && current.id === target.id ? null : current))
      await refreshSchedule()
    } catch (e) {
      setActionError(e.message)
      toast.error(e.message || 'Failed to delete the appointment.')
    } finally {
      setActionId(null)
    }
  }

  const practitioners = [...new Set(appts.map((a) => a.practitioner).filter(Boolean))].sort()
  const q = query.trim().toLowerCase()
  const filtered = appts.filter((a) => {
    const mq = !q || (a.patient || '').toLowerCase().includes(q)
    const mp = practFilter === 'all' || a.practitioner === practFilter
    return mq && mp
  })

  const monthStart = new Date(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const offset = monthStart.getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
  const now = new Date()
  const todayDay = now.getFullYear() === cursor.y && now.getMonth() === cursor.m ? now.getDate() : null

  const eventsByDay = filtered.reduce((acc, a) => {
    const d = new Date(a.starts_at)
    if (d.getFullYear() !== cursor.y || d.getMonth() !== cursor.m) return acc
    const day = d.getDate()
    const ev = {
      id: a.id,
      tone: CAL_TONE[a.color_tag] || CAL_TONE.purple,
      title: `${timeOf(a.starts_at)} ${shortName(a.patient)}`,
      sub: `${a.practitioner}  ${SESSION_LABEL[a.session_type] || a.session_type}`,
    }
    acc[day] = [...(acc[day] || []), ev]
    return acc
  }, {})

  assessmentRequests
    .filter((request) => request.status === 'scheduled' && request.scheduled_date)
    .forEach((request) => {
      const date = new Date(`${String(request.scheduled_date).slice(0, 10)}T00:00:00`)
      if (date.getFullYear() !== cursor.y || date.getMonth() !== cursor.m) return
      const day = date.getDate()
      const event = {
        id: `document-release-${request.id}`,
        tone: CAL_TONE.amber,
        title: `${fmtTime(request.scheduled_start_time)} ${shortName(request.student_name)}`,
        sub: 'Assessment document pick-up',
      }
      eventsByDay[day] = [...(eventsByDay[day] || []), event]
    })

  const list = filtered
    .filter((a) => {
      const date = new Date(a.starts_at)
      return date.getFullYear() === cursor.y && date.getMonth() === cursor.m && date.getDate() === selectedDay
    })
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .map((a) => ({
      id: a.id,
      clinic_id: a.clinic_id || null,
      clinic_code: a.clinic_code || null,
      clinic_name: a.clinic_name || null,
      patient_id: a.patient_id,
      starts_at: a.starts_at,
      time: timeOf(a.starts_at),
      name: a.patient,
      detail: `${a.practitioner} ${SESSION_LABEL[a.session_type] || a.session_type}`,
      session_type: a.session_type,
      location: a.location,
      notes: a.notes,
      practitioner: a.practitioner,
      status: a.status || 'scheduled',
      color_tag: a.color_tag,
      participants: a.participants || [],
      format: a.format || 'individual',
    }))

  const documentReleaseList = assessmentRequests
    .filter((request) => {
      const date = String(request.scheduled_date || '').slice(0, 10)
      return request.status === 'scheduled'
        && date === `${cursor.y}-${pad(cursor.m + 1)}-${pad(selectedDay)}`
    })

  const [activeTab, setActiveTab] = useState('schedule')

  const shiftMonth = (delta) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      setSelectedDay(1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  const goToday = () => {
    const n = new Date()
    setCursor({ y: n.getFullYear(), m: n.getMonth() })
    setSelectedDay(n.getDate())
  }

  return (
    <>
      <StaffHeader title="Front Desk" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="schedule-workspace">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Front Desk</h1>
          <div className="flex items-center gap-2">
            {activeTab === 'schedule' && (
              <Button
                onClick={() => setOpen(true)}
                data-onboarding-key="schedule-add-appointment"
                className="px-4 py-2"
              >
                Add Appointment
              </Button>
            )}
          </div>
        </div>
        <PageSubtitle>
          Manage the clinic master schedule and assessment document releases.
        </PageSubtitle>

        {/* Tab Toggle */}
        <div className="mx-auto mt-6 flex w-full max-w-2xl relative rounded-full border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-1 shadow-sm">
          <div
            className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-full bg-purple-800 transition-transform duration-300 ease-in-out ${
              activeTab === 'schedule' ? 'translate-x-0' : 'translate-x-full'
            }`}
          />
          <button
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-300 ${
              activeTab === 'schedule' ? 'text-white' : 'text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors'
            }`}
            onClick={() => setActiveTab('schedule')}
          >
            Clinic Master Schedule
          </button>
          <button
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-300 ${
              activeTab === 'documents' ? 'text-white' : 'text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors'
            }`}
            onClick={() => setActiveTab('documents')}
          >
            Assessment Document Releases
            {assessmentRequests.filter(r => r.status === 'pending').length > 0 && (
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-sm transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-white dark:bg-slate-900 transition-colors text-purple-800 dark:text-purple-300 transition-colors'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {assessmentRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        <div className={activeTab === 'schedule' ? 'block' : 'hidden'}>
          <section className="mt-6 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search by patient name"
                className="flex-1"
              />
              <select
                value={practFilter}
                onChange={(e) => setPractFilter(e.target.value)}
                className="h-9 rounded-md border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors"
              >
                <option value="all">All Practitioners</option>
                {practitioners.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {isSuperAdmin && branchOptions.length > 1 ? (
                <select
                  aria-label="Filter by branch"
                  value={branchFilter || 'all'}
                  onChange={(e) => setBranchFilter(e.target.value === 'all' ? '' : e.target.value)}
                  className="h-9 rounded-md border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors"
                >
                  <option value="all">All Branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{shortBranchName(b)}</option>
                  ))}
                </select>
              ) : null}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
            <section key={loading ? 'loading' : 'loaded'} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm animate-content-fade-in">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-24" rounded="rounded-lg" />
                    <Skeleton className="h-6 w-32" rounded="rounded-md" />
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" rounded="rounded-md" />
                    ))}
                    {Array.from({ length: 28 }).map((_, i) => (
                      <SkeletonCalendarDay key={i} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-purple-700">
                    <Button
                      onClick={() => shiftMonth(-1)}
                      aria-label="Previous month"
                      className="px-2 py-1 text-xs"
                    >
                      Prev
                    </Button>
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold">{monthLabel}</div>
                      <Button
                        onClick={goToday}
                        variant="secondary"
                        className="px-2 py-0.5 text-[10px]"
                      >
                        TODAY
                      </Button>
                    </div>
                    <Button
                      onClick={() => shiftMonth(1)}
                      aria-label="Next month"
                      className="px-2 py-1 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wider text-purple-700 dark:text-purple-300 transition-colors">
                    {WEEKDAYS.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {Array.from({ length: offset }).map((_, i) => (
                      <div key={`o${i}`} />
                    ))}
                    {days.map((d) => {
                      const isSelected = selectedDay === d
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedDay(d)}
                          className={`min-h-[78px] w-full text-left flex flex-col justify-start items-stretch rounded-md border p-1.5 text-[10px] transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer ${isSelected
                            ? 'border-purple-600 bg-purple-50/40 dark:bg-purple-900/40 shadow-sm ring-1 ring-purple-600'
                            : 'border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors'
                            }`}
                        >
                          <div
                            className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${d === todayDay
                              ? 'bg-purple-700 text-white'
                              : isSelected
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-slate-500 dark:text-slate-400 transition-colors'
                              }`}
                          >
                            {d}
                          </div>
                          {(eventsByDay[d] || []).map((e) => (
                            <div key={e.id} className={`mt-1 rounded px-1 py-0.5 ${e.tone}`}>
                              <div className="truncate text-[9px] font-semibold">{e.title}</div>
                              <div className="truncate text-[9px] opacity-80">{e.sub}</div>
                            </div>
                          ))}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </section>

            <aside className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">
                Schedule: {monthLabel.split(' ')[0]} {selectedDay}
              </div>
              {actionError ? (
                <div className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
                  {actionError}
                </div>
              ) : null}
              {loading ? (
                <div className="mt-3">
                  <SkeletonText lines={5} />
                </div>
              ) : (
                  <div className="mt-4 animate-content-fade-in">
                  {list.length === 0 && documentReleaseList.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
  
                      <p className="font-medium">No sessions scheduled</p>
                      <p className="text-[10px] mt-0.5">for this day</p>
                    </div>
                  ) : (
                    <div className="relative border-l border-purple-100 pl-4 space-y-5">
                      {list.map((u) => (
                        <div key={u.id} className="relative">
                          <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-purple-500 ring-4 ring-white dark:ring-slate-900" />
                          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                            {u.time}
                          </div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors mt-0.5">
                            {u.name}
                          </div>
                          {isSuperAdmin && u.clinic_name ? (
                            <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {shortBranchName({ code: u.clinic_code, name: u.clinic_name })}
                            </div>
                          ) : null}
                          <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors leading-normal">
                            {u.detail}
                          </div>
                          {u.status && u.status !== 'scheduled' ? (
                            <div className="mt-1">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[u.status] || STATUS_TONE.scheduled}`}>
                                {u.status}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-col gap-2">
                            {u.location ? (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                Room: {roomDisplayLabel(u.location)}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => setDetailAppt(u)}
                              >
                                View
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => setDeleteTarget(u)}
                                disabled={actionId === u.id}
                              >
                                {actionId === u.id ? 'Deleting…' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {documentReleaseList.map((request) => (
                        <div key={request.id} className="relative">
                          <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-500 ring-4 ring-white dark:ring-slate-900" />
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{fmtTime(request.scheduled_start_time)}</div>
                          <div className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">{request.student_name}</div>
                          <div className="text-xs leading-normal text-slate-500 dark:text-slate-400 transition-colors">Assessment document pick-up</div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-amber-700">{request.items?.length || 0} document{request.items?.length === 1 ? '' : 's'} - {request.payment_status === 'paid' ? 'Paid' : 'Payment due'}</span>
                            <span className="text-[10px] text-slate-400">{request.location || 'Clinic'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className={activeTab === 'documents' ? 'block mt-6' : 'hidden'}>
          <AssessmentDocumentReleases
            onRequestsChange={setAssessmentRequests}
            branchFilter={branchFilter}
            branchOptions={branchOptions}
            onBranchFilter={setBranchFilter}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </div>

      {open ? (
        <BookModal
          patients={patients}
          practitioners={staffList}
          appointments={appts}
          onClose={() => setOpen(false)}
          onBooked={onBooked}
          isSuperAdmin={isSuperAdmin}
          branchOptions={branchOptions}
          selectedBranchId={selectedBranchId}
          onSelectBranch={setSelectedBranchId}
          ownClinic={ownClinic}
        />
      ) : null}
      {detailAppt ? (
        <AppointmentDetailModal
          appointment={detailAppt}
          showBranch={isSuperAdmin}
          onClose={() => setDetailAppt(null)}
          onDone={() => updateAppointmentStatus(detailAppt.id, 'completed')}
          onDelete={() => setDeleteTarget(detailAppt)}
          busyId={markingDoneId}
        />
      ) : null}
      {deleteTarget ? (
        <Modal
          title="Delete Appointment"
          subtitle="This action cannot be undone"
          onClose={() => (actionId ? null : setDeleteTarget(null))}
          maxWidth="max-w-sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => setDeleteTarget(null)}
                variant="secondary"
                className="px-4 py-2"
                disabled={Boolean(actionId)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteAppointment}
                variant="danger"
                className="px-4 py-2"
                disabled={Boolean(actionId)}
              >
                {actionId ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete this appointment permanently?
          </p>
          <div className="mt-3 rounded-xl border border-purple-100 dark:border-slate-800 bg-purple-50/50 dark:bg-slate-800/50 px-4 py-3 text-sm">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {deleteTarget.name || deleteTarget.patient || 'Appointment'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {[deleteTarget.time || (deleteTarget.starts_at ? timeOf(deleteTarget.starts_at) : ''),
                deleteTarget.practitioner || '',
                SESSION_LABEL[deleteTarget.session_type] || deleteTarget.session_type || ''].filter(Boolean).join(' · ')}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

export default Schedule

