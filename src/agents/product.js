// src/agents/product.js - Product Agent
// Purpose: Generate product concepts, features, and launch strategies.

import { callAI, parseJsonReply } from '../services/ai.js';
import { productRequestSchema } from '../schemas/product.js';
import logger from '../utils/logger.js';

/**
 * Generate a product concept for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.productType] - Type of product
 * @param {string} [params.format] - Delivery format
 * @param {string} [params.priceRange] - Target price range
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Product concept result
 */
export async function generateProduct(params) {
  const validated = productRequestSchema.parse(params);
  const { niche, productType, format, priceRange, mode } = validated;

  const systemPrompt = 'You are a digital product strategist. Design products that are fast to build and easy to sell.\n\n' +
    'Return a structured JSON response with:\n' +
    '- niche: string\n' +
    '- productName: string\n' +
    '- pitch: 2-3 sentence positioning statement\n' +
    '- features: string[] (5-8 concrete features)\n' +
    '- pricing: { suggested, tiers[] }\n' +
    '- launchPlan: string[] (4-6 steps)\n' +
    '- recommendations: string[]';

  const userPrompt = 'Design a product for the niche: ' + niche +
    (productType ? '\nProduct type: ' + productType : '') +
    (format ? '\nFormat: ' + format : '') +
    (priceRange ? '\nPrice range: ' + priceRange : '') +
    '\n\nFocus on faceless, automatable delivery with no on-camera requirement.';

  const result = await callAI(userPrompt, { mode: mode, systemPrompt: systemPrompt, jsonMode: true });
  if (result.error) throw result.error;

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  if (!parsed) logger.warn('Product response was not parseable JSON; using structured default');

  return {
    niche: niche,
    productName: parsed && parsed.productName ? parsed.productName : niche + ' Starter Kit',
    pitch: parsed && parsed.pitch ? parsed.pitch : 'A focused digital product that solves one painful problem for ' + niche + '.',
    features: parsed && Array.isArray(parsed.features) ? parsed.features : ['Templates', 'Step-by-step guide', 'Automation setup', 'Checklist'],
    pricing: parsed && parsed.pricing ? parsed.pricing : { suggested: priceRange || '$27-$97', tiers: ['Basic', 'Pro', 'Bundle'] },
    launchPlan: parsed && Array.isArray(parsed.launchPlan) ? parsed.launchPlan : ['Validate with 10 people', 'Build MVP', 'Set up Gumroad', 'Write sales page', 'Launch to email list'],
    recommendations: parsed && Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Start with a single micro-offer'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { generateProduct };