// src/services/aiRouter.js - AI provider routing
// ============================================================================
// PRIMARY:   Vertex AI Gemini        (required)
// FALLBACK1: OpenRouter              (optional - only if OPENROUTER_API_KEY)
// FALLBACK2: Agnes                   (optional - only if AGNES_API_KEY)
// DISABLED:  OmniRoute               (code kept, never called)
// ============================================================================
import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';

const DEFAULT_TIMEOUT = constants.AI_TIMEOUT_MS;

// Model resolution
export function resolvePrimaryModel(mode = 'freeMode') {
  return env.vertex.model || 'gemini-1.5-flash';
}
export function openrouterModel() {
  return env.openrouter.model || 'openai/gpt-4o-mini';
}
export function agnesModel() {
  return env.agnes.model || 'default';
}

// Provider availability
export function isVertexConfigured() {
  return !!(env.gemini.apiKey && env.gemini.apiKey.length > 0);
}
export function isOpenRouterConfigured() {
  return !!(env.openrouter.apiKey && env.openrouter.apiKey.length > 0);
}
export function isAgnesConfigured() {
  return !!(env.agnes.apiKey && env.agnes.baseUrl);
}
export function isOmniRouteConfigured() {
  // OmniRoute is DISABLED - always false regardless of keys present.
  return false;
}

// Shared helpers
async function withTimeout(timeoutMs, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function failed(provider, error) {
  return { reply: '', provider, model: null, error };
}

// PRIMARY: Vertex AI Gemini (generateContent shape, x-goog-api-key header)
export async function callVertexGemini(model, prompt, options = {}) {
  const { systemPrompt, jsonMode, timeout = DEFAULT_TIMEOUT } = options;
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return failed('vertex-gemini', 'GEMINI_API_KEY not configured');

  const modelId = model || resolvePrimaryModel(options.mode);
  // Full Vertex endpoint when a project id is present; Vertex express mode
  // (API-key only) otherwise. Same request/response shape for both.
  const endpoint = env.vertex.projectId
    ? 'https://' + env.vertex.location + '-aiplatform.googleapis.com/v1/projects/' + env.vertex.projectId +
      '/locations/' + env.vertex.location + '/publishers/google/models/' + modelId + ':generateContent'
    : 'https://aiplatform.googleapis.com/v1/publishers/google/models/' + modelId + ':generateContent';

  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt).trim() }] }],
  };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  if (jsonMode) body.generationConfig = { responseMimeType: 'application/json' };

  try {
    const response = await withTimeout(timeout, (signal) => fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }));
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return failed('vertex-gemini', 'Vertex Gemini error: ' + response.status + ' ' + errText.slice(0, 200));
    }
    const data = await response.json();
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const reply = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
    if (!reply) return failed('vertex-gemini', 'Vertex Gemini returned an empty response');
    return { reply, provider: 'vertex-gemini', model: modelId, error: null };
  } catch (error) {
    if (error.name === 'AbortError') return failed('vertex-gemini', 'Vertex Gemini request timed out');
    return failed('vertex-gemini', 'Vertex Gemini request failed: ' + (error.message || String(error)));
  }
}

// FALLBACK 1: OpenRouter (OpenAI-compatible chat/completions)
export async function callOpenRouter(model, prompt, options = {}) {
  const { systemPrompt, jsonMode, timeout = DEFAULT_TIMEOUT } = options;
  if (!isOpenRouterConfigured()) return failed('openrouter', 'OPENROUTER_API_KEY not configured');

  const modelId = model || openrouterModel();
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: String(prompt).trim() });
  const body = { model: modelId, messages, stream: false };
  if (jsonMode) body.response_format = { type: 'json_object' };

  try {
    const response = await withTimeout(timeout, (signal) => fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.openrouter.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }));
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return failed('openrouter', 'OpenRouter error: ' + response.status + ' ' + errText.slice(0, 200));
    }
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!reply) return failed('openrouter', 'OpenRouter returned an empty response');
    return { reply, provider: 'openrouter', model: data.model || modelId, error: null };
  } catch (error) {
    if (error.name === 'AbortError') return failed('openrouter', 'OpenRouter request timed out');
    return failed('openrouter', 'OpenRouter request failed: ' + (error.message || String(error)));
  }
}

