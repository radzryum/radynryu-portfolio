// Anti-forgery signature visibility rule (capstone requirement):
// saved ink is hidden in staff/client UI once its record is sent or locked.
// The complete ink stays visible solely on the admin-generated official PDF.
//
// Sealed (locked) statuses: the record left the signer's hands — indicator
// only, no preview. Anything else (drafts, in-progress, returned for
// revision): indicator with an opt-in preview so the signer can double-check
// before sending.
const SEALED_STATUSES = new Set([
  'submitted',
  'processed',
  'scored',
  'ready_for_review',
  'approved',
  'finalized',
  'pending',
  'flagged',
])

export function isSealedStatus(status) {
  return SEALED_STATUSES.has(String(status || '').trim().toLowerCase())
}
