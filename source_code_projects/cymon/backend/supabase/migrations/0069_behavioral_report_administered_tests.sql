-- Keep Part III of the Behavioral Assessment Report queryable as structured data.
-- The report content JSON remains the rendering source, while this column gives
-- the database a typed mirror for filtering and future reporting.

alter table public.assessment_reports
  add column if not exists administered_tests jsonb not null default '[]'::jsonb;

alter table public.assessment_reports
  drop constraint if exists assessment_reports_administered_tests_array_check;

alter table public.assessment_reports
  add constraint assessment_reports_administered_tests_array_check
  check (jsonb_typeof(administered_tests) = 'array');

create index if not exists assessment_reports_administered_tests_idx
  on public.assessment_reports using gin (administered_tests);

notify pgrst, 'reload schema';
