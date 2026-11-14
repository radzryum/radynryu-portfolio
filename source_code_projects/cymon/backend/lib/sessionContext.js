/**
 * Session context for login/logout audit entries: client IP, device label,
 * and best-effort city/country from a free IP lookup.
 *
 * All helpers are best-effort and never throw — a logging failure must never
 * block sign-in/out. Unknown values come back as null.
 */

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = String(forwarded || '').split(',')[0].trim();
  const raw = first || req.ip || req.socket?.remoteAddress || '';
  const ip = String(raw).replace(/^::ffff:/, '').trim();
  return ip || null;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === 'localhost') return true;
  if (/^(127|10)\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

// Short human label from a User-Agent string, e.g.
// "Chrome · Windows · Desktop" or "Safari · iPhone · Mobile".
// Regex-based on purpose: no new dependency for a field that only needs
// to be recognizable, not exhaustive.
function parseDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return null;
  const has = (re) => re.test(ua);

  let os = null;
  if (has(/iPhone/i)) os = 'iPhone';
  else if (has(/iPad/i)) os = 'iPad';
  else if (has(/Android/i)) os = 'Android';
  else if (has(/Windows/i)) os = 'Windows';
  else if (has(/Mac OS X|Macintosh/i)) os = 'Mac';
  else if (has(/Linux/i)) os = 'Linux';

  let browser = null;
  if (has(/Edg\//i)) browser = 'Edge';
  else if (has(/OPR\/|Opera/i)) browser = 'Opera';
  else if (has(/SamsungBrowser/i)) browser = 'Samsung Internet';
  else if (has(/Chrome\/|CriOS\//i)) browser = 'Chrome';
  else if (has(/FxiOS\/|Firefox\//i)) browser = 'Firefox';
  else if (has(/Safari\//i)) browser = 'Safari';

  // Device class. Tablet checks come first: iPad and most Android-tablet
  // UAs also contain the word "Mobile".
  let kind = 'Desktop';
  if (has(/iPad/i) || has(/Tablet/i) || (has(/Android/i) && !has(/Mobile/i))) {
    kind = 'Tablet';
  } else if (has(/Mobile/i) || has(/iPhone/i) || has(/iPod/i) || has(/Windows Phone/i)) {
    kind = 'Mobile';
  }

  if (!browser && !os) return null;
  return [browser, os, kind].filter(Boolean).join(' · ');
}

// Free IP geolocation (ipapi.co, no key needed at sign-in volume). Skips
// private/local IPs, times out fast, and resolves to nulls on any failure
// so sign-in latency never depends on a third party.
async function lookupGeo(ip) {
  if (!ip || isPrivateIp(ip)) return { city: null, country: null };
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { city: null, country: null };
    const data = await res.json();
    if (data?.error) return { city: null, country: null };
    return {
      city: data?.city || null,
      country: data?.country_name || null,
    };
  } catch {
    return { city: null, country: null };
  }
}

// Gather everything a session audit entry needs. Never throws.
async function getSessionContext(req) {
  try {
    const ip = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '') || null;
    const device = parseDevice(userAgent);
    const { city, country } = await lookupGeo(ip);
    return {
      ipAddress: ip,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      deviceLabel: device,
      city,
      country,
    };
  } catch {
    return { ipAddress: null, userAgent: null, deviceLabel: null, city: null, country: null };
  }
}

module.exports = { getClientIp, parseDevice, lookupGeo, getSessionContext };
