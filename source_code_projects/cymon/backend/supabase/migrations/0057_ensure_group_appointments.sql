-- Ensure group appointment support exists in deployed databases.
-- Migration 0034 introduced this feature, but some environments were created
-- without the format column or participant table, so the admin UI could offer
-- group scheduling while the API had to reject it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'appointment_format'
  ) THEN
    CREATE TYPE public.appointment_format AS ENUM ('individual', 'group');
  END IF;
END
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS format public.appointment_format;

UPDATE public.appointments
SET format = 'individual'
WHERE format IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN format SET DEFAULT 'individual',
  ALTER COLUMN format SET NOT NULL,
  ALTER COLUMN patient_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.appointment_participants (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, patient_id)
);

CREATE INDEX IF NOT EXISTS appointment_participants_patient_idx
  ON public.appointment_participants (patient_id);

ALTER TABLE public.appointment_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_participants_select ON public.appointment_participants;
CREATE POLICY appointment_participants_select ON public.appointment_participants
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = appointment_id
        AND (
          a.practitioner_id = auth.uid()
          OR public.owns_patient(patient_id)
        )
    )
  );

DROP POLICY IF EXISTS appointment_participants_insert ON public.appointment_participants;
CREATE POLICY appointment_participants_insert ON public.appointment_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS appointment_participants_delete ON public.appointment_participants;
CREATE POLICY appointment_participants_delete ON public.appointment_participants
  FOR DELETE TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
