-- 0054_monthly_attendance_workspace.sql
-- Harden FO-11 as one mutable monthly record per student and add timestamps
-- required by the embedded attendance workspace.

alter table public.student_attendance_session_forms
  add column if not exists updated_at timestamptz not null default now();

-- Keep the newest row if an older deployment created duplicate monthly forms.
with ranked_forms as (
  select
    id,
    row_number() over (
      partition by patient_id, lower(trim(month_year))
      order by created_at desc nulls last, id desc
    ) as duplicate_rank
  from public.student_attendance_session_forms
)
delete from public.student_attendance_session_forms form
using ranked_forms ranked
where form.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists student_attendance_form_patient_month_uidx
  on public.student_attendance_session_forms (patient_id, lower(trim(month_year)));

with ranked_attendance as (
  select
    id,
    row_number() over (
      partition by form_id, date
      order by created_at desc nulls last, id desc
    ) as duplicate_rank
  from public.student_attendance_records
)
delete from public.student_attendance_records attendance
using ranked_attendance ranked
where attendance.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists student_attendance_record_form_date_uidx
  on public.student_attendance_records (form_id, date);

drop trigger if exists student_attendance_session_forms_set_updated_at
  on public.student_attendance_session_forms;
create trigger student_attendance_session_forms_set_updated_at
  before update on public.student_attendance_session_forms
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_attendance_records_status_check'
  ) then
    alter table public.student_attendance_records
      add constraint student_attendance_records_status_check
      check (status in ('Present', 'Absent', 'Excused'));
  end if;
end $$;
