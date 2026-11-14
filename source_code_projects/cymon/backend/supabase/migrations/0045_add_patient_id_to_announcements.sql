-- Add optional patient target to announcements

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS announcements_patient_id_idx
  ON public.announcements (patient_id);
