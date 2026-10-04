// src/services/fastapi.js
// Proxy client for the FastAPI microservice layer.
//
// The public site and dashboard never call FastAPI directly: they send a
// `fastapi.<tool>` action to this backend, which forwards it here. Keeping the
// hop on the server means the API key never reaches the browser and CORS is
// handled by the one origin this backend already allows.
//
// Env:
//   FASTAPI_BASE_URL - origin of the FastAPI service (e.g. https://api-fast.example.com)
//   FASTAPI_API_KEY  - shared key FastAPI checks via the `x-api-key` header
//
// When the service is unreachable or unset, callers get a structured error
// rather than a thrown exception so the dispatcher can degrade gracefully.
import { env } from '../config/index.js';

/**
 * `fastapi.<sub>` -> FastAPI route.
 *
 * Keys must stay in sync with the routers registered in
 * digitallydefined-os-backend/fastapi/app/main.py.
 */
export const FASTAPI_ROUTES = {
  product: '/product-generator/generate',
  niche: '/niche/score',
  domain: '/domain/analyze',
  affiliate: '/affiliate/flip',
  rankrent: '/rank-rent/analyze',
  blueprint: '/blueprint/generate',
  roadmap: '/roadmap/generate',
  trends: '/trends',
  'asset-plan': '/asset-plan/calculate',
  'offer-architect': '/offer-architect/generate',
  wealth: '/wealth/calculate',
};

/** True only when a real base URL and API key are both present. */
export function isFastapiConfigured() {
  const base = (env.fastapi?.baseUrl || '').trim();
  const key = (env.fastapi?.apiKey || '').trim();
  if (!base || !key) return false;
  // The config layer defaults baseUrl to http://localhost:8000 so the service
  // can run locally. Treat that default as "not deployed" in production,
  // otherwise /api/health claims FastAPI is available when nothing is listening.
  if (process.env.NODE_ENV === 'production' && /^https?:\/\/localhost(:\d+)?$/i.test(base)) {
    return false;
  }
  return true;
}

/** Resolve a `fastapi.<sub>` action to its upstream route path. */
export function resolveFastapiRoute(action) {
  const sub = String(action).replace(/^fastapi\./, '');
  return FASTAPI_ROUTES[sub] || null;
}

/**
 * Unwrap the `{ action, inputData }` envelope the frontends send.
 *
 * Frontends post `{ action, inputData: {...} }` but FastAPI expects its request
 * fields at the top level, so a single `inputData` object is hoisted. Any other
 * shape is forwarded as-is.
 */
export function unwrapInputData(body = {}) {
  const { action: _action, key: _key, ...rest } = body;
  const { inputData, ...fields } = rest;
  if (inputData && typeof inputData === 'object' && !Array.isArray(inputData)) {
    return { ...fields, ...inputData };
  }
  return fields;
}

// LLM-backed tools are slow: /niche/score measures ~27s on its own because
// services/llm.py waits on the OmniRoute gateway. 30s was too tight and turned
// healthy tools into 502s. 60s leaves headroom without letting a hung socket
// pin a serverless invocation.
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * POST a payload to a FastAPI route and return the parsed body.
 *
 * @returns {Promise<{ok: boolean, status: number, data: any, error?: string}>}
 */
export async function callFastapi(route, payload, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const baseUrl = String(env.fastapi?.baseUrl || '').replace(/\/+$/, '');
  const apiKey = String(env.fastapi?.apiKey || '').trim();

  if (!baseUrl) {
    return { ok: false, status: 503, data: null, error: 'FASTAPI_BASE_URL is not configured' };
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    // Network failure, DNS miss, or timeout — the service is not reachable.
    const reason = err?.name === 'TimeoutError' ? `timed out after ${timeout}ms` : (err?.message || String(err));
    return { ok: false, status: 502, data: null, error: `FastAPI unreachable at ${baseUrl}: ${reason}` };
  }

  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    // FastAPI reports validation problems as { detail: [...] }.
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
      : (typeof detail === 'string' ? detail : (data?.error || `FastAPI responded ${response.status}`));
    return { ok: false, status: response.status, data, error: message };
  }

  return { ok: true, status: response.status, data };
}

/**
 * Probe the FastAPI /health endpoint. Used by the dispatcher and reported in
 * the backend health payload so "configured" reflects reality.
 */
export async function getFastapiStatus({ timeout = 6000 } = {}) {
  const baseUrl = String(env.fastapi?.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) {
    return { reachable: false, configured: false, reason: 'FASTAPI_BASE_URL is not set' };
  }
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(timeout) });
    const data = await response.json().catch(() => null);
    return {
      reachable: response.ok,
      configured: isFastapiConfigured(),
      status: data?.status || null,
      checks: data?.checks || null,
      reason: response.ok ? 'reachable' : `health returned ${response.status}`,
    };
  } catch (err) {
    return {
      reachable: false,
      configured: isFastapiConfigured(),
      reason: err?.name === 'TimeoutError' ? `health timed out after ${timeout}ms` : (err?.message || String(err)),
    };
  }
}

export default {
  FASTAPI_ROUTES,
  isFastapiConfigured,
  resolveFastapiRoute,
  unwrapInputData,
  callFastapi,
  getFastapiStatus,
};