-- 0100: allow unlimited Daily Activity Report entries per student
-- (one per day), instead of a single DAR row per student.
--
-- 0050 installed a patient-wide singleton (one session_logs row per
-- patient), so a second daily entry could never be submitted. Replace it
-- with a per-day uniqueness rule: each daily entry gets its own row with
-- its own submit/review tracker, while the same day still cannot duplicate.

drop index if exists public.session_logs_one_report_per_patient_idx;

-- Dedupe first (keep the most recently updated row per patient/day).
with ranked as (
  select
    id,
    row_number() over (
      partition by patient_id, session_date
      order by updated_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.session_logs
)
delete from public.session_logs logs
using ranked
where logs.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists session_logs_one_report_per_patient_date_idx
  on public.session_logs (patient_id, session_date);
