// src/config/constants.js
// ============================================================================
// Application Constants
// ============================================================================
// Purpose: Static constants used across the application.
// Export: Object with all constants.
// Dependencies: None (standalone module)
// ============================================================================

export const ALLOWED_ORIGINS = [
  'https://dashboard.digitallydefined.online',
  'https://digitallydefined.online',
  'https://www.digitallydefined.online',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 60;

export const CACHE_TTL_MS = {
  short: 5 * 60 * 1000,      // 5 minutes
  medium: 30 * 60 * 1000,    // 30 minutes
  long: 60 * 60 * 1000,      // 1 hour
  forever: null,             // Never expires (use with caution)
};

export const AI_TIMEOUT_MS = 90000; // 90 seconds for AI calls
export const FETCH_TIMEOUT_MS = 30000; // 30 seconds for external API calls

export const NOTION_API_VERSION = '2022-06-28';
export const NOTION_API_BASE = 'https://api.notion.com/v1';

export const FACEBOOK_API_VERSION = 'v21.0';
export const FACEBOOK_API_BASE = 'https://graph.facebook.com/' + FACEBOOK_API_VERSION;

export const DEFAULT_SYSTEM_PROMPT =
  'You are Hermes, the AI business partner for DigitallyDefined. Give short, high-level, no-bullshit business advice. Focus on priorities, risks, and the next move.';

export const DEFAULT_CHAT_SYSTEM_PROMPT =
  'You are the DigitallyDefined Operations AI. Be concise, strategic, and actionable.';

export const MODEL_MODES = {
  freeMode: {
    name: 'Free',
    description: 'OmniRoute free models - basic capability',
    providers: ['omniroute'],
    models: ['dd-combo'],
  },
  proMode: {
    name: 'Pro',
    description: 'OmniRoute paid models - enhanced capability',
    providers: ['omniroute'],
    models: ['dd-pro', 'dd-premium'],
  },
  ultraMode: {
    name: 'Ultra',
    description: 'Gemini API via Google Cloud credits - highest quality',
    providers: ['gemini'],
    models: ['gemini-2.0-flash', 'gemini-2.0-pro'],
  },
};

export const SUPPORTED_INTEGRATIONS = {
  facebook: { name: 'Facebook', requiredEnv: ['FACEBOOK_ACCESS_TOKEN'] },
  brevo: { name: 'Brevo', requiredEnv: ['BREVO_API_KEY'] },
  sheets: { name: 'Google Sheets', requiredEnv: ['SHEETS_WEBHOOK_URL'] },
  notion: { name: 'Notion', requiredEnv: ['NOTION_API_KEY'] },
};

export default {
  ALLOWED_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  CACHE_TTL_MS,
  AI_TIMEOUT_MS,
  FETCH_TIMEOUT_MS,
  NOTION_API_VERSION,
  NOTION_API_BASE,
  FACEBOOK_API_VERSION,
  FACEBOOK_API_BASE,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  MODEL_MODES,
  SUPPORTED_INTEGRATIONS,
};