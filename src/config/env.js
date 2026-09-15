// src/config/env.js
// ============================================================================
// Environment Variable Loading & Validation
// ============================================================================
// Purpose: Centralized env loading with validation for all required vars.
// All values migrated from digitallydefined-os-backend/.env
// Export: env object with all env vars, sanitized and defaulted.
// Dependencies: None (standalone module)
// ============================================================================

/**
 * MIGRATED ENV VARS FROM OLD BACKEND:
 * Source: digitallydefined-os-backend/.env
 * 
 * AUTH & DASHBOARD:
 * - DASHBOARD_API_KEY: Frontend authentication key
 * 
 * SUPABASE:
 * - SUPABASE_URL: Database URL
 * - SUPABASE_ANON_KEY: Public anon key
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key
 * 
 * AI PROVIDERS:
 * - OMNIROUTE_API_KEY: OmniRoute gateway JWT
 * - OMNIROUTE_BASE_URL: OmniRoute base URL
 * - OMNIROUTE_MODEL: Default OmniRoute model
 * - GEMINI_API_KEY / GOOGLE_API_KEY: Google Gemini key
 * - GEMINI_BASE_URL: Gemini endpoint
 * - GEMINI_MODEL: Gemini model name
 * 
 * NOTION:
 * - NOTION_API_KEY: Main Notion integration token
 * - NOTION_IDEAS_DB_ID: Ideas database
 * - NOTION_CONTENT_DB_ID: Content database
 * - NOTION_AUTOMATIONS_DB_ID: Automations database
 * - NOTION_COMMAND_CENTER_DB_ID: Command center database
 * - NOTION_DIGITAL_ASSETS_DB_ID: Digital assets database
 * - NOTION_WEBHOOK_SECRET: Webhook verification secret
 * 
 * FACEBOOK:
 * - FACEBOOK_GROUP_ID: Group ID
 * - FACEBOOK_ACCESS_TOKEN: Page/group token
 * - FACEBOOK_PAGE_ID: Page ID
 * 
 * BREVO:
 * - BREVO_API_KEY: SendInBlue API key
 * - BREVO_LIST_ID: Mailing list ID
 * 
 * GOOGLE SHEETS:
 * - SHEETS_WEBHOOK_URL: Google Apps Script webhook
 * - GOOGLE_CLIENT_ID: OAuth client ID
 * - GOOGLE_CLIENT_SECRET: OAuth client secret
 * - GOOGLE_REFRESH_TOKEN: OAuth refresh token
 * 
 * THIRD-PARTY SERVICES:
 * - GUMROAD_API_KEY: Gumroad API
 * - EXA_API_KEY: Exa search API
 * - FIRECRAWL_API_KEY: Firecrawl API
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * 
 * MCP / AGENT INTEGRATIONS:
 * - ANTIGRAVITY_URL: Antigravity MCP URL
 * - ANTIGRAVITY_API_KEY: Antigravity API key
 * - ANTIGRAVITY_NOTION_TOKEN: Notion token for Antigravity
 * - ANTIGRAVITY_WORKSPACE_ID: Notion workspace ID
 * - HERMES_GATEWAY_URL: Hermes MCP gateway URL
 */

