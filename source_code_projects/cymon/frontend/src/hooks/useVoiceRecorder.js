import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal MediaRecorder wrapper: record -> stop -> blob + object URL + seconds.
// No new dependencies; uses native browser audio (webm/opus with fallback mime).
export default function useVoiceRecorder(maxSec = 120) {
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState('')

  const cleanupStream = () => {
    try {
      ;(streamRef.current?.getTracks() || []).forEach((t) => t.stop())
    } catch {
      // ignore
    }
    streamRef.current = null
  }

  const start = useCallback(async () => {
    setError('')
    if (!window.MediaRecorder) {
      setError('Audio recording is not supported on this device/browser.')
      return
    }
    // Double-tap guard: never stack two recorders/intervals.
    try {
      if (recRef.current && recRef.current.state !== 'inactive') return
    } catch {
      // fall through and start fresh
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => {
        try {
          return window.MediaRecorder.isTypeSupported(m)
        } catch {
          return false
        }
      }) || ''
      const rec = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      // Surface OS/browser interruptions (common on mobile) instead of
      // dying silently with a frozen timer.
      rec.onerror = () => {
        setError('Recording was interrupted. Please try again.')
        try {
          if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
        } catch {
          // ignore
        }
        window.clearInterval(timerRef.current)
        setRecording(false)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl((prev) => {
          if (prev) {
            try {
              URL.revokeObjectURL(prev)
            } catch {
              // ignore
            }
          }
          return URL.createObjectURL(blob)
        })
        cleanupStream()
      }
      rec.start(250)
      startTimeRef.current = Date.now()
      setRecording(true)
      setSeconds(0)
      window.clearInterval(timerRef.current)
      // Timestamp-based clock (not tick counting): mobile browsers throttle
      // background timers, which used to freeze the display at a few seconds
      // while audio kept recording. Recomputing from the wall clock
      // self-heals — the next tick jumps to the true elapsed time.
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        if (elapsed >= maxSec) {
          try {
            if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
          } catch {
            // ignore
          }
          window.clearInterval(timerRef.current)
          setRecording(false)
          setSeconds(maxSec)
          return
        }
        setSeconds(elapsed)
      }, 500)
    } catch {
      setError('Please allow microphone access to record your voice.')
      cleanupStream()
    }
  }, [maxSec])

  const stop = useCallback(() => {
    try {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    } catch {
      // ignore
    }
    window.clearInterval(timerRef.current)
    setRecording(false)
  }, [])

  const clear = useCallback(() => {
    setAudioBlob(null)
    setAudioUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev)
        } catch {
          // ignore
        }
      }
      return null
    })
    setSeconds(0)
    setError('')
  }, [])

  useEffect(() => () => {
    try {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    } catch {
      // ignore
    }
    window.clearInterval(timerRef.current)
    cleanupStream()
    if (audioUrl) {
      try {
        URL.revokeObjectURL(audioUrl)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { recording, seconds, audioBlob, audioUrl, error, start, stop, clear, setError }
}
