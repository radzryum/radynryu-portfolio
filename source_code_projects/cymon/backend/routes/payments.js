'use strict';

/**
 * Payment routes for PayMongo integration.
 *
 * Routes:
 *   POST /api/payments/checkout          — Client initiates a PayMongo checkout session
 *   POST /api/payments/webhook/paymongo  — PayMongo webhook receiver (raw body, HMAC verified)
 *   GET  /api/payments/status/:requestId — Client polls payment status after returning from PayMongo
 */

const express = require('express');
const { supabase, supabaseConfigured } = require('../lib/supabase');
const { createNotification } = require('../lib/notify');
const { writeAudit } = require('../lib/audit');
const { patientName } = require('../lib/names');
const { formatReleaseRequest } = require('../lib/documentReleases');
const requireAuth = require('../middleware/requireAuth');
const {
  createCheckoutSession,
  getCheckoutSession,
  verifyWebhookSignature,
  isPayMongoConfigured,
} = require('../lib/paymongo');

const router = express.Router();

function ensureConfigured(res) {
  if (!supabaseConfigured) {
    res.status(500).json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
    return false;
  }
  return true;
}

function ensurePayMongoConfigured(res) {
  if (!isPayMongoConfigured()) {
    res.status(503).json({ error: 'Online payment is not configured on the server. Please contact the clinic.' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/payments/checkout
// ---------------------------------------------------------------------------
// Called by the client after admin has scheduled the release request.
// Creates a PayMongo Checkout Session and returns the redirect URL.
// The patient is then redirected to the PayMongo-hosted payment page.
// ---------------------------------------------------------------------------
router.post('/checkout', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  if (!ensurePayMongoConfigured(res)) return;

  try {
    const { request_id } = req.body || {};
    if (!request_id) return res.status(400).json({ error: 'request_id is required.' });

    // Load the release request; must belong to the authenticated user's patient
    const { data: request, error: requestError } = await supabase
      .from('assessment_document_release_requests')
      .select(
        'id, clinic_id, patient_id, status, payment_status, payment_preference, paymongo_checkout_id, paymongo_checkout_url, patients(first_name, middle_name, last_name, patient_id, caregiver_id)',
      )
      .eq('id', request_id)
      .maybeSingle();

    if (requestError) return next(requestError);
    if (!request) return res.status(404).json({ error: 'Release request not found.' });

    // Ensure the caller is the caregiver who owns this patient
    const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
    if (!patient || patient.caregiver_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to pay for this request.' });
    }

    if (request.status !== 'scheduled') {
      return res.status(409).json({ error: 'Only scheduled requests can be paid online. Wait for the clinic to approve and schedule your request first.' });
    }
    if (request.payment_status === 'paid') {
      return res.status(409).json({ error: 'This request has already been paid.' });
    }
    if (request.payment_preference !== 'online') {
      return res.status(409).json({ error: 'This request is set to Pay Onsite, not Pay Online.' });
    }

    // If a checkout session already exists and is still valid, reuse it
    if (request.paymongo_checkout_id && request.paymongo_checkout_url) {
      try {
        const existing = await getCheckoutSession(request.paymongo_checkout_id);
        const existingStatus = existing?.attributes?.status;
        // Reuse if still pending (not expired or already paid)
        if (existingStatus === 'active') {
          return res.json({ checkout_url: request.paymongo_checkout_url, checkout_id: request.paymongo_checkout_id, reused: true });
        }
      } catch {
        // Expired or unreachable — create a fresh session below
      }
    }

    // Compute total from items
    const { data: items, error: itemsError } = await supabase
      .from('assessment_document_release_items')
      .select('fee')
      .eq('request_id', request.id);
    if (itemsError) return next(itemsError);

    const totalPHP = (items || []).reduce((sum, item) => sum + Number(item.fee || 0), 0);
    if (totalPHP <= 0) {
      return res.status(400).json({ error: 'Cannot process online payment for a zero-amount request. Please pay at the clinic counter.' });
    }

    const amountCents = Math.round(totalPHP * 100); // PayMongo uses centavos
    const appUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const successUrl = `${appUrl}/client/assessments?payment=success&request_id=${request.id}`;
    const cancelUrl = `${appUrl}/client/assessments?payment=cancelled&request_id=${request.id}`;

    // Fetch caregiver email for optional pre-fill
    const { data: caregiver } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', req.user.id)
      .maybeSingle();

    const { checkoutId, checkoutUrl } = await createCheckoutSession({
      referenceNumber: request.id,
      amountCents,
      description: `Assessment Document Release – ${patientName(patient)} (${items.length} document${items.length === 1 ? '' : 's'})`,
      successUrl,
      cancelUrl,
      customerEmail: caregiver?.email,
      customerName: caregiver?.display_name,
    });

    // Persist the checkout session ID so we can verify on webhook and reuse if needed
    const { error: updateError } = await supabase
      .from('assessment_document_release_requests')
      .update({
        paymongo_checkout_id: checkoutId,
        paymongo_checkout_url: checkoutUrl,
      })
      .eq('id', request.id);
    if (updateError) console.error('[payments/checkout] failed to store checkout id:', updateError.message);

    return res.json({ checkout_url: checkoutUrl, checkout_id: checkoutId });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/status/:requestId
// ---------------------------------------------------------------------------
// Client polls this after returning from PayMongo to get the latest payment status.
// If the webhook hasn't fired yet, this endpoint actively checks PayMongo's API
// and marks the payment as paid if confirmed there.
// ---------------------------------------------------------------------------
router.get('/status/:requestId', requireAuth, async (req, res, next) => {
  if (!ensureConfigured(res)) return;
  try {
    const { data: request, error } = await supabase
      .from('assessment_document_release_requests')
      .select('id, clinic_id, status, payment_status, payment_method, payment_preference, paymongo_checkout_id, paid_at, patients(first_name, middle_name, last_name, patient_id, caregiver_id)')
      .eq('id', req.params.requestId)
      .maybeSingle();
    if (error) return next(error);
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
    if (!patient || (patient.caregiver_id !== req.user.id && !['admin'].includes(req.profile?.role))) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // If still unpaid and we have a checkout ID, verify directly with PayMongo API
    if (request.payment_status !== 'paid' && request.paymongo_checkout_id) {
      try {
        const session = await getCheckoutSession(request.paymongo_checkout_id);
        const sessionStatus = session?.attributes?.status;
        const payments = session?.attributes?.payments || [];
        const paidPayment = payments.find((p) => p.attributes?.status === 'paid');

        if (sessionStatus === 'paid' || paidPayment) {
          // Amount verification: only mark paid when PayMongo confirms the value
          // matches the total the clinic quoted for this release request.
          const paidAmountCents = Number(
            paidPayment?.attributes?.amount ?? session?.attributes?.amount ?? 0,
          );
          const { data: items } = await supabase
            .from('assessment_document_release_items')
            .select('fee')
            .eq('request_id', request.id);
          const expectedCents = Math.round(
            (items || []).reduce((sum, it) => sum + Number(it.fee || 0), 0) * 100,
          );

          if (paidAmountCents && paidAmountCents !== expectedCents) {
            return res.status(409).json({ error: 'Payment amount does not match the request total.' });
          }

          const now = new Date().toISOString();
          await supabase
            .from('assessment_document_release_requests')
            .update({
              payment_status: 'paid',
              payment_method: 'paymongo',
              paid_at: now,
              paymongo_payment_id: paidPayment?.id || null,
            })
            .eq('id', request.id);

          // Notify caregiver (email + in-app)
          const patientLabel = patient ? patientName(patient) : 'Your child';
          if (patient?.caregiver_id) {
            await createNotification({
              clinicId: request.clinic_id,
              recipientId: patient.caregiver_id,
              type: 'assessment',
              title: 'Online payment received',
              body: `Your online payment for the assessment document release of ${patientLabel} has been received. The clinic will hand over the documents on your scheduled date.`,
              link: '/client/assessments',
              email: {
                subject: `Payment Confirmation: ${patientLabel} - ClearMind Clinic`,
              },
            }).catch((err) => console.error('[payments/status] caregiver notification error:', err.message));
          }

          // Notify admins
          try {
            const { data: staff } = await supabase
              .from('profiles')
              .select('id, role, extra_roles')
              .eq('clinic_id', request.clinic_id)
              .is('deleted_at', null);
            const admins = (staff || []).filter((p) => p.role === 'admin' || (Array.isArray(p.extra_roles) && p.extra_roles.includes('admin')));
            await Promise.all(admins.map((admin) =>
              createNotification({
                clinicId: request.clinic_id,
                recipientId: admin.id,
                type: 'assessment',
                title: 'Client completed online payment',
                body: `${patientLabel} has completed their online payment (PayMongo) for the assessment document release. You can now release the documents.`,
                link: '/admin/schedule',
              })
            ));
          } catch (err) {
            console.error('[payments/status] admin notification error:', err.message);
          }

          await writeAudit({
            clinicId: request.clinic_id,
            actorId: null,
            action: 'online_payment_received',
            entityType: 'assessment_document_release_request',
            entityId: request.id,
            summary: `PayMongo payment confirmed via status poll (checkout_id: ${request.paymongo_checkout_id}). Payment status updated to paid.`,
          }).catch((err) => console.error('[payments/status] audit error:', err.message));

          // Re-fetch to return updated state
          return res.json({
            request_id: request.id,
            status: request.status,
            payment_status: 'paid',
            payment_method: 'paymongo',
            payment_preference: request.payment_preference,
            paid_at: now,
          });
        }
      } catch (err) {
        console.error('[payments/status] PayMongo API verification failed:', err.message);
      }
    }

    return res.json({
      request_id: request.id,
      status: request.status,
      payment_status: request.payment_status,
      payment_method: request.payment_method,
      payment_preference: request.payment_preference,
      paid_at: request.paid_at,
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/webhook/paymongo
// ---------------------------------------------------------------------------
// PayMongo webhook endpoint. Receives raw body (Buffer) for HMAC verification.
// Registered in app.js BEFORE express.json() using express.raw().
// ---------------------------------------------------------------------------
router.post('/webhook/paymongo', async (req, res, next) => {
  try {
    // req.body here is a Buffer (set by express.raw() in app.js)
    const rawBody = req.body;
    const signature = req.headers['paymongo-signature'] || '';

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[paymongo-webhook] Invalid signature — rejecting request');
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const eventType = event?.data?.attributes?.type;
    console.log(`[paymongo-webhook] Received event: ${eventType}`);

    // We handle checkout_session.payment.paid and payment.paid
    if (!['checkout_session.payment.paid', 'payment.paid'].includes(eventType)) {
      return res.status(200).json({ received: true, handled: false, type: eventType });
    }

    const eventData = event?.data?.attributes?.data;

    // Extract the checkout session ID or reference number from the event
    let checkoutId = null;
    let paymentId = null;
    let referenceNumber = null;

    if (eventType === 'checkout_session.payment.paid') {
      checkoutId = eventData?.id;
      referenceNumber = eventData?.attributes?.reference_number;
      // The payment ID is nested in payment_intent or payments array
      const payments = eventData?.attributes?.payments;
      paymentId = Array.isArray(payments) ? payments[0]?.id : null;
    } else if (eventType === 'payment.paid') {
      paymentId = eventData?.id;
      referenceNumber = eventData?.attributes?.external_reference_number
        || eventData?.attributes?.reference_number;
      checkoutId = eventData?.attributes?.checkout_session_id;
    }

    if (!checkoutId && !referenceNumber) {
      console.warn('[paymongo-webhook] Could not extract checkout ID or reference number from event');
      return res.status(200).json({ received: true, handled: false, reason: 'no_reference' });
    }

    // Find the release request in DB — try by paymongo_checkout_id first, then by id (reference_number is our request UUID)
    let dbQuery = supabase
      .from('assessment_document_release_requests')
      .select('id, clinic_id, patient_id, status, payment_status, patients(first_name, middle_name, last_name, patient_id, caregiver_id)');

    if (checkoutId) {
      dbQuery = dbQuery.eq('paymongo_checkout_id', checkoutId);
    } else {
      dbQuery = dbQuery.eq('id', referenceNumber);
    }

    const { data: request, error: requestError } = await dbQuery.maybeSingle();

    if (requestError) {
      console.error('[paymongo-webhook] DB error finding request:', requestError.message);
      return res.status(200).json({ received: true, handled: false, reason: 'db_error' });
    }

    if (!request) {
      console.warn(`[paymongo-webhook] No request found for checkout_id=${checkoutId} reference=${referenceNumber}`);
      return res.status(200).json({ received: true, handled: false, reason: 'not_found' });
    }

    if (request.payment_status === 'paid') {
      // Already processed (idempotent)
      return res.status(200).json({ received: true, handled: true, idempotent: true });
    }

    // Amount verification: only mark paid when the value PayMongo reported matches
    // the total the clinic quoted for this release request.
    const paidAmountCents = Number(eventData?.attributes?.amount ?? 0);
    const { data: items } = await supabase
      .from('assessment_document_release_items')
      .select('fee')
      .eq('request_id', request.id);
    const expectedCents = Math.round(
      (items || []).reduce((sum, it) => sum + Number(it.fee || 0), 0) * 100,
    );

    if (paidAmountCents && paidAmountCents !== expectedCents) {
      console.warn(
        `[paymongo-webhook] Amount mismatch for ${request.id}: paid=${paidAmountCents} expected=${expectedCents}. Not marking paid.`,
      );
      return res.status(200).json({ received: true, handled: false, reason: 'amount_mismatch' });
    }

    // Mark as paid
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('assessment_document_release_requests')
      .update({
        payment_status: 'paid',
        payment_method: 'paymongo',
        paid_at: now,
        paymongo_payment_id: paymentId || null,
      })
      .eq('id', request.id);

    if (updateError) {
      console.error('[paymongo-webhook] Failed to update payment status:', updateError.message);
      // Still return 200 so PayMongo doesn't keep retrying — but log it
      return res.status(200).json({ received: true, handled: false, reason: 'update_failed' });
    }

    // Notify the caregiver (in-app + email)
    const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
    const patientLabel = patient ? patientName(patient) : 'Your child';
    if (patient?.caregiver_id) {
      await createNotification({
        clinicId: request.clinic_id,
        recipientId: patient.caregiver_id,
        type: 'assessment',
        title: 'Online payment received',
        body: `Your online payment for the assessment document release of ${patientLabel} has been received. The clinic will hand over the documents on your scheduled date.`,
        link: '/client/assessments',
        email: {
          subject: `Payment Confirmation: ${patientLabel} - ClearMind Clinic`,
        },
      }).catch((err) => console.error('[paymongo-webhook] caregiver notification error:', err.message));
    }

    // Notify all admin-role staff
    try {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id, role, extra_roles')
        .eq('clinic_id', request.clinic_id)
        .is('deleted_at', null);
      const admins = (staff || []).filter((p) => p.role === 'admin' || (Array.isArray(p.extra_roles) && p.extra_roles.includes('admin')));
      await Promise.all(admins.map((admin) =>
        createNotification({
          clinicId: request.clinic_id,
          recipientId: admin.id,
          type: 'assessment',
          title: 'Client completed online payment',
          body: `${patientLabel} has completed their online payment (PayMongo) for the assessment document release. You can now release the documents.`,
          link: '/admin/schedule',
        })
      ));
    } catch (err) {
      console.error('[paymongo-webhook] admin notification error:', err.message);
    }

    await writeAudit({
      clinicId: request.clinic_id,
      actorId: null, // system actor
      action: 'online_payment_received',
      entityType: 'assessment_document_release_request',
      entityId: request.id,
      summary: `PayMongo online payment received (payment_id: ${paymentId || 'unknown'}). Payment status updated to paid.`,
    }).catch((err) => console.error('[paymongo-webhook] audit error:', err.message));

    console.log(`[paymongo-webhook] Payment recorded for request ${request.id}`);
    return res.status(200).json({ received: true, handled: true });
  } catch (err) {
    console.error('[paymongo-webhook] Unhandled error:', err.message);
    // Always return 200 to prevent PayMongo from retrying indefinitely on our bugs
    return res.status(200).json({ received: true, handled: false, reason: 'internal_error' });
  }
});

module.exports = router;
