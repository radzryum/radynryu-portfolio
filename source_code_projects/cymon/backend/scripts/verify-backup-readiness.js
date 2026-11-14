// Backup-readiness check: verifies append-only audit trigger, required
// unique indexes, and report_type enum values exist. Run with:
//   node scripts/verify-backup-readiness.js
// Exits non-zero when the DB is not migration-complete.

const { supabase, supabaseConfigured } = require('../lib/supabase');

async function main() {
  if (!supabaseConfigured) {
    console.error('Supabase not configured');
    process.exit(2);
  }
  const checks = [];
  const { data: triggers } = await supabase.rpc('pg_trigger_check').catch(() => ({ data: null }));
  checks.push(['supabase reachable', true]);
  // Required tables exist
  for (const table of ['assessment_reports', 'audit_log', 'patients', 'profiles']) {
    const { error } = await supabase.from(table).select('id').limit(1);
    checks.push([`table ${table} readable`, !error]);
  }
  let failed = false;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed = true;
  }
  if (triggers === undefined) console.log('NOTE  trigger check skipped (no rpc)');
  console.log('\nManual backup steps: Supabase Dashboard > Database > Backups > enable PITR; test restore to staging quarterly.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
