// Shared password policy — mirrors backend/lib/password.js exactly.
// Keep both files in sync: backend enforces, this drives the live checklist
// and client-side pre-validation so users see the rules before submitting.
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 64,
}

export function passwordChecks(password) {
  const value = String(password || '')
  return [
    {
      key: 'length',
      label: `At least ${PASSWORD_POLICY.minLength} characters`,
      pass: value.length >= PASSWORD_POLICY.minLength,
    },
    {
      key: 'uppercase',
      label: 'At least one uppercase letter (A–Z)',
      pass: /[A-Z]/.test(value),
    },
    {
      key: 'lowercase',
      label: 'At least one lowercase letter (a–z)',
      pass: /[a-z]/.test(value),
    },
    {
      key: 'digit',
      label: 'At least one number (0–9)',
      pass: /[0-9]/.test(value),
    },
  ]
}

export function passwordError(password) {
  const value = String(password || '')
  if (!value) return 'Password is required.'
  if (value.length > PASSWORD_POLICY.maxLength) {
    return `Password must be ${PASSWORD_POLICY.maxLength} characters or fewer.`
  }
  const failed = passwordChecks(value).find((check) => !check.pass)
  if (failed) {
    return `Password must have ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}.`
  }
  return null
}
