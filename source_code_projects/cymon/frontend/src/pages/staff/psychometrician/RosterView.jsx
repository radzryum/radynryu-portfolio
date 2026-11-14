import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffHeader from '../StaffHeader'
import { AuthContext } from '../../../auth/AuthContext'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import RowAction from '../../../components/ui/RowAction'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import { levelTone, fmtDate } from '../../../lib/rosterMeta'
import {
  ProgressBar,
  ViewRosterModal,
} from '../psychologist/RosterOverview'

// Psychometrician Student Roster — strictly read-only. The backend GET
// /api/psychologist/roster already scopes to the psychometrician's assigned
// students, and PATCH /roster rejects non-psychologist roles, so this page
// never offers (or calls) any edit action.
function PsychometricianRoster() {
  // Direct context (not useAuth) so the hook stays idle without a user id
  // when rendered outside a provider.
  const { profile } = useContext(AuthContext) || {}
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [intake, setIntake] = useState(undefined)
  const [query, setQuery] = useState('')
  const [searchParams] = useSearchParams()
  const linkedPatientId = searchParams.get('patientId')
  const [highlightId, setHighlightId] = useState(null)
  const honoredDeepLink = useRef(null)
  const rowRefs = useRef({})

  const loadRoster = () =>
    api.psychologist
      .roster()
      .then((d) => {
        setClients(d.clients || [])
      })
      .catch(() => {})

  useEffect(() => {
    let on = true
    loadRoster().finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
  }, [])

  // Live-refresh the assigned-student list when the roster changes
  // (psychologist edits). RLS already scopes delivery to assigned students.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId ? [{ table: 'patients', filter: `clinic_id=eq.${clinicId}` }] : [],
    loadRoster,
  )

  // Supports "Last, First M." — commas become spaces, every token must match.
  // A–Z by "LAST, FIRST M." with the notification-linked student pinned on top.
  const qTokens = query.trim().toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  const visible = pinStudentFirst(clients
    .filter((c) => {
      if (!qTokens.length) return true
      const haystack = `${c.name || ''} ${formatLastFirstMI(c)} ${c.level || ''}`.toLowerCase().replace(/,/g, ' ')
      return qTokens.every((t) => haystack.includes(t))
    })
    .sort(compareStudentsAZ), linkedPatientId)

  // Deep-linked from a notification (?patientId=…): clear any stale search
  // filter, scroll the row into view, and flash it so the assigned student is
  // easy to spot.
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

  // Read-only intake background for the viewed student. Loads on demand so
  // the directory stays fast; never editable from this side.
  useEffect(() => {
    if (!viewing) {
      setIntake(undefined)
      return
    }
    let on = true
    setIntake(undefined)
    api.psychologist
      .intake(viewing.id)
      .then((d) => {
        if (on) setIntake(d.intake || null)
      })
      .catch(() => {
        if (on) setIntake(null)
      })
    return () => {
      on = false
    }
  }, [viewing?.id])

  return (
    <>
      <StaffHeader title="Students" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="student-roster-workspace">
        <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Students</h1>
        <PageSubtitle>
          Your assigned students with support levels and milestone progress. Viewing only — updates are made by the psychologist.
        </PageSubtitle>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm" data-onboarding-key="student-roster-search">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search students (Last, First M.) or support level…"
          />
        </section>

        <section className="mt-5 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm" data-onboarding-key="student-roster-list">
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
              <tbody className="divide-y divide-purple-100 dark:divide-slate-800 transition-colors">
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
                  visible.map((c) => (
                    <tr
                      key={c.id}
                      ref={(el) => {
                        if (el) rowRefs.current[c.id] = el
                        else delete rowRefs.current[c.id]
                      }}
                      className={[
                        'transition-colors cursor-pointer',
                        String(highlightId) === String(c.id)
                          ? 'bg-amber-100/80 dark:bg-amber-900/30 ring-2 ring-inset ring-amber-400'
                          : 'hover:bg-purple-50/50 dark:hover:bg-slate-800/60',
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
                  ))}
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
          intake={intake}
          intakeLoading={intake === undefined}
        />
      ) : null}
    </>
  )
}

export default PsychometricianRoster
