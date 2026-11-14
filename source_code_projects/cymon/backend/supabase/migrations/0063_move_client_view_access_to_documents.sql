-- Store client PDF viewing approval on the document row itself.
-- This replaces the standalone assessment_view_requests table so every
-- submission/report carries its own request and access history.

alter table public.assessment_submissions
  add column if not exists client_view_status text not null default 'not_requested',
  add column if not exists client_view_requested_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists client_view_requested_at timestamptz,
  add column if not exists client_view_resolved_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists client_view_resolved_at timestamptz;

alter table public.assessment_reports
  add column if not exists client_view_status text not null default 'not_requested',
  add column if not exists client_view_requested_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists client_view_requested_at timestamptz,
  add column if not exists client_view_resolved_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists client_view_resolved_at timestamptz;

alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_client_view_status_check;
alter table public.assessment_submissions
  add constraint assessment_submissions_client_view_status_check
  check (client_view_status in ('not_requested', 'pending', 'granted', 'denied', 'revoked'));

alter table public.assessment_reports
  drop constraint if exists assessment_reports_client_view_status_check;
alter table public.assessment_reports
  add constraint assessment_reports_client_view_status_check
  check (client_view_status in ('not_requested', 'pending', 'granted', 'denied', 'revoked'));

-- Preserve requests created through migration 0062 before removing that table.
do $$
begin
  if to_regclass('public.assessment_view_requests') is not null then
    update public.assessment_submissions s
    set client_view_status = v.status::text,
        client_view_requested_by_id = v.requested_by_id,
        client_view_requested_at = v.created_at,
        client_view_resolved_by_id = v.resolved_by_id,
        client_view_resolved_at = v.resolved_at
    from public.assessment_view_requests v
    where v.source_table = 'assessment_submissions'
      and v.source_id = s.id;

    update public.assessment_reports r
    set client_view_status = v.status::text,
        client_view_requested_by_id = v.requested_by_id,
        client_view_requested_at = v.created_at,
        client_view_resolved_by_id = v.resolved_by_id,
        client_view_resolved_at = v.resolved_at
    from public.assessment_view_requests v
    where v.source_table = 'assessment_reports'
      and v.source_id = r.id;

    drop table public.assessment_view_requests;
  end if;
end $$;

drop type if exists public.assessment_view_request_status;

create index if not exists assessment_submissions_client_view_idx
  on public.assessment_submissions (patient_id, client_view_status, client_view_requested_at desc);
create index if not exists assessment_reports_client_view_idx
  on public.assessment_reports (patient_id, client_view_status, client_view_requested_at desc);

-- A client may only read an answered standardized assessment after the
-- psychologist grants viewing access. Staff access remains unchanged.
drop policy if exists assessment_submissions_access on public.assessment_submissions;
drop policy if exists assessment_submissions_staff_access on public.assessment_submissions;
drop policy if exists assessment_submissions_client_select on public.assessment_submissions;
drop policy if exists assessment_submissions_client_insert on public.assessment_submissions;
drop policy if exists assessment_submissions_client_update on public.assessment_submissions;

create policy assessment_submissions_staff_access on public.assessment_submissions
  for all to authenticated
  using (
    public.is_admin()
    or (
      public.current_role() in ('psychologist', 'psychometrician')
      and exists (
        select 1 from public.patients p
        where p.id = assessment_submissions.patient_id
          and p.clinic_id = public.current_clinic()
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.current_role() in ('psychologist', 'psychometrician')
      and exists (
        select 1 from public.patients p
        where p.id = assessment_submissions.patient_id
          and p.clinic_id = public.current_clinic()
      )
    )
  );

create policy assessment_submissions_client_select on public.assessment_submissions
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    and status = 'scored'
    and client_view_status = 'granted'
  );

create policy assessment_submissions_client_insert on public.assessment_submissions
  for insert to authenticated
  with check (
    public.owns_patient(patient_id)
    and client_view_status = 'not_requested'
  );

create policy assessment_submissions_client_update on public.assessment_submissions
  for update to authenticated
  using (
    public.owns_patient(patient_id)
    and status <> 'scored'
  )
  with check (
    public.owns_patient(patient_id)
    and status <> 'scored'
    and client_view_status = 'not_requested'
  );

-- Reports were staff-only before this workflow. Add a narrowly scoped client
-- read policy for a report that is approved and explicitly granted.
drop policy if exists assessment_reports_client_select on public.assessment_reports;
create policy assessment_reports_client_select on public.assessment_reports
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    and status in ('approved', 'finalized')
    and client_view_status = 'granted'
  );

notify pgrst, 'reload schema';
