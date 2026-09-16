// src/schemas/social.js - Social Content Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube', 'x'];

export const socialRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  platform: z.enum(SOCIAL_PLATFORMS).default('instagram'),
  tone: z.string().optional(),
  count: z.number().int().positive().max(30).default(5),
  mode: AI_MODE_SCHEMA,
});

export const socialPostSchema = z.object({
  hook: z.string().optional(),
  body: z.string(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
});

export const socialResponseSchema = z.object({
  niche: z.string(),
  platform: z.string(),
  posts: z.array(socialPostSchema),
  recommendations: z.array(z.string()).default([]),
});

export default { socialRequestSchema, socialResponseSchema, socialPostSchema, SOCIAL_PLATFORMS };