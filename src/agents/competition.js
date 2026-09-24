// src/agents/competition.js - Competition Agent
// Purpose: Analyze competitive landscape for a niche.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { competitionRequestSchema } from '../schemas/competition.js';
import logger from '../utils/logger.js';

/**
 * Analyze competition for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string[]} [params.topCompetitors] - Known competitors
 * @param {'overview'|'detailed'} [params.depth='overview'] - Analysis depth
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Competition result
 */
export async function analyzeCompetition(params) {
  const validated = competitionRequestSchema.parse(params);
  const { niche, topCompetitors, depth, mode } = validated;

  const systemPrompt = 'You are a competitive intelligence analyst. Analyze the competitive landscape for a niche.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- topCompetitors: [{ name, strength, weakness, differentiator }]\n' +
    '- marketGap: string\n' +
    '- recommendedPositioning: string\n' +
    '- threatLevel: "low" | "medium" | "high"\n' +
    '- actions: string[]';

  const userPrompt = 'Analyze competition for the niche: ' + niche +
    (topCompetitors && topCompetitors.length ? '\nKnown competitors: ' + topCompetitors.join(', ') : '') +
    '\nDepth: ' + depth +
    '\n\nFocus on faceless digital product opportunities and gaps in the market.';

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  if (!parsed) logger.warn('Competition response was not parseable JSON; using structured defaults');

  return {
    niche: niche,
    topCompetitors: parsed && Array.isArray(parsed.topCompetitors) ? parsed.topCompetitors : [
      { name: 'Market Leader', strength: 'Brand authority', weakness: 'High prices', differentiator: 'Enterprise focus' },
      { name: 'Budget Option', strength: 'Low price', weakness: 'Limited support', differentiator: 'Volume model' },
    ],
    marketGap: parsed && parsed.marketGap ? parsed.marketGap : 'Mid-tier faceless digital products with high-touch onboarding',
    recommendedPositioning: parsed && parsed.recommendedPositioning ? parsed.recommendedPositioning : 'Premium done-with-you implementation',
    threatLevel: parsed && parsed.threatLevel ? parsed.threatLevel : 'medium',
    actions: parsed && Array.isArray(parsed.actions) ? parsed.actions : ['Map competitor pricing', 'Identify underserved segment', 'Build differentiated offer'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { analyzeCompetition };