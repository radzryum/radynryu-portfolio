-- 0086_add_compliance_review_return.sql
-- Let an admin return a client-submitted compliance/waiver form back to the
-- client with a comment describing what needs to change. The client sees the
-- comment, edits the form, and re-submits.

-- Extend the compliance_status enum with a 'returned' value.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'compliance_status' and e.enumlabel = 'returned'
  ) then
    alter type public.compliance_status add value 'returned';
  end if;
end
$$;

-- Store the admin's comment explaining what the client should change.
alter table public.waiver_submissions
  add column if not exists review_comment text;
