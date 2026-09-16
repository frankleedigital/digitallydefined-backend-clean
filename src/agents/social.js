// src/agents/social.js - Social Agent
// Purpose: Create faceless social media content for various platforms.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { socialRequestSchema } from '../schemas/social.js';
import logger from '../utils/logger.js';

/**
 * Generate social content for a niche + platform.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.platform='instagram'] - Target platform
 * @param {string} [params.tone] - Desired tone
 * @param {number} [params.count=5] - Number of posts
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Social content result
 */
export async function generateSocialContent(params) {
  const validated = socialRequestSchema.parse(params);
  const { niche, platform, tone, count, mode } = validated;

  const systemPrompt = 'You are a faceless social content strategist. Create scroll-stopping content that does not require the creator to appear on camera.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- platform: string\n' +
    '- posts: [{ hook, body, cta, hashtags[] }]\n' +
    '- recommendations: string[]';

  const userPrompt = 'Create ' + count + ' ' + platform + ' posts for the niche: ' + niche +
    (tone ? '\nTone: ' + tone : '\nTone: direct, practical, no hype') +
    '\n\nEvery post must be faceless (text, static, or screen-recording friendly).';

  const result = await aiRouter.generate(null, userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  let posts = parsed && Array.isArray(parsed.posts) ? parsed.posts : [];
  if (posts.length === 0) {
    logger.warn('Social response had no posts; using structured defaults');
    posts = [
      { hook: 'The quietest way to build digital income in ' + niche, body: 'Start with one asset instead of ten ideas.', cta: 'Save this for later.', hashtags: ['#' + niche.replace(/\s+/g, ''), '#facelessincome'] },
    ];
  }

  return {
    niche: niche,
    platform: platform,
    posts: posts.map((p) => ({
      hook: p.hook || '',
      body: p.body || p.content || '',
      cta: p.cta || '',
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    })),
    recommendations: parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Batch content weekly', 'Repurpose across platforms'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { generateSocialContent };