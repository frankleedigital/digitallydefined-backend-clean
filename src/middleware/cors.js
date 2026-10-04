// src/middleware/cors.js - CORS Middleware
// Purpose: Allow the public website + dashboard to call the backend.
//
// Critical behaviour: when an origin is NOT allowed we must NOT echo some other
// origin. Doing so makes the browser reject the response and report an opaque
// "TypeError: Failed to fetch" to the UI, which is very hard to diagnose.
// Instead we omit Access-Control-Allow-Origin entirely so the failure is a
// clear CORS block the developer can see in devtools.
import { ALLOWED_ORIGINS, EXTRA_ALLOWED_ORIGINS, ORIGIN_PATTERNS } from '../config/constants.js';

/**
 * Decide whether a request Origin may call this API.
 * @param {string|undefined} origin
 * @returns {boolean}
 */
export function isOriginAllowed(origin) {
  // Same-origin / non-browser callers (curl, server-to-server) send no Origin.
  if (!origin) return true;

  const normalized = String(origin).trim().replace(/\/+$/, '');
  if (!normalized) return true;

  const exact = [...ALLOWED_ORIGINS, ...EXTRA_ALLOWED_ORIGINS].map((o) =>
    String(o).replace(/\/+$/, '')
  );
  if (exact.includes(normalized)) return true;

  return ORIGIN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function setCORSHeaders(res, origin) {
  const allowed = isOriginAllowed(origin);

  // Always tell caches the response varies by Origin, otherwise a cached
  // Access-Control-Allow-Origin for one host gets replayed to another.
  res.setHeader('Vary', 'Origin');

  if (allowed) {
    // Echo the caller's origin when it is known (or when there is none, in which
    // case a wildcard is correct). Never substitute a different origin here.
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  // Credentials can only be combined with a specific origin, not "*".
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, apikey, x-user-id'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOPTIONS(req, res) {
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res, req.headers && req.headers.origin);
    return res.status(200).end();
  }
  return null;
}

export default { isOriginAllowed, setCORSHeaders, handleOPTIONS };