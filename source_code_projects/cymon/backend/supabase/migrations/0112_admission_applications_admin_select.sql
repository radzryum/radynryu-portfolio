-- 0112: let admins read admission_applications via RLS (Realtime parity).
--
-- The table was service-role only (no SELECT policies), so Supabase Realtime
-- never delivered admission_applications events to admin browsers — the
-- Applications page could only update on manual reload. The backend already
-- serves this table to admins scoped by clinic, so this mirrors that access
-- with no privilege expansion: admins (incl. super_admin via is_admin())
-- may SELECT rows in their own clinic.
--
-- Re-runnable: drop-before-create.

drop policy if exists admission_applications_admin_select on public.admission_applications;
create policy admission_applications_admin_select on public.admission_applications
  for select to authenticated
  using (
    public.is_admin()
    and clinic_id = public.current_clinic()
  );
