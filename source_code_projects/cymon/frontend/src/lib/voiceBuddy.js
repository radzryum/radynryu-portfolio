// VoiceBuddy copy + speech helper (kept out of the component file so
// react-refresh only-export-components stays green). English, child-friendly.
// The fairy is named CyMon and always speaks with a female voice.
export const FAIRY_NAME = 'CyMon'

export const BUDDY_COPY = {
  happy: {
    greeting: "Hi! You look so happy today! I'm CyMon, your butterfly fairy! Tap the magic record button and tell me all about it!",
    line: 'Yay! I recorded your happy story! Your doctors will get to listen to it too!',
  },
  calm: {
    greeting: "Hello, little star! I'm CyMon, your butterfly fairy! Tap the record button and share your day with me!",
    line: 'All done! I recorded your story! Your doctors will be able to listen to it!',
  },
  sad: {
    greeting: "Oh hello, sweetheart... I can see you're feeling a little sad. I'm CyMon, and I'm right here with you. Tap record and tell me everything — it's safe here.",
    line: "Thank you for sharing that with me. I recorded it with love. Your doctors will listen too — we're all here for you.",
  },
  worried: {
    greeting: "Hi, brave one... I can see some big feelings today. I'm CyMon! Let's take one deep breath together first... in... and out... Now tap record and let it all out.",
    line: 'You did so great letting it out! I recorded it. Your doctors will listen and help you feel calmer.',
  },
}

export const FAIRY_VARIANTS = [
  { id: 'blossom', label: 'Blossom', swatch: '#ec4899' },
  { id: 'ocean', label: 'Ocean', swatch: '#0ea5e9' },
  { id: 'sunny', label: 'Sunny', swatch: '#f59e0b' },
]

export function buddyKeyForMood(mood) {
  if (mood === 'great' || mood === 'good') return 'happy'
  if (mood === 'sad') return 'sad'
  if (mood === 'very_bad') return 'worried'
  return 'calm'
}

export function buddyLineForMood(mood) {
  return BUDDY_COPY[buddyKeyForMood(mood)].line
}

export function buddyGreetingForMood(mood) {
  return BUDDY_COPY[buddyKeyForMood(mood)].greeting
}

// Prefer a female English voice across Chrome/Edge/Safari. Voices load
// async in Chrome, so warm the cache early and re-check on every speak.
let cachedVoice = null
function pickFemaleVoice() {
  try {
    const voices = window.speechSynthesis?.getVoices() || []
    if (!voices.length) return cachedVoice
    const hay = (v) => `${v.name || ''} ${(v.voiceURI || '')}`.toLowerCase()
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang || ''))
    const pool = en.length ? en : voices
    const FEMALE_HINTS = [
      'samantha', 'zira', 'jenny', 'aria', 'sonia', 'libby', 'female',
      'google us english', 'google uk english female', 'microsoft jenny',
      'microsoft aria', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'susan',
    ]
    for (const hint of FEMALE_HINTS) {
      const found = pool.find((v) => hay(v).includes(hint))
      if (found) {
        cachedVoice = found
        return found
      }
    }
    const MALE_HINTS = ['david', 'mark', 'guy', 'daniel', 'alex', 'fred', 'james', 'george', 'uk english male', 'daniel compact'];
    const nonMale = pool.find((v) => !MALE_HINTS.some((m) => hay(v).includes(m)))
    cachedVoice = nonMale || pool[0] || null
    return cachedVoice
  } catch {
    return cachedVoice
  }
}

try {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      pickFemaleVoice()
    }
  }
} catch {
  // voice is best-effort
}

// Per-emotion prosody so the voice itself carries feelings: happy is
// bright and quick, sad/worried are slower and softer.
const PROSODY = {
  happy: { rate: 1.08, pitch: 1.55 },
  calm: { rate: 0.95, pitch: 1.3 },
  sad: { rate: 0.82, pitch: 1.0 },
  worried: { rate: 0.85, pitch: 1.15 },
}

