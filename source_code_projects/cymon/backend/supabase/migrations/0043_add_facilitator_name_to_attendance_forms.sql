-- Add facilitator name to FO-11 attendance/session forms

ALTER TABLE student_attendance_session_forms
  ADD COLUMN IF NOT EXISTS facilitator_name TEXT;
