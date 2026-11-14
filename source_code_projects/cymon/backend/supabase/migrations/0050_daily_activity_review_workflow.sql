-- Daily Activity Report (CMPS:SE-FO-07) review workflow.
-- A student owns one DAR that is prepared by the assigned RPm and reviewed by
-- the assigned RPsy.

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'session_log_status'
      and e.enumlabel = 'revise_requested'
  ) then
    alter type public.session_log_status add value 'revise_requested';
  end if;
end $$;

alter table public.session_logs
  add column if not exists prepared_signature_image text,
  add column if not exists prepared_signature_date date,
  add column if not exists reviewed_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewer_signature_image text,
  add column if not exists reviewer_comment text,
  add column if not exists reviewed_at timestamptz;

with ranked_reports as (
  select
    id,
    row_number() over (
      partition by patient_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as duplicate_rank
  from public.session_logs
)
delete from public.session_logs logs
using ranked_reports ranked
where logs.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists session_logs_one_report_per_patient_idx
  on public.session_logs (patient_id);

comment on column public.session_logs.prepared_signature_image is
  'Drawn or uploaded signature of the psychometrician who submitted the DAR.';
comment on column public.session_logs.reviewer_signature_image is
  'Drawn or uploaded signature of the psychologist who approved the DAR.';
comment on column public.session_logs.reviewer_comment is
  'Psychologist revision note, limited to 100 characters by the API.';

