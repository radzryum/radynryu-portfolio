-- Add optional employee target to announcements

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS announcements_employee_id_idx
  ON public.announcements (employee_id);
