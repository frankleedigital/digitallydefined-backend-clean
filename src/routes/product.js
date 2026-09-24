// src/routes/product.js - Product Route
// Purpose: Handle /api/product endpoint for product concept generation.

import { executeAgent } from '../agents/index.js';
import { productRequestSchema } from '../schemas/product.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import logger from '../utils/logger.js';

/**
 * Handle product generation request.
 * POST /api/product
 */
export async function handleProduct(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = productRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Product request received', { niche: params.niche });
    console.log('[routes/product] request', { niche: params.niche, mode: params.mode });

    const result = await executeAgent('product', params);

    return respond(res, result, { provider: result.provider || null, model: result.model || null, mergeData: true });
  } catch (error) {
    logger.error('Product request failed', error);
    console.error('[routes/product] error:', error.message);

    if (error instanceof ValidationError) {
      return respondError(res, error, { status: 400 });
    }

    return respondError(res, error, {
      message: 'Product generation failed',
    });
  }
}

export default { handleProduct };