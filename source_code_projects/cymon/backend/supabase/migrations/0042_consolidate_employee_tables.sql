-- 0042_consolidate_employee_tables.sql
-- Merge admin_profiles + staff into profiles so all employee data lives in one place.
-- This removes the limitation where a multi-role employee could only exist in one
-- sub-table (e.g. an admin who is also a psychologist couldn't have a license_no).

-- 1. Add employee columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS license_no text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS license_id_url text;

-- 2. Migrate existing data from admin_profiles
UPDATE public.profiles p
SET
  employee_id = ap.employee_id,
  position = ap.position
FROM public.admin_profiles ap
WHERE ap.profile_id = p.id;

-- 3. Migrate existing data from staff
UPDATE public.profiles p
SET
  license_no = s.license_no,
  title = s.title,
  license_id_url = s.license_id_url
FROM public.staff s
WHERE s.profile_id = p.id;

-- 4. Repoint FK constraints from staff(profile_id) to profiles(id)
-- appointments.practitioner_id
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_practitioner_id_fkey,
  ADD CONSTRAINT appointments_practitioner_id_fkey
    FOREIGN KEY (practitioner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- clinical_profiles.treating_psychologist_id
ALTER TABLE public.clinical_profiles
  DROP CONSTRAINT IF EXISTS clinical_profiles_treating_psychologist_id_fkey,
  ADD CONSTRAINT clinical_profiles_treating_psychologist_id_fkey
    FOREIGN KEY (treating_psychologist_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- clinical_profiles.treating_psychometrician_id
ALTER TABLE public.clinical_profiles
  DROP CONSTRAINT IF EXISTS clinical_profiles_treating_psychometrician_id_fkey,
  ADD CONSTRAINT clinical_profiles_treating_psychometrician_id_fkey
    FOREIGN KEY (treating_psychometrician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Drop the now-redundant tables
DROP TABLE public.admin_profiles;
DROP TABLE public.staff;
