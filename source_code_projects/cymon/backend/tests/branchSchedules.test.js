// Practitioner weekly branch schedules — run with `npm test` (node --test).
// The Front Desk booking branch follows the clinician's weekday (+time)
// slot, so the clinic location is suggested, not picked by hand.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { weekdayOf, toMinutes, suggestClinicForDate } = require('../lib/branchSchedules');

const CAB = 'cabuyao-id';
const ALA = 'alabang-id';
const SCHEDULES = [
  { clinic_id: CAB, day_of_week: 1, start_time: '08:00', end_time: '12:00' },
  { clinic_id: ALA, day_of_week: 2, start_time: '13:00', end_time: '17:00' },
];

describe('weekdayOf', () => {
  it('maps dates to JS weekdays (2026-10-06 is a Tuesday)', () => {
    assert.equal(weekdayOf('2026-10-06'), 2);
    assert.equal(weekdayOf('2026-10-05'), 1);
  });

  it('returns null for garbage dates', () => {
    assert.equal(weekdayOf('not-a-date'), null);
    assert.equal(weekdayOf(''), null);
  });
});

describe('toMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    assert.equal(toMinutes('08:00'), 480);
    assert.equal(toMinutes('13:30:00'), 810);
  });

  it('returns null for garbage times', () => {
    assert.equal(toMinutes('25:00'), null);
    assert.equal(toMinutes('nope'), null);
  });
});

describe('suggestClinicForDate', () => {
  it('picks the weekday branch without a time', () => {
    assert.equal(suggestClinicForDate(SCHEDULES, '2026-10-05'), CAB);
    assert.equal(suggestClinicForDate(SCHEDULES, '2026-10-06'), ALA);
  });

  it('prefers the slot containing the booking time', () => {
    const twoSlots = [
      { clinic_id: CAB, day_of_week: 1, start_time: '08:00', end_time: '12:00' },
      { clinic_id: ALA, day_of_week: 1, start_time: '13:00', end_time: '17:00' },
    ];
    assert.equal(suggestClinicForDate(twoSlots, '2026-10-05', '09:00'), CAB);
    assert.equal(suggestClinicForDate(twoSlots, '2026-10-05', '14:00'), ALA);
  });

  it('falls back to the day slot when the time is outside every slot', () => {
    assert.equal(suggestClinicForDate(SCHEDULES, '2026-10-06', '09:00'), ALA);
  });

  it('returns null when the clinician has no slot that day', () => {
    assert.equal(suggestClinicForDate(SCHEDULES, '2026-10-07'), null);
    assert.equal(suggestClinicForDate([], '2026-10-06'), null);
  });
});