export function speakLine(text, mood) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new window.SpeechSynthesisUtterance(text)
    const key = mood ? (BUDDY_COPY[mood] ? mood : buddyKeyForMood(mood)) : null
    const prosody = (key && PROSODY[key]) || { rate: 0.95, pitch: 1.4 }
    u.lang = 'en-US'
    u.rate = prosody.rate
    u.pitch = prosody.pitch
    const voice = pickFemaleVoice()
    if (voice) {
      u.voice = voice
      if (voice.lang) u.lang = voice.lang
    }
    window.speechSynthesis.speak(u)
  } catch {
    // voice is best-effort
  }
}

export function isSpeaking() {
  try {
    return Boolean(window.speechSynthesis?.speaking) || audioPlaying
  } catch {
    return audioPlaying
  }
}

// Human voice clips — record your own voice per feeling (20 files total).
// Drop recordings here, one per feeling per take (MP3 or AAC — both play):
//   frontend/public/audio/cymon-<great|good|okay|sad|very_bad>-<greeting|recorded|retake|thanks>.{mp3,aac}
// Takes: greeting (modal open), recorded (thank-you after a take), retake
// (encouragement before a re-record), thanks (thank-you after a retake).
// The fairy tries the per-feeling file first, then the shared emotion file
// (cymon-<happy|calm|sad|worried>-<take>), then robot TTS last — so you
// can record a few feelings first and fill in the rest later.
export const FEELING_IDS = ['great', 'good', 'okay', 'sad', 'very_bad']
export const TAKE_KINDS = ['greeting', 'recorded', 'retake', 'thanks']
let audioPlaying = false
let currentAudio = null

function takeFiles(moodOrKey, kind) {
  const safeKind = TAKE_KINDS.includes(kind) ? kind : 'greeting'
  const key = moodOrKey
    ? (BUDDY_COPY[moodOrKey] ? moodOrKey : buddyKeyForMood(moodOrKey))
    : 'calm'
  const files = []
  if (FEELING_IDS.includes(moodOrKey)) {
    files.push(`/audio/cymon-${moodOrKey}-${safeKind}.mp3`)
    files.push(`/audio/cymon-${moodOrKey}-${safeKind}.aac`)
  }
  files.push(`/audio/cymon-${key}-${safeKind}.mp3`)
  files.push(`/audio/cymon-${key}-${safeKind}.aac`)
  return { files, key, safeKind }
}

export function playFairyVoice(moodOrKey, kind = 'greeting') {
  const { files, key, safeKind } = takeFiles(moodOrKey, kind)
  const fallback = () =>
    speakLine(safeKind === 'greeting' ? BUDDY_COPY[key].greeting : BUDDY_COPY[key].line, key)
  playFileChain(files, { onMissing: fallback })
}

// Plays ONLY a recorded human file (never TTS — recording must start clean).
// onDone(true) after it finishes naturally; onDone(false) at once if no file
// exists, so the caller can proceed immediately (e.g. start recording).
export function playTakeLine(moodOrKey, kind, onDone) {
  const { files } = takeFiles(moodOrKey, kind)
  playFileChain(files, {
    onMissing: () => {
      if (typeof onDone === 'function') onDone(false)
    },
    onNaturalEnd: () => {
      if (typeof onDone === 'function') onDone(true)
    },
  })
}
// Shared chain runner: tries recorded files in order, falls through to the
// next on missing-file errors, then to onMissing / onNaturalEnd.
function playFileChain(files, { onMissing, onNaturalEnd } = {}) {
  const tryNext = (i) => {
    if (i >= files.length || !('Audio' in window)) {
      if (typeof onMissing === 'function') onMissing()
      return
    }
    let audio = null
    try {
      audio = new window.Audio(files[i])
    } catch {
      tryNext(i + 1)
      return
    }
    try {
      if (currentAudio) currentAudio.pause()
    } catch {
      // ignore
    }
    currentAudio = audio
    let settled = false
    const cleanup = () => {
      audioPlaying = false
      lipSmooth = 0
      if (currentAudio === audio) currentAudio = null
    }
    audio.onerror = () => {
      if (settled) return
      settled = true
      cleanup()
      tryNext(i + 1)
    }
    audio.onended = () => {
      if (settled) return
      settled = true
      cleanup()
      if (typeof onNaturalEnd === 'function') onNaturalEnd()
    }
    audio.onplay = () => {
      audioPlaying = true
      attachLipSync(audio)
    }
    const attempt = audio.play()
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        if (settled) return
        settled = true
        cleanup()
        tryNext(i + 1)
      })
    }
  }
  try {
    tryNext(0)
  } catch {
    if (typeof onMissing === 'function') onMissing()
  }
}

