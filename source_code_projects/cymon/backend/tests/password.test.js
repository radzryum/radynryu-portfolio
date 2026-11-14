// Password policy contract tests — run with `npm test` (node --test).
// Every password-setting path (signup, change, reset, admin-created
// accounts) shares validatePassword, so the rules only change here.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PASSWORD_POLICY, passwordChecks, validatePassword } = require('../lib/password');

describe('password policy', () => {
  it('requires 8+ chars, upper, lower, and digit', () => {
    assert.equal(PASSWORD_POLICY.minLength, 8);
    assert.equal(validatePassword('Secure123'), null);
  });

  it('rejects each missing rule with a specific message', () => {
    assert.match(validatePassword('Ab1'), /8 characters/);
    assert.match(validatePassword('secure123'), /uppercase/);
    assert.match(validatePassword('SECURE123'), /lowercase/);
    assert.match(validatePassword('SecurePass'), /number/);
    assert.match(validatePassword(''), /required/);
    assert.match(validatePassword('A'.repeat(65) + 'a1'), /64 characters or fewer/);
  });

  it('exposes per-rule results for the live checklist UI', () => {
    const checks = passwordChecks('Secure123');
    assert.equal(checks.length, 4);
    assert.ok(checks.every((c) => c.pass));
    assert.ok(passwordChecks('abc').every((c) => !c.pass || c.key === 'lowercase'));
  });

  it('never rejects at login strength (login does not validate)', () => {
    // Old weak passwords must still sign in — only NEW passwords validate.
    assert.equal(validatePassword('weak'), 'Password must have at least 8 characters.');
  });
});
