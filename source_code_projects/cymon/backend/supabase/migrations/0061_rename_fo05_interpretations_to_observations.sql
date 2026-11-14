-- Rename FO-05 response labels without changing their keys or saved answers.
-- The response keys remain *_interpretation for backward compatibility.

UPDATE public.assessment_templates AS template
SET structure = (
  SELECT jsonb_agg(
    CASE
      WHEN domain->>'key' = 'writing_name_recognition' THEN
        jsonb_set(
          domain,
          '{items}',
          (
            SELECT jsonb_agg(
              CASE item->>'key'
                WHEN 'writing_name_recognition_interpretation' THEN jsonb_set(item, '{label}', to_jsonb('Name Recognition Observation'::text), true)
                WHEN 'writing_write_name_interpretation' THEN jsonb_set(item, '{label}', to_jsonb('Write Name Observation'::text), true)
                WHEN 'writing_spell_name_interpretation' THEN jsonb_set(item, '{label}', to_jsonb('Spell Name Observation'::text), true)
                WHEN 'writing_dominant_hand_interpretation' THEN jsonb_set(item, '{label}', to_jsonb('Dominant Hand Observation'::text), true)
                WHEN 'writing_pencil_grip_interpretation' THEN jsonb_set(item, '{label}', to_jsonb('Pencil Grip Observation'::text), true)
                ELSE item
              END
              ORDER BY item_ordinal
            )
            FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) WITH ORDINALITY AS item_rows(item, item_ordinal)
          ),
          true
        )
      ELSE domain
    END
    ORDER BY domain_ordinal
  )
  FROM jsonb_array_elements(COALESCE(template.structure, '[]'::jsonb)) WITH ORDINALITY AS domain_rows(domain, domain_ordinal)
)
WHERE template.document_type_code = 'CMPS:SE-FO-05';

NOTIFY pgrst, 'reload schema';
