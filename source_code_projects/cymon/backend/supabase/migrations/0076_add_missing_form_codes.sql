INSERT INTO public.document_types (code, title, category, current_revision, description)
VALUES 
  ('CMPS:SE-FO-09', 'Monthly Assessment Report', 'progress_report', 'rev.0', 'Monthly Assessment Report'),
  ('CMPS:SE-FO-10', 'Individualized Education Plan', 'assessment_report', 'rev.0', 'Individualized Education Plan')
ON CONFLICT (code) DO NOTHING;
