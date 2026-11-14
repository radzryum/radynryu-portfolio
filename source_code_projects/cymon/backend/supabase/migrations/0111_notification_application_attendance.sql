-- Add the 'application' + 'attendance' notification types used by the public
-- admission form (admin bell on new guardian submission) and the attendance
-- session workflow. Without them, createNotification silently failed (invalid
-- enum value), so admins were never notified of new applications.
--
-- Re-runnable: IF NOT EXISTS skips when already present.

alter type public.notification_type add value if not exists 'application';
alter type public.notification_type add value if not exists 'attendance';
