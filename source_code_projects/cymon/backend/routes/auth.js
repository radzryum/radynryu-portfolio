const express = require('express');
const { supabase, authClient, supabaseConfigured } = require('../lib/supabase');
const { writeAudit } = require('../lib/audit');
const { capitalizeNamePart } = require('../lib/names');
const { getSessionContext } = require('../lib/sessionContext');
const requireAuth = require('../middleware/requireAuth');
const { sendMail } = require('../lib/email');
const { validatePassword } = require('../lib/password');

// ─── OTP Store (DB-backed with in-memory fallback) ──────────────────────────
// Primary: `password_reset_codes` table (survives restarts / multi-instance).
// Fallback: in-memory Map when the table/migration isn't applied yet.
// Apply in Supabase SQL editor:
//   create table if not exists password_reset_codes (
//     email text primary key,
//     otp text not null,
//     expires_at bigint not null,
//     verified boolean not null default false,
//     created_at timestamptz not null default now()
//   );
const otpMemory = new Map(); // email → { otp, expiresAt, verified }

async function otpGet(email) {
  const key = String(email || '').toLowerCase();
  try {
    const { data, error } = await supabase
      .from('password_reset_codes')
      .select('otp, expires_at, verified')
      .eq('email', key)
      .maybeSingle();
    if (!error && data) {
      return { otp: data.otp, expiresAt: Number(data.expires_at), verified: !!data.verified, fromDb: true };
    }
  } catch {
    // Table missing / offline — fall through to memory.
  }
  const mem = otpMemory.get(key);
  return mem ? { ...mem, fromDb: false } : null;
}

async function otpSet(email, record) {
  const key = String(email || '').toLowerCase();
  otpMemory.set(key, { otp: record.otp, expiresAt: record.expiresAt, verified: !!record.verified });
  try {
    await supabase.from('password_reset_codes').upsert({
      email: key,
      otp: record.otp,
      expires_at: record.expiresAt,
      verified: !!record.verified,
    }, { onConflict: 'email' });
  } catch {
    // Migration not applied yet — memory fallback already set.
  }
}

async function otpDelete(email) {
  const key = String(email || '').toLowerCase();
  otpMemory.delete(key);
  try {
    await supabase.from('password_reset_codes').delete().eq('email', key);
  } catch {
    // Ignore — memory already cleared.
  }
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const router = express.Router();

// In-memory rate limiter (per-instance). On Vercel/serverless each instance
// tracks its own window — still blocks single-source brute force; a shared
// store (Redis/Upstash) can replace this map later without changing call sites.
const rateBuckets = new Map(); // key -> { count, resetAt }
function hitRateLimit(key, max, windowMs) {
  const now = Date.now();
  const cur = rateBuckets.get(key);
  if (!cur || now > cur.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1 };
  }
  cur.count += 1;
  if (cur.count > max) {
    return { limited: true, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { limited: false, remaining: max - cur.count };
}
function rateLimit({ keyOf, max, windowMs, message }) {
  return (req, res, next) => {
    const key = keyOf(req);
    const hit = hitRateLimit(key, max, windowMs);
    if (hit.limited) {
      res.set('Retry-After', String(hit.retryAfterSec));
      return res.status(429).json({ error: message || 'Too many attempts. Please try again later.' });
    }
    next();
  };
}
const loginLimiter = rateLimit({
  keyOf: (req) => `login:${req.ip}:${String(req.body?.email || '').toLowerCase().slice(0, 120)}`,
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Too many sign-in attempts. Please try again in 15 minutes.',
});
const otpSendLimiter = rateLimit({
  keyOf: (req) => `otp-send:${req.ip}:${String(req.body?.email || '').toLowerCase().slice(0, 120)}`,
  max: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many code requests. Please try again later.',
});
const otpVerifyLimiter = rateLimit({
  keyOf: (req) => `otp-verify:${req.ip}:${String(req.body?.email || '').toLowerCase().slice(0, 120)}`,
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Too many code attempts. Please request a new code later.',
});
const MAX = {
  displayName: 50,
  phone: 13,
  password: 64,
}
const PH_MOBILE_RE = /^09\d{9}$/

const formatPHMobile = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = `0${digits.slice(2)}`
  digits = digits.slice(0, 11)
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ')
}

const normalizePHMobile = (raw) => String(raw || '').replace(/\D/g, '').replace(/^63/, '0')

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res
      .status(500)
      .json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
    return false;
  }
  return true;
}

