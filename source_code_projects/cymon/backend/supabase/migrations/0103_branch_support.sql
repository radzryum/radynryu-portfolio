-- 0103_branch_support.sql
-- Fix Cabuyao seed typos, add Alabang branch, keep clinic_code backward compatible.
-- Seed 0001 had: Painsville / Banilo / Calauan (wrong). Correct is Palmsville /
-- Banlic / Cabuyao. Branch is now explicit in code + name so QR flyers,
-- badges, and thesis screenshots show which branch a record belongs to.

-- 1) Fix Cabuyao row in place (keeps existing clinic_id stable so all
-- patients/profiles stay linked).
update public.clinics
set code = 'CLEARMIND-CABUYAO',
    name = 'ClearMind Psychological Services - Cabuyao Branch',
    address = 'Blk 1 Lot 7 Palmsville Subdivision, Brgy. Banlic, Cabuyao City, Laguna 4025'
where code = 'CLEARMIND';

-- 2) Add Alabang branch.
insert into public.clinics (code, name, address, phone, email)
values (
  'CLEARMIND-ALABANG',
  'ClearMind Psychological Services - Alabang Branch',
  'Unit 4-M, Westgate Tower, Madrigal Business Park, 1709 Investment Dr, Barangay Ayala Alabang, Muntinlupa City, Philippines, 1780',
  '0970 885 8948',
  'alabangadmin@clearmindpsychservices.com'
)
on conflict (code) do update set
  name = excluded.name,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email;

-- 3) Keep old clients working: default new profiles to Cabuyao, and map the
-- legacy 'CLEARMIND' code (used by older QR links / mobile builds) to Cabuyao.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  meta_name text;
  meta_clinic text;
  resolved_clinic uuid;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'client');
  meta_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
  -- Uppercase so 'clearmind-alabang' and 'CLEARMIND-ALABANG' resolve alike.
  meta_clinic := upper(coalesce(new.raw_user_meta_data->>'clinic_code', 'CLEARMIND-CABUYAO'));
  if meta_clinic = 'CLEARMIND' then
    meta_clinic := 'CLEARMIND-CABUYAO';
  end if;

  select id into resolved_clinic from public.clinics where code = meta_clinic limit 1;

  if resolved_clinic is null then
    raise exception 'Unknown clinic_code %', meta_clinic;
  end if;

  insert into public.profiles (id, clinic_id, role, display_name, email)
  values (new.id, resolved_clinic, meta_role::user_role, meta_name, new.email);

  return new;
end;
$$;
