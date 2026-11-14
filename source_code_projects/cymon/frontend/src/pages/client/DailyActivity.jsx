import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import PageHeader from './PageHeader'
import DatePicker from '../../components/ui/DatePicker'
import PageIntro from '../../components/ui/PageIntro'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Button from '../../components/ui/Button'
import SearchBar from '../../components/ui/SearchBar'
import Skeleton from '../../components/ui/Skeleton'
import ClientSubmissionConfirmation from '../../components/ui/ClientSubmissionConfirmation'
import DeleteModal from '../../components/ui/DeleteModal'
import VoiceNotePlayer from '../../components/ui/VoiceNotePlayer'
import { api } from '../../lib/api'
import { Angry, Frown, Meh, Smile, Laugh, Lock, Mic, Square, Trash2, CheckCircle2 } from 'lucide-react'
import Fairy3D from '../../components/ui/Fairy3D'
import Modal from '../../components/ui/Modal'
import { playFairyVoice, playTakeLine, stopFairyVoice } from '../../lib/voiceBuddy'
import { playIntroSfx } from '../../lib/fairySfx'
import useVoiceRecorder from '../../hooks/useVoiceRecorder'

const MOODS = [
  { id: 'very_bad', label: 'Very Bad', color: 'text-red-500', bg: 'bg-red-500/15', icon: Angry },
  { id: 'sad', label: 'Sad', color: 'text-orange-500', bg: 'bg-orange-500/15', icon: Frown },
  { id: 'okay', label: 'Okay', color: 'text-yellow-500', bg: 'bg-yellow-500/15', icon: Meh },
  { id: 'good', label: 'Good', color: 'text-green-500', bg: 'bg-green-500/15', icon: Smile },
  { id: 'great', label: 'Great', color: 'text-emerald-500', bg: 'bg-emerald-500/15', icon: Laugh },
]

const TASK_LABEL = { yes_all: 'Yes, all', some: 'Some', none: 'None' }
const TASK_DOT = { yes_all: 'bg-green-500', some: 'bg-yellow-500', none: 'bg-red-500' }

