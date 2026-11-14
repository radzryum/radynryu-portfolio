-- 0095: voice journal — audio note on daily_activity_logs + storage bucket.
--
-- Adds optional audio_url (Supabase Storage path or signed URL) and duration
-- so students who cannot type can record feelings. Text observations stay
-- optional when audio is present (enforced in API, not DB, to keep old rows valid).

alter table public.daily_activity_logs
  add column if not exists audio_url text,
  add column if not exists audio_duration_sec integer;

-- Private bucket for voice notes. Files stored as <patient_id>/<log_date>_<ts>.webm.
insert into storage.buckets (id, name, public)
values ('journal-audio', 'journal-audio', false)
on conflict (id) do nothing;

-- Authenticated users can upload voice notes (path scoping enforced by API
-- recording only its own patient's URL after requirePatient/authorizePatient).
drop policy if exists "journal-audio insert (authenticated)" on storage.objects;
create policy "journal-audio insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journal-audio');

drop policy if exists "journal-audio read (authenticated)" on storage.objects;
create policy "journal-audio read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'journal-audio');

drop policy if exists "journal-audio delete (authenticated)" on storage.objects;
create policy "journal-audio delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'journal-audio');
