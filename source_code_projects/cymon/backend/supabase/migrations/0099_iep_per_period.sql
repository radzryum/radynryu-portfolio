-- 0099: allow one IEP per student per month (not one per student).
--
-- 0049 installed a patient-wide singleton (one IEP per patient), so a second
-- month could never be started. Replace it with a per-period uniqueness rule
-- (same pattern as 0094 for monthly reports): each month gets its own row
-- with its own 4-week plan and its own submit/review tracker, while the same
-- month still cannot duplicate.

-- Existing IEP rows predate periods: label them Month 1.
update public.assessment_reports
set period = 'Month 1'
where report_type = 'iep' and period is null;

drop index if exists public.assessment_reports_one_iep_per_patient_idx;

-- Dedupe first (keep the most recently updated row per patient/period).
with ranked as (
  select
    id,
    row_number() over (
      partition by patient_id, coalesce(period, 'Month 1')
      order by updated_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.assessment_reports
  where report_type = 'iep'
)
delete from public.assessment_reports reports
using ranked
where reports.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists assessment_reports_one_iep_per_patient_period_idx
  on public.assessment_reports (patient_id, period)
  where report_type = 'iep' and period is not null;
