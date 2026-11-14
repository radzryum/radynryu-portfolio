// Shared display metadata for the Student Roster (psychologist editable,
// psychometrician read-only). Kept outside component files so both roster
// pages import from one source without tripping react-refresh rules.
export const levelTone = {
  HSN: 'bg-rose-100 text-rose-700',
  MSN: 'bg-amber-100 text-amber-700',
  LSN: 'bg-emerald-100 text-emerald-700',
}

export const levelLabel = {
  HSN: 'HSN — High Support Needs',
  MSN: 'MSN — Moderate Support Needs',
  LSN: 'LSN — Low Support Needs',
}

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
