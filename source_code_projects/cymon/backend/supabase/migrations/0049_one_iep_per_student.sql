-- Keep exactly one Individualized Education Plan record per student.
-- Existing duplicates are reduced to the most recently updated record before
-- the uniqueness rule is installed.

with ranked_ieps as (
  select
    id,
    row_number() over (
      partition by patient_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as duplicate_rank
  from public.assessment_reports
  where report_type = 'iep'
)
delete from public.assessment_reports reports
using ranked_ieps ranked
where reports.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists assessment_reports_one_iep_per_patient_idx
  on public.assessment_reports (patient_id)
  where report_type = 'iep';

