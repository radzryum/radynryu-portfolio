// Seeds ONLY the assessment_templates catalog rows (FO-03, FO-04, FO-05).
//
// Safe to run on a live project: inserts codes that are missing and never
// deletes or touches assignments, submissions, reports, or session logs.
// After running, re-apply migrations 0059-0061 in the Supabase SQL editor so
// the FO-05 structure matches the current adaptive-tool schema.
//
// Usage: node scripts/seed_templates_only.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { BEHAV_STRUCTURE, MMSE_STRUCTURE, CAFT_STRUCTURE, count } = require('./seed_assessments');

const url = (process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^['"]|['"]$/g, '');
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const TEMPLATES = [
  { code: 'CMPS:SE-FO-03', title: 'Caregiver Observation Checklist', structure: BEHAV_STRUCTURE, mins: 15 },
  { code: 'CMPS:SE-FO-04', title: 'Mini-Mental Status Examination', structure: MMSE_STRUCTURE, mins: 20 },
  { code: 'CMPS:SE-FO-05', title: 'Child Adaptive Functioning Assessment Tool', structure: CAFT_STRUCTURE, mins: 25 },
];

async function main() {
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  for (const t of TEMPLATES) {
    const { data: existing } = await sb
      .from('assessment_templates')
      .select('id')
      .eq('document_type_code', t.code)
      .maybeSingle();
    if (existing) {
      console.log(`skip ${t.code} (already exists)`);
      continue;
    }
    const { error } = await sb.from('assessment_templates').insert({
      document_type_code: t.code,
      title: t.title,
      structure: t.structure,
      respondent: 'caregiver',
      est_minutes: t.mins,
      max_score: count(t.structure),
    });
    if (error) throw new Error(`template ${t.code}: ${error.message}`);
    console.log(`inserted ${t.code}`);
  }
  console.log('seed_templates_only complete');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
