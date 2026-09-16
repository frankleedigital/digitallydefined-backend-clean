// src/schemas/chat.js - Chat Validation Schemas
import { z } from 'zod';
import { AI_MODE_SCHEMA } from './niche.js';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  history: z.array(chatMessageSchema).optional(),
  systemPrompt: z.string().optional(),
  mode: AI_MODE_SCHEMA,
});

export const chatResponseSchema = z.object({
  reply: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  mode: z.string().optional(),
  timestamp: z.number().optional(),
});

export default { chatRequestSchema, chatResponseSchema, chatMessageSchema };