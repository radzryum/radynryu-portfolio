// Weekly branch schedules: which branch a clinician works in on each
// weekday (day_of_week follows JS Date.getDay(): 0 = Sunday … 6 = Saturday).
// Pure helpers so the booking suggestion is unit-testable.

function weekdayOf(dateStr) {
  const d = new Date(`${String(dateStr || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function toMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Pick the branch for a booking date (+optional HH:MM time). A time inside
// a slot wins; otherwise the day's first slot wins; no slot → null.
function suggestClinicForDate(schedules, dateStr, timeStr) {
  const weekday = weekdayOf(dateStr);
  if (weekday === null) return null;
  const dayRows = (schedules || []).filter((s) => Number(s.day_of_week) === weekday);
  if (!dayRows.length) return null;
  const at = timeStr ? toMinutes(timeStr) : null;
  if (at !== null) {
    const inside = dayRows.find((s) => {
      const start = toMinutes(s.start_time);
      const end = toMinutes(s.end_time);
      return start !== null && end !== null && at >= start && at <= end;
    });
    if (inside) return inside.clinic_id;
  }
  return dayRows[0].clinic_id;
}

module.exports = { weekdayOf, toMinutes, suggestClinicForDate };
