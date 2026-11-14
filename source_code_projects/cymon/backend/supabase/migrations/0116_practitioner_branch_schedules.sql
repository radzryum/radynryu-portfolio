-- 0116_practitioner_branch_schedules.sql
-- Weekly branch schedules for clinicians (e.g. Dr. Cruz is in Cabuyao on
-- Mon/Wed and in Alabang on Tue/Thu). The Front Desk uses these to suggest
-- — and pre-select — the booking branch from the practitioner's weekday,
-- so a student's clinic location follows the clinician's schedule instead
-- of being picked by hand every time.
-- day_of_week follows JS Date.getDay(): 0 = Sunday … 6 = Saturday.

-- ---------- practitioner_branch_schedules ----------

create table if not exists public.practitioner_branch_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  created_at timestamptz not null default now(),
  unique (profile_id, clinic_id, day_of_week, start_time)
);

create index if not exists practitioner_branch_schedules_profile_idx
  on public.practitioner_branch_schedules (profile_id);

create index if not exists practitioner_branch_schedules_lookup_idx
  on public.practitioner_branch_schedules (profile_id, day_of_week);
