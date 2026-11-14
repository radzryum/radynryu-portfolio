-- 0109: publish UI-facing tables to Supabase Realtime (phase 3: realtime
-- everywhere). The frontend refetches its own lists on change events, so
-- only INSERT/UPDATE/DELETE delivery matters — RLS SELECT policies gate
-- every event (see 0108 for the gaps this unblocked).
--
-- Tables covered: the bell (notifications, done in 0106), rosters/schedules
-- (patients, appointments + participants), assessment flow (assignments,
-- submissions, reports), session/attendance records, announcements,
-- document releases, waivers, journals, and staff coordination tables
-- (permissions, activation requests, interventions, intake).
--
-- Re-runnable: each table is added only when not already a member.

do $$
declare
  t text;
begin
  foreach t in array array[
    'notifications',
    'patients',
    'admission_applications',
    'appointments',
    'appointment_participants',
    'assessment_assignments',
    'assessment_submissions',
    'assessment_reports',
    'assessment_permissions',
    'assessment_activation_requests',
    'assessment_document_release_requests',
    'assessment_document_release_items',
    'session_logs',
    'daily_activity_logs',
    'student_attendance_records',
    'student_attendance_session_forms',
    'student_session_records',
    'announcements',
    'waiver_submissions',
    'interventions',
    'mainstreaming_assessments',
    'intake_interviews'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
