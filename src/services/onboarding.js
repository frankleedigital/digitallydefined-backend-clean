// src/services/onboarding.js
// ============================================================================
// Onboarding state management — persisted in Supabase.
// ============================================================================

import { isSupabaseRestConfigured, upsert, select } from './supabaseRest.js';
import logger from '../utils/logger.js';

const ONBOARDING_TABLE = 'onboarding_states';

const DEFAULT_STEPS = [
  { step: 1, name: 'review_roadmap', status: 'pending' },
  { step: 2, name: 'activate_first_tool', status: 'pending' },
  { step: 3, name: 'join_dashboard', status: 'pending' },
  { step: 4, name: 'build_first_asset', status: 'pending' },
];

function now() {
  return new Date().toISOString();
}

function createInitialState({ userId, email, superpower, mode }) {
  const id = userId || email || 'anonymous-' + Date.now();
  return {
    user_id: id,
    email: email || '',
    superpower: superpower || '',
    mode: mode || 'freeMode',
    current_step: 1,
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    completed: false,
    created_at: now(),
    updated_at: now(),
  };
}

export async function getOrCreateOnboarding({ userId, email, superpower, mode }) {
  if (!isSupabaseRestConfigured()) {
    return { ok: false, error: 'Supabase REST not configured' };
  }
  const id = userId || email || 'anonymous';
  try {
    const rows = await select(ONBOARDING_TABLE, `user_id=eq.${encodeURIComponent(id)}&order=updated_at.desc&limit=1`);
    if (rows.length > 0) {
      return { ok: true, data: rows[0] };
    }
    const initial = createInitialState({ userId, email, superpower, mode });
    const row = await upsert(ONBOARDING_TABLE, initial, 'user_id');
    return { ok: true, data: row, created: true };
  } catch (err) {
    logger.error('Onboarding getOrCreate failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

export async function advanceOnboarding({ userId, email, step, action }) {
  if (!isSupabaseRestConfigured()) {
    return { ok: false, error: 'Supabase REST not configured' };
  }
  const id = userId || email || 'anonymous';
  try {
    const rows = await select(ONBOARDING_TABLE, `user_id=eq.${encodeURIComponent(id)}&limit=1`);
    const existing = rows[0];
    if (!existing) {
      return { ok: false, error: 'Onboarding not started' };
    }
    const steps = existing.steps || DEFAULT_STEPS;
    const currentStep = existing.current_step || 1;
    let nextStep = currentStep;
    let completed = existing.completed || false;

    if (action === 'start' || action === 'reset') {
      nextStep = 1;
      completed = false;
      for (const s of steps) s.status = 'pending';
    } else if (action === 'complete') {
      const target = step || currentStep;
      const stepObj = steps.find((s) => s.step === target);
      if (stepObj) {
        stepObj.status = 'completed';
        stepObj.completedAt = now();
      }
      nextStep = target >= steps.length ? steps.length : target + 1;
      completed = steps.every((s) => s.status === 'completed');
    } else {
      // advance default
      const stepObj = steps.find((s) => s.step === currentStep);
      if (stepObj) {
        stepObj.status = 'completed';
        stepObj.completedAt = now();
      }
      nextStep = currentStep >= steps.length ? steps.length : currentStep + 1;
      completed = steps.every((s) => s.status === 'completed');
    }

    const updated = {
      ...existing,
      current_step: nextStep,
      steps,
      completed,
      updated_at: now(),
    };
    const row = await upsert(ONBOARDING_TABLE, updated, 'user_id');
    return { ok: true, data: row };
  } catch (err) {
    logger.error('Onboarding advance failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

export function isOnboardingConfigured() {
  return isSupabaseRestConfigured();
}

export default { getOrCreateOnboarding, advanceOnboarding, isOnboardingConfigured };
