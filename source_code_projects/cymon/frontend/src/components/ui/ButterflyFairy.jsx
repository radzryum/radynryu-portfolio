import { useEffect, useId, useState } from 'react'
import { BUDDY_COPY, buddyKeyForMood, isSpeaking, playFairyVoice } from '../../lib/voiceBuddy'

// Your exact picture, when saved at frontend/public/cymon-fairy.png, becomes
// CyMon herself (SVG below is only the fallback until you add the file).
const SPRITE_URL = '/cymon-fairy.png'

// CyMon — chibi butterfly fairy (big blue eyes, brown bob, flower headband,
// pink dress, layered purple wings). Her mouth opens while she talks and her
// face mirrors the student's chosen emotion. Click her to hear her talk.
// `variant` recolors her: blossom (pink), ocean (blue), sunny (gold).
const VARIANTS = {
  blossom: {
    wing: '#c4b5fd', wingStripe: '#8b5cf6', wingEdge: '#7c3aed',
    dress: '#f9a8d4', dressShade: '#ec4899', dressDeep: '#db2777',
    hair: '#8a5a33', hairShade: '#6b4220', band: '#f472b6',
  },
  ocean: {
    wing: '#a5e3fc', wingStripe: '#0284c7', wingEdge: '#0369a1',
    dress: '#7dd3fc', dressShade: '#0284c7', dressDeep: '#075985',
    hair: '#1f2937', hairShade: '#111827', band: '#38bdf8',
  },
  sunny: {
    wing: '#fde68a', wingStripe: '#d97706', wingEdge: '#b45309',
    dress: '#fda4af', dressShade: '#e11d48', dressDeep: '#9f1239',
    hair: '#92400e', hairShade: '#78350f', band: '#fbbf24',
  },
}

function Flower({ x, y, r, petal, center }) {
  const petals = [0, 72, 144, 216, 288]
  return (
    <g transform={`translate(${x} ${y})`}>
      {petals.map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.85} rx={r * 0.55} ry={r * 0.85} fill={petal} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.45} fill={center} />
    </g>
  )
}

