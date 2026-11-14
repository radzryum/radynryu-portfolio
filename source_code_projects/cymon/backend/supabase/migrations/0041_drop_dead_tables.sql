-- 0041_drop_dead_tables.sql
-- Drops tables whose code paths were removed:
--   survey_responses — survey feature never had a UI (no page, no nav, no callers)
--   documents        — only ever read by Clinical Records, never written to
--
-- NOTE: check for data first if either feature was ever used manually:
--   SELECT count(*) FROM public.survey_responses;
--   SELECT count(*) FROM public.documents;

DROP TABLE IF EXISTS public.survey_responses;
DROP TABLE IF EXISTS public.documents;
