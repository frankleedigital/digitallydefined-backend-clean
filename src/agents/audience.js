// src/agents/audience.js - Audience Agent
// Purpose: Generate audience insights and personas for a niche.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { audienceRequestSchema } from '../schemas/audience.js';
import logger from '../utils/logger.js';

/**
 * Generate audience insights for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.currentAudience] - Current audience description
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Audience result
 */
export async function analyzeAudience(params) {
  const validated = audienceRequestSchema.parse(params);
  const { niche, currentAudience, mode } = validated;

  const systemPrompt = 'You are an audience research specialist. Create detailed personas and messaging for a niche.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- primaryPersona: { name, demographics, painPoints[], goals[], objections[] }\n' +
    '- secondaryPersonas: [{ name, demographics, painPoints[] }]\n' +
    '- messagingAngles: string[]\n' +
    '- contentPillars: string[]';

  const userPrompt = 'Analyze the audience for the niche: ' + niche +
    (currentAudience ? '\nCurrent audience: ' + currentAudience : '') +
    '\n\nFocus on Gen X women building faceless digital businesses.';

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  if (!parsed) logger.warn('Audience response was not parseable JSON; using structured defaults');

  return {
    niche: niche,
    primaryPersona: parsed && parsed.primaryPersona ? parsed.primaryPersona : {
      name: 'The Reinventor',
      demographics: 'Gen X woman, 45-55, career experience, seeking freedom',
      painPoints: ['No time to figure it out alone', 'Tech overwhelm', 'Imposter syndrome'],
      goals: ['Replace income with digital assets', 'Work on own terms', 'Build legacy'],
      objections: ['Too technical', 'Too late to start', 'Won\'t work for me'],
    },
    secondaryPersonas: parsed && Array.isArray(parsed.secondaryPersonas) ? parsed.secondaryPersonas : [
      { name: 'The Side-Hustler', demographics: 'Full-time employee, 40-50', painPoints: ['Limited time', 'Energy after work'] },
      { name: 'The Retiree', demographics: '55-65, transitioning out of career', painPoints: ['Income gap', 'Identity shift'] },
    ],
    messagingAngles: parsed && Array.isArray(parsed.messagingAngles) ? parsed.messagingAngles : ['No camera required', 'Leverage existing expertise', 'Build once, sell forever'],
    contentPillars: parsed && Array.isArray(parsed.contentPillars) ? parsed.contentPillars : ['Mindset shifts', 'Technical tutorials', 'Success stories', 'Strategy frameworks'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { analyzeAudience };