-- 0114_profile_clinics.sql
-- One email, many branches: lets a single staff account work in more than
-- one clinic. profiles.clinic_id stays the home branch; this junction holds
-- every additional branch the account may act in (via the x-active-branch
-- header, which re-scopes the request to that branch server-side).
-- Backfills one row per existing profile so current access is unchanged.

-- ---------- profile_clinics junction ----------

create table if not exists public.profile_clinics (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, clinic_id)
);

create index if not exists profile_clinics_clinic_idx
  on public.profile_clinics (clinic_id);

-- Backfill: every profile keeps access to its home branch.
insert into public.profile_clinics (profile_id, clinic_id)
select id, clinic_id from public.profiles
where clinic_id is not null
on conflict (profile_id, clinic_id) do nothing;
