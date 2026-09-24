// src/schemas/onboarding.js
// ============================================================================
// Onboarding state schemas
// ============================================================================

import { z } from 'zod';

export const onboardingStepSchema = z.object({
  step: z.number().int().positive(),
  name: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  data: z.record(z.any()).optional(),
});

export const onboardingStateSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  superpower: z.string().optional(),
  mode: z.string().optional(),
  currentStep: z.number().int().nonnegative(),
  steps: z.array(onboardingStepSchema),
  completed: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const onboardingRequestSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  superpower: z.string().optional(),
  mode: z.string().optional(),
  step: z.number().int().nonnegative().optional(),
  action: z.enum(['start', 'advance', 'complete', 'reset']).optional(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
