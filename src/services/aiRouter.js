// src/services/aiRouter.js - OmniRoute-first model routing + fallback
// Purpose: Single place that decides which provider/model to use and handles
// fallback when the primary provider fails. Mirrors the old backend's aiRouter.
import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';

/** Provider order: OmniRoute (local) first, then Gemini when configured. */
export function providerOrder() {
  const order = ['omniroute'];
  if (env.gemini.apiKey && env.gemini.apiKey.length > 0) order.push('gemini');
  if (env.cheaperInference.apiKey && env.cheaperInference.baseUrl) order.push('cheaperInference');
  return order;
}

/** Resolve the model string for a provider + mode. */
export function resolveModel(provider, mode = 'freeMode') {
  if (provider === 'omniroute') return env.omniroute.model || constants.MODEL_MODES.freeMode.models[0];
  if (provider === 'gemini') return env.gemini.model || 'gemini-2.5-flash';
  if (provider === 'cheaperInference') return env.cheaperInference.model || 'auto';
  return 'auto';
}

/** Build the fallback chain (OmniRoute models then other providers). */
export function fallbackChain(mode = 'freeMode') {
  const chain = [];
  const modeModels = constants.MODEL_MODES[mode] ? constants.MODEL_MODES[mode].models : [];
  for (const m of env.omniroute.fallbackModels) chain.push({ provider: 'omniroute', model: m });
  for (const m of modeModels) chain.push({ provider: 'omniroute', model: m });
  if (env.gemini.apiKey && env.gemini.apiKey.length > 0) chain.push({ provider: 'gemini', model: resolveModel('gemini', mode) });
  if (env.cheaperInference.apiKey && env.cheaperInference.baseUrl) chain.push({ provider: 'cheaperInference', model: resolveModel('cheaperInference', mode) });
  // De-duplicate while preserving order.
  const seen = new Set();
  return chain.filter((c) => {
    const k = c.provider + ':' + c.model;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Describe the currently active routing configuration (for logging/diagnostics). */
export function describeRouting() {
  return {
    order: providerOrder(),
    omnirouteUrl: env.omniroute.baseUrl,
    omnirouteModel: env.omniroute.model,
    geminiEnabled: !!(env.gemini.apiKey && env.gemini.apiKey.length > 0),
    cheaperInferenceEnabled: !!(env.cheaperInference.apiKey && env.cheaperInference.baseUrl),
  };
}

/** Log the resolved routing once at startup. */
export function logRouting() {
  const info = describeRouting();
  logger.info('AI routing configured', info);
  console.log('[aiRouter] provider order -> ' + info.order.join(' -> '));
  console.log('[aiRouter] OmniRoute endpoint -> ' + info.omnirouteUrl + ' (model: ' + info.omnirouteModel + ')');
  if (!info.geminiEnabled) console.log('[aiRouter] Gemini fallback disabled (GEMINI_API_KEY not set)');
  return info;
}

export default { providerOrder, resolveModel, fallbackChain, describeRouting, logRouting };