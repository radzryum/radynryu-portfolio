-- 0046_add_report_signatures.sql
-- Store drawn sign-off images for report authors/reviewers.

alter table public.assessment_reports
  add column if not exists prepared_signature_image text,
  add column if not exists reviewer_signature_image text;
