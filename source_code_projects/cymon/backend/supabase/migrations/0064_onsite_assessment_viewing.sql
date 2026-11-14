-- Replace digital client document access with onsite viewing scheduling.
-- The request and schedule remain on the assessment document row itself.

alter table public.assessment_submissions
  add column if not exists onsite_view_status text not null default 'not_requested',
  add column if not exists onsite_view_requested_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists onsite_view_requested_at timestamptz,
  add column if not exists onsite_view_date date,
  add column if not exists onsite_view_scheduled_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists onsite_view_scheduled_at timestamptz;

alter table public.assessment_reports
  add column if not exists onsite_view_status text not null default 'not_requested',
  add column if not exists onsite_view_requested_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists onsite_view_requested_at timestamptz,
  add column if not exists onsite_view_date date,
  add column if not exists onsite_view_scheduled_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists onsite_view_scheduled_at timestamptz;

alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_onsite_view_status_check;
alter table public.assessment_submissions
  add constraint assessment_submissions_onsite_view_status_check
  check (onsite_view_status in ('not_requested', 'pending', 'scheduled', 'denied', 'cancelled', 'completed'));

alter table public.assessment_reports
  drop constraint if exists assessment_reports_onsite_view_status_check;
alter table public.assessment_reports
  add constraint assessment_reports_onsite_view_status_check
  check (onsite_view_status in ('not_requested', 'pending', 'scheduled', 'denied', 'cancelled', 'completed'));

-- A request created under the former digital-viewing workflow must not grant
-- digital access. Preserve only pending requests so staff can schedule them.
update public.assessment_submissions
set onsite_view_status = case when client_view_status = 'pending' then 'pending' else 'not_requested' end
where onsite_view_status = 'not_requested';

update public.assessment_reports
set onsite_view_status = case when client_view_status = 'pending' then 'pending' else 'not_requested' end
where onsite_view_status = 'not_requested';

create index if not exists assessment_submissions_onsite_view_idx
  on public.assessment_submissions (patient_id, onsite_view_status, onsite_view_date);
create index if not exists assessment_reports_onsite_view_idx
  on public.assessment_reports (patient_id, onsite_view_status, onsite_view_date);

-- Clients must never select answered assessment submissions or staff reports
-- directly from Supabase. The backend exposes scheduling metadata only.
drop policy if exists assessment_submissions_client_select on public.assessment_submissions;
drop policy if exists assessment_reports_client_select on public.assessment_reports;

notify pgrst, 'reload schema';
