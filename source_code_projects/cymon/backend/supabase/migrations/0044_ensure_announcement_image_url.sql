-- Ensure announcements can store a promotional image URL

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_url text;
