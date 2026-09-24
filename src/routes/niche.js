// src/routes/niche.js - Niche Route
// Purpose: Handle /api/niche endpoint for niche analysis.

import { executeAgent } from '../agents/index.js';
import { nicheRequestSchema } from '../schemas/niche.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import logger from '../utils/logger.js';

/**
 * Handle niche analysis request.
 * POST /api/niche
 */
export async function handleNiche(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = nicheRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Niche request received', { topic: params.topic });
    console.log('[routes/niche] request', { topic: params.topic, mode: params.mode });

    const result = await executeAgent('niche', params);

    return respond(res, result, { provider: result.provider || null, model: result.model || null, mergeData: true });
  } catch (error) {
    logger.error('Niche request failed', error);
    console.error('[routes/niche] error:', error.message);

    if (error instanceof ValidationError) {
      return respondError(res, error, { status: 400 });
    }

    return respondError(res, error, {
      message: 'Niche analysis failed',
    });
  }
}

export default { handleNiche };