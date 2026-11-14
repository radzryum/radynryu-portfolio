import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import RowAction from '../../../components/ui/RowAction'
import SearchBar from '../../../components/ui/SearchBar'
import { AuthContext } from '../../../auth/AuthContext'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import { levelTone, levelLabel, fmtDate } from '../../../lib/rosterMeta'

function ProgressBar({ value, trackClassName = 'w-32' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 rounded-full bg-purple-100 ${trackClassName}`}>
        <div className="h-full rounded-full bg-purple-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs text-slate-600 dark:text-slate-300 transition-colors">{value}%</span>
    </div>
  )
}

function EditRosterModal({ client, onClose, onSaved }) {
  const [progress, setProgress] = useState(String(client.progress ?? 0))
  const [chiefComplaint, setChiefComplaint] = useState(client.chief_complaint || '')
  const [workingDiagnosis, setWorkingDiagnosis] = useState(client.working_diagnosis || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [suggestionLoading, setSuggestionLoading] = useState(true)

  // Reference point for the slider: latest FO-03 snapshot, change since the
  // first FO-03, and monthly-report coverage. Suggestion only — the saved
  // value stays a manual clinical decision.
  useEffect(() => {
    let on = true
    setSuggestionLoading(true)
    api.psychologist
      .rosterSuggestion(client.id)
      .then((d) => {
        if (on) setSuggestion(d.suggestion || null)
      })
      .catch(() => {
        if (on) setSuggestion(null)
      })
      .finally(() => {
        if (on) setSuggestionLoading(false)
      })
    return () => {
      on = false
    }
  }, [client.id])

  const save = async () => {
    setError('')
    const payload = {}
    const n = Number(progress)
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      setError('Progress must be a whole number between 0 and 100')
      return
    }
    payload.milestone_progress = n
    payload.chief_complaint = chiefComplaint
    payload.working_diagnosis = workingDiagnosis
    setSaving(true)
    try {
      await api.psychologist.updateRoster(client.id, payload)
      onSaved({
        ...client,
        progress: n,
        chief_complaint: chiefComplaint,
        working_diagnosis: workingDiagnosis,
        updated: new Date().toISOString(),
      })
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Update Student Roster"
      subtitle={client.name}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="w-24">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="w-32 !bg-purple-700 hover:!bg-purple-800">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-2">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>Milestone Progress</span>
            <span className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">{progress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            className="w-full h-2 bg-purple-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="Milestone progress percent"
          />
          {suggestionLoading ? (
            <div className="text-[11px] text-slate-400">Loading data reference…</div>
          ) : suggestion?.suggested != null && suggestion?.fo03 ? (
            <div className="rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/60 dark:bg-purple-900/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  Suggested {suggestion.suggested}%
                </div>
                <button
                  type="button"
                  onClick={() => setProgress(String(suggestion.suggested))}
                  className="rounded-lg bg-purple-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-800 active:scale-[0.98]"
                >
                  Use suggestion
                </button>
              </div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                <li>
                  Latest FO-03: {suggestion.fo03.total}/{suggestion.fo03.max} ({suggestion.fo03.pct}%) · {suggestion.fo03.date} · status: {suggestion.fo03.status}
                </li>
                {(() => {
                  const firstDate = suggestion.firstFo03?.date
                  const multi = suggestion.fo03.count != null
                    ? suggestion.fo03.count > 1
                    : (firstDate && firstDate !== suggestion.fo03.date)
                  if (multi && suggestion.fo03.delta != null) {
                    const d = suggestion.fo03.delta
                    return (
                      <li>
                        Change since first FO-03{firstDate ? ` (${firstDate})` : ''}: {d >= 0 ? '+' : ''}{d} percentage points
                      </li>
                    )
                  }
                  return (
                    <li>Only one FO-03 on file — no earlier score to compare yet.</li>
                  )
                })()}
                <li>{suggestion.progressReports} monthly progress report{suggestion.progressReports === 1 ? '' : 's'} on file</li>
              </ul>
              <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                Screening only (caregiver FO-03 %) — not IEP completion. Adjust to reflect actual IEP goal completion before saving.
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">
              No FO-03 result on file yet — set progress from clinical judgment.
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Textarea
            label="Chief Complaint"
            rows={3}
            placeholder="Main reason the student came in to consult…"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Textarea
            label="Working Diagnosis"
            rows={3}
            placeholder="Initial impression while evaluation is ongoing…"
            value={workingDiagnosis}
            onChange={(e) => setWorkingDiagnosis(e.target.value)}
          />
        </div>
        {error ? (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function ViewRosterModal({ client, onClose, onEdit, intake, intakeLoading = false }) {
  const intakeEntries = [
    ['Concerns', intake?.concerns],
    ['Onset', intake?.onset],
    ['Background', intake?.background],
    ['Developmental', intake?.developmental],
    ['Medical', intake?.medical],
    ['Family & social', intake?.family],
    ['Observations', intake?.observations],
  ]
  return (
    <Modal
      title={client.name}
      subtitle="Student Details"
      onClose={onClose}
      maxWidth={intake !== undefined ? 'max-w-2xl' : 'max-w-md'}
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="w-24">
            Close
          </Button>
          {onEdit ? (
            <Button onClick={onEdit} className="w-24 !bg-purple-700 hover:!bg-purple-800">Edit</Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-2 pb-4">
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-5 border border-slate-100 dark:border-slate-700">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Support Level</div>
            <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${levelTone[client.level] || 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 transition-colors'}`}>
              {levelLabel[client.level] || client.level}
            </span>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Last Update</div>
            <div className="text-[13px] font-medium text-slate-800 dark:text-slate-200 pl-1">{fmtDate(client.updated)}</div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1">Milestone Progress</div>
          <div className="rounded-xl border border-purple-100 dark:border-purple-900/30 p-4 bg-purple-50/40 dark:bg-purple-900/10">
            <ProgressBar value={client.progress} trackClassName="flex-1" />
          </div>
        </div>

        <div className="space-y-5 pl-1">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Chief Complaint</div>
            <p className={`text-[13.5px] leading-relaxed ${client.chief_complaint ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}`}>
              {client.chief_complaint || 'Not specified'}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Working Diagnosis</div>
            <p className={`text-[13.5px] leading-relaxed ${client.working_diagnosis ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}`}>
              {client.working_diagnosis || 'Not specified'}
            </p>
          </div>
          {intake !== undefined || intakeLoading ? (
            <div className="rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/40 dark:bg-purple-900/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Intake Interview</div>
                {!intakeLoading && intake?.interview_date ? (
                  <span className="rounded-full bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {intake.interview_date}
                  </span>
                ) : null}
              </div>
              {intakeLoading || intake === undefined ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-12 w-full" rounded="rounded-lg" />
                  <Skeleton className="h-16 w-full" rounded="rounded-lg" />
                </div>
              ) : intake === null ? (
                <p className="mt-2 text-[13px] italic text-slate-400">No intake recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-2.5 animate-content-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Informant</div>
                      <div className="mt-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 break-words">{intake.informant || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interview date</div>
                      <div className="mt-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 break-words">{intake.interview_date || '—'}</div>
                    </div>
                  </div>
                  {intakeEntries.map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                        {value || <span className="italic text-slate-400">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

function RosterOverview() {
  const { profile } = useContext(AuthContext) ?? {}
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [viewingIntake, setViewingIntake] = useState(undefined)
  const [query, setQuery] = useState('')
  const [searchParams] = useSearchParams()
  const linkedPatientId = searchParams.get('patientId')
  const [highlightId, setHighlightId] = useState(null)
  const honoredDeepLink = useRef(null)
  const rowRefs = useRef({})

  useEffect(() => {
    let on = true
    api.psychologist.roster().then((d) => on && setClients(d.clients)).catch(() => {}).finally(() => { if (on) setLoading(false) })
    return () => {
      on = false
    }
  }, [])

  // Background refetch for realtime events — same read as the initial load.
  const loadRoster = async () => {
    try {
      const d = await api.psychologist.roster()
      setClients(d.clients)
    } catch {
      /* keep the previous list when a background refresh fails */
    }
  }

  // Live-refresh the roster when students change elsewhere in the clinic.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId ? [{ table: 'patients', filter: `clinic_id=eq.${clinicId}` }] : [],
    () => {
      loadRoster()
    },
  )

  // Supports "Last, First M." — commas become spaces, every token must match.
  const qTokens = query.trim().toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  // A–Z by "LAST, FIRST M.", with the notification-linked student pinned on
  // top so the recent arrival is never buried mid-table.
  const visible = pinStudentFirst(clients
    .filter((c) => {
      if (!qTokens.length) return true
      const haystack = `${c.name || ''} ${formatLastFirstMI(c)} ${c.level || ''}`.toLowerCase().replace(/,/g, ' ')
      return qTokens.every((t) => haystack.includes(t))
    })
    .sort(compareStudentsAZ), linkedPatientId)

  const handleSaved = (updated) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditing(null)
    setViewing(null)
  }

  // Deep-linked from a notification (?patientId=…): clear any stale search
  // filter, scroll the card into view, and flash it so the student the bell
  // pointed at is unmistakable.
  useEffect(() => {
    if (loading || !linkedPatientId || honoredDeepLink.current === linkedPatientId) return
    if (!clients.some((c) => String(c.id) === String(linkedPatientId))) return
    honoredDeepLink.current = linkedPatientId
    setQuery('')
    setHighlightId(linkedPatientId)
    setTimeout(() => {
      rowRefs.current[linkedPatientId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    setTimeout(() => setHighlightId(null), 4000)
  }, [loading, linkedPatientId, clients])

  // Intake background for the viewed student (same read path as the
  // psychometrician roster). Loads on demand when the modal opens.
  useEffect(() => {
    if (!viewing) {
      setViewingIntake(undefined)
      return
    }
    let on = true
    setViewingIntake(undefined)
    api.psychologist
      .intake(viewing.id)
      .then((d) => {
        if (on) setViewingIntake(d.intake || null)
      })
      .catch(() => {
        if (on) setViewingIntake(null)
      })
    return () => {
      on = false
    }
  }, [viewing?.id])

  return (
    <>
      <StaffHeader title="Roster Overview" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="students-workspace">
        <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Student Roster Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
          All assigned students with current Support Level and milestone completion
        </p>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm" data-onboarding-key="students-search">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search students (Last, First M.) or support level…"
          />
        </section>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm" data-onboarding-key="students-roster">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wider text-purple-700 dark:text-purple-300 transition-colors">
                  <th className="py-3 px-4 text-left">Student Name</th>
                  <th className="py-3 px-4 text-center">Support Level</th>
                  <th className="py-3 px-4 text-left">Progress</th>
                  <th className="py-3 px-4 text-left">Last Update</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody key={loading ? 'loading' : 'loaded'} className="divide-y divide-purple-100 dark:divide-slate-800 transition-colors animate-content-fade-in">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="py-3 px-4">
                          <Skeleton className="h-11 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!loading && visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-sm text-slate-400">
                      {qTokens.length ? 'No students match your search.' : 'No assigned students yet.'}
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  visible.map((c) => {
                    const isSelected = (viewing && viewing.id === c.id) || (editing && editing.id === c.id)
                    const isHighlighted = String(highlightId) === String(c.id)
                    return (
                      <tr
                        key={c.id}
                        ref={(el) => {
                          if (el) rowRefs.current[c.id] = el
                          else delete rowRefs.current[c.id]
                        }}
                        className={[
                          'transition-colors',
                          isHighlighted
                            ? 'bg-amber-100/80 dark:bg-amber-900/30 ring-2 ring-inset ring-amber-400'
                            : isSelected
                              ? 'bg-purple-100/70 dark:bg-purple-900/40 font-medium'
                              : 'hover:bg-purple-50/50 dark:hover:bg-slate-800/60',
                          'cursor-pointer',
                        ].join(' ')}
                        onClick={() => setViewing(c)}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 transition-colors">{formatLastFirstMI(c) || c.name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${levelTone[c.level] || 'bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors'}`}>
                            {c.level}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <ProgressBar value={c.progress} />
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 transition-colors">{fmtDate(c.updated)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <RowAction variant="view" onClick={(e) => { e.stopPropagation(); setViewing(c); }} aria-label={`View ${formatLastFirstMI(c) || c.name}`}>
                              View
                            </RowAction>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {!loading && clients.length > 0 ? (
            <p className="mt-4 text-center text-xs text-slate-400">
              {qTokens.length ? `${visible.length} of ${clients.length}` : clients.length} {clients.length === 1 ? 'student' : 'students'}
            </p>
          ) : null}
        </section>
      </div>

      {viewing ? (
        <ViewRosterModal
          client={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
          }}
          intake={viewingIntake}
          intakeLoading={viewingIntake === undefined}
        />
      ) : null}
      {editing ? (
        <EditRosterModal client={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      ) : null}
    </>
  )
}

export default RosterOverview
// Shared with the psychometrician read-only roster: ViewRosterModal hides
// its Edit button when no onEdit handler is passed.
export { ProgressBar, ViewRosterModal }
