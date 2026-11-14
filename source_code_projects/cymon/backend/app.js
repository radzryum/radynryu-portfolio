require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { supabase, supabaseConfigured } = require('./lib/supabase');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');
const psychologistRoutes = require('./routes/psychologist');
const psychometricianRoutes = require('./routes/psychometrician');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');
const { friendlyDbError } = require('./lib/dbErrors');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,https://cymon-clearmindpsychologicalservices.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// PayMongo webhook must receive a raw Buffer for HMAC signature verification.
// Register it BEFORE express.json() so the body is not pre-parsed.
app.use(
  '/api/payments/webhook/paymongo',
  express.raw({ type: 'application/json' }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    allowedOrigins,
  });
});

// Scheduled-job endpoint. Sends unscheduled reminder emails too. Protected by a
// static shared secret header (set when calling the cron URL), not by user auth.
app.get('/api/cron/reminders', (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.get('x-cron-secret') !== cronSecret) {
    return res.status(401).json({ error: 'Invalid cron secret.' });
  }
  next();
}, async (req, res, next) => {
  try {
    if (!supabaseConfigured || !supabase) {
      return res.status(500).json({
        error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.',
      });
    }

    const { sendMail } = require('./lib/email');
    const now = new Date();
    const twentyThreeHoursLater = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let appts = [];
    let useFallback = false;

    // Defensive check: Query with reminder_sent
    const { data, error } = await supabase
      .from('appointments')
      .select('id, starts_at, session_type, location, notes, reminder_sent, patients:patients!appointments_patient_id_fkey(first_name, last_name, caregiver_id)')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', twentyFourHoursLater.toISOString())
      .eq('status', 'scheduled');

    if (error && error.message.includes('reminder_sent')) {
      // Fallback: If database column does not exist yet, use time-window fallback [23h, 24h]
      useFallback = true;
      const { data: fbData, error: fbErr } = await supabase
        .from('appointments')
        .select('id, starts_at, session_type, location, notes, patients:patients!appointments_patient_id_fkey(first_name, last_name, caregiver_id)')
        .gte('starts_at', twentyThreeHoursLater.toISOString())
        .lte('starts_at', twentyFourHoursLater.toISOString())
        .eq('status', 'scheduled');

      if (fbErr) return res.status(400).json({ error: fbErr.message });
      appts = fbData || [];
    } else if (error) {
      return res.status(400).json({ error: error.message });
    } else {
      appts = (data || []).filter((a) => !a.reminder_sent);
    }

    let sentCount = 0;
    for (const appt of appts) {
      const pt = appt.patients;
      if (!pt || !pt.caregiver_id) continue;

      const { data: parent } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', pt.caregiver_id)
        .maybeSingle();

      if (parent && parent.email) {
        const starts = new Date(appt.starts_at);
        const when = starts.toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        const studentName = `${pt.first_name} ${pt.last_name}`;
        await sendMail({
          to: parent.email,
          subject: `Reminder: Appointment Tomorrow for ${studentName} - ClearMind Clinic`,
          templateKey: 'appointmentReminder',
          templateData: {
            parent_name: parent.display_name,
            student_name: studentName,
            when,
            location: appt.location || 'ClearMind Clinic',
            session_type: appt.session_type,
            notes: appt.notes || 'None',
          },
        }).catch((e) => console.error(`[cron-email] failed to send reminder to ${parent.email}:`, e.message));

        if (!useFallback) {
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', appt.id)
            .catch(() => {});
        }
        sentCount++;
      }
    }

    res.json({ ok: true, reminders_sent: sentCount, mode: useFallback ? 'fallback' : 'standard' });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/psychologist', psychologistRoutes);
app.use('/api/psychometrician', psychometricianRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  // Never leak raw database text (e.g. `invalid input value for enum ...`)
  // to users — map known DB errors to plain language first.
  res.status(status).json({ error: friendlyDbError(err, err.message || 'Internal Server Error') });
});

module.exports = app;
