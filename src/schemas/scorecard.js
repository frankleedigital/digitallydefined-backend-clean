// src/schemas/scorecard.js - Scorecard Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const scorecardRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  businessName: z.string().optional(),
  metrics: z.record(z.union([z.string(), z.number()])).optional(),
  dimensions: z.array(z.string()).optional(),
  mode: AI_MODE_SCHEMA,
});

export const scorecardDimensionSchema = z.object({
  dimension: z.string(),
  score: z.number(),
  verdict: z.string().optional(),
  notes: z.string().optional(),
});

export const scorecardResponseSchema = z.object({
  niche: z.string(),
  overallScore: z.number(),
  grade: z.string(),
  dimensions: z.array(scorecardDimensionSchema),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export default { scorecardRequestSchema, scorecardResponseSchema, scorecardDimensionSchema };