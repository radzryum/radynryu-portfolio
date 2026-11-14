-- Ensure FO-11 attendance forms retain the facilitator's printed name.
-- Migration 0043 introduced this field, but some deployed databases skipped
-- it, causing the API compatibility fallback to discard the submitted name.
ALTER TABLE public.student_attendance_session_forms
  ADD COLUMN IF NOT EXISTS facilitator_name text;

NOTIFY pgrst, 'reload schema';
