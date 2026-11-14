-- Replace psychologist-mediated onsite viewing with an admin-owned document
-- release workflow. A request is a client-selected bundle of completed
-- assessment records; an administrator schedules, prices, pays, and releases
-- the bundle at the clinic counter.

-- Remove policies that referenced the old per-document access columns.
drop policy if exists assessment_submissions_client_select on public.assessment_submissions;
drop policy if exists assessment_submissions_client_insert on public.assessment_submissions;
drop policy if exists assessment_submissions_client_update on public.assessment_submissions;
drop policy if exists assessment_reports_client_select on public.assessment_reports;

-- The standalone request table was already retired by 0063, but this keeps the
-- migration safe for databases that stopped before that migration ran.
drop table if exists public.assessment_view_requests cascade;
drop type if exists public.assessment_view_request_status;

-- Remove the former client-view and onsite-view state stored on assessment
-- records. Release state now belongs to the normalized tables below.
alter table public.assessment_submissions
  drop column if exists client_view_status,
  drop column if exists client_view_requested_by_id,
  drop column if exists client_view_requested_at,
  drop column if exists client_view_resolved_by_id,
  drop column if exists client_view_resolved_at,
  drop column if exists onsite_view_status,
  drop column if exists onsite_view_requested_by_id,
  drop column if exists onsite_view_requested_at,
  drop column if exists onsite_view_date,
  drop column if exists onsite_view_scheduled_by_id,
  drop column if exists onsite_view_scheduled_at,
  drop column if exists onsite_view_options,
  drop column if exists onsite_view_selected_at,
  drop column if exists onsite_view_selected_by_id;

alter table public.assessment_reports
  drop column if exists client_view_status,
  drop column if exists client_view_requested_by_id,
  drop column if exists client_view_requested_at,
  drop column if exists client_view_resolved_by_id,
  drop column if exists client_view_resolved_at,
  drop column if exists onsite_view_status,
  drop column if exists onsite_view_requested_by_id,
  drop column if exists onsite_view_requested_at,
  drop column if exists onsite_view_date,
  drop column if exists onsite_view_scheduled_by_id,
  drop column if exists onsite_view_scheduled_at,
  drop column if exists onsite_view_options,
  drop column if exists onsite_view_selected_at,
  drop column if exists onsite_view_selected_by_id;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_release_request_status') then
    create type document_release_request_status as enum ('pending', 'scheduled', 'declined', 'released', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_release_payment_status') then
    create type document_release_payment_status as enum ('unpaid', 'paid');
  end if;
end $$;

create table if not exists public.assessment_document_release_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  requested_by_id uuid references public.profiles(id) on delete set null,
  status document_release_request_status not null default 'pending',
  scheduled_date date,
  scheduled_start_time time,
  scheduled_end_time time,
  location text not null default 'Main Clinic Cashier / Reception',
  payment_status document_release_payment_status not null default 'unpaid',
  payment_method text check (payment_method in ('cash', 'gcash')),
  paid_at timestamptz,
  paid_by_id uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  released_by_id uuid references public.profiles(id) on delete set null,
  declined_reason text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status in ('pending', 'declined', 'cancelled')
    or (scheduled_date is not null and scheduled_start_time is not null and scheduled_end_time is not null)
  ),
  check (scheduled_end_time is null or scheduled_start_time is null or scheduled_end_time > scheduled_start_time),
  check (status <> 'released' or payment_status = 'paid')
);

create table if not exists public.assessment_document_release_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.assessment_document_release_requests(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_table text not null check (source_table in ('assessment_submissions', 'assessment_reports')),
  source_id uuid not null,
  template_id uuid references public.assessment_templates(id) on delete set null,
  document_type_code text references public.document_types(code) on delete set null,
  title text not null,
  completed_at timestamptz,
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  created_at timestamptz not null default now(),
  unique (request_id, source_table, source_id)
);

create index if not exists assessment_document_release_requests_clinic_idx
  on public.assessment_document_release_requests (clinic_id, status, scheduled_date, created_at desc);
create index if not exists assessment_document_release_requests_patient_idx
  on public.assessment_document_release_requests (patient_id, created_at desc);
create index if not exists assessment_document_release_items_source_idx
  on public.assessment_document_release_items (patient_id, source_table, source_id);

drop trigger if exists assessment_document_release_requests_set_updated_at on public.assessment_document_release_requests;
create trigger assessment_document_release_requests_set_updated_at
  before update on public.assessment_document_release_requests
  for each row execute function public.set_updated_at();

alter table public.assessment_document_release_requests enable row level security;
alter table public.assessment_document_release_items enable row level security;

drop policy if exists assessment_document_release_requests_select on public.assessment_document_release_requests;
create policy assessment_document_release_requests_select on public.assessment_document_release_requests
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    or public.is_admin()
  );

drop policy if exists assessment_document_release_requests_insert on public.assessment_document_release_requests;
create policy assessment_document_release_requests_insert on public.assessment_document_release_requests
  for insert to authenticated
  with check (
    public.owns_patient(patient_id)
    and clinic_id = public.current_clinic()
    and requested_by_id = auth.uid()
    and status = 'pending'
  );

drop policy if exists assessment_document_release_requests_admin_update on public.assessment_document_release_requests;
create policy assessment_document_release_requests_admin_update on public.assessment_document_release_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists assessment_document_release_items_select on public.assessment_document_release_items;
create policy assessment_document_release_items_select on public.assessment_document_release_items
  for select to authenticated
  using (
    public.owns_patient(patient_id)
    or public.is_admin()
  );

drop policy if exists assessment_document_release_items_insert on public.assessment_document_release_items;
create policy assessment_document_release_items_insert on public.assessment_document_release_items
  for insert to authenticated
  with check (
    public.owns_patient(patient_id)
    and exists (
      select 1 from public.assessment_document_release_requests r
      where r.id = assessment_document_release_items.request_id
        and r.patient_id = assessment_document_release_items.patient_id
        and r.status = 'pending'
    )
  );

comment on table public.assessment_document_release_requests is
  'Admin-owned clinic scheduling, payment, and release lifecycle for completed assessment documents.';
comment on table public.assessment_document_release_items is
  'Snapshot of the completed assessment documents and fees included in a client release request.';

notify pgrst, 'reload schema';
