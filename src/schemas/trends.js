// src/schemas/trends.js - Trends Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const trendsRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  timeframe: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
  platforms: z.array(z.string()).optional(),
  mode: AI_MODE_SCHEMA,
});

export const trendsResponseSchema = z.object({
  niche: z.string(),
  timeframe: z.string(),
  risingTopics: z.array(z.string()).default([]),
  platformTrends: z.array(z.string()).default([]),
  momentum: z.object({
    last30Days: z.string().optional(),
    last90Days: z.string().optional(),
    prediction: z.string().optional(),
  }).partial().optional(),
  recommendedActions: z.array(z.string()).default([]),
});

export default { trendsRequestSchema, trendsResponseSchema };