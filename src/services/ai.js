// src/services/ai.js - Unified AI Service
// Supports: OmniRoute, Gemini, Cheaper Inference
// Modes: freeMode, proMode, ultraMode

import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';
import { ExternalError, ValidationError } from '../utils/errorHandler.js';

const AI_CONFIG = {
  omniroute: { enabled: !!env.omniroute.apiKey, baseUrl: env.omniroute.baseUrl, apiKey: env.omniroute.apiKey, defaultModel: env.omniroute.model },
  gemini: { enabled: !!env.gemini.apiKey, baseUrl: env.gemini.baseUrl, apiKey: env.gemini.apiKey, defaultModel: env.gemini.model },
  cheaperInference: { enabled: !!env.cheaperInference.apiKey && !!env.cheaperInference.baseUrl, baseUrl: env.cheaperInference.baseUrl, apiKey: env.cheaperInference.apiKey, defaultModel: env.cheaperInference.model || "auto" },
};

export function selectModel(mode = "freeMode") {
  const modeConfig = constants.MODEL_MODES[mode];
  if (!modeConfig) throw new Error("Unknown mode: " + mode);
  for (const provider of modeConfig.providers) {
    const config = AI_CONFIG[provider];
    if (config && config.enabled) {
      const models = config.defaultModel ? [config.defaultModel] : modeConfig.models;
      if (provider === "omniroute" && config.defaultModel) return { provider: "omniroute", model: config.defaultModel, baseUrl: config.baseUrl, apiKey: config.apiKey };
      if (provider === "gemini" && config.defaultModel) return { provider: "gemini", model: config.defaultModel, baseUrl: config.baseUrl, apiKey: config.apiKey };
      if (models.length > 0) return { provider, model: models[0], baseUrl: config.baseUrl, apiKey: config.apiKey };
    }
  }
  if (AI_CONFIG.omniroute.enabled) return { provider: "omniroute", model: AI_CONFIG.omniroute.defaultModel || "dd-combo", baseUrl: AI_CONFIG.omniroute.baseUrl, apiKey: AI_CONFIG.omniroute.apiKey };
  if (AI_CONFIG.gemini.enabled) return { provider: "gemini", model: AI_CONFIG.gemini.defaultModel || "gemini-2.0-flash", baseUrl: AI_CONFIG.gemini.baseUrl, apiKey: AI_CONFIG.gemini.apiKey };
  if (AI_CONFIG.cheaperInference.enabled) return { provider: "cheaperInference", model: AI_CONFIG.cheaperInference.defaultModel || "auto", baseUrl: AI_CONFIG.cheaperInference.baseUrl, apiKey: AI_CONFIG.cheaperInference.apiKey };
  throw new Error("No AI provider configured.");
}

function buildMessages(prompt, systemPrompt) {
  return [{ role: "system", content: systemPrompt || constants.DEFAULT_SYSTEM_PROMPT }, { role: "user", content: prompt.trim() }];
}

async function callOmniRoute(messages, model, timeoutMs = constants.AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(AI_CONFIG.omniroute.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + AI_CONFIG.omniroute.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || AI_CONFIG.omniroute.defaultModel || "dd-combo", messages: messages, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ExternalError("OmniRoute error: " + response.status, "OmniRoute");
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
    return { reply: reply, provider: "omniroute", model: data.model || model || AI_CONFIG.omniroute.defaultModel, error: null };
  } catch (error) {
    if (error.name === "AbortError") throw new ExternalError("OmniRoute request timed out", "OmniRoute");
    throw error;
  } finally { clearTimeout(timeoutId); }
}

async function callGemini(messages, model, timeoutMs = constants.AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(AI_CONFIG.gemini.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + AI_CONFIG.gemini.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || AI_CONFIG.gemini.defaultModel || "gemini-2.0-flash", messages: messages, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ExternalError("Gemini error: " + response.status, "Gemini");
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
    return { reply: reply, provider: "gemini", model: data.model || model || AI_CONFIG.gemini.defaultModel, error: null };
  } catch (error) {
    if (error.name === "AbortError") throw new ExternalError("Gemini request timed out", "Gemini");
    throw error;
  } finally { clearTimeout(timeoutId); }
}

async function callCheaperInference(messages, model, timeoutMs = constants.AI_TIMEOUT_MS) {
  if (!AI_CONFIG.cheaperInference.enabled) throw new ExternalError("Cheaper Inference not configured", "CheaperInference");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(AI_CONFIG.cheaperInference.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + AI_CONFIG.cheaperInference.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || AI_CONFIG.cheaperInference.defaultModel || "auto", messages: messages, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ExternalError("Cheaper Inference error: " + response.status, "CheaperInference");
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
    return { reply: reply, provider: "cheaperInference", model: data.model || model || AI_CONFIG.cheaperInference.defaultModel, error: null };
  } catch (error) {
    if (error.name === "AbortError") throw new ExternalError("Cheaper Inference request timed out", "CheaperInference");
    throw error;
  } finally { clearTimeout(timeoutId); }
}

