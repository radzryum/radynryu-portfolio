-- 0105_attendance_finalize.sql
-- Month finalize/lock for attendance & session records (CMPS:SE-FO-11).
--
-- Daily updates only add rows, so a month stays editable until someone
-- explicitly finalizes it. Finalizing requires the facilitator signature
-- (once per month, at the end — matching the paper workflow). While
-- finalized, saves and deletes are rejected server-side; reopening clears
-- the flag. Existing months default to open (is_finalized = false).

alter table public.student_attendance_session_forms
  add column if not exists is_finalized boolean not null default false;

alter table public.student_attendance_session_forms
  add column if not exists finalized_at timestamptz;
