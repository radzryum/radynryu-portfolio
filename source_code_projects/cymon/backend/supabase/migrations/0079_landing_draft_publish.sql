-- Landing CMS draft/publish split.
-- The Content Manager needs Save (draft, not yet live) and Publish (goes live)
-- to be distinct. We model this by letting each section have up to two rows:
--   published = false  -> a draft not yet shown to visitors
--   published = true   -> the content currently live on the landing page
--
-- The public landing endpoint reads only published rows; the admin editor
-- reads the draft (falling back to the published row as its baseline).

-- Add the flag identifying live vs draft content.
alter table landing_content
  add column if not exists published boolean not null default false;

-- A section can now have one draft AND one published row.
alter table landing_content
  drop constraint if exists landing_content_clinic_id_section_key_key;

create unique index if not exists landing_content_clinic_section_published_key
  on landing_content (clinic_id, section_key, published);

-- Existing content was, by definition, live before this feature. Backfill it as
-- published so the landing page keeps showing it after the public endpoint starts
-- filtering on the flag.
update public.landing_content
set published = true
where published = false;

-- Index used by public reads (published rows for a clinic).
create index if not exists idx_landing_content_clinic_published
  on landing_content (clinic_id, published, section_key);
