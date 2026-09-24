// src/routes/onboardingDispatch.js
// ============================================================================
// Onboarding actions: onboarding.start / onboarding.advance / onboarding.complete
// ============================================================================

import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import { getOrCreateOnboarding, advanceOnboarding } from '../services/onboarding.js';
import logger from '../utils/logger.js';

/**
 * POST /api/onboarding (also via dispatch action: onboarding.*)
 */
export async function handleOnboarding(req, res) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const body = req.body || {};
    const action = body.action || 'start';
    const { userId, email, superpower, mode, step } = body;

    if (action === 'start' || action === 'reset') {
      const result = await getOrCreateOnboarding({ userId, email, superpower, mode });
      if (!result.ok) return respondError(res, new Error(result.error));
      return respond(res, { state: result.data, created: result.created || false });
    }

    if (action === 'advance' || action === 'complete') {
      const result = await advanceOnboarding({ userId, email, step, action });
      if (!result.ok) return respondError(res, new Error(result.error));
      return respond(res, { state: result.data });
    }

    return respondError(res, new Error('Unknown onboarding action: ' + action), { status: 400 });
  } catch (err) {
    logger.error('Onboarding dispatch failed', { error: err.message });
    return respondError(res, err);
  }
}

export default { handleOnboarding };
