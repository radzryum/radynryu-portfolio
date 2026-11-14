const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { completePastAppointments } = require('../lib/appointments');
const { createNotification } = require('../lib/notify');
const { patientName, capitalizeNamePart } = require('../lib/names');
const dto = require('../lib/dto');
const { dedupeLatestBy } = require('../lib/latest');
const { writeAudit } = require('../lib/audit');
const { renderFormPdf } = require('../lib/formPdf');
const { renderAssessmentReleaseSlipPdf } = require('../lib/assessmentReleaseSlipPdf');
const { responseValue, scoreAssessment, structureForTemplate } = require('../lib/assessmentSchemas');
const {
  ACTIVE_RELEASE_STATUSES,
  APPROVED_ASSESSMENT_STATUSES: RELEASE_APPROVED_ASSESSMENT_STATUSES,
  SOURCE_TABLES,
  formatReleaseRequest,
  sourceKey,
} = require('../lib/documentReleases');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
const CLINIC_TIME_ZONE = process.env.CLINIC_TIME_ZONE || 'Asia/Manila';

function clinicTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getAssessmentQuestions(structure = []) {
  return (Array.isArray(structure) ? structure : []).flatMap((domain) =>
    Array.isArray(domain?.items)
      ? domain.items.map((item) => ({
          ...item,
          key: item?.key,
          label: item?.label || item?.text || item?.name || item?.key || 'Assessment item',
          domain: domain?.title || domain?.name || domain?.label || '',
        }))
      : [],
  ).filter((item) => item.key);
}

function findIncompleteAssessmentItems(structure = [], answers = {}) {
  return getAssessmentQuestions(structure).filter((item) => {
    const raw = answers?.[item.key];
    const response = raw && typeof raw === 'object' ? raw.response ?? raw.value ?? raw.answer : raw;
    const normalized = String(response || '').trim().toLowerCase();
    if (item.response_type === 'text') return !normalized;
    if (item.response_type === 'select') {
      return !(item.options || []).some((option) => String(option).toLowerCase() === normalized);
    }
    return !['yes', 'no', 'na'].includes(normalized);
  });
}

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res
      .status(500)
      .json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
    return false;
  }
  return true;
}

function requireClient(req, res, next) {
  if (req.profile.role !== 'client') {
    return res.status(403).json({ error: 'Client account required' });
  }
  next();
}

router.patch('/onboarding', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const completed = req.body?.completed !== false;
    const { data, error } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: completed ? new Date().toISOString() : null })
      .eq('id', req.user.id)
      .select('id, onboarding_completed_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ profile: data });
  } catch (err) {
    return next(err);
  }
});

function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  // Invalid or future birthdates (bad data entry) must never render as a
  // negative age — callers show a placeholder for null.
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  if (birth > now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

async function staffName(id) {
  if (!id) return null;
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).single();
  return data ? data.display_name : null;
}

async function getStaffInfo(id) {
  if (!id) return null;
  const { data: p } = await supabase
    .from('profiles')
    .select('display_name, license_no, title, avatar_url')
    .eq('id', id)
    .maybeSingle();
  return {
    name: p ? p.display_name : null,
    profession: p ? (p.title || null) : null,
    prc_id: p ? p.license_no : null,
    avatar_url: p ? (p.avatar_url || null) : null,
  };
}

// The caregiver's enrolled child plus clinical, guardian, emergency, clinic.
router.get('/patient', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: patient, error } = await supabase
      .from('patients')
      .select('*, photo_url')
      .eq('caregiver_id', req.profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return next(error);
    if (!patient) return res.status(404).json({ error: 'No enrolled child yet' });

    const [{ data: clinical }, { data: guardians }, { data: emergency }, { data: clinic }] =
      await Promise.all([
        supabase.from('clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
        supabase
          .from('guardians')
          .select('*')
          .eq('patient_id', patient.id)
          .order('is_primary', { ascending: false }),
        supabase
          .from('emergency_contacts')
          .select('*')
          .eq('patient_id', patient.id)
          .limit(1)
          .maybeSingle(),
        supabase.from('clinics').select('name, address, phone, email').eq('id', patient.clinic_id).single(),
      ]);

    const staffIds = [patient.caregiver_id, clinical?.treating_psychologist_id, clinical?.treating_psychometrician_id].filter(Boolean);
    const uniqueStaffIds = [...new Set(staffIds)];
    let caregiver = null;
    let psychologistInfo = null;
    let psychometricianInfo = null;
    if (uniqueStaffIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, license_no, title, avatar_url')
        .in('id', uniqueStaffIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      const cp = profileMap[patient.caregiver_id];
      if (cp) caregiver = { id: cp.id, display_name: cp.display_name, email: cp.email };
      const buildStaffInfo = (id) => {
        if (!id) return null;
        const p = profileMap[id];
        if (!p) return { name: null, profession: null, prc_id: null, avatar_url: null };
        return { name: p.display_name, profession: p.title || null, prc_id: p.license_no || null, avatar_url: p.avatar_url || null };
      };
      psychologistInfo = buildStaffInfo(clinical?.treating_psychologist_id);
      psychometricianInfo = buildStaffInfo(clinical?.treating_psychometrician_id);
    }

    res.json({
      patient: dto.patientForClient(patient, {
        full_name: patientName(patient),
        photo_url: patient.photo_url || null,
        age: ageFromDob(patient.date_of_birth),
        treating_psychologist: psychologistInfo,
        treating_psychometrician: psychometricianInfo,
      }),
      clinical: clinical
        ? dto.clinicalForClient(clinical, {
            treating_psychologist_name: psychologistInfo?.name || null,
            treating_psychometrician_name: psychometricianInfo?.name || null,
          })
        : null,
      caregiver: caregiver || null,
      guardian: guardians && guardians.length > 0 ? dto.guardianCard(guardians[0]) : null,
      guardians: (guardians || []).map(dto.guardianCard),
      emergency: emergency ? dto.emergencyCard(emergency) : null,
      clinic: clinic || null,
    });
  } catch (err) {
    next(err);
  }
});

// Enroll the caregiver's child (the 3-step setup wizard). One patient per caregiver for now.
router.post('/patient', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { patient = {}, clinical = {}, guardian = {}, emergency = {} } = req.body || {};

    if (!patient.first_name || !patient.last_name) {
      return res.status(400).json({ error: 'Child first and last name are required' });
    }
    if (!patient.date_of_birth || !patient.sex) {
      return res.status(400).json({ error: 'Child date of birth and sex are required' });
    }
    // A future birthdate is always a data-entry mistake — reject it here so
    // it can never surface as a negative age in rosters and reports.
    if (Number.isNaN(new Date(patient.date_of_birth).getTime()) || new Date(patient.date_of_birth) > new Date()) {
      return res.status(400).json({ error: 'Enter a valid date of birth (not in the future).' });
    }

    const { data: existing } = await supabase
      .from('patients')
      .select('id, photo_url')
      .eq('caregiver_id', req.profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'This account already has an enrolled child' });
    }

    const { data: created, error } = await supabase
      .from('patients')
      .insert({
        clinic_id: req.profile.clinic_id,
        caregiver_id: req.profile.id,
        first_name: patient.first_name,
        middle_name: patient.middle_name || null,
        last_name: patient.last_name,
        nick_name: patient.nick_name || null,
        date_of_birth: patient.date_of_birth,
        sex: patient.sex,
        home_address: patient.home_address || null,
        permanent_address: patient.permanent_address || null,
        contact_number: patient.contact_number || null,
        allow_journal_entry: false,
      })
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    await Promise.all([
      supabase.from('clinical_profiles').insert({
        patient_id: created.id,
        primary_diagnosis: clinical.primary_diagnosis || null,
        iep_level: clinical.iep_level || null,
        secondary_diagnosis: clinical.secondary_diagnosis || null,
        date_enrolled: clinical.date_enrolled || null,
        referral_source: clinical.referral_source || null,
      }),
      guardian.full_name
        ? supabase.from('guardians').insert({
            patient_id: created.id,
            full_name: guardian.full_name,
            relationship: guardian.relationship || null,
            contact_number: guardian.contact_number || null,
            email: guardian.email || null,
            occupation: guardian.occupation || null,
            employer: guardian.employer || null,
            is_primary: true,
          })
        : Promise.resolve(),
      emergency.full_name
        ? supabase.from('emergency_contacts').insert({
            patient_id: created.id,
            full_name: emergency.full_name,
            relationship: emergency.relationship || null,
            contact_number: emergency.contact_number || null,
            alt_contact_number: emergency.alt_contact_number || null,
            address: emergency.address || null,
          })
        : Promise.resolve(),
    ]);

    await writeAudit({
      clinicId: created.clinic_id,
      actorId: req.profile.id,
      action: 'register_patient',
      entityType: 'patient',
      entityId: created.id,
      summary: `${req.profile.display_name || 'Caregiver'} completed student registration for ${patientName(created)}.`,
    });
    res.status(201).json({ patient: created });
  } catch (err) {
    next(err);
  }
});

