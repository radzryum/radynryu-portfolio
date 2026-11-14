-- Store whether an admin has completed the first-run dashboard tour.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_onboarding_completed_at timestamptz;

NOTIFY pgrst, 'reload schema';
