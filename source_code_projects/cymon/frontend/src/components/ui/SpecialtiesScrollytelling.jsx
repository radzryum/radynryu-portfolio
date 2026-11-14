import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

const STEPS = [
  {
    id: '01',
    badge: 'INDIVIDUAL THERAPY',
    title: 'Feeling lost in a tangle of anxiety or stress?',
    description:
      'Our tailored individual counseling sessions provide gentle guidance to help unspool anxious thoughts and restore inner clarity.',
    image: '/specialties/individual-therapy.png',
    accent: '#7c3aed',
    accentLight: 'rgba(124,58,237,0.18)',
  },
  {
    id: '02',
    badge: 'PEDIATRIC & CHILD',
    title: 'Concerned about speech or motor progress in your child?',
    description:
      'Early intervention strategies and pediatric evaluations designed to support developmental milestones with empathetic care.',
    image: '/specialties/pediatric-child.png',
    accent: '#0ea5e9',
    accentLight: 'rgba(14,165,233,0.18)',
  },
  {
    id: '03',
    badge: 'EVALUATIONS',
    title: 'Seeking formal psychological testing or school evaluations?',
    description:
      'We provide comprehensive psychometric evaluations to unlock tailored support and classroom integration plans.',
    image: '/specialties/evaluations.png',
    accent: '#a855f7',
    accentLight: 'rgba(168,85,247,0.18)',
  },
  {
    id: '04',
    badge: 'FAMILY & COUPLES',
    title: 'Navigating relationship changes or parenting stress?',
    description:
      'Collaborative family and relationship support focused on rebuilding healthy communication and resilient emotional bonds.',
    image: '/specialties/family-couples.png',
    accent: '#ec4899',
    accentLight: 'rgba(236,72,153,0.18)',
  },
]