// ---------- shared: the caregiver's enrolled child ----------

async function caregiverPatient(profileId) {
  const { data } = await supabase
    .from('patients')
    .select('*, photo_url')
    .eq('caregiver_id', profileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

const MOOD_SCORE = { very_bad: 1, sad: 2, okay: 3, good: 4, great: 5 };

async function requirePatient(req, res) {
  const patient = await caregiverPatient(req.profile.id);
  if (!patient) {
    res.status(404).json({ error: 'No enrolled child yet' });
    return null;
  }
  return patient;
}

const APPROVED_ASSESSMENT_STATUSES = new Set(['scored', 'approved', 'finalized']);
const ONSITE_VIEW_SOURCE_TABLES = new Set(['assessment_submissions', 'assessment_reports']);

function toOnsiteDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isOnsiteWeekday(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return false;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function storedOnsiteOptions(options) {
  return Array.isArray(options)
    ? [...new Set(options.map(toOnsiteDate).filter(Boolean).filter(isOnsiteWeekday))].sort()
    : [];
}

// ---------- home aggregate ----------

router.get('/home', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const nowIso = new Date().toISOString();
    const [{ data: clinical }, { data: logs }, { count: cbiCount }, { count: goalsMet }, { data: nextAppt }, { data: lastAppt }, { data: announcements }, { count: assignedCount }] =
      await Promise.all([
        // Explicit columns only: this endpoint shapes a clinical subset
        // below, so the rest of the record never leaves the server.
        supabase.from('clinical_profiles').select('treating_psychologist_id, treating_psychometrician_id, iep_level, support_level, milestone_progress, next_review_at, notes, updated_at').eq('patient_id', patient.id).maybeSingle(),
        supabase
          .from('daily_activity_logs')
          .select('log_date, mood')
          .eq('patient_id', patient.id)
          .order('log_date', { ascending: false })
          .limit(30),
        supabase.from('daily_activity_logs').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
        supabase.from('interventions').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id).eq('status', 'completed'),
        supabase
          .from('appointments')
          .select('starts_at, session_type, practitioner_id, location')
          .eq('patient_id', patient.id)
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('appointments')
          .select('starts_at, session_type, practitioner_id, location')
          .eq('patient_id', patient.id)
          .lt('starts_at', nowIso)
          .order('starts_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('announcements')
          .select('id, title, body, publish_date, audience, patient_id, employee_id')
          .eq('clinic_id', patient.clinic_id)
          .is('deleted_at', null)
          .or(`patient_id.is.null,patient_id.eq.${patient.id}`)
          .order('publish_date', { ascending: false }),
        supabase
          .from('assessment_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patient.id)
          .in('status', ['assigned', 'in_progress']),
      ]);

    const moodSeries = dto.moodSeriesPoints((logs || []).slice().reverse(), 'value', (mood) => MOOD_SCORE[mood] || 0);
    const last7Moods = moodSeries.slice(-7);
    const avgMood = last7Moods.length
      ? Number((last7Moods.reduce((a, b) => a + b.value, 0) / last7Moods.length).toFixed(1))
      : null;
    const psychologistId = clinical?.treating_psychologist_id || patient.treating_psychologist_id || null;
    const psychometricianId = clinical?.treating_psychometrician_id || patient.treating_psychometrician_id || null;
    const staffIds = [
      nextAppt?.practitioner_id,
      lastAppt?.practitioner_id,
      clinical?.treating_psychologist_id,
      psychologistId,
      psychometricianId,
    ].filter(Boolean);
    const uniqueStaffIds = [...new Set(staffIds)];
    let staffMap = {};
    if (uniqueStaffIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, license_no, title, avatar_url')
        .in('id', uniqueStaffIds);
      staffMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }
    const practitionerName = nextAppt?.practitioner_id ? (staffMap[nextAppt.practitioner_id]?.display_name || null) : null;
    const lastPractitionerName = lastAppt?.practitioner_id ? (staffMap[lastAppt.practitioner_id]?.display_name || null) : null;
    const buildStaffInfo = (id) => {
      if (!id) return null;
      const p = staffMap[id];
      if (!p) return { name: null, profession: null, prc_id: null, avatar_url: null };
      return { name: p.display_name, profession: p.title || null, prc_id: p.license_no || null, avatar_url: p.avatar_url || null };
    };
    const psychologistInfo = buildStaffInfo(psychologistId);
    const psychometricianInfo = buildStaffInfo(psychometricianId);

    res.json({
      patient: {
        first_name: patient.first_name,
        full_name: patientName(patient),
        photo_url: patient.photo_url || patient.patients?.photo_url || null,
        treating_psychologist_id: psychologistId,
        treating_psychometrician_id: psychometricianId,
        treating_psychologist: psychologistInfo,
        treating_psychometrician: psychometricianInfo,
        allow_journal_entry: Boolean(patient.allow_journal_entry),
      },
      clinical: clinical
        ? {
            iep_level: clinical.iep_level,
            support_level: clinical.support_level,
            milestone_progress: clinical.milestone_progress ?? null,
            next_review_at: clinical.next_review_at,
            notes: clinical.notes,
            updated_at: clinical.updated_at,
          }
        : null,
      stats: {
        cbiSubmissions: cbiCount || 0,
        iepGoalsMet: goalsMet || 0,
        avgMood,
        assignedAssessments: assignedCount || 0,
      },
      moodSeries,
      nextAppointment: nextAppt
        ? { starts_at: nextAppt.starts_at, session_type: nextAppt.session_type, practitioner: practitionerName, location: nextAppt.location }
        : null,
      lastAppointment: lastAppt
        ? { starts_at: lastAppt.starts_at, session_type: lastAppt.session_type, practitioner: lastPractitionerName, location: lastAppt.location }
        : null,
      announcements: (announcements || [])
        .filter((a) => {
          if (a.patient_id) {
            return a.patient_id === patient.id;
          }
          if (a.employee_id) {
            return false;
          }
          const aud = a.audience || [];
          return aud.length === 0 || aud.includes('all') || aud.includes('all_clients') || aud.includes('client') || aud.includes('public');
        })
        .slice(0, 3),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- journal voice notes (service-role storage) ----------
// The web client never holds a Supabase Auth session (custom backend auth),
// so browser-direct storage calls fail storage RLS. Voice bytes and signed
// playback URLs both flow through here with the service-role client instead.

// Mint short-lived playback URLs for stored journal-audio paths. Best-effort
// per row so one bad path never fails the whole list.
async function attachAudioPlayUrls(logs) {
  if (!Array.isArray(logs)) return logs;
  await Promise.all(
    logs.map(async (log) => {
      const stored = log && typeof log.audio_url === 'string' ? log.audio_url : '';
      if (!stored.startsWith('journal-audio/')) return;
      try {
        const { data, error } = await supabase.storage
          .from('journal-audio')
          .createSignedUrl(stored.replace(/^journal-audio\//, ''), 3600);
        if (!error && data && data.signedUrl) log.audio_play_url = data.signedUrl;
        else if (error) console.error('[voice journal] signed URL failed:', error.message);
      } catch (err) {
        // leave this row without a playback URL
        console.error('[voice journal] signed URL failed:', err?.message || err);
      }
    })
  );
  return logs;
}

router.post('/voice-upload', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    if (!patient.allow_journal_entry) {
      return res.status(403).json({ error: 'Journal entries for this student are locked. Permission from your supervising Psychometrician is required before submitting.' });
    }
    const { audio_base64, content_type, log_date, duration_sec } = req.body || {};
    const raw = typeof audio_base64 === 'string' ? audio_base64 : '';
    const b64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    if (!b64) return res.status(400).json({ error: 'No audio data received.' });
    if (b64.length > 12000000) return res.status(413).json({ error: 'Voice note is too large (max ~8MB). Please record a shorter entry.' });
    const type = typeof content_type === 'string' && content_type.startsWith('audio/')
      ? content_type.split(';')[0]
      : 'audio/webm';
    const targetLogDate = /^\d{4}-\d{2}-\d{2}$/.test(log_date || '') ? log_date : null;
    if (!targetLogDate) return res.status(400).json({ error: 'Journal date must use YYYY-MM-DD format.' });
    if (targetLogDate > clinicTodayKey()) return res.status(400).json({ error: 'A Daily Journal entry cannot use a future date.' });
    const dur = Number(duration_sec);
    if (!Number.isFinite(dur) || dur < 1 || dur > 600) {
      return res.status(400).json({ error: 'Voice note duration looks invalid.' });
    }
    const bytes = Buffer.from(b64, 'base64');
    if (!bytes.length) return res.status(400).json({ error: 'Voice note data is corrupted. Please record again.' });
    const ext = type.includes('mp4') ? 'm4a' : 'webm';
    const path = `${patient.id}/${targetLogDate}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('journal-audio')
      .upload(path, bytes, { contentType: type, upsert: false });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ url: `journal-audio/${path}` });
  } catch (err) {
    next(err);
  }
});

// ---------- daily activity logs ----------

router.get('/activity-logs', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const { data, error } = await supabase
      .from('daily_activity_logs')
      .select('id, log_date, mood, task_completion, behavioral_episodes, sleep_quality, appetite, observations, audio_url, audio_duration_sec')
      .eq('patient_id', patient.id)
      .order('log_date', { ascending: false });
    if (error) return next(error);
    await attachAudioPlayUrls(data);
    const series = dto.moodSeriesPoints((data || []).slice(0, 7).slice().reverse(), 'score', (mood) => MOOD_SCORE[mood] || 0);
    res.json({ logs: data || [], moodSeries: series, allow_journal_entry: Boolean(patient.allow_journal_entry) });
  } catch (err) {
    next(err);
  }
});

router.post('/activity-logs', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    if (!patient.allow_journal_entry) {
      return res.status(403).json({ error: 'Journal entries for this student are locked. Permission from your supervising Psychometrician is required before submitting.' });
    }

    const { mood, task_completion, behavioral_episodes, sleep_quality, appetite, observations, log_date, audio_url, audio_duration_sec } = req.body || {};
    if (!mood) return res.status(400).json({ error: 'Mood is required' });
    const cleanAudioUrl = audio_url ? String(audio_url).slice(0, 2000) : null;
    const cleanAudioDur = Number.isInteger(audio_duration_sec)
      ? Math.min(600, Math.max(1, audio_duration_sec))
      : (audio_duration_sec != null && !Number.isNaN(Number(audio_duration_sec))
        ? Math.min(600, Math.max(1, Math.round(Number(audio_duration_sec))))
        : null);
    const targetLogDate = log_date || clinicTodayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetLogDate)) {
      return res.status(400).json({ error: 'Journal date must use YYYY-MM-DD format.' });
    }
    if (targetLogDate > clinicTodayKey()) {
      return res.status(400).json({ error: 'A Daily Journal entry cannot use a future date.' });
    }
    const { data, error } = await supabase
      .from('daily_activity_logs')
      .upsert(
        {
          patient_id: patient.id,
          log_date: targetLogDate,
          mood,
          task_completion: task_completion || null,
          behavioral_episodes: behavioral_episodes || null,
          sleep_quality: sleep_quality || null,
          appetite: appetite || null,
          observations: observations || null,
          audio_url: cleanAudioUrl,
          audio_duration_sec: cleanAudioDur,
          submitted_by_id: req.profile.id,
        },
        { onConflict: 'patient_id,log_date' }
      )
      .select('id, log_date, mood, audio_url, audio_duration_sec')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'submit_student_journal',
      entityType: 'student_journal_entry',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Caregiver'} submitted the Daily Journal for ${patientName(patient)} on ${data.log_date}.`,
    });
    // Notify the assigned clinicians — every other caregiver submission
    // notifies its reviewers; the journal never did, so new entries sat
    // unseen until someone opened the page by chance.
    const staffIds = [patient.treating_psychometrician_id, patient.treating_psychologist_id].filter(Boolean);
    if (staffIds.length > 0) {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('id')
        .in('id', [...new Set(staffIds)])
        .is('deleted_at', null);
      const validIds = new Set((staffProfiles || []).map((p) => p.id));
      const targets = [
        { id: patient.treating_psychometrician_id, link: `/psychometrician/student-journal?patientId=${patient.id}` },
        { id: patient.treating_psychologist_id, link: `/psychologist/student-journal?patientId=${patient.id}` },
      ].filter((t) => t.id && validIds.has(t.id));
      await Promise.all(
        targets.map((t) =>
          createNotification({
            clinicId: patient.clinic_id,
            recipientId: t.id,
            type: 'journal',
            title: 'New student journal entry',
            body: `${capitalizeNamePart(req.profile.display_name) || 'The caregiver'} submitted a Daily Journal entry for ${patientName(patient)} on ${data.log_date}.`,
            link: t.link,
          }),
        ),
      );
    }
    res.status(201).json({ log: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/activity-logs/:id', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    if (!patient.allow_journal_entry) {
      return res.status(403).json({ error: 'Journal editing for this student is locked. Permission from your supervising Psychometrician is required.' });
    }

    const { data, error } = await supabase
      .from('daily_activity_logs')
      .delete()
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'delete_student_journal',
      entityType: 'student_journal_entry',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Caregiver'} deleted a Daily Journal entry for ${patientName(patient)}.`,
      severity: 'warn',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- appointments ----------

router.get('/appointments', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    await completePastAppointments(supabase, patient.clinic_id);
    const [{ data: individualRows, error: individualError }, { data: groupRows, error: groupError }, { data: clinic }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, session_type, location, practitioner_id, status, color_tag, format, notes')
        .eq('patient_id', patient.id)
        .order('starts_at', { ascending: true }),
      supabase
        .from('appointments')
        .select('id, starts_at, session_type, location, practitioner_id, status, color_tag, format, notes, appointment_participants!inner(patient_id)')
        .eq('clinic_id', patient.clinic_id)
        .eq('appointment_participants.patient_id', patient.id)
        .order('starts_at', { ascending: true }),
      supabase.from('clinics').select('name, address, phone, email').eq('id', patient.clinic_id).single(),
    ]);
    if (individualError) return next(individualError);
    if (groupError) return next(groupError);
    const rows = [...new Map([...(individualRows || []), ...(groupRows || [])].map((row) => [row.id, row])).values()];
    const practIds = [...new Set((rows || []).map((r) => r.practitioner_id).filter(Boolean))];
    const { data: pracs } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', practIds.length ? practIds : ['00000000-0000-0000-0000-000000000000']);
    const nameById = Object.fromEntries((pracs || []).map((p) => [p.id, p.display_name]));
    res.json({
      appointments: (rows || []).map((r) => ({
        id: r.id,
        starts_at: r.starts_at,
        session_type: r.session_type,
        location: r.location,
        status: r.status,
        color_tag: r.color_tag,
        format: r.format || 'individual',
        notes: r.notes,
        practitioner: nameById[r.practitioner_id] || null,
      })),
      clinic: clinic || null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- announcements ----------

router.get('/announcements', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
     const { data, error } = await supabase
      .from('announcements')
      .select('id, title, type, body, publish_date, image_url, image_urls, audience, patient_id, employee_id')
      .eq('clinic_id', patient.clinic_id)
      .is('deleted_at', null)
      .or(`patient_id.is.null,patient_id.eq.${patient.id}`)
      .order('publish_date', { ascending: false });
    if (error) return next(error);
    const all = (data || []).filter((a) => {
      if (a.patient_id) {
        return a.patient_id === patient.id;
      }
      if (a.employee_id) {
        return false;
      }
      const aud = a.audience || [];
      return aud.length === 0 || aud.includes('all') || aud.includes('all_clients') || aud.includes('client') || aud.includes('public');
    });
    res.json({
      messages: all.filter((a) => a.type !== 'event'),
      events: all.filter((a) => a.type === 'event'),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- waivers ----------

router.get('/waivers', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const [{ data: types, error }, { data: subs }] = await Promise.all([
      supabase
        .from('document_types')
        .select('code, title, description, category')
        .in('category', ['admission', 'waiver'])
        .neq('code', 'CMPS:SE-FO-13')
        .order('code', { ascending: true }),
      supabase.from('waiver_submissions').select('document_type_code, status, due_date, review_comment').eq('patient_id', patient.id),
    ]);
    if (error) return next(error);

    const submissionByCode = Object.fromEntries((subs || []).map((s) => [s.document_type_code, s]));
    const admissionIsComplete = patient.admission_form_status === 'complete';
    
    res.json({
      forms: (types || []).map((t) => ({
        code: t.code,
        title: t.title,
        description: t.description,
        category: t.category,
        status:
          t.code === 'CMPS:SE-FO-01'
            ? (admissionIsComplete ? 'approved' : submissionByCode[t.code]?.status || 'not_started')
            : (submissionByCode[t.code]?.status || 'not_started'),
        review_comment: submissionByCode[t.code]?.review_comment || null,
        due_date: null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/pdfs/:code', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const code = decodeURIComponent(req.params.code || '');
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const [{ data: clinical, error: clinicalError }, { data: guardians, error: guardianError }, { data: emergency, error: emergencyError }, { data: submission, error: submissionError }] = await Promise.all([
      supabase.from('clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
      supabase.from('guardians').select('*').eq('patient_id', patient.id).order('is_primary', { ascending: false }),
      supabase.from('emergency_contacts').select('*').eq('patient_id', patient.id).limit(1).maybeSingle(),
      code === 'CMPS:SE-FO-01'
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('waiver_submissions').select('*').eq('patient_id', patient.id).eq('document_type_code', code).maybeSingle(),
    ]);
    if (clinicalError) throw clinicalError;
    if (guardianError) throw guardianError;
    if (emergencyError) throw emergencyError;
    if (submissionError) throw submissionError;
    if (code !== 'CMPS:SE-FO-01' && !submission) return res.status(404).json({ error: 'No submitted database record exists for this form.' });

    const profileIds = [patient.treating_psychologist_id, patient.treating_psychometrician_id].filter(Boolean);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, middle_name, last_name, phone, license_no, title')
      .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);
    if (profileError) throw profileError;
    const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    const bundle = {
      patient: {
        ...patient,
        full_name: patientName(patient),
        photo_url: patient.photo_url || patient.patients?.photo_url || null,
        treating_psychologist: profileById[patient.treating_psychologist_id] || null,
        treating_psychometrician: profileById[patient.treating_psychometrician_id] || null,
      },
      clinical: clinical || {},
      guardians: guardians || [],
      emergency: emergency || {},
    };
    // Anti-forgery: saved ink never renders on client-side PDFs. Names, dates,
    // and credentials stay printed; the complete signed copy lives only on
    // the admin clinical-records endpoints.
    const bytes = await renderFormPdf({ code, bundle, submission, report: submission, requestingUser: req.profile, hideSignatures: true });
    const filename = `${patient.patient_id || patient.id}-${code.replace(/[:]/g, '-')}.pdf`;
    try {
      await writeAudit({
        clinicId: patient.clinic_id,
        actorId: req.profile?.id,
        action: 'export_pdf',
        entityType: 'document',
        entityId: patient.id,
        summary: `${req.profile?.display_name || req.profile?.email || 'Client'} downloaded ${filename}.`,
      });
    } catch {
      // ignore — download already succeeded
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(bytes);
  } catch (err) {
    next(err);
  }
});

router.get('/assessment-document-release-requests/:id/pdf', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const { data: request, error: requestError } = await supabase
      .from('assessment_document_release_requests')
      .select('id, patient_id, status, scheduled_date, scheduled_start_time, scheduled_end_time, location, payment_status, payment_method, paid_at, released_at, admin_note, created_at, updated_at')
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .maybeSingle();
    if (requestError) return next(requestError);
    if (!request) return res.status(404).json({ error: 'Assessment document pick-up slip not found.' });
    if (!['scheduled', 'released'].includes(request.status)) {
      return res.status(409).json({ error: 'The pick-up slip is available after the clinic schedules the request.' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('assessment_document_release_items')
      .select('id, title, document_type_code, fee')
      .eq('request_id', request.id)
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: true });
    if (itemsError) return next(itemsError);

    const bytes = await renderAssessmentReleaseSlipPdf({
      studentName: patientName(patient),
      patientId: patient.patient_id || patient.id,
      request: {
        ...request,
        total_amount: (items || []).reduce((sum, item) => sum + Number(item.fee || 0), 0),
      },
      items: items || [],
      requestingUser: req.profile,
    });
    const filename = `${patient.patient_id || patient.id}-assessment-pick-up-slip.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(bytes);
  } catch (err) {
    next(err);
  }
});

router.get('/waivers/:code', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const { data, error } = await supabase
      .from('waiver_submissions')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('document_type_code', req.params.code)
      .maybeSingle();
    if (error) return next(error);
    res.json({ submission: data });
  } catch (err) {
    next(err);
  }
});

router.post('/waivers/:code', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const { code } = req.params;
    const { provisions_agreed, house_rules_agreed, signature_text } = req.body || {};
    
    if (!provisions_agreed) {
      return res.status(400).json({ error: 'Provisions are required.' });
    }

    // The client submitting always sets status to 'submitted'
    const payload = {
      patient_id: patient.id,
      document_type_code: code,
      status: 'submitted',
      provisions_agreed,
      house_rules_agreed: house_rules_agreed || false,
      signature_text: signature_text || '',
      signed_at: new Date().toISOString(),
      review_comment: null,
    };

    const { data: existing } = await supabase
      .from('waiver_submissions')
      .select('id, status')
      .eq('patient_id', patient.id)
      .eq('document_type_code', code)
      .maybeSingle();

    let saved;
    if (existing) {
      if (existing.status === 'approved') {
        return res.status(403).json({ error: 'This form is already approved and cannot be modified.' });
      }
      const { data, error } = await supabase
        .from('waiver_submissions')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from('waiver_submissions')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    }

    await writeAudit({
      clinicId: req.profile.clinic_id,
      actorId: req.profile.id,
      action: 'submit_waiver',
      entityType: 'waiver_submission',
      entityId: saved.id,
      summary: `${req.profile.display_name || 'Caregiver'} submitted compliance form ${code} for ${patient.first_name}.`,
    });

    // Alert admins so the submission can be reviewed and student compliance completed.
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, role, extra_roles')
      .eq('clinic_id', patient.clinic_id)
      .is('deleted_at', null);
    await Promise.all((staff || [])
      .filter((profile) => ['admin', 'super_admin'].includes(profile.role)
        || (profile.extra_roles || []).includes('admin')
        || (profile.extra_roles || []).includes('super_admin'))
      .map((profile) => createNotification({
        clinicId: patient.clinic_id,
        recipientId: profile.id,
        type: 'waiver',
        title: 'Consent & waiver submitted for review',
        body: `${req.profile.display_name || 'A caregiver'} submitted ${code} for ${patientName(patient)}. Review it in Compliance to complete student enrollment.`,
        link: `/admin/compliance?patientId=${patient.id}`,
      })));

    res.json({ ok: true, submission: saved });
  } catch (err) {
    next(err);
  }
});

// ---------- assessments ----------

// Client selects one or more completed assessment documents for a single
// clinic release request. The administrator owns the schedule, pricing, and
// payment workflow after this request is created.
router.get('/assessments', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const [
      { data: assignments, error: assignmentsError },
      { data: submissions, error: submissionsError },
      { data: templates, error: templatesError },
      { data: behavioralReports, error: reportsError },
      { data: iepReports, error: iepError },
      { data: progressReports, error: progressError },
      { data: sessionLogs, error: sessionLogsError },
      { data: releaseRequests, error: releaseError },
    ] = await Promise.all([
      supabase
        .from('assessment_assignments')
        .select('id, template_id, status, due_date, assigned_by_id, profiles!assigned_by_id(display_name)')
        .eq('patient_id', patient.id)
        .in('status', ['assigned', 'in_progress']),
      supabase
        .from('assessment_submissions')
        .select('id, template_id, status, total_score, max_score, metadata, submitted_at, created_at, respondent_name')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false }),
      supabase.from('assessment_templates').select('id, title, icon, document_type_code, est_minutes, structure'),
      supabase
        .from('assessment_reports')
        .select('id, status, report_type, title, document_type_code, created_at, updated_at, finalized_at')
        .eq('patient_id', patient.id)
        .eq('report_type', 'behavioral')
        .order('updated_at', { ascending: false }),
      supabase
        .from('assessment_reports')
        .select('id, status, report_type, title, document_type_code, period, created_at, updated_at, finalized_at')
        .eq('patient_id', patient.id)
        .eq('report_type', 'iep')
        .order('updated_at', { ascending: false }),
      supabase
        .from('assessment_reports')
        .select('id, status, report_type, title, document_type_code, period, created_at, updated_at, finalized_at')
        .eq('patient_id', patient.id)
        .in('report_type', ['progress_summary'])
        .order('updated_at', { ascending: false }),
      supabase
        .from('session_logs')
        .select('id, status, session_date, created_at, updated_at')
        .eq('patient_id', patient.id)
        .in('status', ['approved'])
        .order('session_date', { ascending: false }),
      supabase
        .from('assessment_document_release_requests')
        .select('id, patient_id, status, scheduled_date, scheduled_start_time, scheduled_end_time, location, payment_status, payment_method, payment_preference, paymongo_checkout_url, paid_at, released_at, declined_reason, admin_note, client_reason, created_at, updated_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false }),
    ]);

    if (assignmentsError) return next(assignmentsError);
    if (submissionsError) return next(submissionsError);
    if (templatesError) return next(templatesError);
    if (reportsError) return next(reportsError);
    if (releaseError) return next(releaseError);
    if (iepError) console.error('[client] iep reports query failed:', iepError.message);
    if (progressError) console.error('[client] progress reports query failed:', progressError.message);
    if (sessionLogsError) console.error('[client] session logs query failed:', sessionLogsError.message);

    let permissions = [];
    try {
      const { data, error } = await supabase
        .from('assessment_permissions')
        .select('template_id, status')
        .eq('patient_id', patient.id)
        .eq('status', 'granted');
      if (error) throw error;
      permissions = data || [];
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        const { localPermissionsStore } = require('../lib/permissions');
        permissions = Array.from(localPermissionsStore.values()).filter(
          (p) => p.patient_id === patient.id && p.status === 'granted',
        );
      } else {
        throw dbErr;
      }
    }

    const grantedTemplateIds = new Set(permissions.map((p) => p.template_id));
    const templateById = Object.fromEntries((templates || []).map((t) => [t.id, t]));
    const templateByCode = Object.fromEntries((templates || []).map((t) => [t.document_type_code, t]));
    const latestSubmissions = dedupeLatestBy(
      submissions || [],
      (s) => `${s.patient_id || patient.id}:${s.template_id}`,
      ['submitted_at', 'created_at'],
    );
    const activeAssignments = (assignments || []).filter((a) => grantedTemplateIds.has(a.template_id));

    const records = latestSubmissions.map((submission) => {
      const template = templateById[submission.template_id] || {};
      return {
        id: submission.id,
        sourceTable: 'assessment_submissions',
        template_id: submission.template_id,
        code: template.document_type_code || null,
        title: template.title || 'Completed Assessment',
        icon: template.icon || null,
        est_minutes: template.est_minutes || null,
        status: submission.status,
        total_score: submission.total_score,
        max_score: submission.max_score,
        submitted_at: submission.submitted_at || submission.created_at,
        metadata: submission.metadata || {},
        by: submission.respondent_name || 'Clinician',
      };
    });

    const latestBehavioralReport = (behavioralReports || [])[0] || null;
    if (latestBehavioralReport) {
      const reportTemplate = templateByCode[latestBehavioralReport.document_type_code] || {};
      records.push({
        id: latestBehavioralReport.id,
        sourceTable: 'assessment_reports',
        template_id: reportTemplate.id || null,
        code: latestBehavioralReport.document_type_code || 'CMPS:SE-FO-06',
        title: latestBehavioralReport.title || 'Behavioral Assessment Report',
        est_minutes: reportTemplate.est_minutes || null,
        status: latestBehavioralReport.status,
        submitted_at: latestBehavioralReport.finalized_at || latestBehavioralReport.updated_at || latestBehavioralReport.created_at,
        by: 'Clinical Care Team',
      });
    }

    const requestIds = (releaseRequests || []).map((request) => request.id);
    const { data: releaseItems, error: releaseItemsError } = requestIds.length
      ? await supabase
        .from('assessment_document_release_items')
        .select('id, request_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee')
        .in('request_id', requestIds)
      : { data: [], error: null };
    if (releaseItemsError) return next(releaseItemsError);

    const itemsByRequest = {};
    (releaseItems || []).forEach((item) => {
      if (!itemsByRequest[item.request_id]) itemsByRequest[item.request_id] = [];
      itemsByRequest[item.request_id].push(item);
    });
    const releaseBySource = {};
    const formattedRequests = (releaseRequests || []).map((request) => {
      const formatted = formatReleaseRequest(request, itemsByRequest[request.id] || []);
      formatted.items.forEach((item) => {
        const key = sourceKey(item.source_table, item.source_id);
        if (!releaseBySource[key]) {
          releaseBySource[key] = {
            request_id: formatted.id,
            status: formatted.status,
            fee: item.fee,
          };
        }
      });
      return formatted;
    });

    const COMPLETED_REPORT_STATUSES = new Set(['scored', 'approved', 'finalized']);

    const progressRecords = [];

    (iepReports || []).forEach((report) => {
      if (!COMPLETED_REPORT_STATUSES.has(report.status)) return;
      const existingRelease = releaseBySource[sourceKey('assessment_reports', report.id)];
      progressRecords.push({
        id: report.id,
        sourceTable: 'assessment_reports',
        code: report.document_type_code || 'CMPS:SE-FO-10',
        title: report.title || 'Individualized Education Plan',
        status: report.status,
        completed_at: report.finalized_at || report.updated_at,
        category: 'progress',
        group: 'iep',
        period: report.period || null,
        release: existingRelease || null,
      });
    });

    (progressReports || []).forEach((report) => {
      if (!COMPLETED_REPORT_STATUSES.has(report.status)) return;
      const existingRelease = releaseBySource[sourceKey('assessment_reports', report.id)];
      progressRecords.push({
        id: report.id,
        sourceTable: 'assessment_reports',
        code: report.document_type_code || 'CMPS:SE-FO-09',
        title: report.title || 'Monthly Assessment Report',
        status: report.status,
        completed_at: report.finalized_at || report.updated_at,
        category: 'progress',
        group: 'monthly',
        period: report.period || null,
        release: existingRelease || null,
      });
    });

    (sessionLogs || []).forEach((log) => {
      const existingRelease = releaseBySource[sourceKey('session_logs', log.id)];
      progressRecords.push({
        id: log.id,
        sourceTable: 'session_logs',
        code: 'CMPS:SE-FO-07',
        title: 'Daily Activity Report',
        status: log.status,
        completed_at: log.updated_at || log.created_at,
        category: 'progress',
        group: 'daily',
        session_date: log.session_date || null,
        release: existingRelease || null,
      });
    });

    progressRecords.sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

    res.json({
      assigned: activeAssignments.map((assignment) => {
        const template = templateById[assignment.template_id] || {};
        return {
          id: assignment.id,
          template_id: assignment.template_id,
          title: template.title,
          code: template.document_type_code,
          icon: template.icon,
          status: assignment.status,
          due_date: assignment.due_date,
          assigned_by: assignment.profiles?.display_name || 'Clinic Staff',
        };
      }),
      records: records.map((record) => ({
        ...record,
        release: releaseBySource[sourceKey(record.sourceTable, record.id)] || null,
      })),
      progressRecords,
      templates: (templates || []).map((template) => ({
        id: template.id,
        title: template.title,
        code: template.document_type_code,
        icon: template.icon,
        est_minutes: template.est_minutes,
      })),
      releaseRequests: formattedRequests,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/assessments/document-release-requests', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const uniqueItems = [...new Map(requestedItems
      .filter((item) => SOURCE_TABLES.has(item?.source_table) && item?.record_id)
      .map((item) => [sourceKey(item.source_table, item.record_id), item])).values()];
    if (!uniqueItems.length || uniqueItems.length > 10) {
      return res.status(400).json({ error: 'Select between one and ten completed assessment documents.' });
    }

    const submissionIds = uniqueItems.filter((item) => item.source_table === 'assessment_submissions').map((item) => item.record_id);
    const reportIds = uniqueItems.filter((item) => item.source_table === 'assessment_reports').map((item) => item.record_id);
    const sessionLogIds = uniqueItems.filter((item) => item.source_table === 'session_logs').map((item) => item.record_id);
    const [{ data: submissions, error: submissionsError }, { data: reports, error: reportsError }, { data: sessionLogs, error: sessionLogsError }] = await Promise.all([
      submissionIds.length
        ? supabase.from('assessment_submissions').select('id, patient_id, template_id, status, submitted_at, created_at').eq('patient_id', patient.id).in('id', submissionIds)
        : Promise.resolve({ data: [], error: null }),
      reportIds.length
        ? supabase.from('assessment_reports').select('id, patient_id, status, report_type, title, document_type_code, finalized_at, updated_at, created_at').eq('patient_id', patient.id).in('id', reportIds)
        : Promise.resolve({ data: [], error: null }),
      sessionLogIds.length
        ? supabase.from('session_logs').select('id, patient_id, status, session_date, created_at, updated_at').eq('patient_id', patient.id).in('id', sessionLogIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (submissionsError) return next(submissionsError);
    if (reportsError) return next(reportsError);
    if (sessionLogsError) return next(sessionLogsError);

    const templateIds = [...new Set((submissions || []).map((submission) => submission.template_id).filter(Boolean))];
    const { data: templates, error: templatesError } = templateIds.length
      ? await supabase.from('assessment_templates').select('id, title, document_type_code').in('id', templateIds)
      : { data: [], error: null };
    if (templatesError) return next(templatesError);
    const templateById = Object.fromEntries((templates || []).map((template) => [template.id, template]));
    const available = new Map();
    (submissions || []).forEach((submission) => {
      if (!RELEASE_APPROVED_ASSESSMENT_STATUSES.has(submission.status)) return;
      const template = templateById[submission.template_id] || {};
      available.set(sourceKey('assessment_submissions', submission.id), {
        source_table: 'assessment_submissions',
        source_id: submission.id,
        patient_id: patient.id,
        template_id: submission.template_id,
        document_type_code: template.document_type_code || null,
        title: template.title || 'Completed Assessment',
        completed_at: submission.submitted_at || submission.created_at,
        fee: 0,
      });
    });
    (reports || []).forEach((report) => {
      available.set(sourceKey('assessment_reports', report.id), {
        source_table: 'assessment_reports',
        source_id: report.id,
        patient_id: patient.id,
        template_id: null,
        document_type_code: report.document_type_code || null,
        title: report.title || 'Assessment Report',
        completed_at: report.finalized_at || report.updated_at || report.created_at,
        fee: 0,
      });
    });
    (sessionLogs || []).forEach((log) => {
      available.set(sourceKey('session_logs', log.id), {
        source_table: 'session_logs',
        source_id: log.id,
        patient_id: patient.id,
        template_id: null,
        document_type_code: 'CMPS:SE-FO-07',
        title: 'Daily Activity Report',
        completed_at: log.updated_at || log.created_at,
        fee: 0,
      });
    });

    const items = uniqueItems.map((item) => available.get(sourceKey(item.source_table, item.record_id))).filter(Boolean);
    if (items.length !== uniqueItems.length) {
      return res.status(409).json({ error: 'One or more selected documents are no longer available for release.' });
    }

    const { data: openRequests, error: openRequestsError } = await supabase
      .from('assessment_document_release_requests')
      .select('id')
      .eq('patient_id', patient.id)
      .in('status', ACTIVE_RELEASE_STATUSES);
    if (openRequestsError) return next(openRequestsError);
    const openRequestIds = (openRequests || []).map((request) => request.id);
    if (openRequestIds.length) {
      const { data: openItems, error: openItemsError } = await supabase
        .from('assessment_document_release_items')
        .select('source_table, source_id')
        .in('request_id', openRequestIds);
      if (openItemsError) return next(openItemsError);
      const openKeys = new Set((openItems || []).map((item) => sourceKey(item.source_table, item.source_id)));
      if (items.some((item) => openKeys.has(sourceKey(item.source_table, item.source_id)))) {
        return res.status(409).json({ error: 'A selected document is already included in an open release request.' });
      }
    }

    // Validate payment_preference
    const paymentPreferenceRaw = String(req.body?.payment_preference || 'onsite').toLowerCase();
    const paymentPreference = ['onsite', 'online'].includes(paymentPreferenceRaw) ? paymentPreferenceRaw : 'onsite';

    const clientReason = req.body?.client_reason?.trim() || null;

    const { data: request, error: requestError } = await supabase
      .from('assessment_document_release_requests')
      .insert({
        clinic_id: patient.clinic_id,
        patient_id: patient.id,
        requested_by_id: req.profile.id,
        status: 'pending',
        payment_preference: paymentPreference,
        client_reason: clientReason,
      })
      .select('id, patient_id, status, payment_status, payment_preference, location, client_reason, created_at, updated_at')
      .single();
    if (requestError) return res.status(400).json({ error: requestError.message });

    const { data: savedItems, error: itemsError } = await supabase
      .from('assessment_document_release_items')
      .insert(items.map((item) => ({ ...item, request_id: request.id })))
      .select('id, request_id, source_table, source_id, template_id, document_type_code, title, completed_at, fee');
    if (itemsError) {
      await supabase.from('assessment_document_release_requests').delete().eq('id', request.id);
      return res.status(400).json({ error: itemsError.message });
    }

    const { data: staff } = await supabase
      .from('profiles')
      .select('id, role, extra_roles')
      .eq('clinic_id', patient.clinic_id)
      .is('deleted_at', null);
    await Promise.all((staff || [])
      .filter((profile) => profile.role === 'admin' || (profile.extra_roles || []).includes('admin'))
      .map((profile) => createNotification({
        clinicId: patient.clinic_id,
        recipientId: profile.id,
        type: 'assessment',
        title: 'Assessment document release requested',
        body: `${req.profile.display_name || 'A client'} requested ${items.length} completed assessment document${items.length === 1 ? '' : 's'} for ${patientName(patient)}. Payment method preference: ${paymentPreference === 'online' ? 'Online (PayMongo)' : 'Pay Onsite'}.`,
        link: '/admin/schedule',
      })));
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'request_assessment_document_release',
      entityType: 'assessment_document_release_request',
      entityId: request.id,
      summary: `${req.profile.display_name || 'Client'} requested ${items.length} completed assessment document${items.length === 1 ? '' : 's'} for ${patientName(patient)}. Payment preference: ${paymentPreference}.`,
    });

    res.status(201).json({ request: formatReleaseRequest(request, savedItems || []) });
  } catch (err) {
    next(err);
  }
});

// Legacy route retained only to return a clear migration response to old clients.
router.get('/assessments-legacy', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    return res.status(410).json({ error: 'The per-document onsite viewing workflow has been replaced by admin-managed document releases.' });
    const [
      { data: assignments },
      { data: submissions },
      { data: templates },
      { data: behavioralReports },
    ] = await Promise.all([
      supabase
        .from('assessment_assignments')
        .select('id, template_id, status, due_date, assigned_by_id, profiles!assigned_by_id(display_name)')
        .eq('patient_id', patient.id)
        .in('status', ['assigned', 'in_progress']),
      supabase
        .from('assessment_submissions')
        .select('id, template_id, status, total_score, max_score, metadata, submitted_at, created_at, respondent_name, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false }),
      supabase.from('assessment_templates').select('id, title, icon, document_type_code, structure, est_minutes'),
      supabase
        .from('assessment_reports')
        .select('id, status, report_type, title, created_at, updated_at, finalized_at, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
        .eq('patient_id', patient.id)
        .eq('report_type', 'behavioral')
        .order('updated_at', { ascending: false }),
    ]);

    let permissions = [];
    try {
      const { data, error } = await supabase
        .from('assessment_permissions')
        .select('template_id, status')
        .eq('patient_id', patient.id)
        .eq('status', 'granted');
      if (error) throw error;
      permissions = data || [];
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        const { localPermissionsStore } = require('../lib/permissions');
        permissions = Array.from(localPermissionsStore.values()).filter(
          (p) => p.patient_id === patient.id && p.status === 'granted'
        );
      } else {
        throw dbErr;
      }
    }

    const grantedTemplateIds = new Set(permissions.map((p) => p.template_id));
    const activeAssignments = (assignments || []).filter((a) => grantedTemplateIds.has(a.template_id));

    const latestSubmissions = dedupeLatestBy(
      submissions || [],
      (s) => `${s.patient_id}:${s.template_id}`,
      ['submitted_at', 'created_at'],
    );

    const tplById = Object.fromEntries((templates || []).map((t) => [t.id, t]));
    const behavioralTemplate = (templates || []).find(
      (template) => template.document_type_code === 'CMPS:SE-FO-06',
    );
    const latestBehavioralReport = (behavioralReports || [])[0] || null;
    const standardizedRecords = latestSubmissions.map((s) => {
      const t = tplById[s.template_id] || {};
      return {
        id: s.id,
        sourceTable: 'assessment_submissions',
        template_id: s.template_id,
        code: t.document_type_code || null,
        title: t.title,
        icon: t.icon,
        status: s.status,
        total_score: s.total_score,
        max_score: s.max_score,
        submitted_at: s.submitted_at || s.created_at,
        metadata: s.metadata || {},
        by: s.respondent_name || 'Clinician',
        onsite_view_status: s.onsite_view_status === 'not_requested' ? null : s.onsite_view_status || null,
        onsite_view_requested_at: s.onsite_view_requested_at || null,
        onsite_view_date: s.onsite_view_date || null,
        onsite_view_options: storedOnsiteOptions(s.onsite_view_options),
        onsite_view_selected_at: s.onsite_view_selected_at || null,
      };
    });

    if (latestBehavioralReport) {
      standardizedRecords.push({
        id: latestBehavioralReport.id,
        sourceTable: 'assessment_reports',
        template_id: behavioralTemplate?.id || null,
        code: 'CMPS:SE-FO-06',
        title: latestBehavioralReport.title || 'Behavioral Assessment Report',
        icon: behavioralTemplate?.icon || null,
        status: latestBehavioralReport.status,
        submitted_at:
          latestBehavioralReport.finalized_at ||
          latestBehavioralReport.updated_at ||
          latestBehavioralReport.created_at,
        by: 'Clinical Care Team',
        onsite_view_status:
          latestBehavioralReport.onsite_view_status === 'not_requested'
            ? null
            : latestBehavioralReport.onsite_view_status || null,
        onsite_view_requested_at: latestBehavioralReport.onsite_view_requested_at || null,
        onsite_view_date: latestBehavioralReport.onsite_view_date || null,
        onsite_view_options: storedOnsiteOptions(latestBehavioralReport.onsite_view_options),
        onsite_view_selected_at: latestBehavioralReport.onsite_view_selected_at || null,
      });
    }

    res.json({
      assigned: activeAssignments.map((a) => {
        const t = tplById[a.template_id] || {};
        return {
          id: a.id,
          template_id: a.template_id,
          title: t.title,
          code: t.document_type_code,
          icon: t.icon,
          status: a.status,
          due_date: a.due_date,
          assigned_by: a.profiles?.display_name || 'Clinic Staff',
        };
      }),
      records: standardizedRecords,
      templates: (templates || []).map((t) => ({
        id: t.id,
        title: t.title,
        code: t.document_type_code,
        icon: t.icon,
        est_minutes: t.est_minutes,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Request an onsite appointment to view an already approved assessment.
// No document contents or digital copy are made available to the client.
router.post('/assessments/onsite-view-requests', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    return res.status(410).json({ error: 'The per-document onsite viewing workflow has been replaced by admin-managed document releases.' });
    const { source_table, record_id } = req.body || {};
    if (!ONSITE_VIEW_SOURCE_TABLES.has(source_table) || !record_id) {
      return res.status(400).json({ error: 'source_table and record_id are required.' });
    }

    const patient = await requirePatient(req, res);
    if (!patient) return;
    if (!patient.treating_psychologist_id) {
      return res.status(409).json({ error: 'No supervising psychologist is assigned to this student yet.' });
    }

    const { data: record, error: recordError } = await supabase
      .from(source_table)
      .select(source_table === 'assessment_reports'
        ? 'id, patient_id, status, report_type, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at'
        : 'id, patient_id, status, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
      .eq('id', record_id)
      .eq('patient_id', patient.id)
      .maybeSingle();
    if (recordError) return next(recordError);
    if (!record) return res.status(404).json({ error: 'Assessment record not found.' });
    if (!APPROVED_ASSESSMENT_STATUSES.has(record.status)) {
      return res.status(403).json({ error: 'An onsite viewing appointment can only be requested after psychologist approval.' });
    }
    if (source_table === 'assessment_reports' && record.report_type !== 'behavioral') {
      return res.status(400).json({ error: 'Unsupported assessment report type.' });
    }

    const currentStatus = record.onsite_view_status || 'not_requested';
    const currentRequest = {
      id: record.id,
      source_table,
      source_id: record.id,
      status: currentStatus,
      requested_at: record.onsite_view_requested_at || null,
      scheduled_date: record.onsite_view_date || null,
      options: storedOnsiteOptions(record.onsite_view_options),
      selected_at: record.onsite_view_selected_at || null,
    };
    if (['options_proposed', 'scheduled'].includes(currentStatus)) {
      return res.status(409).json({ error: currentStatus === 'options_proposed' ? 'Available onsite viewing dates are already waiting for your selection.' : 'An onsite viewing date has already been scheduled for this document.', request: currentRequest });
    }
    if (currentStatus === 'pending') {
      return res.json({ request: currentRequest });
    }

    const { data: updatedRecord, error: requestError } = await supabase
      .from(source_table)
      .update({
        onsite_view_status: 'pending',
        onsite_view_requested_by_id: req.profile.id,
        onsite_view_requested_at: new Date().toISOString(),
        onsite_view_date: null,
        onsite_view_options: [],
        onsite_view_selected_at: null,
        onsite_view_selected_by_id: null,
        onsite_view_scheduled_by_id: null,
        onsite_view_scheduled_at: null,
      })
      .eq('id', record.id)
      .eq('patient_id', patient.id)
      .select('id, onsite_view_status, onsite_view_requested_at, onsite_view_date, onsite_view_options, onsite_view_selected_at')
      .single();
    if (requestError) {
      return res.status(503).json({ error: 'Onsite viewing is not configured yet. Apply the latest database migration.' });
    }
    const request = {
      id: updatedRecord.id,
      source_table,
      source_id: updatedRecord.id,
      status: updatedRecord.onsite_view_status,
      requested_at: updatedRecord.onsite_view_requested_at,
      scheduled_date: updatedRecord.onsite_view_date,
      options: storedOnsiteOptions(updatedRecord.onsite_view_options),
      selected_at: updatedRecord.onsite_view_selected_at || null,
    };

    const title = source_table === 'assessment_reports' ? 'Behavioral Assessment Report' : 'completed assessment';
    await createNotification({
      clinicId: patient.clinic_id,
      recipientId: patient.treating_psychologist_id,
      type: 'assessment',
      title: 'Onsite document viewing requested',
      body: `${req.profile.display_name || 'The client'} requested an onsite viewing appointment for the approved ${title} for ${patientName(patient)}.`,
      link: `/psychologist/approvals?patientId=${patient.id}`,
    });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'request_assessment_onsite_view',
      entityType: source_table,
      entityId: record.id,
      summary: `${req.profile.display_name || 'Client'} requested an onsite viewing appointment for an approved ${title} for ${patientName(patient)}.`,
      severity: 'info',
    });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

// Select one of the dates proposed by the psychologist. This only schedules
// the onsite visit; it never returns the document itself.
router.post('/assessments/onsite-view-requests/select', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    return res.status(410).json({ error: 'The per-document onsite viewing workflow has been replaced by admin-managed document releases.' });
    const { source_table, record_id, selected_at } = req.body || {};
    if (!ONSITE_VIEW_SOURCE_TABLES.has(source_table) || !record_id || !selected_at) {
      return res.status(400).json({ error: 'source_table, record_id, and selected_at are required.' });
    }
    const selectedDate = String(selected_at || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return res.status(400).json({ error: 'Please select a valid onsite viewing date.' });
    }
    if (!isOnsiteWeekday(selectedDate)) {
      return res.status(400).json({ error: 'Onsite viewing is only available on weekdays.' });
    }
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const { data: record, error: recordError } = await supabase
      .from(source_table)
      .select(source_table === 'assessment_reports'
        ? 'id, patient_id, status, report_type, onsite_view_status, onsite_view_options'
        : 'id, patient_id, status, onsite_view_status, onsite_view_options')
      .eq('id', record_id)
      .eq('patient_id', patient.id)
      .maybeSingle();
    if (recordError) return next(recordError);
    if (!record) return res.status(404).json({ error: 'Assessment record not found.' });
    if (record.onsite_view_status !== 'options_proposed') {
      return res.status(409).json({ error: 'The psychologist has not proposed onsite viewing dates yet.' });
    }
    if (!APPROVED_ASSESSMENT_STATUSES.has(record.status)) {
      return res.status(409).json({ error: 'This assessment is no longer approved for onsite viewing.' });
    }
    if (source_table === 'assessment_reports' && record.report_type !== 'behavioral') {
      return res.status(400).json({ error: 'Unsupported assessment report type.' });
    }
    const normalizedOptions = storedOnsiteOptions(record.onsite_view_options);
    if (!normalizedOptions.includes(selectedDate)) {
      return res.status(400).json({ error: 'Please select one of the available onsite viewing dates.' });
    }

    const { data: updated, error: updateError } = await supabase
      .from(source_table)
      .update({
        onsite_view_status: 'scheduled',
        onsite_view_selected_at: new Date(`${selectedDate}T00:00:00.000Z`).toISOString(),
        onsite_view_selected_by_id: req.profile.id,
        onsite_view_date: selectedDate,
        onsite_view_scheduled_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .eq('patient_id', patient.id)
      .select('id, onsite_view_status, onsite_view_date, onsite_view_selected_at, onsite_view_options')
      .single();
    if (updateError) return next(updateError);

    const title = source_table === 'assessment_reports' ? 'Behavioral Assessment Report' : 'completed assessment';
    const formattedDate = new Date(`${selectedDate}T00:00:00.000Z`).toLocaleDateString('en-US', {
      dateStyle: 'long',
    });
    await createNotification({
      clinicId: patient.clinic_id,
      recipientId: patient.treating_psychologist_id,
      type: 'assessment',
      title: 'Onsite viewing date selected',
      body: `${req.profile.display_name || 'The client'} selected ${formattedDate} for onsite viewing of the ${title} for ${patientName(patient)}.`,
      link: `/psychologist/approvals?patientId=${patient.id}`,
    });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'select_assessment_onsite_view_date',
      entityType: source_table,
      entityId: record.id,
      summary: `${req.profile.display_name || 'Client'} selected ${formattedDate} for onsite viewing of the ${title} for ${patientName(patient)}.`,
      severity: 'info',
    });
    res.json({
      request: {
        id: updated.id,
        source_table,
        source_id: updated.id,
        status: updated.onsite_view_status,
        scheduled_date: updated.onsite_view_date,
        selected_at: updated.onsite_view_selected_at,
        options: storedOnsiteOptions(updated.onsite_view_options),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Assessment documents are available for onsite viewing at the clinic only.
// Keep this endpoint as a hard fail so old client URLs cannot expose PDFs.
router.get('/assessments/:recordType/:recordId/pdf', requireAuth, requireClient, async (req, res, next) => {
  return res.status(403).json({
    error: 'Assessment documents are available for onsite viewing at the clinic only. Digital copies are not available to client accounts.',
  });
});

// Load the latest assessment so the caregiver can reopen a completed form.
router.get('/assessments/submission', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    const { template_id: templateId } = req.query;
    if (!templateId) return res.status(400).json({ error: 'Assessment template is required.' });

    const { data: submission, error } = await supabase
      .from('assessment_submissions')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('template_id', templateId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return next(error);

    res.json({ submission: submission || null });
  } catch (err) {
    next(err);
  }
});

// Submit an assessment questionnaire as a caregiver/client
router.post('/assessments/:templateId/submit', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;

    let hasPermission = false;
    try {
      const { data: perm } = await supabase
        .from('assessment_permissions')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('template_id', req.params.templateId)
        .eq('status', 'granted')
        .maybeSingle();
      if (perm) hasPermission = true;
    } catch (dbErr) {
      if (dbErr.code === 'PGRST205' || dbErr.message?.includes('assessment_permissions')) {
        const { localPermissionsStore } = require('../lib/permissions');
        const key = `${patient.id}-${req.params.templateId}`;
        const mockPerm = localPermissionsStore.get(key);
        if (mockPerm && mockPerm.status === 'granted') hasPermission = true;
      } else {
        throw dbErr;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission from your supervising Psychologist/Admin is required to submit this assessment.' });
    }

    const { data: template, error: templateError } = await supabase
      .from('assessment_templates')
      .select('id, document_type_code, title, structure')
      .eq('id', req.params.templateId)
      .maybeSingle();
    if (templateError) return next(templateError);
    if (!template) return res.status(404).json({ error: 'Assessment not found' });

    const {
      answers = {},
      metadata = {},
    } = req.body || {};
    // NOTE: client-sent domain_scores / total_score / max_score are ignored —
    // scores are recomputed server-side below and are the only values saved.
    const assessmentStructure = structureForTemplate(template);
    const incomplete = findIncompleteAssessmentItems(assessmentStructure, answers);
    if (incomplete.length > 0) {
      return res.status(400).json({
        error: `Please answer all assessment items before submitting. ${incomplete.length} item${incomplete.length === 1 ? '' : 's'} still need a response.`,
      });
    }

    // Server-authoritative scoring (same rule as the staff submit path).
    const serverTotals = scoreAssessment(assessmentStructure, answers);
    const serverDomainScores = {};
    for (const d of Array.isArray(assessmentStructure) ? assessmentStructure : []) {
      const items = Array.isArray(d?.items) ? d.items : [];
      if (!d?.key || items.length === 0) continue;
      const score = items.filter((it) => String(responseValue(answers, it.key)).toLowerCase() === 'yes').length;
      serverDomainScores[d.key] = { score, max: items.length };
    }
    const scores = { total: serverTotals.total, max: serverTotals.max };
    const payload = {
      patient_id: patient.id,
      template_id: req.params.templateId,
      respondent_profile_id: req.profile.id,
      respondent_name: req.profile.display_name,
      respondent_relationship: 'Parent / Caregiver',
      answers,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      domain_scores: serverDomainScores,
      total_score: scores.total,
      max_score: scores.max,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    };

    const { data: existingSubmission, error: existingError } = await supabase
      .from('assessment_submissions')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('template_id', req.params.templateId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return next(existingError);

    let data;
    if (existingSubmission?.id) {
      const { data: updated, error } = await supabase
        .from('assessment_submissions')
        .update(payload)
        .eq('id', existingSubmission.id)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      data = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('assessment_submissions')
        .insert(payload)
        .select('id, status')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      data = inserted;
    }

    await supabase
      .from('assessment_assignments')
      .update({ status: 'submitted' })
      .eq('patient_id', patient.id)
      .eq('template_id', req.params.templateId)
      .in('status', ['assigned', 'in_progress']);

    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: existingSubmission?.id
        ? 'resubmit_client_assessment'
        : 'submit_client_assessment',
      entityType: 'assessment_submission',
      entityId: data.id,
      summary: `${req.profile.display_name || 'Caregiver'} submitted an assigned assessment for ${patientName(patient)}.`,
    });
    res.status(existingSubmission?.id ? 200 : 201).json({ submission: data });
  } catch (err) {
    next(err);
  }
});

// Get a specific assessment template definition for caregiver
router.get('/assessments/templates/:templateId', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: template, error } = await supabase
      .from('assessment_templates')
      .select('id, title, document_type_code, structure, max_score')
      .eq('id', req.params.templateId)
      .maybeSingle();
    if (error) return next(error);
    if (!template) return res.status(404).json({ error: 'Assessment not found' });
    res.json({
      template: {
        ...template,
        structure: structureForTemplate(template),
        max_score: template.document_type_code === 'CMPS:SE-FO-05' ? 3 : template.max_score,
      },
    });
  } catch (err) {
    next(err);
  }
});

// update the caregiver's child (edit profile)
router.patch('/patient', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const { patient: p = {}, guardian: g = {}, emergency: e = {} } = req.body || {};

    if (p.first_name === '' || p.last_name === '') {
      return res.status(400).json({ error: 'First and last name cannot be empty' });
    }

    const patientFields = [
      'first_name', 'middle_name', 'last_name', 'nick_name', 'date_of_birth', 'sex',
      'home_address', 'contact_number',
    ];
    const required = new Set(['first_name', 'last_name', 'date_of_birth', 'sex']);
    const patientUpdate = {};
    for (const k of patientFields) {
      if (p[k] === undefined) continue;
      patientUpdate[k] = p[k] === '' && !required.has(k) ? null : p[k];
    }
    // A future birthdate is always a data-entry mistake — reject it here so
    // it can never surface as a negative age in rosters and reports.
    if (patientUpdate.date_of_birth && (Number.isNaN(new Date(patientUpdate.date_of_birth).getTime()) || new Date(patientUpdate.date_of_birth) > new Date())) {
      return res.status(400).json({ error: 'Enter a valid date of birth (not in the future).' });
    }
    if (Object.keys(patientUpdate).length) {
      const { error } = await supabase.from('patients').update(patientUpdate).eq('id', patient.id);
      if (error) return res.status(400).json({ error: error.message });
    }

    if (Object.keys(g).length) {
      const upd = {};
      for (const k of ['full_name', 'relationship', 'contact_number', 'email', 'occupation', 'employer']) {
        if (g[k] !== undefined) upd[k] = g[k] === '' ? null : g[k];
      }
      const { data: existing } = await supabase
        .from('guardians')
        .select('id')
        .eq('patient_id', patient.id)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase.from('guardians').update(upd).eq('id', existing.id);
      } else if (upd.full_name) {
        await supabase.from('guardians').insert({ patient_id: patient.id, is_primary: true, ...upd });
      }
    }

    if (Object.keys(e).length) {
      const upd = {};
      for (const k of ['full_name', 'relationship', 'contact_number', 'alt_contact_number', 'address']) {
        if (e[k] !== undefined) upd[k] = e[k] === '' ? null : e[k];
      }
      const { data: existing } = await supabase
        .from('emergency_contacts')
        .select('id')
        .eq('patient_id', patient.id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase.from('emergency_contacts').update(upd).eq('id', existing.id);
      } else if (upd.full_name) {
        await supabase.from('emergency_contacts').insert({ patient_id: patient.id, ...upd });
      }
    }

    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'update_patient_profile',
      entityType: 'patient',
      entityId: patient.id,
      summary: `${req.profile.display_name || 'Caregiver'} updated the profile for ${patientName(patient)}.`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// upload / replace the child's photo
router.post('/patient/photo', requireAuth, requireClient, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const patient = await requirePatient(req, res);
    if (!patient) return;
    const { image } = req.body || {};
    const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(image || '');
    if (!m) {
      return res.status(400).json({ error: 'Provide a PNG, JPEG, or WEBP image' });
    }
    const contentType = m[1];
    const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
    const buffer = Buffer.from(m[3], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image must be under 5 MB' });
    }
    const path = `patients/${patient.id}/${require('crypto').randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('photos')
      .upload(path, buffer, { contentType, upsert: true });
    if (upErr) return res.status(400).json({ error: upErr.message });
    const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
    const photo_url = pub.publicUrl;
    const { error } = await supabase.from('patients').update({ photo_url }).eq('id', patient.id);
    if (error) return res.status(400).json({ error: error.message });
    await writeAudit({
      clinicId: patient.clinic_id,
      actorId: req.profile.id,
      action: 'update_patient_photo',
      entityType: 'patient',
      entityId: patient.id,
      summary: `${req.profile.display_name || 'Caregiver'} updated the profile photo for ${patientName(patient)}.`,
    });
    res.json({ photo_url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

