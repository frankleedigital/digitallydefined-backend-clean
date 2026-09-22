// src/services/supabaseRest.js
// ============================================================================
// Minimal Supabase REST (PostgREST) client using the service-role key.
// ============================================================================
// Used for server-side persistence that must not be exposed to the browser
// (e.g. user_model_preferences). Mirrors the pattern used by the edge
// functions' `_shared/supabase-store.ts`.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import env from '../config/env.js';

function credentials() {
  const url = (env.supabase?.url || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    env.supabase?.serviceRoleKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  return { url, key };
}

/** True when both the URL and service-role key are configured. */
export function isSupabaseRestConfigured() {
  const { url, key } = credentials();
  return Boolean(url && key);
}

function headers(extra = {}) {
  const { key } = credentials();
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * Low-level PostgREST request.
 * @param {string} path - e.g. "/rest/v1/user_model_preferences"
 * @param {object} init - fetch init (+ `prefer` for the Prefer header)
 */
async function request(path, init = {}) {
  const { url } = credentials();
  if (!isSupabaseRestConfigured()) {
    throw new Error('Supabase REST is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  const { prefer, ...rest } = init;
  const res = await fetch(url + path, {
    ...rest,
    headers: headers({
      ...(prefer ? { Prefer: prefer } : {}),
      ...(rest.headers || {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Insert-or-update a row, resolving conflicts on `onConflict`. */
export async function upsert(table, row, onConflict) {
  const conflict = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const rows = await request(`/rest/v1/${table}${conflict}`, {
    method: 'POST',
    body: JSON.stringify(Array.isArray(row) ? row : [row]),
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

/** Select rows with an optional PostgREST filter query string. */
export async function select(table, query = '') {
  const qs = query ? (query.startsWith('?') ? query : '?' + query) : '';
  const rows = await request(`/rest/v1/${table}${qs}`, { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
}

export default { isSupabaseRestConfigured, upsert, select };
