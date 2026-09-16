// src/agents/trends.js - Trends Agent
// Purpose: Identify trending topics and emerging opportunities.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { trendsRequestSchema } from '../schemas/trends.js';
import logger from '../utils/logger.js';

/**
 * Identify trends for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {'7d'|'30d'|'90d'|'12m'} [params.timeframe='30d'] - Lookback window
 * @param {string[]} [params.platforms] - Platforms to consider
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Trends result
 */
export async function identifyTrends(params) {
  const validated = trendsRequestSchema.parse(params);
  const { niche, timeframe, platforms, mode } = validated;

  const systemPrompt = 'You are a market trends analyst. Identify rising topics and momentum for a niche.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- timeframe: string\n' +
    '- risingTopics: string[]\n' +
    '- platformTrends: string[]\n' +
    '- momentum: { last30Days, last90Days, prediction }\n' +
    '- recommendedActions: string[]';

  const userPrompt = 'Identify trends for the niche: ' + niche + ' over the last ' + timeframe +
    (platforms && platforms.length ? '\nPlatforms: ' + platforms.join(', ') : '') +
    '\n\nFocus on faceless digital product opportunities.';

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  if (!parsed) logger.warn('Trends response was not parseable JSON; using structured defaults');

  return {
    niche: niche,
    timeframe: timeframe,
    risingTopics: parsed && Array.isArray(parsed.risingTopics) ? parsed.risingTopics : [niche + ' beginner frameworks', niche + ' automation workflows'],
    platformTrends: parsed && Array.isArray(parsed.platformTrends) ? parsed.platformTrends : ['Short-form video growth', 'Newsletter revival', 'AI-assisted content creation'],
    momentum: parsed && parsed.momentum ? parsed.momentum : { last30Days: 'Moderate growth', last90Days: 'Strong upward trend', prediction: 'High opportunity' },
    recommendedActions: parsed && Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : ['Create 3 pillar content pieces', 'Publish weekly', 'Build a simple lead magnet'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { identifyTrends };