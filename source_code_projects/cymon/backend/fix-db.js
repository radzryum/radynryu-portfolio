require('dotenv').config({ path: '.env' });
const { supabase } = require('./lib/supabase');

async function fixTemplates() {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('id, structure, document_type_code')
    .eq('document_type_code', 'CMPS:SE-FO-04');

  if (error) {
    console.error('Error fetching templates:', error);
    return;
  }

  console.log(`Found ${data.length} FO-04 templates.`);

  for (const row of data) {
    let changed = false;
    if (row.structure && row.structure.pages) {
      for (const page of row.structure.pages) {
        if (page.heading === 'Perceptual Disturbances' || page.heading === 'Stimming') {
          if (!page.columns || page.columns.length !== 3 || page.columns[2] !== 'N/A') {
            page.columns = ['Yes', 'No', 'N/A'];
            changed = true;
          }
        }
      }
    }
    
    if (changed) {
      const { error: updateError } = await supabase
        .from('assessment_templates')
        .update({ structure: row.structure })
        .eq('id', row.id);
        
      if (updateError) {
        console.error(`Failed to update ${row.id}:`, updateError);
      } else {
        console.log(`Updated assessment ${row.id} to include N/A columns.`);
      }
    } else {
      console.log(`Assessment ${row.id} already has N/A or does not need update.`);
    }
  }
}

fixTemplates();
