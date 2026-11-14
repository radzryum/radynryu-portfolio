const { supabase, supabaseConfigured } = require('./supabase');

const ALLOWED_SEVERITIES = new Set(['info', 'warn', 'alert']);

/**
 * Append a clinic-wide, read-only audit event.
 *
 * Audit failures are logged without failing the clinical operation that already
 * succeeded. Callers should await this helper so the insert is attempted before
 * a serverless request finishes.
 */
async function writeAudit({
  clinicId,
  actorId = null,
  action,
  entityType = null,
  entityId = null,
  summary,
  severity = 'info',
  // Session context — only login/logout callers pass these.
  ipAddress = null,
  userAgent = null,
  deviceLabel = null,
  city = null,
  country = null,
}) {
  if (!supabaseConfigured || !clinicId || !action || !summary) return false;

  const { error } = await supabase.from('audit_log').insert({
    clinic_id: clinicId,
    actor_id: actorId || null,
    action: String(action).trim(),
    entity_type: entityType ? String(entityType).trim() : null,
    entity_id: entityId || null,
    summary: String(summary).trim(),
    severity: ALLOWED_SEVERITIES.has(severity) ? severity : 'info',
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    device_label: deviceLabel || null,
    city: city || null,
    country: country || null,
  });

  if (error) {
    // Migration 0101 not applied yet on this database: retry without the
    // session-context columns so the audit event is still recorded.
    if (/ip_address|user_agent|device_label|city|country/.test(error.message || '')) {
      const { error: retryError } = await supabase.from('audit_log').insert({
        clinic_id: clinicId,
        actor_id: actorId || null,
        action: String(action).trim(),
        entity_type: entityType ? String(entityType).trim() : null,
        entity_id: entityId || null,
        summary: String(summary).trim(),
        severity: ALLOWED_SEVERITIES.has(severity) ? severity : 'info',
      });
      if (retryError) {
        console.error(`[audit] failed to record ${action}:`, retryError.message || retryError);
        return false;
      }
      return true;
    }
    console.error(`[audit] failed to record ${action}:`, error.message || error);
    return false;
  }
  return true;
}

module.exports = { writeAudit };
