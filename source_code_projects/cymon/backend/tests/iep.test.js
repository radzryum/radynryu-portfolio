// IEP validation contracts — run with `npm test` (node --test, no dependencies).
// Guards the cycle/weeks/no-session rules shared by the psychometrician form,
// the psychologist review gate, and the official PDF.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  iepDurationWeeks,
  isIepWeekStarted,
  isIepWeekComplete,
  iepCycleProgress,
  findIncompleteIepField,
} = require('../lib/iep');

const BASICS = {
  title: 'Individualized Education Plan',
  learnerName: 'Ana Cruz',
  learnerDob: '2018-01-01',
  planStart: '2026-05-12',
  techName: 'Tech',
  diagnosis: 'ASD',
  preparedDate: '2026-05-12',
};

const fullWeek = (overrides = {}) => ({
  level: 'MSN',
  practical: { activity: 'a', objectives: 'o', materials: 'm', notes: '' },
  social: { activity: 'a', objectives: 'o', materials: 'm', notes: '' },
  conceptual: { activity: 'a', objectives: 'o', materials: 'm', notes: '' },
  kinFine: { activity: 'a', objectives: 'o', materials: 'm', notes: '' },
  kinGross: { activity: 'a', objectives: 'o', materials: 'm', notes: '' },
  ...overrides,
});

describe('iepDurationWeeks', () => {
  it('defaults to 4 weeks for legacy content without cycle metadata', () => {
    assert.equal(iepDurationWeeks({ weeks: { 1: {} } }), 4);
    assert.equal(iepDurationWeeks(null), 4);
  });

  it('honors explicit duration metadata and clamps to 1..12', () => {
    assert.equal(iepDurationWeeks({ cycle: { durationWeeks: 8 }, weeks: {} }), 8);
    assert.equal(iepDurationWeeks({ cycle: { durationWeeks: 99 }, weeks: {} }), 12);
    assert.equal(iepDurationWeeks({ cycle: { durationWeeks: 0 }, weeks: {} }), 1);
  });
});

describe('no-session weeks', () => {
  it('a no-session week with a reason satisfies validation', () => {
    const content = {
      ...BASICS,
      weeks: { 1: fullWeek(), 2: { noSession: true, noSessionReason: 'Holiday break' } },
    };
    assert.equal(findIncompleteIepField(content), null);
    assert.equal(isIepWeekStarted({ noSession: true }), true);
    assert.equal(isIepWeekComplete({ noSession: true, noSessionReason: 'Holiday' }), true);
  });

  it('a no-session week without a reason is flagged', () => {
    const content = {
      ...BASICS,
      weeks: { 1: fullWeek(), 2: { noSession: true, noSessionReason: '' } },
    };
    assert.equal(findIncompleteIepField(content), 'Week 2 no-session reason');
    assert.equal(isIepWeekComplete({ noSession: true, noSessionReason: '  ' }), false);
  });
});

describe('dynamic durations', () => {
  it('validates weeks beyond the legacy 4 when duration is longer', () => {
    const weeks = { 1: fullWeek() };
    for (let w = 2; w <= 8; w += 1) weeks[w] = fullWeek();
    delete weeks[6].social.objectives;
    const content = { ...BASICS, cycle: { durationWeeks: 8 }, weeks };
    assert.equal(findIncompleteIepField(content), 'Week 6 social objectives');
  });

  it('unstarted later weeks stay optional', () => {
    const content = { ...BASICS, cycle: { durationWeeks: 8 }, weeks: { 1: fullWeek() } };
    assert.equal(findIncompleteIepField(content), null);
    assert.deepEqual(iepCycleProgress(content), { done: 1, total: 8, pct: 13 });
  });
});
