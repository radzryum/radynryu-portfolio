-- Add a mutual onsite viewing schedule: staff proposes several clinic dates
-- and the client selects one. Time selection is intentionally not stored.

alter table public.assessment_submissions
  add column if not exists onsite_view_options jsonb not null default '[]'::jsonb,
  add column if not exists onsite_view_selected_at timestamptz,
  add column if not exists onsite_view_selected_by_id uuid references public.profiles(id) on delete set null;

alter table public.assessment_reports
  add column if not exists onsite_view_options jsonb not null default '[]'::jsonb,
  add column if not exists onsite_view_selected_at timestamptz,
  add column if not exists onsite_view_selected_by_id uuid references public.profiles(id) on delete set null;

alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_onsite_view_status_check;
alter table public.assessment_submissions
  add constraint assessment_submissions_onsite_view_status_check
  check (onsite_view_status in ('not_requested', 'pending', 'options_proposed', 'scheduled', 'denied', 'cancelled', 'completed'));

alter table public.assessment_reports
  drop constraint if exists assessment_reports_onsite_view_status_check;
alter table public.assessment_reports
  add constraint assessment_reports_onsite_view_status_check
  check (onsite_view_status in ('not_requested', 'pending', 'options_proposed', 'scheduled', 'denied', 'cancelled', 'completed'));

alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_onsite_view_options_check;
alter table public.assessment_submissions
  add constraint assessment_submissions_onsite_view_options_check
  check (jsonb_typeof(onsite_view_options) = 'array');

alter table public.assessment_reports
  drop constraint if exists assessment_reports_onsite_view_options_check;
alter table public.assessment_reports
  add constraint assessment_reports_onsite_view_options_check
  check (jsonb_typeof(onsite_view_options) = 'array');

notify pgrst, 'reload schema';
