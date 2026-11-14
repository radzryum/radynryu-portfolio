-- Reconcile the app's super_admin role check with the DB enum.
-- Backend code (routes/admin.js, routes/auth.js) already checks for
-- 'super_admin', but the user_role enum never declared it, so the elevated
-- path was unreachable. Add the value so super_admin actually works.

alter type public.user_role add value if not exists 'super_admin';