const JOURNAL_STATUS = {
  not_started: { label: 'Daily Journal not yet started', cls: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  completed: { label: 'Daily Journal completed — not yet submitted', cls: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  submitted: { label: 'Daily Journal submitted', cls: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
}
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const todayKey = () => localDateKey(new Date())
const parseLocalDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : new Date(value)
}
const fmtDate = (d) =>
  d ? parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const weekday = (d) => parseLocalDate(d).toLocaleDateString('en-US', { weekday: 'short' })

function MoodChart({ series }) {
  const max = 5
  const width = 320
  const height = 120
  if (!series || series.length < 2) {
    return <div className="flex h-32 items-center justify-center text-sm text-slate-400">Not enough data yet</div>
  }
  const points = series.map((s) => s.score)
  const step = width / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - (p / max) * height}`)
    .join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="h-32 w-full">
        <path d={path} stroke="#7c3aed" strokeWidth="2.5" fill="none" />
        {points.map((p, i) => (
          <circle key={i} cx={i * step} cy={height - (p / max) * height} r="3" fill="#7c3aed" />
        ))}
        {series.map((s, i) => (
          <text key={i} x={i * step} y={height + 16} fontSize="9" fill="#64748b" textAnchor="middle">
            {weekday(s.date)}
          </text>
        ))}
      </svg>
    </div>
  )
}

// Done button for the voice modal. Modal injects its animated handleClose as
// onClose, so Done fades out smoothly instead of vanishing instantly.
function VoiceModalFooter({ onClose, onDone }) {
  return (
    <div className="flex justify-end gap-2 w-full">
      <button
        type="button"
        onClick={() => {
          onDone?.()
          onClose?.()
        }}
        className="rounded-lg bg-purple-700 px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-purple-800"
      >
        Done
      </button>
    </div>
  )
}

function DailyActivity() {
  const [activeDate, setActiveDate] = useState(() => todayKey())
  const [currentDate, setCurrentDate] = useState(() => todayKey())
  const [mood, setMood] = useState('')
  const [taskCompletion, setTaskCompletion] = useState('')
  const [behavioral, setBehavioral] = useState('')
  const [sleep, setSleep] = useState('')
  const [appetite, setAppetite] = useState('')
  const [observations, setObservations] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logs, setLogs] = useState([])
  const [series, setSeries] = useState([])
  const [allowJournalEntry, setAllowJournalEntry] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [existingAudioUrl, setExistingAudioUrl] = useState(null)
  const [existingAudioDur, setExistingAudioDur] = useState(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  // Card-Retake flow: the retake voice plays as the modal opens (not the
  // normal greeting). The in-modal Retake button then starts silently so her
  // voice never plays twice in a row.
  const retakeHeardRef = useRef(false)
  // True when the take being recorded is a redo (drives the thanks mapping
  // at stop, since clearing wipes the evidence a retake happened).
  const wasRetakeRef = useRef(false)
  // Blocks double-taps while her retake line is still playing.
  const linePlayingRef = useRef(false)
  // Retake confirmation dialog + whether the take in view is brand-new
  // (just stopped) or a previous one awaiting retake.
  const [confirmingRetake, setConfirmingRetake] = useState(false)
  const [freshTake, setFreshTake] = useState(false)
  // Retake UX: after her encouragement line she waits for the user to tap
  // Start instead of auto-recording (the auto-start felt abrupt, and the
  // dead button mid-line was confusing). `armed` = a Start tap begins
  // recording immediately. `linePlaying` mirrors linePlayingRef for UI.
  const [armed, setArmed] = useState(false)
  const [linePlaying, setLinePlaying] = useState(false)
  // Delete UX: fade the note out first, then wipe the take once the
  // animation finishes (300ms). Shared by the modal and inline players —
  // both show the same take, so both animate together.
  const [noteLeaving, setNoteLeaving] = useState(false)
  const removeTake = () => {
    if (noteLeaving) return
    setNoteLeaving(true)
    window.setTimeout(() => {
      recorder.clear()
      setNoteLeaving(false)
    }, 300)
  }

  // Starts recording right now (user tapped Start while armed, or a first
  // take). Never plays a voice line — the caller handles that first.
  const beginRecordingNow = () => {
    stopFairyVoice()
    setArmed(false)
    recorder.start()
  }

  // Single entry point for (re)starting a recording from the modal.
  // First takes record at once. Retakes play her encouragement line once per
  // session (or stay silent after that), then ARM the Start button — the user
  // taps when ready. Nothing auto-records anymore.
  const startVoiceRecording = () => {
    if (linePlayingRef.current) return
    const isRetake = Boolean(recorder.audioBlob || recorder.audioUrl || existingAudioUrl)
    wasRetakeRef.current = isRetake
    // A redo wipes the old take from the modal first — only the fresh
    // recording shows after stopping.
    if (isRetake) recorder.clear()
    if (retakeHeardRef.current || !isRetake) {
      // Heard already, or first take: silence her, then record at once for
      // first takes, or arm Start for retakes.
      stopFairyVoice()
      if (isRetake) setArmed(true)
      else recorder.start()
    } else {
      // First retake of this session: her encouragement line plays once,
      // then she waits for the user's tap.
      retakeHeardRef.current = true
      stopFairyVoice()
      linePlayingRef.current = true
      setLinePlaying(true)
      playTakeLine(mood, 'retake', () => {
        linePlayingRef.current = false
        setLinePlaying(false)
        setArmed(true)
      })
    }
  }

  // Single close path for the voice modal (X, backdrop, Escape, Done all
  // funnel here). Safe to run twice: recorder stop is state-guarded.
  const closeVoiceModal = () => {
    if (recorder.recording) recorder.stop()
    stopFairyVoice()
    retakeHeardRef.current = false
    linePlayingRef.current = false
    setLinePlaying(false)
    setArmed(false)
    setFreshTake(false)
    setVoiceModalOpen(false)
  }

  // Done-button pre-step: stop everything now so the mic dies instantly,
  // then Modal's own animated handleClose plays the fade-out.
  const stopVoiceWork = () => {
    if (recorder.recording) recorder.stop()
    stopFairyVoice()
    retakeHeardRef.current = false
    linePlayingRef.current = false
    setLinePlaying(false)
    setArmed(false)
    setFreshTake(false)
  }
  const recorder = useVoiceRecorder(120)

  // Playback URLs are minted by the backend (service-role): this browser
  // holds no Supabase Auth session, so direct signed-URL calls fail RLS.
  // Derived during render — no effect needed.
  const activeLog = logs.find((l) => l.log_date === activeDate)
  const existingPlayUrl = activeLog?.audio_play_url
    || (/^https?:\/\//i.test(activeLog?.audio_url || '') ? activeLog.audio_url : null)

  const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // Foreground flower-bed grow style: each bloom scales up from the ground
  // (staggered via delay) like growing flowers in front of the fairy.
  // Base 1.4s: blooms wait until her fly-in + dust settle — stacking them
  // on top of the model load caused the entrance jank.
  const flowerGrow = (delay) => ({
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
    animation: 'flower-grow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
    animationDelay: `calc(${delay} + 1.4s)`,
  })
  // Grass grows first (~1s), blooms follow — same keyframes, earlier timing.
  const grassGrow = (delay) => ({
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
    animation: 'flower-grow 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
    animationDelay: delay,
  })

  const hq = historyQuery.trim().toLowerCase()
  const filteredLogs = logs.filter((l) => {
    if (!hq) return true
    const matchesDate = fmtDate(l.log_date).toLowerCase().includes(hq)
    const matchesObs = (l.observations || '').toLowerCase().includes(hq)
    const moodLabel = MOODS.find(m => m.id === l.mood)?.label || ''
    const matchesMood = moodLabel.toLowerCase().includes(hq)
    return matchesDate || matchesObs || matchesMood
  })

  // syncForm=false is for background refreshes (tab focus, realtime
  // notification events): permission + history update, but in-progress
  // typing is never overwritten.
  const load = (targetDate = activeDate, { syncForm = true } = {}) =>
    api.client.activityLogs().then((d) => {
      setLogs(d.logs || [])
      setSeries(d.moodSeries || [])
      setAllowJournalEntry(Boolean(d.allow_journal_entry))

      if (!syncForm) return
      // Sync form fields with selected date
      const found = (d.logs || []).find((l) => l.log_date === targetDate)
      if (found) {
        setMood(found.mood)
        setTaskCompletion(found.task_completion || '')
        setBehavioral(found.behavioral_episodes || '')
        setSleep(found.sleep_quality || '')
        setAppetite(found.appetite || '')
        setObservations(found.observations || '')
        setExistingAudioUrl(found.audio_url || null)
        setExistingAudioDur(found.audio_duration_sec || null)
      } else {
        // No entry yet: leave the feeling unpicked so nothing is preselected.
        setMood('')
        setTaskCompletion('')
        setBehavioral('')
        setSleep('')
        setAppetite('')
        setObservations('')
        setExistingAudioUrl(null)
        setExistingAudioDur(null)
      }
      recorder.clear()
    })

  useEffect(() => {
    let on = true
    const initialToday = todayKey()
    setCurrentDate(initialToday)
    load(initialToday)
      .catch(() => {})
      .finally(() => {
        if (on) setLoading(false)
      })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const refreshCurrentDate = () => {
      const nextToday = todayKey()
      setCurrentDate((previousToday) => {
        if (previousToday !== nextToday) {
          setActiveDate((selectedDate) =>
            selectedDate === previousToday ? nextToday : selectedDate,
          )
        }
        return nextToday
      })
    }

    const timer = window.setInterval(refreshCurrentDate, 60_000)
    window.addEventListener('focus', refreshCurrentDate)
    document.addEventListener('visibilitychange', refreshCurrentDate)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshCurrentDate)
      document.removeEventListener('visibilitychange', refreshCurrentDate)
    }
  }, [])

  // Freshness: the journal permission can flip while this page is open (the
  // bell already arrives instantly via Realtime). Refetch data — without
  // touching in-progress form input — on tab focus, on becoming visible,
  // and on the shared notification-update event the bell dispatches.
  useEffect(() => {
    const refreshData = () => {
      load(activeDate, { syncForm: false }).catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshData()
    }
    window.addEventListener('focus', refreshData)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('cymon:notification-update', refreshData)
    return () => {
      window.removeEventListener('focus', refreshData)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('cymon:notification-update', refreshData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate])

  const handleSelectLog = (s) => {
    setActiveDate(s.log_date)
    setMood(s.mood)
    setTaskCompletion(s.task_completion || '')
    setBehavioral(s.behavioral_episodes || '')
    setSleep(s.sleep_quality || '')
    setAppetite(s.appetite || '')
    setObservations(s.observations || '')
    setExistingAudioUrl(s.audio_url || null)
    setExistingAudioDur(s.audio_duration_sec || null)
    recorder.clear()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!allowJournalEntry) {
      toast.error('Journal writing for this student is locked by your Psychologist.')
      return
    }
    // Backend rejects empty moods (400), so require a feeling first.
    if (!mood) {
      toast.error('Please pick how you feel first.')
      return
    }
    // One journal, two channels: notes, audio, or both at once. Text is
    // required only when no audio is attached; audio always needs the
    // four daily metrics (same rules as the old write/voice tabs).
    const wroteText = Boolean(observations.trim())
    const hasAudio = Boolean(recorder.audioBlob || existingAudioUrl)
    if (!wroteText && !hasAudio) {
      toast.error('Please write your journal entry or record your voice with CyMon.')
      return
    }
    if (hasAudio) {
      if (!taskCompletion) {
        toast.error('Please select therapy task completion.')
        return
      }
      if (!behavioral) {
        toast.error('Please select behavioral episodes for today.')
        return
      }
      if (!sleep) {
        toast.error('Please select sleep quality.')
        return
      }
      if (!appetite) {
        toast.error('Please select appetite for today.')
        return
      }
    }

    setConfirmingSubmit(true)
  }

  // Uploads through the backend (service-role storage): direct browser
  // uploads fail storage RLS because this app uses custom backend auth.
  const uploadVoiceNote = async () => {
    if (!recorder.audioBlob) return { url: existingAudioUrl, dur: existingAudioDur }
    setUploadingAudio(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Could not read the recording. Please record again.'))
        reader.readAsDataURL(recorder.audioBlob)
      })
      const up = await api.client.voiceUpload({
        audio_base64: dataUrl,
        content_type: recorder.audioBlob.type || 'audio/webm',
        log_date: activeDate,
        duration_sec: recorder.seconds || null,
      })
      if (!up || !up.url) throw new Error('Upload returned no file. Please try again.')
      return { url: up.url, dur: recorder.seconds || null }
    } finally {
      setUploadingAudio(false)
    }
  }

  const submitJournal = async () => {
    setSubmitting(true)
    try {
      let audio_url = existingAudioUrl
      let audio_duration_sec = existingAudioDur
      if (recorder.audioBlob) {
        try {
          const up = await uploadVoiceNote()
          audio_url = up.url
          audio_duration_sec = up.dur
        } catch (err) {
          // Surface the real storage error (e.g. missing bucket/RLS) so it
          // can be diagnosed instead of failing silently.
          console.error('[voice journal] upload failed:', err?.message || err)
          toast.error(err?.message ? `Voice upload failed: ${err.message}` : 'Voice upload failed. Please try again.')
          setSubmitting(false)
          setConfirmingSubmit(false)
          return
        }
      }
      await api.client.addActivityLog({
        log_date: activeDate,
        mood,
        task_completion: taskCompletion || null,
        behavioral_episodes: behavioral || null,
        sleep_quality: sleep || null,
        appetite: appetite || null,
        observations: observations.trim(),
        audio_url,
        audio_duration_sec,
      })

      const isUpdate = logs.some((l) => l.log_date === activeDate)
      toast.success(isUpdate ? 'Journal entry updated!' : 'Journal entry submitted!')

      setConfirmingSubmit(false)
      await load(activeDate)
    } catch (err) {
      setConfirmingSubmit(false)
      toast.error(err.message || 'Failed to submit log.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!allowJournalEntry) {
      toast.error('Journal editing for this student is locked by your Psychologist.')
      return
    }
    const found = logs.find((l) => l.log_date === activeDate)
    if (!found) return

    setSubmitting(true)
    try {
      await api.client.deleteActivityLog(found.id)
      toast.success('Journal entry deleted.')
      await load(activeDate)
    } finally {
      setSubmitting(false)
    }
  }

  const submittedToday = logs.some((l) => l.log_date === currentDate)
  const currentLogsToday = logs.find((l) => l.log_date === activeDate)
  const hasVoice = Boolean(recorder.audioBlob || existingAudioUrl)
  const journalStatus = submittedToday ? 'submitted' : ((currentLogsToday?.observations || observations).trim() || hasVoice || currentLogsToday?.audio_url) ? 'completed' : 'not_started'
  const status = JOURNAL_STATUS[journalStatus]
  const journalLocked = !allowJournalEntry

  return (
    <>
      <ClientSubmissionConfirmation
        open={confirmingSubmit}
        onCancel={() => setConfirmingSubmit(false)}
        onConfirm={submitJournal}
        submitting={submitting}
        title={logs.some((l) => l.log_date === activeDate) ? 'Confirm journal update' : 'Confirm journal submission'}
        confirmLabel={logs.some((l) => l.log_date === activeDate) ? 'Yes, update journal' : 'Yes, submit journal'}
      />
      {confirmingDelete ? (
        <DeleteModal
          title="Delete Journal Entry?"
          text="Are you sure you want to delete this journal entry? This action is permanent."
          itemName={fmtDate(activeDate)}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      ) : null}
      <PageHeader title="Daily Journal" />
      <div data-onboarding-key="client-activity-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
        <PageIntro
          title="Daily Journal"
          subtitle="Record daily observations and progress."
          className="hidden sm:block mb-3 sm:mb-4"
        />
        <style>{`
          @keyframes voice-note-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .voice-note-in { animation: voice-note-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
          @keyframes voice-note-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(8px) scale(0.97); } }
          .note-leaving { animation: voice-note-out 0.3s ease-in both; }
          @media (prefers-reduced-motion: reduce) { .voice-note-in, .note-leaving { animation: none; } }
        `}</style>
        {!loading && journalLocked && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/50 dark:to-orange-950/30 p-4 sm:p-5 text-amber-900 dark:text-amber-200 shadow-sm flex items-start gap-3.5 animate-fadeIn mb-4 transition-colors">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100/80 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shadow-sm transition-colors">
              <Lock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm sm:text-base text-amber-900 dark:text-amber-300 transition-colors">Unable to Access Daily Journal</div>
              <div className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-200/80 mt-1 leading-relaxed transition-colors">
                Students and caregivers won't be able to submit or edit daily journal entries. If you need to log entries, please ask permission to your assigned Psychometrician.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 sm:gap-5 lg:grid-cols-3">
          <section data-onboarding-key="client-activity-form" className={`rounded-2xl bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs lg:col-span-2 transition-colors ${journalLocked ? 'opacity-70' : ''}`}>
            <div className="flex flex-col gap-2.5 border-b border-purple-100 dark:border-slate-800 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-400 shrink-0 transition-colors">Journal Date:</span>
                <DatePicker
                  value={activeDate}
                  max={currentDate}
                  disabled={journalLocked}
                  onChange={(selected) => {
                    if (selected) {
                      setActiveDate(selected)
                      const found = logs.find((l) => l.log_date === selected)
                      if (found) {
                        setMood(found.mood)
                        setTaskCompletion(found.task_completion || '')
                        setBehavioral(found.behavioral_episodes || '')
                        setSleep(found.sleep_quality || '')
                        setAppetite(found.appetite || '')
                        setObservations(found.observations || '')
                        setExistingAudioUrl(found.audio_url || null)
                        setExistingAudioDur(found.audio_duration_sec || null)
                      } else {
                        setMood('')
                        setTaskCompletion('')
                        setBehavioral('')
                        setSleep('')
                        setAppetite('')
                        setObservations('')
                        setExistingAudioUrl(null)
                        setExistingAudioDur(null)
                      }
                      recorder.clear()
                    }
                  }}
                  className="w-full sm:w-auto"
                  ariaLabel="Journal date"
                />
              </div>
              {activeDate !== currentDate && (
                <button
                  type="button"
                  disabled={journalLocked}
                  onClick={() => {
                    setActiveDate(currentDate)
                    const found = logs.find((l) => l.log_date === currentDate)
                    if (found) {
                      setMood(found.mood)
                      setTaskCompletion(found.task_completion || '')
                      setBehavioral(found.behavioral_episodes || '')
                      setSleep(found.sleep_quality || '')
                      setAppetite(found.appetite || '')
                      setObservations(found.observations || '')
                      setExistingAudioUrl(found.audio_url || null)
                      setExistingAudioDur(found.audio_duration_sec || null)
                    } else {
                      setMood('')
                      setTaskCompletion('')
                      setBehavioral('')
                      setSleep('')
                      setAppetite('')
                      setObservations('')
                      setExistingAudioUrl(null)
                      setExistingAudioDur(null)
                    }
                    recorder.clear()
                  }}
                  className="rounded-md border border-purple-200 dark:border-purple-500/50 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 self-start sm:self-auto transition-colors"
                >
                  &larr; Go to Today
                </button>
              )}
            </div>

            <div className={`relative mt-3 flex flex-col gap-1.5 transition-colors ${journalLocked ? 'pointer-events-none opacity-70' : ''}`}>
              <label className="text-xs sm:text-sm font-semibold text-purple-800 dark:text-purple-400 transition-colors">
                Observations & Daily Journal
              </label>
              <div className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-xs transition-colors ${!allowJournalEntry ? 'border-amber-200 dark:border-slate-700 bg-amber-50/20 dark:bg-slate-900/50 opacity-80' : 'border-purple-200 dark:border-slate-700'}`}>
                {/* Spine notebook margin effect */}
                <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-purple-100 dark:from-slate-700 to-transparent transition-colors" />
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-purple-200 dark:bg-slate-600 transition-colors" />

                <textarea
                  rows={5}
                  disabled={journalLocked}
                  className="w-full border-none bg-transparent pl-3 text-sm sm:text-base leading-[26px] sm:leading-[28px] font-sans text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none disabled:cursor-not-allowed disabled:text-slate-400 sm:pl-5 transition-colors"
                  style={{
                    backgroundImage: 'linear-gradient(var(--grid-line-color, rgba(124, 58, 237, 0.08)) 1px, transparent 1px)',
                    backgroundSize: '100% 28px',
                    lineHeight: '28px',
                    paddingTop: '2px'
                  }}
                  placeholder={journalLocked ? "Journal writing is currently locked by your Psychologist." : "How did the day go? Note any new behaviors, concerns, wins, or anything worth recording..."}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </div>
              <div className="mt-1.5 flex items-center text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 transition-colors">
                {allowJournalEntry ? (
                  hasVoice ? 'Optional — audio attached. Notes are a bonus.' : 'Required — please complete journal entry.'
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                    Permission required to submit.
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-5 border-t border-purple-50 dark:border-slate-800 pt-4 transition-colors">
              <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                How was their general mood today?
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1 sm:gap-2">
                {MOODS.map((m) => {
                  const selected = mood === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={journalLocked}
                      onClick={() => setMood(m.id)}
                      className={[
                        'group flex flex-col items-center justify-center rounded-lg border px-1 py-2 sm:py-2.5 transition disabled:cursor-not-allowed disabled:opacity-50',
                        selected
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 shadow-xs scale-105 transform'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
                        journalLocked ? '' : 'cursor-pointer hover:border-purple-300 dark:hover:border-purple-600',
                      ].join(' ')}
                    >
                      <div className={`mb-1.5 p-1.5 sm:p-2 rounded-full transition-colors ${selected ? m.color + ' ' + m.bg : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                        <m.icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                      </div>
                      <span className="text-[10px] sm:text-xs font-semibold truncate max-w-full">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-purple-200 dark:border-slate-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 p-4 sm:p-5 text-center transition-colors">
              <img src="/logo-cymon.png" alt="CyMon logo" className="mx-auto h-12 w-12 object-contain" />
              <div className="mt-1 text-sm sm:text-base font-bold text-purple-800 dark:text-purple-300">Voice journal with CyMon</div>
              <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                CyMon is here and ready to listen to you. Tap the button below and share your day with her.
              </p>
              {(recorder.audioUrl || existingAudioUrl) && !recorder.recording ? (
                <div key={`${recorder.audioUrl || ''}|${existingAudioUrl || ''}`} className={`${noteLeaving ? 'note-leaving' : 'voice-note-in'} mx-auto mt-3 flex w-full max-w-md flex-col items-center gap-1.5`}>
                  {recorder.audioUrl ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Audio recorded successfully
                    </p>
                  ) : null}
                  {recorder.audioUrl ? (
                    <VoiceNotePlayer audioUrl={recorder.audioUrl} durationSec={recorder.seconds} onRemove={removeTake} />
                  ) : existingPlayUrl ? (
                    <VoiceNotePlayer audioUrl={existingPlayUrl} durationSec={existingAudioDur} />
                  ) : (
                    <p className="text-xs font-semibold text-emerald-800">Saved voice ({existingAudioDur ? fmtSec(existingAudioDur) : 'audio'})</p>
                  )}
                </div>
              ) : null}
              <div>
                <button
                  type="button"
                  disabled={journalLocked}
                  onClick={() => {
                    // A feeling is required before she opens the portal.
                    if (!mood) {
                      toast.error('Please select how you feel first.')
                      return
                    }
                    const hasAudio = Boolean(recorder.audioUrl || existingAudioUrl)
                    setVoiceModalOpen(true)
                    // A take made earlier this session reads as "previous"
                    // until a fresh stop marks it new again.
                    setFreshTake(false)
                    // Intro SFX under her greeting, matched to the feeling.
                    playIntroSfx(mood)
                    if (hasAudio) {
                      // Retake flow: modal opens straight to the retake voice.
                      retakeHeardRef.current = true
                      playFairyVoice(mood, 'retake')
                    } else {
                      retakeHeardRef.current = false
                      playFairyVoice(mood, 'greeting')
                    }
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-purple-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {(recorder.audioUrl || existingAudioUrl) ? 'Retake' : 'Record now'}
                </button>
              </div>
              {recorder.error ? <p className="mt-2 text-xs text-rose-600">{recorder.error}</p> : null}
              {uploadingAudio ? <p className="mt-2 text-xs text-purple-600">Uploading your voice…</p> : null}
            </div>
            {voiceModalOpen ? (
              <Modal
                title={<><span>Voice journal with CyMon</span><img src="/logo-cymon.png" alt="CyMon logo" className="h-7 w-7 object-contain" /></>}
                subtitle="She listens first — then your doctors can listen too."
                onClose={closeVoiceModal}
                maxWidth="max-w-2xl"
                footer={<VoiceModalFooter onDone={stopVoiceWork} />}
              >
                <style>{`
                  @keyframes cymon-portal-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @keyframes cymon-portal-breathe { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
                  @keyframes cymon-twinkle { 0%, 100% { opacity: 0.15; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.25); } }
                  @keyframes cymon-nebula-a { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(24px, -18px) scale(1.15); } }
                  @keyframes cymon-nebula-b { 0%, 100% { transform: translate(0, 0) scale(1.1); } 50% { transform: translate(-20px, 16px) scale(1); } }
                  @keyframes cymon-appear-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
                  @keyframes cymon-ring-burst { 0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.3); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25); } }
                  /* Record button — adapted from Uiverse.io by Wendell47, themed purple. */
                  .cymon-record-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 15px 30px; border: 0; position: relative; overflow: hidden; border-radius: 10rem; font-weight: bold; cursor: pointer; color: #fff; z-index: 0; background: linear-gradient(90deg, #7c3aed, #d946ef); box-shadow: 0 8px 30px -6px rgba(147, 51, 234, 0.7); transition: transform 0.15s ease, box-shadow 0.3s ease, filter 0.3s ease; }
                  .cymon-record-btn:hover { filter: brightness(1.12); box-shadow: 0 10px 36px -6px rgba(217, 70, 239, 0.85); }
                  .cymon-record-btn:active { transform: scale(0.97); }
                  .cymon-record-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
                  .cymon-record-btn > *:not(.hoverEffect) { position: relative; z-index: 2; }
                  .cymon-record-btn .hoverEffect { position: absolute; bottom: 0; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: center; z-index: 1; pointer-events: none; }
                  .cymon-record-btn .hoverEffect div { background: linear-gradient(90deg, rgba(222, 0, 75, 1) 0%, rgba(191, 70, 255, 1) 49%, rgba(0, 212, 255, 1) 100%); border-radius: 40rem; width: 10rem; height: 10rem; transition: 0.4s; filter: blur(20px); animation: cymon-record-effect infinite 3s linear; opacity: 0.5; }
                  .cymon-record-btn:hover .hoverEffect div { width: 8rem; height: 8rem; }
                  @keyframes cymon-record-effect { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                  @keyframes flower-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
                  @media (prefers-reduced-motion: reduce) { .cymon-record-btn .hoverEffect div { animation: none; } .flower-grow { animation: none !important; } }
                `}</style>
                <div className="flex w-full flex-col items-center">

                  {/* Magical portal stage — wide so wings stay visible. Pure CSS
                    magic only: no emoji anywhere in the background. */}
                  <div className={`relative w-full overflow-hidden rounded-3xl border ${recorder.recording ? 'border-fuchsia-300' : 'border-purple-200/80'} bg-gradient-to-b from-violet-400 via-fuchsia-300 to-indigo-300 dark:from-purple-950 dark:via-slate-900 dark:to-fuchsia-950`}>
                    {/* appear flash + ring burst — plays once whenever she materializes */}
                    <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(240,171,252,0.5)_40%,rgba(255,255,255,0)_70%)]" style={{ animation: 'cymon-appear-flash 1.1s ease-out forwards' }} aria-hidden="true" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[340px] w-[340px] rounded-full border-4 border-white/80" style={{ animation: 'cymon-ring-burst 1.2s ease-out forwards' }} aria-hidden="true" />
                    {/* drifting nebula blobs */}
                    <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-500/20" style={{ animation: 'cymon-nebula-a 9s ease-in-out infinite' }} aria-hidden="true" />
                    <div className="pointer-events-none absolute -bottom-20 -right-12 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" style={{ animation: 'cymon-nebula-b 11s ease-in-out infinite' }} aria-hidden="true" />
                    <div className="pointer-events-none absolute left-1/3 top-1/4 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-400/10" style={{ animation: 'cymon-nebula-a 13s ease-in-out infinite reverse' }} aria-hidden="true" />
                    {/* twinkling starfield */}
                    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                      {[
                        ['6%', '12%', 3.5], ['16%', '30%', 2.5], ['10%', '55%', 3], ['20%', '75%', 3.5],
                        ['32%', '12%', 2.5], ['38%', '85%', 3], ['55%', '8%', 2.5], ['68%', '18%', 3.5],
                        ['80%', '12%', 2.5], ['88%', '32%', 3], ['76%', '55%', 2.5], ['86%', '72%', 3.5],
                        ['66%', '86%', 2.5], ['28%', '88%', 3], ['45%', '45%', 3], ['60%', '62%', 2.5],
                        ['25%', '42%', 2.5], ['50%', '92%', 3],
                      ].map(([l, t, s], i) => (
                        <span
                          key={i}
                          className="absolute rounded-full bg-white shadow-[0_0_8px_3px_rgba(192,132,252,0.7)]"
                          style={{ left: l, top: t, width: s, height: s, animation: `cymon-twinkle ${1.8 + (i % 5) * 0.35}s ease-in-out ${i * 0.3}s infinite` }}
                        />
                      ))}
                    </div>
                    {/* portal glow — kept soft and smaller than her wingspan so
                      her edges read against the gradient instead of washing out */}
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(216,180,254,0.5)_0%,rgba(240,171,252,0.28)_40%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(circle,rgba(147,51,234,0.5)_0%,rgba(217,70,239,0.22)_40%,rgba(0,0,0,0)_70%)]" style={{ animation: 'cymon-portal-breathe 3.2s ease-in-out infinite' }} />
                    {/* rotating rune rings */}
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-purple-500/60" style={{ animation: 'cymon-portal-spin 24s linear infinite' }} />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-200/70 shadow-[0_0_40px_-6px_rgba(217,70,239,0.5),inset_0_0_30px_rgba(216,180,254,0.5)]" style={{ animation: 'cymon-portal-spin 18s linear infinite reverse' }} />
                    {/* floor fade + mist bank — melt her skirt into the stage
                      floor so no crop edge is perceptible. The fade alone
                      ended right at the edge (still readable as a cut), so a
                      soft mist bank now covers where the skirt terminates.
                      Fade is z-[15] (above fairy z-10); mist is z-20 on top. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-32 bg-gradient-to-t from-indigo-200 via-indigo-200/60 to-transparent dark:from-fuchsia-950 dark:via-fuchsia-950/60 dark:to-transparent" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16" aria-hidden="true">
                      <div className="absolute -bottom-6 left-1/2 h-20 w-[120%] -translate-x-1/2 rounded-[100%] bg-white/50 blur-2xl dark:bg-fuchsia-300/20" />
                      <div className="absolute -bottom-4 left-[15%] h-12 w-1/3 rounded-[100%] bg-indigo-100/70 blur-xl dark:bg-purple-400/20" />
                      <div className="absolute -bottom-4 right-[12%] h-12 w-1/3 rounded-[100%] bg-indigo-100/70 blur-xl dark:bg-purple-400/20" />
                    </div>
                    {/* foreground flower bed — blooms grow up from the bottom
                      edge in front of her skirt, hiding the portrait crop
                      behind growing flowers instead of fog alone */}
                    <svg viewBox="0 0 600 150" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 w-full sm:h-32" aria-hidden="true">
                      {/* grass mound — flowers grow out of it instead of being
                        sliced by the frame edge; static so it reads as ground */}
                      <path d="M0,150 L0,124 Q60,108 120,120 Q180,132 240,116 Q300,102 360,118 Q420,132 480,116 Q540,102 600,118 L600,150 Z" className="flower-grow fill-violet-200/70 dark:fill-violet-800/50" style={grassGrow('1.0s')} />
                      <path d="M0,150 L0,136 Q50,124 100,132 Q150,140 200,130 Q260,120 320,132 Q380,142 430,130 Q490,118 550,132 Q580,136 600,130 L600,150 Z" className="flower-grow fill-violet-300/90 dark:fill-violet-900/90" style={grassGrow('1.1s')} />
                      {/* leaf blades — filled tapered shapes, not spikes */}
                      <g className="flower-grow fill-violet-500/80 dark:fill-violet-400/70" style={grassGrow('1.15s')}>
                        <path d="M60,146 C58,124 54,104 44,88 C54,100 60,122 63,146 Z" />
                        <path d="M140,144 C142,122 148,102 158,88 C150,104 146,124 145,144 Z" />
                        <path d="M230,146 C228,126 222,108 212,94 C222,106 228,126 232,146 Z" />
                        <path d="M410,146 C412,124 418,104 428,90 C420,106 416,126 415,146 Z" />
                        <path d="M530,144 C532,124 538,106 548,92 C540,106 536,126 535,144 Z" />
                      </g>
                      <g className="flower-grow fill-violet-600/80 dark:fill-violet-400/70" style={grassGrow('1.25s')}>
                        <path d="M200,140 C196,128 188,118 176,112 C190,112 200,122 203,136 Z" />
                        <path d="M350,140 C354,128 362,118 374,112 C360,112 350,122 347,136 Z" />
                        <path d="M440,142 C436,132 428,124 418,120 C430,120 438,128 441,138 Z" />
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.45s')}>
                        <path d="M110,146 C108,132 112,114 108,100" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="96" cy="118" rx="14" ry="6" transform="rotate(-24 96 118)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(108 92) scale(0.65)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-pink-200 dark:fill-pink-300/90" />
                          ))}
                          <circle r="5.5" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.15s')}>
                        <path d="M170,146 C170,124 168,104 172,80" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="152" cy="112" rx="17" ry="7" transform="rotate(-25 152 112)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <ellipse cx="190" cy="94" rx="15" ry="6.5" transform="rotate(22 190 94)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(172 72) scale(0.9)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-white dark:fill-fuchsia-100" />
                          ))}
                          <circle r="6" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.5s')}>
                        <path d="M250,146 C252,132 248,120 250,108" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <circle cx="250" cy="102" r="7" className="fill-fuchsia-300 dark:fill-fuchsia-400" />
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.25s')}>
                        <path d="M310,146 C308,122 314,96 308,76" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="292" cy="105" rx="17" ry="7" transform="rotate(-25 292 105)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <ellipse cx="328" cy="88" rx="15" ry="6.5" transform="rotate(22 328 88)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(308 68) scale(0.8)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-white dark:fill-fuchsia-100" />
                          ))}
                          <circle r="6" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.35s')}>
                        <path d="M382,146 C384,132 382,114 384,100" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="398" cy="114" rx="14" ry="6" transform="rotate(24 398 114)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(384 92) scale(0.8)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-fuchsia-200 dark:fill-fuchsia-300/90" />
                          ))}
                          <circle r="5.5" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.1s')}>
                        <path d="M460,146 C458,126 462,104 458,82" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="442" cy="112" rx="16" ry="7" transform="rotate(-24 442 112)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <ellipse cx="478" cy="96" rx="14" ry="6" transform="rotate(22 478 96)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(458 74) scale(0.9)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-pink-200 dark:fill-pink-300/90" />
                          ))}
                          <circle r="6" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                      <g className="flower-grow" style={flowerGrow('0.55s')}>
                        <path d="M492,146 C496,134 490,118 494,102" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-violet-700 dark:stroke-violet-300" />
                        <ellipse cx="506" cy="118" rx="13" ry="6" transform="rotate(24 506 118)" className="fill-violet-600/80 dark:fill-violet-400/70" />
                        <g transform="translate(494 94) scale(0.65)">
                          {[0, 72, 144, 216, 288].map((a) => (
                            <ellipse key={a} cx="0" cy="-13" rx="9" ry="14" transform={`rotate(${a})`} className="fill-white dark:fill-fuchsia-100" />
                          ))}
                          <circle r="5.5" className="fill-amber-300 dark:fill-amber-200" />
                        </g>
                      </g>
                    </svg>
                    {/* side waves — rolling-hill borders like the flower mound.
                      Wing tips slip behind organic waves instead of reading
                      as cropped by the frame. Static decor (the grass already
                      moves); mirrored pair for symmetry. */}
                    <svg viewBox="0 0 60 340" preserveAspectRatio="none" className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 sm:w-14" aria-hidden="true">
                      <path d="M0,0 H34 C26,40 40,60 36,95 C32,130 46,150 40,190 C34,230 48,250 42,290 C38,315 42,328 40,340 H0 Z" className="fill-violet-200/70 dark:fill-violet-800/50" />
                      <path d="M0,0 H26 C20,45 32,70 28,105 C24,140 36,160 30,200 C25,240 38,260 33,300 C30,320 32,330 30,340 H0 Z" className="fill-violet-300/90 dark:fill-violet-900/90" />
                    </svg>
                    <svg viewBox="0 0 60 340" preserveAspectRatio="none" className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 sm:w-14" aria-hidden="true">
                      <g transform="translate(60 0) scale(-1 1)">
                        <path d="M0,0 H34 C26,40 40,60 36,95 C32,130 46,150 40,190 C34,230 48,250 42,290 C38,315 42,328 40,340 H0 Z" className="fill-violet-200/70 dark:fill-violet-800/50" />
                        <path d="M0,0 H26 C20,45 32,70 28,105 C24,140 36,160 30,200 C25,240 38,260 33,300 C30,320 32,330 30,340 H0 Z" className="fill-violet-300/90 dark:fill-violet-900/90" />
                      </g>
                    </svg>
                    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
                      {[
                        ['8px', '18%', 3, 0], ['14px', '52%', 2.5, 0.7], ['8px', '80%', 3, 1.3],
                      ].map(([l, t, s, d], i) => (
                        <span
                          key={`glim-l-${i}`}
                          className="absolute rounded-full bg-white/80 shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]"
                          style={{ left: l, top: t, width: s, height: s, animation: `cymon-twinkle 2.4s ease-in-out ${d}s infinite` }}
                        />
                      ))}
                      {[
                        ['8px', '30%', 2.5, 0.4], ['14px', '64%', 3, 1.0], ['8px', '86%', 2.5, 1.6],
                      ].map(([r, t, s, d], i) => (
                        <span
                          key={`glim-r-${i}`}
                          className="absolute rounded-full bg-white/80 shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]"
                          style={{ right: r, top: t, width: s, height: s, animation: `cymon-twinkle 2.4s ease-in-out ${d}s infinite` }}
                        />
                      ))}
                    </div>
                    <div className="relative z-10 px-3 pt-1">
                      <Fairy3D mood={mood} recording={recorder.recording} variant="blossom" />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 px-2">
                    {!recorder.recording ? (
                      linePlaying ? (
                        <button
                          type="button"
                          disabled
                          className="cymon-record-btn cursor-wait text-xs sm:text-sm opacity-80"
                        >
                          <Mic className="h-4 w-4 animate-pulse" />
                          <span>CyMon is speaking…</span>
                          <div className="hoverEffect" aria-hidden="true"><div /></div>
                        </button>
                      ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (linePlayingRef.current) return
                          // Armed (post-line or post-confirm): the tap IS the
                          // go-signal — record at once, no second confirm.
                          if (armed) {
                            beginRecordingNow()
                            return
                          }
                          const isRetake = Boolean(recorder.audioBlob || recorder.audioUrl || existingAudioUrl)
                          // Redoing? Confirm first so the old take isn't
                          // wiped by accident.
                          if (isRetake) {
                            setConfirmingRetake(true)
                            return
                          }
                          startVoiceRecording()
                        }}
                        className="cymon-record-btn text-xs sm:text-sm"
                      >
                        <Mic className="h-4 w-4" />
                        <span>{recorder.audioUrl ? 'Retake' : 'Start recording'}</span>
                        <div className="hoverEffect" aria-hidden="true"><div /></div>
                      </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          // wasRetakeRef survives the wipe above; audioUrl
                          // alone can't tell a redo from a first take.
                          const firstTake = !wasRetakeRef.current && !existingAudioUrl
                          recorder.stop()
                          setFreshTake(true)
                          // File-only on purpose: a missing file stays silent
                          // instead of surprising with the robot voice.
                          // First take: thank-you line. Retake: thanks again.
                          playTakeLine(mood, firstTake ? 'recorded' : 'thanks', () => {})
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-6 py-3 text-xs sm:text-sm font-bold text-white transition hover:scale-105 active:scale-95"
                      >
                        <Square className="h-4 w-4 fill-current" /> Stop ({fmtSec(recorder.seconds)})
                      </button>
                    )}
                  </div>
                  {recorder.recording ? (
                    <p className="mt-1 text-xs font-semibold text-fuchsia-600">Recording… {fmtSec(recorder.seconds)} / 2:00 max</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-purple-500/80">Step into the portal, then tell CyMon how your day felt</p>
                  )}
                  {recorder.audioUrl ? (
                    <div key={recorder.audioUrl} className={`${noteLeaving ? 'note-leaving' : 'voice-note-in'} flex w-full flex-col items-center`}>
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {freshTake ? 'Audio recorded successfully' : 'Previous recording - will be replaced on retake'}
                      </p>
                      <div className="mt-1 w-full max-w-xs">
                        <VoiceNotePlayer audioUrl={recorder.audioUrl} durationSec={recorder.seconds} onRemove={removeTake} />
                      </div>
                    </div>
                  ) : null}
                  {recorder.error ? <p className="mt-2 text-xs text-rose-600">{recorder.error}</p> : null}
                </div>
              </Modal>
            ) : null}
            {confirmingRetake ? (
              <Modal
                title="Retake this recording?"
                subtitle="Your current take will be discarded."
                onClose={() => setConfirmingRetake(false)}
                maxWidth="max-w-sm"
                footer={
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={() => setConfirmingRetake(false)}>
                      Keep it
                    </Button>
                    <Button
                      onClick={() => {
                        setConfirmingRetake(false)
                        startVoiceRecording()
                      }}
                    >
                      Yes, retake
                    </Button>
                  </div>
                }
              >
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  A new recording will replace your previous take once you stop and submit. Continue?
                </p>
              </Modal>
            ) : null}

            <div className="mt-4 sm:mt-5 border-t border-purple-50 dark:border-slate-800 pt-4 transition-colors">
              <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-400 mb-2.5 transition-colors">Daily Metrics & Observations</div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <Select disabled={journalLocked} label="Therapy task completion?" placeholder="Select" value={taskCompletion} onChange={(e) => setTaskCompletion(e.target.value)}>
                  <option value="yes_all">Yes, completed all tasks</option>
                  <option value="some">Some completed</option>
                  <option value="none">None</option>
                </Select>
                <Select disabled={journalLocked} label="Behavioral episodes today?" placeholder="Select" value={behavioral} onChange={(e) => setBehavioral(e.target.value)}>
                  <option value="none">No episodes — calm and cooperative</option>
                  <option value="mild">Mild episode</option>
                  <option value="significant">Significant episode</option>
                </Select>
                <Select disabled={journalLocked} label="Sleep quality last night" placeholder="Select" value={sleep} onChange={(e) => setSleep(e.target.value)}>
                  <option value="good">Slept well (7+ hours)</option>
                  <option value="restless">Restless</option>
                  <option value="poor">Poor</option>
                </Select>
                <Select disabled={journalLocked} label="Appetite / eating today?" placeholder="Select" value={appetite} onChange={(e) => setAppetite(e.target.value)}>
                  <option value="good">Good appetite — ate well</option>
                  <option value="average">Average</option>
                  <option value="refused">Refused meals</option>
                </Select>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
              <Button
                data-onboarding-key="client-activity-submit"
                size="md"
                onClick={handleSubmit}
                disabled={submitting || uploadingAudio || journalLocked}
                className="w-full sm:w-auto cursor-pointer disabled:cursor-not-allowed py-2.5 text-xs sm:text-sm font-bold"
              >
                {submitting
                  ? 'Saving…'
                  : logs.some((l) => l.log_date === activeDate)
                  ? 'Update Journal Entry'
                  : 'Submit Journal Entry'}
              </Button>
              {logs.some((l) => l.log_date === activeDate) && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={submitting || journalLocked}
                  className="w-full sm:w-auto rounded-lg border border-red-300 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  Delete Journal Entry
                </button>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-3.5 sm:gap-5">
            <section className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs transition-colors">
              <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-400 transition-colors">Journal Archive & History</div>
              <div className="mt-2">
                <SearchBar
                  value={historyQuery}
                  onChange={setHistoryQuery}
                  placeholder="Search past logs…"
                  className="w-full"
                />
              </div>
              <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${status.cls}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                {status.label}
              </div>
              {loading ? (
                <div className="mt-3 space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-transparent p-2.5">
                      <div className="skeleton mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" rounded="rounded-md" />
                        <Skeleton className="h-2.5 w-40" rounded="rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto mt-3 pr-1 space-y-2 animate-content-fade-in">
                  <ul className="space-y-2 text-sm">
                    {filteredLogs.length === 0 ? (
                      <li className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                        {historyQuery ? 'No matching logs found.' : 'No submissions yet.'}
                      </li>
                    ) : null}
                    {filteredLogs.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => handleSelectLog(s)}
                          className={`w-full flex items-start gap-3 rounded-xl border p-2.5 text-left transition-all hover:bg-purple-50/40 dark:hover:bg-slate-800 cursor-pointer group ${
                            activeDate === s.log_date ? 'border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/20' : 'border-transparent'
                          }`}
                        >
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TASK_DOT[s.task_completion] || 'bg-slate-300 dark:bg-slate-600'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm transition-colors">{fmtDate(s.log_date)}</div>
                            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 mt-0.5 transition-colors">
                              <span>Tasks: {TASK_LABEL[s.task_completion] || '—'}</span>
                              <span className="font-bold group-hover:underline text-[9px] uppercase tracking-wider shrink-0 text-purple-600 dark:text-purple-400 transition-colors">View Entry &rarr;</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs transition-colors">
              <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-400 transition-colors">Mood This Week</div>
              <div key={loading ? 'loading' : 'loaded'} className="mt-3 animate-content-fade-in">
                {loading ? <div className="skeleton h-32 w-full rounded-2xl" /> : <MoodChart series={series} />}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

export default DailyActivity
