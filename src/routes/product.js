// src/routes/product.js - Product Route
// Purpose: Handle /api/product endpoint for product concept generation.

import { executeAgent } from '../agents/index.js';
import { productRequestSchema } from '../schemas/product.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
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

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Product request failed', error);
    console.error('[routes/product] error:', error.message);

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Product generation failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

export default { handleProduct };