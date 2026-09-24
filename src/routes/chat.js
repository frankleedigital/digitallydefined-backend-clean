// src/routes/chat.js - Chat Route
// Purpose: Handle /api/chat endpoint for conversational AI (Hermes).

import { chatRequestSchema } from '../schemas/chat.js';
import { aiRouter } from '../services/aiRouter.js';
import { ValidationError } from '../utils/errorHandler.js';
import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';
import * as websiteEditor from '../services/websiteEditor.js';

function extractEditBlocks(text) {
  const blocks = [];
  const regex = /\[EDIT FILE:\s*([^\]]+)\s*\]\s*\n([\s\S]*?)\[\/EDIT\]/g;
  let m;
  while ((m = regex.exec(text)) !== null) blocks.push({ file: m[1].trim(), newContent: m[2] });
  return blocks;
}

function stripEditBlocks(text) {
  return text.replace(/\[EDIT FILE:[\s\S]*?\[\/EDIT\]/g, '').trim();
}

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

    let websiteContext = '';
    if (params.includeWebsiteContext) {
      try {
        const files = websiteEditor.scanWebsite();
        websiteContext = '\n\nAvailable website source files (you may edit these):\n' + files.join('\n');
      } catch (err) {
        logger.warn('Website scan failed', { error: err.message });
      }
    }

    const systemPrompt = (params.systemPrompt || constants.DEFAULT_CHAT_SYSTEM_PROMPT) + websiteContext;

    const result = await aiRouter.generate(null, prompt, { mode: params.mode, systemPrompt, jsonMode: false });
    if (result.error) throw result.error;

    let reply = typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply);
    let appliedEdit = null;
    const editBlocks = extractEditBlocks(reply);
    if (editBlocks.length > 0) {
      const edits = [];
      for (const block of editBlocks) {
        try {
          const editResult = websiteEditor.writeFile(block.file, block.newContent);
          edits.push({ ok: true, file: editResult.file, committed: editResult.committed, pushed: editResult.pushed, commitHash: editResult.commitHash });
          reply = reply.replace('[EDIT FILE: ' + block.file + ']\n' + block.newContent + '[/EDIT]', '(Edited ' + block.file + (editResult.committed ? ' — committed and pushed' : ' — saved locally') + ')');
        } catch (err) {
          edits.push({ ok: false, file: block.file, error: err.message });
          reply = reply.replace('[EDIT FILE: ' + block.file + '][\\s\\S]*?[\\/EDIT]', '(Edit failed for ' + block.file + ': ' + err.message + ')');
        }
      }
      appliedEdit = edits.length === 1 ? edits[0] : edits;
      reply = stripEditBlocks(reply);
    }

    return respond(res, {
      reply: reply.trim(),
      provider: result.provider || 'unknown',
      model: result.model || 'unknown',
      mode: params.mode,
      appliedEdit,
      timestamp: Date.now(),
    }, { provider: result.provider || 'unknown', model: result.model || 'unknown', mergeData: true });
  } catch (error) {
    logger.error('Chat request failed', error);
    console.error('[routes/chat] error:', error.message);

    if (error instanceof ValidationError) {
      return respondError(res, error, { status: 400 });
    }

    return respondError(res, error, {
      message: 'Chat request failed',
    });
  }
}

export default { handleChat };