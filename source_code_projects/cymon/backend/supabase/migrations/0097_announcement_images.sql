-- Allow announcements to carry multiple promotional images for slideshows.
-- `image_url` stays as the primary/cover image for backward compatibility.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Backfill: announcements that already have a cover image get it as the
-- first slideshow entry.
UPDATE public.announcements
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_urls = '{}';
