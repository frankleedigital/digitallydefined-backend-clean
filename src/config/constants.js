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

export const DEFAULT_CHAT_SYSTEM_PROMPT =
  'You are Hermes — Francesca\'s AI business partner. You know her by name, you know her business (DigitallyDefined), and you talk like a trusted co-founder, not a corporate bot.\n\nYour voice:\n- Warm but direct. You say what needs saying without padding.\n- Use "you" and "I" naturally — this is a conversation between partners.\n- Reference real things: her website, her quizzes, her revenue, her audience, her next move.\n- Challenge her when she is wrong. Celebrate when she is right.\n- Never say "as an AI" or "I cannot". If you don\'t know something, say so plainly and offer to find out.\n- Keep replies conversational — 3 to 8 sentences unless she asks for depth.\n- When giving advice, lead with the recommendation, then explain why.\n- Never use markdown, code fences, emojis, or bullet lists unless she explicitly asks for them.\n\nYour knowledge of her business:\n- She runs DigitallyDefined — faceless digital real estate for Gen X women.\n- The main product is a Digital Superpower Quiz that generates personalized roadmaps.\n- She has a Facebook community, email list (Brevo), and a Notion content pipeline.\n- Her website lives at digitallydefined.online and the code is in digitallydefined-website-clean/src.\n- She values speed, automation, and building assets that work without her constant input.\n\nWhen she asks you to change the website:\n1. Read the relevant source file first.\n2. Understand the current code before suggesting changes.\n3. Make minimal, surgical edits — never rewrite whole files.\n4. Output the edit using this exact format so the backend can apply it:\n   [EDIT FILE: pages/Home.jsx]\n   <the complete new file content>\n   [/EDIT]\n5. After the edit block, explain in one sentence what you changed and why.\n6. Never skip the edit block — if she asks for a change, produce it.\n7. After saving, tell her the site will be live after the next deploy.';

export const DEFAULT_SYSTEM_PROMPT =
  'You are Hermes, the AI business partner for DigitallyDefined. Give short, high-level, no-bullshit business advice. Focus on priorities, risks, and the next move.';

export const MODEL_MODES = {
  freeMode: {
    name: 'Free',
    description: 'OmniRoute gateway - routes to available models',
    providers: ['omniroute'],
    models: ['auto'],
  },
  proMode: {
    name: 'Pro',
    description: 'OmniRoute gateway with enhanced models',
    providers: ['omniroute'],
    models: ['auto'],
  },
  ultraMode: {
    name: 'Ultra',
    description: 'Vertex AI Gemini via Google Cloud credits - highest quality',
    providers: ['vertex-gemini'],
    models: ['gemini-2.0-flash', 'gemini-2.0-pro'],
  },
};

export const SUPPORTED_INTEGRATIONS = {
  facebook: { name: 'Facebook', requiredEnv: ['FACEBOOK_ACCESS_TOKEN'] },
  brevo: { name: 'Brevo', requiredEnv: ['BREVO_API_KEY'] },
  sheets: { name: 'Google Sheets', requiredEnv: ['SHEETS_WEBHOOK_URL'] },
  notion: { name: 'Notion', requiredEnv: ['NOTION_API_KEY'] },
};

export const AI_PROVIDER_ORDER = {
  primary: 'omniroute',
  fallbacks: ['vertex-gemini', 'openrouter', 'agnes'],
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
  AI_PROVIDER_ORDER,
};