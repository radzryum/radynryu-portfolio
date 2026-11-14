// One-time backfill: notify caregivers whose student still has a pending
// SPED Consent & Waiver (CMPS:SE-FO-02). New registrations get this
// notification automatically in POST /api/admin/patients; this covers accounts
// created before that trigger existed.
//
// Usage:
//   node scripts/notifyPendingWaivers.js           (dry run, prints who WOULD be notified)
//   node scripts/notifyPendingWaivers.js --send    (actually inserts notifications)
//
// Idempotent: caregivers that already have an unread waiver notification
// pointing at /client/waivers are skipped, so re-running is safe.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = (process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^['"]|['"]$/g, '');
if (!/^https?:\/\//i.test(url) || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SEND = process.argv.includes('--send');
const LINK = '/client/waivers';
const TITLE = 'Action Required: SPED Consent and Waiver';

async function run() {
  const { data: patients, error: pErr } = await sb
    .from('patients')
    .select('id, clinic_id, caregiver_id, first_name, last_name, waiver_submissions(document_type_code, status)')
    .is('deleted_at', null)
    .eq('status', 'active')
    .eq('admission_form_status', 'complete');
  if (pErr) throw pErr;

  const pending = (patients || []).filter(
    (p) => p.caregiver_id && !((p.waiver_submissions || []).some(
      (w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved',
    )),
  );

  const { data: existing, error: nErr } = await sb
    .from('notifications')
    .select('recipient_id')
    .eq('type', 'waiver')
    .eq('link', LINK)
    .is('read_at', null);
  if (nErr) throw nErr;
  const alreadyNotified = new Set((existing || []).map((n) => n.recipient_id));

  const todo = pending.filter((p) => !alreadyNotified.has(p.caregiver_id));
  console.log(`Active+complete patients with FO-02 not approved: ${pending.length}`);
  console.log(`Skipped (already have unread prompt): ${pending.length - todo.length}`);
  console.log(`To notify: ${todo.length}${SEND ? '' : ' (dry run — pass --send to insert)'}`);

  if (!SEND) {
    todo.forEach((p) => console.log(`  - ${p.first_name} ${p.last_name} (caregiver ${p.caregiver_id})`));
    return;
  }

  let inserted = 0;
  for (const p of todo) {
    const { error } = await sb.from('notifications').insert({
      clinic_id: p.clinic_id,
      recipient_id: p.caregiver_id,
      type: 'waiver',
      title: TITLE,
      body: `Please answer the SPED Consent and Waiver for ${p.first_name} ${p.last_name} to complete enrollment and activate student records.`,
      link: LINK,
    });
    if (error) {
      console.error(`  ! failed for ${p.first_name} ${p.last_name}: ${error.message}`);
    } else {
      inserted += 1;
    }
  }
  console.log(`Inserted ${inserted}/${todo.length} notifications.`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
