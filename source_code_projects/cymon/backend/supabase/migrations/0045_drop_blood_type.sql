-- Blood type is no longer part of the student admission/profile flow.
-- Remove it from the patients table so the schema matches the UI and API.

alter table public.patients
  drop column if exists blood_type;
