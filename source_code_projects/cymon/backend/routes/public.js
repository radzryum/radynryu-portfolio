'use strict';

const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { writeAudit } = require('../lib/audit');
const { createNotification } = require('../lib/notify');

const router = express.Router();

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res.status(500).json({ error: 'Server not configured.' });
    return false;
  }
  return true;
}

// Per-IP rate limiter for the anonymous application endpoint (same shape as
// the auth limiters: per-instance only, enough against single-source spam).
const rateBuckets = new Map();
function hitRateLimit(key, max, windowMs) {
  const now = Date.now();
  const cur = rateBuckets.get(key);
  if (!cur || now > cur.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  cur.count += 1;
  return cur.count > max;
}

// ---------------------------------------------------------------------------
// GET /api/public/landing
// ---------------------------------------------------------------------------
// Returns all landing page content for the clinic. Used by the public landing page.
// Falls back to an empty object if no content exists yet (frontend uses defaults).
// ---------------------------------------------------------------------------
router.get('/landing', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let { clinic_id } = req.query;
    // Allow omitting clinic_id on the public landing page: fall back to the
    // first clinic so the marketing site works without auth.
    if (!clinic_id) {
      const { data: clinics, error: clinicErr } = await supabase
        .from('clinics')
        .select('id')
        .limit(1);
      if (clinicErr) return next(clinicErr);
      clinic_id = clinics?.[0]?.id;
    }
    if (!clinic_id) return res.json({ sections: {} });

    const { data, error } = await supabase
      .from('landing_content')
      .select('section_key, content')
      .eq('clinic_id', clinic_id)
      .eq('published', true);

    if (error) return next(error);

    const sections = {};
    (data || []).forEach((row) => {
      sections[row.section_key] = row.content;
    });

    res.json({ sections });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/public/apply/meta?clinic_code=CLEARMIND
// ---------------------------------------------------------------------------
// Lets the anonymous admission form confirm it points at the right clinic
// before the guardian fills anything in.
// ---------------------------------------------------------------------------
router.get('/apply/meta', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    let code = String(req.query.clinic_code || '').trim().toUpperCase();
    // Legacy QR flyers used 'CLEARMIND' before branches existed — they belong
    // to Cabuyao (same mapping as handle_new_user).
    if (code === 'CLEARMIND') code = 'CLEARMIND-CABUYAO';
    if (!code) return res.status(400).json({ error: 'Clinic code is required.' });
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('id, code, name')
      .eq('code', code)
      .maybeSingle();
    if (error) return next(error);
    if (!clinic) return res.status(404).json({ error: 'Unknown clinic code.' });
    res.json({ clinic: { code: clinic.code, name: clinic.name } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/apply
// ---------------------------------------------------------------------------
// Anonymous admission application (QR/link form). Validates like the staff
// admission endpoint, stores a pending row for staff review, and never
// creates patient/profile records on its own.
// ---------------------------------------------------------------------------
const APPLY_SEX = new Set(['male', 'female']);
const APPLY_IEP = new Set(['HSN', 'MSN', 'LSN', 'Individual']);

// Guardian-typed names arrive in any casing ("juan dela cruz", "JUAN").
// Proper-case each word so rosters and imported records stay presentable.
function properName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\-'.])(\p{Ll})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

function applyDobError(value) {
  if (!value) return 'Date of birth is required.';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date of birth.';
  if (d > new Date()) return 'Enter a valid date of birth (not in the future).';
  return null;
}

router.post('/apply', async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    if (hitRateLimit(`apply:${ip}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }

    const body = req.body || {};
    let code = String(body.clinic_code || '').trim().toUpperCase();
    // Same legacy mapping as GET /apply/meta above.
    if (code === 'CLEARMIND') code = 'CLEARMIND-CABUYAO';
    const child = body.child || {};
    const mother = body.mother || {};
    const father = body.father || {};
    const emergency = body.emergency || {};
    const clinical = body.clinical || {};

    if (!code) return res.status(400).json({ error: 'Clinic code is required.' });
    const { data: clinic, error: clinicErr } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('code', code)
      .maybeSingle();
    if (clinicErr) return next(clinicErr);
    if (!clinic) return res.status(404).json({ error: 'Unknown clinic code.' });

    if (!child.first_name || !child.last_name) {
      return res.status(400).json({ error: 'Child first and last name are required.' });
    }
    const dobErr = applyDobError(child.date_of_birth);
    if (dobErr) return res.status(400).json({ error: dobErr });
    if (!APPLY_SEX.has(child.sex)) {
      return res.status(400).json({ error: 'Child sex is required.' });
    }
    if (!child.place_of_birth || !child.citizenship || !child.religion || !child.home_address) {
      return res.status(400).json({ error: 'Place of birth, citizenship, religion, and present address are required.' });
    }
    if (!mother.full_name || !mother.occupation || !mother.contact_number) {
      return res.status(400).json({ error: 'Mother/guardian name, occupation, and mobile number are required.' });
    }
    if (!father.full_name || !father.occupation || !father.contact_number) {
      return res.status(400).json({ error: 'Father/guardian name, occupation, and mobile number are required.' });
    }
    if (!emergency.full_name || !emergency.contact_number || !emergency.relationship) {
      return res.status(400).json({ error: 'Emergency contact name, number, and relation are required.' });
    }
    if (clinical.previously_diagnosed !== true && clinical.previously_diagnosed !== false) {
      return res.status(400).json({ error: 'Please answer whether the student was previously diagnosed.' });
    }
    if (clinical.other_disability !== true && clinical.other_disability !== false) {
      return res.status(400).json({ error: 'Please answer whether the student has another disability.' });
    }
    if (!clinical.allergies) {
      return res.status(400).json({ error: 'Allergies are required (write "None" if there are none).' });
    }
    if (!APPLY_IEP.has(body.iep_level)) {
      return res.status(400).json({ error: 'Enrollment type is required.' });
    }
    if (!body.parent_signature || !body.parent_printed_name) {
      return res.status(400).json({ error: 'Parent signature and printed name are required.' });
    }

    // Optional 2x2 photo (data URL, max 5 MB like the staff form).
    let photoUrl = null;
    const photoMatch = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(body.photo_data_url || '');
    if (body.photo_data_url && !photoMatch) {
      return res.status(400).json({ error: 'Photo must be a PNG, JPG, or WebP image.' });
    }
    if (photoMatch) {
      const buffer = Buffer.from(photoMatch[3], 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Photo must be under 5 MB.' });
      }
      const ext = photoMatch[2] === 'jpeg' || photoMatch[2] === 'jpg' ? 'jpg' : photoMatch[2];
      const path = `applications/${clinic.id}/${require('crypto').randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, buffer, { contentType: photoMatch[1], upsert: true });
      if (upErr) return next(upErr);
      photoUrl = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      patient: {
        first_name: properName(child.first_name),
        middle_name: child.middle_name ? properName(child.middle_name) : null,
        last_name: properName(child.last_name),
        suffix_name: child.suffix_name || null,
        nick_name: child.nick_name ? properName(child.nick_name) : null,
        date_of_birth: child.date_of_birth,
        sex: child.sex,
        home_address: child.home_address,
        permanent_address: child.permanent_address || child.home_address,
        place_of_birth: child.place_of_birth,
        citizenship: child.citizenship,
        religion: child.religion,
        photo_url: photoUrl,
        previously_diagnosed: clinical.previously_diagnosed,
        other_disability: clinical.other_disability,
        parent_signature: body.parent_signature,
        parent_printed_name: properName(body.parent_printed_name),
      },
      clinical: {
        primary_diagnosis: clinical.primary_diagnosis || null,
        secondary_diagnosis: clinical.secondary_diagnosis || null,
        allergies: clinical.allergies,
        iep_level: body.iep_level,
      },
      guardians: [
        { full_name: properName(mother.full_name), relationship: 'Mother', occupation: mother.occupation, contact_number: mother.contact_number, email: mother.email || null },
        { full_name: properName(father.full_name), relationship: 'Father', occupation: father.occupation, contact_number: father.contact_number, email: father.email || null },
      ],
      emergency: {
        full_name: properName(emergency.full_name),
        contact_number: emergency.contact_number,
        relationship: emergency.relationship,
      },
    };

    const { data: row, error } = await supabase
      .from('admission_applications')
      .insert({
        clinic_id: clinic.id,
        status: 'pending',
        payload,
        parent_signature: body.parent_signature,
        parent_printed_name: body.parent_printed_name,
      })
      .select('id, created_at')
      .single();
    if (error) return next(error);

    await writeAudit({
      clinicId: clinic.id,
      actorId: null,
      action: 'submit_application',
      entityType: 'admission_application',
      entityId: row.id,
      summary: `Anonymous admission application submitted for ${properName(child.first_name)} ${properName(child.last_name)}.`,
    });

    // Notify the branch's admins plus every Super Admin (all branches).
    // Best-effort: a notification failure must never break the submission.
    // Includes dual-role staff holding admin in extra_roles (same filter as
    // the payments flow) — a primary-role-only query would miss them.
    try {
      const [{ data: branchStaff }, { data: superAdmins }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, role, extra_roles')
          .eq('clinic_id', clinic.id)
          .is('deleted_at', null),
        supabase
          .from('profiles')
          .select('id')
          .eq('role', 'super_admin')
          .is('deleted_at', null),
      ]);
      const admins = (branchStaff || []).filter(
        (p) => p.role === 'admin' || (Array.isArray(p.extra_roles) && p.extra_roles.includes('admin')),
      );
      const recipients = [
        ...admins.map((p) => p.id),
        ...((superAdmins || []).map((p) => p.id)),
      ].filter((id, i, all) => id && all.indexOf(id) === i);
      const childLabel = `${properName(child.first_name)} ${properName(child.last_name)}`;
      await Promise.all(
        recipients.map((recipientId) =>
          createNotification({
            clinicId: clinic.id,
            recipientId,
            type: 'application',
            title: 'New admission application',
            body: `${childLabel} applied to ${clinic.name}. Review it in Admission Applications.`,
            // Deep link: the Applications page jumps to whichever tab holds
            // this record (pending now, imported/rejected later) instead of
            // stranding the click on an empty Pending list.
            link: `/admin/applications?application=${row.id}`,
            entityType: 'admission_application',
            entityId: row.id,
          }),
        ),
      );
    } catch (notifyErr) {
      console.error('[apply] failed to notify admins of new application:', notifyErr.message);
    }

    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
