import { useEffect, useRef, useState } from 'react'
import Button from './Button'

function DrawCanvas({ value, onChange, disabled }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })
  const hasPendingDrawingRef = useRef(false)
  const [hasPendingDrawing, setHasPendingDrawing] = useState(false)

  // Size the backing store to the live CSS box (times devicePixelRatio) so
  // pointer coordinates always map 1:1 to ink. The canvas is responsive
  // (w-full inside animating layouts), so a one-time measure on mount drifts
  // out of sync — the browser then stretches a stale bitmap and strokes land
  // offset from the cursor. Returns true when the store actually changed.
  const fitCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return false
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * ratio))
    const h = Math.max(1, Math.round(rect.height * ratio))
    if (canvas.width === w && canvas.height === h) return false
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    // Website ink is purple-600: visible on the always-white paper in both
    // themes. The official PDF recolors to black separately (backend signatureInk).
    ctx.strokeStyle = '#9333ea'
    return true
  }

  const drawSavedImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const cw = Math.max(1, rect.width)
    const ch = Math.max(1, rect.height)
    if (!value) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      return
    }
    const img = new Image()
    img.onload = () => {
      const live = canvasRef.current
      if (!live) return
      const liveCtx = live.getContext('2d')
      const liveRect = live.getBoundingClientRect()
      const lw = Math.max(1, liveRect.width)
      const lh = Math.max(1, liveRect.height)
      liveCtx.save()
      liveCtx.setTransform(1, 0, 0, 1, 0, 0)
      liveCtx.clearRect(0, 0, live.width, live.height)
      liveCtx.restore()
      const scale = Math.min(lw / img.width, lh / img.height)
      const drawW = img.width * scale
      const drawH = img.height * scale
      const dx = (lw - drawW) / 2
      const dy = (lh - drawH) / 2
      liveCtx.drawImage(img, dx, dy, drawW, drawH)
    }
    img.src = value
  }

  useEffect(() => {
    fitCanvas()
    drawSavedImage()
    // Re-fit whenever the CSS box changes (window resize, zoom, layout
    // animations like the fullscreen slide). Redrawing the saved image keeps
    // it crisp; only un-saved mid-stroke ink is dropped on a resize.
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      let tempInk = null
      if (hasPendingDrawingRef.current) {
        tempInk = canvas.toDataURL('image/png')
      }
      
      if (fitCanvas()) {
        if (tempInk) {
          const img = new Image()
          img.onload = () => {
            const live = canvasRef.current
            if (!live) return
            const ctx = live.getContext('2d')
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.drawImage(img, 0, 0, live.width, live.height)
            ctx.restore()
          }
          img.src = tempInk
        } else {
          drawSavedImage()
        }
      }
    })
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [value])

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e) => {
    if (disabled) return
    e.preventDefault()
    // Capture the pointer so the stroke keeps tracking even if it moves fast
    // or leaves the pad mid-stroke (stylus/mouse), instead of cutting off.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Older browsers: fall back to pointerleave ending the stroke.
    }
    drawingRef.current = true
    hasPendingDrawingRef.current = true
    setHasPendingDrawing(true)
    lastRef.current = pos(e)
  }

  const move = (e) => {
    if (!drawingRef.current) return
    const p = pos(e)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    // Re-assert the transform every segment: if a resize/zoom slipped past
    // the observer, ink still lands exactly under the cursor.
    const ratio = window.devicePixelRatio || 1
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    // Ink stays purple-600 in every theme (paper background is always white,
    // official PDF recolors to black separately). Never derive this from theme.
    ctx.strokeStyle = '#9333ea'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
  }

  const end = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
  }

  const save = () => {
    if (!hasPendingDrawingRef.current) return
    onChange?.(canvasRef.current.toDataURL('image/png'))
    hasPendingDrawingRef.current = false
    setHasPendingDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasPendingDrawingRef.current = false
    setHasPendingDrawing(false)
    onChange?.(null)
  }

  return (
    <div>
      {/* Paper stays white in every theme so the near-black ink is always visible. */}
      <div className="overflow-hidden rounded-2xl border-2 border-purple-100 bg-white shadow-inner transition-colors focus-within:border-purple-300">
        <canvas
          ref={canvasRef}
          className={`block h-40 w-full touch-none select-none ${value ? 'pointer-events-none' : 'cursor-crosshair'}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-400 dark:text-slate-500">Sign using mouse, stylus, or touch.</span>
        {!disabled ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-4 py-2 font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Clear
            </button>
            {!value && (
              <button
                type="button"
                onClick={save}
                disabled={!hasPendingDrawing}
                className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-white shadow-sm transition-all hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              >
                Save Signature
              </button>
            )}
          </div>
        ) : null}
      </div>
      {value ? <input type="hidden" value={value} readOnly /> : null}
    </div>
  )
}

function UploadSignature({ value, onChange, disabled }) {
  const inputRef = useRef(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processSignatureImage = (dataUrl) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data

        // Step 1: Scan for min and max luminance to dynamically adapt to paper/lighting
        let minL = 255
        let maxL = 0
        const lums = new Float32Array(data.length / 4)
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          if (data[i + 3] === 0) continue
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          lums[j] = lum
          if (lum < minL) minL = lum
          if (lum > maxL) maxL = lum
        }

        // Safety margin for extremely flat images
        if (maxL - minL < 30) {
          minL = Math.max(0, minL - 30)
          maxL = Math.min(255, maxL + 30)
        }

        const range = maxL - minL
        // Everything above 50% brightness range is erased as background
        const paperLum = minL + range * 0.50
        // Everything below 20% brightness range is solid ink
        const inkLum = minL + range * 0.20

        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          if (data[i + 3] === 0) continue

          const lum = lums[j]

          if (lum > paperLum) {
            data[i + 3] = 0 // Transparent background
          } else {
            // Website ink is purple-600 (#9333ea); the official PDF recolors to black.
            data[i] = 147
            data[i + 1] = 51
            data[i + 2] = 234

            if (lum < inkLum) {
              data[i + 3] = 255 // Solid ink
            } else {
              // Anti-aliased edges for smoothness
              data[i + 3] = Math.round(255 * (paperLum - lum) / (paperLum - inkLum))
            }
          }
        }
        ctx.putImageData(imgData, 0, 0)
        onChange?.(canvas.toDataURL('image/png'))
      } catch (e) {
        // Fallback for canvas errors
        onChange?.(dataUrl)
      }
      setIsProcessing(false)
    }
    img.onerror = () => {
      onChange?.(dataUrl)
      setIsProcessing(false)
    }
    img.src = dataUrl
  }

  const handleFile = (file) => {
    if (!file) return
    setIsProcessing(true)
    const reader = new FileReader()
    reader.onload = () => processSignatureImage(reader.result)
    reader.onerror = () => setIsProcessing(false)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      {value ? (
        <div className="overflow-hidden rounded-2xl border-2 border-purple-100 bg-white p-4 shadow-sm">
          <img src={value} alt="Uploaded signature" className="mx-auto max-h-32 object-contain" />
        </div>
      ) : isProcessing ? (
        <div className="flex h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-purple-200 bg-purple-50 text-purple-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-purple-300">
          <svg className="h-8 w-8 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-bold animate-pulse">Enhancing signature...</span>
        </div>
      ) : disabled ? (
        <div className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <span className="text-sm font-medium italic">No signature image submitted</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group flex h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 text-purple-700 transition-all hover:border-purple-400 hover:bg-purple-50 hover:shadow-sm dark:border-purple-800/60 dark:bg-slate-800/60 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:bg-slate-800"
        >
          <div className="rounded-full bg-white p-3 shadow-sm transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
              <path
                d="M12 16V4M6 10l6-6 6 6M4 20h16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold">Click to upload signature</div>
            <div className="text-xs font-medium text-purple-500/70 dark:text-purple-400/70">Auto-enhances & removes background</div>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value && !disabled ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange?.(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// Anti-forgery concealment for saved signature ink.
//
// - `sealed` (record sent/published/approved): the ink is NEVER rendered.
//   Only a "Signed · date" indicator shows. The complete ink stays visible
//   solely on the admin-generated official PDF.
// - unsealed with a saved value: a brief "saving" flash, then a
//   "Signature saved successfully" indicator with an opt-in Preview (so the
//   signer can still double-check before sending) and Replace when editable.
// - no value: the pad as before.
function SealedSignature({ signedAt }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Signature on file</div>
        <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
          {signedAt ? `Signed ${signedAt}` : 'Signed and recorded'}
        </div>
      </div>
    </div>
  )
}

function SignaturePad({ label = 'E-Signature', value, onChange, className = '', disabled = false, sealed = false, signedAt = '' }) {
  const [mode, setMode] = useState('draw')
  const [revealed, setRevealed] = useState(false)
  const [savingFlash, setSavingFlash] = useState(false)
  const prevValueRef = useRef(value)

  const setValue = (next) => onChange?.(next)

  const switchMode = (next) => {
    if (next === mode) return
    setMode(next)
    setValue(null)
  }

  // Brief "saving" shimmer right after ink is saved, then the saved indicator.
  useEffect(() => {
    if (!prevValueRef.current && value && !sealed) {
      setSavingFlash(true)
      setRevealed(false)
      const timer = setTimeout(() => setSavingFlash(false), 1400)
      prevValueRef.current = value
      return () => clearTimeout(timer)
    }
    prevValueRef.current = value
    return undefined
  }, [value, sealed])

  // A sealed record never renders ink, even while previewing was open.
  useEffect(() => {
    if (sealed) setRevealed(false)
  }, [sealed])

  if (sealed && value) {
    return (
      <div className={className}>
        {label ? (
          <div className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-200">{label}</div>
        ) : null}
        <SealedSignature signedAt={signedAt} />
        {!disabled ? (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setValue(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Replace signature
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (value && !revealed) {
    return (
      <div className={className}>
        {label ? (
          <div className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-200">{label}</div>
        ) : null}
        {savingFlash ? (
          <div className="flex items-center gap-3 rounded-2xl border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 px-4 py-3.5">
            <svg className="h-6 w-6 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-bold text-purple-700 dark:text-purple-300 animate-pulse">Saving signature…</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 basis-40 text-sm font-bold text-emerald-800 dark:text-emerald-200">
              Signature saved successfully{signedAt ? ` · ${signedAt}` : ''}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                Preview
              </button>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => setValue(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  Replace
                </button>
              ) : null}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-200">{label}</div>
      ) : null}
      {!disabled && (
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold shadow-inner dark:bg-slate-800">
          {[
            { id: 'draw', label: 'Draw' },
            { id: 'upload', label: 'Upload' },
          ].map((t) => {
            const active = mode === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchMode(t.id)}
                className={[
                  'rounded-lg px-5 py-2 transition-all duration-200',
                  active ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-900 dark:text-purple-300 dark:ring-slate-600' : 'text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400',
                ].join(' ')}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      )}
      <div className={disabled ? "mt-0" : "mt-3"}>
        {mode === 'draw' ? (
          <DrawCanvas value={value} onChange={setValue} disabled={disabled} />
        ) : (
          <UploadSignature value={value} onChange={setValue} disabled={disabled} />
        )}
      </div>
      {value && revealed ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Hide preview
          </button>
        </div>
      ) : null}
    </div>
  )
}

// Read-only saved-ink display for cards and sign-off boxes. The ink is never
// shown outright: sealed records get an indicator only, unsealed ones an
// indicator with an opt-in Preview (plus Replace when the parent allows it).
function SavedSignature({ image, alt = 'Signature', sealed = false, signedAt = '', onReplace = null }) {
  const [revealed, setRevealed] = useState(false)
  if (!image) return null
  if (sealed) {
    return <SealedSignature signedAt={signedAt} />
  }
  if (!revealed) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 basis-32 text-xs font-bold text-emerald-800 dark:text-emerald-200">
          Signature saved{signedAt ? ` · ${signedAt}` : ''}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          >
            Preview
          </button>
          {onReplace ? (
            <button
              type="button"
              onClick={onReplace}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Replace
            </button>
          ) : null}
        </span>
      </div>
    )
  }
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-dashed border-purple-200 bg-white p-2">
        <img src={image} alt={alt} className="max-h-24 w-full bg-white object-contain" />
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          Hide preview
        </button>
      </div>
    </div>
  )
}

export { SealedSignature, SavedSignature }
export default SignaturePad
