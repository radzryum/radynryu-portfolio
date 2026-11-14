import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveBlob } from '../../lib/api'

// Mobile browsers (notably iOS Safari) refuse to render PDFs inside iframes,
// showing a download fallback instead. Detect those and render pages as
// images with pdf.js so the preview stays viewable without downloading.
function useMobilePdfViewer() {
  const [isMobile] = useState(() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
    return (
      window.matchMedia?.('(pointer: coarse)').matches &&
      Math.min(window.screen.width, window.screen.height) < 820
    )
  })
  return isMobile
}

function MobilePdfViewer({ blob }) {
  const [pages, setPages] = useState([])
  const [rendering, setRendering] = useState(true)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    let cancelled = false
    let pdfDoc = null
    ;(async () => {
      try {
        // Loaded on demand so desktop bundles never pay for pdf.js.
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        const buf = await blob.arrayBuffer()
        pdfDoc = await pdfjs.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) return
          const page = await pdfDoc.getPage(i)
          // Scale 1.5 stays sharp on phones at ~44% fewer pixels than 2x,
          // which is what pushed multi-page previews past 10s on mobile.
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
          if (cancelled) return
          setPages((current) => [...current, canvas.toDataURL('image/png')])
        }
      } catch (err) {
        if (!cancelled) setRenderError(err.message || 'Unable to render the PDF.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => {
      cancelled = true
      pdfDoc?.destroy?.()
    }
  }, [blob])

  if (renderError) {
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-xl border border-rose-200 bg-white p-5 text-sm text-rose-700 shadow-lg">
        {renderError}
      </div>
    )
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-4">
        {pages.map((src, idx) => (
          <figure key={idx} className="overflow-hidden rounded-md bg-white shadow-2xl">
            <img src={src} alt={`Page ${idx + 1}`} className="w-full" />
            <figcaption className="border-t border-slate-100 px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">
              Page {idx + 1} of {rendering ? '…' : pages.length}
            </figcaption>
          </figure>
        ))}
        {rendering ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-purple-200">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-200/40 border-t-purple-200 inline-block" />
            Rendering pages…
          </div>
        ) : null}
      </div>
    </div>
  )
}

function OfficialPdfPreview({
  title = 'Official PDF Preview',
  filename = 'official-form.pdf',
  loadPdf,
  loadCtcPdf, // optional — admin-only: loads a CTC (watermark-free) version
  onClose,
}) {
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [ctcLoading, setCtcLoading] = useState(false)
  const isMobilePdf = useMobilePdfViewer()

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10)
    return () => clearTimeout(t)
  }, [])

  const handleClose = () => {
    setShow(false)
    setTimeout(() => onClose?.(), 300)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    setBlob(null)
    loadPdf()
      .then((nextBlob) => {
        if (mounted) setBlob(nextBlob)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || 'Unable to load the official PDF.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [loadPdf])

  useEffect(() => {
    if (!blob) {
      setUrl('')
      return undefined
    }
    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [blob])

  const handleDownloadCtc = async () => {
    if (!loadCtcPdf || ctcLoading) return
    setCtcLoading(true)
    try {
      const ctcBlob = await loadCtcPdf()
      const ctcFilename = filename.replace('.pdf', '-CTC.pdf')
      saveBlob(ctcBlob, ctcFilename)
    } catch (err) {
      alert(err.message || 'Failed to generate Certified True Copy.')
    } finally {
      setCtcLoading(false)
    }
  }

  const preview = (
    <div className={`fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm transition-all duration-300 ease-out ${show ? 'opacity-100' : 'opacity-0'}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-lg transition-transform duration-500 delay-100 ease-out ${show ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-slate-400">Preview generated from the saved database record</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 flex-wrap">
          {loadCtcPdf && (
            <button
              type="button"
              disabled={!blob || ctcLoading}
              onClick={handleDownloadCtc}
              title="Download a clean, official copy for submission. Admin-only."
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
            >
              {ctcLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white inline-block" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              Download Certified True Copy
            </button>
          )}
          <button
            type="button"
            disabled={!blob}
            onClick={() => saveBlob(blob, filename)}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
      <div className={`min-h-0 flex-1 bg-slate-800/50 p-3 sm:p-6 transition-all duration-500 delay-150 ease-out transform ${show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'}`}>
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-10">
            <div className="book">
              <div className="book__pg-shadow"></div>
              <div className="book__pg"></div>
              <div className="book__pg book__pg--2"></div>
              <div className="book__pg book__pg--3"></div>
              <div className="book__pg book__pg--4"></div>
              <div className="book__pg book__pg--5"></div>
            </div>
            <div className="animate-pulse text-sm font-semibold tracking-wide text-purple-300 drop-shadow-md">
              PREVIEWING IN PDF MIGHT TAKE TIME GENERATING...
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-rose-200 bg-white p-5 text-sm text-rose-700 shadow-lg">
            {error}
          </div>
        ) : isMobilePdf && blob ? (
          <MobilePdfViewer blob={blob} />
        ) : url ? (
          <iframe
            title={title}
            src={url}
            className="h-full w-full rounded-md bg-white shadow-2xl"
          />
        ) : null}
      </div>
    </div>
  )

  return createPortal(preview, document.body)
}

export default OfficialPdfPreview
