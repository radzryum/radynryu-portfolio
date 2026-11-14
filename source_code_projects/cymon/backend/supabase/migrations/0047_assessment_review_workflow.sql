-- 0047_assessment_review_workflow.sql
-- Tighten the assessment workflow so submissions can be signed by the
-- psychometrician, reviewed/sign-signed by the psychologist, and sent back as
-- draft for revision.

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'submission_status' and e.enumlabel = 'revalidation'
  ) then
    alter type public.submission_status add value 'revalidation';
  end if;
end $$;

alter table public.assessment_submissions
  add column if not exists respondent_signature_image text,
  add column if not exists reviewer_signature_image text,
  add column if not exists reviewed_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

comment on column public.assessment_submissions.respondent_signature_image is
  'Drawn signature for the psychometrician/client who completed and sent the assessment.';
comment on column public.assessment_submissions.reviewer_signature_image is
  'Drawn signature for the psychologist who reviewed and approved the assessment.';
comment on column public.assessment_submissions.reviewed_by_id is
  'Profile ID of the psychologist/admin who reviewed the assessment submission.';
comment on column public.assessment_submissions.reviewed_at is
  'Timestamp when the assessment was reviewed and signed off.';
