-- 0107: lock down intake_interviews (FS-IT-01) with RLS.
--
-- Migration 0091 created the table WITHOUT row level security, leaving
-- clinical intake data (concerns, medical, family, observations) readable and
-- writable by anyone holding the anon key — bypassing every backend
-- clinic-scoping check. This was flagged CRITICAL by the Security Advisor
-- ("RLS Disabled in Public" + "Sensitive Columns Exposed").
--
-- The backend talks to Supabase with the service-role key (bypasses RLS), so
-- enabling RLS changes nothing for the app — it only closes the direct
-- anon-key path. Parents never see intake data; staff-in-clinic and admins
-- keep full access through the shared helper, mirroring assessment_reports.
--
-- Re-runnable: enable is idempotent, policy is drop-before-create.

alter table public.intake_interviews enable row level security;

drop policy if exists intake_interviews_staff on public.intake_interviews;
create policy intake_interviews_staff on public.intake_interviews
  for all to authenticated
  using (public.staff_can_access_patient(intake_interviews.patient_id))
  with check (public.staff_can_access_patient(intake_interviews.patient_id));
