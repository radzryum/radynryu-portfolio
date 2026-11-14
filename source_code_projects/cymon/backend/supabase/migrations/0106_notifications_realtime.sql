-- 0106: realtime push for the header bell (phase 2 of notification freshness).
--
-- Polling (60s) + refetch-on-open stays as the fallback, but new rows should
-- arrive instantly. Supabase Realtime only broadcasts tables in the
-- supabase_realtime publication, and only INSERTs are consumed (the bell
-- refetches the list on every event, so the default replica identity is
-- enough — no REPLICA IDENTITY FULL needed).
--
-- Re-runnable: skips when the table is already a member.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
