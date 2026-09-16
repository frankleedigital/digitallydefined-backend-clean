// src/schemas/dashboard.js - Dashboard Validation Schemas
import { z } from 'zod';

export const dashboardContextSchema = z.object({
  includeNotion: z.boolean().default(false),
  includeAiBrief: z.boolean().default(true),
  timeframe: z.string().default('30d'),
}).partial();

export const dashboardRequestSchema = z.object({
  context: dashboardContextSchema.optional(),
}).passthrough();

export const dashboardResponseSchema = z.object({
  status: z.string(),
  community: z.array(z.unknown()).default([]),
  assets: z.array(z.unknown()).default([]),
  email: z.record(z.unknown()).optional(),
  topPosts: z.array(z.unknown()).default([]),
  campaigns: z.array(z.unknown()).default([]),
  notion: z.record(z.unknown()).optional(),
  revenue: z.union([z.string(), z.number()]).optional(),
  leads: z.union([z.string(), z.number()]).optional(),
  siteHealth: z.string().optional(),
  sentiment: z.string().optional(),
  aiBrief: z.string().optional(),
  alerts: z.array(z.record(z.unknown())).default([]),
  sourceHealth: z.record(z.string()).optional(),
  timestamp: z.number(),
}).passthrough();

export default { dashboardRequestSchema, dashboardResponseSchema, dashboardContextSchema };