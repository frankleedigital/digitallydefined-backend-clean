// src/routes/scorecard.js - Scorecard Route
// Purpose: Handle /api/scorecard endpoint for business scoring.

import { executeAgent } from '../agents/index.js';
import { scorecardRequestSchema } from '../schemas/scorecard.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import logger from '../utils/logger.js';

/**
 * Handle scorecard request.
 * POST /api/scorecard
 */
export async function handleScorecard(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = scorecardRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Scorecard request received', { niche: params.niche });
    console.log('[routes/scorecard] request', { niche: params.niche, mode: params.mode });

    const result = await executeAgent('scorecard', params);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Scorecard request failed', error);
    console.error('[routes/scorecard] error:', error.message);

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Scorecard generation failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

export default { handleScorecard };