-- 0048_ensure_assessment_report_signature_columns.sql
-- Safety migration for deployments where report signature columns were not yet
-- applied or the schema cache is still catching up.

alter table public.assessment_reports
  add column if not exists prepared_signature_image text,
  add column if not exists reviewer_signature_image text;

