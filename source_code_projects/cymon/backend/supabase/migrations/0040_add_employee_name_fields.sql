-- 0040_add_employee_name_fields.sql
-- Add individual name columns to profiles and license ID photo column to staff.

-- profiles: structured name (first, middle, last)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- staff: professional license ID photo URL
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS license_id_url text;
