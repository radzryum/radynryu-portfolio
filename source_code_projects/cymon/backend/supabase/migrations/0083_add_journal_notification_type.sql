-- Add the 'journal' notification type used when journal access is granted or
-- locked for a client. Without it, createNotification for journal permission
-- changes silently failed (invalid enum value), so clients were never notified.

alter type public.notification_type add value if not exists 'journal';
