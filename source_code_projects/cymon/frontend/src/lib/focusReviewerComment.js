// Scroll to the psychologist's revision-comment box, ring it in red, and
// focus it — so a missing comment is impossible to overlook when returning
// a report for revision.
export function focusReviewerComment() {
  const el = document.querySelector('[data-reviewer-comment]')
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('reviewer-comment-needed')
  setTimeout(() => {
    try {
      el.focus({ preventScroll: true })
    } catch {
      el.focus()
    }
  }, 350)
  setTimeout(() => el.classList.remove('reviewer-comment-needed'), 4000)
  return true
}
