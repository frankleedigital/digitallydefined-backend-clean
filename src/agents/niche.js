// src/agents/niche.js - Niche Agent
// Purpose: Generate niche analysis with demand, competition, and monetization assessment.

import { parseJsonReply, validateAgainstSchema } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { nicheRequestSchema } from '../schemas/niche.js';
import logger from '../utils/logger.js';

/**
 * Generate niche analysis.
 * @param {object} params - Request parameters
 * @param {string} params.topic - Niche/topic to analyze
 * @param {string} [params.context] - Additional context
 * @param {boolean} [params.analyzeCompetitors=true] - Analyze competitors
 * @param {boolean} [params.analyzeDemand=true] - Analyze demand
 * @param {boolean} [params.analyzeMonetization=true] - Analyze monetization
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Niche analysis result
 */
export async function analyzeNiche(params) {
  const validated = nicheRequestSchema.parse(params);
  const { topic, context, analyzeCompetitors, analyzeDemand, analyzeMonetization, mode } = validated;

  const systemPrompt = 'You are a niche market analysis expert. Provide actionable insights about the given topic.\n\n' +
    'Requirements:\n' +
    '- Analyze ' + (analyzeDemand ? 'demand and audience interest' : 'skip demand analysis') + '\n' +
    '- Analyze ' + (analyzeCompetitors ? 'competitor landscape' : 'skip competitor analysis') + '\n' +
    '- Analyze ' + (analyzeMonetization ? 'monetization potential' : 'skip monetization analysis') + '\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: The niche/topic name\n' +
    '- summary: 2-3 sentence overview\n' +
    '- demandScore: 0-100 score\n' +
    '- competitionScore: 0-100 score\n' +
    '- monetizationPotential: 0-100 score\n' +
    '- audienceProfile: { demographics, interests[], painPoints[], keywords[] }\n' +
    '- competitors: [{ name, strength (0-100), weakness }] (if analyzeCompetitors)\n' +
    '- recommendations: actionable next steps array';

  const userPrompt = 'Analyze this niche/topic: ' + topic +
    (context ? '\n\nAdditional context: ' + context : '') +
    '\n\nAnalyze: ' + (analyzeCompetitors ? 'Competitors' : 'N/A') + ' | ' + (analyzeDemand ? 'Demand' : 'N/A') + ' | ' + (analyzeMonetization ? 'Monetization' : 'N/A');

  const result = await aiRouter.generate(null, userPrompt, {
    mode: mode,
    systemPrompt: systemPrompt,
    jsonMode: true,
  });

  if (result.error) {
    throw result.error;
  }

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  const schemaErrors = validateAgainstSchema({
    niche: 'string',
    summary: 'string',
    demandScore: 'number',
    competitionScore: 'number',
    monetizationPotential: 'number',
    audienceProfile: 'object',
    recommendations: 'array',
  }, parsed || {});

  if (schemaErrors.length > 0) {
    logger.warn('Niche response validation issues', { errors: schemaErrors });
  }

  return {
    niche: parsed ? parsed.niche : topic,
    summary: parsed ? parsed.summary : 'Analysis completed',
    demandScore: parsed && typeof parsed.demandScore === 'number' ? parsed.demandScore : 50,
    competitionScore: parsed && typeof parsed.competitionScore === 'number' ? parsed.competitionScore : 50,
    monetizationPotential: parsed && typeof parsed.monetizationPotential === 'number' ? parsed.monetizationPotential : 50,
    audienceProfile: parsed && parsed.audienceProfile ? parsed.audienceProfile : { demographics: 'Unknown', interests: [], painPoints: [], keywords: [] },
    competitors: parsed && Array.isArray(parsed.competitors) ? parsed.competitors : [],
    recommendations: parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Conduct deeper market research'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { analyzeNiche };