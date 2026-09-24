// src/utils/respond.js
// ============================================================================
// Unified response envelope for the entire backend.
// ============================================================================
// Every named route AND every dispatch branch returns:
//   { success, data, provider, model, timestamp }
// This is the single contract the website and dashboard consume (§2.5 of the
// Unified System Fix Blueprint). Error responses carry { success:false, error }
// so existing "error" field reads keep working.
//
// `mergeData` mode: when enabled, the payload's own fields are ALSO copied to
// the top level so legacy consumers that read top-level fields (e.g. the
// website's tools before its Phase-N client update) keep working. The canonical
// `data` field is always present and exact.
// ============================================================================

/**
 * Send a canonical success envelope.
 * @param {import('express').Response} res
 * @param {unknown} data - payload for the `data` field
 * @param {{ provider?: string|null, model?: string|null, status?: number, mergeData?: boolean }} [opts]
 */
export function respond(res, data, opts = {}) {
  const { provider = null, model = null, status = 200, mergeData = false } = opts;
  const envelope = { success: true, data, provider, model, timestamp: Date.now() };

  if (mergeData && data && typeof data === 'object' && !Array.isArray(data)) {
    // Spread AFTER fixed fields so envelope keys can't be clobbered by payload.
    return res.status(status).json({ ...envelope, ...data, ...pick(envelope) });
  }

  return res.status(status).json(envelope);
}

/**
 * Send a canonical error envelope.
 * @param {import('express').Response} res
 * @param {Error|{message?: string, statusCode?: number}} [err]
 * @param {{ provider?: string|null, model?: string|null, status?: number, message?: string }} [opts]
 */
export function respondError(res, err = null, opts = {}) {
  const { provider = null, model = null, status = 500, message } = opts;
  const msg = message || (err && err.message) || 'Internal error';
  return res.status(status).json({
    success: false,
    error: msg,
    provider,
    model,
    timestamp: Date.now(),
  });
}

/** Pick only the fixed envelope keys (protects them from merge-data clobbering). */
function pick(obj) {
  const out = {};
  for (const k of ['success', 'data', 'provider', 'model', 'timestamp']) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

export default { respond, respondError };