const env = {
  // Core Configuration
  nodeEnv: (process.env.NODE_ENV || 'development').trim(),
  port: parseInt(process.env.PORT || '3000', 10),
  vercelUrl: (process.env.VERCEL_URL || '').trim(),

  // Authentication
  dashboardApiKey: (process.env.DASHBOARD_API_KEY || '').trim(),

  // Supabase
  supabase: {
    url: (process.env.SUPABASE_URL || 'https://kiwzbqjbymdcxmkacvsc.supabase.co').trim(),
    anonKey: (process.env.SUPABASE_ANON_KEY || '').trim(),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  },

  // AI Providers
  omniroute: {
    apiKey: (process.env.OMNIROUTE_API_KEY || '').trim(),
    baseUrl: (process.env.OMNIROUTE_BASE_URL || 'http://127.0.0.1:20128/v1').trim(),
    model: (process.env.OMNIROUTE_MODEL || 'dd-combo').trim(),
    fallbackModels: parseJsonArray(process.env.OMNIROUTE_FALLBACK_MODELS || '[]'),
  },
  gemini: {
    apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
    baseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').trim(),
    model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
  },
  cheaperInference: {
    apiKey: (process.env.CHEAPER_INFERENCE_API_KEY || '').trim(),
    baseUrl: (process.env.CHEAPER_INFERENCE_BASE_URL || '').trim(),
    model: (process.env.CHEAPER_INFERENCE_MODEL || '').trim(),
  },

  // Notion
  notion: {
    apiKey: (process.env.NOTION_API_KEY || '').trim(),
    liveMode: process.env.NOTION_LIVE_MODE === 'true',
    databases: {
      ideas: (process.env.NOTION_IDEAS_DB_ID || '').trim(),
      content: (process.env.NOTION_CONTENT_DB_ID || '').trim(),
      automations: (process.env.NOTION_AUTOMATIONS_DB_ID || '').trim(),
      commandCenter: (process.env.NOTION_COMMAND_CENTER_DB_ID || '').trim(),
      digitalAssets: (process.env.NOTION_DIGITAL_ASSETS_DB_ID || '').trim(),
      publishingQueue: (process.env.NOTION_PUBLISHING_QUEUE_DB_ID || '').trim(),
      contentApprovals: (process.env.NOTION_CONTENT_APPROVALS_DB_ID || '').trim(),
      buyerSignals: (process.env.NOTION_BUYER_SIGNALS_DB_ID || '').trim(),
      aiContentDrafts: (process.env.NOTION_AI_CONTENT_DRAFTS_DB_ID || '').trim(),
      leads: (process.env.NOTION_LEADS_DB_ID || '').trim(),
      quizResults: (process.env.NOTION_QUIZ_RESULTS_DB_ID || '').trim(),
      contactMessages: (process.env.NOTION_CONTACT_MESSAGES_DB_ID || '').trim(),
    },
    webhookSecret: (process.env.NOTION_WEBHOOK_SECRET || '').trim(),
    syncWindowMinutes: parseInt(process.env.NOTION_SYNC_WINDOW_MIN || '420', 10),
  },

  // Facebook & Instagram
  facebook: {
    accessToken: (process.env.FACEBOOK_ACCESS_TOKEN || '').trim(),
    groupId: (process.env.FACEBOOK_GROUP_ID || '').trim(),
    pageId: (process.env.FACEBOOK_PAGE_ID || '').trim(),
  },
  instagram: {
    userId: (process.env.INSTAGRAM_USER_ID || '').trim(),
    businessId: (process.env.INSTAGRAM_BUSINESS_ID || '').trim(),
    accessToken: (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim(),
  },
  threads: {
    appId: (process.env.THREADS_APP_ID || '').trim(),
    appSecret: (process.env.THREADS_APP_SECRET || '').trim(),
    userId: (process.env.THREADS_USER_ID || '').trim(),
    accessToken: (process.env.THREADS_ACCESS_TOKEN || '').trim(),
  },

  // Brevo
  brevo: {
    apiKey: (process.env.BREVO_API_KEY || '').trim(),
    listId: (process.env.BREVO_LIST_ID || '').trim(),
  },

  // Google Sheets
  sheets: {
    webhookUrl: (process.env.SHEETS_WEBHOOK_URL || '').trim(),
    googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    googleClientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    googleRefreshToken: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  },

  // Third-Party Services
  gumroad: { apiKey: (process.env.GUMROAD_API_KEY || '').trim() },
  exa: { apiKey: (process.env.EXA_API_KEY || '').trim() },
  firecrawl: { apiKey: (process.env.FIRECRAWL_API_KEY || '').trim() },

  // Telegram
  telegram: {
    botToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '').trim(),
  },

  // Antigravity MCP
  antigravity: {
    baseUrl: (process.env.ANTIGRAVITY_URL || 'https://mcp.notion.com').trim(),
    apiKey: (process.env.ANTIGRAVITY_API_KEY || '').trim(),
    notionToken: (process.env.ANTIGRAVITY_NOTION_TOKEN || process.env.NOTION_API_KEY || '').trim(),
    workspaceId: (process.env.ANTIGRAVITY_WORKSPACE_ID || '').trim(),
  },

  // Hermes MCP
  hermes: {
    gatewayUrl: (process.env.HERMES_GATEWAY_URL || '').trim(),
    backendUrl: (process.env.BACKEND_HERMES_URL || 'http://localhost:8000').trim(),
  },

  // Linode/OmniRoute internal (not frontend exposed)
  linode: {
    mainBaseUrl: (process.env.MAIN_BASE_URL || '').trim(),
    cliUrl: (process.env.LINODE_CLI_URL || '').trim(),
    machineId: (process.env.MACHINE_ID || '').trim(),
    wsBridgeSecret: (process.env.OMNIROUTE_WS_BRIDGE_SECRET || '').trim(),
  },
  security: {
    jwtSecret: (process.env.JWT_SECRET || '').trim(),
    apiKeySecret: (process.env.API_KEY_SECRET || '').trim(),
    storageEncryptionKey: (process.env.STORAGE_ENCRYPTION_KEY || '').trim(),
    storageEncryptionKeyVersion: (process.env.STORAGE_ENCRYPTION_KEY_VERSION || 'v1').trim(),
  },

  // Monitoring
  agentops: { apiKey: (process.env.AGENTOPS_API_KEY || '').trim() },
};

/**
 * Parse JSON array string safely.
 */
function parseJsonArray(str) {
  if (!str || typeof str !== 'string') return [];
  try {
    const parsed = JSON.parse(str.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


// Validation helpers
export function isAiConfigured() {
  return !!(env.omniroute.apiKey || env.gemini.apiKey || env.cheaperInference.apiKey);
}

export function isNotionConfigured() {
  return !!env.notion.apiKey;
}

export function isFacebookConfigured() {
  return !!(env.facebook.accessToken && (env.facebook.groupId || env.facebook.pageId));
}

export function isBrevoConfigured() {
  return !!(env.brevo.apiKey);
}

export function isSheetsConfigured() {
  return !!env.sheets.webhookUrl;
}

export function isAuthConfigured() {
  return !!(env.dashboardApiKey);
}

export function isSupabaseConfigured() {
  return !!(env.supabase.url && env.supabase.anonKey);
}

/**
 * Get integration configuration report.
 */
export function getIntegrationReport() {
  return {
    auth: isAuthConfigured(),
    supabase: isSupabaseConfigured(),
    ai: {
      omniroute: !!env.omniroute.apiKey && !!env.omniroute.baseUrl,
      omnirouteUrl: env.omniroute.baseUrl,
      gemini: !!env.gemini.apiKey,
      cheaperInference: !!env.cheaperInference.apiKey,
    },
    notion: isNotionConfigured(),
    facebook: isFacebookConfigured(),
    instagram: !!env.instagram.accessToken,
    threads: !!env.threads.accessToken,
    brevo: isBrevoConfigured(),
    sheets: isSheetsConfigured(),
    gumroad: !!env.gumroad.apiKey,
    antigravity: !!env.antigravity.apiKey,
    hermes: !!env.hermes.gatewayUrl,
  };
}

export default env;

