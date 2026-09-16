// src/agents/index.js - Agent Registry
// Purpose: Central registry of all AI agents.

import { analyzeNiche } from './niche.js';
import { generateRoadmap } from './roadmap.js';
import { generateScorecard } from './scorecard.js';
import { generateProduct } from './product.js';
import { generateSocialContent } from './social.js';
import { identifyTrends } from './trends.js';
import logger from '../utils/logger.js';

/**
 * Agent registry for clean access to all agents.
 */
export const agentRegistry = {
  niche: {
    name: 'Niche Agent',
    description: 'Analyze niche markets, demand, competition, and monetization',
    handler: analyzeNiche,
    inputSchema: 'nicheRequestSchema',
  },
  roadmap: {
    name: 'Roadmap Agent',
    description: 'Generate strategic roadmaps with phases and milestones',
    handler: generateRoadmap,
    inputSchema: 'roadmapRequestSchema',
  },
  scorecard: {
    name: 'Scorecard Agent',
    description: 'Evaluate business performance across multiple dimensions',
    handler: generateScorecard,
    inputSchema: 'scorecardRequestSchema',
  },
  product: {
    name: 'Product Agent',
    description: 'Generate product concepts, features, and launch strategies',
    handler: generateProduct,
    inputSchema: 'productRequestSchema',
  },
  social: {
    name: 'Social Agent',
    description: 'Create social media content for various platforms',
    handler: generateSocialContent,
    inputSchema: 'socialRequestSchema',
  },
  trends: {
    name: 'Trends Agent',
    description: 'Identify trending topics and emerging opportunities',
    handler: identifyTrends,
    inputSchema: 'trendsRequestSchema',
  },
};

/**
 * Get agent by name.
 * @param {string} name - Agent name (niche, roadmap, scorecard, product, social, trends)
 * @returns {object|null} Agent config or null if not found
 */
export function getAgent(name) {
  return agentRegistry[name] || null;
}

/**
 * List all available agents.
 * @returns {object[]} Array of agent configs
 */
export function listAgents() {
  return Object.entries(agentRegistry).map(([name, config]) => ({
    name,
    ...config,
  }));
}

/**
 * Execute an agent by name with params.
 * @param {string} name - Agent name
 * @param {object} params - Agent parameters
 * @returns {Promise<object>} Agent result
 */
export async function executeAgent(name, params) {
  const agent = getAgent(name);
  if (!agent) {
    throw new Error('Unknown agent: ' + name + '. Available: ' + Object.keys(agentRegistry).join(', '));
  }

  logger.info('Executing agent', { agent: name, params: Object.keys(params) });

  try {
    const result = await agent.handler(params);
    logger.info('Agent execution completed', { agent: name, success: true });
    return result;
  } catch (error) {
    logger.error('Agent execution failed', { agent: name, error: error.message });
    throw error;
  }
}

export default {
  agentRegistry,
  getAgent,
  listAgents,
  executeAgent,
};