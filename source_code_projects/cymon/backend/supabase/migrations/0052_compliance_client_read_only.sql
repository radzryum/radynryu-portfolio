-- Compliance forms are completed by clinic administrators. Clients may only
-- read the forms that belong to their own patient record.

drop policy if exists waiver_submissions_caregiver_rw on public.waiver_submissions;
drop policy if exists waiver_submissions_caregiver_select on public.waiver_submissions;

create policy waiver_submissions_caregiver_select on public.waiver_submissions
  for select to authenticated
  using (public.owns_patient(patient_id));
