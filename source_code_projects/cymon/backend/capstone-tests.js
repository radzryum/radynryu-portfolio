// Capstone evidence suite — executes real unit + integration checks against
// the actual CYMON code (no mocks for the units under test).
// Run: `node backend/capstone-tests.js`  (reads backend/.env like the server)
const crypto = require('crypto');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function unitPayMongo() {
  console.log('UNIT · PayMongo webhook signature (backend/lib/paymongo.js)');
  const { verifyWebhookSignature } = require('./lib/paymongo');
  const secret = 'whsec_capstone_test_123';
  const rawBody = Buffer.from(JSON.stringify({ data: { id: 'pay_1' } }));
  const ts = '1758000000';
  const good = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody.toString('utf8')}`).digest('hex');
  check('valid signature accepted', verifyWebhookSignature(rawBody, `t=${ts},te=${good}`, secret) === true);
  check(
    'tampered body rejected',
    verifyWebhookSignature(Buffer.from('{"data":{"id":"pay_2"}}'), `t=${ts},te=${good}`, secret) === false,
  );
  check('wrong secret rejected', verifyWebhookSignature(rawBody, `t=${ts},te=${good}`, 'whsec_wrong') === false);
  check('missing header rejected', verifyWebhookSignature(rawBody, '', secret) === false);
  check('malformed header rejected', verifyWebhookSignature(rawBody, 't=abc', secret) === false);
}

async function unitVoiceBuddy() {
  console.log('UNIT · voiceBuddy take routing (frontend/src/lib/voiceBuddy.js)');
  const vb = await import('../frontend/src/lib/voiceBuddy.js');
  check('great maps to happy', vb.buddyKeyForMood('great') === 'happy');
  check('good maps to happy', vb.buddyKeyForMood('good') === 'happy');
  check('okay maps to calm', vb.buddyKeyForMood('okay') === 'calm');
  check('sad maps to sad', vb.buddyKeyForMood('sad') === 'sad');
  check('very_bad maps to worried', vb.buddyKeyForMood('very_bad') === 'worried');
  check('unknown mood falls back to calm', vb.buddyKeyForMood('confused?!') === 'calm');
  check(
    '20 take slots defined (5 feelings x 4 kinds)',
    Array.isArray(vb.FEELING_IDS) && vb.FEELING_IDS.length === 5
      && Array.isArray(vb.TAKE_KINDS) && vb.TAKE_KINDS.length === 4,
  );
  for (const key of ['happy', 'calm', 'sad', 'worried']) {
    check(
      `copy present for '${key}' (greeting + line)`,
      Boolean(vb.BUDDY_COPY[key] && vb.BUDDY_COPY[key].greeting && vb.BUDDY_COPY[key].line),
    );
  }
  check('isSpeaking() is false with no audio (node-safe)', vb.isSpeaking() === false);
}

async function integrationHttp() {
  console.log('INTEGRATION · express wiring (boot app, real HTTP, no DB writes)');
  // Dummy Supabase config passes the configured-gate so the auth middleware
  // itself is exercised. No network happens: a missing bearer token is
  // rejected before any Supabase call; nothing is written anywhere.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://capstone-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'capstone-test-key';
  const http = require('http');
  const app = require('./app');
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, () => resolve(s));
    s.on('error', reject);
  });
  const port = server.address().port;
  const get = (path) => new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, headers: { connection: 'close' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
  try {
    let res = await get('/api/health');
    let body = {};
    try { body = JSON.parse(res.body); } catch { /* non-JSON */ }
    check('GET /api/health returns 200 {status:"ok"}', res.status === 200 && body.status === 'ok');

    res = await get('/api/does-not-exist');
    check('unknown route returns 404 JSON', res.status === 404);

    res = await get('/api/client/activity-logs');
    check('client journal without token is rejected (401)', res.status === 401);

    res = await get('/api/admin/patients');
    check('admin patients without token is rejected (401)', res.status === 401);

    res = await get('/api/auth/me');
    check('auth profile without token is rejected (401)', res.status === 401);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  console.log('CYMON capstone evidence suite');
  await unitPayMongo();
  await unitVoiceBuddy();
  await integrationHttp();
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) console.log('FAILURES:', failures.join(' | '));
  // Explicit exit: lingering test sockets can trip libuv on Windows teardown.
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('SUITE CRASH:', err && err.message);
  process.exit(2);
});
