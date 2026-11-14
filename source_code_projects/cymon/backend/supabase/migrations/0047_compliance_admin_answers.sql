-- 0047_compliance_admin_answers.sql
-- Let admins capture the answer/decision for compliance submissions while
-- keeping the client portal read-only.

alter table public.waiver_submissions
  add column if not exists answered_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists answered_at timestamptz,
  add column if not exists answer_notes text;
