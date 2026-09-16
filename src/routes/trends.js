// src/routes/trends.js - Trends Route
// Purpose: Handle /api/trends endpoint for trend identification.

import { executeAgent } from '../agents/index.js';
import { trendsRequestSchema } from '../schemas/trends.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
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

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Trends request failed', error);
    console.error('[routes/trends] error:', error.message);

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Trends analysis failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

export default { handleTrends };