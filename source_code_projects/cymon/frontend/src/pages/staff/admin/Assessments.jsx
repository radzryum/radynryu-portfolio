import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { CalendarCheck, ChevronLeft, ChevronRight, Clock3, CreditCard, FileText, X } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import DatePicker from '../../../components/ui/DatePicker'
import { shortBranchName } from '../../../lib/branches'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'

const pad = (value) => String(value).padStart(2, '0')
const todayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const monthKey = (value) => String(value || todayKey()).slice(0, 7)
const shiftMonth = (value, amount) => {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}
const calendarModel = (value) => {
  const [year, month] = value.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const total = new Date(year, month, 0).getDate()
  return {
    label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    cells: [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: total }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`)],
  }
}
const fmtDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtTime = (value) => {
  if (!value) return '-'
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value
  return `${pad(hour % 12 || 12)}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`
}
const money = (value) => `PHP ${Number(value || 0).toFixed(2)}`

const STATUS_META = {
  pending: { label: 'Awaiting Admin Schedule', tone: 'bg-amber-100 text-amber-900' },
  scheduled: { label: 'Scheduled - Unpaid', tone: 'bg-emerald-100 text-emerald-800' },
  released: { label: 'Paid & Released', tone: 'bg-sky-100 text-sky-800' },
  declined: { label: 'Declined', tone: 'bg-rose-100 text-rose-800' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${meta.tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{meta.label}</span>
}

function ReviewModal({ request, onClose, onSaved }) {
  const [date, setDate] = useState(request?.scheduled_date || todayKey())
  const [start, setStart] = useState(request?.scheduled_start_time?.slice(0, 5) || '09:00')
  const [end, setEnd] = useState(request?.scheduled_end_time?.slice(0, 5) || '10:00')
  const [location, setLocation] = useState(request?.location || 'Main Clinic Cashier / Reception')
  const [fees, setFees] = useState(() => Object.fromEntries((request?.items || []).map((item) => [item.id, Number(item.fee || 0).toFixed(2)])))
  const [busy, setBusy] = useState(false)
  const total = (request?.items || []).reduce((sum, item) => sum + (Number(fees[item.id]) || 0), 0)

  if (!request) return null
  const save = async () => {
    setBusy(true)
    try {
      const data = await api.admin.scheduleAssessmentDocumentRelease(request.id, {
        status: 'scheduled',
        scheduled_date: date,
        scheduled_start_time: start,
        scheduled_end_time: end,
        location,
        items: request.items.map((item) => ({ id: item.id, fee: Number(fees[item.id]) || 0 })),
      })
      toast.success('Pick-up schedule sent to the client.')
      onSaved(data.request)
    } catch (error) {
      toast.error(error.message || 'Unable to schedule this request.')
    } finally {
      setBusy(false)
    }
  }
  const decline = async () => {
    setBusy(true)
    try {
      const data = await api.admin.scheduleAssessmentDocumentRelease(request.id, { status: 'declined' })
      toast.success('Document request declined.')
      onSaved(data.request)
    } catch (error) {
      toast.error(error.message || 'Unable to decline this request.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 transition-colors p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Schedule and price document release" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 transition-colors pb-3"><div><h2 className="text-sm font-bold text-slate-900">Schedule &amp; Pricing Review</h2><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Set the clinic slot and confirm the fee for each document.</p></div><button type="button" onClick={onClose} aria-label="Close review" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-purple-50 p-3"><div><div className="text-sm font-bold text-purple-950">{request.student_name}</div><div className="text-[11px] text-purple-700">Student ID: {request.patient_identifier || '-'}</div></div><StatusBadge status={request.status} /></div>
      <div className="mt-4 space-y-2"><p className="text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors">Requested Documents &amp; Fee Breakdown</p>{request.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 transition-colors">{item.title}</p><p className="text-[10px] text-purple-700">{item.document_type_code || 'Assessment document'}</p></div><label className="flex w-28 shrink-0 items-center gap-1 rounded border border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors px-2 py-1"><span className="text-[10px] font-bold text-slate-400">PHP</span><input type="number" min="0" step="0.01" value={fees[item.id]} onChange={(event) => setFees((current) => ({ ...current, [item.id]: event.target.value }))} className="w-full bg-transparent text-right text-xs font-bold text-emerald-700 outline-none" aria-label={`Fee for ${item.title}`} /></label></div>)}<div className="flex justify-between border-t border-slate-100 dark:border-slate-800 transition-colors pt-2 text-xs font-bold"><span>Total Payable Amount</span><span className="text-emerald-700">{money(total)}</span></div></div>
      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 transition-colors pt-4"><p className="mb-2 text-xs font-bold text-purple-950">Admin Assigned Pick-Up Slot</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Visit Date<DatePicker min={todayKey()} disabledDays={[0]} value={date} onChange={(v) => setDate(v)} className="mt-1" ariaLabel="Visit date" /><span className="mt-1 block font-normal text-slate-400 dark:text-slate-500">Closed on Sundays.</span></label><label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Start Time<select value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500">{['09:00', '10:30', '13:30', '15:00', '16:00'].map((value) => <option key={value} value={value}>{fmtTime(value)}</option>)}</select></label><label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">End Time<select value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500">{['10:00', '11:30', '14:30', '16:00', '17:00'].map((value) => <option key={value} value={value}>{fmtTime(value)}</option>)}</select></label></div><label className="mt-3 block text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Location<input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500" /></label></div>
      <div className="mt-5 flex gap-2 border-t border-slate-100 dark:border-slate-800 transition-colors pt-3"><button type="button" disabled={busy} onClick={decline} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Decline</button><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors">Cancel</button><button type="button" disabled={busy} onClick={save} className="flex-1 rounded-xl bg-purple-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-800 disabled:opacity-50">{busy ? 'Saving...' : 'Accept & Notify Client'}</button></div>
    </div>
  </div>
}

function ReleaseModal({ request, onClose, onSaved }) {
  const [method, setMethod] = useState('cash')
  const [busy, setBusy] = useState(false)
  if (!request) return null
  const save = async () => {
    setBusy(true)
    try {
      const data = await api.admin.releaseAssessmentDocuments(request.id, method)
      toast.success('Payment recorded and documents released.')
      onSaved(data.request)
    } catch (error) {
      toast.error(error.message || 'Unable to release documents.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}><div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 transition-colors p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Record payment and release documents" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Pay &amp; Release Documents</h2><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Record the counter payment before handing over the documents.</p></div><button type="button" onClick={onClose} aria-label="Close payment dialog" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div><div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs font-semibold text-emerald-900">{request.student_name}</div><div className="mt-1 text-[11px] text-emerald-800">{request.items.length} document{request.items.length === 1 ? '' : 's'} - Total due <strong>{money(request.total_amount)}</strong></div></div><label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors">Payment Method<select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2.5 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="gotyme">GoTyme</option><option value="maribank">MariBank</option></select></label><div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors">Cancel</button><button type="button" disabled={busy} onClick={save} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Saving...' : 'Confirm & Release'}</button></div></div></div>
}

function Assessments() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [requests, setRequests] = useState([])
  const [counts, setCounts] = useState({ pending: 0, scheduled: 0, awaitingPayment: 0, released: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(monthKey(todayKey()))
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [reviewRequest, setReviewRequest] = useState(null)
  const [releaseRequest, setReleaseRequest] = useState(null)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])

  const load = async (branch = branchFilter) => {
    setError('')
    try {
      const data = await api.admin.assessmentDocumentReleases(branch)
      setRequests(data.requests || [])
      setCounts(data.counts || counts)
    } catch (err) {
      setError(err.message || 'Unable to load document release requests.')
    } finally {
      setLoading(false)
    }
  }

  // Live-refresh when a client files a request or another admin schedules.
  // Items carry no clinic_id, so they ride unfiltered (RLS gates events).
  const releaseScope = branchFilter || profile?.clinic_id || ''
  const releaseSubs = releaseScope
    ? [
      { table: 'assessment_document_release_requests', filter: `clinic_id=eq.${releaseScope}` },
      { table: 'assessment_document_release_items' },
    ]
    : (isSuperAdmin
      ? [{ table: 'assessment_document_release_requests' }, { table: 'assessment_document_release_items' }]
      : [])
  useRealtimeRefresh(profile?.id, releaseSubs, () => {
    load()
  })
  useEffect(() => {
    let active = true
    setLoading(true)
    api.admin.assessmentDocumentReleases(branchFilter)
      .then((data) => {
        if (!active) return
        setRequests(data.requests || [])
        setCounts(data.counts || { pending: 0, scheduled: 0, awaitingPayment: 0, released: 0 })
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load document release requests.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [branchFilter])

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = requests.filter((request) => request.status === 'pending')
  const scheduled = requests.filter((request) => request.status === 'scheduled')
  const dayRequests = scheduled.filter((request) => request.scheduled_date === selectedDate)
  const calendar = calendarModel(month)
  const replaceRequest = (request) => {
    setReviewRequest(null)
    setReleaseRequest(null)
    setRequests((current) => current.map((item) => item.id === request.id ? request : item))
    load()
  }

 return <div className="flex min-h-0 flex-1 flex-col font-sans"><StaffHeader title="Assessment Services" /><main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors/50 p-4 sm:p-6 lg:p-7"><div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Assessment Services</h1><PageSubtitle>Appointments and pending assessment document releases.</PageSubtitle></div>{isSuperAdmin && branchOptions.length > 1 ? (<select aria-label="Filter by branch" value={branchFilter || 'all'} onChange={(event) => setBranchFilter(event.target.value === 'all' ? '' : event.target.value)} className="h-9 rounded-md border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors"><option value="all">All Branches</option>{branchOptions.map((b) => (<option key={b.id} value={b.id}>{shortBranchName(b)}</option>))}</select>) : null}</div>
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div> : null}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Pending Requests</div><div className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{counts.pending}</div></div><div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Scheduled Visits</div><div className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{counts.scheduled}</div></div><div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Awaiting Payment</div><div className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{counts.awaitingPayment}</div></div><div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Released</div><div className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100 transition-colors">{counts.released}</div></div></div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm xl:col-span-2 sm:p-5"><div className="mb-5 flex items-center justify-between"><button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="rounded-lg p-2 text-purple-700 hover:bg-purple-50"><ChevronLeft size={17} /></button><h2 className="text-sm font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 transition-colors">{calendar.label}</h2><div className="flex items-center gap-1"><button type="button" onClick={() => { setMonth(monthKey(todayKey())); setSelectedDate(todayKey()) }} className="rounded-lg border border-purple-200 dark:border-slate-700 transition-colors px-2.5 py-1.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-50">Today</button><button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="rounded-lg p-2 text-purple-700 hover:bg-purple-50"><ChevronRight size={17} /></button></div></div><div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-400">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1.5">{calendar.cells.map((date, index) => { if (!date) return <span key={`empty-${index}`} className="min-h-20 rounded-lg bg-slate-50 dark:bg-slate-950 transition-colors/40" />; const events = scheduled.filter((request) => request.scheduled_date === date); const selected = date === selectedDate; return <button key={date} type="button" onClick={() => setSelectedDate(date)} className={`min-h-20 rounded-lg border p-1.5 text-left transition-colors ${selected ? 'border-2 border-purple-600 bg-purple-50' : 'border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors hover:border-purple-200 dark:border-slate-700 transition-colors hover:bg-purple-50/40'}`}><span className={`text-[11px] font-bold ${selected ? 'text-purple-900' : 'text-slate-600 dark:text-slate-300 transition-colors'}`}>{Number(date.slice(-2))}</span><div className="mt-1 space-y-1">{events.slice(0, 2).map((request) => <div key={request.id} className="truncate rounded border-l-2 border-amber-500 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-900">{request.student_name}</div>)}{events.length > 2 ? <div className="text-[9px] text-slate-400">+{events.length - 2} more</div> : null}</div></button> })}</div></section>

    <section className="flex flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 transition-colors pb-3"><div><h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors">Schedule: {fmtDate(selectedDate)}</h2><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{dayRequests.length} document release{dayRequests.length === 1 ? '' : 's'}</p></div><Clock3 size={17} className="text-purple-700" /></div><div className="flex-1 space-y-3 overflow-y-auto">{dayRequests.length === 0 ? <div className="py-12 text-center text-xs text-slate-400"><CalendarCheck size={25} className="mx-auto mb-2 text-slate-300" /><p>No document releases scheduled for this date.</p></div> : dayRequests.map((request) => <article key={request.id} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3"><div className="flex items-start justify-between gap-2"><StatusBadge status={request.status} /><span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors">{fmtTime(request.scheduled_start_time)} - {fmtTime(request.scheduled_end_time)}</span></div><div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">{request.student_name}</h3>{isSuperAdmin && request.clinic_name ? (<span className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{shortBranchName({ code: request.clinic_code, name: request.clinic_name })}</span>) : null}<div className="mt-1 space-y-0.5 text-[10px] text-purple-900">{request.items.map((item) => <p key={item.id} className="truncate">{item.title}</p>)}</div></div><div className="flex items-center justify-between border-t border-amber-200 pt-2"><span className="text-xs font-bold text-amber-900">Due: {money(request.total_amount)}</span><button type="button" onClick={() => setReleaseRequest(request)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-700"><CreditCard size={12} /> Pay &amp; Release</button></div></article>)}</div></section></div>

    <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors">Client Document Requests</h2><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Review the requested bundle, set fees, and assign a clinic slot.</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">{pending.length} pending</span></div>{loading ? <Skeleton className="h-24 w-full" rounded="rounded-xl" /> : pending.length === 0 ? <div className="rounded-xl border border-dashed border-purple-200 dark:border-slate-700 transition-colors px-4 py-8 text-center text-xs text-slate-400"><FileText size={24} className="mx-auto mb-2 text-slate-300" />No pending document pick-up requests.</div> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{pending.map((request) => <article key={request.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">{request.student_name}</h3>{isSuperAdmin && request.clinic_name ? (<span className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{shortBranchName({ code: request.clinic_code, name: request.clinic_name })}</span>) : null}<p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Student ID: {request.patient_identifier || '-'} - Requested {fmtDate(request.requested_at)}</p></div><StatusBadge status={request.status} /></div><div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors p-3"><div className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors">Requested Assessment Files</div>{request.items.map((item) => <div key={item.id} className="flex justify-between gap-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 transition-colors"><span className="truncate">{item.title} <span className="text-[10px] text-purple-400">({item.document_type_code || 'Assessment'})</span></span><span className="shrink-0 font-semibold text-slate-500 dark:text-slate-400 transition-colors">Fee pending</span></div>)}</div><button type="button" onClick={() => setReviewRequest(request)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-800"><CalendarCheck size={14} /> Set Schedule &amp; Review Price</button></article>)}</div>}</section>
    </div></main><ReviewModal request={reviewRequest} onClose={() => setReviewRequest(null)} onSaved={replaceRequest} /><ReleaseModal request={releaseRequest} onClose={() => setReleaseRequest(null)} onSaved={replaceRequest} /></div>
}

export default Assessments
