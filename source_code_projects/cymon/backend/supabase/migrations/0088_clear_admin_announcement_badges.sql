-- Migration 0088: Clear stale announcement bell badges for admins
-- Admins manage the Published list itself, so broadcast announcements no longer
-- notify them (see resolveAnnouncementRecipients). Mark any existing unread
-- announcement notifications for admin-role accounts as read so the badge
-- clears; the announcements themselves remain visible in the dashboard.

update public.notifications
set read_at = now()
where type = 'announcement'
  and read_at is null
  and recipient_id in (
    select id from public.profiles where role in ('admin', 'super_admin')
  );

notify pgrst, 'reload schema';
