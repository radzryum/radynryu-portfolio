import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Screen shell for the interactive forms. Official PDF downloads are generated
// server-side from the saved database record, not from this React markup.
// that uses the official bordered CMPS form template as its print background.
// full-bleed background — the dual-office header, purple wave art, and footer
// tagline all come from that asset — with the form's code, title, and body laid
// into the white writing area. The SAME markup prints; the print stylesheet
// hides the app and toolbar and forces exact colors so the letterhead renders
// into the PDF. Clicking the gray canvas (or Esc / Close) dismisses it.
function FormShell({
  title,
  subtitle,
  code,
  onClose,
  onPreviewPdf,
  actions,
  hideActions = false,
  multiPage = false,
  orientation = 'portrait',
  inline = false,
  scrollable = true,
  wide = false,
  children,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Automatically expand textareas on print, and restore original height on finish
  useEffect(() => {
    let savedHeights = []
    const handleBeforePrint = () => {
      savedHeights = []
      document.querySelectorAll('textarea').forEach((ta) => {
        savedHeights.push({ el: ta, height: ta.style.height })
        ta.style.height = 'auto'
        ta.style.height = `${ta.scrollHeight + 4}px`
      })
    }
    const handleAfterPrint = () => {
      savedHeights.forEach(({ el, height }) => {
        if (el) el.style.height = height
      })
      savedHeights = []
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  const pages = multiPage
    ? Array.isArray(children)
      ? children.filter(Boolean)
      : [children]
    : null

  const defaultActions = !hideActions && !actions ? (
    <button
      type="button"
      onClick={onPreviewPdf}
      disabled={!onPreviewPdf}
      className={`cymon-preview-btn ${!onPreviewPdf ? 'disabled' : ''}`}
      style={!onPreviewPdf ? { width: '250px' } : {}}
      title={onPreviewPdf ? 'Preview Official PDF' : 'Save record to enable PDF preview'}
    >
      <span className="IconContainer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>
      </span>
      <span className="text whitespace-nowrap overflow-hidden text-ellipsis px-4">
        {onPreviewPdf ? 'Preview' : 'Save to preview PDF'}
      </span>
    </button>
  ) : null

  const renderShell = (
    <div
      id="form-portal"
      className={
        inline
          ? scrollable
            ? 'relative flex h-full min-h-0 w-full flex-col overflow-hidden font-sans print:static print:bg-white'
            : 'relative flex w-full flex-col overflow-visible font-sans print:static print:bg-white'
          : 'fixed inset-0 z-50 flex flex-col bg-slate-950/60 font-sans backdrop-blur-sm print:static print:bg-white'
      }
      data-orientation={orientation}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <style>{`
        @media screen {
          .form-article {
            position: relative;
            max-width: 900px;
            width: 100%;
            padding: 1.5rem;
            font-size: 14.5px !important;
            line-height: 1.6 !important;
          }
          @media (max-width: 639px) {
            .form-article {
              padding: 1rem 0.5rem;
            }
          }
          .form-article--wide {
            max-width: none;
          }
          .form-article-page-header {
            display: flex !important;
            justify-content: space-between;
            border-bottom: 2px solid #f3e8ff;
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
            font-size: 12px !important;
            font-weight: 600;
          }
        }

        @media print {
          #root { visibility: hidden !important; }
          #form-portal {
            position: static !important;
            visibility: visible !important;
            background: #fff !important;
          }
          #form-portal * { visibility: visible !important; }
          #form-portal .cmps-print-page {
            font-size: 11.5px !important;
            line-height: 1.35 !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div
        className={[
          'cmps-print-document flex flex-col items-center print:block print:overflow-visible print:bg-white print:p-0',
          orientation === 'landscape' ? 'cmps-print-document--landscape' : '',
          scrollable ? 'flex-1 min-h-0 overflow-y-auto' : 'overflow-visible',
          hideActions ? 'pb-0' : 'pb-2',
        ].join(' ')}
      >
        <div className={`w-full ${wide ? 'max-w-none' : 'max-w-[900px]'} flex flex-col gap-6 print:block print:max-w-none print:gap-0`}>
          {multiPage ? (
            pages.map((pageContent, idx) => {
              const isFirst = idx === 0
              return (
                <article key={idx} className={`form-article cmps-print-page print-page-break text-[#1e1b4b] dark:text-slate-200 transition-colors ${wide ? 'form-article--wide' : ''}`}>
                  {isFirst ? (
                    <>
                      {code ? <div className="text-right text-[10px] font-bold text-purple-700 print:block hidden">{code}</div> : null}
                      <div className="mt-2">{pageContent}</div>
                    </>
                  ) : (
                    <>
                      <div className="form-article-page-header text-purple-600 dark:text-purple-400 border-purple-100 dark:border-slate-700 transition-colors">
                        <span>{title} {subtitle ? ` - ${subtitle}` : ''}</span>
                        <span>Page {idx + 1}</span>
                      </div>
                      <div className="mt-2">{pageContent}</div>
                    </>
                  )}
                </article>
              )
            })
          ) : (
            <article className={`form-article cmps-print-page text-[#1e1b4b] dark:text-slate-200 transition-colors ${wide ? 'form-article--wide' : ''}`}>
              {code ? <div className="text-right text-[10px] font-bold text-purple-700 print:block hidden">{code}</div> : null}
              <div className="mt-2">{children}</div>
            </article>
          )}

        </div>
      </div>

      {(!hideActions && (actions || defaultActions)) ? (
        <div className="shrink-0 px-4 pb-4 pt-2 print:hidden sm:px-5">
          <div className={`mx-auto w-full ${wide ? 'max-w-none' : 'max-w-[900px]'} rounded-2xl border border-purple-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900`}>
            <div className={actions ? 'px-4 py-4 sm:px-5 sm:py-4' : 'flex justify-end px-4 py-4 sm:px-5 sm:py-4'}>
              {actions || defaultActions}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (inline) {
    return renderShell
  }

  return createPortal(renderShell, document.body)
}

export default FormShell
