// Minimal performance smoke: measures /api/health latency locally.
// Run backend first (npm run dev), then: node scripts/perf-smoke.js
// Fails when p95 exceeds budget so CI can catch regressions.

const BUDGET_MS = Number(process.env.PERF_BUDGET_MS || 500);
const N = Number(process.env.PERF_N || 20);
const URL = process.env.PERF_URL || 'http://localhost:4000/api/health';

async function main() {
  const times = [];
  for (let i = 0; i < N; i += 1) {
    const t0 = Date.now();
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.text();
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
  console.log(`n=${N} p50=${p50}ms p95=${p95}ms budget=${BUDGET_MS}ms`);
  if (p95 > BUDGET_MS) {
    console.error('PERF BUDGET EXCEEDED');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
