import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Generic centered Yes/No confirmation for important actions
// (submit, send, post, publish, approve, pay, logout, ...).
// Keep destructive deletes on DeleteModal; use this for everything else.
const TONES = {
  purple: 'bg-purple-700 hover:bg-purple-800',
  red: 'bg-red-600 hover:bg-red-700',
  green: 'bg-emerald-600 hover:bg-emerald-700',
}

function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  tone = 'purple',
  busy = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portaled to <body> so no ancestor (slide-in animations, transformed
  // containers) can trap the `fixed` backdrop — it must dim the whole page
  // and center on the viewport, not inside the content panel.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-modal-fade"
        onClick={() => {
          if (!busy) onClose?.()
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl animate-modal-zoom text-center">
        <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</div>
        {message ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{message}</p>
        ) : null}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={busy}
            className="w-full cursor-pointer rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-center text-sm font-bold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.()}
            disabled={busy}
            className={`w-full cursor-pointer rounded-xl py-2.5 text-center text-sm font-bold text-white transition-colors disabled:opacity-60 ${TONES[tone] || TONES.purple}`}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
