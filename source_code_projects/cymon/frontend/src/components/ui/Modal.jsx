import React, { useEffect, useRef, useState } from 'react'

// Floating dialog: dim backdrop with a centered card whose frame stays fixed on
// screen (capped height) while only the body scrolls. Header and optional footer
// stay pinned. Pass action buttons via `footer` so they don't scroll with content.
function Modal({ title, subtitle, onClose, children, footer, maxWidth = 'max-w-2xl', scrollable = true }) {
  const [closing, setClosing] = useState(false)
  const closeRef = useRef(null)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 300)
  }

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      // Above the onboarding tour overlay (z-80): an active dialog must stay
      // clickable even if the help tour is open behind it. Otherwise the tour
      // backdrop swallows every click and the modal looks frozen.
      className={`fixed inset-0 z-[90] flex items-center justify-center bg-purple-950/50 p-4 sm:p-8 ${closing ? 'pointer-events-none' : ''}`}
      style={{ animation: closing ? 'modal-backdrop-out 0.3s ease-in forwards' : 'modal-backdrop 0.3s ease-out' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Dialog'}
    >
      <style>{`
        @keyframes modal-backdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modal-content { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modal-content-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(16px); } }
      `}</style>
      <div
        className={`relative flex max-h-[calc(100vh-4rem)] w-full ${maxWidth} flex-col rounded-2xl border border-purple-200 bg-white shadow-[0_30px_80px_-20px_rgba(88,28,135,0.45)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none`}
        style={{ animation: closing ? 'modal-content-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'modal-content 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-purple-800 dark:text-purple-200">{title}</div>
            {subtitle ? <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all duration-200 active:scale-[0.9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className={`min-h-0 p-6 ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}>{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
            {/* Clone the footer element to inject handleClose into Cancel buttons if they use onClose */}
            {React.isValidElement(footer) ? React.cloneElement(footer, { onClose: handleClose }) : footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Modal
