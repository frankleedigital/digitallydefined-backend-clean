// src/agents/roadmap.js - Roadmap Agent
// Purpose: Generate strategic roadmap with phases, objectives, and milestones.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { roadmapRequestSchema } from '../schemas/roadmap.js';
import logger from '../utils/logger.js';

/**
 * Generate strategic roadmap for a niche.
 * @param {object} params - Request parameters
 * @param {string} params.niche - Niche/topic
 * @param {string} [params.targetAudience] - Target audience description
 * @param {string[]} [params.goals] - Business goals
 * @param {number} [params.timelineWeeks=12] - Timeline in weeks
 * @param {number} [params.budget] - Budget in USD
 * @param {'speed'|'profit'|'authority'|'balance'} [params.priority='balance'] - Priority focus
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Roadmap result
 */
export async function generateRoadmap(params) {
  const validated = roadmapRequestSchema.parse(params);
  const { niche, targetAudience, goals, timelineWeeks, budget, priority, mode } = validated;

  const priorityLabel = priority === 'speed' ? 'fast execution'
    : priority === 'profit' ? 'revenue focus'
    : priority === 'authority' ? 'brand building'
    : 'balanced approach';

  const systemPrompt = 'You are a strategic business planning expert. Create actionable roadmaps for niche businesses.\n\n' +
    'Priority focus: ' + priority + '\n' +
    'Timeline: ' + timelineWeeks + ' weeks' +
    (budget ? '\nBudget: $' + budget : '') +
    (targetAudience ? '\nTarget Audience: ' + targetAudience : '') +
    (goals && goals.length ? '\nGoals: ' + goals.join(', ') : '');

  const userPrompt = 'Create a detailed ' + timelineWeeks + '-week roadmap for building a business in: ' + niche + '\n\n' +
    'Focus priority: ' + priority + ' (' + priorityLabel + ')\n\n' +
    'Structure your response as a phased approach with clear milestones, deliverables, and success metrics.';

  const result = await aiRouter.generate(null, userPrompt, {
    mode: mode,
    systemPrompt: systemPrompt,
    jsonMode: true,
  });

  if (result.error) {
    throw result.error;
  }

  const parsed = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));

  const phases = [];
  if (parsed && parsed.phases && Array.isArray(parsed.phases)) {
    parsed.phases.forEach((phase, idx) => {
      phases.push({
        phase: idx + 1,
        name: phase.name || 'Phase ' + (idx + 1),
        durationWeeks: phase.durationWeeks || Math.ceil(timelineWeeks / parsed.phases.length),
        objectives: phase.objectives || [],
        keyActions: phase.keyActions || [],
        deliverables: phase.deliverables || [],
        successMetrics: phase.successMetrics || [],
      });
    });
  }

  if (phases.length === 0) {
    logger.warn('Roadmap response had no phases; using structured default');
  }

  return {
    niche: niche,
    timeline: timelineWeeks + ' weeks (' + (phases.length || 1) + ' phases)',
    phases: phases.length > 0 ? phases : [{
      phase: 1,
      name: 'Foundation',
      durationWeeks: timelineWeeks,
      objectives: ['Validate niche', 'Build MVP', 'Get first users'],
      keyActions: ['Market research', 'Competitor analysis', 'Product development', 'Launch strategy'],
      deliverables: ['Niche analysis', 'Product prototype', 'Launch plan'],
      successMetrics: ['First 100 users', 'Revenue target', 'Engagement metrics'],
    }],
    resourcesNeeded: parsed && Array.isArray(parsed.resourcesNeeded) ? parsed.resourcesNeeded : ['Market research tools', 'Content creation', 'Distribution channels'],
    risks: parsed && Array.isArray(parsed.risks) ? parsed.risks : [],
    nextSteps: parsed && Array.isArray(parsed.nextSteps) ? parsed.nextSteps : ['Execute Phase 1', 'Track metrics', 'Iterate based on feedback'],
    mode: mode,
    provider: result.provider || 'unknown',
    model: result.model || 'unknown',
    timestamp: Date.now(),
  };
}

export default { generateRoadmap };