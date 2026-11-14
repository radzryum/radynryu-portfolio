-- 0101_audit_log_device_location.sql
-- Capture where a session event came from: device, IP, and approximate
-- city/country. Only login/logout entries carry these (the sign-in moments
-- that matter for "may ibang nagbukas ba ng account ko?"); older rows and
-- non-session actions simply keep NULLs.

-- ---------- audit_log session context ----------
-- ip_address: raw client IP as seen by the API (x-forwarded-for aware).
-- user_agent: raw User-Agent header, kept for forensics.
-- device_label: short human label parsed at write time
--   (e.g. "Chrome · Windows", "Safari · iPhone").
-- city / country: best-effort IP geolocation, NULL when the lookup fails.
-- All nullable so pre-existing rows and non-session actions stay valid.

alter table public.audit_log
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device_label text,
  add column if not exists city text,
  add column if not exists country text;
