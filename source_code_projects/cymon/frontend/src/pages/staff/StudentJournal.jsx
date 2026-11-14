import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffHeader from './StaffHeader'
import { api } from '../../lib/api'
import { compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../lib/format'
import Skeleton, { SkeletonText, SkeletonStudentDirectoryItem } from '../../components/ui/Skeleton'
import SearchBar from '../../components/ui/SearchBar'
import { useAuth } from '../../auth/useAuth'
import { toast } from 'react-hot-toast'
import { CheckCircle2, Lock, Unlock, Download } from 'lucide-react'
import VoiceNotePlayer from '../../components/ui/VoiceNotePlayer'

const MOOD_META = {
  very_bad: { label: 'Very Bad', color: 'bg-red-400 text-white' },
  sad: { label: 'Sad', color: 'bg-orange-400 text-white' },
  okay: { label: 'Okay', color: 'bg-yellow-400 text-slate-800 dark:text-slate-100 transition-colors' },
  good: { label: 'Good', color: 'bg-green-400 text-white' },
  great: { label: 'Great', color: 'bg-emerald-500 text-white' },
}

const METRIC_LABELS = {
  task: {
    label: 'Therapy Tasks',
    values: { yes_all: 'Completed All Tasks', some: 'Some Completed', none: 'None' },
    tones: { yes_all: 'bg-green-100 text-green-800', some: 'bg-yellow-100 text-yellow-800', none: 'bg-red-100 text-red-800' }
  },
  behavior: {
    label: 'Behavioral Episodes',
    values: { none: 'No Episodes (Calm)', mild: 'Mild Episode', significant: 'Significant Episode' },
    tones: { none: 'bg-green-100 text-green-800', mild: 'bg-amber-100 text-amber-800', significant: 'bg-rose-100 text-rose-800' }
  },
  sleep: {
    label: 'Sleep Quality',
    values: { good: 'Slept Well (7+ hrs)', restless: 'Restless Sleep', poor: 'Poor Sleep' },
    tones: { good: 'bg-blue-100 text-blue-800', restless: 'bg-purple-100 text-purple-800 dark:text-purple-300 transition-colors', poor: 'bg-slate-100 text-slate-800 dark:text-slate-100 transition-colors' }
  },
  appetite: {
    label: 'Eating / Appetite',
    values: { good: 'Good Appetite', average: 'Average Appetite', refused: 'Refused Meals' },
    tones: { good: 'bg-emerald-100 text-emerald-800', average: 'bg-amber-100 text-amber-800', refused: 'bg-red-100 text-red-800' }
  }
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''

function JournalDetailModal({ log, onClose }) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  if (!log) return null
  const moodMeta = MOOD_META[log.mood] || MOOD_META.okay

  // Animated exit: fade/zoom out first, unmount after. Matches the shared
  // Modal rhythm (0.2s backdrop, ~0.25s card).
  const handleClose = () => {
    if (closing) return
    setClosing(true)
    timer.current = setTimeout(onClose, 230)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-purple-950/40 p-4 ${closing ? 'animate-[cymonModalFadeOut_0.2s_ease-in_forwards]' : 'animate-fadeIn'}`}>
      <div className={`w-full max-w-2xl rounded-2xl border-2 border-purple-300 bg-white dark:bg-slate-900 transition-colors shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] ${closing ? 'animate-[cymonModalZoomOut_0.22s_ease-in_forwards]' : 'animate-[cymonModalZoom_0.25s_cubic-bezier(0.16,1,0.3,1)_forwards]'}`}>
        {/* Spine margin for realistic notebook feel */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-purple-100 to-transparent" />
        <div className="absolute left-3 top-0 bottom-0 w-px bg-purple-200" />

        <div className="flex-1 pl-10 pr-6 py-6 overflow-y-auto flex flex-col justify-between">
          <div>
            {/* Notebook Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-purple-100 pb-4">
              <div>
                <div className="text-xs font-mono text-purple-600 uppercase tracking-wider">// caregiver observation log</div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors tracking-tight mt-1">
                  {fmtDate(log.log_date)}
                </h2>
              </div>
              <div className="mt-2 sm:mt-0 flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-medium">Student Mood:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${moodMeta.color}`}>
                  {moodMeta.label}
                </span>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-4 py-6 border-b border-purple-50">
              {/* Metric 1 */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-medium">{METRIC_LABELS.task.label}</div>
                <div className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${METRIC_LABELS.task.tones[log.task_completion] || 'bg-slate-100 text-slate-800 dark:text-slate-100 transition-colors'}`}>
                  {METRIC_LABELS.task.values[log.task_completion] || log.task_completion || '—'}
                </div>
              </div>
              {/* Metric 2 */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-medium">{METRIC_LABELS.behavior.label}</div>
                <div className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${METRIC_LABELS.behavior.tones[log.behavioral_episodes] || 'bg-slate-100 text-slate-800 dark:text-slate-100 transition-colors'}`}>
                  {METRIC_LABELS.behavior.values[log.behavioral_episodes] || log.behavioral_episodes || '—'}
                </div>
              </div>
              {/* Metric 3 */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-medium">{METRIC_LABELS.sleep.label}</div>
                <div className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${METRIC_LABELS.sleep.tones[log.sleep_quality] || 'bg-slate-100 text-slate-800 dark:text-slate-100 transition-colors'}`}>
                  {METRIC_LABELS.sleep.values[log.sleep_quality] || log.sleep_quality || '—'}
                </div>
              </div>
              {/* Metric 4 */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-medium">{METRIC_LABELS.appetite.label}</div>
                <div className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${METRIC_LABELS.appetite.tones[log.appetite] || 'bg-slate-100 text-slate-800 dark:text-slate-100 transition-colors'}`}>
                  {METRIC_LABELS.appetite.values[log.appetite] || log.appetite || '—'}
                </div>
              </div>
            </div>

            {/* Notebook Ruled Body */}
            <div className="mt-6">
              <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors font-semibold uppercase tracking-wider mb-2">// Caregiver Notes & Observations</div>
              <div 
                className="p-6 rounded-xl bg-purple-50/30 border border-purple-100 min-h-[220px]"
                style={{
                  backgroundImage: 'linear-gradient(rgba(124, 58, 237, 0.06) 1px, transparent 1px)',
                  backgroundSize: '100% 28px',
                  lineHeight: '28px'
                }}
              >
                <p className="text-slate-700 dark:text-slate-200 transition-colors font-sans text-base whitespace-pre-wrap leading-[28px] pt-1">
                  {log.observations || 'No written observations logged for this day.'}
                </p>
                <VoiceNotePlayer audioUrl={log.audio_play_url || log.audio_url} durationSec={log.audio_duration_sec} />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-purple-100 flex items-center justify-between">
            <div className="text-xs text-slate-400">ClearMind Psychological Services · Client Journal Vault</div>
            <button
              onClick={handleClose}
              className="rounded-md bg-purple-700 hover:bg-purple-800 px-4 py-2 text-sm font-semibold text-white cursor-pointer shadow-sm transition-colors"
            >
              Close Journal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentJournal() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId') || ''
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [logs, setLogs] = useState([])
  const [activeLog, setActiveLog] = useState(null)
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [query, setQuery] = useState('')
  const [journalQuery, setJournalQuery] = useState('')
  const [error, setError] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const roles = [profile?.role, ...(profile?.extra_roles || [])]
  const canManageJournal = ['admin', 'psychologist', 'psychometrician'].some((role) => roles.includes(role))

  // Load patients lookup on mount
  useEffect(() => {
    let on = true
    api.psychometrician.patients()
      .then((d) => {
        if (!on) return
        const roster = d.patients || []
        setPatients(roster)
        // Notification deep links (?patientId=) land on the linked student;
        // otherwise keep the previous first-patient default.
        if (urlPatientId && roster.some((p) => String(p.id) === String(urlPatientId))) {
          setSelectedPatientId(urlPatientId)
        } else if (roster.length > 0) {
          setSelectedPatientId(roster[0].id)
        }
      })
      .catch((err) => setError(err.message || 'Failed to load patients.'))
      .finally(() => {
        if (on) setLoadingPatients(false)
      })
    return () => {
      on = false
    }
  }, [urlPatientId])

  // Follow notification deep links (?patientId=) even when the page is
  // already open on another student.
  useEffect(() => {
    if (!urlPatientId || String(selectedPatientId) === String(urlPatientId)) return
    if (!patients.some((p) => String(p.id) === String(urlPatientId))) return
    setSelectedPatientId(urlPatientId)
  }, [urlPatientId, patients, selectedPatientId])

  // Load logs when selected patient changes
  useEffect(() => {
    if (!selectedPatientId) return
    let on = true
    setLoadingLogs(true)
    setLogs([])
    setJournalQuery('')
    
    api.psychometrician.studentJournal(selectedPatientId)
      .then((d) => {
        if (!on) return
        setLogs(d.logs || [])
      })
      .catch((err) => setError(err.message || 'Failed to fetch student journals.'))
      .finally(() => {
        if (on) setLoadingLogs(false)
      })
    return () => {
      on = false
    }
  }, [selectedPatientId])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  const isAdmissionApproved = selectedPatient?.admission_form_status === 'complete'
  const isConsentApproved = selectedPatient?.waiver_submissions?.some(
    (s) => s.document_type_code === 'CMPS:SE-FO-02' && s.status === 'approved'
  )
  const hasCompletedRequirements = isAdmissionApproved && isConsentApproved

  const filteredPatients = pinStudentFirst(patients.filter((p) =>
    `${p.name || ''} ${formatLastFirstMI(p)}`.toLowerCase().replace(/,/g, ' ').includes(query.trim().toLowerCase().replace(/,/g, ' '))
  ).sort(compareStudentsAZ), urlPatientId)

  const jq = journalQuery.trim().toLowerCase()
  const filteredLogs = logs.filter((log) => {
    if (!jq) return true
    const moodMeta = MOOD_META[log.mood] || MOOD_META.okay
    const matchesDate = fmtDate(log.log_date).toLowerCase().includes(jq)
    const matchesMood = (moodMeta.label || '').toLowerCase().includes(jq)
    const matchesObs = (log.observations || '').toLowerCase().includes(jq)
    return matchesDate || matchesMood || matchesObs
  })

  const handleToggleJournalPermission = (patientId, allowBool) => {
    api.psychometrician.updateJournalPermission(patientId, allowBool)
      .then(() => {
        setPatients((prev) =>
          prev.map((p) => (p.id === patientId ? { ...p, allow_journal_entry: allowBool } : p))
        )
        toast.success(allowBool ? 'Student journal access enabled.' : 'Student journal access disabled.')
      })
      .catch((err) => toast.error(err.message || 'Failed to update journal permission.'))
  }

  const exportJournalReport = () => {
    if (!selectedPatient || logs.length === 0) {
      toast.error('There are no journal entries to export for this student.')
      return
    }
    const headers = [
      'Student',
      'Patient ID',
      'Date',
      'Mood',
      'Therapy Tasks',
      'Behavioral Episodes',
      'Sleep Quality',
      'Eating / Appetite',
      'Observations',
    ]
    const csvRows = logs.map((log) => [
      selectedPatient.name,
      selectedPatient.patient_id || '',
      fmtDate(log.log_date),
      MOOD_META[log.mood]?.label || log.mood || '',
      METRIC_LABELS.task.values[log.task_completion] || log.task_completion || '',
      METRIC_LABELS.behavior.values[log.behavioral_episodes] || log.behavioral_episodes || '',
      METRIC_LABELS.sleep.values[log.sleep_quality] || log.sleep_quality || '',
      METRIC_LABELS.appetite.values[log.appetite] || log.appetite || '',
      log.observations || '',
    ])
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `student-journal-${(selectedPatient.name || 'student').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success('Student journal report exported.')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <StaffHeader title="Student Journal Logs" />
      <div
        className="flex-1 p-6 overflow-hidden flex flex-col"
        data-onboarding-key="student-journal-workspace"
      >
        <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col overflow-hidden">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-100 shrink-0">
              {error}
            </div>
          )}

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 flex-1 overflow-hidden min-h-0">
            
            {/* Left Panel: Students List */}
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 transition-colors border border-purple-200 dark:border-slate-700 transition-colors p-5 shadow-sm h-full flex flex-col overflow-hidden lg:sticky lg:top-0"
              data-onboarding-key="student-journal-directory"
            >
              <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors border-b border-purple-100 pb-3 shrink-0">
                Enrolled Students
              </h2>
              <div className="mt-3 shrink-0">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search students…"
                  className="w-full"
                />
              </div>
              <div key={loadingPatients ? 'loading' : 'loaded'} className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 px-1.5 -mx-1.5 space-y-2 p-2 -m-2 animate-content-fade-in">
                {loadingPatients ? (
                  <div className="space-y-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonStudentDirectoryItem key={i} />
                    ))}
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12">
                    No students found.
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isActive = selectedPatientId === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group ${
                          isActive ? 'border-purple-300 dark:border-purple-700 bg-purple-100 dark:bg-purple-900/40 shadow-sm scale-[1.02] shadow-md' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {p.photo_url || p.patients?.photo_url ? (
                            <img src={p.photo_url || p.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ isActive ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 transition-colors' : 'bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 group-hover:text-purple-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                          <div className={`font-semibold text-sm ${isActive ? 'text-purple-900 dark:text-purple-200' : 'text-slate-800 dark:text-slate-100 transition-colors'}`}>
                            {formatLastFirstMI(p) || p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>ID: {p.patient_id || 'N/A'}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.allow_journal_entry ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors'}`}>
                              {p.allow_journal_entry ? 'Active' : 'Not Yet Allowed'}
                            </span>
                          </div>
                        </div>
                      
                        </div></button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Panel: Student Journal logs */}
            <div
              key={selectedPatientId || 'empty'}
              className="student-directory-panel lg:col-span-2 flex flex-col h-full overflow-hidden lg:overscroll-contain"
              data-onboarding-key="student-journal-logs"
            >
              {selectedPatient ? (
                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                  {/* Selected Student header */}
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h1 className="text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">
                          {selectedPatient.name}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-1">
                          Inspect family-submitted daily logs, activities, and observations. Select a journal entry from the history table below to see its details.
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wide font-bold shadow-sm ${selectedPatient.allow_journal_entry ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                          {selectedPatient.allow_journal_entry ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> Journal Allowed</>
                          ) : (
                            <><Lock className="h-3.5 w-3.5" /> Access Restricted</>
                          )}
                        </span>
                        {canManageJournal && (
                          <button
                            type="button"
                            onClick={exportJournalReport}
                            disabled={!logs.length}
                            className="group inline-flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-purple-50 hover:border-purple-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" /> Export Report
                          </button>
                        )}
                        {canManageJournal && (
                          <div title={!hasCompletedRequirements ? 'Admission and Consent waivers must be approved first.' : ''}>
                            <button
                              onClick={() => setConfirmModal({
                                patientId: selectedPatient.id,
                                allow: !selectedPatient.allow_journal_entry,
                                isLock: selectedPatient.allow_journal_entry,
                              })}
                              disabled={!hasCompletedRequirements}
                              className={`group inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${!hasCompletedRequirements ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'} ${
                                selectedPatient.allow_journal_entry
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 hover:border-rose-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20'
                              }`}
                            >
                              {selectedPatient.allow_journal_entry ? (
                                <><Lock className="h-3.5 w-3.5" /> Disable</>
                              ) : (
                                <><Unlock className="h-3.5 w-3.5" /> Enable Access</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Journal Submissions List Table */}
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-purple-100 pb-3 mb-4 gap-3">
                      <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors uppercase tracking-wider">
                        Caregiver Journal Entries
                      </h3>
                      <div className="w-full sm:w-80 lg:w-96 sm:shrink-0">
                        <SearchBar
                          value={journalQuery}
                          onChange={setJournalQuery}
                          placeholder="Search date, mood, notes…"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 transition-colors">
                          <tr className="text-xs font-semibold tracking-wider text-purple-700 border-b border-purple-100">
                            <th className="py-2.5 px-3 text-left">Date</th>
                            <th className="py-2.5 px-3 text-left">Mood</th>
                            <th className="py-2.5 px-3 text-left">Therapy Tasks</th>
                            <th className="py-2.5 px-3 text-left">Behavioral Episodes</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/40">
                          {loadingLogs ? (
                            Array.from({ length: 3 }).map((_, idx) => (
                              <tr key={idx}>
                                <td className="py-3 px-3"><Skeleton className="h-4 w-28" /></td>
                                <td className="py-3 px-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
                                <td className="py-3 px-3"><Skeleton className="h-4 w-24" /></td>
                                <td className="py-3 px-3"><Skeleton className="h-4 w-24" /></td>
                                <td className="py-3 px-3 text-right"><Skeleton className="h-8 w-20 ml-auto rounded-md" /></td>
                              </tr>
                            ))
                          ) : filteredLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                                {journalQuery ? 'No journal entries match your search.' : 'No journal submissions logged for this student yet.'}
                              </td>
                            </tr>
                          ) : (
                            filteredLogs.map((log) => {
                              const moodMeta = MOOD_META[log.mood] || MOOD_META.okay
                              return (
                                <tr key={log.id} className="hover:bg-purple-50/20 transition-colors">
                                  <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-100 transition-colors">
                                    {fmtDate(log.log_date)}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${moodMeta.color}`}>
                                      {moodMeta.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 transition-colors">
                                    {METRIC_LABELS.task.values[log.task_completion] || log.task_completion || '—'}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 transition-colors">
                                    {METRIC_LABELS.behavior.values[log.behavioral_episodes] || log.behavioral_episodes || '—'}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <span className="mr-2 inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600">
                                      {log.audio_url ? '🎙️ voice' : ''}
                                    </span>
                                    <button
                                      onClick={() => setActiveLog(log)}
                                      className="rounded-md bg-purple-700 hover:bg-purple-800 px-3 py-1 text-xs font-semibold text-white transition-all shadow-sm cursor-pointer"
                                    >
                                      Read Entry
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-12 text-center text-slate-500 dark:text-slate-400 transition-colors shadow-sm flex flex-col items-center justify-center h-full">
                  <svg className="h-16 w-16 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="mt-4 text-sm font-medium">Please select a student from the list to view their journal logs</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {activeLog && (
        <JournalDetailModal log={activeLog} onClose={() => setActiveLog(null)} />
      )}

      {confirmModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#120c1d]/60 backdrop-blur-sm p-4 animate-[cymonModalFade_0.2s_ease-out]"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 transition-colors rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-[cymonModalZoom_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-6 text-center ${confirmModal.isLock ? 'bg-rose-50 dark:bg-rose-950' : 'bg-emerald-50 dark:bg-emerald-950'}`}>
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${confirmModal.isLock ? 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400'}`}>
                {confirmModal.isLock ? <Lock className="h-7 w-7" /> : <Unlock className="h-7 w-7" />}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmModal.isLock ? 'Disable Journal?' : 'Enable Journal?'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 transition-colors leading-relaxed">
                {confirmModal.isLock
                  ? 'Are you sure you want to disable this student\'s journal? The student will no longer be able to submit journal entries.'
                  : 'Are you sure you want to enable this student\'s journal? The student will be allowed to answer and submit journal entries.'}
              </p>
            </div>
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-950 transition-colors border-t border-slate-100 dark:border-slate-800 transition-colors">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors bg-white dark:bg-slate-900 transition-colors border border-slate-200 dark:border-slate-800 transition-colors hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleToggleJournalPermission(confirmModal.patientId, confirmModal.allow)
                  setConfirmModal(null)
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
                  confirmModal.isLock
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.isLock ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentJournal
