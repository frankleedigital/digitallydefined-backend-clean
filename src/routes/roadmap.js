// src/routes/roadmap.js - Roadmap Route
// Purpose: Handle /api/roadmap endpoint for roadmap generation.

import { executeAgent } from '../agents/index.js';
import { roadmapRequestSchema } from '../schemas/roadmap.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import logger from '../utils/logger.js';

/**
 * Handle roadmap generation request.
 * POST /api/roadmap
 */
export async function handleRoadmap(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = roadmapRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Roadmap request received', { niche: params.niche });
    console.log('[routes/roadmap] request', { niche: params.niche, mode: params.mode });

    const result = await executeAgent('roadmap', params);

    return respond(res, result, { provider: result.provider || null, model: result.model || null, mergeData: true });
  } catch (error) {
    logger.error('Roadmap request failed', error);
    console.error('[routes/roadmap] error:', error.message);

    if (error instanceof ValidationError) {
      return respondError(res, error, { status: 400 });
    }

    return respondError(res, error, {
      message: 'Roadmap generation failed',
    });
  }
}

export default { handleRoadmap };