// src/schemas/niche.js - Niche Validation Schemas
import { z } from 'zod';

export const AI_MODE_SCHEMA = z.enum(['freeMode', 'proMode', 'ultraMode']).default('freeMode');

export const nicheRequestSchema = z.object({
  topic: z.string().min(2, 'topic must be at least 2 characters'),
  context: z.string().optional(),
  analyzeCompetitors: z.boolean().default(true),
  analyzeDemand: z.boolean().default(true),
  analyzeMonetization: z.boolean().default(true),
  mode: AI_MODE_SCHEMA,
});

export const nicheResponseSchema = z.object({
  niche: z.string(),
  summary: z.string(),
  demandScore: z.number(),
  competitionScore: z.number(),
  monetizationPotential: z.number(),
  audienceProfile: z.object({
    demographics: z.string().optional(),
    interests: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).partial(),
  competitors: z.array(z.object({
    name: z.string(),
    strength: z.number().optional(),
    weakness: z.string().optional(),
  })).optional(),
  recommendations: z.array(z.string()),
});

export default { nicheRequestSchema, nicheResponseSchema, AI_MODE_SCHEMA };