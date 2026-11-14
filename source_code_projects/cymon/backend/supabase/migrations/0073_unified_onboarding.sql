-- Store onboarding completion once per user instead of once per role.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS psychologist_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS psychometrician_onboarding_completed_at timestamptz;

UPDATE public.profiles
SET onboarding_completed_at = COALESCE(
  onboarding_completed_at,
  admin_onboarding_completed_at,
  psychologist_onboarding_completed_at,
  psychometrician_onboarding_completed_at
)
WHERE onboarding_completed_at IS NULL;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS admin_onboarding_completed_at,
  DROP COLUMN IF EXISTS psychologist_onboarding_completed_at,
  DROP COLUMN IF EXISTS psychometrician_onboarding_completed_at;

NOTIFY pgrst, 'reload schema';
