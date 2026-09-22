// src/config/models.js
// ============================================================================
// OmniRoute model registry — the single source of truth for model switching.
// ============================================================================
// Every entry is a REAL model id accepted by the OmniRoute gateway
// (OMNIROUTE_BASE_URL). Grouped into the three tiers the dashboard exposes:
//
//   free       -> OmniRoute auto-routes + free-tier combos
//   gemini     -> Gemini / Vertex paid credits
//   bluesminds -> Bluesminds (bm/*) paid provider
//
// `verified` reflects a live probe against /v1/chat/completions:
//   'live'       -> responded successfully
//   'degraded'   -> gateway accepted the id but the upstream provider failed
//                   (quota, credentials, empty catalog). NOT a code bug.
//   'unverified' -> not yet probed
//
// OmniRoute owns provider routing. If an entry is degraded, the fix belongs in
// OmniRoute (provider credentials / combo aliases), not in this file.
// ============================================================================

export const MODEL_TIERS = ['free', 'gemini', 'bluesminds'];

/** Canonical registry. `value` is the exact string sent as the API `model` field. */
export const OMNIROUTE_MODELS = [
  // ── Free — OmniRoute auto-routing combos (verified live) ──
  { value: 'auto/best-chat', tier: 'free', label: 'Best Chat', desc: 'Highest-quality auto route', verified: 'live' },
  { value: 'auto/best-free', tier: 'free', label: 'Best Free', desc: 'Guaranteed free-tier route', verified: 'live' },
  { value: 'auto/best-fast', tier: 'free', label: 'Best Fast', desc: 'Lowest-latency auto route', verified: 'live' },
  { value: 'auto/gemini', tier: 'free', label: 'Best Gemini', desc: 'Auto-routed Gemini', verified: 'live' },
  { value: 'auto/cheap', tier: 'free', label: 'Cheapest', desc: 'Cost-optimised auto route', verified: 'live' },
  { value: 'auto/best-reasoning', tier: 'free', label: 'Best Reasoning', desc: 'Deep-analysis auto route', verified: 'live' },
  { value: 'auto/best-coding', tier: 'free', label: 'Best Coding', desc: 'Code-focused auto route', verified: 'unverified' },
  { value: 'auto/best-vision', tier: 'free', label: 'Best Vision', desc: 'Image-analysis auto route', verified: 'unverified' },
  { value: 'auto/claude-sonnet', tier: 'free', label: 'Claude (auto)', desc: 'Auto-routed Claude Sonnet', verified: 'live' },
  { value: 'auto/minimax', tier: 'free', label: 'MiniMax (auto)', desc: 'Auto-routed MiniMax', verified: 'live' },
  { value: 'auto/glm', tier: 'free', label: 'GLM (auto)', desc: 'Auto-routed GLM', verified: 'degraded', issue: 'Gateway returned a non-standard body.' },

  // ── Free — requested combos (need an alias defined in OmniRoute) ──
  { value: 'static-best-free', tier: 'free', label: 'static-best-free', desc: 'Your free combo', verified: 'degraded', issue: 'OmniRoute: no provider prefix. Define this as a combo alias in OmniRoute.' },
  { value: 'free-stack', tier: 'free', label: 'free-stack', desc: 'Your free stack combo', verified: 'degraded', issue: 'OmniRoute: no provider prefix. Define this as a combo alias in OmniRoute.' },
  { value: 'gemini-3.5-flash-lite', tier: 'free', label: 'Gemini 3.5 Flash Lite', desc: 'Gemini free tier', verified: 'degraded', issue: 'OmniRoute: OpenCode free tier is disabled (403).' },

  // ── Gemini / Vertex paid credits ──
  { value: 'vertex/gemini-2.5-pro', tier: 'gemini', label: 'Gemini 2.5 Pro', desc: 'Vertex paid credits', verified: 'degraded', issue: 'Vertex quota exhausted — resets automatically.' },
  { value: 'vertex/gemini-2.5-flash', tier: 'gemini', label: 'Gemini 2.5 Flash', desc: 'Vertex paid credits', verified: 'degraded', issue: 'Vertex quota exhausted — resets automatically.' },
  { value: 'vertex/gemini-2.0-flash', tier: 'gemini', label: 'Gemini 2.0 Flash', desc: 'Vertex paid credits', verified: 'unverified' },
  { value: 'vertex/claude-sonnet-4-5', tier: 'gemini', label: 'Claude Sonnet 4.5 (Vertex)', desc: 'Vertex paid credits', verified: 'degraded', issue: 'Vertex quota exhausted — resets automatically.' },
  { value: 'gemini-2.5-pro', tier: 'gemini', label: 'gemini-2.5-pro', desc: 'Bare id (your request)', verified: 'degraded', issue: 'OmniRoute routed this to t3.chat, whose credentials are invalid.' },
  { value: 'gemini/gemini-3.7-flash', tier: 'gemini', label: 'Gemini 3.7 Flash', desc: 'Direct Gemini provider', verified: 'degraded', issue: 'OmniRoute: gemini provider has no active live catalog.' },

  // ── Bluesminds (bm/*) paid provider ──
  { value: 'bm/gpt-4o-mini', tier: 'bluesminds', label: 'GPT-4o Mini', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/gpt-4o', tier: 'bluesminds', label: 'GPT-4o', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/gpt-4.1', tier: 'bluesminds', label: 'GPT-4.1', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/claude-sonnet-4.5', tier: 'bluesminds', label: 'Claude Sonnet 4.5', desc: 'Bluesminds (your requested id)', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/claude-sonnet-4-5', tier: 'bluesminds', label: 'Claude Sonnet 4-5', desc: 'Bluesminds catalog id', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/claude-haiku-4-5', tier: 'bluesminds', label: 'Claude Haiku 4.5', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/deepseek-chat', tier: 'bluesminds', label: 'DeepSeek Chat', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/gemini-2.5-pro', tier: 'bluesminds', label: 'Gemini 2.5 Pro (VIP)', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/gemini-2.0-flash', tier: 'bluesminds', label: 'Gemini 2.0 Flash', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/qwen-turbo', tier: 'bluesminds', label: 'Qwen Turbo', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/kimi-k2', tier: 'bluesminds', label: 'Kimi K2', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
  { value: 'bm/glm-4.7', tier: 'bluesminds', label: 'GLM 4.7', desc: 'Bluesminds', verified: 'degraded', issue: 'OmniRoute: bluesminds live catalog is empty.' },
];

/** Default model when nothing is stored for a user. */
export const DEFAULT_MODEL = 'auto/best-chat';

/** True when `id` is a first-class member of the registry. */
export function isRegisteredModel(id) {
  const key = String(id || '').trim();
  return OMNIROUTE_MODELS.some((m) => m.value === key);
}

/** Look up a registry entry (or null). */
export function getModelEntry(id) {
  const key = String(id || '').trim();
  return OMNIROUTE_MODELS.find((m) => m.value === key) || null;
}

/**
 * Validate a model id.
 *
 * Accepts any id present in the live OmniRoute catalog in addition to the
 * curated registry, so newly added upstream models keep working without a code
 * change. Returns a structured verdict instead of throwing.
 */
export function validateModel(id, liveCatalog = null) {
  const key = String(id || '').trim();
  if (!key) {
    return { valid: false, reason: 'A non-empty "model" string is required.', entry: null };
  }
  if (key.length > 200) {
    return { valid: false, reason: 'Model id is unreasonably long.', entry: null };
  }

  const entry = getModelEntry(key);
  if (entry) {
    return { valid: true, reason: null, entry, source: 'registry' };
  }

  if (Array.isArray(liveCatalog) && liveCatalog.includes(key)) {
    return {
      valid: true,
      reason: null,
      entry: {
        value: key,
        tier: 'free',
        label: key,
        desc: 'Discovered in the live OmniRoute catalog',
        verified: 'live',
      },
      source: 'catalog',
    };
  }

  return {
    valid: false,
    reason:
      `Unknown model "${key}". It is not in the registry and not in the live ` +
      'OmniRoute catalog. Fetch GET /api/models for the current list.',
    entry: null,
  };
}

/**
 * Fetch the live OmniRoute model catalog (/v1/models).
 * Returns an array of ids, or null when the gateway is unreachable.
 */
export async function fetchLiveCatalog({ baseUrl, apiKey, timeoutMs = 15000 } = {}) {
  if (!baseUrl || !apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(String(baseUrl).replace(/\/+$/, '') + '/models', {
      headers: { Authorization: 'Bearer ' + apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const ids = (body && body.data ? body.data : []).map((m) => m && m.id).filter(Boolean);
    return ids.length ? ids : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Registry grouped by tier, ready for the dashboard dropdown. */
export function groupedModels() {
  return MODEL_TIERS.map((tier) => ({
    tier,
    models: OMNIROUTE_MODELS.filter((m) => m.tier === tier),
  }));
}

export default {
  MODEL_TIERS,
  OMNIROUTE_MODELS,
  DEFAULT_MODEL,
  isRegisteredModel,
  getModelEntry,
  validateModel,
  fetchLiveCatalog,
  groupedModels,
};
