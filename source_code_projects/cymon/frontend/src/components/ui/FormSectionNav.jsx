import { useEffect, useRef, useState } from 'react'

// Sticky left-rail navigator for long fullscreen forms. Renders jump links
// for `sections` ({ id, label }) and highlights the section currently in
// view. Clicking a link smooth-scrolls it to the top of its scroll container.
// The list follows along on its own: whenever another section becomes active
// (e.g. from scrolling the form), the list scrolls just enough to reveal it,
// so the active item is never stuck out of view.

// Offset from the top of the scroll container where a section counts as
// "active". Must clear the sticky action bar + padding above the content.
const ACTIVE_OFFSET = 88

// Walk up from `el` to the nearest scrollable ancestor. Covers both shells:
// FormShell (`#form-portal .cmps-print-document`) and AnswerAssessment
// (`#assessment-answer-shell .assessment-print-content`).
function findScroller(el) {
  let node = el?.parentElement || null
  while (node) {
    const style = window.getComputedStyle(node)
    const scrollable = style.overflowY === 'auto' || style.overflowY === 'scroll'
    if (scrollable && node.scrollHeight > node.clientHeight + 4) return node
    node = node.parentElement
  }
  return (
    document.querySelector('#assessment-answer-shell .assessment-print-content') ||
    document.querySelector('#form-portal .cmps-print-document') ||
    document.querySelector('.cmps-print-document') ||
    null
  )
}

function FormSectionNav({ sections = [] }) {
  const idsKey = sections.map((s) => s.id).join('|')
  const [activeId, setActiveId] = useState(sections[0]?.id || null)
  const listRef = useRef(null)
  // While a jump scroll is in flight, ignore scroll events so intermediate
  // sections don't steal `activeId` mid-flight (that flicker + the nav's own
  // follow-scroll fighting the jump is what forced a second click).
  const jumpingRef = useRef(false)
  const jumpTimerRef = useRef(null)

  useEffect(() => () => {
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
  }, [])

  // Track the active section from the REAL scroll container, not the
  // viewport. The old IntersectionObserver used the viewport as root while
  // the form scrolls inside a nested container, so highlights lagged or
  // pointed at the wrong section.
  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean)
    if (ids.length === 0) return undefined
    const probe = document.getElementById(ids[0])
    const scroller = probe ? findScroller(probe) : null
    if (!scroller) return undefined

    let raf = 0
    const update = () => {
      raf = 0
      if (jumpingRef.current) return
      const scrollerTop = scroller.getBoundingClientRect().top
      let current = ids[0]
      ids.forEach((id) => {
        const el = document.getElementById(id)
        if (!el) return
        if (el.getBoundingClientRect().top - scrollerTop <= ACTIVE_OFFSET) current = id
      })
      setActiveId((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [idsKey])

  // Keep the active link visible by scrolling the nav list itself only.
  // Never use scrollIntoView here: it scrolls EVERY scrollable ancestor,
  // including the form, which cancels the jump scroll and forced double-click.
  // Skipped on mobile, where the nav stacks in the normal page flow
  // and auto-scrolling would fight the user's own scroll.
  useEffect(() => {
    if (!activeId) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    const list = listRef.current
    const item = list?.querySelector(`[data-nav-id="${activeId}"]`)
    if (!list || !item) return
    const itemTop = item.offsetTop - (list.offsetTop || 0)
    const visibleTop = list.scrollTop
    const visibleBottom = visibleTop + list.clientHeight - item.offsetHeight
    if (itemTop < visibleTop || itemTop > visibleBottom) {
      list.scrollTo({ top: Math.max(0, itemTop - list.clientHeight / 2 + item.offsetHeight / 2), behavior: 'smooth' })
    }
  }, [activeId])

  if (sections.length === 0) return null

  const jump = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    setActiveId(id)
    const scroller = findScroller(el)
    if (scroller && scroller.contains(el)) {
      jumpingRef.current = true
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (ACTIVE_OFFSET - 16)
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
      // Release the lock once the smooth scroll settles so manual scrolling
      // resumes highlighting. One click is enough — no second click needed.
      jumpTimerRef.current = setTimeout(() => {
        jumpingRef.current = false
      }, 700)
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav
      aria-label="Form sections"
      className="rounded-3xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-colors"
    >
      <div className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Sections
      </div>
      <ul ref={listRef} className="space-y-1">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => jump(section.id)}
                data-nav-id={section.id}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  active
                    ? 'bg-purple-100 dark:bg-purple-900/40 font-bold text-purple-900 dark:text-purple-100'
                    : 'font-medium text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800 hover:text-purple-800 dark:hover:text-purple-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="min-w-0 truncate">{section.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default FormSectionNav
