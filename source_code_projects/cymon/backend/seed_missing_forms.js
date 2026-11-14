require('dotenv').config();
const { supabase } = require('./lib/supabase');

async function run() {
  console.log('Inserting missing document types...');
  const { data, error } = await supabase
    .from('document_types')
    .upsert([
      { code: 'CMPS:SE-FO-09', title: 'Monthly Assessment Report', category: 'progress_report', current_revision: 'rev.0', description: 'Monthly Assessment Report' },
      { code: 'CMPS:SE-FO-10', title: 'Individualized Education Plan', category: 'assessment_report', current_revision: 'rev.0', description: 'Individualized Education Plan' }
    ], { onConflict: 'code' });

  if (error) {
    console.error('Error inserting document types:', error);
  } else {
    console.log('Successfully inserted document types.');
  }
}

run();
