-- 0091_intake_interviews.sql
-- Clinical intake interview (FS-IT-01): the first assessment an MHP records
-- before treatment begins. One record per student (upserted); the psychologist
-- owns it, the assigned psychometrician reads it, parents never see it.

create table public.intake_interviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  interview_date date,
  informant text,
  concerns text,
  onset text,
  background text,
  developmental text,
  medical text,
  family text,
  observations text,
  prepared_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intake_interviews_patient_idx on public.intake_interviews (patient_id);

create trigger intake_interviews_set_updated_at
  before update on public.intake_interviews
  for each row execute function public.set_updated_at();
