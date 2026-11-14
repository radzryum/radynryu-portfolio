// RETIRED: bulk-deleting the audit trail is no longer possible.
//
// Migration 0090_immutable_audit_log.sql installs a database trigger that
// rejects every UPDATE and DELETE on audit_log, so this script's query now
// fails by design. The file is kept (instead of deleted) so any manual run,
// cron job, or old runbook referencing it fails LOUDLY with an explanation
// instead of silently doing nothing.
//
// If audit storage ever needs maintenance (e.g. legal retention window),
// do it through a new, reviewed migration — never by reviving this script.
console.error(
  '[audit] Refusing to run: audit_log is append-only since migration 0090. ' +
    'See backend/supabase/migrations/0090_immutable_audit_log.sql.',
);
process.exit(1);
