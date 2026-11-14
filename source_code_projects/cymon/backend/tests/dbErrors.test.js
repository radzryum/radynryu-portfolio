// friendlyDbError contract tests — run with `npm test` (node --test).
// Raw Postgres/PostgREST text must never reach users; this asserts the
// mapping for the known error shapes.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { friendlyDbError } = require('../lib/dbErrors');

describe('friendlyDbError', () => {
  it('maps invalid-enum errors to plain language', () => {
    const out = friendlyDbError({ message: 'invalid input value for enum report_status: "revalidation"' });
    assert.ok(!out.includes('invalid input value for enum'), 'raw DB text leaked');
    assert.ok(/outdated status|reload/i.test(out));
  });

  it('maps unique violations without leaking constraint names', () => {
    const out = friendlyDbError({ message: 'duplicate key value violates unique constraint "assessment_reports_one_iep_per_patient_period_idx"' });
    assert.ok(!out.includes('duplicate key value'), 'raw DB text leaked');
    assert.ok(/already exists|reload/i.test(out));
  });

  it('maps foreign-key and not-null violations', () => {
    assert.ok(/missing|reload/i.test(friendlyDbError({ message: 'insert violates foreign key constraint "fk_patient"' })));
    assert.ok(/required|missing/i.test(friendlyDbError({ message: 'null value violates not-null constraint "title"' })));
  });

  it('passes ordinary app errors through untouched', () => {
    assert.equal(friendlyDbError({ message: 'A psychologist signature is required before approval.' }), 'A psychologist signature is required before approval.');
  });

  it('falls back safely on empty errors', () => {
    assert.ok(friendlyDbError(null).length > 0);
    assert.ok(friendlyDbError({}).length > 0);
  });
});
