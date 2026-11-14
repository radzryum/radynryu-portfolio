import { createPortal } from 'react-dom'

// Fullscreen photo viewer overlay (student avatars, license photos, ...).
// Rendered only when `src` is set; closes on backdrop click or the X button.
// Portaled to document.body so no ancestor transform/filter/overflow can trap
// the backdrop or paint content above it.
function AvatarViewer({ src, alt = 'Photo', onClose }) {
  if (!src) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-4 ring-white/10"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="absolute -right-4 -top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-slate-900 shadow-xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  )
}

export default AvatarViewer