async function loadProfile(userId) {
  const base = 'id, role, display_name, email, clinic_id, phone, first_name, middle_name, last_name, employee_id, position, license_no, title, avatar_url, license_id_url';
  // extra_roles is added by migration 0017 — fall back if it isn't applied yet
  let { data, error } = await supabase
    .from('profiles')
    .select(`${base}, extra_roles, onboarding_completed_at`)
    .eq('id', userId)
    .is('deleted_at', null)
    .single();
  if (error) {
    ({ data, error } = await supabase
      .from('profiles')
      .select(`${base}, extra_roles, admin_onboarding_completed_at, psychologist_onboarding_completed_at, psychometrician_onboarding_completed_at`)
      .eq('id', userId)
      .is('deleted_at', null)
      .single());
  }
  if (error) {
    ({ data, error } = await supabase
      .from('profiles')
      .select(`${base}, extra_roles`)
      .eq('id', userId)
      .is('deleted_at', null)
      .single());
  }
  if (error) {
    ({ data, error } = await supabase.from('profiles').select(base).eq('id', userId).is('deleted_at', null).single());
  }
  if (error) return null;
  return {
    ...data,
    extra_roles: data.extra_roles || [],
    onboarding_completed_at: data.onboarding_completed_at
      || data.admin_onboarding_completed_at
      || data.psychologist_onboarding_completed_at
      || data.psychometrician_onboarding_completed_at
      || null,
  };
}

router.post('/signup', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email, password, displayName, clinicCode } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Self-registration always creates a client. Elevated roles are assigned by
    // an admin afterwards — never trusted from the request body.
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'client',
          display_name: displayName || email.split('@')[0],
          ...(clinicCode ? { clinic_code: clinicCode } : {}),
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const profile = data.user ? await loadProfile(data.user.id) : null;

    return res.status(201).json({
      session: data.session,
      user: data.user,
      profile,
      emailConfirmationRequired: !data.session,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let loginEmail = email;
    if (!email.includes('@')) {
      const lookupId = email.trim().toUpperCase();
      // Try resolving as student/patient ID (case-insensitive: stored IDs
      // are not guaranteed to be uppercase, but the lookup is normalized).
      const { data: patientData } = await supabase
        .from('patients')
        .select('caregiver_id, photo_url')
        .ilike('patient_id', lookupId)
        .is('deleted_at', null)
        .maybeSingle();

      if (patientData && patientData.caregiver_id) {
        const { data: caregiverProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', patientData.caregiver_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (caregiverProfile && caregiverProfile.email) {
          loginEmail = caregiverProfile.email;
        }
      } else {
        // Try resolving as employee ID (case-insensitive for the same reason).
        const { data: employeeProfile } = await supabase
          .from('profiles')
          .select('email')
          .ilike('employee_id', lookupId)
          .is('deleted_at', null)
          .maybeSingle();

        if (employeeProfile && employeeProfile.email) {
          loginEmail = employeeProfile.email;
        }
      }

      if (loginEmail === email) {
        return res.status(401).json({ error: 'Invalid Account Number or ID.' });
      }
    }

    const { data, error } = await authClient.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      // Failed sign-in is a security event: attribute it when the account
      // exists so brute-force patterns stay visible in the audit trail.
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, clinic_id, display_name')
          .ilike('email', loginEmail)
          .maybeSingle();
        if (existing?.clinic_id) {
          const sessionCtx = await getSessionContext(req);
          await writeAudit({
            clinicId: existing.clinic_id,
            actorId: existing.id,
            action: 'failed_login',
            entityType: 'session',
            entityId: existing.id,
            summary: `Failed sign-in attempt for ${existing.display_name || loginEmail}.`,
            severity: 'warn',
            ...sessionCtx,
          });
        }
      } catch {
        // Audit must never block the auth response.
      }
      return res.status(401).json({ error: error.message });
    }

    const profile = await loadProfile(data.user.id);
    if (!profile) {
      return res.status(401).json({ error: 'Profile not found for this account' });
    }

    if (profile.role === 'client' && profile.onboarding_completed_at) {
      const { data: pt } = await supabase
        .from('patients')
        .select('id')
        .eq('caregiver_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (!pt) {
        return res.status(401).json({ error: 'This account has been deactivated because the enrolled student was removed.' });
      }
    }

    // Successful sign-ins are audit events (Obj 2.6). Awaited so serverless
    // runtimes flush the insert; a logging failure still returns the session.
    // Session context (device/IP/location) is best-effort and never blocks.
    const sessionCtx = await getSessionContext(req);
    const where = [sessionCtx.city, sessionCtx.country].filter(Boolean).join(', ');
    await writeAudit({
      clinicId: profile.clinic_id,
      actorId: profile.id,
      action: 'login',
      entityType: 'session',
      entityId: profile.id,
      summary: `${capitalizeNamePart(profile.display_name) || profile.email || 'A user'} signed in${sessionCtx.deviceLabel ? ` on ${sessionCtx.deviceLabel}` : ''}${where ? ` from ${where}` : ''}.`,
      ...sessionCtx,
    });

    return res.json({ session: data.session, user: data.user, profile });
  } catch (err) {
    next(err);
  }
});

