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
    baseUrl: (process.env.OMNIROUTE_BASE_URL || 'https://ai.digitallydefined.online/v1').trim(),
    model: (process.env.OMNIROUTE_MODEL || 'auto').trim(),
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

  // Vertex AI Gemini (PRIMARY AI provider)
  vertex: {
    projectId: (process.env.VERTEX_PROJECT_ID || '').trim(),
    location: (process.env.VERTEX_LOCATION || 'us-central1').trim(),
    model: (process.env.VERTEX_MODEL || 'gemini-1.5-flash').trim(),
  },

  // OpenRouter (optional fallback)
  openrouter: {
    apiKey: (process.env.OPENROUTER_API_KEY || '').trim(),
    model: (process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini').trim(),
  },

  // Agnes (optional fallback)
  agnes: {
    apiKey: (process.env.AGNES_API_KEY || '').trim(),
    baseUrl: (process.env.AGNES_BASE_URL || '').trim(),
    model: (process.env.AGNES_MODEL || 'default').trim(),
  },

  // Notion
  notion: {
    apiKey: (process.env.NOTION_API_KEY || '').trim(),
    token: (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || '').trim(),
    secret: (process.env.NOTION_SECRET || process.env.NOTION_API_KEY || '').trim(),
    baseUrl: (process.env.NOTION_BASE_URL || 'https://api.notion.com/v1').trim(),
    version: (process.env.NOTION_VERSION || '2022-06-28').trim(),
    syncUrl: (process.env.NOTION_SYNC_URL || '').trim(),
    phase21LiveApproval: process.env.NOTION_PHASE21_LIVE_APPROVAL === 'true',
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
    pageAccessToken: (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || '').trim(),
    groupId: (process.env.FACEBOOK_GROUP_ID || '').trim(),
    pageId: (process.env.FACEBOOK_PAGE_ID || '').trim(),
  },
  instagram: {
    userId: (process.env.INSTAGRAM_USER_ID || process.env.INSTAGRAM_USERNAME || '').trim(),
    businessId: (process.env.INSTAGRAM_BUSINESS_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim(),
    accessToken: (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim(),
  },
  threads: {
    appId: (process.env.THREADS_APP_ID || '').trim(),
    appSecret: (process.env.THREADS_APP_SECRET || '').trim(),
    userId: (process.env.THREADS_USER_ID || '').trim(),
    accessToken: (process.env.THREADS_ACCESS_TOKEN || '').trim(),
  },

  // Meta (Facebook app-level)
  meta: {
    appId: (process.env.META_APP_ID || '').trim(),
    appSecret: (process.env.META_APP_SECRET || '').trim(),
  },

  // Other social platforms (configured but not yet wired)
  linkedin: {
    accessToken: (process.env.LINKEDIN_ACCESS_TOKEN || '').trim(),
    authorUrn: (process.env.LINKEDIN_AUTHOR_URN || '').trim(),
    organizationId: (process.env.LINKEDIN_ORGANIZATION_ID || '').trim(),
  },
  pinterest: { accessToken: (process.env.PINTEREST_ACCESS_TOKEN || '').trim() },
  tiktok: { accessToken: (process.env.TIKTOK_ACCESS_TOKEN || '').trim() },
  youtube: {
    apiKey: (process.env.YOUTUBE_API_KEY || '').trim(),
    channelId: (process.env.YOUTUBE_CHANNEL_ID || '').trim(),
  },
  slack: {
    botToken: (process.env.SLACK_BOT_TOKEN || '').trim(),
    channelId: (process.env.SLACK_CHANNEL_ID || '').trim(),
  },

  // FastAPI microservice layer
  fastapi: {
    baseUrl: (process.env.FASTAPI_BASE_URL || 'http://localhost:8000').trim(),
    apiKey: (process.env.FASTAPI_API_KEY || '').trim(),
  },

  // Brevo
  brevo: {
    apiKey: (process.env.BREVO_API_KEY || '').trim(),
    listId: (process.env.BREVO_LIST_ID || '').trim(),
    fromEmail: (process.env.BREVO_FROM_EMAIL || '').trim(),
    fromName: (process.env.BREVO_FROM_NAME || 'DigitallyDefined').trim(),
  },

  // Google Sheets / OAuth
  sheets: {
    webhookUrl: (process.env.SHEETS_WEBHOOK_URL || '').trim(),
    apiKey: (process.env.GOOGLE_SHEETS_API_KEY || '').trim(),
    sheetId: (process.env.GOOGLE_SHEETS_ID || '').trim(),
    googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    googleClientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    refreshToken: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  },

  // Third-Party Services
  gumroad: { apiKey: (process.env.GUMROAD_API_KEY || '').trim() },
  exa: { apiKey: (process.env.EXA_API_KEY || '').trim() },
  firecrawl: { apiKey: (process.env.FIRECRAWL_API_KEY || '').trim() },

  // Telegram
  telegram: {
    botToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '').trim(),
    chatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  },

  // Antigravity MCP
  antigravity: {
    baseUrl: (process.env.ANTIGRAVITY_URL || 'https://mcp.notion.com').trim(),
    apiKey: (process.env.ANTIGRAVITY_API_KEY || '').trim(),
    notionToken: (process.env.ANTIGRAVITY_NOTION_TOKEN || process.env.NOTION_API_KEY || '').trim(),
    workspaceId: (process.env.ANTIGRAVITY_WORKSPACE_ID || '').trim(),
  },

  // Google Analytics 4 (via Data API or Sheets webhook fallback)
  ga4: {
    measurementId: (process.env.GA4_MEASUREMENT_ID || '').trim(),
    propertyId: (process.env.GA4_PROPERTY_ID || '').trim(),
  },

  // Hermes MCP
  hermes: {
    gatewayUrl: (process.env.HERMES_GATEWAY_URL || '').trim(),
    backendUrl: (process.env.BACKEND_HERMES_URL || 'http://localhost:8000').trim(),
    mcpPort: parseInt(process.env.HERMES_MCP_PORT || '8000', 10),
  },

  // OmniRoute internal / local gateway extras (not frontend exposed)
  linode: {
    mainBaseUrl: (process.env.MAIN_BASE_URL || '').trim(),
    cliUrl: (process.env.LINODE_CLI_URL || '').trim(),
    machineId: (process.env.MACHINE_ID || process.env.OMNIROUTE_MACHINE_ID || '').trim(),
    wsBridgeSecret: (process.env.OMNIROUTE_WS_BRIDGE_SECRET || '').trim(),
    wsUrl: (process.env.OMNIROUTE_WS_URL || '').trim(),
    dashboardUrl: (process.env.OMNIROUTE_DASHBOARD_URL || '').trim(),
    timeoutMs: parseInt(process.env.OMNIROUTE_TIMEOUT_MS || '60000', 10),
  },
  security: {
    jwtSecret: (process.env.JWT_SECRET || '').trim(),
    apiKeySecret: (process.env.API_KEY_SECRET || '').trim(),
    storageEncryptionKey: (process.env.STORAGE_ENCRYPTION_KEY || '').trim(),
    encryptionKey: (process.env.ENCRYPTION_KEY || process.env.STORAGE_ENCRYPTION_KEY || '').trim(),
    storageEncryptionKeyVersion: (process.env.STORAGE_ENCRYPTION_KEY_VERSION || 'v1').trim(),
  },

  // Monitoring
  agentops: { apiKey: (process.env.AGENTOPS_API_KEY || '').trim() },
  monitoring: { apiKey: (process.env.MONITORING_API_KEY || process.env.AGENTOPS_API_KEY || '').trim() },

  // Sellable (product onboarding workflow)
  sellable: {
    dryRun: process.env.SELLABLE_DRY_RUN !== 'false',
    liveApproval: process.env.SELLABLE_LIVE_APPROVAL === 'true',
    fromEmail: (process.env.SELLABLE_FROM_EMAIL || '').trim(),
    fromName: (process.env.SELLABLE_FROM_NAME || 'DigitallyDefined').trim(),
    brevoListId: (process.env.SELLABLE_BREVO_LIST_ID || '').trim(),
    onboardingDays: parseInt(process.env.SELLABLE_ONBOARDING_DAYS || '7', 10),
  },

  // Cron / automation flags
  cron: {
    logPath: (process.env.CRON_LOG_PATH || '').trim(),
    dedupStorePath: (process.env.CRON_DEDUP_STORE_PATH || '').trim(),
    livePosts: process.env.CRON_LIVE_POSTS === 'true' || process.env.LIVE_CRON_POSTS === 'true',
  },

  // Puter (optional workspace integration)
  puter: {
    enabled: process.env.PUTER_ENABLED === 'true',
    apiKey: (process.env.PUTER_API_KEY || '').trim(),
  },
  outputDir: (process.env.OUTPUT_DIR || 'output').trim(),
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
  // Primary is OmniRoute; Vertex/OpenRouter/Agnes are optional fallbacks.
  return isOmniRouteEnabled() || isVertexConfigured() || isOpenRouterConfigured() || isAgnesConfigured();
}

export function isVertexConfigured() {
  return !!(env.gemini.apiKey && env.gemini.apiKey.length > 0);
}

export function isOpenRouterConfigured() {
  return !!(env.openrouter.apiKey && env.openrouter.apiKey.length > 0);
}

export function isAgnesConfigured() {
  return !!(env.agnes.apiKey && env.agnes.baseUrl);
}

// OmniRoute is the PRIMARY AI provider (enabled when keys are present).
export function isOmniRouteEnabled() {
  return !!(env.omniroute.apiKey && env.omniroute.baseUrl && env.omniroute.baseUrl.length > 0);
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

export function isFastapiConfigured() {
  return !!env.fastapi.baseUrl;
}

export function isInstagramConfigured() {
  return !!env.instagram.accessToken;
}

export function isThreadsConfigured() {
  return !!(env.threads.accessToken && env.threads.appId);
}

export function isTelegramConfigured() {
  return !!env.telegram.botToken;
}

export function isAntigravityConfigured() {
  return !!env.antigravity.apiKey;
}

export function isHermesConfigured() {
  return !!env.hermes.gatewayUrl;
}

export function isSecurityConfigured() {
  return !!(env.security.jwtSecret && env.security.apiKeySecret && env.security.storageEncryptionKey);
}

// ============================================================================
// Required vs optional variable validation
// ============================================================================
// REQUIRED: the backend cannot function without these.
// OPTIONAL: integrations that degrade gracefully when absent.
// ============================================================================

export const REQUIRED_VARS = [
  { key: 'DASHBOARD_API_KEY', value: () => env.dashboardApiKey, purpose: 'API-key auth for all /api/* routes' },
  { key: 'SUPABASE_URL', value: () => env.supabase.url, purpose: 'Supabase project URL' },
  { key: 'SUPABASE_ANON_KEY', value: () => env.supabase.anonKey, purpose: 'Supabase public anon key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: () => env.supabase.serviceRoleKey, purpose: 'Supabase service-role key (server writes)' },
  { key: 'OMNIROUTE_API_KEY', value: () => env.omniroute.apiKey, purpose: 'OmniRoute gateway JWT (primary AI provider)' },
  { key: 'OMNIROUTE_BASE_URL', value: () => env.omniroute.baseUrl, purpose: 'OmniRoute gateway base URL (Cloudflare tunnel)' },
];

export const OPTIONAL_VARS = [
  { key: 'OPENROUTER_API_KEY', value: () => env.openrouter.apiKey, purpose: 'OpenRouter fallback provider' },
  { key: 'OPENROUTER_MODEL', value: () => env.openrouter.model, purpose: 'OpenRouter model id' },
  { key: 'AGNES_API_KEY', value: () => env.agnes.apiKey, purpose: 'Agnes fallback provider' },
  { key: 'AGNES_BASE_URL', value: () => env.agnes.baseUrl, purpose: 'Agnes gateway base URL' },
  { key: 'AGNES_MODEL', value: () => env.agnes.model, purpose: 'Agnes model id' },
  // OmniRoute is now the primary provider (listed in REQUIRED_VARS above).
  { key: 'OMNIROUTE_MODEL', value: () => env.omniroute.model, purpose: 'Default OmniRoute model' },
  { key: 'CHEAPER_INFERENCE_API_KEY', value: () => env.cheaperInference.apiKey, purpose: 'Cheaper Inference provider' },
  { key: 'FASTAPI_BASE_URL', value: () => env.fastapi.baseUrl, purpose: 'FastAPI microservice layer' },
  { key: 'FASTAPI_API_KEY', value: () => env.fastapi.apiKey, purpose: 'FastAPI shared auth key' },
  { key: 'NOTION_API_KEY', value: () => env.notion.apiKey, purpose: 'Notion integration token' },
  { key: 'NOTION_WEBHOOK_SECRET', value: () => env.notion.webhookSecret, purpose: 'Notion webhook verification' },
  { key: 'NOTION_COMMAND_CENTER_DB_ID', value: () => env.notion.databases.commandCenter, purpose: 'Notion command-center database' },
  { key: 'NOTION_PUBLISHING_QUEUE_DB_ID', value: () => env.notion.databases.publishingQueue, purpose: 'Notion publishing queue' },
  { key: 'NOTION_CONTENT_APPROVALS_DB_ID', value: () => env.notion.databases.contentApprovals, purpose: 'Notion content approvals' },
  { key: 'NOTION_BUYER_SIGNALS_DB_ID', value: () => env.notion.databases.buyerSignals, purpose: 'Notion buyer signals' },
  { key: 'NOTION_AI_CONTENT_DRAFTS_DB_ID', value: () => env.notion.databases.aiContentDrafts, purpose: 'Notion AI content drafts' },
  { key: 'NOTION_LEADS_DB_ID', value: () => env.notion.databases.leads, purpose: 'Notion leads database' },
  { key: 'NOTION_QUIZ_RESULTS_DB_ID', value: () => env.notion.databases.quizResults, purpose: 'Notion quiz results' },
  { key: 'NOTION_CONTACT_MESSAGES_DB_ID', value: () => env.notion.databases.contactMessages, purpose: 'Notion contact messages' },
  { key: 'FACEBOOK_ACCESS_TOKEN', value: () => env.facebook.accessToken, purpose: 'Facebook Graph API token' },
  { key: 'FACEBOOK_GROUP_ID', value: () => env.facebook.groupId, purpose: 'Facebook community group' },
  { key: 'FACEBOOK_PAGE_ID', value: () => env.facebook.pageId, purpose: 'Facebook page ID' },
  { key: 'INSTAGRAM_ACCESS_TOKEN', value: () => env.instagram.accessToken, purpose: 'Instagram Graph API token' },
  { key: 'THREADS_ACCESS_TOKEN', value: () => env.threads.accessToken, purpose: 'Threads API token' },
  { key: 'LINKEDIN_ACCESS_TOKEN', value: () => env.linkedin.accessToken, purpose: 'LinkedIn API token' },
  { key: 'BREVO_API_KEY', value: () => env.brevo.apiKey, purpose: 'Brevo transactional email' },
  { key: 'SHEETS_WEBHOOK_URL', value: () => env.sheets.webhookUrl, purpose: 'Google Apps Script webhook' },
  { key: 'GOOGLE_REFRESH_TOKEN', value: () => env.sheets.googleRefreshToken, purpose: 'Google OAuth refresh token' },
  { key: 'GUMROAD_API_KEY', value: () => env.gumroad.apiKey, purpose: 'Gumroad product API' },
  { key: 'EXA_API_KEY', value: () => env.exa.apiKey, purpose: 'Exa search API' },
  { key: 'FIRECRAWL_API_KEY', value: () => env.firecrawl.apiKey, purpose: 'Firecrawl scraping API' },
  { key: 'TELEGRAM_BOT_TOKEN', value: () => env.telegram.botToken, purpose: 'Telegram bot notifications' },
  { key: 'ANTIGRAVITY_API_KEY', value: () => env.antigravity.apiKey, purpose: 'Antigravity MCP (Notion Architect)' },
  { key: 'ANTIGRAVITY_WORKSPACE_ID', value: () => env.antigravity.workspaceId, purpose: 'Antigravity Notion workspace ID' },
  { key: 'HERMES_GATEWAY_URL', value: () => env.hermes.gatewayUrl, purpose: 'Hermes MCP gateway URL' },
  { key: 'JWT_SECRET', value: () => env.security.jwtSecret, purpose: 'JWT signing/verification' },
  { key: 'API_KEY_SECRET', value: () => env.security.apiKeySecret, purpose: 'API-key management secret' },
  { key: 'STORAGE_ENCRYPTION_KEY', value: () => env.security.storageEncryptionKey, purpose: 'Credential encryption at rest' },
  { key: 'AGENTOPS_API_KEY', value: () => env.agentops.apiKey, purpose: 'AgentOps monitoring' },
];

/**
 * Validate environment configuration.
 * @returns {{ ok: boolean, missingRequired: string[], missingOptional: string[], configured: object }}
 */
export function validateEnv() {
  const missingRequired = REQUIRED_VARS.filter((v) => !v.value()).map((v) => v.key);
  const missingOptional = OPTIONAL_VARS.filter((v) => !v.value()).map((v) => v.key);
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    configured: getIntegrationReport(),
  };
}

/**
 * Log the environment validation result once at startup.
 * Prints clear messages for any missing keys (no silent failures).
 */
let hasLoggedValidation = false;
export function logEnvValidation() {
  if (hasLoggedValidation) return validateEnv();
  hasLoggedValidation = true;

  const result = validateEnv();

  if (result.missingRequired.length === 0) {
    console.log('[env] All required variables configured (' + REQUIRED_VARS.length + '/' + REQUIRED_VARS.length + ')');
  } else {
    console.error('[env] MISSING REQUIRED VARIABLES -> ' + result.missingRequired.join(', '));
    for (const key of result.missingRequired) {
      const meta = REQUIRED_VARS.find((v) => v.key === key);
      console.error('  - ' + key + ': ' + (meta ? meta.purpose : 'required'));
    }
  }

  if (result.missingOptional.length > 0) {
    console.warn('[env] Optional variables not set (' + (OPTIONAL_VARS.length - result.missingOptional.length) + '/' + OPTIONAL_VARS.length + ') -> ' + result.missingOptional.join(', '));
  } else {
    console.log('[env] All optional variables configured (' + OPTIONAL_VARS.length + '/' + OPTIONAL_VARS.length + ')');
  }

  return result;
}

/**
 * Get integration configuration report.
 */
export function getIntegrationReport() {
  return {
    auth: isAuthConfigured(),
    supabase: isSupabaseConfigured(),
    ai: {
      primary: isOmniRouteEnabled() ? 'omniroute' : (isVertexConfigured() ? 'vertex-gemini' : null),
      vertex: isVertexConfigured(),
      vertexModel: env.vertex.model,
      vertexProjectId: env.vertex.projectId || null,
      vertexLocation: env.vertex.location,
      fallbacks: [
        ...(isVertexConfigured() && isOmniRouteEnabled() ? ['vertex-gemini'] : []),
        ...(isOpenRouterConfigured() ? ['openrouter'] : []),
        ...(isAgnesConfigured() ? ['agnes'] : []),
      ],
      openrouter: isOpenRouterConfigured(),
      agnes: isAgnesConfigured(),
      omniroute: isOmniRouteEnabled(),
      omnirouteUrl: env.omniroute.baseUrl,
      omnirouteModel: env.omniroute.model,
      cheaperInference: !!env.cheaperInference.apiKey,
    },
    fastapi: isFastapiConfigured(),
    notion: isNotionConfigured(),
    notionDatabases: Object.entries(env.notion.databases).filter(([, v]) => !!v).map(([k]) => k),
    facebook: isFacebookConfigured(),
    meta: !!(env.meta.appId && env.meta.appSecret),
    instagram: isInstagramConfigured(),
    threads: isThreadsConfigured(),
    linkedin: !!env.linkedin.accessToken,
    pinterest: !!env.pinterest.accessToken,
    tiktok: !!env.tiktok.accessToken,
    youtube: !!env.youtube.apiKey,
    slack: !!env.slack.botToken,
    brevo: isBrevoConfigured(),
    sheets: isSheetsConfigured(),
    gumroad: !!env.gumroad.apiKey,
    exa: !!env.exa.apiKey,
    firecrawl: !!env.firecrawl.apiKey,
    telegram: isTelegramConfigured(),
    antigravity: isAntigravityConfigured(),
    hermes: isHermesConfigured(),
    ga4: !!(env.ga4.measurementId || env.ga4.propertyId),
    security: isSecurityConfigured(),
    agentops: !!env.agentops.apiKey,
    puter: env.puter.enabled,
  };
}

export { env };
export default env;

