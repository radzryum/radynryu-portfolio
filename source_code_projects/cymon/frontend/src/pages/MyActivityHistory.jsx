import { useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'
import PageHeader from './client/PageHeader'
import StaffHeader from './staff/StaffHeader'
import PageIntro from '../components/ui/PageIntro'
import PageSubtitle from '../components/ui/PageSubtitle'
import SearchBar from '../components/ui/SearchBar'
import Pagination from '../components/ui/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'

const PAGE_SIZE = 20

const SEVERITY_META = {
  info: { label: 'INFO', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  warn: { label: 'WARNING', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  alert: { label: 'ALERT', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

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

const titleCase = (s) => (s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Audit summaries are built server-side from the actor's stored display name,
// which may have been typed in lowercase at registration (e.g. "jerome Dela
// Cruz signed in…"). Old rows stay as-is in the DB, so uppercase the first
// letter here as a display guard — backend now normalizes new summaries.
// Only the first character is touched so the rest of the sentence (verbs,
// patient names) is never altered.
const formatSummary = (s) => {
  if (!s) return s
  const str = String(s)
  const i = str.search(/[a-zà-ÿ]/i)
  if (i === -1) return str
  const ch = str.charAt(i)
  if (ch !== ch.toLowerCase()) return str
  return str.slice(0, i) + ch.toUpperCase() + str.slice(i + 1)
}

function ActivityRow({ log }) {
  const sev = SEVERITY_META[log.severity] || SEVERITY_META.info
  const where = [log.city, log.country].filter(Boolean).join(', ')
  const sessionMeta = [log.device_label, where, log.ip_address].filter(Boolean).join(' · ')
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-slate-100 dark:border-slate-800 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded bg-purple-50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            {titleCase(log.action)}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {log.entity_type ? `on ${titleCase(log.entity_type)}` : 'General'}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev.cls}`}>
            {sev.label}
          </span>
        </div>
        <p className="mt-1.5 break-words text-sm text-slate-600 dark:text-slate-300">{formatSummary(log.summary)}</p>
        {sessionMeta ? (
          <p className="mt-1 break-words text-[11px] text-slate-400 dark:text-slate-500">{sessionMeta}</p>
        ) : null}
      </div>
      <div className="shrink-0 font-mono text-[11px] text-slate-400 dark:text-slate-500 sm:text-right">
        {fmtDateTime(log.created_at)}
      </div>
    </li>
  )
}

function MyActivityHistory() {
  const { profile } = useAuth()
  const isClient = profile?.role === 'client'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let on = true
    api
      .myActivity()
      .then((d) => {
        if (on) setLogs(d.logs || [])
      })
      .catch(() => {})
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
    }
  }, [])

  const q = searchTerm.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      logs.filter(
        (log) =>
          !q ||
          (log.summary || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          (log.entity_type || '').toLowerCase().includes(q) ||
          (log.device_label || '').toLowerCase().includes(q) ||
          (log.city || '').toLowerCase().includes(q) ||
          (log.country || '').toLowerCase().includes(q),
      ),
    [logs, q],
  )
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      {isClient ? <PageHeader title="Activity History" /> : <StaffHeader title="Activity History" />}
      <div className={`flex-1 overflow-y-auto ${isClient ? 'space-y-3.5 p-3.5 sm:space-y-4 sm:p-6' : 'bg-slate-50 p-4 dark:bg-slate-950 sm:p-6'}`} data-onboarding-key="history-workspace">
        {isClient ? (
          <PageIntro title="My Activity" subtitle="What you did in the system in the last 30 days — when, what, which device, and where. Sign-in entries show the device and approximate location." />
        ) : (
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Activity</h1>
            <PageSubtitle>
              What you did in the system in the last 30 days — when, what, which device, and where.
              Sign-in entries show the device and approximate location.
            </PageSubtitle>
          </div>
        )}

        <section className="rounded-2xl border border-purple-200 bg-white p-3.5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-5" data-onboarding-key="history-list">
          <div className="flex flex-col gap-3 border-b border-purple-50 pb-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                {loading ? 'Loading activity…' : `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'} in the last 30 days`}
              </p>
            </div>
            <div className="w-full max-w-xl flex-1">
              <SearchBar
                placeholder="Search what you did…"
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <ul key={loading ? 'loading' : 'loaded'} className="mt-4 space-y-2.5 animate-content-fade-in">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-20 w-full rounded-xl" />
                </li>
              ))
            ) : pageRows.length === 0 ? (
              <li className="rounded-xl border border-dashed border-purple-200 p-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {logs.length === 0 ? 'No activity in the last 30 days yet.' : 'No matching activity found.'}
              </li>
            ) : (
              pageRows.map((log) => <ActivityRow key={log.id} log={log} />)
            )}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </section>
      </div>
    </>
  )
}

export default MyActivityHistory
