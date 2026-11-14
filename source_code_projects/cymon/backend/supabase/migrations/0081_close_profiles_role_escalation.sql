-- Close the self-role-escalation hole.
--
-- The original profiles_update_self policy let any authenticated user UPDATE
-- their own row with only `using/with check (id = auth.uid())`. Since the anon
-- key ships in the frontend bundle, a logged-in client could directly hit the
-- Supabase API and set role='admin', extra_roles, or clinic_id on their own
-- profile — escalating to admin. Because is_admin() and the rest of RLS read
-- profiles.role, this also poisoned every downstream check.
--
-- Fix: self updates may only touch non-privileged fields. role, extra_roles,
-- clinic_id and deleted_at must stay identical to the current row.

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and extra_roles is not distinct from
        (select extra_roles from public.profiles where id = auth.uid())
    and clinic_id is not distinct from
        (select clinic_id from public.profiles where id = auth.uid())
    and deleted_at is not distinct from
        (select deleted_at from public.profiles where id = auth.uid())
  );
