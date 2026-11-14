-- 0104_branch_patient_id_prefix.sql
-- Per-branch student numbers.
--
-- Root cause: the patient_id counter is per (clinic, year) but the old format
-- (CMPS-YYYY-NNN) had no branch part, so the first Alabang registration tried
-- to take CMPS-2026-001 — already held by Cabuyao — and every Alabang
-- registration failed with:
--   duplicate key value violates unique constraint "patients_patient_id_key"
--
-- New format: CMPS-<PREFIX>-YYYY-NNN, e.g. CMPS-CBY-2026-004 for Cabuyao and
-- CMPS-ALB-2026-001 for Alabang. Existing rows keep their old numbers; only
-- newly generated numbers carry the branch prefix.

-- ---------- branch prefix on clinics ----------

alter table public.clinics
  add column if not exists patient_id_prefix text;

update public.clinics
set patient_id_prefix = 'CBY'
where code = 'CLEARMIND-CABUYAO' and patient_id_prefix is null;

update public.clinics
set patient_id_prefix = 'ALB'
where code = 'CLEARMIND-ALABANG' and patient_id_prefix is null;

-- Fail fast with a clear message if some other branch still lacks a prefix,
-- instead of silently generating colliding numbers later.
do $$
declare
  v_missing text;
begin
  select string_agg(code, ', ') into v_missing
  from public.clinics
  where patient_id_prefix is null;
  if v_missing is not null then
    raise exception 'Clinics missing patient_id_prefix: % — assign a short prefix (e.g. CBY) to each before re-running', v_missing;
  end if;
end;
$$;

alter table public.clinics
  alter column patient_id_prefix set not null;

-- ---------- generator with branch prefix ----------

create or replace function public.next_patient_id(p_clinic uuid)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from now())::int;
  v_prefix text;
  v_next int;
begin
  select patient_id_prefix into v_prefix from public.clinics where id = p_clinic;
  if v_prefix is null then
    raise exception 'Clinic % is unknown or has no patient_id_prefix — set one in public.clinics first', p_clinic;
  end if;

  insert into public.patient_id_counters (clinic_id, year, counter)
  values (p_clinic, v_year, 1)
  on conflict (clinic_id, year)
  do update set counter = patient_id_counters.counter + 1
  returning counter into v_next;

  -- e.g. CMPS-CBY-2026-004, CMPS-ALB-2026-001
  return 'CMPS-' || v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 3, '0');
end;
$$;

-- Seed this year's counter rows (starting at 0, so the first generated number
-- per branch is ...-001). Existing counters are left untouched.
insert into public.patient_id_counters (clinic_id, year, counter)
select id, extract(year from now())::int, 0
from public.clinics
on conflict (clinic_id, year) do nothing;
