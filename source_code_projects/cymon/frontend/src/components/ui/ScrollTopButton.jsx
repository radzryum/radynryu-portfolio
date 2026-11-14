import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp } from 'lucide-react'

// Floating back-to-top button for long clinical forms (IEP, monthly/daily
// reports, behavioral report, standardized assessments). Render once at the
// end of the form: it fades in after scrolling down, and one click
// smooth-scrolls the window plus every scrolled panel (page main, modal,
// embedded review workspace) back to the top — no scrollbar dragging.
function ScrollTopButton({ threshold = 600, label = 'Back to top' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = (event) => {
      const target = event.target === document ? document.documentElement : event.target
      const y = (target && typeof target.scrollTop === 'number' ? target.scrollTop : 0)
        || window.scrollY
        || 0
      setVisible(y > threshold)
    }
    // Capture phase: workspace mains and modals scroll instead of the window.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    onScroll({ target: document })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [threshold])

  const scrollToTop = () => {
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const behavior = smooth ? 'smooth' : 'auto'
    // Every scrolled panel, not just the window: each workspace main, modal,
    // and embedded review list owns its own scroll position.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let node = walker.currentNode
    while (node) {
      if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight + 8) {
        node.scrollTo({ top: 0, behavior })
      }
      node = walker.nextNode()
    }
    window.scrollTo({ top: 0, behavior })
  }

  return createPortal(
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={label}
      title={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-purple-700 text-white shadow-lg shadow-purple-900/30 transition-all duration-200 hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 active:scale-95 print:hidden ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
    </button>,
    document.body,
  )
}

export default ScrollTopButton
