// src/schemas/index.js - Schemas Module Entry Point
// Purpose: Export all validation schemas for easy imports.

export { nicheRequestSchema, nicheResponseSchema, AI_MODE_SCHEMA } from './niche.js';
export { roadmapRequestSchema, roadmapResponseSchema, roadmapPhaseSchema, PRIORITY_SCHEMA } from './roadmap.js';
export { scorecardRequestSchema, scorecardResponseSchema, scorecardDimensionSchema } from './scorecard.js';
export { productRequestSchema, productResponseSchema } from './product.js';
export { socialRequestSchema, socialResponseSchema, socialPostSchema, SOCIAL_PLATFORMS } from './social.js';
export { trendsRequestSchema, trendsResponseSchema } from './trends.js';
export { chatRequestSchema, chatResponseSchema, chatMessageSchema } from './chat.js';
export { dashboardRequestSchema, dashboardResponseSchema, dashboardContextSchema } from './dashboard.js';