function ButterflyFairy({ mood = 'okay', state = 'idle', variant = 'blossom' }) {
  const key = buddyKeyForMood(mood)
  const c = VARIANTS[variant] || VARIANTS.blossom
  const [sparkles, setSparkles] = useState([])
  const [wiggle, setWiggle] = useState(false)
  const [talking, setTalking] = useState(false)
  const [spriteOk, setSpriteOk] = useState(true)
  const listening = state === 'listening'
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const clipL = `wingL-${uid}`
  const clipR = `wingR-${uid}`
  const flapDur = listening ? '0.5s' : '1.8s'

  // Lip-sync: poll the speech engine so her mouth opens while she talks.
  useEffect(() => {
    const t = window.setInterval(() => setTalking(isSpeaking()), 200)
    return () => window.clearInterval(t)
  }, [])

  const hint =
    state === 'listening'
      ? "I'm listening... tell me everything!"
      : state === 'recorded'
        ? BUDDY_COPY[key].line
        : 'Hi! Tap me to say hello!'

  const burst = () => {
    const id = Date.now()
    setSparkles((s) => [...s.slice(-8), id])
    window.setTimeout(() => setSparkles((s) => s.filter((x) => x !== id)), 1200)
  }

  const handleTap = () => {
    burst()
    setWiggle(true)
    window.setTimeout(() => setWiggle(false), 600)
    playFairyVoice(key, state === 'recorded' ? 'recorded' : 'greeting')
  }

  return (
    <div className="relative flex flex-col items-center">
      <style>{`
        @keyframes flutter-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes wing-flap-l { 0%,100% { transform: rotate(-6deg) scaleX(1); } 50% { transform: rotate(-20deg) scaleX(0.86); } }
        @keyframes wing-flap-r { 0%,100% { transform: rotate(6deg) scaleX(1); } 50% { transform: rotate(20deg) scaleX(0.86); } }
        @keyframes wing-fast-l { 0%,100% { transform: rotate(-8deg) scaleX(1); } 50% { transform: rotate(-30deg) scaleX(0.78); } }
        @keyframes wing-fast-r { 0%,100% { transform: rotate(8deg) scaleX(1); } 50% { transform: rotate(30deg) scaleX(0.78); } }
        @keyframes sparkle-pop { 0% { opacity: 0; transform: translateY(0) scale(0.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-46px) scale(1.1); } }
        @keyframes fairy-wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes wing-photo-l { 0%,100% { transform: rotate(-4deg) scaleX(1); } 50% { transform: rotate(-15deg) scaleX(0.9); } }
        @keyframes wing-photo-r { 0%,100% { transform: rotate(4deg) scaleX(1); } 50% { transform: rotate(15deg) scaleX(0.9); } }
        @keyframes mouth-talk { from { transform: scaleY(0.45); } to { transform: scaleY(1); } }
        @keyframes eye-blink { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } }
      `}</style>
      <button
        type="button"
        onClick={handleTap}
        aria-label="Tap CyMon the fairy to hear her talk"
        title="Tap me!"
        className={`cursor-pointer transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-full ${wiggle ? '[animation:fairy-wiggle_0.6s_ease]' : ''}`}
      >
        {spriteOk ? (
          <span className="relative block [animation:flutter-float_3s_ease-in-out_infinite]">
            <img
              src={SPRITE_URL}
              alt="CyMon the butterfly fairy"
              draggable={false}
              onError={() => setSpriteOk(false)}
              className="h-44 w-44 object-contain drop-shadow-lg sm:h-56 sm:w-56"
            />
            {talking || listening ? (
              <span className="absolute" style={{ left: '43%', top: '59%', width: '14%' }} aria-hidden="true">
                <span
                  className="block overflow-hidden rounded-full"
                  style={{ backgroundColor: '#7c2d12', height: '15px', animation: 'mouth-talk 0.32s ease-in-out infinite alternate', transformOrigin: 'center' }}
                >
                  <span className="mx-auto block w-3/5 rounded-full" style={{ backgroundColor: '#fca5a5', height: '6px', marginTop: '8px' }} />
                </span>
              </span>
            ) : null}
            {key === 'sad' && !talking ? (
              <span className="absolute text-lg" style={{ left: '63%', top: '44%' }} aria-hidden="true">💧</span>
            ) : null}
            {key === 'happy' && !talking ? (
              <span className="absolute text-base" style={{ left: '12%', top: '30%' }} aria-hidden="true">✨</span>
            ) : null}
            {listening ? (
              <span className="absolute text-base" style={{ left: '8%', top: '12%' }} aria-hidden="true">🎵</span>
            ) : null}
          </span>
        ) : (
          <span className="block [animation:flutter-float_3s_ease-in-out_infinite]">
          <svg viewBox="0 0 180 190" className="h-44 w-44 sm:h-52 sm:w-52" role="img" aria-label="CyMon the butterfly fairy">
            {/* back wings — professional cartoon artwork, each half clipped
                so the left/right wings flap independently from her back */}
            <defs>
              <clipPath id={clipL} clipPathUnits="objectBoundingBox"><rect x="0" y="0" width="0.52" height="1" /></clipPath>
              <clipPath id={clipR} clipPathUnits="objectBoundingBox"><rect x="0.48" y="0" width="0.52" height="1" /></clipPath>
            </defs>
            <g style={{ transformOrigin: '88px 100px', animation: `wing-photo-l ${flapDur} ease-in-out infinite` }}>
              <image href="/butterfly-wings.svg" clipPath={`url(#${clipL})`} x={2} y={30} width={173} height={150} preserveAspectRatio="xMidYMid meet" />
            </g>
            <g style={{ transformOrigin: '88px 100px', animation: `wing-photo-r ${flapDur} ease-in-out infinite` }}>
              <image href="/butterfly-wings.svg" clipPath={`url(#${clipR})`} x={2} y={30} width={173} height={150} preserveAspectRatio="xMidYMid meet" />
            </g>
            {/* arms */}
            <line x1="66" y1="122" x2="46" y2="132" stroke="#ffd9b3" strokeWidth="9" strokeLinecap="round" />
            <line x1="114" y1="122" x2="134" y2="132" stroke="#ffd9b3" strokeWidth="9" strokeLinecap="round" />
            <circle cx="44" cy="133" r="5.5" fill="#ffd9b3" />
            <circle cx="136" cy="133" r="5.5" fill="#ffd9b3" />
            {/* legs + shoes */}
            <line x1="80" y1="160" x2="78" y2="176" stroke="#ffd9b3" strokeWidth="9" strokeLinecap="round" />
            <line x1="100" y1="160" x2="102" y2="176" stroke="#ffd9b3" strokeWidth="9" strokeLinecap="round" />
            <ellipse cx="76" cy="180" rx="9" ry="5" fill={c.dressShade} />
            <ellipse cx="104" cy="180" rx="9" ry="5" fill={c.dressShade} />
            {/* dress */}
            <path d="M68 118 Q90 112 112 118 L106 128 Q90 123 74 128 Z" fill={c.dressShade} />
            <path d="M66 126 Q90 120 114 126 L122 156 Q90 168 58 156 Z" fill={c.dress} stroke={c.dressDeep} strokeWidth="2" />
            <path d="M66 146 Q90 154 114 146" stroke={c.dressDeep} strokeWidth="2" fill="none" opacity="0.6" />
            {/* neck + head */}
            <rect x="84" y="96" width="12" height="12" rx="5" fill="#ffd9b3" />
            <circle cx="90" cy="66" r="34" fill="#ffe3c2" />
            {/* bob hair back */}
            <path d="M52 66 Q50 30 90 28 Q130 30 128 66 L124 92 Q120 78 118 60 L62 60 Q60 78 56 92 Z" fill={c.hair} />
            {/* bangs */}
            <path d="M58 52 Q62 34 90 32 Q118 34 122 52 L114 50 Q116 58 110 60 Q108 50 100 48 Q102 56 96 58 Q92 48 84 48 Q86 56 80 57 Q74 49 66 51 Q64 57 58 52 Z" fill={c.hair} />
            <path d="M58 52 Q62 34 90 32 Q118 34 122 52" fill="none" stroke={c.hairShade} strokeWidth="2" />
            {/* headband */}
            <path d="M58 44 Q90 26 122 44" fill="none" stroke={c.band} strokeWidth="6" strokeLinecap="round" />
            {/* headband flowers */}
            <Flower x={60} y={34} r={7} petal={c.wingStripe} center="#fef9c3" />
            <Flower x={76} y={26} r={5.5} petal={c.wing} center="#fef9c3" />
            <ellipse cx="98" cy="28" rx="7" ry="4" fill="#4ade80" transform="rotate(-24 98 28)" />
            {/* big blue eyes */}
            <g style={{ transformOrigin: '70px 68px', animation: 'eye-blink 4.5s infinite' }}>
              <ellipse cx="70" cy="68" rx="11" ry="13" fill="#fff" />
              <circle cx="70" cy="70" r="8" fill="#1d4ed8" />
              <circle cx="70" cy="70" r="4.6" fill="#0f172a" />
              <circle cx="67.5" cy="66.5" r="2.6" fill="#fff" />
              <circle cx="73" cy="73.5" r="1.3" fill="#fff" opacity="0.9" />
              <path d="M58 62 Q70 54 82 62" fill="none" stroke="#1f2937" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M58 62 l-5 -3 M60 58 l-4 -4" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" />
            </g>
            <g style={{ transformOrigin: '110px 68px', animation: 'eye-blink 4.5s infinite' }}>
              <ellipse cx="110" cy="68" rx="11" ry="13" fill="#fff" />
              <circle cx="110" cy="70" r="8" fill="#1d4ed8" />
              <circle cx="110" cy="70" r="4.6" fill="#0f172a" />
              <circle cx="107.5" cy="66.5" r="2.6" fill="#fff" />
              <circle cx="113" cy="73.5" r="1.3" fill="#fff" opacity="0.9" />
              <path d="M98 62 Q110 54 122 62" fill="none" stroke="#1f2937" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M122 62 l5 -3 M120 58 l4 -4" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" />
            </g>
            {/* brows per emotion */}
            {key === 'worried' ? (
              <>
                <line x1="60" y1="52" x2="78" y2="57" stroke={c.hairShade} strokeWidth="2.6" strokeLinecap="round" />
                <line x1="120" y1="52" x2="102" y2="57" stroke={c.hairShade} strokeWidth="2.6" strokeLinecap="round" />
              </>
            ) : key === 'sad' ? (
              <>
                <line x1="60" y1="54" x2="78" y2="52" stroke={c.hairShade} strokeWidth="2.4" strokeLinecap="round" />
                <line x1="120" y1="54" x2="102" y2="52" stroke={c.hairShade} strokeWidth="2.4" strokeLinecap="round" />
              </>
            ) : null}
            {/* blush + nose */}
            <ellipse cx="58" cy="82" rx="5" ry="3.4" fill="#f9a8d4" opacity="0.75" />
            <ellipse cx="122" cy="82" rx="5" ry="3.4" fill="#f9a8d4" opacity="0.75" />
            <circle cx="90" cy="80" r="2" fill="#f4b48c" />
            {/* sad tear */}
            {key === 'sad' ? (
              <g>
                <path d="M121 76 q2.5 6 0 10" stroke="#7dd3fc" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <circle cx="121" cy="88" r="2.6" fill="#7dd3fc" />
              </g>
            ) : null}
            {/* mouth: opens while talking, else per-emotion */}
            {talking || listening ? (
              <g style={{ transformOrigin: '90px 94px', animation: 'mouth-talk 0.32s ease-in-out infinite alternate' }}>
                <ellipse cx="90" cy="94" rx="6.5" ry="7.5" fill="#7f1d1d" />
                <ellipse cx="90" cy="97" rx="3.8" ry="3" fill="#fca5a5" />
                <rect x="84.5" y="88.5" width="11" height="3.4" rx="1.6" fill="#fff" />
              </g>
            ) : key === 'happy' ? (
              <g>
                <path d="M80 92 Q90 102 100 92 Q90 96 80 92 Z" fill="#fff" stroke="#92400e" strokeWidth="1.6" />
                <path d="M80 92 Q90 102 100 92" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : key === 'sad' ? (
              <path d="M82 97 Q90 92 98 97" stroke="#92400e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            ) : key === 'worried' ? (
              <path d="M82 96 Q90 92 98 96" stroke="#92400e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M82 93 Q90 99 98 93" stroke="#92400e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            )}
            {/* listening notes */}
            {listening ? (
              <g fill={c.wingUpperStroke} fontSize="10" fontWeight="bold">
                <text x="30" y="30">♪<animate attributeName="opacity" values="1;0.2;1" dur="0.9s" repeatCount="indefinite" /></text>
                <text x="142" y="36">♫<animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" repeatCount="indefinite" /></text>
              </g>
            ) : null}
          </svg>
          </span>
        )}
      </button>
      {sparkles.map((id) => (
        <span key={id} className="pointer-events-none absolute text-lg" style={{ animation: 'sparkle-pop 1.2s ease-out forwards' }}>✨</span>
      ))}
      <p className="mt-1 max-w-xs text-center text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200">{hint}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">Psst — tap CyMon, she talks back!</p>
    </div>
  )
}

export default ButterflyFairy
