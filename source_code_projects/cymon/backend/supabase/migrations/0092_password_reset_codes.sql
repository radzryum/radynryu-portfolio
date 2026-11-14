-- 0092_password_reset_codes.sql
-- DB-backed OTP store for the forgot-password flow (replaces the old
-- in-memory Map that was lost on restart / multi-instance).
-- Backend tries this table first and falls back to memory when missing.

-- ---------- password_reset_codes ----------
create table if not exists public.password_reset_codes (
  email text primary key,
  otp text not null,
  expires_at bigint not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.password_reset_codes enable row level security;

-- Service role bypasses RLS; block direct user access explicitly.
drop policy if exists password_reset_codes_none on public.password_reset_codes;
create policy password_reset_codes_none on public.password_reset_codes
  for all to authenticated
  using (false)
  with check (false);
