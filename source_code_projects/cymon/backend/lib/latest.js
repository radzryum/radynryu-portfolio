function toTimestamp(row, fields = ['updated_at', 'submitted_at', 'finalized_at', 'created_at']) {
  for (const field of fields) {
    const raw = row?.[field]
    if (!raw) continue
    const ts = new Date(raw).getTime()
    if (Number.isFinite(ts)) return ts
  }
  return 0
}

function dedupeLatestBy(rows = [], keyFn, fields) {
  const latest = new Map()

  for (const row of rows || []) {
    const key = keyFn(row)
    if (!key) continue

    const ts = toTimestamp(row, fields)
    const existing = latest.get(key)
    if (!existing || ts >= existing.ts) {
      latest.set(key, { row, ts })
    }
  }

  return Array.from(latest.values())
    .sort((a, b) => b.ts - a.ts)
    .map((entry) => entry.row)
}

module.exports = {
  dedupeLatestBy,
}
