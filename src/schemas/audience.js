// src/schemas/audience.js - Audience Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const audienceRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  currentAudience: z.string().optional(),
  mode: AI_MODE_SCHEMA,
});

export const audienceResponseSchema = z.object({
  niche: z.string(),
  primaryPersona: z.object({
    name: z.string(),
    demographics: z.string(),
    painPoints: z.array(z.string()).default([]),
    goals: z.array(z.string()).default([]),
    objections: z.array(z.string()).default([]),
  }).optional(),
  secondaryPersonas: z.array(z.object({
    name: z.string(),
    demographics: z.string(),
    painPoints: z.array(z.string()).default([]),
  })).default([]),
  messagingAngles: z.array(z.string()).default([]),
  contentPillars: z.array(z.string()).default([]),
});

export default { audienceRequestSchema, audienceResponseSchema };