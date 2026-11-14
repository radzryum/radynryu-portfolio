-- 0113: link notifications to the record they are about (phase 1 of stale
-- notification cleanup). The admission-application bell ("New admission
-- application") had no reference to its application row, so when a branch
-- admin imported/rejected it, every other recipient's notification stayed
-- unread forever — clicking it landed on an empty Pending tab.
--
-- With entity_type/entity_id, resolving the underlying record can
-- auto-mark its notifications read for ALL recipients (branch admins +
-- Super Admins), and the bell link can deep-link straight to the record.
--
-- Re-runnable: columns + index are added only when missing.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications'
      and column_name = 'entity_type'
  ) then
    alter table public.notifications add column entity_type text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications'
      and column_name = 'entity_id'
  ) then
    alter table public.notifications add column entity_id uuid;
  end if;
end
$$;

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id)
  where entity_id is not null;
