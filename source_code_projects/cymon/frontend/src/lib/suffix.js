// Single source for name-suffix options. Used by the employee form's
// SuffixField plus the admission and public apply forms so all three offer
// the same list. Anything else goes through "Others" with a free-text box.
export const SUFFIX_OPTIONS = ['Jr', 'Sr', 'II', 'III', 'IV', 'V']

export const SUFFIX_OTHERS = 'Others'

export function suffixChoiceOf(value, others) {
  // An explicit Others pick always wins: without this, switching from a
  // standard option (e.g. Jr) to Others snaps the select back to the old
  // value, because the stored value still matches the list.
  if (others) return SUFFIX_OTHERS
  const v = String(value || '').trim()
  if (!v) return ''
  return SUFFIX_OPTIONS.includes(v) ? v : SUFFIX_OTHERS
}

export function isOtherSuffix(value) {
  const v = String(value || '').trim()
  return v !== '' && !SUFFIX_OPTIONS.includes(v)
}
