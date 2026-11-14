import { useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { CalendarCheck, CalendarDays, CheckCircle2, ChevronDown, Clock3, CreditCard, Download, ExternalLink, FileText, GraduationCap, Loader2, NotebookPen, ShieldCheck, Store, X } from 'lucide-react'
import PageHeader from './PageHeader'
import PageIntro from '../../components/ui/PageIntro'
import Checkbox from '../../components/ui/Checkbox'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Skeleton, { SkeletonTableRow } from '../../components/ui/Skeleton'
import { api, saveBlob } from '../../lib/api'
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh'
import { AuthContext } from '../../auth/AuthContext'

const COMPLETED_STATUSES = new Set(['scored', 'approved', 'finalized'])

const fmtDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  : '-')

const fmtLongDate = (value) => (value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  : '-')

const fmtTime = (value) => {
  if (!value) return '-'
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`
}

const money = (value) => `PHP ${Number(value || 0).toFixed(2)}`
const recordKey = (record) => `${record.sourceTable}:${record.id}`

// ---------------------------------------------------------------------------
// ReleaseStatus badge
// ---------------------------------------------------------------------------
function ReleaseStatus({ release, assessmentStatus }) {
  if (!release) {
    if (!assessmentStatus) {
      return <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 transition-colors">Not Administered</span>
    }
    const pending = ['submitted', 'ready_for_review'].includes(assessmentStatus)
    const inProgress = ['draft', 'assigned', 'in_progress'].includes(assessmentStatus)
    const label = pending ? 'Pending Approval' : inProgress ? 'In Progress' : 'Completed'
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${pending ? 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/30 dark:text-sky-300' : inProgress ? 'border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800/50 dark:bg-purple-900/30 dark:text-purple-300' : 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800/50 dark:bg-purple-900/30 dark:text-purple-300'}`}>{label}</span>
  }
  const status = release.status === 'scheduled'
    ? { label: 'Ready for Pick-Up', tone: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300' }
    : release.status === 'released'
      ? { label: 'Released', tone: 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/30 dark:text-sky-300' }
      : release.status === 'declined'
        ? { label: 'Request Declined', tone: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/30 dark:text-rose-300' }
        : { label: 'Request Pending', tone: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300' }
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.tone}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {status.label}
  </span>
}

// ---------------------------------------------------------------------------
// Payment method choice modal — shown when the patient clicks "Request"
// ---------------------------------------------------------------------------
function PaymentMethodModal({ open, onClose, onConfirm, busy, isReRequest }) {
  const [choice, setChoice] = useState('onsite')
  const [reason, setReason] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 dark:border dark:border-slate-800 p-6 shadow-2xl transition-colors duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Choose payment method"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Choose Payment Method</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              How would you like to settle the document release fee?
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Choices */}
        <div className="space-y-3">
          {/* Pay Onsite */}
          <button
            type="button"
            onClick={() => setChoice('onsite')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              choice === 'onsite'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50/40 dark:hover:bg-purple-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${choice === 'onsite' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                <Store size={17} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold transition-colors ${choice === 'onsite' ? 'text-purple-900 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}>Pay Onsite</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">Pay cash, GCash, Maya, GoTyme, or MariBank at the clinic cashier on your scheduled pick-up date.</p>
              </div>
              <div className={`ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${choice === 'onsite' ? 'border-purple-600 bg-purple-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`} />
            </div>
          </button>

          {/* Pay Online */}
          <button
            type="button"
            onClick={() => setChoice('online')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              choice === 'online'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${choice === 'online' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                <CreditCard size={17} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold transition-colors ${choice === 'online' ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>Pay Online</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Pay securely via PayMongo (card, GCash, PayMaya, GrabPay) after the clinic sets your schedule.
                </p>
              </div>
              <div className={`ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${choice === 'online' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`} />
            </div>
          </button>
        </div>

        {/* Note */}
        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 p-3">
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            <span className="font-bold">Note:</span>{' '}
            {choice === 'online'
              ? 'You will be redirected to the PayMongo payment page after the clinic approves and schedules your request.'
              : 'Your payment will remain pending until a staff member confirms and records it at the clinic.'}
          </p>
        </div>

        {/* Reason for Request (Shown if ANY selected record is a re-request) */}
        {isReRequest ? (
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Reason for Requesting Copy <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please specify why you need another copy (e.g., lost original, needed for a new school)..."
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500"
            />
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (isReRequest && !reason.trim())}
            onClick={() => onConfirm(choice, reason)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60 ${
              choice === 'online'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-purple-700 hover:bg-purple-800'
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? 'Sending...' : 'Confirm & Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pay Now button — redirects to PayMongo checkout
// ---------------------------------------------------------------------------
function PayNowButton({ request, onSuccess }) {
  const [loading, setLoading] = useState(false)

  const handlePayNow = async () => {
    setLoading(true)
    try {
      const { checkout_url } = await api.payments.createCheckout(request.id)
      if (checkout_url) {
        window.location.href = checkout_url
      } else {
        toast.error('Unable to create payment session. Please try again.')
      }
    } catch (err) {
      toast.error(err.message || 'Unable to initiate online payment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handlePayNow}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
      {loading ? 'Redirecting...' : 'Pay Now Online'}
      {!loading && <ExternalLink size={12} className="opacity-70" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pick-up slip modal
// ---------------------------------------------------------------------------
function PickUpSlip({ request, onClose, onDownload, downloading }) {
  if (!request) return null
  const isPaidOnline = request.payment_method === 'paymongo'
  const isPaid = request.payment_status === 'paid'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl transition-colors" role="dialog" aria-modal="true" aria-label="Clinic pick-up and payment slip" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 transition-colors"><FileText size={17} /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">Clinic Pick-Up &amp; Payment Slip</h2>
              <p className="text-[10px] text-purple-700 dark:text-purple-400 transition-colors">ClearMind Psychological Services</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close slip" className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><X size={17} /></button>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          <div className="space-y-2 rounded-xl border border-purple-100 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/20 p-3.5 transition-colors">
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Scheduled Date</span><strong className="text-right text-purple-950 dark:text-purple-100">{fmtLongDate(request.scheduled_date)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Assigned Time Slot</span><strong className="text-right text-purple-950 dark:text-purple-100">{fmtTime(request.scheduled_start_time)} - {fmtTime(request.scheduled_end_time)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Location</span><strong className="text-right text-slate-700 dark:text-slate-300">{request.location}</strong></div>
          </div>
          {request.admin_note ? <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 p-3 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 transition-colors"><span className="font-bold">Clinic notice:</span> {request.admin_note}</div> : null}

          <div>
            <p className="mb-2 font-bold text-slate-700 dark:text-slate-200 transition-colors">Approved Documents &amp; Fees</p>
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 transition-colors">
              {request.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0 transition-colors">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-800 dark:text-slate-100">{item.title}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">{item.document_type_code || 'Assessment document'}</p></div>
                  <span className="shrink-0 font-bold text-slate-700 dark:text-slate-200">{money(item.fee)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t-2 border-slate-300 dark:border-slate-700 pt-2 font-bold transition-colors"><span className="text-purple-950 dark:text-purple-200">Total Amount Due</span><span className="text-sm text-emerald-700 dark:text-emerald-400">{money(request.total_amount)}</span></div>
            </div>
          </div>

          {/* Payment status notice */}
          {isPaid ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/30 p-3 text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200 transition-colors">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p>
                {request.status === 'released'
                  ? `Payment recorded via ${isPaidOnline ? 'PayMongo (Online)' : String(request.payment_method || '').toUpperCase()}. Documents released on ${fmtDate(request.released_at)}.`
                  : `Payment confirmed via ${isPaidOnline ? 'PayMongo (Online)' : String(request.payment_method || '').toUpperCase()}. Present this slip when picking up your documents.`}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 p-3 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 transition-colors">
              <Clock3 size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                {request.payment_preference === 'online'
                  ? 'Payment pending. Use the Pay Now button to complete your online payment before your pick-up date.'
                  : 'Please arrive during your designated time window. Payment can be settled via cash, GCash, Maya, GoTyme, or MariBank at the clinic cashier before document releasing.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => onDownload(request)} disabled={downloading} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 py-2 text-xs font-semibold text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"><Download size={14} /> {downloading ? 'Downloading...' : 'Download Slip'}</button>
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-purple-700 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-800">Close</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress & Program Reports grouping — parents were shown one flat grid of
// near-identical cards ("Monthly Assessment Report" x N), so reports are
// grouped by kind with a plain-English description and a distinguishing
// subtitle per card (period / session date).
// ---------------------------------------------------------------------------
const COMPLETED_GROUP = {
  key: 'completed',
  title: 'Completed Assessments',
  Icon: FileText,
  iconTone: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  desc: 'Select documents to request for clinic pick-up.',
}

const PROGRESS_GROUPS = [
  {
    key: 'iep',
    title: 'Individualized Education Plan',
    short: 'IEP',
    Icon: GraduationCap,
    iconTone: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    desc: 'The learning roadmap — goals and support plans for your child.',
  },
  {
    key: 'monthly',
    title: 'Monthly Assessment Reports',
    short: 'Monthly',
    Icon: CalendarDays,
    iconTone: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    desc: 'A month-by-month summary of progress. Check the period to tell reports apart.',
  },
  {
    key: 'daily',
    title: 'Daily Activity Reports',
    short: 'Daily',
    Icon: NotebookPen,
    iconTone: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    desc: 'Day-to-day notes from each session. Check the session date.',
  },
]

const groupOfRecord = (record) => {
  if (record.group === 'iep' || record.group === 'monthly' || record.group === 'daily') return record.group
  if (record.sourceTable === 'session_logs') return 'daily'
  if ((record.code || '').includes('FO-10')) return 'iep'
  return 'monthly'
}


// ---------------------------------------------------------------------------
// Collapsible compact list — one click-to-expand section per report group so
// dozens of session-dated reports stay scannable instead of a wall of cards.
// Each row keeps the select-for-request checkbox plus View Receipt /
// Pick-Up Slip actions.
// ---------------------------------------------------------------------------
function ReportListRow({ record, checked, eligible, onToggle, onSlip }) {
  const subtitle = record.group === 'daily' && record.session_date
    ? `Session date · ${fmtDate(record.session_date)}`
    : record.period || ''
  // Shared by the inline (sm+) and stacked (<sm) action slots so both stay
  // in sync without duplicating markup.
  const actions = (
    <>
      <ReleaseStatus release={record.release} assessmentStatus={record.status} />
      {record.release?.status === 'released' ? (
        <button
          type="button"
          onClick={() => onSlip(record.release)}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-500/50 bg-white dark:bg-blue-900/20 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 active:scale-[0.98] transition-colors"
        >
          <ExternalLink size={12} /> View Receipt
        </button>
      ) : record.release?.status === 'scheduled' && !eligible ? (
        <button
          type="button"
          onClick={() => onSlip(record.release)}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-500/50 bg-white dark:bg-blue-900/20 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 active:scale-[0.98] transition-colors"
        >
          <ExternalLink size={12} /> Pick-Up Slip
        </button>
      ) : null}
    </>
  )
  return (
    <li
      className={`rounded-xl border px-3 py-2.5 transition-colors ${
        checked
          ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-900/30 dark:border-blue-500/60'
          : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-500/60'
      }`}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={checked}
          disabled={!eligible}
          onChange={() => onToggle(record)}
          aria-label={`Select ${record.title}${subtitle ? ` — ${subtitle}` : ''} for request`}
          title={eligible ? 'Select for request' : 'Unavailable for request'}
          className={`shrink-0 ${eligible ? '' : 'opacity-40'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {record.code || 'REP'}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{record.title}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {[subtitle, record.completed_at ? `Completed ${fmtDate(record.completed_at)}` : 'Awaiting completion'].filter(Boolean).join(' · ')}
          </p>
        </div>
        {/* Inline actions on phone-landscape and up; stacked below on XS */}
        <div className="hidden shrink-0 items-center gap-2 min-[480px]:flex">
          {actions}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-12 min-[480px]:hidden">
        {actions}
      </div>
    </li>
  )
}

function ReportGroupList({ group, records, selected, selectable, onToggle, onSlip, defaultExpanded = false, sort = true }) {
  const { Icon } = group
  const [expanded, setExpanded] = useState(defaultExpanded)
  // Newest first — daily piles up fast, so the latest session sits on top.
  // Catalog sections keep their template order (sort = false).
  const ordered = sort
    ? [...records].sort((a, b) =>
      String(b.session_date || b.completed_at || '').localeCompare(String(a.session_date || a.completed_at || '')),
    )
    : records
  const selectedCount = ordered.filter((record) => selected.has(recordKey(record))).length
  return (
    <div className="mt-6 first:mt-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 transition-colors">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="w-full p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
      >
        {/* XS stacked: icon + title + chevron on top, badges + desc below.
            sm+: single inline row. Explicit tiers so the icon can never slip
            under the title on narrow phones. */}
        <div className="flex items-center gap-3 sm:hidden">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${group.iconTone}`}>
            <Icon size={17} />
          </div>
          <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{group.title}</h3>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-12 sm:hidden">
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">
            {records.length} {records.length === 1 ? 'report' : 'reports'}
          </span>
          {selectedCount > 0 ? (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {selectedCount} selected
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
            {expanded ? 'Hide' : 'View reports'}
            <ChevronDown size={13} strokeWidth={3} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
        <p className="mt-1 pl-12 line-clamp-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 transition-colors sm:hidden">{group.desc}</p>
        <div className="hidden items-center gap-3 sm:flex">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${group.iconTone}`}>
            <Icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{group.title}</h3>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">
                {records.length} {records.length === 1 ? 'report' : 'reports'}
              </span>
              {selectedCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {selectedCount} selected
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 transition-colors">{group.desc}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
            {expanded ? 'Hide' : 'View reports'}
            <ChevronDown size={14} strokeWidth={3} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>
      {/* Grid-rows slide: smooth height expand/collapse without measuring.
          The middle layer clips while the row animates 0fr <-> 1fr. */}
      <div
        className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="space-y-2 border-t border-slate-100 dark:border-slate-700/60 p-3">
            {ordered.map((record) => (
              <ReportListRow
                key={recordKey(record)}
                record={record}
                checked={selected.has(recordKey(record))}
                eligible={selectable(record)}
                onToggle={onToggle}
                onSlip={onSlip}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function AssessmentServices() {
  const [records, setRecords] = useState([])
  const [progressRecords, setProgressRecords] = useState([])
  const [templates, setTemplates] = useState([])
  const [releaseRequests, setReleaseRequests] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [slip, setSlip] = useState(null)
  const [downloadingSlip, setDownloadingSlip] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showRequestConfirm, setShowRequestConfirm] = useState(false)
  const [payingOnline, setPayingOnline] = useState(false)
  const hasCheckedReturnRef = useRef(false)
  const { profile } = useContext(AuthContext) || {}
  const userId = profile?.id
  // The only patient uuid this page's payload carries (formatReleaseRequest
  // keeps patient_id). Until a first request exists there is no scope id, so
  // subscriptions stay empty and the normal fetch carries the load.
  const releasePatientId = releaseRequests.find((request) => request.patient_id)?.patient_id

  const load = async () => {
    setError('')
    try {
      const data = await api.client.assessments()
      setRecords(data.records || [])
      setProgressRecords(data.progressRecords || [])
      setTemplates(data.templates || [])
      setReleaseRequests(data.releaseRequests || [])
    } catch (err) {
      setError(err.message || 'Unable to load assessment services.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.client.assessments()
      .then((data) => {
        if (!active) return
        setRecords(data.records || [])
        setProgressRecords(data.progressRecords || [])
        setTemplates(data.templates || [])
        setReleaseRequests(data.releaseRequests || [])
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load assessment services.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  // Live-refresh records, progress reports, and the release-request history.
  // No form-input guard is needed: the payment modal keeps its own local
  // state and load() never touches the selection set. (assessment_reports
  // events are currently RLS-gated to staff, so that leg is a silent no-op
  // until policy changes; session_logs and release requests carry updates.)
  useRealtimeRefresh(userId, releasePatientId ? [
    { table: 'assessment_submissions', filter: `patient_id=eq.${releasePatientId}` },
    { table: 'assessment_reports', filter: `patient_id=eq.${releasePatientId}` },
    { table: 'session_logs', filter: `patient_id=eq.${releasePatientId}` },
    { table: 'assessment_document_release_requests', filter: `patient_id=eq.${releasePatientId}` },
  ] : [], () => { load() })

  // Handle return from PayMongo checkout (success or cancelled)
  useEffect(() => {
    if (hasCheckedReturnRef.current) return
    hasCheckedReturnRef.current = true

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const requestId = params.get('request_id')

    if (!paymentStatus) return

    // Remove the query params from the URL without reloading
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    if (paymentStatus === 'success' && requestId) {
      const intervals = [3000, 3000, 5000, 5000, 5000, 5000, 5000, 10000, 10000, 10000]

      const poll = async (attempt = 0) => {
        try {
          const result = await api.payments.checkStatus(requestId)
          if (result.payment_status === 'paid') {
            toast.success('Payment confirmed! Your documents will be released on your scheduled date.', { duration: 6000 })
            await load()
            return
          }
          if (attempt < intervals.length - 1) {
            setTimeout(() => poll(attempt + 1), intervals[attempt])
          } else {
            toast.success('Payment submitted! Your payment is being verified. The page will reflect the status once confirmed.', { duration: 8000 })
            await load()
          }
        } catch {
          if (attempt < intervals.length - 1) {
            setTimeout(() => poll(attempt + 1), intervals[attempt])
          } else {
            toast.success('Payment submitted! Please refresh to see the updated status.', { duration: 5000 })
          }
        }
      }
      poll()
    } else if (paymentStatus === 'cancelled') {
      toast('Payment cancelled. You can try again from your scheduled request.', { icon: '↩️' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeRequest = releaseRequests.find((request) => ['pending', 'scheduled'].includes(request.status))
  const selectedRecords = records.filter((record) => selected.has(recordKey(record)))
  const selectedProgressRecords = progressRecords.filter((record) => selected.has(recordKey(record)))
  const matchedRecordKeys = new Set()
  const displayRecords = [
    ...templates.map((template) => {
      const match = records.find((record) => record.template_id === template.id || record.code === template.code)
      if (match) matchedRecordKeys.add(recordKey(match))
      return match || {
        id: `catalog-${template.id}`,
        sourceTable: 'catalog',
        template_id: template.id,
        code: template.code,
        title: template.title,
        est_minutes: template.est_minutes,
        status: null,
        submitted_at: null,
        release: null,
      }
    }),
    ...records.filter((record) => !matchedRecordKeys.has(recordKey(record))),
  ]
  const selectable = (record) => {
    if (record.release && !['declined', 'released'].includes(record.release.status)) return false
    return COMPLETED_STATUSES.has(record.status)
  }

  const toggleSelected = (record) => {
    if (!selectable(record)) return
    setSelected((current) => {
      const next = new Set(current)
      const key = recordKey(record)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleRequestClick = () => {
    if (!selectedRecords.length && !selectedProgressRecords.length) return
    setShowRequestConfirm(true)
  }

  const requestDocuments = async (paymentPreference, reason) => {
    const allSelected = [...selectedRecords, ...selectedProgressRecords]
    if (!allSelected.length) return
    setBusy(true)
    try {
      await api.client.requestAssessmentDocumentRelease(
        allSelected.map((record) => ({
          source_table: record.sourceTable,
          record_id: record.id,
        })),
        paymentPreference,
        reason
      )
      setSelected(new Set())
      setShowPaymentModal(false)
      toast.success(
        paymentPreference === 'online'
          ? 'Request sent! You can pay online after the clinic schedules your pick-up.'
          : 'Document pick-up request sent to the clinic.',
      )
      await load()
    } catch (err) {
      toast.error(err.message || 'Unable to request the documents.')
    } finally {
      setBusy(false)
    }
  }

  const downloadSlip = async (request) => {
    if (!request?.id) return
    setDownloadingSlip(true)
    try {
      const blob = await api.client.downloadAssessmentReleaseSlip(request.id)
      const patientId = request.patient_identifier || 'student'
      await saveBlob(blob, `${patientId}-assessment-pick-up-slip.pdf`)
      toast.success('Pick-up slip downloaded.')
    } catch (err) {
      toast.error(err.message || 'Unable to download the pick-up slip.')
    } finally {
      setDownloadingSlip(false)
    }
  }

  // Determine if the active request can show a Pay Now button
  const canPayOnline = activeRequest?.status === 'scheduled'
    && activeRequest?.payment_preference === 'online'
    && activeRequest?.payment_status !== 'paid'

  return (
    <>
      <PageHeader title="Assessment Services" />
      <main data-onboarding-key="client-assessments-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
        {/* Bottom padding keeps the last section (Document Request History)
            clear of the sticky selection bar whenever it is visible. */}
        <div className={`mx-auto max-w-7xl space-y-3.5 sm:space-y-4 ${(selectedRecords.length > 0 || selectedProgressRecords.length > 0) ? 'pb-28 sm:pb-24' : ''}`}>
          <PageIntro
            className="hidden sm:block"
            title="Assessment Services"
            subtitle="Request official completed assessment documents for clinic pick-up."
          />

          {error ? <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">{error}</div> : null}

          {/* Active request banner */}
          {activeRequest?.status === 'scheduled' ? (
            <div className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:p-5 transition-colors duration-300 ${
              activeRequest.payment_status === 'paid'
                ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-900/20'
                : activeRequest.payment_preference === 'online'
                  ? 'border-sky-200 dark:border-sky-800/50 bg-sky-50/70 dark:bg-sky-900/20'
                  : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-900/20'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
                  activeRequest.payment_status === 'paid' ? 'bg-emerald-600' : activeRequest.payment_preference === 'online' ? 'bg-sky-600' : 'bg-emerald-600'
                }`}>
                  {activeRequest.payment_status === 'paid' ? <ShieldCheck size={19} /> : <CalendarCheck size={19} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`text-sm font-bold ${activeRequest.payment_status === 'paid' ? 'text-emerald-950 dark:text-emerald-300' : activeRequest.payment_preference === 'online' ? 'text-sky-950 dark:text-sky-300' : 'text-emerald-950 dark:text-emerald-300'}`}>
                      Pick-Up Appointment Scheduled &amp; Approved
                    </h2>
                    {activeRequest.payment_status === 'paid' ? (
                      <span className="rounded-full bg-emerald-200 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:text-emerald-200">
                        Payment Confirmed ✓
                      </span>
                    ) : activeRequest.payment_preference === 'online' ? (
                      <span className="rounded-full bg-sky-200 dark:bg-sky-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900 dark:text-sky-200">
                        Online Payment Pending
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-200 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:text-amber-200">
                        Payment Due at Clinic
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs ${activeRequest.payment_status === 'paid' ? 'text-emerald-800 dark:text-emerald-400' : activeRequest.payment_preference === 'online' ? 'text-sky-800 dark:text-sky-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                    Visit the clinic on <strong>{fmtLongDate(activeRequest.scheduled_date)}</strong>, {fmtTime(activeRequest.scheduled_start_time)} - {fmtTime(activeRequest.scheduled_end_time)}. Total fee: <strong>{money(activeRequest.total_amount)}</strong>.
                  </p>
                  {activeRequest.admin_note ? <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200"><span className="font-bold">Clinic notice:</span> {activeRequest.admin_note}</div> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {canPayOnline && (
                  <PayNowButton request={activeRequest} onSuccess={load} />
                )}
                <button type="button" onClick={() => setSlip(activeRequest)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <FileText size={14} />
                  View Pick-Up Slip
                </button>
              </div>
            </div>
          ) : null}

          {/* Pending request notice (waiting for admin to schedule) */}
          {activeRequest?.status === 'pending' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-4 shadow-xs sm:p-5 transition-colors duration-300">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <Clock3 size={19} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-950 dark:text-amber-300">Document Request Pending Clinic Review</h2>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
                  Your request is being reviewed. The clinic will schedule a pick-up date and set the fees.
                  {activeRequest.payment_preference === 'online' ? ' You selected online payment — a Pay Now button will appear once the clinic approves.' : ''}
                </p>
              </div>
            </div>
          ) : null}

          {/* Documents list — collapsible compact rows instead of a card wall */}
          <section data-onboarding-key="client-assessments-list" className="mt-6">
            {loading ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80">
                <div className="flex items-center gap-3 p-4">
                  <Skeleton className="h-9 w-9" rounded="rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" rounded="rounded-md" />
                    <Skeleton className="h-3 w-1/2" rounded="rounded-md" />
                  </div>
                </div>
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-700/60 p-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" rounded="rounded-xl" />
                  ))}
                </div>
              </div>
            ) : displayRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-purple-100 dark:border-slate-800 bg-purple-50/30 dark:bg-slate-800/50 py-12 text-center transition-colors animate-content-fade-in">
                <FileText className="mb-3 h-10 w-10 text-purple-200 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No assessment documents available yet.</p>
              </div>
            ) : (
              <ReportGroupList
                group={COMPLETED_GROUP}
                records={displayRecords}
                selected={selected}
                selectable={selectable}
                onToggle={toggleSelected}
                onSlip={(release) => setSlip(activeRequest || releaseRequests.find((r) => r.id === release?.request_id))}
                defaultExpanded
                sort={false}
              />
            )}
          </section>

          {/* Progress & Program Reports — grouped by kind so parents can tell
              IEP, Monthly, and Daily reports apart at a glance. */}
          {progressRecords.length > 0 && (
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 transition-colors">Progress &amp; Program Reports</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">Select documents to request for clinic pick-up.</p>
              </div>

              {PROGRESS_GROUPS.map((group) => {
                const items = progressRecords.filter((record) => groupOfRecord(record) === group.key)
                if (items.length === 0) return null
                return (
                  <ReportGroupList
                    key={group.key}
                    group={group}
                    records={items}
                    selected={selected}
                    selectable={selectable}
                    onToggle={toggleSelected}
                    onSlip={(release) => setSlip(activeRequest || releaseRequests.find((r) => r.id === release?.request_id))}
                  />
                )
              })}
            </section>
          )}

          {/* History */}
          <section data-onboarding-key="client-assessments-history" className="mt-8 rounded-3xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">Document Request History</h2>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 transition-colors">Track your past document release requests</p>
              </div>
            </div>
            
            {releaseRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center transition-colors">
                  <Clock3 className="h-6 w-6 text-slate-300 dark:text-slate-600 transition-colors" />
                </div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 transition-colors">No document requests yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {releaseRequests.map((request) => (
                  <div key={request.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-colors hover:border-purple-200 dark:hover:border-purple-500 hover:shadow-md sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <ReleaseStatus release={request.status === 'pending' ? request : { ...request, status: request.status }} />
                          {request.payment_preference === 'online' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-200/50 dark:ring-sky-800/50 transition-colors">
                              <CreditCard size={10} /> Online Payment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">
                              <Store size={10} /> Pay Onsite
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug transition-colors">
                          {request.items.map((item) => item.title).join(', ')}
                        </h4>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">
                          <span>Requested: {fmtDate(request.requested_at)}</span>
                          <span className="hidden sm:inline text-slate-300 dark:text-slate-600 transition-colors">•</span>
                          <span className="font-bold text-purple-700 dark:text-purple-400 transition-colors">{money(request.total_amount)}</span>
                          
                          {request.status === 'scheduled' && (
                            <>
                              <span className="hidden sm:inline text-slate-300 dark:text-slate-600 transition-colors">•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 transition-colors">Pick-up: {fmtLongDate(request.scheduled_date)}</span>
                            </>
                          )}
                        </div>
                        
                        {request.admin_note ? (
                          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 transition-colors">
                            <span className="font-bold">Clinic notice:</span> {request.admin_note}
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                        {request.status === 'scheduled' || request.status === 'released' ? (
                          <button 
                            type="button" 
                            onClick={() => setSlip(request)} 
                            className="flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-sm transition-colors hover:bg-purple-50 dark:hover:bg-slate-700 active:scale-[0.98]"
                          >
                            <FileText size={14} /> View Slip
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Sticky Bottom Bar for Selection — stacked info + full-width actions
          on XS so nothing wraps awkwardly; inline row on sm+. */}
      {(selectedRecords.length > 0 || selectedProgressRecords.length > 0) && (
        <div className="absolute bottom-0 left-0 right-0 z-40 border-t border-purple-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.08)] sm:px-6 animate-[cymonModalFade_0.3s_ease-out] transition-colors">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 transition-colors">
                <FileText size={18} />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-700 px-1 text-[10px] font-bold text-white">
                  {selectedRecords.length + selectedProgressRecords.length}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">
                  {selectedRecords.length + selectedProgressRecords.length} Document{(selectedRecords.length + selectedProgressRecords.length) !== 1 ? 's' : ''} Selected
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">Ready to request for clinic pick-up</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelected(new Set())} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-colors sm:flex-none">
                Clear
              </button>
              <button type="button" onClick={handleRequestClick} disabled={busy} className="flex-1 rounded-xl bg-purple-700 dark:bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-800 dark:hover:bg-purple-700 disabled:opacity-50 active:scale-[0.98] transition-colors sm:flex-none">
                Request Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRequestConfirm ? (
        <ConfirmDialog
          title="Request Confirmation"
          message={`Are you sure you want to request ${selectedRecords.length + selectedProgressRecords.length} document${selectedRecords.length + selectedProgressRecords.length !== 1 ? 's' : ''} for clinic pick-up?`}
          confirmLabel="Yes"
          cancelLabel="No"
          onClose={() => setShowRequestConfirm(false)}
          onConfirm={() => {
            setShowRequestConfirm(false)
            setShowPaymentModal(true)
          }}
        />
      ) : null}
      <PaymentMethodModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={requestDocuments}
        busy={busy}
        isReRequest={[...selectedRecords, ...selectedProgressRecords].some((record) => record.release?.status === 'released')}
      />
      <PickUpSlip request={slip} onClose={() => setSlip(null)} onDownload={downloadSlip} downloading={downloadingSlip} />
    </>
  )
}

export default AssessmentServices
