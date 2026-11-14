-- 0108: close RLS SELECT gaps blocking Realtime (and any direct-API reads).
--
-- Audit finding: Realtime only delivers rows the subscriber's JWT may SELECT.
-- Four gaps made subscriptions silently deliver nothing:
--   1. psychologists/psychometricians have NO select on patients
--      (only caregivers-own + admin-all existed);
--   2. clinical staff see appointments only as practitioner — colleagues'
--      sessions and colleagues' assigned-student sessions are invisible;
--   3. caregivers have NO select on session_logs, whose approved rows the
--      client portal already serves (Daily Activity Reports);
--   4. caregivers have NO select on assessment_reports at all — migration
--      0068 dropped the client policy with the retired client-view workflow
--      and never recreated it.
--
-- Every policy below mirrors what the backend (service-role) already serves
-- to that role — no privilege expansion, just RLS parity:
--   1. staff see assigned students in their own clinic;
--   2. staff see own-clinic sessions where they are the practitioner or the
--      student is assigned to them (group sessions with no patient_id stay
--      practitioner/admin-only, as today);
--   3. caregivers see APPROVED logs of their own students only (drafts stay
--      staff-only — Realtime ships full row payloads, so the status guard is
--      load-bearing, not cosmetic).
--
-- Also widens is_admin() to super_admin: the app treats super_admin as
-- admin-everywhere (backend isSuperAdminReq), but the helper only matched
-- 'admin', so super_admin subscriptions received nothing on admin-gated
-- tables. Per-policy clinic scoping is untouched.
--
-- Re-runnable: helpers are create-or-replace, policies drop-before-create.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin', 'super_admin')
$$;

drop policy if exists patients_staff_select on public.patients;
create policy patients_staff_select on public.patients
  for select to authenticated
  using (
    public.current_role() in ('psychologist', 'psychometrician')
    and clinic_id = public.current_clinic()
    and (
      treating_psychologist_id = auth.uid()
      or treating_psychometrician_id = auth.uid()
    )
  );

drop policy if exists appointments_staff_select on public.appointments;
create policy appointments_staff_select on public.appointments
  for select to authenticated
  using (
    public.current_role() in ('psychologist', 'psychometrician')
    and clinic_id = public.current_clinic()
    and (
      practitioner_id = auth.uid()
      or exists (
        select 1 from public.patients p
        where p.id = appointments.patient_id
          and (
            p.treating_psychologist_id = auth.uid()
            or p.treating_psychometrician_id = auth.uid()
          )
      )
    )
  );

drop policy if exists session_logs_client_select on public.session_logs;
create policy session_logs_client_select on public.session_logs
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    and status = 'approved'
  );

-- Migration 0068 dropped assessment_reports_client_select (with the retired
-- client-view workflow) and never recreated it, so caregivers have no
-- SELECT on reports at all. Restore a narrow one matching exactly what the
-- client portal already serves: approved/finalized reports of their own
-- students. The old client_view_status gate is gone (0068 dropped the
-- column); release state now lives in the document-release tables.
drop policy if exists assessment_reports_client_select on public.assessment_reports;
create policy assessment_reports_client_select on public.assessment_reports
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    and status in ('approved', 'finalized')
  );
