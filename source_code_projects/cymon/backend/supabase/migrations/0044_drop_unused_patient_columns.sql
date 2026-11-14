-- Drop legacy patient columns that are no longer part of the app flow.
-- These fields were only being carried as null/unused payload values and
-- have been removed from the backend/frontend write paths.

alter table public.patients
  drop column if exists name_suffix,
  drop column if exists nationality,
  drop column if exists preferred_language,
  drop column if exists school,
  drop column if exists grade_level,
  drop column if exists delivery_method,
  drop column if exists force_password_change;
