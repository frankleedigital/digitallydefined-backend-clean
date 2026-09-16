// src/routes/chat.js - Chat Route
// Purpose: Handle /api/chat endpoint for conversational AI (Hermes).

import { chatRequestSchema } from '../schemas/chat.js';
import { aiRouter } from '../services/aiRouter.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Handle chat request.
 * POST /api/chat
 */
export async function handleChat(req, res) {
  try {
    if (!checkDashboardApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || req.query || {};

    const validationResult = chatRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError('Invalid request: ' + errors);
    }

    const params = validationResult.data;
    logger.info('Chat request received', { length: params.message.length, mode: params.mode });
    console.log('[routes/chat] request', { mode: params.mode });

    // Fold prior turns into the prompt so the AI has conversational context.
    let prompt = params.message;
    if (params.history && params.history.length > 0) {
      const transcript = params.history
        .map((m) => m.role.toUpperCase() + ': ' + m.content)
        .join('\n');
      prompt = 'Conversation so far:\n' + transcript + '\n\nUSER: ' + params.message;
    }

    const result = await aiRouter.generate(null, prompt, {
      mode: params.mode,
      systemPrompt: params.systemPrompt || constants.DEFAULT_CHAT_SYSTEM_PROMPT,
      jsonMode: false,
    });

    if (result.error) {
      throw result.error;
    }

    return res.status(200).json({
      reply: typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply),
      provider: result.provider || 'unknown',
      model: result.model || 'unknown',
      mode: params.mode,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Chat request failed', error);
    console.error('[routes/chat] error:', error.message);

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Chat request failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}

export default { handleChat };