// src/schemas/opportunities.js - Opportunities Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const opportunitiesRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  audience: z.string().optional(),
  budget: z.enum(['low', 'medium', 'high']).optional(),
  mode: AI_MODE_SCHEMA,
});

export const opportunitiesResponseSchema = z.object({
  niche: z.string(),
  opportunityGaps: z.array(z.string()).default([]),
  quickWins: z.array(z.string()).default([]),
  longTermBets: z.array(z.string()).default([]),
  recommendedProducts: z.array(z.object({
    name: z.string(),
    format: z.string(),
    priceRange: z.string(),
    effort: z.string(),
  })).default([]),
  marketSize: z.string().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
});

export default { opportunitiesRequestSchema, opportunitiesResponseSchema };