import { useState } from 'react'
import { CheckCircle2, FileText, Loader2, RotateCcw, Save, Send } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'

function FormActionButtons({
  compact = false,
  previewOfficialPdf,
  previewingPdf = false,
  reviewerMode = false,
  reviewerBusy = false,
  reviewerSignature = null,
  onReviewerReturn,
  onReviewerApprove,
  canSubmit = false,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  submitLabel = 'Send to Psychologist',
  onSaveDraft,
  savingDraft = false,
  lastSaved = null,
}) {
  const buttonBase = compact
    ? 'group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'
    : 'group relative inline-flex min-w-40 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'
  // Psychologist review decisions (approve with signature / return for
  // revision) always pass through a centered confirmation first.
  const [pendingReview, setPendingReview] = useState(null)
  const confirmReview = () => {
    if (pendingReview === 'approve') onReviewerApprove?.()
    else if (pendingReview === 'return') onReviewerReturn?.()
    setPendingReview(null)
  }
  const iconClass = compact ? 'h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110' : 'h-4 w-4 transition-transform duration-300 group-hover:scale-110'
  const content = (Icon, label, shortLabel = null) =>
    <><Icon className={iconClass} aria-hidden="true" /><span className="relative z-10 whitespace-nowrap">{compact && shortLabel ? shortLabel : label}</span></>

  return (
    <>
      {lastSaved && !compact ? (
        <span className="text-[11px] text-slate-400 mr-auto dark:text-slate-500">
          âœ“ Saved {new Date(lastSaved).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      ) : null}
      {!compact ? (
        <button
          type="button"
          onClick={previewOfficialPdf}
          disabled={previewingPdf}
          className={`cymon-preview-btn ${previewingPdf ? 'disabled' : ''}`}
          title={previewingPdf ? 'Preparing preview...' : 'Preview Official PDF'}
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
          <span className="text">Preview</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={previewOfficialPdf}
          disabled={previewingPdf}
          title={previewingPdf ? 'Preparing preview...' : 'Preview Official PDF'}
          aria-label={previewingPdf ? 'Preparing preview...' : 'Preview Official PDF'}
          className={`${buttonBase} overflow-hidden border-0 bg-gradient-to-br from-purple-600 to-[#581c87] text-white shadow-lg shadow-purple-900/20 hover:shadow-xl hover:shadow-purple-900/40`}
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-1.5">
            {previewingPdf ? (
              <><Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" /><span className="relative z-10 whitespace-nowrap">Preparing...</span></>
            ) : (
              content(FileText, 'Preview Official PDF', 'Preview')
            )}
          </div>
        </button>
      )}

      {onSaveDraft && !reviewerMode && canSubmit ? (
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={savingDraft || submitting}
          title="Save Draft"
          aria-label="Save Draft"
          className={`${buttonBase} border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-slate-800`}
        >
          {content(Save, savingDraft ? 'Saving...' : 'Save Draft', savingDraft ? 'Saving...' : 'Save')}
        </button>
      ) : null}

      {reviewerMode ? (
        <>
          <button
            type="button"
            onClick={() => setPendingReview('return')}
            disabled={reviewerBusy}
            title="Return as Draft"
            aria-label="Return as Draft"
            className={`${buttonBase} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-800`}
          >
            {content(RotateCcw, reviewerBusy ? 'Saving...' : 'Return as Draft', reviewerBusy ? 'Saving...' : 'Return')}
          </button>
          <button
            type="button"
            onClick={() => setPendingReview('approve')}
            disabled={reviewerBusy || !reviewerSignature}
            title={reviewerSignature ? 'Approve and Sign' : 'Add Signature to Approve'}
            aria-label={reviewerSignature ? 'Approve and Sign' : 'Add Signature to Approve'}
            className={`${buttonBase} ${
              reviewerSignature
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-400 dark:border-emerald-900 dark:bg-slate-800 dark:text-emerald-600'
            }`}
          >
            {content(CheckCircle2, reviewerBusy ? 'Saving...' : reviewerSignature ? 'Approve & Sign' : 'Add Signature to Approve', reviewerBusy ? 'Saving...' : reviewerSignature ? 'Approve' : 'Sign first')}
          </button>
          {pendingReview ? (
            <ConfirmDialog
              title={pendingReview === 'approve' ? 'Approve & Sign?' : 'Return as Draft?'}
              message={pendingReview === 'approve'
                ? 'Are you sure you want to approve and sign this report? This will finalize the review.'
                : 'Are you sure you want to return this report to the psychometrician for revision?'}
              confirmLabel="Yes"
              cancelLabel="No"
              tone={pendingReview === 'approve' ? 'green' : 'red'}
              busy={reviewerBusy}
              onClose={() => {
                if (!reviewerBusy) setPendingReview(null)
              }}
              onConfirm={confirmReview}
            />
          ) : null}
        </>
      ) : canSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || submitDisabled}
          title={submitLabel}
          aria-label={submitLabel}
          className={`${buttonBase} bg-purple-700 text-white hover:bg-purple-800`}
        >
          {content(Send, submitting ? 'Sending...' : submitLabel, submitting ? 'Sending...' : submitLabel === 'Send to Psychologist' ? 'Submit' : submitLabel)}
        </button>
      ) : null}
    </>
  )
}

export default FormActionButtons
