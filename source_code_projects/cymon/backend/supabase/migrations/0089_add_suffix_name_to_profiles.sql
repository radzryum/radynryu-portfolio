-- 0089_add_suffix_name_to_profiles.sql
-- Adds profiles.suffix_name so employee name suffixes (Jr, Sr, III, custom
-- "Others" values) persist and render in display names. Run once in the
-- Supabase SQL editor; backend code falls back gracefully until applied.

-- ---------- profiles ----------
alter table public.profiles add column if not exists suffix_name text;
