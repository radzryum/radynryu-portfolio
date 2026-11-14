-- 0094: allow one monthly report per student per period (not per student).
--
-- 0051 installed a patient-wide singleton (one progress_summary per patient),
-- which 409s the next month after approval. Replace it with a per-period
-- uniqueness rule so each month gets its own row while the same month still
-- cannot duplicate.

drop index if exists public.assessment_reports_one_progress_summary_per_patient_idx;

-- Dedupe first: keep the most recently updated row per (patient, period).
-- This is why the CREATE INDEX failed with 23505 on September 2026.
with ranked as (
  select
    id,
    row_number() over (
      partition by patient_id, period
      order by updated_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.assessment_reports
  where report_type = 'progress_summary' and period is not null
)
delete from public.assessment_reports reports
using ranked
where reports.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists assessment_reports_one_progress_summary_per_patient_period_idx
  on public.assessment_reports (patient_id, period)
  where report_type = 'progress_summary' and period is not null;
