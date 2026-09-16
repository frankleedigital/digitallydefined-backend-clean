// src/schemas/roadmap.js - Roadmap Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const PRIORITY_SCHEMA = z.enum(['speed', 'profit', 'authority', 'balance']).default('balance');

export const roadmapRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  targetAudience: z.string().optional(),
  goals: z.array(z.string()).optional(),
  timelineWeeks: z.number().int().positive().max(104).default(12),
  budget: z.number().nonnegative().optional(),
  priority: PRIORITY_SCHEMA,
  mode: AI_MODE_SCHEMA,
});

export const roadmapPhaseSchema = z.object({
  phase: z.number(),
  name: z.string(),
  durationWeeks: z.number(),
  objectives: z.array(z.string()).default([]),
  keyActions: z.array(z.string()).default([]),
  deliverables: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
});

export const roadmapResponseSchema = z.object({
  niche: z.string(),
  timeline: z.string(),
  phases: z.array(roadmapPhaseSchema),
  resourcesNeeded: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});

export default { roadmapRequestSchema, roadmapResponseSchema, roadmapPhaseSchema, PRIORITY_SCHEMA };