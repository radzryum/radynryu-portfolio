-- Remove weekend options from records created before onsite viewing became
-- weekday-only. New options are validated by the API as well.

update public.assessment_submissions as submissions
set onsite_view_options = coalesce((
  select jsonb_agg(to_jsonb(day) order by day)
  from (
    select distinct left(option_value, 10) as day
    from jsonb_array_elements_text(submissions.onsite_view_options) as option_values(option_value)
    where left(option_value, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and extract(isodow from left(option_value, 10)::date) between 1 and 5
  ) normalized_dates
), '[]'::jsonb)
where jsonb_typeof(submissions.onsite_view_options) = 'array';

update public.assessment_reports as reports
set onsite_view_options = coalesce((
  select jsonb_agg(to_jsonb(day) order by day)
  from (
    select distinct left(option_value, 10) as day
    from jsonb_array_elements_text(reports.onsite_view_options) as option_values(option_value)
    where left(option_value, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and extract(isodow from left(option_value, 10)::date) between 1 and 5
  ) normalized_dates
), '[]'::jsonb)
where jsonb_typeof(reports.onsite_view_options) = 'array';

notify pgrst, 'reload schema';
