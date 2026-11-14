import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../../../auth/AuthContext'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { shortBranchName } from '../../../lib/branches'
import { toast } from 'react-hot-toast'
import { CalendarCheck, CheckCircle, CreditCard, FileText, ShieldCheck, Store, X } from 'lucide-react'
import { SkeletonCard } from '../../../components/ui/Skeleton'
import DatePicker from '../../../components/ui/DatePicker'
import { api } from '../../../lib/api'

const pad = (value) => String(value).padStart(2, '0')
const todayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const fmtDate = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '-'
const fmtTime = (value) => {
  if (!value) return '-'
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value
  return `${pad(hour % 12 || 12)}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`
}
const money = (value) => `PHP ${Number(value || 0).toFixed(2)}`

const STATUS_META = {
  pending: { label: 'Awaiting Admin Schedule', tone: 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 transition-colors' },
  scheduled: { label: 'Scheduled', tone: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 transition-colors' },
  released: { label: 'Paid & Released', tone: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 transition-colors' },
  declined: { label: 'Declined', tone: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 transition-colors' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 transition-colors' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${meta.tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

/** Small badge showing whether the client chose Pay Onsite or Pay Online */
function PaymentPreferenceBadge({ preference }) {
  if (preference === 'online') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/50 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200 transition-colors">
        <CreditCard size={9} /> Pay Online
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 transition-colors bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-200 transition-colors">
      <Store size={9} /> Pay Onsite
    </span>
  )
}

function ReviewModal({ request, onClose, onSaved }) {
  const [date, setDate] = useState(request?.scheduled_date || todayKey())
  const [start, setStart] = useState(request?.scheduled_start_time?.slice(0, 5) || '09:00')
  const [end, setEnd] = useState(request?.scheduled_end_time?.slice(0, 5) || '10:00')
  const [location, setLocation] = useState(request?.location || 'Main Clinic Cashier / Reception')
  const [adminNote, setAdminNote] = useState(request?.admin_note || '')
  const [fees, setFees] = useState(() => Object.fromEntries((request?.items || []).map((item) => [item.id, Number(item.fee || 0).toFixed(2)])))
  const [busy, setBusy] = useState(false)
  const total = (request?.items || []).reduce((sum, item) => sum + (Number(fees[item.id]) || 0), 0)
  const isScheduled = request?.status === 'scheduled'
  // Once the client paid online, the charged amount is locked — never re-price it.
  const paidRequest = request?.payment_status === 'paid'

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
        admin_note: adminNote.trim() || null,
        items: request.items.map((item) => ({ id: item.id, fee: Number(fees[item.id]) || 0 })),
      })
      toast.success(isScheduled ? 'Pick-up schedule update sent to the client.' : 'Pick-up schedule sent to the client.')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 transition-colors p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Schedule and price document release" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 transition-colors pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{isScheduled ? 'Update Pick-Up Schedule' : 'Schedule & Pricing Review'}</h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">{isScheduled ? 'Update the clinic slot or add a notice for the client.' : 'Set the clinic slot and confirm the fee for each document.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close review" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-purple-50 dark:bg-purple-900/30 transition-colors p-3">
          <div>
            <div className="text-sm font-bold text-purple-950 dark:text-purple-100 transition-colors">{request.student_name}</div>
            <div className="text-[11px] text-purple-700 dark:text-purple-300 transition-colors">Student ID: {request.patient_identifier || '-'}</div>
          </div>
          <div className="flex items-center gap-2">
            <PaymentPreferenceBadge preference={request.payment_preference} />
            <StatusBadge status={request.status} />
          </div>
        </div>

        {/* Payment preference info */}
        {request.payment_preference === 'online' && (
          <div className="mt-3 rounded-xl border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-900/30 transition-colors p-3 text-[11px] leading-relaxed text-sky-800 dark:text-sky-200">
            <span className="font-bold">Online Payment Selected:</span> After you save the schedule, the client will receive a Pay Now button in their portal to complete payment via PayMongo before the pick-up date.
          </div>
        )}

        {/* Reason for Requesting Copy */}
        {request.client_reason ? (
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 p-3 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 transition-colors">
            <span className="font-bold">Reason for Request:</span> {request.client_reason}
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors">Requested Documents &amp; Fee Breakdown</p>
          {paidRequest ? (
            <div className="rounded-lg border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-900/30 transition-colors px-3 py-2 text-[11px] text-sky-800 dark:text-sky-200">This request was already paid online. The amount is locked and cannot be changed.</div>
          ) : null}
          {request.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2">
              <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 transition-colors">{item.title}</p><p className="text-[10px] text-purple-700">{item.document_type_code || 'Assessment document'}</p></div>
              <label className="flex w-28 shrink-0 items-center gap-1 rounded border border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors px-2 py-1"><span className="text-[10px] font-bold text-slate-400">PHP</span><input type="number" min="0" step="0.01" value={fees[item.id]} onChange={(event) => setFees((current) => ({ ...current, [item.id]: event.target.value }))} disabled={paidRequest} className="w-full bg-transparent text-right text-xs font-bold text-emerald-700 outline-none disabled:bg-transparent" aria-label={`Fee for ${item.title}`} /></label>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 transition-colors pt-2 text-xs font-bold text-slate-800 dark:text-slate-200"><span>Total Payable Amount</span><span className="text-emerald-700 dark:text-emerald-400 transition-colors">{money(total)}</span></div>
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 transition-colors pt-4">
          <p className="mb-2 text-xs font-bold text-purple-950 dark:text-purple-200 transition-colors">Admin Assigned Pick-Up Slot</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Visit Date<DatePicker min={todayKey()} disabledDays={[0]} value={date} onChange={(v) => setDate(v)} className="mt-1" ariaLabel="Visit date" /><span className="mt-1 block font-normal text-slate-400 dark:text-slate-500">Closed on Sundays.</span></label>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Start Time<select value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500">{['09:00', '10:30', '13:30', '15:00', '16:00'].map((value) => <option key={value} value={value}>{fmtTime(value)}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">End Time<select value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500">{['10:00', '11:30', '14:30', '16:00', '17:00'].map((value) => <option key={value} value={value}>{fmtTime(value)}</option>)}</select></label>
          </div>
          <label className="mt-3 block text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Location<input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500" /></label>
          <label className="mt-3 block text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors">Clinic Notice / Working Hours Update<textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="Example: Due to the storm, clinic hours are moved to 1:00 PM - 5:00 PM." className="mt-1 w-full resize-none rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500" /></label>
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-100 dark:border-slate-800 transition-colors pt-3">
          {!isScheduled ? <button type="button" disabled={busy} onClick={decline} className="rounded-xl border border-rose-200 dark:border-rose-800/60 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50">Decline</button> : null}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors">Cancel</button>
          <button type="button" disabled={busy} onClick={save} className="flex-1 rounded-xl bg-purple-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-800 disabled:opacity-50">{busy ? 'Saving...' : isScheduled ? 'Save & Notify Client' : 'Accept & Notify Client'}</button>
        </div>
      </div>
    </div>
  )
}

function ReleaseModal({ request, onClose, onSaved }) {
  const [method, setMethod] = useState('cash')
  const [busy, setBusy] = useState(false)
  if (!request) return null

  const isAlreadyPaidOnline = request.payment_status === 'paid' && request.payment_method === 'paymongo'
  const isOnlinePreference = request.payment_preference === 'online'

  const save = async () => {
    setBusy(true)
    try {
      // If already paid online, pass null/empty — backend will use DB value
      const paymentMethod = isAlreadyPaidOnline ? 'paymongo' : method
      const data = await api.admin.releaseAssessmentDocuments(request.id, paymentMethod)
      toast.success(isAlreadyPaidOnline ? 'Documents released. Payment was already confirmed online.' : 'Payment recorded and documents released.')
      onSaved(data.request)
    } catch (error) {
      toast.error(error.message || 'Unable to release documents.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 transition-colors p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Record payment and release documents" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isAlreadyPaidOnline ? 'Release Documents' : 'Pay & Release Documents'}
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
              {isAlreadyPaidOnline
                ? 'Online payment has been confirmed. Hand over the documents to the client.'
                : 'Record the counter payment before handing over the documents.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close payment dialog" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/30 transition-colors p-3">
          <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 transition-colors">{request.student_name}</div>
          <div className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300 transition-colors">
            {request.items.length} document{request.items.length === 1 ? '' : 's'} — Total: <strong>{money(request.total_amount)}</strong>
          </div>
          <div className="mt-2">
            <PaymentPreferenceBadge preference={request.payment_preference} />
          </div>
        </div>

        {/* Online paid confirmation */}
        {isAlreadyPaidOnline ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/30 transition-colors p-3 text-[11px] text-emerald-900 dark:text-emerald-200">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <p><span className="font-bold">Payment Confirmed via PayMongo.</span> The client has already paid online. No counter payment is needed — simply hand over the documents.</p>
          </div>
        ) : isOnlinePreference ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 transition-colors p-3 text-[11px] text-amber-900 dark:text-amber-200">
            <CreditCard size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500" />
            <p><span className="font-bold">Online payment not yet confirmed.</span> The client has not completed their online payment yet. If collecting payment in-person, select a method below.</p>
          </div>
        ) : null}

        {/* Payment method selector — only shown for onsite or unpaid online */}
        {!isAlreadyPaidOnline && (
          <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors">
            {isOnlinePreference ? 'Override: Collect Payment In-Person' : 'Payment Method'}
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors p-2.5 text-xs text-slate-800 dark:text-slate-100 transition-colors outline-none focus:border-purple-500">
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="gotyme">GoTyme</option>
              <option value="maribank">MariBank</option>
            </select>
          </label>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${isAlreadyPaidOnline ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {busy ? 'Saving...' : isAlreadyPaidOnline ? <><CheckCircle size={13} /> Confirm Release</> : 'Confirm & Release'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssessmentDocumentReleases({ onRequestsChange, branchFilter = '', branchOptions = [], onBranchFilter, isSuperAdmin }) {
  // No useAuth here (this section also renders embedded in Schedule) — read
  // the context directly so a missing provider yields null instead of throwing.
  const { profile } = useContext(AuthContext) || {}
  const [requests, setRequests] = useState([])
  const [counts, setCounts] = useState({ pending: 0, scheduled: 0, awaitingPayment: 0, released: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewRequest, setReviewRequest] = useState(null)
  const [releaseRequest, setReleaseRequest] = useState(null)

  const load = async (branch = branchFilter) => {
    setError('')
    try {
      const data = await api.admin.assessmentDocumentReleases(branch)
      const nextRequests = data.requests || []
      setRequests(nextRequests)
      onRequestsChange?.(nextRequests)
      setCounts(data.counts || { pending: 0, scheduled: 0, awaitingPayment: 0, released: 0 })
    } catch (err) {
      setError(err.message || 'Unable to load document release requests.')
    } finally {
      setLoading(false)
    }
  }

  // Live-refresh when a client files a request or another admin schedules.
  // Items carry no clinic_id, so they ride unfiltered (RLS gates events).
  const docReleaseScope = branchFilter || profile?.clinic_id || ''
  const docReleaseSubs = docReleaseScope
    ? [
      { table: 'assessment_document_release_requests', filter: `clinic_id=eq.${docReleaseScope}` },
      { table: 'assessment_document_release_items' },
    ]
    : (isSuperAdmin
      ? [{ table: 'assessment_document_release_requests' }, { table: 'assessment_document_release_items' }]
      : [])
  useRealtimeRefresh(profile?.id, docReleaseSubs, () => {
    load()
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    api.admin.assessmentDocumentReleases(branchFilter)
      .then((data) => {
        if (!active) return
        const nextRequests = data.requests || []
        setRequests(nextRequests)
        onRequestsChange?.(nextRequests)
        setCounts(data.counts || { pending: 0, scheduled: 0, awaitingPayment: 0, released: 0 })
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load document release requests.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [onRequestsChange, branchFilter])

  const pending = requests.filter((request) => request.status === 'pending')
  const scheduled = requests.filter((request) => request.status === 'scheduled')
  const saveRequest = async () => {
    setReviewRequest(null)
    setReleaseRequest(null)
    await load()
  }

  return (
    <section className="mt-4 flex flex-col gap-6 rounded-[2rem] bg-white dark:bg-slate-900 transition-colors p-5 shadow-xl shadow-purple-900/5 ring-1 ring-purple-100 sm:p-8 relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-100/50 blur-[80px]" />
      
      <div className="relative flex flex-col justify-between gap-4 border-b border-purple-50 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 shadow-sm transition-colors">
              <FileText size={18} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-purple-950 dark:text-purple-100 transition-colors">Assessment Document Releases</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 transition-colors">Review client requests, assign pick-up slots, and record payment.</p>
            </div>
          </div>
        </div>
        {/* Status pill + branch filter grouped as one control cluster so the
            pill never floats alone in the middle of the header. */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100 shadow-sm transition-colors">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            {counts.pending} pending request{counts.pending === 1 ? '' : 's'}
          </span>
          {isSuperAdmin && branchOptions.length > 1 && onBranchFilter ? (
            <select
              aria-label="Filter by branch"
              value={branchFilter || 'all'}
              onChange={(e) => onBranchFilter(e.target.value === 'all' ? '' : e.target.value)}
              className="h-9 rounded-md border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-slate-100 transition-colors"
            >
              <option value="all">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{shortBranchName(b)}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div> : null}
      
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 relative">
        {[
          ['Pending Requests', counts.pending, 'from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40', 'border-amber-100 dark:border-amber-800', 'text-amber-700 dark:text-amber-400', 'text-amber-900 dark:text-amber-100'],
          ['Scheduled Visits', counts.scheduled, 'from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40', 'border-emerald-100 dark:border-emerald-800', 'text-emerald-700 dark:text-emerald-400', 'text-emerald-900 dark:text-emerald-100'],
          ['Awaiting Payment', counts.awaitingPayment, 'from-purple-50 to-fuchsia-50 dark:from-purple-900/40 dark:to-fuchsia-900/40', 'border-purple-100 dark:border-purple-800', 'text-purple-700 dark:text-purple-400', 'text-purple-900 dark:text-purple-100'],
          ['Released', counts.released, 'from-sky-50 to-blue-50 dark:from-sky-900/40 dark:to-blue-900/40', 'border-sky-100 dark:border-sky-800', 'text-sky-700 dark:text-sky-400', 'text-sky-900 dark:text-sky-100']
        ].map(([label, value, bgTone, borderTone, iconTone, textTone]) => (
          <div key={label} className={`relative overflow-hidden rounded-2xl border ${borderTone} bg-gradient-to-br ${bgTone} p-4 shadow-sm transition-transform hover:-translate-y-0.5`}>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${iconTone}`}>{label}</div>
            <div className={`mt-2 text-3xl font-black tracking-tighter ${textTone}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-8 xl:grid-cols-2 relative">
        {/* Pending requests */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">Client Document Requests</h3>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-200 transition-colors">Needs scheduling</span>
          </div>
          {loading ? <SkeletonCard lines={3} /> : pending.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors/50 py-12 text-center animate-content-fade-in">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-900 transition-colors shadow-sm ring-1 ring-slate-100">
                <FileText size={20} className="text-slate-300" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors">No pending requests</p>
              <p className="mt-1 text-[10px] text-slate-400">New document pick-up requests will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-content-fade-in">
              {pending.map((request) => (
                <article key={request.id} className="group rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm transition-all hover:border-purple-200 dark:border-slate-700 transition-colors hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{request.student_name}</h4>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 transition-colors">ID: {request.patient_identifier || '-'} — Requested {fmtDate(request.requested_at)}</p>
                      {isSuperAdmin && request.clinic_name ? (
                        <span className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {shortBranchName({ code: request.clinic_code, name: request.clinic_name })}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={request.status} />
                      <PaymentPreferenceBadge preference={request.payment_preference} />
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-50 bg-slate-50 dark:bg-slate-950 transition-colors/50 p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Requested Files</div>
                    <div className="space-y-1.5">
                      {request.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-colors">
                          <span className="truncate">{item.title} <span className="text-slate-400">({item.document_type_code || 'Assessment'})</span></span>
                          <span className="shrink-0 text-amber-600">Fee pending</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => setReviewRequest(request)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-purple-700 hover:shadow active:scale-[0.98]">
                    <CalendarCheck size={14} /> Set Schedule &amp; Review Price
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled pick-ups */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">Scheduled Document Pick-Ups</h3>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-200 transition-colors">Awaiting release</span>
          </div>
          {loading ? <SkeletonCard lines={3} /> : scheduled.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors/50 py-12 text-center animate-content-fade-in">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-900 transition-colors shadow-sm ring-1 ring-slate-100">
                <CalendarCheck size={20} className="text-slate-300" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors">No scheduled pick-ups</p>
              <p className="mt-1 text-[10px] text-slate-400">Assigned pick-up slots will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-content-fade-in">
              {scheduled.map((request) => {
                const paidOnline = request.payment_status === 'paid' && request.payment_method === 'paymongo'
                return (
                  <article key={request.id} className={`group rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${paidOnline ? 'border-sky-100 bg-sky-50/30 hover:border-sky-200 dark:border-sky-800 dark:bg-sky-900/20 dark:hover:border-sky-700' : 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-200 dark:border-emerald-800 dark:bg-emerald-900/20 dark:hover:border-emerald-700'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{request.student_name}</h4>
                        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors">{fmtDate(request.scheduled_date)} — {fmtTime(request.scheduled_start_time)} to {fmtTime(request.scheduled_end_time)}</p>
                        {isSuperAdmin && request.clinic_name ? (
                          <span className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            {shortBranchName({ code: request.clinic_code, name: request.clinic_name })}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusBadge status={request.status} />
                        <PaymentPreferenceBadge preference={request.payment_preference} />
                      </div>
                    </div>

                    {paidOnline && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-200/60 bg-sky-100/50 px-3 py-2.5 text-[11px] font-bold text-sky-900">
                        <ShieldCheck size={14} className="text-sky-600" />
                        Payment confirmed via PayMongo — ready to release
                      </div>
                    )}

                    {request.admin_note ? (
                      <div className="mt-3 rounded-xl border border-amber-200/60 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/30 px-3 py-2.5 text-[11px] text-amber-900 dark:text-amber-200 transition-colors">
                        <span className="font-bold">Clinic notice:</span> {request.admin_note}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 transition-colors/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100 transition-colors">Due: <span className="text-emerald-700">{money(request.total_amount)}</span></div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setReviewRequest(request)} className="flex items-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors transition-colors hover:border-purple-300 hover:text-purple-700 active:scale-95">
                          <CalendarCheck size={12} /> Update
                        </button>
                        <button
                          type="button"
                          onClick={() => setReleaseRequest(request)}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${paidOnline ? 'bg-sky-600 hover:bg-sky-700 hover:shadow' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow'}`}
                        >
                          {paidOnline ? <><ShieldCheck size={13} /> Release Docs</> : <><CreditCard size={13} /> Pay &amp; Release</>}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ReviewModal key={reviewRequest?.id ?? 'closed'} request={reviewRequest} onClose={() => setReviewRequest(null)} onSaved={saveRequest} />
      <ReleaseModal request={releaseRequest} onClose={() => setReleaseRequest(null)} onSaved={saveRequest} />
    </section>
  )
}

export default AssessmentDocumentReleases
