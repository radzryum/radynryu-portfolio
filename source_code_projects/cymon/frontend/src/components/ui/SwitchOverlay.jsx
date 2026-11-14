import { useEffect } from 'react'

// Modal-style switch feedback shared by role switching (StaffLayout) and
// branch switching (BranchSwitcher). Two beats so users SEE the change:
//   switching → "Switching to…" with a spinning ring + sliding bar
//   arrived   → "Now you are in…" with a popping check + Continue button
// Clicking anywhere dismisses early; `onDismiss` must clear the state.
function SwitchOverlay({
  phase = 'switching',
  switchingLabel = 'Switching to',
  arrivedLabel = 'Now you are in',
  title = '',
  subtitle = '',
  glyph = null,
  // How long the "Now you are in" beat stays before auto-dismiss (ms).
  // Drives the countdown bar so users SEE how long it lasts.
  arrivedMs = 4000,
  onDismiss = null,
}) {
  const arrived = phase === 'arrived'

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && onDismiss) onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className="cymon-switch-backdrop"
      role={arrived ? 'status' : 'alert'}
      aria-live="polite"
      aria-label={arrived ? `${arrivedLabel} ${title}` : `${switchingLabel} ${title}`}
      onClick={onDismiss || undefined}
    >
      <div
        className="cymon-switch-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cymon-switch-shine" aria-hidden="true" />
        <div className={`cymon-switch-kicker ${arrived ? 'cymon-switch-kicker-arrived' : ''}`}>
          {arrived ? arrivedLabel : switchingLabel}
        </div>

        <div className="cymon-switch-medallion" aria-hidden="true">
          {!arrived ? <span className="cymon-switch-ring" /> : null}
          <span className="cymon-switch-glyph">{glyph}</span>
          {arrived ? (
            <span className="cymon-switch-check">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4.5 12.5l5 5 10-10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cymon-switch-check-path"
                />
              </svg>
            </span>
          ) : null}
        </div>

        <div className="cymon-switch-title">{title}</div>
        {!arrived ? (
          <>
            <div className="cymon-switch-bar" aria-hidden="true">
              <span className="cymon-switch-bar-fill" />
            </div>
            <div className="cymon-switch-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        ) : null}
        {subtitle ? <div className="cymon-switch-sub">{subtitle}</div> : null}
        {arrived && onDismiss ? (
          <>
            <div className="cymon-switch-countdown" aria-hidden="true">
              <span key={title} style={{ animationDuration: `${arrivedMs}ms` }} />
            </div>
            <button type="button" onClick={onDismiss} className="cymon-switch-continue">
              Continue
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default SwitchOverlay
