-- 0043_fix_registered_students_status.sql
-- Registered students should not stay stuck in admission_form_status = 'in_progress'
-- after the final admission submit has completed.

alter table public.patients
  alter column admission_form_status set default 'complete';

update public.patients
set admission_form_status = 'complete'
where deleted_at is null
  and status = 'active'
  and admission_form_status = 'in_progress';
