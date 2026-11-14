// Reviewer session notice for psychologist approval workspaces.
//
// Approval signatures live in unsaved local state: there is no draft save for
// the review decision itself, so navigating away (or closing the form) before
// pressing Approve / Return discards the signature and forces re-signing.
// This banner states that upfront so reviewers are never surprised.
function ReviewSessionNotice() {
  return (
    <div
      role="note"
      className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
    >
      <span className="font-bold">Important:</span> Approval must be completed
      in this session. Signatures are not saved as drafts — navigating away
      before final submission will require re-signing the form.
    </div>
  )
}

export default ReviewSessionNotice
