// src/routes/setModel.js
// ============================================================================
// Model switching — POST /api/set-model
// ============================================================================
// Wires the dashboard model selector to the real runtime:
//
//   1. Validate the model against the OmniRoute registry + live catalog.
//   2. Push the model to the Hermes MCP runtime (hermes.setActiveModel).
//   3. Persist the choice in Supabase `user_model_preferences`.
//   4. Return { activeModel }.
//
// Also exposes:
//   GET /api/models       -> registry grouped by tier (for the dropdown)
//   GET /api/active-model -> the stored model for the current user
// ============================================================================

import env from '../config/env.js';
import logger from '../utils/logger.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { validateModel, fetchLiveCatalog, groupedModels, DEFAULT_MODEL, OMNIROUTE_MODELS } from '../config/models.js';
import { isSupabaseRestConfigured, upsert, select } from '../services/supabaseRest.js';

const TABLE = 'user_model_preferences';

/** Resolve the acting user id (auth-aware, with a shared fallback). */
function resolveUserId(req) {
  const body = req.body || {};
  const fromBody = String(body.user_id || body.userId || '').trim();
  const fromHeader = String(req.headers['x-user-id'] || '').trim();
  const id = fromBody || fromHeader;
  return id || 'default';
}

/** Push the model into the Hermes runtime. Non-fatal. */
async function syncHermesRuntime(modelId) {
  const gateway = (env.hermes?.gatewayUrl || '').trim();
  const local = (env.hermes?.backendUrl || '').trim();

  // Both are full endpoints that accept the { action, ... } contract.
  const targets = [gateway, local].filter(Boolean).map((u) => u.replace(/\/+$/, ''));

  const payload = { action: 'hermes.setActiveModel', modelId, model: modelId };
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': (process.env.DASHBOARD_API_KEY || '').trim(),
  };

  for (const url of targets) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (res.ok) {
        logger.info('Hermes runtime accepted active model', { modelId, url });
        return { synced: true, target: url };
      }
      logger.warn('Hermes runtime rejected active model', { modelId, url, status: res.status });
    } catch (err) {
      logger.warn('Hermes runtime unreachable', { url, error: err.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return { synced: false, target: null };
}

/** Upsert the user's model choice. Returns the stored row (or null). */
async function persistModel(userId, modelId) {
  if (!isSupabaseRestConfigured()) {
    logger.warn('Model not persisted: Supabase REST is not configured');
    return null;
  }
  return upsert(
    TABLE,
    { user_id: userId, model_id: modelId, updated_at: new Date().toISOString() },
    'user_id'
  );
}

/** Read the stored model for a user. Returns null when unset/unavailable. */
async function readStoredModel(userId) {
  if (!isSupabaseRestConfigured()) return null;
  const rows = await select(
    TABLE,
    `user_id=eq.${encodeURIComponent(userId)}&select=model_id,updated_at&limit=1`
  );
  const row = rows[0];
  return row ? { modelId: row.model_id, updatedAt: row.updated_at } : null;
}

// ---------------------------------------------------------------------------
// POST /api/set-model
// ---------------------------------------------------------------------------
export async function handleSetModel(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const modelId = String(body.model || '').trim();
    const userId = resolveUserId(req);

    // 1. Validate against the registry, then the live gateway catalog.
    const catalog = await fetchLiveCatalog({
      baseUrl: env.omniroute?.baseUrl,
      apiKey: env.omniroute?.apiKey,
    });
    const verdict = validateModel(modelId, catalog);
    if (!verdict.valid) {
      logger.warn('Rejected model switch', { modelId, userId, reason: verdict.reason });
      return res.status(400).json({
        ok: false,
        error: verdict.reason,
        code: 'INVALID_MODEL',
        activeModel: null,
        catalogChecked: Array.isArray(catalog),
      });
    }

    // 2. Push to the Hermes MCP runtime.
    const hermes = await syncHermesRuntime(modelId);

    // 3. Persist for this user.
    let persisted = null;
    let persistError = null;
    try {
      persisted = await persistModel(userId, modelId);
    } catch (err) {
      persistError = err.message;
      logger.warn('Model persistence failed', { modelId, userId, error: err.message });
    }

    logger.info('Active model switched', {
      modelId,
      userId,
      tier: verdict.entry?.tier || null,
      source: verdict.source,
      hermesSynced: hermes.synced,
      persisted: Boolean(persisted),
    });

    return res.status(200).json({
      ok: true,
      activeModel: modelId,
      tier: verdict.entry?.tier || null,
      label: verdict.entry?.label || modelId,
      description: verdict.entry?.desc || '',
      verified: verdict.entry?.verified || 'unverified',
      issue: verdict.entry?.issue || null,
      userId,
      hermesSync: hermes.synced,
      persisted: Boolean(persisted),
      persistError,
      updatedAt: persisted?.updated_at || new Date().toISOString(),
    });
  } catch (error) {
    logger.error('set-model failed', error);
    return res.status(500).json({
      ok: false,
      error: 'Model switch failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/models  — registry grouped by tier, for the dashboard dropdown
// ---------------------------------------------------------------------------
export async function handleGetModels(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const catalog = await fetchLiveCatalog({
      baseUrl: env.omniroute?.baseUrl,
      apiKey: env.omniroute?.apiKey,
    });

    // Mark which registry entries are genuinely present in the live catalog.
    const groups = groupedModels().map((group) => ({
      tier: group.tier,
      models: group.models.map((m) => ({
        ...m,
        inLiveCatalog: Array.isArray(catalog) ? catalog.includes(m.value) : null,
      })),
    }));

    return res.status(200).json({
      ok: true,
      defaultModel: DEFAULT_MODEL,
      totalRegistry: OMNIROUTE_MODELS.length,
      catalogReachable: Array.isArray(catalog),
      catalogSize: Array.isArray(catalog) ? catalog.length : 0,
      groups,
    });
  } catch (error) {
    logger.error('get-models failed', error);
    return res.status(500).json({ ok: false, error: 'Could not list models' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/active-model — the stored model for the current user
// ---------------------------------------------------------------------------
export async function handleGetActiveModel(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = resolveUserId(req);
    let stored = null;
    let readError = null;
    try {
      stored = await readStoredModel(userId);
    } catch (err) {
      readError = err.message;
      logger.warn('Could not read stored model', { userId, error: err.message });
    }

    return res.status(200).json({
      ok: true,
      activeModel: stored?.modelId || DEFAULT_MODEL,
      source: stored ? 'supabase' : 'default',
      userId,
      updatedAt: stored?.updatedAt || null,
      readError,
    });
  } catch (error) {
    logger.error('get-active-model failed', error);
    return res.status(500).json({ ok: false, error: 'Could not read active model' });
  }
}

export default { handleSetModel, handleGetModels, handleGetActiveModel };

