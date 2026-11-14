-- Track who last edited an intake interview (psychologist or
-- psychometrician) and which fields they touched, so both clinicians can
-- see who changed what. `prepared_by_id` keeps the original author.

ALTER TABLE public.intake_interviews
  ADD COLUMN IF NOT EXISTS updated_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.intake_interviews
  ADD COLUMN IF NOT EXISTS field_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
