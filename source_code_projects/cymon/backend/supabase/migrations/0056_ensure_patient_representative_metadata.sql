-- Ensure representative metadata exists on patients.
--
-- Migration 0043 introduced these fields, but some deployed databases have
-- already recorded that migration without actually exposing all of the
-- columns through PostgREST. Keep this repair idempotent so it is safe to run
-- against both older and newer CyMon databases.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS rep_printed_name text,
  ADD COLUMN IF NOT EXISTS rep_profession text,
  ADD COLUMN IF NOT EXISTS rep_license_no text;

-- Refresh PostgREST's schema cache immediately after the DDL change.
NOTIFY pgrst, 'reload schema';