// ─── Mobile Swipe Carousel ───────────────────────────────────────────────────
function MobileCarousel({ steps }) {
  const [active, setActive] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const goTo = useCallback((idx) => {
    setActive(Math.max(0, Math.min(steps.length - 1, idx)))
  }, [steps])

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) goTo(active + 1)
      else goTo(active - 1)
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  const s = steps[active]

  return (
    <section
      id="specialties"
      className="relative w-full snap-start"
      style={{ background: 'linear-gradient(160deg, #1a0845 0%, #230b5c 50%, #1a0845 100%)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="text-center px-5 pt-10 pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(216,180,254,0.8)' }}>
          {steps[0]._heading || 'Our Specialties'}
        </p>
        <h2 className="text-2xl font-extrabold text-white leading-tight">
          {(() => {
            const sub = steps[0]._subtext || 'are you holding today?'
            const idx = sub.lastIndexOf(' ')
            const first = idx > -1 ? sub.slice(0, idx) : ''
            const second = idx > -1 ? sub.slice(idx + 1) : ''
            return (
              <>
                {first ? `${first} ` : 'Which tangle of the mind '}
                {second ? <span style={{ color: '#c4b5fd' }}>{second}</span> : <span style={{ color: '#c4b5fd' }}>are you holding today?</span>}
              </>
            )
          })()}
        </h2>
      </div>

      {/* Card content track */}
      <div className="relative w-full overflow-hidden pb-6">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {steps.map((step) => (
            <div key={step.id} className="w-full shrink-0 px-5 flex flex-col items-center gap-5">
              {/* Circular image */}
              <div className="relative flex-shrink-0 mt-2" style={{ width: 180, height: 180 }}>
                <div
                  style={{
                    position: 'absolute', inset: -6, borderRadius: '50%',
                    background: `conic-gradient(from 0deg, ${step.accent}, transparent, ${step.accent})`,
                    opacity: 0.7,
                    animation: 'spin 12s linear infinite',
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[4px] bg-white overflow-hidden shadow-2xl"
                  style={{ borderColor: step.accent }}
                >
                  <img
                    src={step.image}
                    alt={step.badge}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>

              {/* Text card */}
              <div
                className="w-full rounded-3xl p-5 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl font-black" style={{ color: step.accent }}>{step.id}</span>
                  <div className="h-[2px] flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${step.accent}, transparent)` }} />
                </div>
                <span
                  className="inline-block text-[10px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-3"
                  style={{ background: step.accentLight, color: step.accent, border: `1px solid ${step.accent}44` }}
                >
                  {step.badge}
                </span>
                <h3 className="text-lg font-bold text-white leading-snug mb-2">{step.title}</h3>
                <p className="text-xs leading-relaxed text-purple-100">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Swipe hint & dots */}
      <div className="flex flex-col items-center gap-2 pb-2">
        <p className="text-[10px] text-purple-300/60 tracking-wide">← Swipe to explore →</p>
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <button
              key={step.id}
              aria-label={`Go to ${step.badge}`}
              onClick={() => goTo(i)}
              className="transition-all duration-300"
              style={{
                width: active === i ? 36 : 10, height: 10,
                borderRadius: 9999,
                background: active === i ? s.accent : 'rgba(255,255,255,0.25)',
                boxShadow: active === i ? `0 0 12px ${s.accent}` : 'none',
                border: 'none', cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom wave */}
      <div className="relative w-full overflow-hidden leading-[0]">
        <svg className="block w-full h-[40px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
          {/* Background 10 waves for depth */}
          <path d="M0,120 L0,70 Q30,40 60,70 T120,70 T180,70 T240,70 T300,70 T360,70 T420,70 T480,70 T540,70 T600,70 T660,70 T720,70 T780,70 T840,70 T900,70 T960,70 T1020,70 T1080,70 T1140,70 T1200,70 L1200,120 Z" className="fill-white dark:fill-slate-900 transition-colors duration-500" opacity="0.4"></path>
          {/* Foreground exactly 8 waves */}
          <path d="M0,120 L0,80 Q37.5,30 75,80 T150,80 T225,80 T300,80 T375,80 T450,80 T525,80 T600,80 T675,80 T750,80 T825,80 T900,80 T975,80 T1050,80 T1125,80 T1200,80 L1200,120 Z" className="fill-white dark:fill-slate-900 transition-colors duration-500" />
        </svg>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}

// ─── Desktop Scroll-Driven Version ───────────────────────────────────────────
function DesktopScrollytelling({ steps }) {
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    let rafId
    let currentY = 0
    let targetY = 0

    const updateScroll = () => {
      if (!containerRef.current || !trackRef.current) {
        rafId = requestAnimationFrame(updateScroll)
        return
      }
      const rect = containerRef.current.getBoundingClientRect()
      // Adjust maxScroll to account for the sticky container height
      const maxScroll = rect.height - window.innerHeight
      const scrollY = -rect.top
      let progress = 0
      if (scrollY > 0) progress = Math.min(1, scrollY / maxScroll)

      const newActiveIdx = Math.min(steps.length - 1, Math.floor(progress * steps.length))
      setActiveIdx((prev) => prev !== newActiveIdx ? newActiveIdx : prev)

      // Calculate the target Y position in percentage
      targetY = progress * ((steps.length - 1) / steps.length) * 100
      currentY += (targetY - currentY) * 0.08
      trackRef.current.style.transform = `translateY(-${currentY}%)`

      rafId = requestAnimationFrame(updateScroll)
    }

    rafId = requestAnimationFrame(updateScroll)
    return () => cancelAnimationFrame(rafId)
  }, [steps])

  return (
    <section
      id="specialties"
      ref={containerRef}
      style={{ height: `${steps.length * 80}vh` }}
      className="relative w-full z-10 snap-start"
    >
      <div
        className="sticky top-0 left-0 w-full overflow-hidden flex flex-row"
        style={{
          height: '100dvh',
          background: 'linear-gradient(160deg, #1a0845 0%, #230b5c 50%, #1a0845 100%)',
        }}
      >
        {/* Lightweight background orbs */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div style={{ position: 'absolute', top: '5%', right: '8%', width: 350, height: 350, borderRadius: '50%', background: 'rgba(139,92,246,0.07)', filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', bottom: '5%', left: '5%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(59,130,246,0.06)', filter: 'blur(70px)' }} />
        </div>

        {/* Left Side: Header & Dots */}
        <div className="relative z-20 w-[45vw] max-w-[600px] h-full flex flex-row items-center justify-center pl-8 lg:pl-12 pr-6 shrink-0">
          
          {/* Vertical Dots */}
          <div className="flex flex-col items-center gap-4 mr-8 lg:mr-12 shrink-0">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className="transition-all duration-500 ease-out"
                style={{
                  width: 12, height: activeIdx === i ? 48 : 12,
                  borderRadius: 9999,
                  background: activeIdx === i ? steps[activeIdx].accent : 'rgba(255,255,255,0.2)',
                  boxShadow: activeIdx === i ? `0 0 15px ${steps[activeIdx].accent}` : 'none',
                }}
              />
            ))}
          </div>

          {/* Header */}
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: 'rgba(216,180,254,0.8)' }}>
              {steps[0]._heading || 'Our Specialties'}
            </p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              {(() => {
                const sub = steps[0]._subtext || 'are you holding today?'
                const idx = sub.lastIndexOf(' ')
                const first = idx > -1 ? sub.slice(0, idx) : ''
                const second = idx > -1 ? sub.slice(idx + 1) : ''
                return (
                  <>
                    <span>{first || 'Which tangle of the mind'}</span>
                    <br />
                    <span style={{ color: '#c4b5fd' }}>{second || 'are you holding today?'}</span>
                  </>
                )
              })()}
            </h2>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Vertical Sliding track */}
          <div
            ref={trackRef}
            className="flex flex-col w-full will-change-transform"
            style={{ height: `${steps.length * 100}dvh` }}
          >
            {steps.map((s, index) => {
              const isActive = activeIdx === index
              return (
                <div
                  key={s.id}
                  className="w-full h-[100dvh] flex justify-center items-center px-4 lg:px-12"
                >
                  <div
                    className="w-full max-w-4xl mx-auto flex flex-col xl:flex-row items-center gap-10 lg:gap-12 transition-all duration-700 ease-out"
                    style={{
                      opacity: isActive ? 1 : 0.3,
                      transform: isActive ? 'scale(1)' : 'scale(0.92)',
                    }}
                  >
                    {/* Image */}
                    <div
                      className="shrink-0 relative"
                      style={{
                        width: 280, height: 280,
                        transform: isActive ? 'scale(1)' : 'scale(0.88)',
                        transition: 'transform 0.8s ease-out',
                      }}
                    >
                      <div style={{
                        position: 'absolute', inset: -8, borderRadius: '50%',
                        background: `conic-gradient(from 0deg, ${s.accent}, transparent, ${s.accent})`,
                        opacity: isActive ? 0.8 : 0,
                        animation: 'spin 12s linear infinite',
                        transition: 'opacity 0.5s ease',
                      }} />
                      <div
                        className="absolute inset-0 rounded-full border-[6px] bg-white overflow-hidden shadow-2xl"
                        style={{ borderColor: s.accent, boxShadow: `0 20px 80px ${s.accentLight}` }}
                      >
                        <img
                          src={s.image}
                          alt={s.badge}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>

                    {/* Text */}
                    <div
                      className="flex-1 w-full p-8 lg:p-10 rounded-[30px] border border-white/10"
                      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)' }}
                    >
                      <div className="flex items-center gap-4 mb-5">
                        <span className="text-5xl font-black" style={{ color: s.accent }}>{s.id}</span>
                        <div className="h-[2px] flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${s.accent}, transparent)` }} />
                      </div>
                      <span
                        className="inline-block text-xs font-bold tracking-widest uppercase px-5 py-2 rounded-full mb-5 shadow-lg"
                        style={{ background: s.accentLight, color: s.accent, border: `1px solid ${s.accent}44` }}
                      >
                        {s.badge}
                      </span>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">{s.title}</h3>
                      <p className="text-base lg:text-lg leading-loose text-purple-100">{s.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom wave (full width) */}
        <div 
          className="absolute -bottom-[2px] left-0 w-full overflow-hidden leading-[0] z-20 pointer-events-none transition-transform duration-700 ease-out"
          style={{ transform: activeIdx === steps.length - 1 ? 'translateY(0)' : 'translateY(100%)' }}
        >
          <svg className="relative block w-full h-[80px] lg:h-[100px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            {/* Background 10 waves for depth */}
            <path d="M0,120 L0,70 Q30,40 60,70 T120,70 T180,70 T240,70 T300,70 T360,70 T420,70 T480,70 T540,70 T600,70 T660,70 T720,70 T780,70 T840,70 T900,70 T960,70 T1020,70 T1080,70 T1140,70 T1200,70 L1200,120 Z" className="fill-white dark:fill-slate-900 transition-colors duration-500" opacity="0.4"></path>
            {/* Foreground exactly 8 waves */}
            <path d="M0,120 L0,80 Q37.5,30 75,80 T150,80 T225,80 T300,80 T375,80 T450,80 T525,80 T600,80 T675,80 T750,80 T825,80 T900,80 T975,80 T1050,80 T1125,80 T1200,80 L1200,120 Z" className="fill-white dark:fill-slate-900 transition-colors duration-500" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </section>
  )
}

// ─── Smart Wrapper ───────────────────────────────────────────────────────────
export default function SpecialtiesScrollytelling({ heading, subtext, items }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)

  // Build the per-step data from props, falling back to the built-in STEPS when
  // the CMS hasn't provided any. Normalized via useMemo so the scroll effects
  // don't re-arm on every render.
  const steps = useMemo(() => {
    if (Array.isArray(items) && items.length) {
      const palette = ['#7c3aed', '#0ea5e9', '#a855f7', '#ec4899']
      return items.map((item, i) => {
        const accent = palette[i % palette.length]
        const image = item.image || STEPS[i % STEPS.length]?.image || null
        return {
          id: String(i + 1).padStart(2, '0'),
          badge: item.badge || item.title || 'SPECIALTY',
          title: item.title || 'Specialty',
          description: item.description || '',
          image,
          accent,
          accentLight: accent + '2E',
          _heading: heading,
          _subtext: subtext,
        }
      })
    }
    return STEPS
  }, [items, heading, subtext])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
    ? <MobileCarousel steps={steps} />
    : <DesktopScrollytelling steps={steps} />
}


