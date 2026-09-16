// src/agents/scorecard.js - Scorecard Agent
// Purpose: Evaluate business performance across multiple dimensions.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { scorecardRequestSchema } from '../schemas/scorecard.js';
import logger from '../utils/logger.js';

const DEFAULT_DIMENSIONS = ['Demand', 'Competition', 'Monetization', 'Effort', 'Risk', 'Time-to-Revenue'];

/**
 * Generate a business scorecard for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.businessName] - Business name
 * @param {object} [params.metrics] - Known metrics
 * @param {string[]} [params.dimensions] - Dimensions to score
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Scorecard result
 */
export async function generateScorecard(params) {
  const validated = scorecardRequestSchema.parse(params);
  const { niche, businessName, metrics, dimensions, mode } = validated;
  const dims = dimensions && dimensions.length ? dimensions : DEFAULT_DIMENSIONS;

  const systemPrompt = 'You are a business evaluation expert. Score opportunities objectively.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- overallScore: 0-100 number\n' +
    '- grade: A-F string\n' +
    '- dimensions: [{ dimension, score (0-100), verdict, notes }]\n' +
    '- strengths: string[]\n' +
    '- weaknesses: string[]\n' +
    '- recommendations: string[]';

  const userPrompt = 'Score this business opportunity: ' + niche +
    (businessName ? '\nBusiness: ' + businessName : '') +
    (metrics ? '\nKnown metrics: ' + JSON.stringify(metrics) : '') +
    '\nDimensions to score: ' + dims.join(', ');

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  let scored = parsed && Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
  if (scored.length === 0) {
    logger.warn('Scorecard response had no dimensions; using structured default');
    scored = dims.map((d) => ({ dimension: d, score: 50, verdict: 'Unrated', notes: '' }));
  }

  const computedOverall = Math.round(scored.reduce((sum, d) => sum + (typeof d.score === 'number' ? d.score : 0), 0) / scored.length);
  const overallScore = parsed && typeof parsed.overallScore === 'number' ? parsed.overallScore : computedOverall;
  const grade = parsed && parsed.grade ? parsed.grade
    : overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  return {
    niche: niche,
    overallScore: overallScore,
    grade: grade,
    dimensions: scored,
    strengths: parsed && Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: parsed && Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    recommendations: parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Gather more data before committing capital'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { generateScorecard };