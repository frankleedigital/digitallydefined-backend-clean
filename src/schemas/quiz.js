// src/schemas/quiz.js - Quiz Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const quizRequestSchema = z.object({
  answers: z.record(z.string()).optional(),
  mode: AI_MODE_SCHEMA,
});

export const quizResponseSchema = z.object({
  superpowerName: z.string(),
  superpowerDescription: z.string(),
  persona: z.string(),
  personaDescription: z.string(),
  strengths: z.array(z.string()).default([]),
  blindspots: z.array(z.string()).default([]),
  businessModel: z.string(),
  recommendedPathways: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100).optional(),
  energyLevel: z.string().optional(),
  burnoutRisk: z.string().optional(),
  privacyNeeds: z.string().optional(),
  overwhelmLevel: z.string().optional(),
  readinessLevel: z.string().optional(),
  facelessComfort: z.string().optional(),
  profitabilityScore: z.number().min(0).max(100).optional(),
  competitionLevel: z.string().optional(),
  trendStrength: z.string().optional(),
  nicheViability: z.string().optional(),
  audienceInsight: z.string().optional(),
  opportunityGaps: z.array(z.string()).default([]),
  niche: z.string().optional(),
  superpowerNiche: z.string().optional(),
  personaNiche: z.string().optional(),
  roadmapSteps: z.array(z.string()).default([]),
  estimatedTime: z.string().optional(),
  tools: z.array(z.string()).default([]),
  aiTools: z.array(z.string()).default([]),
  nextAction: z.string().optional(),
});

export default { quizRequestSchema, quizResponseSchema };