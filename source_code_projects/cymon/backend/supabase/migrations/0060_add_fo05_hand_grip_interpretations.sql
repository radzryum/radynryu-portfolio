-- Add the verbal interpretation fields for the writing and name-recognition rows.
-- This is idempotent for databases that already applied migration 0059.

UPDATE public.assessment_templates
SET structure = (
  SELECT jsonb_agg(
    CASE
      WHEN domain->>'key' = 'writing_name_recognition' THEN
        jsonb_set(
          domain,
          '{items}',
          COALESCE(domain->'items', '[]'::jsonb)
          || CASE WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) AS existing(item)
            WHERE existing.item->>'key' = 'writing_name_recognition_interpretation'
          ) THEN jsonb_build_array(jsonb_build_object(
            'key', 'writing_name_recognition_interpretation',
            'label', 'Name Recognition Verbal Interpretation',
            'response_type', 'text'
          )) ELSE '[]'::jsonb END
          || CASE WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) AS existing(item)
            WHERE existing.item->>'key' = 'writing_write_name_interpretation'
          ) THEN jsonb_build_array(jsonb_build_object(
            'key', 'writing_write_name_interpretation',
            'label', 'Write Name Verbal Interpretation',
            'response_type', 'text'
          )) ELSE '[]'::jsonb END
          || CASE WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) AS existing(item)
            WHERE existing.item->>'key' = 'writing_spell_name_interpretation'
          ) THEN jsonb_build_array(jsonb_build_object(
            'key', 'writing_spell_name_interpretation',
            'label', 'Spell Name Verbal Interpretation',
            'response_type', 'text'
          )) ELSE '[]'::jsonb END
          || CASE WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) AS existing(item)
            WHERE existing.item->>'key' = 'writing_dominant_hand_interpretation'
          ) THEN jsonb_build_array(jsonb_build_object(
            'key', 'writing_dominant_hand_interpretation',
            'label', 'Dominant Hand Verbal Interpretation',
            'response_type', 'text'
          )) ELSE '[]'::jsonb END
          || CASE WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(domain->'items', '[]'::jsonb)) AS existing(item)
            WHERE existing.item->>'key' = 'writing_pencil_grip_interpretation'
          ) THEN jsonb_build_array(jsonb_build_object(
            'key', 'writing_pencil_grip_interpretation',
            'label', 'Pencil Grip Verbal Interpretation',
            'response_type', 'text'
          )) ELSE '[]'::jsonb END,
          true
        )
      ELSE domain
    END
    ORDER BY ordinal
  )
  FROM jsonb_array_elements(COALESCE(structure, '[]'::jsonb)) WITH ORDINALITY AS domains(domain, ordinal)
)
WHERE document_type_code = 'CMPS:SE-FO-05'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(structure, '[]'::jsonb)) AS domains(domain)
    WHERE domains.domain->>'key' = 'writing_name_recognition'
  );

NOTIFY pgrst, 'reload schema';
