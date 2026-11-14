import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import AnnouncementCard from '../components/ui/AnnouncementCard'
import ImageSlideshow from '../components/ui/ImageSlideshow'
import SpecialtiesScrollytelling from '../components/ui/SpecialtiesScrollytelling'
import ThemeToggle from '../components/ui/ThemeToggle'
import UiverseGetStartedBtn from '../components/ui/UiverseGetStartedBtn'
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'
import Silk from '../components/ui/Silk'
import GradientWaves from '../components/ui/GradientWaves'
import SplashCursor from '../components/ui/SplashCursor'

const LANDING_CACHE_KEY = 'cymon-landing-sections-v1'
const readLandingCache = () => {
  try {
    const raw = localStorage.getItem(LANDING_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
const writeLandingCache = (sections) => {
  try {
    if (sections && typeof sections === 'object') {
      localStorage.setItem(LANDING_CACHE_KEY, JSON.stringify(sections))
    }
  } catch {
    // Private mode / quota — caching is best-effort only.
  }
}


// ---------------------------------------------------------------------------
// TearOffStack — hero right-column animated journal card carousel
// Images go in: frontend/public/hero/
// Naming convention: back-1.jpg … back-3.jpg  |  mid-1.jpg … mid-3.jpg  |  front-1.jpg … front-3.jpg
// ---------------------------------------------------------------------------
const BACK_IMAGES = [
  { src: '/hero/back-1.png', caption: 'Serene Consultation Space 🌸' },
  { src: '/hero/back-2.png', caption: 'Inner Serenity 🌿' },
  { src: '/hero/back-3.png', caption: 'Quiet Reflection 🌌' },
]
const MID_IMAGES = [
  { src: '/hero/mid-1.png', caption: 'Stream of Thoughts 💧' },
  { src: '/hero/mid-2.png', caption: 'Safe Harbor 🕯️' },
  { src: '/hero/mid-3.png', caption: 'Gentle Breathing 🌲' },
]
const FRONT_IMAGES = [
  { src: '/hero/front-1.png', caption: 'Beauty in Chaos ✨' },
  { src: '/hero/front-2.png', caption: 'Mindful Moments ☕' },
  { src: '/hero/front-3.png', caption: 'Roots & Growth 🪴' },
]

function TearOffStack({ images, posClass, rotations, accent, delayMs }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [flyingIdx, setFlyingIdx] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    const tick = () => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % images.length
        setFlyingIdx(prev)
        setTimeout(() => setFlyingIdx(null), 850)
        return next
      })
    }

    const timeout = setTimeout(() => {
      intervalRef.current = setInterval(tick, 3500)
    }, delayMs)

    return () => {
      clearTimeout(timeout)
      clearInterval(intervalRef.current)
    }
  }, [images.length, delayMs])

  return (
    <>
      {images.map((img, i) => {
        const rot = rotations[i % rotations.length]
        const isActive = i === activeIdx
        const isFlying = i === flyingIdx

        let transform = `rotate(${rot}deg)`
        let opacity = isActive ? 1 : 0
        let visibility = isActive || isFlying ? 'visible' : 'hidden'
        let transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.6s ease, visibility 0.8s'
        let zIndex = isActive ? 5 : isFlying ? 4 : 1

        if (isFlying) {
          transform = `translate(180px, -120px) rotate(${rot + 35}deg) scale(0.85)`
          opacity = 0
          transition = 'transform 0.75s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease'
        }

        return (
          <div
            key={i}
            className={`${posClass} group bg-white dark:bg-slate-800`}
            style={{
              position: 'absolute',
              opacity,
              visibility,
              transform,
              transition,
              zIndex,
              willChange: 'transform, opacity',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 15px 25px -5px rgba(0, 0, 0, 0.15), 0 30px 35px -10px rgba(0, 0, 0, 0.1)',
              padding: '12px 12px 36px 12px',
              borderRadius: '4px',
            }}
          >
            {/* Masking tape accent */}
            <div
              className="scrapbook-tape"
              style={{
                top: '-14px',
                left: '50%',
                transform: `translateX(-50%) rotate(-1deg)`,
                background: accent,
              }}
            />
            {/* Image fills full card — paper padding creates the border effect */}
            <div className="bg-white dark:bg-slate-900" style={{ width: '100%', height: '100%', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.15)', position: 'relative' }}>
              <div className="absolute inset-0 shadow-[inset_0_0_25px_rgba(0,0,0,0.25)] pointer-events-none z-10 rounded-sm"></div>
              <img
                src={img.src}
                alt=""
                className="polaroid-image group-hover:filter-none"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div className="polaroid-caption">{img.caption}</div>
          </div>
        )
      })}
    </>
  )
}
import { ArrowRight, Brain, Sparkles, FileText, HeartHandshake } from 'lucide-react'