// FALLBACK 2: Agnes (OpenAI-compatible chat/completions)
export async function callAgnes(model, prompt, options = {}) {
  const { systemPrompt, jsonMode, timeout = DEFAULT_TIMEOUT } = options;
  if (!isAgnesConfigured()) return failed('agnes', 'AGNES_API_KEY or AGNES_BASE_URL not configured');

  const modelId = model || agnesModel();
  const baseUrl = String(env.agnes.baseUrl).replace(/\/+$/, '');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: String(prompt).trim() });
  const body = { model: modelId, messages, stream: false };
  if (jsonMode) body.response_format = { type: 'json_object' };

  try {
    const response = await withTimeout(timeout, (signal) => fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.agnes.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }));
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return failed('agnes', 'Agnes error: ' + response.status + ' ' + errText.slice(0, 200));
    }
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!reply) return failed('agnes', 'Agnes returned an empty response');
    return { reply, provider: 'agnes', model: data.model || modelId, error: null };
  } catch (error) {
    if (error.name === 'AbortError') return failed('agnes', 'Agnes request timed out');
    return failed('agnes', 'Agnes request failed: ' + (error.message || String(error)));
  }
}

// DISABLED: OmniRoute (code preserved - never called by generate()).
// To re-enable, add an omniroute attempt to the list in generate().
export async function callOmniRoute(model, prompt, options = {}) {
  return failed('omniroute', 'OmniRoute is disabled - Vertex Gemini is the primary provider');
}

// Unified routing: Vertex -> OpenRouter -> Agnes -> error
export async function generate(model, prompt, options = {}) {
  const attempts = [{ name: 'vertex-gemini', fn: () => callVertexGemini(model, prompt, options) }];
  if (isOpenRouterConfigured()) attempts.push({ name: 'openrouter', fn: () => callOpenRouter(openrouterModel(), prompt, options) });
  if (isAgnesConfigured()) attempts.push({ name: 'agnes', fn: () => callAgnes(agnesModel(), prompt, options) });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt.fn();
      if (!result.error) {
        console.log('[aiRouter] ' + attempt.name + ' succeeded (' + result.model + ')');
        return result;
      }
      lastError = result.error;
      logger.warn('AI provider failed, trying next', { provider: attempt.name, error: result.error });
    } catch (error) {
      lastError = error.message || String(error);
      logger.warn('AI provider threw, trying next', { provider: attempt.name, error: lastError });
    }
  }

  const error = 'All AI providers failed. Last error: ' + (lastError || 'no provider available');
  logger.error('AI routing exhausted', { error });
  return { reply: '', provider: null, model: null, error };
}

// Diagnostics
export function providerOrder() {
  const order = ['vertex-gemini'];
  if (isOpenRouterConfigured()) order.push('openrouter');
  if (isAgnesConfigured()) order.push('agnes');
  return order;
}

export function fallbackChain(mode) {
  return providerOrder().slice(1).map((p) => ({ provider: p, model: p === 'openrouter' ? openrouterModel() : agnesModel() }));
}

export function resolveModel(provider, mode) {
  if (provider === 'vertex-gemini' || !provider) return resolvePrimaryModel(mode);
  if (provider === 'openrouter') return openrouterModel();
  if (provider === 'agnes') return agnesModel();
  return resolvePrimaryModel(mode);
}

export function describeRouting() {
  return {
    primary: 'vertex-gemini',
    vertexModel: resolvePrimaryModel(),
    vertexProjectId: env.vertex.projectId || null,
    vertexLocation: env.vertex.location,
    fallbacks: providerOrder().slice(1),
    omniroute: false,
  };
}

export function logRouting() {
  const info = describeRouting();
  logger.info('AI routing configured', info);
  console.log('[aiRouter] PRIMARY  -> vertex-gemini (' + info.vertexModel + ')');
  console.log('[aiRouter] FALLBACK -> ' + (info.fallbacks.length ? info.fallbacks.join(' -> ') : 'none configured'));
  console.log('[aiRouter] OmniRoute -> DISABLED');
  return info;
}

export const aiRouter = {
  generate,
  callVertexGemini,
  callOpenRouter,
  callAgnes,
  callOmniRoute,
  isVertexConfigured,
  isOpenRouterConfigured,
  isAgnesConfigured,
  isOmniRouteConfigured,
  providerOrder,
  resolveModel,
  fallbackChain,
  describeRouting,
  logRouting,
};

export default aiRouter;