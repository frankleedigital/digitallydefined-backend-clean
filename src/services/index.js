// src/services/index.js - Services Module Entry Point
// Purpose: Export all services for easy imports.

export { default as ai } from './ai.js';
export {
  callAI,
  selectModel,
  isAIConfigured,
  getAvailableModels,
  parseJsonReply,
  validateAgainstSchema,
} from './ai.js';

export { default as aiRouter } from './aiRouter.js';
export { providerOrder, resolveModel, fallbackChain, describeRouting, logRouting } from './aiRouter.js';

export { default as notion } from './notion.js';
export {
  isNotionConfigured as isNotionServiceConfigured,
  getNotionStatus,
  createDatabase,
  updateDatabase,
  queryDatabase,
  getPage,
  createPage,
  updatePage,
  appendBlock,
  propertyTypes,
} from './notion.js';

export { default as integrations } from './integrations.js';
export {
  isFacebookConfigured,
  getFacebookStatus,
  fetchFacebookGroup,
  postToFacebookPage,
  postToFacebookGroup,
  isBrevoConfigured,
  getBrevoStatus,
  fetchBrevoStats,
  isSheetsConfigured,
  getSheetsStatus,
  fetchSheetsData,
  postToSheetsWebhook,
  getAllIntegrationStatus,
} from './integrations.js';
export { default as antigravity } from './antigravity.js';