const FeatureCard = ({ n, title, body, index = 0, visible = true }) => (
  <div 
    className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all duration-[800ms] ease-out group hover:bg-purple-50/20 dark:hover:bg-slate-700 
    ${visible 
      ? 'opacity-100 translate-x-0 blur-none border-purple-200 dark:border-slate-600 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:border-purple-400 dark:hover:border-slate-500' 
      : 'opacity-0 translate-x-16 blur-md border-transparent shadow-none'}`}
    style={{ transitionDelay: `${index * 200 + 600}ms` }}
  >
    <div className="flex items-center gap-3 mb-2.5">
      <span className="font-sans text-[11px] font-bold text-white bg-violet px-3 py-1 rounded-full shadow-sm group-hover:bg-purple-600 transition-colors">
        STEP {n}
      </span>
      <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-slate-100 group-hover:text-purple-800 dark:group-hover:text-purple-400 transition-colors">{title}</h3>
    </div>
    <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed font-sans">{body}</p>
  </div>
)

function AnnouncementsMarquee({ announcements, typeToBadge, setSelectedAnnouncement }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const trackRef = useRef(null)
  // Mobile (<sm) gets a lightweight swipeable sheet instead of the 3D
  // coverflow: no perspective/rotateY, no per-render layout reads.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Auto-play interval (desktop coverflow only; skipped while tab is hidden)
  useEffect(() => {
    if (isPaused || isMobile || announcements.length < 2) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveIndex((prev) => (prev + 1) % announcements.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [isPaused, isMobile, announcements.length]);

  const handleNext = () => setActiveIndex((prev) => (prev + 1) % announcements.length)
  const handlePrev = () => setActiveIndex((prev) => (prev - 1 + announcements.length) % announcements.length)

  const scrollTrack = (dir) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('[data-ann-card]')
    const w = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.85
    // Plain step — the scroll handler below wraps around the duplicated set,
    // so arrows loop too.
    track.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  // Infinite swipe: the track holds two identical sets and rests in the
  // second one; after scrolling settles, jump by exactly one set width
  // (identical content = invisible) so neither end is ever reached.
  const wrapTimer = useRef(null)
  const handleTrackScroll = () => {
    const track = trackRef.current
    if (!track) return
    if (wrapTimer.current) clearTimeout(wrapTimer.current)
    wrapTimer.current = setTimeout(() => {
      const maxLeft = track.scrollWidth - track.clientWidth
      if (maxLeft <= 8) return
      const setW = track.scrollWidth / 2
      if (track.scrollLeft >= maxLeft - 8) {
        track.scrollTo({ left: track.scrollLeft - setW })
      } else if (track.scrollLeft <= 1) {
        track.scrollTo({ left: track.scrollLeft + setW })
      }
    }, 120)
  }

  // Park the track in the second set on mount so backward swipes have content.
  useEffect(() => {
    if (!isMobile) return undefined
    const track = trackRef.current
    if (!track || announcements.length < 2) return undefined
    const id = requestAnimationFrame(() => {
      if (track.scrollWidth > track.clientWidth) {
        track.scrollTo({ left: track.scrollWidth / 2 })
      }
    })
    return () => {
      cancelAnimationFrame(id)
      if (wrapTimer.current) clearTimeout(wrapTimer.current)
    }
  }, [isMobile, announcements.length])

  if (announcements.length === 0) {
    return (
      <div className="w-full text-center py-10 bg-purple-50/50 rounded-2xl border border-purple-100 shadow-sm font-sans text-xs text-stone-600">
        No active announcements on the bulletin board right now. Check back soon!
      </div>
    )
  }

  if (announcements.length === 1) {
    return (
      <div className="flex justify-center w-full">
        <div className="w-[82vw] max-w-[360px] lg:w-[380px] bg-white rounded-2xl shadow-[0_14px_30px_rgba(0,0,0,0.1)]">
          <AnnouncementCard
            title={announcements[0].title}
            body={announcements[0].body}
            date={announcements[0].date}
            badgeLabel={announcements[0].category}
            badgeClassName={typeToBadge(announcements[0].category).cls}
            images={announcements[0].images} imageUrl={announcements[0].imageUrl}
            onView={() => setSelectedAnnouncement(announcements[0])}
          />
        </div>
      </div>
    )
  }

  // Mobile: one centered card per view, swipeable — nothing overflows or clips.
  if (isMobile) {
    return (
      <div className="w-full py-6">
        <div ref={trackRef} onScroll={handleTrackScroll} className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar">
          {announcements.map((item, index) => (
            <div key={index} data-ann-card className="w-[82vw] max-w-[340px] shrink-0 snap-center">
              <AnnouncementCard
                title={item.title}
                body={item.body}
                date={item.date}
                badgeLabel={item.category}
                badgeClassName={typeToBadge(item.category).cls}
                images={item.images} imageUrl={item.imageUrl}
                onView={() => setSelectedAnnouncement(item)}
              />
            </div>
          ))}
          {/* Second identical set (non-interactive for assistive tech) enabling
              the infinite wrap above. Visually and functionally identical —
              every swiped-into-view card keeps its Read more action. */}
          {announcements.map((item, index) => (
            <div key={`loop-${index}`} aria-hidden="true" className="w-[82vw] max-w-[340px] shrink-0 snap-center">
              <AnnouncementCard
                title={item.title}
                body={item.body}
                date={item.date}
                badgeLabel={item.category}
                badgeClassName={typeToBadge(item.category).cls}
                images={item.images} imageUrl={item.imageUrl}
                onView={() => setSelectedAnnouncement(item)}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-12 mt-4">
          <button onClick={() => scrollTrack(-1)} className="p-2 text-purple-600/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-white transition-colors cursor-pointer" aria-label="Previous">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scrollTrack(1)} className="p-2 text-purple-600/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-white transition-colors cursor-pointer" aria-label="Next">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="w-full relative py-12 flex flex-col items-center justify-center overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ perspective: '1200px' }}
    >
      <div className="relative w-full max-w-[100vw] h-[440px] flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
        {announcements.map((item, index) => {
          let offset = index - activeIndex;
          const total = announcements.length;
          
          if (offset > Math.floor(total / 2)) offset -= total;
          if (offset < -Math.floor(total / 2)) offset += total;

          const isActive = offset === 0;
          const zIndex = 50 - Math.abs(offset);
          const scale = isActive ? 1 : Math.max(0.65, 1 - Math.abs(offset) * 0.15);
          
          const rotateY = offset * -22; 
          const translateX = offset * 200; 
          const translateZ = Math.abs(offset) * -120;
          
          const opacity = Math.abs(offset) > 2 ? 0 : (isActive ? 1 : 0.45);

          return (
            <div 
              key={index}
              className={`absolute w-[320px] sm:w-[360px] lg:w-[380px] rounded-2xl bg-white transition-[transform,opacity] duration-[800ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${isActive ? 'cursor-default pointer-events-auto' : 'cursor-pointer pointer-events-auto'}`}
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex,
                opacity,
                transformStyle: 'preserve-3d',
                boxShadow: isActive ? '0 30px 60px -15px rgba(168,85,247,0.25)' : '0 10px 30px -10px rgba(0,0,0,0.1)'
              }}
              onClick={() => {
                if (isActive) setSelectedAnnouncement(item);
                else setActiveIndex(index);
              }}
            >
              {/* Overlay for non-active items */}
              {!isActive && (
                <div className="absolute inset-0 bg-white/40 dark:bg-black/40 z-20 rounded-2xl transition-opacity duration-[800ms]" />
              )}
              <AnnouncementCard
                title={item.title}
                body={item.body}
                date={item.date}
                badgeLabel={item.category}
                badgeClassName={typeToBadge(item.category).cls}
                images={item.images} imageUrl={item.imageUrl}
                onView={() => setSelectedAnnouncement(item)}
              />
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-12 mt-6 relative z-50">
        <button onClick={handlePrev} className="p-2 text-purple-600/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-white transition-colors cursor-pointer z-20" aria-label="Previous">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button onClick={handleNext} className="p-2 text-purple-600/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-white transition-colors cursor-pointer z-20" aria-label="Next">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}

function Landing({ sectionsOverride }) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeCardId, setActiveCardId] = useState(null)
  const [aboutVisible, setAboutVisible] = useState(false)
  const [missionVisible, setMissionVisible] = useState(false)
  const [valuesVisible, setValuesVisible] = useState(false)
  const [messyMindVisible, setMessyMindVisible] = useState(false)
  const [programsVisible, setProgramsVisible] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const carouselRef = useRef(null)
  const aboutRef = useRef(null)
  const aboutLineRef = useRef(null)
  const aboutLine2Ref = useRef(null)
  const missionRef = useRef(null)
  const valuesRef = useRef(null)
  const messyMindRef = useRef(null)
  const programsRef = useRef(null)

  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })
  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'))
    checkTheme()
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme()
        }
      })
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Scroll-triggered animations for Programs section (play once, then stop observing)
  useEffect(() => {
    const section = programsRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry], obs) => {
        if (entry.isIntersecting) {
          setProgramsVisible(true)
          obs.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Scroll-triggered animations for Messy Mind section (play once, then stop observing)
  useEffect(() => {
    const section = messyMindRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry], obs) => {
        if (entry.isIntersecting) {
          setMessyMindVisible(true)
          obs.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Scroll-triggered SVG draw animation for About section (plays once, then stops observing)
  useEffect(() => {
    const section = aboutRef.current
    const line1 = aboutLineRef.current
    const line2 = aboutLine2Ref.current
    if (!section || !line1 || !line2) return
    const totalLength = 3500

    const resetLine = (el) => {
      el.style.transition = 'none'
      el.style.strokeDasharray = totalLength
      el.style.strokeDashoffset = totalLength
    }
    resetLine(line1)
    resetLine(line2)

    const observer = new IntersectionObserver(
      ([entry], obs) => {
        if (entry.isIntersecting) {
          setAboutVisible(true)
          // Line 1 — draws immediately
          resetLine(line1)
          void line1.getBoundingClientRect()
          line1.style.transition = 'stroke-dashoffset 3.5s ease-in-out'
          line1.style.strokeDashoffset = '0'
          // Line 2 — draws with 600ms stagger
          resetLine(line2)
          setTimeout(() => {
            line2.style.transition = 'stroke-dashoffset 3.5s ease-in-out'
            line2.style.strokeDashoffset = '0'
          }, 600)
          obs.unobserve(entry.target)
        }
      },
      { threshold: 0.12 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Scroll-triggered animations for Mission & Vision section (play once, stop observing)
  useEffect(() => {
    const section = missionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMissionVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Scroll-triggered animations for Core Values section (play once, stop observing)
  useEffect(() => {
    const section = valuesRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setValuesVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const [activeSection, setActiveSection] = useState('')
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 })
  const [isPillMoving, setIsPillMoving] = useState(false)
  const navRef = useRef(null)
  const pillTimeoutRef = useRef(null)

  useEffect(() => {
    if (!activeSection || !navRef.current) return
    const activeLink = navRef.current.querySelector(`[href="#${activeSection}"]`)
    if (activeLink) {
      setIsPillMoving(true)
      setPillStyle({
        left: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
        opacity: 1
      })
      if (pillTimeoutRef.current) clearTimeout(pillTimeoutRef.current)
      pillTimeoutRef.current = setTimeout(() => {
        setIsPillMoving(false)
      }, 300)
    } else {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [activeSection])

  const handleNavClick = (e, href) => {
    e.preventDefault()
    const targetId = href.slice(1)
    const el = document.getElementById(targetId)
    if (el) {
      const offset = 80 // Adjust for navbar height
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const handleScrollSpy = () => {
      const sectionIds = ['hero', 'specialties', 'about', 'foundations', 'news', 'contact']
      
      // Check if scrolled to the absolute bottom of the page
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        setActiveSection(sectionIds[sectionIds.length - 1])
        return
      }

      const scrollPosition = window.scrollY + 200 // Offset for fixed header

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i])
        if (el) {
          const { top } = el.getBoundingClientRect()
          const absoluteTop = top + window.scrollY
          if (scrollPosition >= absoluteTop) {
            setActiveSection(sectionIds[i])
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScrollSpy)
    handleScrollSpy() // Run on mount

    return () => {
      window.removeEventListener('scroll', handleScrollSpy)
    }
  }, [])

  const scrollPrev = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -340, behavior: 'smooth' })
    }
  }

  const scrollNext = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 340, behavior: 'smooth' })
    }
  }

  const [announcements, setAnnouncements] = useState([])
  // Stale-while-revalidate: paint the last saved CMS content instantly on
  // refresh (no blank hero, no wrong defaults), then refresh it in background.
  const [landing, setLanding] = useState(() => readLandingCache())
  const [landingReady, setLandingReady] = useState(false)

  // When an admin is previewing their edits, use the unpublished sections they
  // pass in instead of the saved landing content. Everything reads through this
  // so the preview is pixel-for-pixel what the page will render.
  const source = sectionsOverride || landing

  const L = (section, key, fallback) => {
    try {
      const v = source?.[section]?.[key]
      return v !== undefined && v !== '' && v !== null ? v : fallback
    } catch {
      return fallback
    }
  }

  const typeToBadge = (category) => {
    if (!category) return { label: 'INFO', cls: 'bg-purple-100 text-purple-800 border-purple-200' }
    const normalized = category.toLowerCase()
    if (normalized.includes('urgent')) return { label: category, cls: 'bg-rose-100 text-rose-800 border-rose-200 font-semibold' }
    if (normalized.includes('event')) return { label: category, cls: 'bg-purple-100 text-purple-800 border-purple-200 font-semibold' }
    if (normalized.includes('promo')) return { label: category, cls: 'bg-violet/10 text-purple-900 border-purple-200 font-semibold' }
    return { label: category, cls: 'bg-purple-100 text-purple-800 border-purple-200 font-semibold' }
  }

  useEffect(() => {
    let on = true
    api.publicAnnouncements()
      .then((d) => {
        if (!on) return
        if (d.announcements && d.announcements.length > 0) {
          const mapped = d.announcements.map((a) => ({
            category: a.type ? a.type.toUpperCase() : 'PROMOTION',
            date: a.publish_date ? new Date(a.publish_date).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '',
            title: a.title,
            body: a.body,
            imageUrl: a.image_url,
            images: Array.isArray(a.image_urls) && a.image_urls.length ? a.image_urls.filter(Boolean) : (a.image_url ? [a.image_url] : []),
          }))
          setAnnouncements(mapped)
        } else {
          setAnnouncements([
            {
              category: 'UPDATE',
              date: '08.15.2026',
              title: 'New Clinical Intake Process',
              body: 'We have updated our clinical intake procedure to better serve you. Please check your emails for the new forms.',
              imageUrl: null
            },
            {
              category: 'EVENT',
              date: '09.01.2026',
              title: 'Mental Health Awareness Seminar',
              body: 'Join our expert team for a free online seminar covering the foundations of mental health and self-care.',
              imageUrl: null
            },
            {
              category: 'PROMO',
              date: '09.15.2026',
              title: 'Back to School Wellness Package',
              body: 'Prepare your children for the upcoming academic year with our comprehensive wellness and evaluation package.',
              imageUrl: null
            },
            {
              category: 'INFO',
              date: '10.05.2026',
              title: 'Clinic Hours Extended',
              body: 'Our weekend clinic hours have been extended to better accommodate working parents and full-time students.',
              imageUrl: null
            }
          ])
        }
      })
      .catch((err) => {
        console.error('Failed to load announcements:', err)
        if (on) setAnnouncements([
            {
              category: 'UPDATE',
              date: '08.15.2026',
              title: 'New Clinical Intake Process',
              body: 'We have updated our clinical intake procedure to better serve you. Please check your emails for the new forms.',
              imageUrl: null
            },
            {
              category: 'EVENT',
              date: '09.01.2026',
              title: 'Mental Health Awareness Seminar',
              body: 'Join our expert team for a free online seminar covering the foundations of mental health and self-care.',
              imageUrl: null
            },
            {
              category: 'PROMO',
              date: '09.15.2026',
              title: 'Back to School Wellness Package',
              body: 'Prepare your children for the upcoming academic year with our comprehensive wellness and evaluation package.',
              imageUrl: null
            },
            {
              category: 'INFO',
              date: '10.05.2026',
              title: 'Clinic Hours Extended',
              body: 'Our weekend clinic hours have been extended to better accommodate working parents and full-time students.',
              imageUrl: null
            }
          ])
      })
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    let on = true
    let raf = 0
    if (Object.keys(readLandingCache()).length > 0) {
      // Cached sections paint instantly; double-rAF so the enter
      // transition still plays instead of appearing with no animation.
      raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (on) setLandingReady(true)
        }),
      )
    }
    api.publicLanding()
      .then((d) => {
        if (!on) return
        if (d.sections) {
          setLanding(d.sections)
          writeLandingCache(d.sections)
        }
        // Reveal once the saved content arrives (or the fetch fails) so the
        // hardcoded fallbacks never flash on screen first.
        setLandingReady(true)
      })
      .catch(() => {
        if (on) setLandingReady(true)
      })
    return () => {
      on = false
      cancelAnimationFrame(raf)
    }
  }, [])

  const mindNotes = [
    {
      id: 1,
      tag: "Individual Therapy",
      question: "Feeling lost in a tangle of anxiety or stress?",
      answer: "Our tailored individual counseling sessions provide gentle guidance to help unspool anxious thoughts and restore inner clarity.",
      Icon: Brain
    },
    {
      id: 2,
      tag: "Pediatric & Child",
      question: "Concerned about speech or motor progress in your child?",
      answer: "Early intervention strategies and pediatric evaluations designed to support developmental milestones with empathetic care.",
      Icon: Sparkles
    },
    {
      id: 3,
      tag: "Evaluations",
      question: "Seeking formal psychological testing or school evaluations?",
      answer: "We provide comprehensive psychometric evaluations to unlock tailored support and classroom integration plans.",
      Icon: FileText
    },
    {
      id: 4,
      tag: "Family & Couples",
      question: "Navigating relationship changes or parenting stress?",
      answer: "Collaborative family and relationship support focused on rebuilding healthy communication and resilient emotional bonds.",
      Icon: HeartHandshake
    }
  ]

  // Hero tear-off card stack images — read from the CMS editor (keys back-1..3,
  // mid-1..3, front-1..3) so uploaded photos actually show, falling back to the
  // original bundled artwork when nothing has been uploaded yet.
  const heroImgs = (prefix) => {
    const list = (source?.hero?.images || [])
    const mk = (i, fb) => {
      const im = list.find((img) => img.key === `${prefix}-${i}`)
      return { 
        src: im?.src || fb.src, 
        caption: im?.caption !== undefined ? im.caption : fb.caption 
      }
    }
    if (prefix === 'back') return [mk(1, BACK_IMAGES[0]), mk(2, BACK_IMAGES[1]), mk(3, BACK_IMAGES[2])]
    if (prefix === 'mid') return [mk(1, MID_IMAGES[0]), mk(2, MID_IMAGES[1]), mk(3, MID_IMAGES[2])]
    return [mk(1, FRONT_IMAGES[0]), mk(2, FRONT_IMAGES[1]), mk(3, FRONT_IMAGES[2])]
  }

  // The hero heading is rendered as <first> then a highlighted <second> word
  // with a wavy underline. If the editor set an explicit highlighted word, use
  // that; otherwise fall back to splitting the heading at its last space.
  const heroHeading = L('hero', 'heading', 'Clarity of Mind,')
  const heroHighlight = L('hero', 'highlight_word', 'Journey to Wellness')
  let heroFirst = heroHeading
  let heroSecond = heroHighlight
  if (!heroSecond) {
    const idx = heroHeading.lastIndexOf(' ')
    if (idx > -1) {
      heroFirst = heroHeading.slice(0, idx)
      heroSecond = heroHeading.slice(idx + 1)
    } else {
      heroFirst = heroHeading
      heroSecond = ''
    }
  }
  const heroTextColor = L('hero', 'heading_color', '#ffffff')
  const heroSizeMap = {
    sm: 'text-3xl sm:text-4xl lg:text-5xl',
    md: 'text-3xl sm:text-5xl lg:text-6xl',
    lg: 'text-4xl sm:text-6xl lg:text-7xl',
  }
  const heroSize = heroSizeMap[L('hero', 'heading_size', 'md')] || heroSizeMap.md

  return (
    <main id="top" className="min-h-screen bg-[#efeaf7] dark:bg-slate-950 text-stone-800 dark:text-slate-200 overflow-x-clip selection:bg-violet selection:text-white font-sans">
      <SplashCursor
        DENSITY_DISSIPATION={3.5}
        VELOCITY_DISSIPATION={2}
        PRESSURE={0.1}
        CURL={3}
        SPLAT_RADIUS={0.2}
        SPLAT_FORCE={6000}
        COLOR_UPDATE_SPEED={10}
        SHADING
        RAINBOW_MODE={false}
        COLOR="#A855F7"
      />
      <style>{`
        @keyframes dust-fall {
          0% { transform: translateY(-5px) scale(0.5); opacity: 0; }
          20% { opacity: 1; scale: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(40px) scale(0.5); opacity: 0; }
        }
        @keyframes nav-slide-down {
          0%   { transform: translateY(-110%); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .landing-nav-intro {
          animation: nav-slide-down 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes blob-float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10vw, 12vh) scale(1.1); }
          66% { transform: translate(-8vw, 10vh) scale(0.95); }
        }
        @keyframes blob-float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-12vw, -12vh) scale(1.05); }
          66% { transform: translate(10vw, -8vh) scale(0.9); }
        }
        @keyframes blob-float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(8vw, -12vh) scale(0.9); }
          66% { transform: translate(-12vw, 12vh) scale(1.1); }
        }
      `}</style>
      {/* Sticky Header */}
      <header
        className={`landing-nav-intro light-mode-nav fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4 sm:px-6 xl:px-16 ${scrolled
          ? 'bg-white/90 dark:bg-[#120c1d]/95 backdrop-blur-md shadow-md py-2.5 sm:py-3 border-b border-purple-200/50 dark:border-purple-900/50 text-purple-950 dark:text-white'
          : 'bg-transparent text-purple-950 dark:text-white pt-5 sm:pt-8 pb-3 sm:pb-4'
          }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between relative gap-2">
          {/* Logo */}
          <a
            href="#top"
            className="flex items-center space-x-2 sm:space-x-3 text-purple-950 dark:text-white transition-colors duration-300 shrink-0"
          >
            <div className="h-8 w-8 sm:h-9 sm:w-9 bg-purple-900 dark:bg-white transition-colors duration-300 shrink-0" style={{ WebkitMaskImage: 'url(/logo-cymon.png)', maskImage: 'url(/logo-cymon.png)', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
            <div className="flex flex-col">
              <span className="text-base sm:text-xl tracking-wider text-purple-950 dark:text-white leading-none transition-colors duration-300" style={{ fontFamily: 'Against' }}>ClearMind</span>
              <span className="hidden sm:block text-[8px] sm:text-[9.5px] tracking-widest text-purple-700 dark:text-purple-200 font-semibold uppercase mt-0.5 transition-colors duration-300">Psychological Services</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav ref={navRef} className={`hidden xl:flex absolute left-1/2 -translate-x-1/2 items-center space-x-1 px-2 py-1.5 rounded-full border transition-all duration-700 ease-out ${scrolled
            ? 'bg-white/90 dark:bg-[#1a1129]/90 border-purple-200/50 dark:border-purple-400/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] dark:shadow-[0_0_30px_rgba(168,85,247,0.5)] backdrop-blur-xl'
            : 'bg-white/30 dark:bg-white/10 border-purple-900/10 dark:border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.3)] backdrop-blur-md'
            }`}>
            
            {/* Sliding Pill Indicator */}
            <div 
              className={`absolute top-1.5 bottom-1.5 bg-purple-900/10 dark:bg-white/20 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isPillMoving ? 'blur-[1.5px]' : 'blur-0'}`}
              style={{
                left: pillStyle.left,
                width: pillStyle.width,
                opacity: pillStyle.opacity
              }}
            />
            
            {/* Raining Dust Effect */}
            <div className={`absolute top-full left-0 w-full h-12 overflow-hidden pointer-events-none transition-opacity duration-700 ${scrolled ? 'opacity-100' : 'opacity-40'}`}>
              <div className="absolute top-0 left-[10%] w-[3px] h-[3px] bg-white rounded-full shadow-[0_0_6px_white] animate-[dust-fall_2s_linear_infinite]" style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-0 left-[30%] w-1 h-1 bg-purple-300 rounded-full shadow-[0_0_8px_#d8b4fe] animate-[dust-fall_3s_linear_infinite]" style={{ animationDelay: '1.5s' }} />
              <div className="absolute top-0 left-[50%] w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_4px_white] animate-[dust-fall_2.5s_linear_infinite]" style={{ animationDelay: '0.7s' }} />
              <div className="absolute top-0 left-[70%] w-1 h-1 bg-purple-200 rounded-full shadow-[0_0_6px_#e9d5ff] animate-[dust-fall_2.2s_linear_infinite]" style={{ animationDelay: '2.1s' }} />
              <div className="absolute top-0 left-[90%] w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white] animate-[dust-fall_2.8s_linear_infinite]" style={{ animationDelay: '0.4s' }} />
            </div>

            {[
              { label: 'Specialties', href: '#specialties' },
              { label: 'About Us', href: '#about' },
              { label: 'Foundations', href: '#foundations' },
              { label: 'Announcement', href: '#news' },
              { label: 'Contact Us', href: '#contact' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`cymon-pearl-btn z-10 ${
                  activeSection === link.href.slice(1) ? 'active' : ''
                }`}
              >
                <div className="wrap text-[12px] xl:text-[13px] whitespace-nowrap">
                  <p>
                    {link.label}
                  </p>
                </div>
              </a>
            ))}
          </nav>

          {/* Desktop Log In & ThemeToggle — shows only at 1280px+ */}
          <div className="hidden xl:flex items-center gap-4 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="cymon-pushable-btn"
            >
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front">Log In</span>
            </button>
            <ThemeToggle />
          </div>

          {/* Mobile / Tablet Hamburger — shows below 1280px */}
          <div className="flex xl:hidden items-center gap-3 shrink-0">
            <div style={{ '--toggle-size': '13.3px' }} className="flex items-center">
              <ThemeToggle />
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-12 w-12 items-center justify-center focus:outline-none z-[110] text-purple-950 dark:text-white cursor-pointer rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className={`w-5 h-5 block transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay — the dark purple bg slides down like a card on
          open and back up on close (translate only, no fade). Always mounted
          for the exit animation; parked fully off-screen + pointer-events
          disabled when closed so the hidden state stays cheap. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className={`fixed inset-0 z-[100] h-dvh w-screen bg-[#120c1d] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex flex-col px-4 pt-5 sm:px-6 sm:pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          mobileMenuOpen
            ? 'translate-y-0 pointer-events-auto'
            : '-translate-y-full pointer-events-none'
        }`}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between w-full border-b border-purple-900/40 pb-4">
          <a
            href="#top"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-white"
          >
            <img src="/logo-cymon.png" alt="ClearMind" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <div className="flex flex-col">
              <span className="text-base sm:text-xl tracking-wider text-white leading-none font-['Against']">ClearMind</span>
              <span className="text-[9.5px] tracking-widest text-purple-300 font-semibold uppercase mt-0.5">Psychological Services</span>
            </div>
          </a>
          {/* Overlay close X — same 25.2px box and 20px strokes as the header
              icon, seated in a header-mirrored top bar so the two coincide
              as one while open. */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className={`flex h-12 w-12 shrink-0 items-center justify-center text-white cursor-pointer transition-[transform,opacity] duration-300 ease-out hover:opacity-70 active:scale-90 ${
              mobileMenuOpen ? 'delay-[150ms] opacity-100 scale-100' : 'delay-0 opacity-0 scale-90'
            }`}
          >
            <span className="relative block h-[25.2px] w-[25.2px]" aria-hidden="true">
              <span className="absolute left-[2.6px] top-1/2 h-[2px] w-5 -translate-y-1/2 rotate-45 rounded-full bg-white" />
              <span className="absolute left-[2.6px] top-1/2 h-[2px] w-5 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
            </span>
          </button>
        </div>

        {/* Nav Links — one-by-one quick slide-in from the left */}
        <nav className="flex flex-col items-center justify-center gap-1.5 text-center my-auto w-full">
          {[
            { label: 'Specialties', href: '#specialties', delay: 'delay-[60ms]' },
            { label: 'About Us', href: '#about', delay: 'delay-[110ms]' },
            { label: 'Foundations', href: '#foundations', delay: 'delay-[160ms]' },
            { label: 'Announcement', href: '#news', delay: 'delay-[210ms]' },
            { label: 'Contact Us', href: '#contact', delay: 'delay-[260ms]' },
          ].map(({ label, href, delay }, i) => {
            const active = activeSection === href.slice(1)
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => {
                  setMobileMenuOpen(false)
                  handleNavClick(e, href)
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full max-w-xs items-center gap-4 rounded-2xl px-5 py-3 text-left transition-[transform,opacity,background-color,color] duration-300 ease-out ${
                  mobileMenuOpen ? delay : 'delay-0'
                } ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                } ${
                  mobileMenuOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-8'
                }`}
              >
                <span className="font-mono text-[11px] font-bold text-purple-400/90">0{i + 1}</span>
                <span className="flex-1 text-xl font-bold tracking-wide">{label}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-purple-400' : 'bg-transparent'}`} />
              </a>
            )
          })}
          {/* Log In pops in after the links (no stagger delay on exit) */}
          <div className={`w-full max-w-xs mt-5 flex flex-col items-center gap-3 transition-[transform,opacity] duration-300 ease-out ${
              mobileMenuOpen ? 'delay-[340ms]' : 'delay-0'
            } ${
              mobileMenuOpen
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-90'
            }`}>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/login')
              }}
              className="cymon-pushable-btn w-full"
            >
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front py-[14px]">Log In</span>
            </button>
          </div>
          {/* Tagline fades in last (no delay on exit so close-out stays snappy) */}
          <p className={`mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-purple-300/60 transition-opacity duration-700 ease-out ${
            mobileMenuOpen ? 'delay-[550ms]' : 'delay-0'
          } ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}>Clarity of Mind, Journey to Wellness</p>
        </nav>
      </div>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative min-h-screen w-full pt-24 pb-16 sm:pt-28 lg:pt-36 lg:pb-28 px-4 sm:px-6 lg:px-16 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#efeaf7] via-[#f3f0fb] to-[#ffffff] dark:from-[#18102b] dark:via-[#171226] dark:to-[#120c1d] transition-colors duration-1000"
      >
        {/* Animated Background (Light Mode) */}
        <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out ${isDark ? 'opacity-0' : 'opacity-100'}`}>
          <GradientWaves
            horizonColor="#9209ee"
            waveColor="#ffffff"
            crestColor="#ffffff"
            speed={0.4}
            amplitude={2.5}
            waveScale={0.6}
            waveRatio={1.15}
            swell={35}
            turbulence={20}
            tilt={0.53}
            zoom={1}
            height={5.5}
            fogDepth={15}
            detail="medium"
            brightness={1}
            opacity={1}
            mouseInteraction
            parallaxStrength={0.5}
            grain
            grainIntensity={0.05}
            active={!isDark}
          />
        </div>

        {/* Animated Galaxy Background (Dark Mode) */}
        <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out ${isDark ? 'opacity-100' : 'opacity-0'}`}>
          <Silk
            speed={3.2}
            scale={0.6}
            color="#aa67ea"
            noiseIntensity={0.4}
            rotation={0.32}
            lightMode={false}
            active={isDark}
          />
        </div>
        <div className="absolute top-1/3 right-1/4 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-violet/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-10 lg:gap-12 items-center z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-6 w-full min-w-0 space-y-4 sm:space-y-6">
            <h1
              className={`${heroSize} font-extrabold leading-[1.12] tracking-tight transition-all duration-500 ${
                sectionsOverride || landingReady ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ color: isDark ? L('hero', 'heading_color_dark', L('hero', 'heading_color', '#ffffff')) : L('hero', 'heading_color', '#3b0764') }}
            >
              {(() => {
                const highlightColor = isDark ? L('hero', 'highlight_color_dark', L('hero', 'highlight_color', '#a57aff')) : L('hero', 'highlight_color', '#a57aff')
                const underlineColor = isDark ? L('hero', 'underline_color_dark', L('hero', 'underline_color', '#8c52ff')) : L('hero', 'underline_color', '#8c52ff')
                const second = heroSecond || ''
                return (
                  <>
                    {heroFirst}
                    {second && (
                      <>
                        <br />
                        <span className="relative inline-block" style={{ color: highlightColor }}>
                          {second}
                          {/* Wavy underline matching the reference design */}
                          <svg
                            className="absolute -bottom-2 left-0 w-full overflow-visible pointer-events-none"
                            viewBox="0 0 300 10"
                            preserveAspectRatio="none"
                            fill="none"
                          >
                            <path
                              d="M0,7 Q75,1 150,7 T300,7"
                              stroke={underlineColor}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </>
                    )}
                  </>
                )
              })()}
            </h1>

            <p
              className={`text-slate-700 dark:text-slate-200 text-xs sm:text-base leading-relaxed max-w-xl font-sans font-normal break-words transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {L('hero', 'subheading', 'Expert, compassionate psychological care. We walk with you on your own pace - restoring peace, clarity, and resilience for children and families.')}
            </p>

            <div className={`pt-2 hidden lg:block transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}>
              <div className="mt-8">
                <UiverseGetStartedBtn />
              </div>
            </div>
          </div>

          {/* Right Column: Tear-Off Card Stack */}
          <div className="lg:col-span-6 w-full flex flex-col items-center justify-center py-6 lg:py-0">

            {/* ── Mobile only (< sm / < 640px): single animated card ── */}
            <div
              className={`sm:hidden relative transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ width: 'min(280px, 85vw)', height: 'min(240px, 73vw)' }}
            >
              <div className="group absolute inset-0">
                <div className="bg-notebook-lines relative w-full h-full p-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] border border-black/10 dark:border-white/10 rounded-sm">
                  <TearOffStack images={heroImgs('back')} posClass="" rotations={[-3, 2, -2]} accent="rgba(243,229,171,0.82)" delayMs={0} />
                </div>
              </div>
            </div>

            {/* ── Tablet (sm–lg / 640–1023px): back + mid, two-stack ── */}
            <div
              className={`hidden sm:block lg:hidden relative transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ width: 'min(420px, 88vw)', height: 'min(360px, 75vw)' }}
            >
              {/* Back — upper-left */}
              <div className="group absolute top-0 left-0 w-[60%] h-[76%] z-10 hover:!z-40">
                <div className="bg-notebook-lines relative w-full h-full p-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] border border-black/10 dark:border-white/10 rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-x-8 group-hover:-translate-y-4">
                  <TearOffStack images={heroImgs('back')} posClass="" rotations={[-3, 2, -2]} accent="rgba(243,229,171,0.82)" delayMs={0} />
                </div>
              </div>
              {/* Mid — lower-right */}
              <div className="group absolute bottom-0 right-0 w-[58%] h-[72%] z-20 hover:!z-40">
                <div className="bg-notebook-lines relative w-full h-full p-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] border border-black/10 dark:border-white/10 rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-8 group-hover:translate-y-4">
                  <TearOffStack images={heroImgs('mid')} posClass="" rotations={[4, -2, 3]} accent="rgba(198,180,255,0.75)" delayMs={250} />
                </div>
              </div>
            </div>

            {/* ── Desktop (lg+ / 1024px+): all three stacks ── */}
            <div
              className={`hidden lg:block relative transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ width: 'min(500px, 44vw)', height: 'min(440px, 38vw)' }}
            >
              {/* Back — upper-left, z:1 */}
              <div className="group absolute top-0 left-0 w-[60%] h-[75%] z-10 hover:!z-40">
                <div className="bg-notebook-lines relative w-full h-full p-[9px] shadow-[0_12px_30px_rgba(0,0,0,0.45)] border border-black/10 dark:border-white/10 rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-x-12 group-hover:-translate-y-6">
                  <TearOffStack images={heroImgs('back')} posClass="" rotations={[-3, 2, -2]} accent="rgba(243,229,171,0.82)" delayMs={0} />
                </div>
              </div>
              {/* Mid — center-right, z:2 */}
              <div className="group absolute top-[13%] right-0 w-[57%] h-[70%] z-20 hover:!z-40">
                <div className="bg-notebook-lines relative w-full h-full p-[9px] shadow-[0_12px_30px_rgba(0,0,0,0.45)] border border-black/10 dark:border-white/10 rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-12 group-hover:-translate-y-4">
                  <TearOffStack images={heroImgs('mid')} posClass="" rotations={[4, -2, 3]} accent="rgba(198,180,255,0.75)" delayMs={250} />
                </div>
              </div>
              {/* Front — bottom center, z:3 foreground */}
              <div className="group absolute bottom-0 left-[16%] w-[48%] h-[44%] z-30 hover:!z-40">
                <div className="bg-notebook-lines relative w-full h-full p-[9px] shadow-[0_12px_30px_rgba(0,0,0,0.45)] border border-black/10 dark:border-white/10 rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-10">
                  <TearOffStack images={heroImgs('front')} posClass="" rotations={[-5, 4, -3]} accent="rgba(243,229,171,0.82)" delayMs={500} />
                </div>
              </div>
            </div>

            {/* Mobile/Tablet button (Centered) */}
            <div className={`w-full flex justify-center lg:hidden pt-16 transition-all duration-1000 ease-out ${
                sectionsOverride || landingReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}>
              <UiverseGetStartedBtn />
            </div>

          </div>
        </div>
      </section>

      {/* Interactive Section: Specialties Scrollytelling */}
      <SpecialtiesScrollytelling
        heading={L('specialties', 'heading', null)}
        subtext={L('specialties', 'subtext', null)}
        items={source?.specialties?.items}
      />

      {/* About & Foundation Section */}
      <section
        ref={aboutRef}
        id="about"
        className="relative py-20 sm:py-28 lg:py-32 px-6 lg:px-16 bg-white dark:bg-slate-900 transition-colors duration-500 overflow-hidden"
      >
        {/* Animated SVG Line Background */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true">
          <svg
            viewBox="0 0 1440 900"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 0 14px rgba(168,85,247,0.45))' }}
          >
            <path
              ref={aboutLineRef}
              d="M -100,700 C 150,400 280,900 520,550 C 720,250 900,850 1100,480 C 1260,180 1380,750 1540,400"
              fill="none"
              stroke="#a855f7"
              strokeWidth="90"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Second animated line — staggered 600ms, thicker */}
            <path
              ref={aboutLine2Ref}
              d="M -80,200 C 200,500 400,50 680,380 C 920,670 1120,150 1350,520 C 1480,720 1560,300 1650,450"
              fill="none"
              stroke="#c084fc"
              strokeWidth="70"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </svg>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto space-y-12 sm:space-y-16">
          <div
            className={`text-center space-y-2 transition-all duration-[1200ms] ease-out ${
              aboutVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-fuchsia-600 to-indigo-700 drop-shadow-sm pb-2">
              Our Story & Foundation
            </h2>
          </div>

          <div
            className={`space-y-6 max-w-5xl mx-auto transition-all duration-[1200ms] delay-200 ease-out ${
              aboutVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            {/* Top Text Card */}
            <div className="bg-[#f8f5fc] dark:bg-slate-800 rounded-3xl border border-purple-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-700 pb-3">
                <span className="font-mono text-[11px] font-bold text-stone-600 dark:text-slate-400 uppercase tracking-widest">
                  {L('about', 'location_label', 'CABUYAO, LAGUNA')}
                </span>

              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-slate-100 font-['Playfair_Display']">
                <span
                  className={`relative inline-block transition-transform duration-700 delay-500 ${
                    aboutVisible ? 'scale-105 origin-left' : 'scale-100'
                  }`}
                >
                  <span className="absolute inset-0 bg-purple-200/50 dark:bg-purple-800/40 -z-10 -rotate-1 rounded-sm mix-blend-multiply dark:mix-blend-normal"></span>
                  {L('about', 'heading', 'Inspired by Quiet Strength and Purpose')}
                </span>
              </h3>

              {(() => {
                const paragraphs = source?.about?.paragraphs
                const defaultParagraphs = [
                  'ClearMind Psychological Services (CMPS) was established on December 18, 2024. The clinic name was inspired through St. Clare of Assisi — a saint revered for devotion, penance, and contemplation.',
                  'We believe mental health care should be accessible, comforting, and tailored to each individual’s personal story. Our multi-specialty team of Clinical Psychologists, Psychometricians, Speech-Language Pathologists, and Occupational Therapists collaborate closely so that every client feels heard, valued, and fully supported.',
                ]
                const list = Array.isArray(paragraphs) && paragraphs.length ? paragraphs : defaultParagraphs
                return list.map((text, i) => (
                  <p key={i} className="text-stone-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm font-sans">
                    {text}
                  </p>
                ))
              })()}
            </div>

            {/* Horizontal 2-Column Images Row Below */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 pt-6 pb-4">
              <div className="relative mx-auto w-full max-w-md polaroid-frame bg-white dark:bg-slate-800 p-4 pb-10 sm:pb-12 shadow-xl rotate-[-2deg] border border-purple-100 dark:border-slate-700 transition-transform hover:rotate-0 duration-500">
                <div className="scrapbook-tape-violet scrapbook-tape -top-4 left-8 rotate-[-3deg]" />
                <div className="aspect-[16/11] w-full overflow-hidden rounded-sm bg-stone-900 shadow-inner">
                  <img
                    src={(source?.about?.images || []).find((img) => img.key === 'front.jpg')?.src || '/front.jpg'}
                    alt="Multidisciplinary Team"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-md polaroid-frame bg-white dark:bg-slate-800 p-4 pb-10 sm:pb-12 shadow-xl rotate-[3deg] border border-purple-100 dark:border-slate-700 transition-transform hover:rotate-0 duration-500 mt-4 md:mt-0">
                <div className="scrapbook-tape-violet scrapbook-tape -top-4 right-8 rotate-[4deg]" />
                <div className="aspect-[16/11] w-full overflow-hidden rounded-sm bg-stone-900 shadow-inner">
                  <img
                    src={(source?.about?.images || []).find((img) => img.key === 'front2.png')?.src || '/front2.png'}
                    alt="Pediatric & Adult Space"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section (New Design) */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
          50% { transform: translate(30px, -20px) scale(1.1); opacity: 0.55; }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) scale(1.05); opacity: 0.3; }
          50% { transform: translate(-30px, 25px) scale(0.95); opacity: 0.5; }
        }
        .animate-glow-1 { animation: float-slow 10s ease-in-out infinite; }
        .animate-glow-2 { animation: float-reverse 12s ease-in-out infinite; }
        .grid-pattern {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 3.5rem 3.5rem;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, #000 60%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, #000 60%, transparent 100%);
        }
      `}</style>
      <section ref={missionRef} className="relative w-full overflow-hidden py-20 lg:py-32 px-6 flex items-center justify-center bg-[#0b0817] text-white">
        
        {/* Ambient Animated Light Orbs & Grid - Blur in on scroll */}
        <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ease-out ${missionVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-1/4 left-[20%] w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] bg-purple-600/20 rounded-full blur-[110px] animate-glow-1" />
          <div className="absolute bottom-1/4 right-[20%] w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] bg-indigo-600/20 rounded-full blur-[110px] animate-glow-2" />
          <div className="absolute inset-0 grid-pattern" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full overflow-hidden p-2">
          
          {/* Section Title Area */}
          <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-1000 ease-out ${missionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-3">
              PURPOSE & COMMITMENT
            </span>
            <h2 className="text-3xl md:text-4xl font-['Playfair_Display'] font-bold text-white tracking-tight">
              Dedicated to Healing, Committed to Growth
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            
            {/* Mission Card (Slides from left) */}
            <div className={`group relative rounded-3xl p-8 lg:p-10 bg-white/[0.03] border border-white/10 hover:border-purple-500/40 backdrop-blur-xl transition-all duration-1000 ease-out hover:shadow-[0_20px_50px_rgba(139,92,246,0.15)] flex flex-col justify-between ${missionVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16'}`}>
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Our Mission
                  </span>
                </div>

                <h3 className="text-2xl lg:text-3xl font-['Playfair_Display'] font-bold text-white mb-4 tracking-tight group-hover:text-purple-200 transition-colors">
                  {L('mission', 'heading', 'Empowerment and Compassion')}
                </h3>
                
                <p className="text-slate-300/90 leading-relaxed text-sm lg:text-base font-light">
                  {L('mission', 'description', 'To provide compassionate, evidence-based mental health care that empowers individuals, couples, and families to navigate life&apos;s challenges with clarity and confidence. Through personalized therapy, testing, and developmental therapies, CMPS creates a safe space where healing begins.')}
                </p>
              </div>

              <div className="mt-8 pt-4 flex items-center justify-between border-t border-white/5">
                <div className="h-1 w-12 bg-gradient-to-r from-purple-500 to-transparent rounded-full group-hover:w-28 transition-all duration-500" />
                <span className="text-xs text-purple-400/80 font-medium group-hover:text-purple-300 transition-colors">Compassionate Care</span>
              </div>
            </div>

            {/* Vision Card (Slides from right) */}
            <div className={`group relative rounded-3xl p-8 lg:p-10 bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 backdrop-blur-xl transition-all duration-1000 delay-100 ease-out hover:shadow-[0_20px_50px_rgba(99,102,241,0.15)] flex flex-col justify-between ${missionVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'}`}>
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    {L('mission', 'vision_heading', 'Our Vision 2030')}
                  </span>
                </div>

                <h3 className="text-2xl lg:text-3xl font-['Playfair_Display'] font-bold text-white mb-4 tracking-tight group-hover:text-indigo-200 transition-colors">
                  Fostering Lifelong Growth
                </h3>
                
                <p className="text-slate-300/90 leading-relaxed text-sm lg:text-base font-light">
                  {L('mission', 'vision_description', 'CMPS envisions a future where mental health is valued as a cornerstone of overall well-being, free from stigma and barriers. By 2030, CMPS is dedicated to being a trusted leader in psychological care, fostering self-awareness, emotional strength, and personal growth province-wide.')}
                </p>
              </div>

              <div className="mt-8 pt-4 flex items-center justify-between border-t border-white/5">
                <div className="h-1 w-12 bg-gradient-to-r from-indigo-500 to-transparent rounded-full group-hover:w-28 transition-all duration-500" />
                <span className="text-xs text-indigo-400/80 font-medium group-hover:text-indigo-300 transition-colors">Future Growth</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Core Values & Acronym Section: CLEAR & MIND */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(60px, -40px) scale(1.15); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-50px, 50px) scale(1.2); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, 30px) scale(0.9); }
        }
        .orb-1 { animation: float1 14s ease-in-out infinite; }
        .orb-2 { animation: float2 18s ease-in-out infinite -4s; }
        .orb-3 { animation: float3 12s ease-in-out infinite -2s; }
        
        .bg-mesh-pattern {
          background-image: radial-gradient(rgba(147, 51, 234, 0.08) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .dark .glass-card {
          background: rgba(30, 41, 59, 0.85);
        }

        @keyframes flipIn360 {
          0% { opacity: 0; transform: perspective(1200px) rotateY(-360deg) scale(0.9); }
          100% { opacity: 1; transform: perspective(1200px) rotateY(0deg) scale(1); }
        }
        .animate-flip-in {
          animation: flipIn360 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-flip-in-delayed {
          animation: flipIn360 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards 0.2s;
          opacity: 0;
        }
      `}</style>
      <section id="foundations" ref={valuesRef} className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[#faf7fd] dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-500 relative overflow-hidden flex items-center justify-center bg-mesh-pattern">

        {/* Ambient Glowing Orbs */}
        <div className="absolute top-12 left-10 w-[28rem] h-[28rem] bg-gradient-to-tr from-purple-400/30 to-fuchsia-300/30 rounded-full blur-[90px] orb-1 pointer-events-none z-0" />
        <div className="absolute bottom-10 right-10 w-[32rem] h-[32rem] bg-gradient-to-br from-violet-400/30 to-indigo-300/30 rounded-full blur-[100px] orb-2 pointer-events-none z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] bg-pink-300/20 rounded-full blur-[80px] orb-3 pointer-events-none z-0" />

        <div className="max-w-6xl mx-auto w-full relative z-10 space-y-16">

          {/* Header Area */}
          <div className="text-center w-full mx-auto relative flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase bg-purple-100/90 text-purple-800 border border-purple-200 shadow-sm backdrop-blur-md mb-4 hover:scale-105 transition-transform cursor-default">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-600 animate-ping" />
              {L('values', 'badge', 'Our Values & Philosophy')}
            </div>
            <h1 className="max-w-4xl px-2 text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl md:text-6xl">
              {(() => {
                const full = L('values', 'heading', 'The Foundations of ClearMind')
                const idx = full.lastIndexOf(' ')
                const first = idx > -1 ? full.slice(0, idx) : full
                const second = idx > -1 ? full.slice(idx + 1) : ''
                return (
                  <>
                    {first}{' '}
                    {second && <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600">{second}</span>}
                  </>
                )
              })()}
            </h1>
            <p className="w-full max-w-2xl px-3 text-sm font-normal leading-6 text-slate-600 dark:text-slate-400 sm:text-base md:text-lg">
              {L('values', 'description', 'Guided by our core commitments to every client and our dedicated clinical approach.')}
            </p>
          </div>

          {/* Foundations Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

            {/* CLEAR Card */}
            <div className={`${valuesVisible ? 'animate-flip-in' : 'opacity-0'} glass-card dark:bg-slate-800/80 rounded-[2rem] p-7 sm:p-9 shadow-[0_20px_50px_rgba(147,51,234,0.07)] border border-purple-100/90 dark:border-slate-700 hover:border-purple-300/90 dark:hover:border-slate-500 hover:shadow-[0_25px_60px_rgba(147,51,234,0.12)] transition-all duration-500 relative flex flex-col justify-between group/card`}>
              {/* Subtle Top Glow */}
              <div className="absolute -top-px left-10 right-10 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full opacity-60" />

              <div>
                <div className="flex items-center justify-between mb-8 pb-5 border-b border-purple-100/80">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-3xl font-extrabold tracking-wider text-slate-900 dark:text-slate-100">CLEAR</h2>
                    </div>
                    <p className="text-xs text-purple-600 font-semibold tracking-wide uppercase mt-1">Our Core Commitments</p>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200/70 shadow-sm">
                    5 Commitments
                  </span>
                </div>

                <div className="space-y-3.5">
                  {(() => {
                    const items = Array.isArray(source?.values?.clear_items) && source.values.clear_items.length
                      ? source.values.clear_items
                      : [
                          { letter: 'C', title: 'Compassion', desc: 'We provide a warm, empathetic, and non-judgmental space for healing.' },
                          { letter: 'L', title: 'Lifelong Growth', desc: 'We promote continuous self-improvement, learning, and personal development.' },
                          { letter: 'E', title: 'Empowerment', desc: 'We equip individuals with practical tools to take charge of their mental well-being.' },
                          { letter: 'A', title: 'Authenticity', desc: 'We foster genuine connections built on transparency, honesty, and integrity.' },
                          { letter: 'R', title: 'Resilience', desc: 'We empower clients to develop sustainable emotional strength and adaptability.' },
                        ]
                    return items.map((item, index) => (
                    <div key={index} className="group relative p-3.5 rounded-2xl border border-purple-50 dark:border-slate-700 bg-white/70 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 hover:border-purple-200 dark:hover:border-slate-500 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 flex items-start gap-4 hover:-translate-y-0.5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white font-black flex items-center justify-center text-lg shadow-md shadow-purple-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0">
                        {item.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{item.title}</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 font-normal">{item.desc}</p>
                      </div>
                    </div>
                    ))
                  })()}
                </div>
              </div>
            </div>

            {/* MIND Card */}
            <div className={`${valuesVisible ? 'animate-flip-in-delayed' : 'opacity-0'} glass-card dark:bg-slate-800/80 rounded-[2rem] p-7 sm:p-9 shadow-[0_20px_50px_rgba(99,102,241,0.07)] border border-indigo-100/90 dark:border-slate-700 hover:border-indigo-300/90 dark:hover:border-slate-500 hover:shadow-[0_25px_60px_rgba(99,102,241,0.12)] transition-all duration-500 relative flex flex-col justify-between group/card`}>
              {/* Subtle Top Glow */}
              <div className="absolute -top-px left-10 right-10 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full opacity-60" />

              <div>
                <div className="flex items-center justify-between mb-8 pb-5 border-b border-indigo-100/80">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-3xl font-extrabold tracking-wider text-slate-900 dark:text-slate-100">MIND</h2>
                    </div>
                    <p className="text-xs text-indigo-600 font-semibold tracking-wide uppercase mt-1">Our Clinical Approach</p>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm">
                    4 Pillars
                  </span>
                </div>

                <div className="space-y-3.5">
                  {(() => {
                    const items = Array.isArray(source?.values?.mind_items) && source.values.mind_items.length
                      ? source.values.mind_items
                      : [
                          { letter: 'M', title: 'Mindfulness', desc: 'We encourage deep self-awareness, clarity, and present-focused growth.' },
                          { letter: 'I', title: 'Innovation', desc: 'We implement modern, evidence-based, and evolving psychological practices.' },
                          { letter: 'N', title: 'Nurturing', desc: "We actively support each client's journey toward healing and authentic self-discovery." },
                          { letter: 'D', title: 'Dedication', desc: 'We commit deeply to providing personalized, ethical, and compassionate care.' },
                        ]
                    return items.map((item, index) => (
                    <div key={index} className="group relative p-3.5 rounded-2xl border border-indigo-50 dark:border-slate-700 bg-white/70 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 hover:border-indigo-200 dark:hover:border-slate-500 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 flex items-start gap-4 hover:-translate-y-0.5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black flex items-center justify-center text-lg shadow-md shadow-indigo-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0">
                        {item.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{item.title}</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 font-normal">{item.desc}</p>
                      </div>
                    </div>
                    ))
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Clinical Programs & Workflow */}
      <section ref={programsRef} id="programs" className="relative py-20 sm:py-28 lg:py-32 px-6 lg:px-16 bg-gradient-to-b from-[#faf7fd] via-[#f9f5ff] to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-500 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12 sm:space-y-16 relative z-10">
          <div className="max-w-3xl space-y-2">

            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-['Playfair_Display'] font-black tracking-tight text-stone-900 dark:text-slate-100 transition-all duration-[1000ms] ease-out ${programsVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'}`}>
              {(() => {
                const full = L('programs', 'heading', 'Tailored care designed for your unique mind.')
                const hl = L('programs', 'highlight_word', null)
                let before = full
                let highlight = hl
                if (!highlight) {
                  const idx = full.lastIndexOf(' ')
                  if (idx > -1) { before = full.slice(0, idx); highlight = full.slice(idx + 1) }
                  else highlight = ''
                }
                return (
                  <>
                    {before}{' '}
                    {highlight && (
                      <span className={`inline-block whitespace-nowrap transition-all duration-[1000ms] delay-[800ms] ${programsVisible ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]' : 'text-stone-900 dark:text-slate-100'}`}>
                        {highlight}
                      </span>
                    )}
                  </>
                )
              })()}
            </h2>
            <p className={`text-stone-700 dark:text-slate-400 text-sm sm:text-base transition-all duration-[1000ms] delay-[300ms] ease-out ${programsVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'}`}>
              {L('programs', 'description', 'Whether you need diagnostic assessments, pediatric developmental therapies, or personal therapy, our multidisciplinary team builds an individualized roadmap for you.')}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Video Reel Frame */}
            <div className={`lg:col-span-5 flex justify-center transition-all duration-[1500ms] delay-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${programsVisible ? 'opacity-100 rotate-0 scale-100 translate-x-0' : 'opacity-0 -rotate-90 scale-50 -translate-x-32'}`}>
              <div className="w-full max-w-[340px] bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-[2rem] border border-purple-100 dark:border-slate-800 shadow-xl rotate-[-2deg] transition-transform hover:rotate-0 duration-500">
                <div className="aspect-[9/16] w-full rounded-2xl overflow-hidden relative bg-stone-900 shadow-inner">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F4243143042621333&show_text=false"
                    title="ClearMind Walkthrough Reel"
                    style={{ border: 'none', overflow: 'hidden' }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Right Feature Cards */}
            <div className="lg:col-span-7 space-y-4">
              {(() => {
                const cmsFeatures = source?.programs?.features
                const list = Array.isArray(cmsFeatures) && cmsFeatures.length
                  ? cmsFeatures.map((f, i) => ({ n: f.number || `0${i + 1}`, title: f.title || '', body: f.body || '' }))
                  : [
                      { n: '01', title: 'Clinical Intake & Diagnostics', body: 'Thorough intake sessions and psychometric evaluations to understand cognitive, adaptive, and emotional baselines.' },
                      { n: '02', title: 'Speech-Language Pathology', body: 'Specialized speech therapy to strengthen social communication, articulation, and expressive language skills.' },
                      { n: '03', title: 'Occupational Therapy (OT)', body: 'Sensory integration and fine/gross motor activities to build independent daily living skills for children.' },
                      { n: '04', title: 'Special Education & School Readiness', body: 'Targeted learning plans and milestone tracking geared toward successful classroom and community integration.' },
                    ]
                return list.map((f, i) => (
                  <FeatureCard key={i} n={f.n} title={f.title} body={f.body} index={i} visible={programsVisible} />
                ))
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Announcements Bulletin Board */}
      <section id="news" className="pt-24 pb-32 sm:pt-36 sm:pb-40 lg:pt-44 lg:pb-48 px-6 lg:px-16 bg-[#faf7fd] dark:bg-slate-900 transition-colors duration-500 bg-mesh-pattern relative overflow-hidden">
        {/* Top Dome SVG Divider */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] z-20 pointer-events-none">
          <svg className="relative block w-full h-[60px] md:h-[100px] lg:h-[140px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 V120 Q600,-20 1200,120 V0 Z" className="fill-white dark:fill-slate-900 transition-colors duration-500" />
          </svg>
        </div>

        {/* Large Gradient Circles Background */}
        <div className="absolute top-[10%] -left-[20%] w-[40rem] h-[40rem] lg:w-[60rem] lg:h-[60rem] rounded-full bg-gradient-to-br from-purple-600/15 via-fuchsia-500/10 dark:from-purple-500/25 dark:via-fuchsia-400/20 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-[30%] -right-[20%] w-[45rem] h-[45rem] lg:w-[65rem] lg:h-[65rem] rounded-full bg-gradient-to-tl from-indigo-600/15 via-purple-700/10 dark:from-indigo-500/25 dark:via-purple-500/20 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-12 sm:space-y-16 relative z-10">
          <div className="flex flex-col items-center text-center gap-3 pb-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase bg-white text-purple-800 border border-purple-200 shadow-sm mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Latest News
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-['Playfair_Display'] font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {L('news', 'heading', 'Announcements & Updates')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 font-sans text-sm md:text-base mt-2">
              {L('news', 'subheading', "Stay connected with ClearMind's latest programs, clinical notices, and upcoming wellness seminars.")}
            </p>
          </div>

          <AnnouncementsMarquee announcements={announcements} typeToBadge={typeToBadge} setSelectedAnnouncement={setSelectedAnnouncement} />
        </div>

        {/* Wavy Bottom Divider matching Footer Color */}
        <div className="absolute -bottom-px left-0 w-full overflow-hidden leading-[0] z-20 pointer-events-none">
          <svg className="relative block w-full h-[60px] md:h-[80px] lg:h-[100px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            {/* Background 10 waves for depth */}
            <path d="M0,120 L0,70 Q30,40 60,70 T120,70 T180,70 T240,70 T300,70 T360,70 T420,70 T480,70 T540,70 T600,70 T660,70 T720,70 T780,70 T840,70 T900,70 T960,70 T1020,70 T1080,70 T1140,70 T1200,70 L1200,120 Z" fill="#0e0918" opacity="0.4"></path>
            {/* Foreground exactly 8 waves */}
            <path d="M0,120 L0,80 Q37.5,30 75,80 T150,80 T225,80 T300,80 T375,80 T450,80 T525,80 T600,80 T675,80 T750,80 T825,80 T900,80 T975,80 T1050,80 T1125,80 T1200,80 L1200,120 Z" fill="#0e0918"></path>
          </svg>
        </div>
      </section>

      {/* Footer Section */}
      <footer id="contact" className="relative bg-[#0e0918] text-white pt-8 pb-10 sm:pt-12 sm:pb-14 px-6 lg:px-16 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12 lg:space-y-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 items-start justify-between font-sans">
            {/* Column 1: Brand & Social */}
            <div className="space-y-6">
              <h4 className="text-xl sm:text-2xl text-slate-200 font-bold tracking-tight">
                ClearMind Psychological Services
              </h4>
              <div className="flex items-center gap-4 pt-2">
                <a
                  href="https://www.facebook.com/cmps.cabuyao"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook: ClearMind Psychological Services"
                  className="inline-flex h-12 w-12 items-center justify-center text-slate-400 hover:text-purple-300 transition-colors"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/clearmindpsychservices"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram: ClearMind Psychological Services"
                  className="inline-flex h-12 w-12 items-center justify-center text-slate-400 hover:text-purple-300 transition-colors"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://seriousmd.com/doc/jinky-malabanan"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="SeriousMD Profile"
                  className="inline-flex items-center opacity-85 hover:opacity-100 transition-opacity bg-white/90 px-2 py-0.5 rounded shadow-sm"
                >
                  <img
                    src="https://seriousmd.com/img/SeriousMD_logo-dark.png"
                    alt="SeriousMD"
                    className="h-4 sm:h-4.5 w-auto object-contain"
                  />
                </a>
              </div>
            </div>

            {/* Column 2: Cabuyao */}
            <div className="space-y-3">
              <h5 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{L('contact', 'cabuyao_name', 'Cabuyao')}</h5>
              <p className="text-slate-400 text-xs sm:text-sm font-light leading-relaxed max-w-sm">
                {L('contact', 'cabuyao_address', 'Block 1 Lot 7, Palmsville Subdivision, Brgy. Banlic, City of Cabuyao, Laguna 4025')}
              </p>
              <div className="space-y-1 text-slate-400 text-xs sm:text-sm font-light pt-2">
                <div>
                  <a href={`mailto:${L('contact', 'cabuyao_email', 'cabuyaoadmin@clearmindpsychservices.com')}`} className="hover:text-purple-300 transition-colors">
                    {L('contact', 'cabuyao_email', 'cabuyaoadmin@clearmindpsychservices.com')}
                  </a>
                </div>
                <div>
                  <span className="font-light">{L('contact', 'cabuyao_phone', '0992-916-4078 / (049)-548-0168')}</span>
                </div>
              </div>
            </div>

            {/* Column 3: Alabang */}
            <div className="space-y-3">
              <h5 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{L('contact', 'alabang_name', 'Alabang')}</h5>
              <p className="text-slate-400 text-xs sm:text-sm font-light leading-relaxed max-w-sm">
                {L('contact', 'alabang_address', 'Unit 4-M, Westgate Tower, Madrigal Business Park, 1709 Investment Dr, Barangay Ayala Alabang, Muntinlupa City, Philippines, 1780')}
              </p>
              <div className="space-y-1 text-slate-400 text-xs sm:text-sm font-light pt-2">
                <div>
                  <a href={`mailto:${L('contact', 'alabang_email', 'alabangadmin@clearmindpsychservices.com')}`} className="hover:text-purple-300 transition-colors">
                    {L('contact', 'alabang_email', 'alabangadmin@clearmindpsychservices.com')}
                  </a>
                </div>
                <div>
                  <span className="font-light">{L('contact', 'alabang_phone', '(+639)70-885-8948')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bottom Mark */}
          <div className="pt-6 border-t border-white/10 text-center space-y-3">
            <div className="font-['Against'] text-[8vw] text-purple-300/12 leading-none select-none tracking-tighter">
              ClearMind
            </div>
            <p className="font-sans text-[11px] text-slate-500 font-light">
              {L('footer', 'copyright', '© 2026 ClearMind Psychological Services. All rights reserved.')}
            </p>
          </div>
        </div>
      </footer>

      {/* Announcement Modal */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#120c1d]/60 backdrop-blur-sm p-4 animate-[cymonModalFade_0.2s_ease-out]"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-transparent dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {(selectedAnnouncement.images?.length ? selectedAnnouncement.images : (selectedAnnouncement.imageUrl ? [selectedAnnouncement.imageUrl] : [])).length ? (
              <div className="w-full h-56 sm:h-64 bg-slate-100 shrink-0 overflow-hidden">
                <ImageSlideshow
                  images={selectedAnnouncement.images?.length ? selectedAnnouncement.images : [selectedAnnouncement.imageUrl]}
                  alt={selectedAnnouncement.title}
                  className="h-full w-full"
                  imgClassName="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-32 sm:h-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500 via-indigo-600 to-purple-900 shrink-0 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <svg className="h-8 w-8 text-purple-300/60 mb-2 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
                </svg>
                <span className="font-sans text-lg sm:text-xl font-extrabold relative z-10 tracking-tight">Notice & Announcement</span>
              </div>
            )}
            <div className="p-5 sm:p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${typeToBadge(selectedAnnouncement.category).cls}`}>
                  {selectedAnnouncement.category}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-500 font-mono tracking-wide">
                  {selectedAnnouncement.date}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-4 leading-tight">{selectedAnnouncement.title}</h2>
              <div className="text-sm sm:text-base text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">
                {selectedAnnouncement.body}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50 dark:bg-slate-900/50">
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Landing
