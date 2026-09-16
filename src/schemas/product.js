// src/schemas/product.js - Product Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const productRequestSchema = z.object({
  niche: z.string().min(2, 'niche must be at least 2 characters'),
  productType: z.string().optional(),
  format: z.string().optional(),
  priceRange: z.string().optional(),
  mode: AI_MODE_SCHEMA,
});

export const productResponseSchema = z.object({
  niche: z.string(),
  productName: z.string(),
  pitch: z.string(),
  features: z.array(z.string()).default([]),
  pricing: z.object({
    suggested: z.union([z.string(), z.number()]).optional(),
    tiers: z.array(z.string()).optional(),
  }).partial(),
  launchPlan: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export default { productRequestSchema, productResponseSchema };