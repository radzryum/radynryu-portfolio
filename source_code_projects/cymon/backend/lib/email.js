const { google } = require('googleapis');

// Read env lazily (inside getters) so dotenv load order and Vercel env
// updates can't leave stale/empty values cached at require time.
function env(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : undefined;
}

let gmailClient = null;
let gmailClientKey = null;
let nodemailerFallback = null;
let nodemailerKey = null;
let resendClient = null;
let resendKey = null;

function getPublicAppUrl() {
  return (env('PUBLIC_APP_URL') || 'https://cymon-clearmindpsychologicalservices.vercel.app').replace(/\/+$/, '');
}
const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://cymon-clearmindpsychologicalservices.vercel.app').replace(/\/+$/, '');

function formatSender(address) {
  const raw = String(address || '').trim();
  if (!raw) return null;
  if (/<[^<>]+@[^<>]+>/.test(raw)) return raw;
  return `ClearMind Clinic <${raw}>`;
}

function getFromAddress() {
  // Centralized mailbox (CENTRALIZED_EMAIL): one address serves both
  // branches, so clients always hear from the same sender. Falls back to
  // the legacy per-provider EMAIL_FROM / SMTP account when unset.
  // Resend requires a verified sender; Gmail API sends as the authed user.
  return formatSender(env('CENTRALIZED_EMAIL'))
    || env('EMAIL_FROM')
    || (env('SMTP_EMAIL') ? `ClearMind Clinic <${env('SMTP_EMAIL')}>` : 'ClearMind Clinic <no-reply@clearmind.local>');
}

// Per-branch contact cache for Reply-To + branch-aware footers. The From:
// stays centralized; replies route to the branch that sent the email.
let clinicContactCache = { at: 0, map: {} };
async function getClinicContact(clinicId) {
  if (!clinicId) return {};
  const now = Date.now();
  if (now - clinicContactCache.at > 5 * 60 * 1000) {
    clinicContactCache = { at: now, map: {} };
    try {
      const { supabase } = require('./supabase');
      const { data } = await supabase.from('clinics').select('id, code, name, email');
      for (const c of data || []) {
        if (c && c.id) clinicContactCache.map[c.id] = { name: c.name || c.code || null, email: c.email || null };
      }
    } catch {
      // service lookup failed — callers fall back to centralized sender
    }
  }
  return clinicContactCache.map[clinicId] || {};
}

function getResendClient() {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) return null;
  if (!resendClient || resendKey !== apiKey) {
    const { Resend } = require('resend');
    resendClient = new Resend(apiKey);
    resendKey = apiKey;
  }
  return resendClient;
}

function getGmailClient() {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  const refreshToken = env('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }
  const key = `${clientId}:${clientSecret}:${refreshToken}`;
  if (!gmailClient || gmailClientKey !== key) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground',
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
    gmailClientKey = key;
  }
  return gmailClient;
}

function getNodemailerFallback() {
  const smtpEmail = env('SMTP_EMAIL');
  const smtpPassword = env('SMTP_PASSWORD');
  if (!smtpEmail || !smtpPassword) return null;
  const key = `${smtpEmail}:${smtpPassword.length}`;
  if (!nodemailerFallback || nodemailerKey !== key) {
    const nodemailer = require('nodemailer');
    nodemailerFallback = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpEmail, pass: smtpPassword },
    });
    nodemailerKey = key;
  }
  return nodemailerFallback;
}

