-- 0053_standardized_assessment_signoff.sql
-- Ensure standardized assessments support the same RPm -> RPsy sign-off
-- workflow as behavioral assessment reports.

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
  add column if not exists reviewer_comment text,
  add column if not exists reviewer_signature_image text,
  add column if not exists reviewed_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

comment on column public.assessment_submissions.respondent_signature_image is
  'Signature of the psychometrician who completed and submitted the assessment.';
comment on column public.assessment_submissions.reviewer_comment is
  'Psychologist approval note or required revision comment.';
comment on column public.assessment_submissions.reviewer_signature_image is
  'Signature of the psychologist who approved the assessment.';
comment on column public.assessment_submissions.reviewed_by_id is
  'Profile ID of the psychologist who reviewed the assessment.';
comment on column public.assessment_submissions.reviewed_at is
  'Timestamp of the psychologist review decision.';
