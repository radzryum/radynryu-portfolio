import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import { Inbox, Copy, Check, Upload, XCircle, Printer, Eye } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import SearchBar from '../../../components/ui/SearchBar'
import Pagination from '../../../components/ui/Pagination'
import Skeleton from '../../../components/ui/Skeleton'
import Modal from '../../../components/ui/Modal'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import Button from '../../../components/ui/Button'
import StudentAdmissionForm, { StudentRegisteredSlipModal } from './StudentAdmissionForm'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import { shortBranchName } from '../../../lib/branches'
import { formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import { api } from '../../../lib/api'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'

const PAGE_SIZE = 20
// Applicant name in "Last, First M." using the structured payload parts
// (stored snake_case by the public endpoint); falls back to parsing the
// composed child_name when the payload is missing parts.
const appChildName = (r) => {
  const p = r?.payload?.patient || {}
  return formatLastFirstMI({
    first_name: p.first_name,
    middle_name: p.middle_name,
    last_name: p.last_name,
    suffix_name: p.suffix_name,
    name: r?.child_name,
  }) || r?.child_name || ''
}
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'imported', label: 'Imported' },
  { value: 'rejected', label: 'Rejected' },
]

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

// Fetch a remote image as a data URL so the admission form can re-submit it
// as the 2x2 photo. Best-effort: null means staff re-takes the photo.
const remoteToDataUrl = async (url) => {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// QR/link admission applications from guardians (no account needed).
// Import opens the full admission form prefilled; the guardian's parent
// signature carries over, staff add the representative signature + account.
function Applications() {
  const { profile, user } = useAuth()
  const userId = user?.id || profile?.id
  const isSuperAdmin = profile?.role === 'super_admin'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [clinicCode, setClinicCode] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  const [flyerTarget, setFlyerTarget] = useState(null)
  const [importing, setImporting] = useState(null)
  const [studentSlip, setStudentSlip] = useState(null)
  const [importPhoto, setImportPhoto] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const [rejectBusy, setRejectBusy] = useState(false)
  // Notification deep-link (?application=<id>): the row to spotlight once
  // its tab finishes loading. Cleared from the URL after handling so a
  // refresh doesn't re-trigger the jump.
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlightId, setHighlightId] = useState(null)
  const deepLinkRecord = useRef(null)
  // Tracks already-seen application ids so a live refresh can toast only
  // for genuinely new submissions (never on first load or tab switches).
  const seenIds = useRef(new Set())
  const tabRef = useRef(tab)
  useEffect(() => {
    tabRef.current = tab
  }, [tab])
  const branchRef = useRef(branchFilter)
  useEffect(() => {
    branchRef.current = branchFilter
  }, [branchFilter])

  const load = async (activeTab = tab, branch = branchFilter) => {
    setLoading(true)
    try {
      const [apps, clinic] = await Promise.all([
        api.admin.applications(activeTab, branch),
        api.admin.clinic().catch(() => null),
      ])
      // Stale-response guard: the user may have switched tabs/branches
      // while this request was in flight (or a slower earlier request may
      // resolve after a newer one). Applying it would flash the wrong
      // list — e.g. Pending rows under the Rejected tab — before the
      // correct response overwrites them.
      if (tabRef.current !== activeTab || branchRef.current !== branch) return
      const next = apps.applications || []
      setRows(next)
      // Seed the seen-set silently — toasts only fire from quietRefresh.
      next.forEach((r) => {
        if (r?.id) seenIds.current.add(r.id)
      })
      if (clinic?.clinic?.code) setClinicCode(clinic.clinic.code)
      if (clinic?.clinic?.name) setClinicName(clinic.clinic.name)
    } catch {
      // A stale request's failure is irrelevant — a newer one owns the UI.
      if (tabRef.current === activeTab && branchRef.current === branch) {
        toast.error('Failed to load applications.')
      }
    } finally {
      // Same for the spinner: only the current tab/branch request may
      // clear it, otherwise a stale finish hides the skeleton while the
      // real request is still loading.
      if (tabRef.current === activeTab && branchRef.current === branch) {
        setLoading(false)
      }
    }
  }

  // Quiet live-refresh: same fetch without the skeleton flash. New pending
  // rows toast once so an admin watching the page notices instantly.
  const quietRefresh = async () => {
    const reqTab = tabRef.current
    const reqBranch = branchRef.current
    try {
      const apps = await api.admin.applications(reqTab, reqBranch)
      // Same stale-response guard as load(): never write another tab's
      // rows into the current view.
      if (tabRef.current !== reqTab || branchRef.current !== reqBranch) return
      const next = apps.applications || []
      const fresh = next.filter((r) => r?.id && !seenIds.current.has(r.id))
      next.forEach((r) => {
        if (r?.id) seenIds.current.add(r.id)
      })
      setRows(next)
      setPage((p) => {
        const maxPage = Math.max(1, Math.ceil(next.length / PAGE_SIZE))
        return p > maxPage ? maxPage : p
      })
      if (fresh.length > 0 && tabRef.current === 'pending') {
        const first = fresh[0]
        toast.success(
          fresh.length === 1
            ? `New application: ${first.child_name || 'Unnamed applicant'}`
            : `${fresh.length} new applications received`,
        )
      }
    } catch {
      // Silent: the next poll / manual reload recovers.
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, branchFilter])

  // Live-refresh when a guardian submits via QR/link (INSERT) or another
  // admin imports/rejects (UPDATE). RLS gates every event; polling + focus
  // refetch below cover blocked sockets or a missing publication.
  const appScope = branchFilter || profile?.clinic_id || ''
  const appSubs = appScope
    ? [{ table: 'admission_applications', filter: `clinic_id=eq.${appScope}` }]
    : (isSuperAdmin ? [{ table: 'admission_applications' }] : [])
  useRealtimeRefresh(userId, appSubs, quietRefresh)

  // Cross-branch trigger without a second channel: the header bell already
  // subscribes to this admin's notifications and dispatches
  // 'cymon:notification-update' on every arrival (see the fallback effect
  // below). Opening a second `notifications:<userId>` channel here would
  // reuse the bell's subscribed channel instance and throw
  // ("cannot add postgres_changes callbacks after subscribe()").
  // The bell is always mounted inside StaffHeader, so no submission is
  // missed — this is what refreshes Super Admin's "All Branches" view even
  // when RLS scopes the table subscription above to one clinic.

  useEffect(() => {
    // Fallback when websockets are blocked: poll + refetch on focus and on
    // the shared notification event (fired after bell actions elsewhere).
    const id = setInterval(() => {
      if (!document.hidden) quietRefresh()
    }, 30000)
    const onFocus = () => quietRefresh()
    const onNotif = () => quietRefresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('cymon:notification-update', onNotif)
    window.addEventListener('cymon:workflow-refresh', onNotif)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('cymon:notification-update', onNotif)
      window.removeEventListener('cymon:workflow-refresh', onNotif)
    }
  }, [])

  useEffect(() => {
    // Branch filter list for Super Admin only (backend 403s other roles).
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notification deep-link: ?application=<id> jumps to whichever tab holds
  // the record (so a stale "new application" click never strands on an
  // empty Pending list), spotlights the row, and reports its status.
  useEffect(() => {
    const appId = searchParams.get('application')
    if (!appId) return
    let on = true
    api.admin.application(appId)
      .then((d) => {
        if (!on || !d?.application) throw new Error('not found')
        const rec = d.application
        deepLinkRecord.current = rec
        setQuery('')
        setPage(1)
        setHighlightId(rec.id)
        // A Super Admin filtering another branch would hide the row —
        // drop back to the full list so the jump always lands.
        if (rec.clinic_id && branchRef.current && branchRef.current !== rec.clinic_id) {
          setBranchFilter('')
        }
        if (tabRef.current !== rec.status) setTab(rec.status)
      })
      .catch(() => {
        if (!on) return
        toast.error('Application not found. It may have been removed.')
        setSearchParams({}, { replace: true })
      })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once the deep-linked row is rendered, scroll it into view, announce
  // its status (including who resolved it), and clean the URL.
  useEffect(() => {
    if (!highlightId || loading) return
    if (!rows.some((r) => r.id === highlightId)) return
    const rec = deepLinkRecord.current
    deepLinkRecord.current = null
    requestAnimationFrame(() => {
      document.getElementById(`app-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    if (rec) {
      const by = rec.reviewed_by_name ? ` by ${rec.reviewed_by_name}` : ''
      if (rec.status === 'imported') toast.success(`Already imported${by}.`)
      else if (rec.status === 'rejected') toast(`Already rejected${by}.`)
      else toast.success(`${rec.child_name || 'Application'} is pending review.`)
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, loading, rows])

  const applyUrl = clinicCode ? `${window.location.origin}/apply/${clinicCode}` : ''
  // Super Admin sees one QR card per branch; regular admins see their own
  // branch only (single clinicCode from /admin/clinic).
  const qrTargets = isSuperAdmin && branchOptions.length > 0
    ? branchOptions.map((b) => ({
      key: b.id || b.code,
      code: b.code,
      name: b.name,
      url: `${window.location.origin}/apply/${b.code}`,
    }))
    : (applyUrl ? [{ key: clinicCode, code: clinicCode, name: clinicName, url: applyUrl }] : [])

  const copyLink = async (url, code) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(''), 2000)
    } catch {
      toast.error('Copy failed. Long-press the link to copy it manually.')
    }
  }

  const openImport = async (row) => {
    setImportBusy(true)
    try {
      const dataUrl = await remoteToDataUrl(row.payload?.patient?.photo_url)
      if (row.payload?.patient?.photo_url && !dataUrl) {
        toast.error("The applicant's photo could not be loaded — please re-take it in the form.")
      }
      setImportPhoto(dataUrl)
      setImporting(row)
    } finally {
      setImportBusy(false)
    }
  }

  const handleImported = async (created) => {
    if (!importing) return
    try {
      await api.admin.markApplication(importing.id, 'imported')
      setImporting(null)
      setImportPhoto(null)
      // Close the import modal first so the success slip is the only dialog
      // on screen (no stale form stacked behind).
      if (created?.patientId) setStudentSlip(created)
      else toast.success('Application imported. The parent can now sign in.')
      // The server retired this application's bell items (a read_at UPDATE
      // emits no realtime event), so poke the bell/badges to refetch now.
      window.dispatchEvent(new CustomEvent('cymon:notification-update'))
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to mark as imported.')
    }
  }

  const handleReject = async () => {
    if (!rejecting) return
    setRejectBusy(true)
    try {
      await api.admin.markApplication(rejecting.id, 'rejected')
      toast.success('Application rejected.')
      setRejecting(null)
      window.dispatchEvent(new CustomEvent('cymon:notification-update'))
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to reject.')
    } finally {
      setRejectBusy(false)
    }
  }

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  const filtered = rows.filter(
    (r) =>
      !q ||
      `${r.child_name || ''} ${appChildName(r)}`.toLowerCase().replace(/,/g, ' ').includes(q) ||
      (r.parent_printed_name || '').toLowerCase().includes(q),
  )
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <StaffHeader title="Admission Applications" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6" data-onboarding-key="applications-workspace">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">Admission Applications</h1>
          <PageSubtitle>
            Guardians fill this in on their own phones by scanning your QR code or opening your link — no account needed.
            Import a submission to open the full admission form prefilled, ready for your review and the representative signature.
          </PageSubtitle>
        </div>

        <section className="mb-5 space-y-4" data-onboarding-key="applications-qr">
          {qrTargets.length === 0 ? (
            <div className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-400">Loading link…</p>
            </div>
          ) : (
            qrTargets.map((target) => (
              <div key={target.key} className="flex flex-col gap-4 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                <div className="shrink-0 rounded-xl border border-purple-100 bg-white p-2">
                  <QRCodeSVG value={target.url} size={120} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Public admission link{isSuperAdmin && target.name ? ` — ${target.name}` : ''}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Show this QR code at the front desk or send the link by chat. Each submission lands here as Pending.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-purple-50 px-3 py-2 font-mono text-xs text-purple-800 dark:bg-slate-800 dark:text-purple-300">
                      {target.url}
                    </code>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => copyLink(target.url, target.code)}>
                        {copiedCode === target.code ? <Check size={14} /> : <Copy size={14} />}
                        {copiedCode === target.code ? 'Copied' : 'Copy link'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setFlyerTarget(target)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 cursor-pointer"
                      >
                        <Eye size={14} /> Preview flyer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-onboarding-key="applications-list">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-purple-200 bg-purple-50/50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTab(t.value)
                    setPage(1)
                    setHighlightId(null)
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${tab === t.value
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-slate-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <SearchBar
              value={query}
              onChange={(v) => {
                setQuery(v)
                setPage(1)
              }}
              placeholder="Search by child or parent name"
              className="w-full sm:max-w-xs"
            />
            {isSuperAdmin && branchOptions.length > 1 ? (
              <AnimatedSelect
                value={branchFilter || 'all'}
                onChange={(val) => {
                  setBranchFilter(val === 'all' ? '' : val)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...branchOptions.map((b) => ({ value: b.id, label: shortBranchName(b) })),
                ]}
              />
            ) : null}
          </div>

          <ul key={loading ? 'loading' : 'loaded'} className="mt-4 space-y-2.5 animate-content-fade-in">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-20 w-full rounded-xl" />
                </li>
              ))
            ) : pageRows.length === 0 ? (
              <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-purple-200 p-8 text-center dark:border-slate-700">
                <Inbox size={24} className="text-slate-300" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tab === 'pending' ? 'No pending applications. Share your QR code to receive some.' : `No ${tab} applications.`}
                </p>
              </li>
            ) : (
              pageRows.map((r) => (
                <li
                  key={r.id}
                  id={`app-row-${r.id}`}
                  style={{ scrollMarginTop: '1rem' }}
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${highlightId === r.id
                    ? 'border-purple-400 bg-purple-50/70 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-900/20 dark:ring-purple-600'
                    : 'border-slate-100 dark:border-slate-800'}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold capitalize text-slate-800 dark:text-slate-100">{appChildName(r) || 'Unnamed applicant'}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {r.date_of_birth ? `Born ${r.date_of_birth}` : 'No birthdate'}
                      {r.sex ? ` · ${r.sex === 'male' ? 'Male' : 'Female'}` : ''}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      Parent: {r.parent_printed_name || '—'} · Submitted {fmtDateTime(r.created_at)}
                    </div>
                    {isSuperAdmin && r.clinic_name ? (
                      <div className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {shortBranchName({ code: r.clinic_code, name: r.clinic_name })}
                      </div>
                    ) : null}
                  </div>
                  {tab === 'pending' ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => openImport(r)} disabled={importBusy}>
                        <Upload size={14} /> Import
                      </Button>
                      <button
                        type="button"
                        onClick={() => setRejecting(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </section>
      </div>

      {importing ? (
        <Modal
          title="Import Application"
          subtitle={`Review, complete, and submit as a full admission record`}
          onClose={() => {
            setImporting(null)
            setImportPhoto(null)
          }}
          maxWidth="max-w-6xl"
        >
          <StudentAdmissionForm
            inline={true}
            initialDetail={importing.payload}
            initialPhoto={importPhoto}
            onClose={() => {
              setImporting(null)
              setImportPhoto(null)
            }}
            onSaved={handleImported}
          />
        </Modal>
      ) : null}
      {studentSlip ? (
        <StudentRegisteredSlipModal created={studentSlip} onClose={() => setStudentSlip(null)} />
      ) : null}

      {rejecting ? (
        <ConfirmDialog
          title="Reject application?"
          message={`This discards the application for ${rejecting.child_name || 'this applicant'}. This cannot be undone.`}
          confirmLabel="Reject"
          tone="red"
          busy={rejectBusy}
          onConfirm={handleReject}
          onClose={() => {
            if (!rejectBusy) setRejecting(null)
          }}
        />
      ) : null}

      {flyerTarget ? (
        <Modal
          title="Admission QR Flyer"
          subtitle="Print or save as PDF to post at the front desk"
          onClose={() => setFlyerTarget(null)}
          maxWidth="max-w-lg"
        >
          <div
            id="qr-flyer-print"
            className="mx-auto w-full max-w-md rounded-2xl border border-purple-200 bg-white p-6 text-center shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-8"
          >
            <div className="flex items-center justify-center gap-2.5">
              <img src="/logo-cymon.png" alt="ClearMind logo" className="h-12 w-12 object-contain print:h-10 print:w-10" />
              <span className="text-3xl tracking-wider text-purple-950 print:text-2xl" style={{ fontFamily: 'Against' }}>ClearMind</span>
            </div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-500">
              {flyerTarget.name || clinicName || 'Psychological Services'}
            </p>
            <h3 className="mt-4 text-lg font-extrabold text-slate-900 print:mt-2">Student Admission Application</h3>
            <p className="mt-1 text-xs text-slate-500">No account needed — fill in the form on your own phone.</p>
            <div className="mx-auto mt-5 w-fit rounded-2xl border-2 border-purple-100 bg-white p-3 print:mt-3 print:border-purple-200 print:p-2">
              <QRCodeSVG value={flyerTarget.url} size={200} className="print:h-[240px] print:w-[240px]" />
            </div>
            <p className="mx-auto mt-4 max-w-xs break-all font-mono text-[11px] text-purple-700 print:mt-2">{flyerTarget.url}</p>
            <ol className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-xs text-slate-600 print:mt-2">
              <li><span className="font-bold text-purple-700">1.</span> Scan this code with your phone camera.</li>
              <li><span className="font-bold text-purple-700">2.</span> Fill in your child&apos;s details and sign.</li>
              <li><span className="font-bold text-purple-700">3.</span> Submit — the clinic will contact you next.</li>
            </ol>
            <p className="mt-5 border-t border-purple-100 pt-3 text-[10px] text-slate-400 print:mt-2 print:pt-2">
              Prefer to register in person? Visit our front desk and our staff will assist you.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFlyerTarget(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Close
            </button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={14} /> Save as PDF
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

export default Applications
