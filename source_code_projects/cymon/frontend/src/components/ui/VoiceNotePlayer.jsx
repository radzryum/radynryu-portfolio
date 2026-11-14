import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { duckFairyVoice } from '../../lib/voiceBuddy'

// Plays a journal voice note. Accepts a stored `journal-audio/<path>` value
// or a direct https URL (backend-signed or legacy). Private-bucket paths are
// exchanged for a short-lived signed URL so doctors can listen without a
// public bucket.
//
// Custom controls (instead of native <audio>) for two reasons:
// 1. Accurate duration from the first frame — the DB duration shows
//    immediately instead of flashing 0:00 until metadata arrives, then gets
//    corrected by loadedmetadata when the file reports it.
// 2. Faster start — preload="auto" begins buffering on mount, with a visible
//    loading state and a buffered-amount bar instead of a dead player.
function VoiceNotePlayer({ audioUrl, durationSec, onRemove }) {
  const [playUrl, setPlayUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const audioRef = useRef(null)
  const barRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [loading, setLoading] = useState(true)
  // Trust the recorded duration first; correct it once metadata arrives.
  const [dur, setDur] = useState(() => (Number.isFinite(Number(durationSec)) && Number(durationSec) > 0 ? Number(durationSec) : 0))

  useEffect(() => {
    let on = true
    setPlayUrl(null)
    setFailed(false)
    setPlaying(false)
    setTime(0)
    setBuffered(0)
    setLoading(true)
    setDur(Number.isFinite(Number(durationSec)) && Number(durationSec) > 0 ? Number(durationSec) : 0)
    if (!audioUrl) return undefined
    // https (backend-signed) and blob (fresh local recording) play directly;
    // only bare storage paths need exchanging for a signed URL.
    if (/^(https?:|blob:)/i.test(audioUrl)) {
      setPlayUrl(audioUrl)
      return undefined
    }
    const path = String(audioUrl).replace(/^journal-audio\//, '')
    supabase.storage.from('journal-audio').createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!on) return
        if (!error && data?.signedUrl) setPlayUrl(data.signedUrl)
        else setFailed(true)
      })
      .catch(() => {
        if (on) setFailed(true)
      })
    // Stop hanging on "Preparing..." forever — say so after 8s. (Render
    // prefers a loaded player, so a late success still shows up fine.)
    const timer = setTimeout(() => {
      if (on) setFailed(true)
    }, 8000)
    return () => {
      on = false
      clearTimeout(timer)
    }
  }, [audioUrl, durationSec])

  // Pause the element if the URL is swapped mid-play.
  useEffect(() => () => {
    try {
      audioRef.current?.pause()
    } catch {
      // ignore teardown races
    }
  }, [playUrl])

  const fmt = (s) => {
    const v = Math.max(0, Math.floor(Number(s) || 0))
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
  }

  const onLoadedMetadata = () => {
    const el = audioRef.current
    if (el && Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration)
    setLoading(false)
  }

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      if (Number.isFinite(el.duration) && el.currentTime >= el.duration - 0.15) el.currentTime = 0
      el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
    }
  }

  const seekToRatio = (ratio) => {
    const el = audioRef.current
    const base = Number.isFinite(el?.duration) && el.duration > 0 ? el.duration : dur
    if (!el || !base) return
    el.currentTime = Math.min(Math.max(ratio, 0), 1) * base
    setTime(el.currentTime)
  }

  const onBarClick = (e) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    if (!rect.width) return
    seekToRatio((e.clientX - rect.left) / rect.width)
  }

  const onBarKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const el = audioRef.current
    const base = Number.isFinite(el?.duration) && el.duration > 0 ? el.duration : dur
    if (!el || !base) return
    seekToRatio((el.currentTime + (e.key === 'ArrowRight' ? 5 : -5)) / base)
  }

  if (!audioUrl) return null
  const progress = dur > 0 ? Math.min(time / dur, 1) : 0
  const bufferedRatio = dur > 0 ? Math.min(buffered / dur, 1) : 0
  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
          Voice note{dur ? ` · ${fmt(dur)}` : ''}
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove recording"
            className="rounded-md p-1 text-purple-400 transition hover:bg-purple-100 hover:text-purple-700 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {playUrl ? (
        <div className="mt-2 flex items-center gap-2.5">
          <audio
            ref={audioRef}
            src={playUrl}
            preload="auto"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onProgress={(e) => {
              try {
                const el = e.currentTarget
                if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1))
              } catch {
                // buffered probing is best-effort
              }
            }}
            onPlay={() => {
              setPlaying(true)
              setLoading(false)
              // Her greeting/thanks must never talk over the user's take.
              duckFairyVoice()
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onError={() => setFailed(true)}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause voice note' : 'Play voice note'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-700 text-white transition hover:bg-purple-800 active:scale-95 disabled:opacity-50"
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600">
            {fmt(time)} / {fmt(dur)}
          </span>
          <div
            ref={barRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek voice note"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(time)}
            onClick={onBarClick}
            onKeyDown={onBarKeyDown}
            className="relative h-2 flex-1 cursor-pointer rounded-full bg-purple-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-purple-300/70"
              style={{ width: `${bufferedRatio * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-purple-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">
            {loading && !playing ? 'Loading…' : ''}
          </span>
        </div>
      ) : failed ? (
        <p className="mt-1 text-xs text-rose-600">Couldn&apos;t load the voice note. Please reload and try again.</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Preparing voice note…</p>
      )}
    </div>
  )
}

export default VoiceNotePlayer
