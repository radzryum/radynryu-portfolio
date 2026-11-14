// Fairy intro SFX — short synthesized magic chime per feeling, played when
// the voice journal modal opens (under her voice greeting). Web Audio only:
// no audio files to record, ship, or download. Best-effort like voiceBuddy.
const NOTE = {
  C5: 523.25, E5: 659.25, F5: 698.46, A5: 880.0,
  C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0,
}

// notes: [freq, seconds-after-start]. Brighter feelings chime higher and
// faster; sad ones lower, slower, and softer.
const INTRO_SFX = {
  great: { type: 'triangle', vol: 1.0, dur: 1.0, notes: [[NOTE.C6, 0], [NOTE.E6, 0.09], [NOTE.G6, 0.18], [NOTE.C7, 0.27]] },
  good: { type: 'triangle', vol: 0.9, dur: 1.1, notes: [[NOTE.C6, 0], [NOTE.E6, 0.12], [NOTE.G6, 0.24]] },
  okay: { type: 'triangle', vol: 0.8, dur: 0.9, notes: [[NOTE.E6, 0], [NOTE.G6, 0.15]] },
  sad: { type: 'sine', vol: 0.65, dur: 1.3, notes: [[NOTE.A5, 0], [NOTE.F5, 0.22], [NOTE.E5, 0.44]] },
  very_bad: { type: 'sine', vol: 0.55, dur: 1.5, notes: [[NOTE.E5, 0], [NOTE.C5, 0.3]] },
}

let ctx = null
function audioCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    return ctx
  } catch {
    return null
  }
}

function tone(ctx, master, freq, at, dur, type, vol) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + at
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function playIntroSfx(mood) {
  try {
    const c = audioCtx()
    if (!c) return
    const start = () => {
      try {
        const seq = INTRO_SFX[mood] || INTRO_SFX.okay
        const master = c.createGain()
        master.gain.value = 0.3
        master.connect(c.destination)
        seq.notes.forEach(([freq, at]) => {
          tone(c, master, freq, at, seq.dur, seq.type, seq.vol)
          // faint octave shimmer on top of every note
          tone(c, master, freq * 2, at + 0.02, seq.dur * 0.6, 'sine', seq.vol * 0.25)
        })
      } catch {
        // best-effort
      }
    }
    // A suspended context swallows scheduled notes — only play once awake.
    if (c.state === 'suspended') {
      c.resume().then(start).catch(() => {})
    } else {
      start()
    }
  } catch {
    // sfx is best-effort
  }
}