// Hard stop: call when the modal closes so no greeting keeps playing (and
// her mouth moving) after she's gone, and so a stuck flag can't linger.
export function stopFairyVoice() {
  try {
    if (currentAudio) {
      try {
        currentAudio.pause()
      } catch {
        // ignore
      }
      currentAudio = null
    }
    audioPlaying = false
    lipSmooth = 0
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // voice is best-effort
  }
}

// ---- Lip-sync amplitude: lets the 3D fairy open her mouth from the real
// audio loudness instead of a fixed timer. Same-origin clips only, so the
// analyser always gets a clean signal. TTS speech has no analysable signal
// and stays on the timer fallback (getVoiceLevel returns null for it).
let lipCtx = null
let lipAnalyser = null
let lipData = null
let lipSource = null
let lipSmooth = 0

function ensureLipGraph() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    if (!lipCtx) {
      lipCtx = new AC()
      lipAnalyser = lipCtx.createAnalyser()
      lipAnalyser.fftSize = 512
      lipData = new Uint8Array(lipAnalyser.fftSize)
      lipAnalyser.connect(lipCtx.destination)
    }
    if (lipCtx.state === 'suspended') lipCtx.resume().catch(() => {})
    return lipCtx.state === 'running' ? lipCtx : null
  } catch {
    return null
  }
}

function attachLipSync(audio) {
  try {
    const c = ensureLipGraph()
    if (!c || !lipAnalyser) return
    if (lipSource) {
      try {
        lipSource.disconnect()
      } catch {
        // ignore
      }
      lipSource = null
    }
    lipSource = c.createMediaElementSource(audio)
    lipSource.connect(lipAnalyser)
  } catch {
    // analyser is best-effort; timer lip-sync covers the rest
  }
}

// Duck CyMon under the user's own playback: fade her file audio out fast,
// then stop. TTS has no volume ramp, so it cancels outright. Called when a
// voice note starts playing so the two voices never overlap.
export function duckFairyVoice() {
  try {
    if (currentAudio) {
      const audio = currentAudio
      const startVol = Number.isFinite(audio.volume) ? audio.volume : 1
      let step = 0
      const timer = window.setInterval(() => {
        step += 1
        try {
          audio.volume = Math.max(0, startVol * (1 - step / 8))
          if (step >= 8) {
            window.clearInterval(timer)
            try {
              audio.pause()
            } catch {
              // ignore
            }
            // Only clear what is still ours — a newer take may have
            // started mid-fade.
            if (currentAudio === audio) {
              currentAudio = null
              audioPlaying = false
              lipSmooth = 0
            }
            try {
              audio.volume = startVol
            } catch {
              // ignore
            }
          }
        } catch {
          window.clearInterval(timer)
        }
      }, 50)
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // best-effort
  }
}

// Current loudness 0..1, or null when no file audio is driving her voice
// (TTS speech, silence between takes, suspended/unsupported audio) so the
// caller falls back to timer-based mouth movement.
export function getVoiceLevel() {
  try {
    if (!audioPlaying || !lipCtx || lipCtx.state !== 'running' || !lipAnalyser || !lipData) return null
    lipAnalyser.getByteTimeDomainData(lipData)
    let peak = 0
    for (let i = 0; i < lipData.length; i += 2) {
      const d = Math.abs(lipData[i] - 128) / 128
      if (d > peak) peak = d
    }
    const target = Math.min(1, peak * 2)
    lipSmooth += (target - lipSmooth) * 0.4
    return lipSmooth
  } catch {
    return null
  }
}
