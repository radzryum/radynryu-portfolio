-- Landing page CMS: stores editable content for each section of the public landing page.
-- Each row is one section identified by `section_key`. The `content` JSONB column holds
-- all editable fields for that section (text, image URLs, list items, etc.).
-- `updated_by` tracks which admin last edited it.

create table if not exists landing_content (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  section_key   text not null,          -- e.g. 'hero', 'about', 'mission', 'values', 'programs', 'specialties', 'footer', 'contact'
  content       jsonb not null default '{}'::jsonb,
  updated_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (clinic_id, section_key)
);

-- Row-level security: anyone can read, only admins can write
alter table landing_content enable row level security;

create policy "Public read access for landing content"
  on landing_content for select
  using (true);

create policy "Admins can manage landing content"
  on landing_content for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.role = 'admin' or 'admin' = any(profiles.extra_roles))
        and profiles.clinic_id = landing_content.clinic_id
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.role = 'admin' or 'admin' = any(profiles.extra_roles))
        and profiles.clinic_id = landing_content.clinic_id
    )
  );

-- Seed default content for each section (JSONB with all editable fields)
-- The frontend reads these and falls back to hardcoded defaults if the table is empty.

-- Helper: we insert only if the section doesn't already exist (idempotent)
-- Run this after the table is created. In practice, the API layer handles
-- defaults, so seeding is optional. But here we provide a reference:

-- insert into landing_content (clinic_id, section_key, content) values
--   ('<clinic-uuid>', 'hero', '{"heading": "Clarity of Mind, Journey to Wellness", "subheading": "...", "cta_text": "Get Started"}'),
--   ('<clinic-uuid>', 'about', '{"heading": "Our Story & Foundation", "subheading": "...", "paragraphs": ["...", "..."]}')
-- on conflict (clinic_id, section_key) do nothing;

-- Index for fast lookups by clinic
create index if not exists idx_landing_content_clinic_section
  on landing_content (clinic_id, section_key);
