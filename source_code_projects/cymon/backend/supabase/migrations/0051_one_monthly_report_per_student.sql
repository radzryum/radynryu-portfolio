-- Keep one Monthly Progress Summary (CMPS:SE-FO-08) per student.
-- Legacy IEP rows that were stored as progress_summary are normalized first so
-- they do not conflict with the monthly report uniqueness rule.

alter table public.assessment_reports
  add column if not exists prepared_signature_image text,
  add column if not exists reviewer_signature_image text,
  add column if not exists reviewer_comment text;

update public.assessment_reports
set report_type = 'iep'
where report_type = 'progress_summary'
  and title ~* '(individualized education plan|\mIEP\M)';

with ranked_reports as (
  select
    id,
    row_number() over (
      partition by patient_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as duplicate_rank
  from public.assessment_reports
  where report_type = 'progress_summary'
)
delete from public.assessment_reports reports
using ranked_reports ranked
where reports.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists assessment_reports_one_progress_summary_per_patient_idx
  on public.assessment_reports (patient_id)
  where report_type = 'progress_summary';