export async function callAI(prompt, options = {}) {
  const { mode = "freeMode", systemPrompt, model: modelOverride, jsonMode = false, timeoutMs = constants.AI_TIMEOUT_MS } = options;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) throw new ValidationError("Invalid prompt: must be a non-empty string");
  if (!env.omniroute.apiKey && !env.gemini.apiKey && !env.cheaperInference.apiKey) throw new ExternalError("No AI API key configured", "AI");
  let modelConfig;
  try { modelConfig = selectModel(mode); } catch (error) {
    if (AI_CONFIG.omniroute.enabled) modelConfig = { provider: "omniroute", model: AI_CONFIG.omniroute.defaultModel || "dd-combo", baseUrl: AI_CONFIG.omniroute.baseUrl, apiKey: AI_CONFIG.omniroute.apiKey };
    else if (AI_CONFIG.gemini.enabled) modelConfig = { provider: "gemini", model: AI_CONFIG.gemini.defaultModel || "gemini-2.0-flash", baseUrl: AI_CONFIG.gemini.baseUrl, apiKey: AI_CONFIG.gemini.apiKey };
    else throw error;
  }
  const messages = buildMessages(prompt, systemPrompt);
  const providerCallMap = { omniroute: callOmniRoute, gemini: callGemini, cheaperInference: callCheaperInference };
  const primaryCall = providerCallMap[modelConfig.provider];
  if (!primaryCall) throw new ExternalError("Unknown provider: " + modelConfig.provider, modelConfig.provider);
  try {
    const result = await primaryCall(messages, modelOverride || modelConfig.model, timeoutMs);
    if (jsonMode && result.reply) {
      try {
        const cleaned = result.reply.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        return { reply: JSON.parse(cleaned), provider: result.provider, model: result.model, jsonParsed: true };
      } catch { return result; }
    }
    return result;
  } catch (error) {
    logger.warn("Primary AI call failed, attempting fallback", { provider: modelConfig.provider, error: error.message });
    const fallbackProviders = [];
    if (modelConfig.provider !== "omniroute" && AI_CONFIG.omniroute.enabled) fallbackProviders.push("omniroute");
    if (modelConfig.provider !== "gemini" && AI_CONFIG.gemini.enabled) fallbackProviders.push("gemini");
    if (modelConfig.provider !== "cheaperInference" && AI_CONFIG.cheaperInference.enabled) fallbackProviders.push("cheaperInference");
    for (const fallbackProvider of fallbackProviders) {
      try {
        const fallbackCall = providerCallMap[fallbackProvider];
        const fallbackModel = fallbackProvider === "omniroute" ? AI_CONFIG.omniroute.defaultModel : fallbackProvider === "gemini" ? AI_CONFIG.gemini.defaultModel : AI_CONFIG.cheaperInference.defaultModel;
        const fallbackResult = await fallbackCall(messages, modelOverride || fallbackModel, timeoutMs);
        logger.info("Fallback AI call succeeded", { from: modelConfig.provider, to: fallbackProvider });
        return fallbackResult;
      } catch (fallbackError) { logger.warn("Fallback AI call also failed", { provider: fallbackProvider, error: fallbackError.message }); }
    }
    throw new ExternalError("All AI providers failed. Last error: " + error.message, "AI");
  }
}

export function isAIConfigured() { return !!(env.omniroute.apiKey || env.gemini.apiKey || env.cheaperInference.apiKey); }
export function getAvailableModels() {
  const models = [];
  if (AI_CONFIG.omniroute.enabled) models.push({ provider: "OmniRoute", mode: "freeMode", models: ["dd-combo", "dd-pro", "dd-premium"], apiKeySet: true });
  if (AI_CONFIG.gemini.enabled) models.push({ provider: "Gemini (Google Cloud)", mode: "ultraMode", models: ["gemini-2.0-flash", "gemini-2.0-pro"], apiKeySet: true });
  if (AI_CONFIG.cheaperInference.enabled) models.push({ provider: "Cheaper Inference", mode: "proMode", models: ["auto"], apiKeySet: true });
  return models;
}
export function parseJsonReply(reply) {
  if (typeof reply !== "string") return null;
  const cleaned = reply.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}
export function validateAgainstSchema(schema, value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push("Output must be a JSON object"); return errors; }
  for (const [field, expected] of Object.entries(schema)) {
    if (value[field] === undefined || value[field] === null) { errors.push("Missing required field: " + field); continue; }
    let actual = Array.isArray(value[field]) ? "array" : value[field] === null ? "null" : typeof value[field];
    if (expected !== actual) errors.push(field + " must be " + expected + ", received " + actual);
  }
  return errors;
}

export default { callAI, selectModel, isAIConfigured, getAvailableModels, parseJsonReply, validateAgainstSchema };
