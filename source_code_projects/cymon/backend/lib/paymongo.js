'use strict';

/**
 * PayMongo API helper module.
 * Uses the PayMongo REST API directly (no SDK required).
 *
 * Environment variables required:
 *   PAYMONGO_SECRET_KEY   — sk_test_... or sk_live_...
 *   PAYMONGO_WEBHOOK_SECRET — whsec_... (from PayMongo dashboard webhook settings)
 */

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

function getSecretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not set in environment variables.');
  return key;
}

function authHeader() {
  return `Basic ${Buffer.from(`${getSecretKey()}:`).toString('base64')}`;
}

/**
 * Creates a PayMongo Checkout Session.
 * @param {object} options
 * @param {string} options.referenceNumber - Your internal request ID (used to correlate webhook)
 * @param {number} options.amountCents     - Amount in centavos (PHP 100.00 → 10000)
 * @param {string} options.description    - Line item description shown on checkout page
 * @param {string} options.successUrl     - Where to redirect after successful payment
 * @param {string} options.cancelUrl      - Where to redirect after cancelled payment
 * @param {string} [options.customerEmail]
 * @param {string} [options.customerName]
 * @returns {Promise<{checkoutId: string, checkoutUrl: string}>}
 */
async function createCheckoutSession({
  referenceNumber,
  amountCents,
  description,
  successUrl,
  cancelUrl,
  customerEmail,
  customerName,
}) {
  const payload = {
    data: {
      attributes: {
        billing: customerEmail || customerName
          ? {
              email: customerEmail || undefined,
              name: customerName || undefined,
            }
          : undefined,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        cancel_url: cancelUrl,
        success_url: successUrl,
        description: description || 'Assessment Document Release Fee',
        reference_number: referenceNumber,
        line_items: [
          {
            currency: 'PHP',
            amount: amountCents,
            description: description || 'Assessment Document Release Fee',
            name: 'Document Release Fee',
            quantity: 1,
          },
        ],
        payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'dob', 'dob_ubp'],
      },
    },
  };

  const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    const detail = json?.errors?.[0]?.detail || json?.message || `PayMongo error ${response.status}`;
    throw new Error(`PayMongo checkout creation failed: ${detail}`);
  }

  const attrs = json?.data?.attributes;
  return {
    checkoutId: json?.data?.id,
    checkoutUrl: attrs?.checkout_url,
  };
}

/**
 * Retrieves a Checkout Session from PayMongo.
 * @param {string} checkoutId
 * @returns {Promise<object>} Full PayMongo checkout session data
 */
async function getCheckoutSession(checkoutId) {
  const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions/${encodeURIComponent(checkoutId)}`, {
    headers: {
      Authorization: authHeader(),
    },
  });

  const json = await response.json();
  if (!response.ok) {
    const detail = json?.errors?.[0]?.detail || `PayMongo error ${response.status}`;
    throw new Error(`PayMongo session retrieval failed: ${detail}`);
  }
  return json?.data;
}

/**
 * Verifies a PayMongo webhook request signature.
 * PayMongo signs the raw request body using HMAC-SHA256 with the webhook secret.
 * The signature header format is: "t=<timestamp>,te=<sig>,li=<sig>"
 *
 * @param {Buffer} rawBody - Raw request body buffer (must NOT be parsed JSON)
 * @param {string} signatureHeader - Value of the `paymongo-signature` header
 * @param {string} [secret] - Override for webhook secret (defaults to env var)
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  const webhookSecret = secret || process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[paymongo] PAYMONGO_WEBHOOK_SECRET not set — skipping signature verification');
    if (process.env.NODE_ENV === 'production') {
      console.error('[paymongo] SECURITY: Refusing to skip signature verification in production');
      return false;
    }
    return true;
  }

  try {
    const crypto = require('crypto');
    const parts = String(signatureHeader || '').split(',');
    const tPart = parts.find((p) => p.startsWith('t='));
    // PayMongo signs the webhook payload with the scheme: header "t=<ts>,te=<hex>,li=<hex>".
    const v1Part = parts.find((p) => p.startsWith('te=')) || parts.find((p) => p.startsWith('li='));

    if (!tPart || !v1Part) return false;

    const timestamp = tPart.slice(2);
    const receivedSig = v1Part.slice(3);

    // PayMongo signature: HMAC-SHA256 of "<timestamp>.<rawBody>"
    const toSign = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(toSign)
      .digest('hex');

    const receivedBuf = Buffer.from(receivedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    // Constant-time compare to prevent timing attacks. Guard equal lengths first —
    // timingSafeEqual throws when the buffers differ in length.
    if (receivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Returns whether the PayMongo integration is configured.
 */
function isPayMongoConfigured() {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

module.exports = {
  createCheckoutSession,
  getCheckoutSession,
  verifyWebhookSignature,
  isPayMongoConfigured,
};
