// Single password policy for every password-setting path (signup,
// change-password, reset-password, admin-created accounts). Login never
// validates — existing holders of older, weaker passwords must still get in;
// only NEW passwords must satisfy the policy.
//
// Policy: 8–64 characters, at least one uppercase, one lowercase, one digit.
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 64,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
};

function passwordChecks(password) {
  const value = String(password || '');
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
  ];
}

// Returns null when the password satisfies the policy, otherwise the first
// unmet rule as a user-facing message.
function validatePassword(password) {
  const value = String(password || '');
  if (!value) return 'Password is required.';
  if (value.length > PASSWORD_POLICY.maxLength) {
    return `Password must be ${PASSWORD_POLICY.maxLength} characters or fewer.`;
  }
  const failed = passwordChecks(value).find((check) => !check.pass);
  if (failed) {
    return `Password must have ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}.`;
  }
  return null;
}

module.exports = { PASSWORD_POLICY, passwordChecks, validatePassword };
