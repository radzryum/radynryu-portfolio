-- 0096: wet-signature admission scans — proof upload + private bucket.
--
-- The Student Admission Form offers a wet-signature path: staff print the
-- blank form, collect ink signatures on paper, and upload the scan before
-- the account is created. The scan path lives on patients.admission_scan_url
-- (null = e-signature path). Enforcement is in the API, not the DB, so old
-- rows stay valid.

alter table public.patients
  add column if not exists admission_scan_url text;

-- Private bucket for admission scans. Files stored as admissions/<uuid>.<ext>.
insert into storage.buckets (id, name, public)
values ('admission-scans', 'admission-scans', false)
on conflict (id) do nothing;

-- No storage policies on purpose: browsers never touch this bucket directly.
-- Uploads flow through the backend service-role client (see
-- POST /api/admin/admission-scan-upload), which validates type, size, and
-- the staff role before writing.
