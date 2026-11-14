-- Prevent caregivers from writing/updating/deleting journal entries when the
-- supervising Psychometrician has not granted permission.
-- Insert/update are blocked directly; delete is blocked unless it is a cascade
-- delete after the student row has already been removed.

create or replace function public.block_locked_daily_activity_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_allow boolean;
begin
  v_patient_id := coalesce(new.patient_id, old.patient_id);

  select p.allow_journal_entry
    into v_allow
  from public.patients p
  where p.id = v_patient_id;

  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;

    raise exception 'Associated student record not found';
  end if;

  if coalesce(v_allow, false) is false then
    raise exception 'Journal entries for this student are locked. Permission from your supervising Psychometrician is required.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_activity_logs_block_locked_write on public.daily_activity_logs;

create trigger daily_activity_logs_block_locked_write
before insert or update or delete on public.daily_activity_logs
for each row execute function public.block_locked_daily_activity_write();
