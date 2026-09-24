// src/agents/opportunities.js - Opportunities Agent
// Purpose: Identify market gaps and product opportunities.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { opportunitiesRequestSchema } from '../schemas/opportunities.js';
import logger from '../utils/logger.js';

/**
 * Identify opportunities for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.audience] - Target audience
 * @param {'low'|'medium'|'high'} [params.budget] - Budget tier
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Opportunities result
 */
export async function identifyOpportunities(params) {
  const validated = opportunitiesRequestSchema.parse(params);
  const { niche, audience, budget, mode } = validated;

  const systemPrompt = 'You are a market opportunity analyst. Find gaps and opportunities for a niche.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- opportunityGaps: string[]\n' +
    '- quickWins: string[]\n' +
    '- longTermBets: string[]\n' +
    '- recommendedProducts: [{ name, format, priceRange, effort }]\n' +
    '- marketSize: string\n' +
    '- confidenceScore: number (0-100)';

  const userPrompt = 'Identify opportunities for the niche: ' + niche +
    (audience ? '\nTarget audience: ' + audience : '') +
    (budget ? '\nBudget tier: ' + budget : '') +
    '\n\nFocus on faceless digital products that can be built by a solo founder.';

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  if (!parsed) logger.warn('Opportunities response was not parseable JSON; using structured defaults');

  return {
    niche: niche,
    opportunityGaps: parsed && Array.isArray(parsed.opportunityGaps) ? parsed.opportunityGaps : ['No faceless implementation guides', 'No done-with-you programs', 'Missing community component'],
    quickWins: parsed && Array.isArray(parsed.quickWins) ? parsed.quickWins : ['Create a 7-day email course', 'Build a Notion template', 'Launch a micro-workshop'],
    longTermBets: parsed && Array.isArray(parsed.longTermBets) ? parsed.longTermBets : ['Build a certification program', 'Create a SaaS tool', 'Launch a membership community'],
    recommendedProducts: parsed && Array.isArray(parsed.recommendedProducts) ? parsed.recommendedProducts : [
      { name: niche + ' Starter Kit', format: 'Digital download', priceRange: '$47-97', effort: 'Low' },
      { name: niche + ' Implementation Program', format: 'Course + community', priceRange: '$497-997', effort: 'High' },
    ],
    marketSize: parsed && parsed.marketSize ? parsed.marketSize : '$50M+ TAM',
    confidenceScore: parsed && typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 75,
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { identifyOpportunities };