// Best-effort sign-out beacon. The client clears its own session locally, so
// without this call a logout would leave no trace; the frontend fires it
// fire-and-forget and ignores failures.
router.post('/logout', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'logout',
      entityType: 'session',
      entityId: req.profile.id,
      summary: `${capitalizeNamePart(req.profile.display_name) || req.profile.email || 'A user'} signed out.`,
      ...(await getSessionContext(req)),
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

// Branches the caller may act in — the branch switcher. Any authenticated
// role may call it. A Super Admin administers every branch, so they always
// get the full list (home + granted via profile_clinics, migration 0114,
// for everyone else).
router.get('/my-clinics', requireAuth, async (req, res, next) => {
  try {
    const home = req.profile.home_clinic_id || req.profile.clinic_id;
    if (req.profile?.role === 'super_admin') {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, code, name, address')
        .order('code', { ascending: true });
      if (error) return next(error);
      return res.json({
        clinics: (data || []).map((c) => ({ ...c, is_primary: c.id === home })),
        active_branch_id: req.profile.active_branch_id || home,
      });
    }
    const ids = Array.isArray(req.profile?.branch_ids) && req.profile.branch_ids.length
      ? [...new Set(req.profile.branch_ids.filter(Boolean))]
      : [req.profile?.clinic_id].filter(Boolean);
    if (!ids.length) return res.json({ clinics: [] });
    const { data, error } = await supabase
      .from('clinics')
      .select('id, code, name, address')
      .in('id', ids)
      .order('code', { ascending: true });
    if (error) return next(error);
    res.json({
      clinics: (data || []).map((c) => ({ ...c, is_primary: c.id === home })),
      active_branch_id: req.profile.active_branch_id || home,
    });
  } catch (err) {
    next(err);
  }
});

// Self-service activity history for client / psychologist / psychometrician.
// Same audit_log ledger the admin trail reads, but scoped to the caller's own
// actor_id so non-admin users can see what they did, where, and when.
// Window: last 30 days. Explicit field whitelist — never spread DB rows.
router.get('/my-activity', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, summary, severity, created_at, ip_address, device_label, city, country')
      .eq('clinic_id', req.profile.clinic_id)
      .eq('actor_id', req.profile.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      // Migration 0101 not applied yet: fall back to the pre-existing columns.
      if (/ip_address|device_label|city|country/.test(error.message || '')) {
        const { data: legacyRows, error: legacyError } = await supabase
          .from('audit_log')
          .select('id, action, entity_type, entity_id, summary, severity, created_at')
          .eq('clinic_id', req.profile.clinic_id)
          .eq('actor_id', req.profile.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (legacyError) return next(legacyError);
        return res.json({
          logs: (legacyRows || []).map((l) => ({
            id: l.id,
            created_at: l.created_at,
            action: l.action,
            entity_type: l.entity_type,
            entity_id: l.entity_id,
            summary: l.summary,
            severity: l.severity,
            ip_address: null,
            device_label: null,
            city: null,
            country: null,
          })),
        });
      }
      return next(error);
    }
    res.json({
      logs: (rows || []).map((l) => ({
        id: l.id,
        created_at: l.created_at,
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        summary: l.summary,
        severity: l.severity,
        ip_address: l.ip_address,
        device_label: l.device_label,
        city: l.city,
        country: l.country,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/staff-directory', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const mine = [req.profile.role, ...(req.profile.extra_roles || [])]
    const allowed = ['admin', 'super_admin', 'psychologist', 'psychometrician']
    if (!mine.some((role) => allowed.includes(role))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, extra_roles, title, license_no, employee_id, position, clinic_id')
      .eq('clinic_id', req.profile.clinic_id)
      .order('display_name', { ascending: true })

    if (error) return next(error)

    const rows = (data || []).filter((row) => {
      const roles = [row.role, ...(row.extra_roles || [])]
      return roles.some((role) => allowed.includes(role))
    })

    res.json({ employees: rows })
  } catch (err) {
    next(err)
  }
})

const uploadImage = async (dataUrl, prefix) => {
  const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const [, mime, ext, b64] = m;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');
  const filename = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const { data, error } = await supabase.storage.from('photos').upload(filename, buf, { contentType: mime, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data: pubData } = supabase.storage.from('photos').getPublicUrl(data.path);
  return pubData.publicUrl;
};

router.put('/profile', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { displayName, phone, avatar, licenseId } = req.body || {};
    // Display names are identity data: primary admins and super admins may
    // change them. Gated on the primary role to match the edit-profile UI,
    // so staff never see a field they can't save.
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin';
    const cleanPhone = String(phone ?? '').trim()
    const phoneDigits = normalizePHMobile(cleanPhone)

    if (cleanPhone && !PH_MOBILE_RE.test(phoneDigits)) {
      return res.status(400).json({ error: 'Phone must be a valid Philippine mobile number' });
    }

    const profileUpdates = {};

    // Only admins may change a display name
    if (displayName !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only administrators can change a display name.' });
      }
      const cleanDisplayName = String(displayName).trim();
      if (!cleanDisplayName) {
        return res.status(400).json({ error: 'Display name is required' });
      }
      if (cleanDisplayName.length > MAX.displayName) {
        return res.status(400).json({ error: `Display name must be ${MAX.displayName} characters or fewer` });
      }
      profileUpdates.display_name = cleanDisplayName;
    }

    if (phone !== undefined) {
      profileUpdates.phone = cleanPhone ? formatPHMobile(cleanPhone) : null;
    }
    if (avatar) {
      profileUpdates.avatar_url = await uploadImage(avatar, 'avatars');
    }
    // Staff may replace their own Professional Licensed ID photo; the admin
    // Employees view reads the same profiles row, so it updates there too.
    if (licenseId) {
      profileUpdates.license_id_url = await uploadImage(licenseId, 'license-ids');
    }

    if (Object.keys(profileUpdates).length === 0) {
      return res.json({ profile: req.profile });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ profile: data });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError.replace(/^Password/, 'New password') });
    }
    // verify the current password before changing it
    const { error: verifyError } = await authClient.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password: newPassword });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'change_own_password',
      entityType: 'user_account',
      entityId: req.profile.id,
      summary: `${req.profile.display_name || 'A user'} changed their account password.`,
      severity: 'warn',
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Step 1: Send OTP to email ──────────────────────────────────────────────
router.post('/forgot-password', otpSendLimiter, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check the email actually exists in profiles (case-insensitive: the
    // stored address may differ in case from what the user typed, and a
    // missed match here silently skips sending with a fake ok response).
    // Use a list fetch, not single: duplicate active profiles can share
    // one email, and a single-row fetch errors on multiples — which also
    // skipped sending while still returning ok.
    const { data: matches } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email.trim())
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const profile = (matches || [])[0] || null;
    if (!profile) {
      // Respond ok anyway to prevent email enumeration
      return res.json({ ok: true });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    await otpSet(email, { otp, expiresAt });

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f7ff;border-radius:16px;overflow:hidden;border:1px solid #e8e0ff">
        <div style="text-align:center">
          <img src="https://cymon-clearmindpsychologicalservices.vercel.app/email-header.png" alt="ClearMind" style="width:100%;max-width:520px;height:auto;display:block;" />
        </div>
        <div style="padding:36px 40px">
          <h2 style="color:#2e1065;font-size:20px;margin-bottom:6px">Password Reset Request</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:24px">We received a request to reset your ClearMind account password. Use the verification code below. It will expire in <strong>10 minutes</strong>.</p>
          <div style="background:#fff;border:2px solid #7c3aed;border-radius:12px;padding:20px 10px;text-align:center;margin:0 auto 28px;max-width:280px">
            <div style="color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Your Code</div>
            <div style="color:#2e1065;font-size:36px;font-weight:900;letter-spacing:6px;font-family:monospace;white-space:nowrap;">${otp}</div>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;line-height:1.6">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <div style="background:#f3f0ff;padding:16px 40px;text-align:center;color:#9ca3af;font-size:11px">
          © ${new Date().getFullYear()} ClearMind Psychological Services
        </div>
      </div>
    `;

    let sendResult;
    try {
      sendResult = await sendMail({
        to: email.trim(),
        subject: `Your ClearMind Password Reset Code: ${otp}`,
        html,
      });
    } catch (mailErr) {
      // sendMail already logs provider detail server-side; return a safe,
      // user-friendly message (never raw Gmail/SMTP diagnostics).
      console.error(`[auth] password-reset email failed for ${email.toLowerCase()}:`, mailErr.message);
      await otpDelete(email);
      return res.status(mailErr.status || 502).json({ error: mailErr.message || 'Could not send the reset email. Please try again in a moment.' });
    }
    console.log(`[auth] password-reset code sent to ${email.toLowerCase()} via ${sendResult?.provider || 'unknown'} (${sendResult?.messageId || 'no-id'})`);

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Step 2: Verify OTP ──────────────────────────────────────────────────────
router.post('/verify-otp', otpVerifyLimiter, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ error: 'Email and code are required' });

    const record = await otpGet(email);
    if (!record) return res.status(400).json({ error: 'No pending code for this email. Please request again.' });
    if (Date.now() > record.expiresAt) {
      await otpDelete(email);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    // Mark as verified but keep in store (cleared on reset)
    await otpSet(email, { ...record, verified: true });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Step 3: Reset Password ──────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and new password are required' });

    // Confirm OTP was verified
    const record = await otpGet(email);
    if (!record || !record.verified) return res.status(403).json({ error: 'Please verify your code before resetting your password.' });
    if (Date.now() > record.expiresAt) {
      await otpDelete(email);
      return res.status(400).json({ error: 'Session expired. Please start over.' });
    }

    // Single shared policy (see lib/password.js) — same rules as signup
    // and change-password so users see one consistent requirement set.
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    // Look up user
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return res.status(500).json({ error: 'Could not locate user account.' });
    const user = (users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) return res.status(400).json({ error: error.message });

    await otpDelete(email);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/public-announcements', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, type, publish_date, image_url, image_urls, audience, patient_id')
      .is('deleted_at', null)
      .is('patient_id', null)
      .order('publish_date', { ascending: false });
    if (error) return next(error);

    // Publish-to-all-branches fans out one identical row per branch, but the
    // public feed has no branch scope — collapse those copies (same
    // title+body, newest first) so each announcement shows exactly once.
    const seenPublic = new Set();
    const publicAnnouncements = (data || []).filter((a) => {
      const audience = Array.isArray(a.audience) ? a.audience : []
      if (!audience.includes('public') && !audience.includes('all')) return false
      const key = `${a.title || ''}|||${a.body || ''}`;
      if (seenPublic.has(key)) return false
      seenPublic.add(key)
      return true
    });

    res.json({ announcements: publicAnnouncements });
  } catch (err) {
    next(err);
  }
});

router.get('/my-announcements', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const profile = req.profile;
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, type, body, publish_date, image_url, image_urls, audience, patient_id, employee_id')
      .eq('clinic_id', profile.clinic_id)
      .is('deleted_at', null)
      .order('publish_date', { ascending: false });
    if (error) return next(error);

    // If client, we need to check if they have a patient_id targeted
    let patientIds = [];
    if (profile.role === 'client') {
      const { data: pats } = await supabase.from('patients').select('id').eq('caregiver_id', profile.id);
      patientIds = (pats || []).map(p => p.id);
    }

    const filtered = (data || []).filter((a) => {
      // If targeted to a patient
      if (a.patient_id) {
        return patientIds.includes(a.patient_id);
      }
      
      // If targeted to an employee
      if (a.employee_id) {
        return a.employee_id === profile.id;
      }
      
      // Otherwise, it's a broadcast announcement. Check audience.
      const aud = a.audience || [];
      if (aud.length === 0 || aud.includes('all')) return true;
      if (profile.role === 'client' && (aud.includes('client') || aud.includes('all_clients'))) return true;
      if (aud.includes(profile.role)) return true;

      // Also check extra_roles if any
      const extraRoles = profile.extra_roles || [];
      if (extraRoles.some(role => aud.includes(role))) return true;

      // Group audiences: all_employees = any non-client staff role;
      // all_mhp = any mental-health professional (clinical) role.
      const allRoles = [profile.role, ...extraRoles];
      const isStaff = allRoles.some((r) => ['admin', 'super_admin', 'psychologist', 'psychometrician'].includes(r));
      const isMhp = allRoles.some((r) => ['psychologist', 'psychometrician'].includes(r));
      if (aud.includes('all_employees') && isStaff) return true;
      if (aud.includes('all_mhp') && isMhp) return true;

      return false;
    });

    res.json({ announcements: filtered });
  } catch (err) {
    next(err);
  }
});

router.get('/nav-badges', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const extraRoles = Array.isArray(req.profile.extra_roles) ? req.profile.extra_roles : [];
    // Badges follow the ACTIVE role: each role handles its own students, so a
    // dual-role staffer acting as RPm must not see psychologist badges and
    // vice versa. Without an explicit switch (all roles active), fall back to
    // the base role exactly as before.
    const activeRoles = Array.isArray(req.activeRoles) && req.activeRoles.length > 0
      ? req.activeRoles
      : [req.profile.role, ...extraRoles];
    const role = activeRoles.length === 1 ? activeRoles[0] : req.profile.role;
    const badges = {};

    const { data: annData } = await supabase
      .from('announcements')
      .select('id, audience, patient_id, employee_id')
      .eq('clinic_id', req.profile.clinic_id)
      .is('deleted_at', null);

    let patientIds = [];
    let patient = null;
    const baseQueries = [];

    if (role === 'client') {
      baseQueries.push(
        supabase.from('patients').select('id').eq('caregiver_id', req.profile.id).then((r) => ({ key: 'caregiverPats', ...r })),
        supabase.from('patients').select('id, admission_form_status, allow_journal_entry').eq('profile_id', req.profile.id).maybeSingle().then((r) => ({ key: 'patient', ...r })),
      );
    } else if (role === 'admin' || extraRoles.includes('admin')) {
      let complianceQuery = supabase
        .from('patients')
        .select('id, waiver_submissions(document_type_code, status)')
        .eq('admission_form_status', 'complete')
        .is('deleted_at', null);
      // Acting branch scopes the count; Super Admins on the cross-branch
      // view see every branch (same as their other lists).
      if (role !== 'super_admin' || req.profile.branch_scoped) {
        complianceQuery = complianceQuery.eq('clinic_id', req.profile.clinic_id);
      }
      baseQueries.push(
        supabase.from('assessment_permissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').then((r) => ({ key: 'permissions', ...r })),
        complianceQuery.then((r) => ({ key: 'compliancePending', ...r })),
      );
    } else if (role === 'psychologist' && !extraRoles.includes('admin')) {
      const { data: assignedPats } = await supabase.from('patients').select('id').eq('treating_psychologist_id', req.profile.id);
      const assignedIds = (assignedPats || []).map(p => p.id);
      if (assignedIds.length > 0) {
        baseQueries.push(
          supabase.from('assessment_submissions').select('*', { count: 'exact', head: true }).eq('status', 'submitted').in('patient_id', assignedIds).then((r) => ({ key: 'approvals', ...r })),
          supabase.from('assessment_reports').select('id, report_type').eq('status', 'ready_for_review').in('patient_id', assignedIds).then((r) => ({ key: 'reports', ...r }))
        );
      }
    } else if (role === 'psychometrician' && !extraRoles.includes('admin')) {
      baseQueries.push(
        supabase.from('assessment_assignments').select('*', { count: 'exact', head: true }).eq('status', 'pending').then((r) => ({ key: 'assignments', ...r })),
        supabase.from('assessment_permissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').then((r) => ({ key: 'permissions', ...r })),
        supabase.from('assessment_document_releases').select('*', { count: 'exact', head: true }).eq('status', 'pending').then((r) => ({ key: 'releases', ...r })),
      );
    }

    const baseResults = baseQueries.length ? await Promise.all(baseQueries) : [];
    const baseMap = Object.fromEntries(baseResults.map((r) => [r.key, r]));

    if (role === 'client') {
      const caregiverPats = baseMap['caregiverPats'];
      patientIds = (caregiverPats?.data || []).map((p) => p.id);
      patient = baseMap['patient']?.data;

      const clientQueries = [];
      if (patient) {
        if (patient.allow_journal_entry) {
          const todayStr = new Date().toLocaleDateString('en-CA');
          clientQueries.push(
            supabase
              .from('daily_activity_logs')
              .select('*', { count: 'exact', head: true })
              .eq('patient_id', patient.id)
              .eq('log_date', todayStr)
              .then((r) => ({ key: 'journal', ...r })),
          );
        }
        clientQueries.push(
          supabase
            .from('assessment_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', patient.id)
            .eq('status', 'pending')
            .then((r) => ({ key: 'assessments', ...r })),
          supabase
            .from('waiver_submissions')
            .select('document_type_code, status')
            .eq('patient_id', patient.id)
            .then((r) => ({ key: 'waivers', ...r })),
        );
      }

      const clientResults = await Promise.all(clientQueries);
      const clientMap = Object.fromEntries(clientResults.map((r) => [r.key, r]));

      if (patient) {
        const journalCount = clientMap['journal']?.count ?? 1;
        if (journalCount === 0) badges['activity'] = 1;

        const assessmentCount = clientMap['assessments']?.count ?? 0;
        if (assessmentCount > 0) badges['assessments'] = assessmentCount;

        const subs = clientMap['waivers']?.data || [];
        const submissionByCode = Object.fromEntries(subs.map((s) => [s.document_type_code, s]));
        const admissionIsComplete = patient.admission_form_status === 'complete';

        let pendingWaiversCount = 0;
        if (!admissionIsComplete) pendingWaiversCount++;

        const spedStatus = submissionByCode['CMPS:SE-FO-02']?.status || 'not_started';
        if (spedStatus !== 'approved' && spedStatus !== 'submitted') {
          pendingWaiversCount++;
        }

        if (pendingWaiversCount > 0) badges['waivers'] = pendingWaiversCount;
      }
    } else if (role === 'admin' || extraRoles.includes('admin')) {
      const permCount = baseMap['permissions']?.count ?? 0;
      if (permCount > 0) badges['records'] = permCount;

      // A completed admission lands in Compliance needing the consent waiver
      // (FO-02) before the student can be scheduled. Count those students so
      // the sidebar badge flags the handoff; clearing when FO-02 is approved
      // keeps it a live "needs action" signal.
      const complianceRows = baseMap['compliancePending']?.data || [];
      const pendingCompliance = complianceRows.filter((p) =>
        !(p.waiver_submissions || []).some(
          (w) => w.document_type_code === 'CMPS:SE-FO-02' && w.status === 'approved',
        ),
      ).length;
      if (pendingCompliance > 0) badges['compliance'] = pendingCompliance;
    } else if (role === 'psychologist' && !extraRoles.includes('admin')) {
      const reportsList = baseMap['reports']?.data || [];
      const approvalsCount = (baseMap['approvals']?.count ?? 0) + reportsList.filter(r => ['behavioral', 'iep'].includes(r.report_type || r.type || 'behavioral')).length;
      const monthlyCount = reportsList.filter(r => r.report_type === 'progress_summary' || r.report_type === 'monthly').length;
      const activityCount = reportsList.filter(r => r.report_type === 'daily_activity').length;
      
      if (approvalsCount > 0) badges['approvals'] = approvalsCount;
      if (monthlyCount > 0) badges['monthly-assessment-report'] = monthlyCount;
      if (activityCount > 0) badges['daily-activity-report'] = activityCount;
    } else if (role === 'psychometrician' && !extraRoles.includes('admin')) {
      const assignments = baseMap['assignments']?.count ?? 0;
      const permissions = baseMap['permissions']?.count ?? 0;
      const releases = baseMap['releases']?.count ?? 0;
      const tasks = assignments + permissions + releases;
      if (tasks > 0) badges['task-list'] = tasks;
    }

    // Admins manage the Published announcements list itself and never get
    // announcement bell notifications (see resolveAnnouncementRecipients) —
    // so their nav must not carry an announcement badge either. Without this,
    // the frontend's local-read count over announcements_ids leaves a badge
    // that can never clear from the admin sidebar.
    const isAdminView = role === 'admin' || role === 'super_admin';
    const filteredAnns = isAdminView ? [] : (annData || []).filter((a) => {
      if (a.patient_id) return patientIds.includes(a.patient_id);
      if (a.employee_id) return a.employee_id === req.profile.id;
      const aud = a.audience || [];
      if (aud.length === 0 || aud.includes('all')) return true;
      if (role === 'client' && (aud.includes('client') || aud.includes('all_clients'))) return true;
      if (aud.includes(role)) return true;
      if (extraRoles.some((r) => aud.includes(r))) return true;

      const allRoles = [role, ...extraRoles];
      const isStaff = allRoles.some((r) => ['admin', 'super_admin', 'psychologist', 'psychometrician'].includes(r));
      const isMhp = allRoles.some((r) => ['psychologist', 'psychometrician'].includes(r));
      if (aud.includes('all_employees') && isStaff) return true;
      if (aud.includes('all_mhp') && isMhp) return true;
      return false;
    });

    badges['announcements_ids'] = filteredAnns.map((a) => a.id);

    res.json({ badges });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

