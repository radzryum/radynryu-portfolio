DO $$ BEGIN
  CREATE TYPE public.appointment_format AS ENUM ('individual', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

alter table public.appointments add column if not exists format public.appointment_format not null default 'individual';

alter table public.appointments alter column patient_id drop not null;

create table if not exists public.appointment_participants (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  primary key (appointment_id, patient_id)
);

alter table public.appointment_participants enable row level security;

drop policy if exists "appointment_participants_select" on public.appointment_participants;
create policy "appointment_participants_select" on public.appointment_participants
  for select using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id
      and (
        a.practitioner_id in (select id from public.profiles where id = auth.uid())
        or a.patient_id in (select id from public.patients where caregiver_id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      )
    )
  );

drop policy if exists "appointment_participants_insert" on public.appointment_participants;
create policy "appointment_participants_insert" on public.appointment_participants
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "appointment_participants_delete" on public.appointment_participants;
create policy "appointment_participants_delete" on public.appointment_participants
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );