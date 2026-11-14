-- 0102_admission_applications.sql
-- Public admission applications submitted by guardians through the QR/link
-- form (no account needed). Staff review each entry and import it into the
-- full Student Admission Form; the application itself never becomes a
-- patient record until a staff member submits that form.

-- ---------- admission_applications ----------
-- payload mirrors the admin patient-detail shape ({patient, clinical,
-- guardians[], emergency}) so it can prefill StudentAdmissionForm via its
-- existing `initialDetail` prop with no mapping layer.
-- parent_signature/printed_name are top-level: only the parent signs on the
-- public form (the CMPS representative signs later on the staff side).

create table public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'rejected')),
  payload jsonb not null,
  parent_signature text,
  parent_printed_name text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create index admission_applications_clinic_status_idx
  on public.admission_applications (clinic_id, status, created_at desc);

-- Service-role only (same as audit_log): the backends reads/writes with the
-- service key, so no user-context policies are installed.
alter table public.admission_applications enable row level security;
