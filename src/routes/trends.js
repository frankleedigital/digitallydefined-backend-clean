// src/routes/trends.js - Trends Route
// Purpose: Handle /api/trends endpoint for trend identification.

import { executeAgent } from '../agents/index.js';
import { trendsRequestSchema } from '../schemas/trends.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import logger from '../utils/logger.js';

/**
 * Handle trends request.
 * POST /api/trends
 */
export async function handleTrends(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = trendsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Trends request received', { niche: params.niche, timeframe: params.timeframe });
    console.log('[routes/trends] request', { niche: params.niche, timeframe: params.timeframe, mode: params.mode });

    const result = await executeAgent('trends', params);

    return respond(res, result, { provider: result.provider || null, model: result.model || null, mergeData: true });
  } catch (error) {
    logger.error('Trends request failed', error);
    console.error('[routes/trends] error:', error.message);

    if (error instanceof ValidationError) {
      return respondError(res, error, { status: 400 });
    }

    return respondError(res, error, {
      message: 'Trends analysis failed',
    });
  }
}

export default { handleTrends };