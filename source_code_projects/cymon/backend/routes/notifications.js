const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res
      .status(500)
      .json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
    return false;
  }
  return true;
}

// Per-recipient, so it works for any authenticated role (client + all staff).
// The recipient_id filter (and RLS) scopes rows to the caller.
router.get('/', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const extraRoles = Array.isArray(req.profile.extra_roles) ? req.profile.extra_roles : [];
    const psychologistOnly = req.profile.role === 'psychologist' && !extraRoles.includes('admin');
    const isAdminView = ['admin', 'super_admin'].includes(req.profile.role) || extraRoles.includes('admin');
    const scopedNotifications = (query) => {
      let scopedQuery = query.eq('recipient_id', req.profile.id);

      // Document release requests are administered by admins. The old onsite
      // viewing notices can still exist in the notification history, so hide
      // both workflows from psychologist-only accounts.
      if (psychologistOnly) {
        scopedQuery = scopedQuery
          .not('title', 'ilike', 'Onsite%')
          .neq('title', 'Assessment document release requested');
      }

      // Admins announce; they don't receive. Announcement notices never count
      // toward an admin's bell or nav badges (they manage Published directly).
      if (isAdminView) {
        scopedQuery = scopedQuery.neq('type', 'announcement');
      }

      return scopedQuery;
    };

    const [{ data, error }, { count }, { data: unreadRows, error: unreadError }] = await Promise.all([
      scopedNotifications(
        supabase
          .from('notifications')
          .select('id, clinic_id, type, title, body, link, read_at, created_at'),
      )
        .order('created_at', { ascending: false })
        .limit(10),
      scopedNotifications(
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true }),
      )
        .is('read_at', null),
      scopedNotifications(
        supabase
          .from('notifications')
          .select('link')
          .is('read_at', null),
      ),
    ]);
    if (error) return next(error);
    if (unreadError) return next(unreadError);
    // Admins announce; they don't receive. Belt-and-suspenders on top of the
    // type filter above: ANY unread row pointing at an announcements page
    // (whatever its type) never counts toward an admin's bell or nav badges.
    let safeUnreadRows = unreadRows || [];
    let safeCount = count || 0;
    if (isAdminView) {
      safeUnreadRows = safeUnreadRows.filter((notification) => {
        const segments = String(notification.link || '').split('?')[0].split('/').filter(Boolean);
        return !segments.includes('announcements');
      });
      safeCount = safeUnreadRows.length;
    }
    const unreadByLink = safeUnreadRows.reduce((counts, notification) => {
      if (notification.link) counts[notification.link] = (counts[notification.link] || 0) + 1;
      return counts;
    }, {});
    const unreadByNav = safeUnreadRows.reduce((counts, notification) => {
      const pathname = String(notification.link || '').split('?')[0];
      const routeKeys = [
        ['/psychologist/intake', 'intake'],
        ['/psychometrician/intake', 'intake-interview'],
        ['/psychologist/approvals', 'approvals'],
        ['/psychologist/activity', 'daily-activity-report'],
        ['/psychologist/progress', 'monthly-assessment-report'],
        ['/psychometrician/assessments', 'assessment-services'],
        ['/psychometrician/iep', 'individualized-education-plan'],
        ['/psychometrician/activity', 'daily-activity-report'],
        ['/psychometrician/progress', 'monthly-assessment-report'],
        ['/psychometrician/attendance', 'attendance'],
        ['/admin/attendance', 'attendance'],
        ['/admin/applications', 'applications'],
      ];
      const mappedRoute = routeKeys.find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
      const segments = pathname.split('/').filter(Boolean);
      const navKey = mappedRoute?.[1] || segments[1] || segments[0];
      if (navKey) counts[navKey] = (counts[navKey] || 0) + 1;
      return counts;
    }, {});
    res.json({ notifications: data || [], unread: safeCount, unreadByLink, unreadByNav });
  } catch (err) {
    next(err);
  }
});

// Mark notifications read. Body: { ids: [...] } to mark specific ones,
// or omit ids to mark all of the caller's notifications read.
router.post('/read', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { ids } = req.body || {};
    let query = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', req.profile.id)
      .is('read_at', null);
    if (Array.isArray(ids) && ids.length) query = query.in('id', ids);
    const { error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
