// src/schemas/competition.js - Competition Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const competitionRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  topCompetitors: z.array(z.string()).optional(),
  depth: z.enum(['overview', 'detailed']).default('overview'),
  mode: AI_MODE_SCHEMA,
});

export const competitionResponseSchema = z.object({
  niche: z.string(),
  topCompetitors: z.array(z.object({
    name: z.string(),
    strength: z.string(),
    weakness: z.string(),
    differentiator: z.string(),
  })).default([]),
  marketGap: z.string().optional(),
  recommendedPositioning: z.string().optional(),
  threatLevel: z.enum(['low', 'medium', 'high']).optional(),
  actions: z.array(z.string()).default([]),
});

export default { competitionRequestSchema, competitionResponseSchema };