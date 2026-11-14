-- 0115_profile_disabled_roles.sql
-- Per-role deactivation: disabling one role (e.g. psychometrician) must not
-- lock the account's other roles (e.g. psychologist). disabled_roles holds
-- the roles that are switched off; requireAuth subtracts them from the
-- effective roles, and sign-in is blocked only when every role is off
-- (or deleted_at is set, the existing full-deactivation path).
-- Re-runnable: column is added only when missing.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'disabled_roles'
  ) then
    alter table public.profiles
      add column disabled_roles text[] not null default '{}';
  end if;
end
$$;
