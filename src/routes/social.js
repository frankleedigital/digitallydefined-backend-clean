// src/routes/social.js - Social Route
// Purpose: Handle /api/social endpoint for social content generation.

import { executeAgent } from '../agents/index.js';
import { socialRequestSchema } from '../schemas/social.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import logger from '../utils/logger.js';

/**
 * Handle social content request.
 * POST /api/social
 */
export async function handleSocial(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = socialRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Social request received', { niche: params.niche, platform: params.platform });
    console.log('[routes/social] request', { niche: params.niche, platform: params.platform, mode: params.mode });

    const result = await executeAgent('social', params);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Social request failed', error);
    console.error('[routes/social] error:', error.message);

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Social content generation failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

export default { handleSocial };