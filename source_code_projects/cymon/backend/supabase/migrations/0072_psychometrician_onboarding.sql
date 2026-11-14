-- Store whether a psychometrician has completed the first-run dashboard tour.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS psychometrician_onboarding_completed_at timestamptz;

NOTIFY pgrst, 'reload schema';
