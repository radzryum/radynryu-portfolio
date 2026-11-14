-- Scope attendance/session RLS to clinicians and admins.
--
-- 0028 enabled RLS on the three attendance/session tables but used blanket
-- `USING (true) / WITH CHECK (true)` for every verb, exposing all patients'
-- attendance and session records to any authenticated user via the anon key.
--
-- Fix: SELECT is allowed to admins, clinical staff (psychologist,
-- psychometrician, occupational_therapist, speech_therapist), and the
-- caregiver who owns the student. INSERT/UPDATE/DELETE are admin/clinical-staff
-- only.

-- student_attendance_session_forms carries patient_id directly.
drop policy if exists "Allow authenticated read on forms" on public.student_attendance_session_forms;
drop policy if exists "Allow authenticated insert on forms" on public.student_attendance_session_forms;
drop policy if exists "Allow authenticated update on forms" on public.student_attendance_session_forms;

create policy "forms select" on public.student_attendance_session_forms
  for select to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
    or public.owns_patient(patient_id)
  );

create policy "forms insert" on public.student_attendance_session_forms
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

create policy "forms update" on public.student_attendance_session_forms
  for update to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

-- student_attendance_records / student_session_records reach the patient via
-- their form row.
drop policy if exists "Allow authenticated read on attendance" on public.student_attendance_records;
drop policy if exists "Allow authenticated insert on attendance" on public.student_attendance_records;
drop policy if exists "Allow authenticated update on attendance" on public.student_attendance_records;
drop policy if exists "Allow authenticated delete on attendance" on public.student_attendance_records;

create policy "attendance select" on public.student_attendance_records
  for select to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
    or exists (
      select 1 from public.student_attendance_session_forms f
      where f.id = form_id and public.owns_patient(f.patient_id)
    )
  );

create policy "attendance insert" on public.student_attendance_records
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

create policy "attendance update" on public.student_attendance_records
  for update to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

create policy "attendance delete" on public.student_attendance_records
  for delete to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

drop policy if exists "Allow authenticated read on sessions" on public.student_session_records;
drop policy if exists "Allow authenticated insert on sessions" on public.student_session_records;
drop policy if exists "Allow authenticated update on sessions" on public.student_session_records;
drop policy if exists "Allow authenticated delete on sessions" on public.student_session_records;

create policy "sessions select" on public.student_session_records
  for select to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
    or exists (
      select 1 from public.student_attendance_session_forms f
      where f.id = form_id and public.owns_patient(f.patient_id)
    )
  );

create policy "sessions insert" on public.student_session_records
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

create policy "sessions update" on public.student_session_records
  for update to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );

create policy "sessions delete" on public.student_session_records
  for delete to authenticated
  using (
    public.is_admin()
    or public.current_role() in ('psychologist','psychometrician','occupational_therapist','speech_therapist')
  );
