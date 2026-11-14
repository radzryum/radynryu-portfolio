// Email MIME contract tests — run with `npm test` (node --test).
// Non-ASCII subjects (emoji pasted into announcement titles) must leave as
// RFC 2047 encoded-words, never raw UTF-8 bytes (Gmail renders those as
// mojibake: `Ã°ÂŸ...`).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildMimeMessage, encodeSubject } = require('../lib/email');

describe('encodeSubject', () => {
  it('leaves pure-ASCII subjects untouched', () => {
    assert.equal(encodeSubject('New Announcement: MOA Signing - ClearMind Clinic'), 'New Announcement: MOA Signing - ClearMind Clinic');
  });

  it('RFC 2047-encodes subjects with emoji / non-ASCII', () => {
    const out = encodeSubject('New Announcement: 🎉 OFFICIAL PARTNERSHIP UNLOCKED! - ClearMind Clinic');
    assert.match(out, /^\=\?UTF-8\?B\?.+\?\=$/);
    const decoded = Buffer.from(out.slice('=?UTF-8?B?'.length, -'?='.length), 'base64').toString('utf8');
    assert.equal(decoded, 'New Announcement: 🎉 OFFICIAL PARTNERSHIP UNLOCKED! - ClearMind Clinic');
  });
});

describe('buildMimeMessage', () => {
  it('emits an encoded Subject header for emoji titles', () => {
    const raw = buildMimeMessage({
      from: 'a@x.io',
      to: 'b@x.io',
      subject: 'Hi 🎉',
      text: 'hello',
    });
    const subjectLine = raw.split('\r\n').find((line) => line.startsWith('Subject:'));
    assert.match(subjectLine, /^\Subject: =\?UTF-8\?B\?/);
    assert.doesNotMatch(raw, /🎉/);
  });
});
