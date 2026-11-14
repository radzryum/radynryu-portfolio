import { useEffect, useMemo, useRef, useState } from 'react'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import Pagination from '../../../components/ui/Pagination'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import SearchBar from '../../../components/ui/SearchBar'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import { api } from '../../../lib/api'
import { formatLastFirstMI } from '../../../lib/format'

const PAGE_SIZE = 20

const SEVERITY_META = {
  info: { label: 'INFO', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  warn: { label: 'WARNING', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  alert: { label: 'ALERT', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  warning: { label: 'WARNING', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { label: 'CRITICAL', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
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

function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [actorFilter, setActorFilter] = useState('All')
  const [selectedLog, setSelectedLog] = useState(null)
  const [page, setPage] = useState(1)
  // Slide-over exit: slide back right first, unmount after.
  const [closingLog, setClosingLog] = useState(false)
  const closeTimer = useRef(null)
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  const closeLog = () => {
    if (closingLog) return
    setClosingLog(true)
    closeTimer.current = setTimeout(() => {
      setSelectedLog(null)
      setClosingLog(false)
    }, 240)
  }
  // Opening (or switching) a log always plays the entrance: cancel any
  // pending exit first so a mid-close click never unmounts the new panel.
  const openLog = (log) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setClosingLog(false)
    setSelectedLog(log)
  }

  useEffect(() => {
    let on = true
    api.admin
      .audit()
      .then((d) => on && setLogs(d.logs))
      .catch(() => {})
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
    }
  }, [])

  const actions = useMemo(
    () => ['All', ...Array.from(new Set(logs.map((l) => l.action).filter(Boolean)))],
    [logs]
  )
  const actors = useMemo(
    () => ['All', ...Array.from(new Set(logs.map((l) => l.actor).filter(Boolean))).sort((a, b) => a.localeCompare(b))],
    [logs]
  )

  // Name search supports "Last, First": commas become spaces, every token
  // must appear in the actor/summary/action haystack.
  const qTokens = searchTerm.trim().toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  const filteredLogs = logs.filter((log) => {
    const haystack = [log.actor, log.summary, log.action, log.entity_type, log.device_label, log.city, log.country, log.ip_address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !qTokens.length || qTokens.every((t) => haystack.includes(t))
    const matchesAction = actionFilter === 'All' || log.action === actionFilter
    const matchesActor = actorFilter === 'All' || log.actor === actorFilter
    return matchesSearch && matchesAction && matchesActor
  })

  const pageRows = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <StaffHeader title="System Audit Trail" />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 transition-colors/50" data-onboarding-key="audit-workspace">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Compliance & Activity Logs</h1>
          <PageSubtitle>
            A read-only record of state-changing actions across the clinic — who did what, and when.
            Every entry is appended to the audit log for retrospective review.
          </PageSubtitle>
        </div>

        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 transition-colors p-4 rounded-xl border border-purple-100 shadow-sm" data-onboarding-key="audit-filters">
          <div className="relative flex-1 w-full max-w-xl">
            <SearchBar
              placeholder="Search name (Last, First), detail or action…"
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setPage(1)
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider font-mono">Actor:</span>
            <AnimatedSelect
              value={actorFilter}
              onChange={(val) => {
                setActorFilter(val)
                setPage(1)
              }}
              options={actors.map((a) => ({ value: a, label: a === 'All' ? 'All' : (formatLastFirstMI(a) || a) }))}
            />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-wider font-mono">Action:</span>
            <AnimatedSelect
              value={actionFilter}
              onChange={(val) => {
                setActionFilter(val)
                setPage(1)
              }}
              options={actions.map((a) => ({ value: a, label: a === 'All' ? 'All' : titleCase(a) }))}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-6">
          <section className="min-w-0 flex-1 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead>
                  <tr className="text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 transition-colors">
                    <th className="py-3 px-4 text-left">Timestamp</th>
                    <th className="py-3 px-4 text-left">Actor</th>
                    <th className="py-3 px-4 text-left">Action</th>
                    <th className="py-3 px-4 text-left">Record Type</th>
                    <th className="py-3 px-4 text-left">Detail</th>
                    <th className="py-3 px-4 text-left">Severity</th>
                    <th className="py-3 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody key={loading ? 'loading' : 'loaded'} className="divide-y divide-purple-100 dark:divide-slate-800 transition-colors animate-content-fade-in">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`s${i}`}>
                        <td colSpan="7" className="py-3 px-4">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-6 px-4 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                        {logs.length === 0 ? 'No audit activity recorded yet.' : 'No matching audit logs found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((log) => {
                      const sev = SEVERITY_META[log.severity] || SEVERITY_META.info
                      const isSelected = selectedLog && selectedLog.id === log.id
                      return (
                        <tr
                          key={log.id}
                          onClick={() => openLog(log)}
                          className={`group cursor-pointer transition-colors ${isSelected ? 'bg-purple-100/70 dark:bg-purple-900/40 font-medium' : 'hover:bg-purple-50/40 dark:hover:bg-slate-800/60'}`}
                        >
                          <td className="py-3 px-4 text-xs font-mono text-slate-500 dark:text-slate-400 transition-colors whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                          <td className="py-3 px-4 text-sm font-semibold uppercase text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap">
                            {formatLastFirstMI(log.actor) || log.actor}
                            {log.actor_role ? (
                              <span className="ml-1 text-[10px] font-normal text-slate-400">({titleCase(log.actor_role)})</span>
                            ) : null}
                            {(log.device_label || log.city || log.country) ? (
                              <div className="text-[10px] font-normal text-slate-400">
                                {[log.device_label, [log.city, log.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            <span className="inline-block bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide transition-colors">
                              {titleCase(log.action)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap">
                            {log.entity_type ? titleCase(log.entity_type) : 'General'}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300 transition-colors font-light max-w-xs md:max-w-md truncate group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors">
                            {log.summary}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-full text-[10px] uppercase tracking-wider border ${sev.cls}`}>
                              {sev.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openLog(log)
                              }}
                              className="rounded-md border border-purple-200 dark:border-slate-700 transition-colors px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filteredLogs.length} onPage={setPage} />
          </section>

          {selectedLog ? (
            <>
              <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={closeLog} aria-hidden="true" />
              <aside key={selectedLog.id} className={`fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto bg-white dark:bg-slate-900 transition-colors p-5 shadow-xl lg:sticky lg:top-4 lg:z-auto lg:block lg:max-h-[calc(100vh-7rem)] lg:w-96 lg:max-w-none lg:shrink-0 lg:self-start lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-purple-200 dark:border-slate-700 transition-colors lg:shadow-sm ${closingLog ? 'animate-[panelSlideOut_0.22s_ease-in_both]' : 'animate-[panelSlideIn_0.28s_cubic-bezier(0.16,1,0.3,1)_both]'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-lg font-semibold text-purple-800 dark:text-purple-300 transition-colors">Log Details</div>
                  <button onClick={closeLog} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors mb-4 font-mono">ID: {selectedLog.id}</div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Timestamp</span>
                    <span className="font-medium text-purple-800 dark:text-purple-300 transition-colors">{fmtDateTime(selectedLog.created_at)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Severity</span>
                    <div>
                      <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${(SEVERITY_META[selectedLog.severity] || SEVERITY_META.info).cls}`}>
                        {(SEVERITY_META[selectedLog.severity] || SEVERITY_META.info).label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Actor</span>
                    <span className="font-medium uppercase text-purple-800 dark:text-purple-300 transition-colors">
                      {formatLastFirstMI(selectedLog.actor) || selectedLog.actor}
                      {selectedLog.actor_role ? (
                        <span className="text-slate-500 dark:text-slate-400 transition-colors font-normal"> ({titleCase(selectedLog.actor_role)})</span>
                      ) : null}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Action</span>
                    <div className="mt-0.5">
                      <span className="inline-block bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                        {titleCase(selectedLog.action)}
                      </span>
                      {selectedLog.entity_type ? (
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">on {titleCase(selectedLog.entity_type)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 transition-colors">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Event Summary</span>
                    <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-200 transition-colors font-light whitespace-pre-wrap">{selectedLog.summary}</p>
                  </div>

                  {selectedLog.entity_id ? (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Record ID</span>
                      <span className="break-all text-xs font-mono text-slate-600 dark:text-slate-300 transition-colors">{selectedLog.entity_id}</span>
                    </div>
                  ) : null}

                  {(selectedLog.device_label || selectedLog.city || selectedLog.country || selectedLog.ip_address) ? (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 transition-colors">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase font-mono block">Device & Location</span>
                      {selectedLog.device_label ? (
                        <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 transition-colors">{selectedLog.device_label}</div>
                      ) : null}
                      {[selectedLog.city, selectedLog.country].filter(Boolean).length ? (
                        <div className="text-xs text-slate-600 dark:text-slate-300 transition-colors">
                          {[selectedLog.city, selectedLog.country].filter(Boolean).join(', ')}
                        </div>
                      ) : null}
                      {selectedLog.ip_address ? (
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 transition-colors">IP: {selectedLog.ip_address}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 transition-colors pt-4">
                  <button
                    onClick={closeLog}
                    className="w-full rounded-md border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </aside>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default AuditTrail
