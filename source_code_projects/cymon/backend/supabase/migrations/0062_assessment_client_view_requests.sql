-- Separate client visibility approval from assessment administration and
-- psychologist sign-off. A client may request access only after the document
-- is internally approved; the assigned psychologist must grant it.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'assessment_view_request_status') then
    create type assessment_view_request_status as enum ('pending', 'granted', 'denied', 'revoked');
  end if;
end $$;

create table if not exists public.assessment_view_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_table text not null check (source_table in ('assessment_submissions', 'assessment_reports')),
  source_id uuid not null,
  requested_by_id uuid references public.profiles(id) on delete set null,
  resolved_by_id uuid references public.profiles(id) on delete set null,
  status assessment_view_request_status not null default 'pending',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, source_table, source_id)
);

create index if not exists assessment_view_requests_clinic_status_idx
  on public.assessment_view_requests (clinic_id, status, created_at desc);
create index if not exists assessment_view_requests_source_idx
  on public.assessment_view_requests (source_table, source_id);

alter table public.assessment_view_requests enable row level security;

drop policy if exists assessment_view_requests_access on public.assessment_view_requests;
drop policy if exists assessment_view_requests_select on public.assessment_view_requests;
drop policy if exists assessment_view_requests_insert on public.assessment_view_requests;
drop policy if exists assessment_view_requests_update on public.assessment_view_requests;

-- Clients may see the status for their own child. Staff visibility is limited
-- to admins and the psychologist assigned to the patient.
create policy assessment_view_requests_select on public.assessment_view_requests
  for select to authenticated
  using (
    public.owns_patient(assessment_view_requests.patient_id)
    or public.is_admin()
    or exists (
      select 1
      from public.patients p
      where p.id = assessment_view_requests.patient_id
        and p.clinic_id = public.current_clinic()
        and p.treating_psychologist_id = auth.uid()
    )
  );

-- A caregiver can create only their own pending request. They cannot grant
-- themselves access by inserting a granted row.
create policy assessment_view_requests_insert on public.assessment_view_requests
  for insert to authenticated
  with check (
    public.owns_patient(assessment_view_requests.patient_id)
    and assessment_view_requests.clinic_id = public.current_clinic()
    and assessment_view_requests.requested_by_id = auth.uid()
    and assessment_view_requests.status = 'pending'
  );

-- Only the assigned psychologist or an admin may resolve a request.
create policy assessment_view_requests_update on public.assessment_view_requests
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.patients p
      where p.id = assessment_view_requests.patient_id
        and p.clinic_id = public.current_clinic()
        and p.treating_psychologist_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.patients p
      where p.id = assessment_view_requests.patient_id
        and p.clinic_id = public.current_clinic()
        and p.treating_psychologist_id = auth.uid()
    )
  );

drop trigger if exists assessment_view_requests_set_updated_at on public.assessment_view_requests;
create trigger assessment_view_requests_set_updated_at
  before update on public.assessment_view_requests
  for each row execute function public.set_updated_at();

comment on table public.assessment_view_requests is
  'Client requests to view psychologist-approved assessment PDFs; granted by the assigned psychologist.';

notify pgrst, 'reload schema';