// Map raw provider errors to stable codes. Full provider text stays in the
// server log; API callers only see the sanitized message built in sendMail.
function classifyEmailError(message) {
  const text = String(message || '');
  if (/invalid_grant/i.test(text)) return 'gmail_refresh_token_invalid';
  if (/535.*5\.7\.8|BadCredentials|Username and Password not accepted/i.test(text)) return 'smtp_credentials_rejected';
  if (/Username and Password not accepted|Invalid login/i.test(text)) return 'smtp_credentials_rejected';
  return 'provider_failure';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function parseFromAddress(from) {
  const raw = String(from || '').trim();
  const bracketMatch = raw.match(/^\s*(?:(?:"([^"]+)"|([^<>]+?))\s*)?<\s*([^<>]+@[^<>]+)\s*>\s*$/);
  if (bracketMatch) {
    return {
      name: (bracketMatch[1] || bracketMatch[2] || '').trim() || undefined,
      email: bracketMatch[3].trim(),
    };
  }

  const emailMatch = raw.match(/^\s*([^<>\s]+@[^<>\s]+)\s*$/);
  return { email: emailMatch ? emailMatch[1].trim() : raw };
}

function renderLayout({
  preheader,
  title,
  titleHtml,
  greeting,
  intro,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
  branchName,
}) {
  const branchSuffix = branchName ? ` — ${escapeHtml(branchName)}` : '';
  const buttonHtml =
    ctaLabel && ctaUrl
      ? `
        <div style="margin: 32px 0 8px; text-align: center;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);color:#ffffff;text-decoration:none;font-weight:700;padding:16px 36px;border-radius:50px;box-shadow:0 12px 24px -6px rgba(124, 58, 237, 0.4);font-size:16px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>`
      : '';

  return `<!doctype html>
<html>
  <head>
    <style>
      @font-face {
        font-family: 'AgainstRegular';
        src: url('${publicAppUrl}/against regular.otf') format('opentype');
        font-weight: normal;
        font-style: normal;
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:linear-gradient(135deg, #f4e8ff 0%, #e9d5ff 50%, #d8b4fe 100%);font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2330;min-height:100vh;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader || title || 'ClearMind Psychological Services')}
    </div>
    <div style="padding:20px 8px;">
      <div style="max-width:640px;margin:0 auto;background:rgba(255, 255, 255, 0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255, 255, 255, 0.6);border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(88,28,135,0.15), inset 0 0 0 1px rgba(255,255,255,0.5);">
        <img src="${publicAppUrl}/email-header.png" alt="ClearMind Logo" style="width:100%;height:auto;display:block;border-bottom:3px solid #d8b4fe;" />
        <div style="padding:24px 20px 0;">
          <h1 style="margin:0;font-size:clamp(20px,5vw,28px);line-height:1.3;font-weight:800;color:#4c1d95;letter-spacing:-0.5px;">${titleHtml || escapeHtml(title)}</h1>
        </div>
        <div style="padding:20px 20px 28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#1f2937;">${escapeHtml(greeting || 'Hello,')}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.75;color:#4b5563;">${escapeHtml(intro || '')}</p>
          ${bodyHtml || ''}
          ${buttonHtml}
          ${footerNote ? `<p style="margin:32px 0 0;font-size:14px;line-height:1.7;color:#6b7280;border-top:1px solid #f3e8ff;padding-top:24px;">${escapeHtml(footerNote)}</p>` : `<div style="margin-top:32px;border-top:1px solid #f3e8ff;padding-top:24px;"></div>`}
          <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#6b7280;">
            For immediate assistance, our support team is available to help${branchSuffix}. Just reply to this email or contact us on our official FB Page (<a href="https://www.facebook.com/cmps.cabuyao" style="color:#7c3aed;text-decoration:none;font-weight:600;">https://www.facebook.com/cmps.cabuyao</a>). Also, always check the ClearMind Psychological Services FB Page regularly for other announcements.
          </p>
          <p style="margin:28px 0 20px;font-size:15px;line-height:1.7;color:#374151;font-weight:700;">Best Regards,</p>
          <img src="${publicAppUrl}/email-footer.jpg" alt="ClearMind Clinic" style="width:100%;height:auto;display:block;border-radius:16px;box-shadow:0 4px 12px rgba(88,28,135,.08);border:1px solid #f3e8ff;" />
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function renderWelcomeFallback(data) {
  const {
    parent_name = 'there',
    child_name = 'your child',
    parent_email = '',
    temporary_password = '',
    role = 'caregiver',
  } = data || {};

  const isEmployee = !['client', 'caregiver', 'patient'].includes(role.toLowerCase());
  const displayRole = role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const bodyHtml = `
    <div style="background:rgba(255, 255, 255, 0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-left:4px solid #7c3aed;border-radius:12px;padding:20px;margin:20px 0;box-shadow:0 10px 25px -5px rgba(124, 58, 237, 0.08);border-top:1px solid rgba(255,255,255,0.8);border-right:1px solid rgba(255,255,255,0.8);border-bottom:1px solid rgba(255,255,255,0.8);">
      <div style="color:#6d28d9;font-weight:800;font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px;">
        Account Credentials
      </div>
      <div style="border-bottom:1px solid rgba(124,58,237,0.1);padding-bottom:14px;margin-bottom:14px;">
        <div style="color:#6b7280;font-size:13px;margin-bottom:6px;">Email Address</div>
        <div style="font-weight:700;color:#1e293b;font-size:15px;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(parent_email)}</div>
      </div>
      <div>
        <div style="color:#6b7280;font-size:13px;margin-bottom:8px;">Temporary Password</div>
        <div style="background:rgba(255,255,255,0.9);border:1px solid rgba(124,58,237,0.2);padding:10px 16px;border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;color:#6d28d9;letter-spacing:2px;font-size:15px;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(temporary_password)}</div>
      </div>
    </div>

    <div style="background:rgba(255, 255, 255, 0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:16px;padding:24px;margin:24px 0;box-shadow:0 8px 32px rgba(147, 51, 234, 0.08);border:1px solid rgba(255,255,255,0.7);">
      <div style="color:#6d28d9;font-weight:800;font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:20px;">
        Next Steps
      </div>
      <div style="margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:32px;vertical-align:top;padding:0;">
              <div style="background:#f3e8ff;color:#7c3aed;width:24px;height:24px;border-radius:12px;font-weight:700;font-size:13px;line-height:24px;text-align:center;">1</div>
            </td>
            <td style="color:#4b5563;font-size:15px;line-height:1.6;padding:1px 0 0 0;">Sign in securely with the credentials above.</td>
          </tr>
        </table>
      </div>
      <div style="margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:32px;vertical-align:top;padding:0;">
              <div style="background:#f3e8ff;color:#7c3aed;width:24px;height:24px;border-radius:12px;font-weight:700;font-size:13px;line-height:24px;text-align:center;">2</div>
            </td>
            <td style="color:#4b5563;font-size:15px;line-height:1.6;padding:1px 0 0 0;">${isEmployee ? 'Access your dashboard to get started.' : `Review and complete your child's admission details.`}</td>
          </tr>
        </table>
      </div>
      <div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:32px;vertical-align:top;padding:0;">
              <div style="background:#f3e8ff;color:#7c3aed;width:24px;height:24px;border-radius:12px;font-weight:700;font-size:13px;line-height:24px;text-align:center;">3</div>
            </td>
            <td style="color:#4b5563;font-size:15px;line-height:1.6;padding:1px 0 0 0;">Change your password immediately after your first login.</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  return {
    html: renderLayout({
      preheader: isEmployee ? `Your ClearMind ${displayRole} account is ready.` : `Your ClearMind parent account for ${child_name} is ready.`,
      title: 'Welcome to CyMon',
      titleHtml: `Welcome to <span style="font-family:'AgainstRegular', 'Times New Roman', Times, serif;font-weight:bold;color:#4c1d95;font-size:clamp(28px, 8vw, 52px);display:inline-block;margin-left:8px;transform:translateY(2px);">CyMon</span>`,
      greeting: `Hello ${parent_name},`,
      intro: isEmployee ? `Your ${displayRole} account has been created successfully.` : `Your caregiver portal account has been created successfully for ${child_name}.`,
      bodyHtml,
      ctaLabel: 'Open the Portal',
      ctaUrl: `${publicAppUrl}/login`,
      footerNote: 'If you did not request this account, please contact the clinic immediately.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${parent_name},`,
      '',
      isEmployee ? `Your ${displayRole} account has been created successfully.` : `Your caregiver portal account has been created successfully for ${child_name}.`,
      '',
      'Login credentials:',
      `Email: ${parent_email}`,
      `Temporary Password: ${temporary_password}`,
      '',
      `Portal: ${publicAppUrl}/login`,
      '',
      'Please sign in and change your password after your first login.',
    ].join('\n'),
  };
}

function renderAppointmentReminderFallback(data) {
  const {
    parent_name = 'there',
    student_name = 'your child',
    when = '',
    location = 'ClearMind Clinic',
    session_type = '',
    notes = '',
  } = data || {};

  const bodyHtml = `
    <div style="display:grid;gap:12px;margin:18px 0;">
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:16px 18px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;">Session details</div>
        <div style="margin-top:12px;display:grid;gap:10px;font-size:14px;line-height:1.65;color:#374151;">
          <div><strong>Date &amp; time:</strong> ${escapeHtml(when)}</div>
          <div><strong>Location:</strong> ${escapeHtml(location)}</div>
          <div><strong>Session type:</strong> ${escapeHtml(session_type)}</div>
          <div><strong>Notes:</strong> ${escapeHtml(notes || 'None')}</div>
        </div>
      </div>
    </div>
  `;

  return {
    html: renderLayout({
      preheader: `${student_name} has a session scheduled tomorrow.`,
      title: 'Appointment Reminder',
      greeting: `Hello ${parent_name},`,
      intro: `${student_name} has a scheduled session tomorrow.`,
      bodyHtml,
      ctaLabel: 'View Appointments',
      ctaUrl: `${publicAppUrl}/client/appointments`,
      footerNote: 'If you need to reschedule, please contact the clinic.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${parent_name},`,
      '',
      `${student_name} has a scheduled session tomorrow.`,
      '',
      `Date & Time: ${when}`,
      `Location: ${location}`,
      `Session Type: ${session_type}`,
      `Notes: ${notes || 'None'}`,
      '',
      `Portal: ${publicAppUrl}/client/appointments`,
    ].join('\n'),
  };
}

function renderComplianceReminderFallback(data) {
  const {
    parent_name = 'there',
    student_name = 'your child',
    document_title = 'a required form',
    status_text = 'awaiting your signature',
  } = data || {};

  const bodyHtml = `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:16px 18px;margin:18px 0;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;">Document status</div>
      <div style="margin-top:12px;font-size:14px;line-height:1.75;color:#374151;">
        <strong>${escapeHtml(document_title)}</strong> for ${escapeHtml(student_name)} is ${escapeHtml(status_text)}.
      </div>
    </div>
  `;

  return {
    html: renderLayout({
      preheader: `Action needed for ${student_name}'s document.`,
      title: 'Document Reminder',
      greeting: `Hello ${parent_name},`,
      intro: "One of your child's clinic documents needs attention.",
      bodyHtml,
      ctaLabel: 'Review the Form',
      ctaUrl: `${publicAppUrl}/client/waivers`,
      footerNote: 'If you have already submitted this document, please disregard this email.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${parent_name},`,
      '',
      "One of your child's clinic documents needs attention.",
      '',
      `${document_title} for ${student_name} is ${status_text}.`,
      '',
      `Portal: ${publicAppUrl}/client/waivers`,
    ].join('\n'),
  };
}

function renderComplianceReturnedFallback(data) {
  const {
    parent_name = 'there',
    student_name = 'your child',
    document_title = 'a required form',
    comment = '',
  } = data || {};

  const bodyHtml = `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:16px 18px;margin:18px 0;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;">Revision needed</div>
      <div style="margin-top:12px;font-size:14px;line-height:1.75;color:#374151;">
        <strong>${escapeHtml(document_title)}</strong> for ${escapeHtml(student_name)} was returned by the clinic and needs to be updated.
      </div>
      <div style="margin-top:12px;font-size:14px;line-height:1.75;color:#374151;background:#ffffff;border:1px solid #e9d5ff;border-radius:12px;padding:12px 14px;">
        <strong>Clinic note:</strong> ${escapeHtml(comment)}
      </div>
    </div>
  `;

  return {
    html: renderLayout({
      preheader: `${document_title} for ${student_name} needs a revision.`,
      title: 'Compliance Form Returned',
      greeting: `Hello ${parent_name},`,
      intro: "Your child's clinic form was returned and needs to be updated.",
      bodyHtml,
      ctaLabel: 'Review the Form',
      ctaUrl: `${publicAppUrl}/client/waivers`,
      footerNote: 'Please update the form and re-submit it.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${parent_name},`,
      '',
      `${document_title} for ${student_name} was returned by the clinic and needs to be updated.`,
      '',
      `Clinic note: ${comment}`,
      '',
      `Portal: ${publicAppUrl}/client/waivers`,
    ].join('\n'),
  };
}

function renderAnnouncementFallback(data) {
  const {
    recipient_name = 'there',
    announcement_title = 'New Announcement',
    announcement_body = '',
  } = data || {};

  const bodyHtml = `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:16px 18px;margin:18px 0;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;">Announcement</div>
      <div style="margin-top:10px;font-size:20px;line-height:1.4;font-weight:800;color:#1f2937;">${escapeHtml(announcement_title)}</div>
      <div style="margin-top:12px;font-size:14px;line-height:1.75;color:#374151;">${nl2br(announcement_body)}</div>
    </div>
  `;

  return {
    html: renderLayout({
      preheader: announcement_title,
      title: 'Clinic Announcement',
      greeting: `Hello ${recipient_name},`,
      intro: 'A new update has been posted on the ClearMind portal.',
      bodyHtml,
      ctaLabel: 'Open the Portal',
      ctaUrl: publicAppUrl,
      footerNote: 'Thank you for staying connected with the clinic.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${recipient_name},`,
      '',
      'A new update has been posted on the ClearMind portal.',
      '',
      announcement_title,
      '',
      announcement_body,
      '',
      `Portal: ${publicAppUrl}`,
    ].join('\n'),
  };
}

function renderAssessmentDocumentReleaseFallback(data) {
  const {
    parent_name = 'there',
    student_name = 'your child',
    status = 'scheduled',
    scheduled_date = '',
    scheduled_time = '',
    location = 'Main Clinic Cashier / Reception',
    document_count = 0,
    total_amount = '0.00',
    clinic_notice = '',
    declined_reason = '',
  } = data || {};
  const scheduled = status === 'scheduled';
  const bodyHtml = scheduled
    ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:18px;padding:18px 20px;margin:18px 0;">
        <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#047857;margin-bottom:10px;">Pick-up details</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.65;color:#374151;">
          <tr><td style="padding:6px 0;color:#6b7280;width:180px;">Student</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(student_name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(scheduled_date)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(scheduled_time)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(location)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Documents</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(document_count)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Amount due</td><td style="padding:6px 0;font-weight:700;color:#047857;">PHP ${escapeHtml(total_amount)}</td></tr>
        </table>
      </div>
      ${clinic_notice ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:18px;padding:16px 18px;margin:18px 0;color:#78350f;"><strong>Clinic notice:</strong><div style="margin-top:6px;line-height:1.7;">${nl2br(clinic_notice)}</div></div>` : ''}
    `
    : `
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:18px;padding:18px 20px;margin:18px 0;color:#881337;line-height:1.7;">
        The clinic was unable to approve the document pickup request for ${escapeHtml(student_name)}.${declined_reason ? ` Reason: ${escapeHtml(declined_reason)}` : ''}
      </div>
    `;

  return {
    html: renderLayout({
      preheader: scheduled ? `Assessment document pick-up scheduled for ${student_name}.` : `Update about ${student_name}'s assessment document request.`,
      title: scheduled ? 'Document Pick-Up Scheduled' : 'Document Request Update',
      greeting: `Hello ${parent_name},`,
      intro: scheduled
        ? `The clinic has scheduled a document pick-up for ${student_name}. Please review the details below before visiting.`
        : `There is an update to the assessment document request for ${student_name}.`,
      bodyHtml,
      ctaLabel: 'View Assessment Services',
      ctaUrl: `${publicAppUrl}/client/assessments`,
      footerNote: scheduled ? 'Please bring a valid ID and arrive during the assigned time window.' : 'Please contact the clinic if you need clarification about this request.',
      branchName: data.branch_name || null,
    }),
    text: scheduled
      ? [
        `Hello ${parent_name},`,
        '',
        `The clinic has scheduled a document pick-up for ${student_name}.`,
        '',
        `Date: ${scheduled_date}`,
        `Time: ${scheduled_time}`,
        `Location: ${location}`,
        `Documents: ${document_count}`,
        `Amount due: PHP ${total_amount}`,
        clinic_notice ? `Clinic notice: ${clinic_notice}` : '',
        '',
        `Portal: ${publicAppUrl}/client/assessments`,
      ].filter(Boolean).join('\n')
      : [
        `Hello ${parent_name},`,
        '',
        `There is an update to the assessment document request for ${student_name}.`,
        declined_reason ? `Reason: ${declined_reason}` : '',
        '',
        `Portal: ${publicAppUrl}/client/assessments`,
      ].filter(Boolean).join('\n'),
  };
}

function renderNotificationFallback(data) {
  const {
    recipient_name = 'there',
    notification_title = 'Clinic Update',
    notification_body = '',
    notification_link = '',
  } = data || {};
  const rawLink = String(notification_link || '').trim();
  const portalLink = rawLink
    ? (/^https?:\/\//i.test(rawLink) ? rawLink : `${publicAppUrl}${rawLink.startsWith('/') ? rawLink : `/${rawLink}`}`)
    : publicAppUrl;

  return {
    html: renderLayout({
      preheader: notification_title,
      title: notification_title,
      greeting: `Hello ${recipient_name},`,
      intro: 'There is a new update in your ClearMind client portal.',
      bodyHtml: `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:18px;padding:18px 20px;margin:18px 0;font-size:14px;line-height:1.75;color:#374151;">${nl2br(notification_body)}</div>`,
      ctaLabel: 'Open the Portal',
      ctaUrl: portalLink,
      footerNote: 'Please sign in to the portal for the latest details.',
      branchName: data.branch_name || null,
    }),
    text: [
      `Hello ${recipient_name},`,
      '',
      notification_title,
      '',
      notification_body,
      '',
      `Portal: ${portalLink}`,
    ].join('\n'),
  };
}

function renderFallback(templateKey, data) {
  switch (templateKey) {
    case 'welcome':
      return renderWelcomeFallback(data);
    case 'appointmentReminder':
      return renderAppointmentReminderFallback(data);
    case 'complianceReminder':
      return renderComplianceReminderFallback(data);
    case 'complianceReturned':
      return renderComplianceReturnedFallback(data);
    case 'announcement':
      return renderAnnouncementFallback(data);
    case 'assessmentDocumentRelease':
      return renderAssessmentDocumentReleaseFallback(data);
    case 'notification':
      return renderNotificationFallback(data);
    default:
      return null;
  }
}

function buildMimeMessage({ from, to, subject, html, text, replyTo }) {
  const boundary = `----=_Part_${Date.now()}`;
  const lines = [];
  lines.push(`From: ${from}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  lines.push(`To: ${to}`);
  // Raw UTF-8 in a header (emoji from copied announcement text, etc.)
  // arrives as mojibake — RFC 2047-encode non-ASCII subjects.
  lines.push(`Subject: ${encodeSubject(subject)}`);
  lines.push('MIME-Version: 1.0');
  if (html && text) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');
    lines.push(text);
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('');
    lines.push(html);
    lines.push(`--${boundary}--`);
  } else if (html) {
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('');
    lines.push(html);
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');
    lines.push(text);
  }
  return lines.join('\r\n');
}

function encodeSubject(subject) {
  const value = String(subject || '');
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeMessage(message) {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendMail({ to, subject, text, html, templateKey, templateData = {}, replyTo, replyToClinicId }) {
  // Centralized mailbox, branch-aware replies: the From: stays the single
  // clinic address, while Reply-To routes to the branch that sent the email
  // and the footer names that branch.
  let branchName = templateData?.branch_name || null;
  if (replyToClinicId && !replyTo) {
    const contact = await getClinicContact(replyToClinicId);
    if (contact.email) replyTo = contact.email;
    if (contact.name) branchName = branchName || contact.name;
  }
  const enrichedData = branchName && !templateData?.branch_name
    ? { ...templateData, branch_name: branchName }
    : templateData;
  const fallback = renderFallback(templateKey, enrichedData) || {};
  const finalHtml = html || fallback.html;
  const finalText = text || fallback.text;

  if (!to) {
    const err = new Error('Email requires a recipient.');
    err.status = 400;
    err.code = 'email_no_recipient';
    throw err;
  }
  if (!finalHtml && !finalText) {
    const err = new Error('Email requires an HTML or text body.');
    err.status = 400;
    err.code = 'email_no_body';
    throw err;
  }

  const from = getFromAddress();
  const emailSubject = subject || 'ClearMind Clinic Update';
  const failures = [];

  // 1) Resend (HTTPS REST — works on Vercel, no OAuth refresh / app-password).
  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject: emailSubject,
        ...(finalHtml ? { html: finalHtml } : {}),
        ...(finalText ? { text: finalText } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      return { provider: 'resend', ok: true, messageId: data?.id || null };
    } catch (error) {
      const raw = error?.message || error?.name || String(error);
      failures.push({ provider: 'resend', code: classifyEmailError(raw), raw });
      console.warn(`[email] Resend failed, trying next provider... Error: ${raw}`);
    }
  }

  // 2) Gmail API (OAuth2).
  const gmail = getGmailClient();
  if (gmail) {
    try {
      const message = buildMimeMessage({
        from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: emailSubject,
        html: finalHtml,
        text: finalText,
        replyTo,
      });
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodeMessage(message) },
      });
      return { provider: 'gmail-api', ok: true, messageId: res.data.id };
    } catch (error) {
      const raw = error?.message || error?.name || String(error);
      failures.push({ provider: 'gmail-api', code: classifyEmailError(raw), raw });
      console.warn(`[email] Gmail API failed, attempting fallback to Nodemailer... Error: ${raw}`);
    }
  }

  // 3) Nodemailer SMTP fallback (works locally; blocked on Vercel).
  const mailer = getNodemailerFallback();
  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from,
        to: Array.isArray(to) ? to : [to],
        subject: emailSubject,
        ...(finalHtml ? { html: finalHtml } : {}),
        ...(finalText ? { text: finalText } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      return { provider: 'nodemailer', ok: true, messageId: info.messageId };
    } catch (error) {
      const raw = error?.message || error?.name || String(error);
      failures.push({ provider: 'nodemailer', code: classifyEmailError(raw), raw });
    }
  }

  // Log full provider detail server-side, expose only a safe message.
  failures.forEach((f) => console.error(`[email] ${f.provider} failed (${f.code}): ${f.raw}`));

  const err = new Error(buildSafeEmailError(failures));
  err.status = 502;
  err.code = failures.length ? failures[failures.length - 1].code : 'email_not_configured';
  err.providerFailures = failures.map(({ provider, code }) => ({ provider, code }));
  throw err;
}

// Sanitized message for API responses — never leaks tokens, passwords, or
// raw Gmail/SMTP diagnostics (those stay in the server log above).
function buildSafeEmailError(failures) {
  if (!failures.length) {
    return 'Email delivery is not configured. Set RESEND_API_KEY (recommended) or Gmail/SMTP credentials in .env.';
  }
  const codes = failures.map((f) => f.code);
  if (codes.includes('gmail_refresh_token_invalid') && codes.includes('smtp_credentials_rejected')) {
    return 'Could not send the email: the Gmail connection needs to be reconnected (refresh token expired) and the SMTP password was rejected. Reconnect Gmail or set RESEND_API_KEY in .env.';
  }
  if (codes.includes('gmail_refresh_token_invalid')) {
    return 'Could not send the email: the Gmail connection expired (invalid_grant). Generate a new refresh token and update GOOGLE_REFRESH_TOKEN, or set RESEND_API_KEY.';
  }
  if (codes.includes('smtp_credentials_rejected')) {
    return 'Could not send the email: the SMTP login was rejected. For Gmail, use a 16-character App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.';
  }
  return 'Could not send the email right now. Please try again in a moment. (Email provider error — see server logs.)';
}

module.exports = {
  sendMail,
  publicAppUrl,
  getPublicAppUrl,
  getClinicContact,
  buildMimeMessage,
  encodeSubject,
};
