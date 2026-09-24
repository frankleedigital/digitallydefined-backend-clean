// src/agents/quiz.js - Quiz Agent
// Purpose: Process quiz answers and generate superpower profile.
// Note: Quiz submission is primarily handled by Supabase Edge Functions (/functions/v1/quiz-submit).
// This agent provides a fallback/alternative for the intelligence pipeline.

import { parseJsonReply } from '../services/ai.js';
import { aiRouter } from '../services/aiRouter.js';
import { quizRequestSchema } from '../schemas/quiz.js';
import logger from '../utils/logger.js';

const SUPERPOWER_PROFILES = {
  architect: {
    name: 'The Architect',
    description: 'You see systems where others see chaos. Your superpower is building scalable frameworks.',
    businessModel: 'Templates, Playbooks, Frameworks',
    pathways: ['Notion template marketplace', 'Systems consulting', 'Course on organization'],
  },
  creator: {
    name: 'The Creator',
    description: 'You turn ideas into assets effortlessly. Your superpower is prolific content production.',
    businessModel: 'Digital Products, Courses, Memberships',
    pathways: ['Content template packs', 'Faceless content agency', 'Creator education'],
  },
  strategist: {
    name: 'The Strategist',
    description: 'You spot patterns before they\'re trends. Your superpower is market positioning.',
    businessModel: 'Strategy Guides, Audits, Advisory',
    pathways: ['Niche research reports', 'Positioning workshops', 'Strategic advisory'],
  },
  connector: {
    name: 'The Connector',
    description: 'You build communities that compound. Your superpower is relationship ecosystems.',
    businessModel: 'Community, Masterminds, Network Effects',
    pathways: ['Paid community', 'Mastermind programs', 'Affiliate networks'],
  },
  automator: {
    name: 'The Automator',
    description: 'You eliminate manual work with code and workflows. Your superpower is leverage.',
    businessModel: 'Automation Templates, Workflows, Tools',
    pathways: ['Make/Zapier templates', 'Custom automation agency', 'SaaS micro-tools'],
  },
  researcher: {
    name: 'The Researcher',
    description: 'You dig deep and find gold. Your superpower is insight synthesis.',
    businessModel: 'Research Reports, Data Products, Intelligence',
    pathways: ['Market intelligence newsletter', 'Competitor analysis packs', 'Trend forecasting'],
  },
};

function inferSuperpower(answers) {
  // Simple heuristic based on answer patterns
  const answerValues = Object.values(answers || {}).join(' ').toLowerCase();
  
  if (answerValues.includes('system') || answerValues.includes('organize') || answerValues.includes('framework')) return 'architect';
  if (answerValues.includes('create') || answerValues.includes('content') || answerValues.includes('write')) return 'creator';
  if (answerValues.includes('strateg') || answerValues.includes('plan') || answerValues.includes('position')) return 'strategist';
  if (answerValues.includes('communit') || answerValues.includes('connect') || answerValues.includes('network')) return 'connector';
  if (answerValues.includes('automat') || answerValues.includes('workflow') || answerValues.includes('tool')) return 'automator';
  if (answerValues.includes('research') || answerValues.includes('analyz') || answerValues.includes('data')) return 'researcher';
  
  // Default to architect
  return 'architect';
}

/**
 * Process quiz answers and generate superpower profile.
 * @param {object} params - Request parameters
 * @param {object} params.answers - Quiz answers
 * @param {'freeMode'|'proMode'|'ultraMode'} [params.mode='freeMode'] - AI mode
 * @returns {Promise<object>} Quiz result with superpower profile
 */
export async function processQuiz(params) {
  const validated = quizRequestSchema.parse(params);
  const { answers, mode } = validated;

  // Determine superpower from answers
  const superpowerKey = inferSuperpower(answers);
  const profile = SUPERPOWER_PROFILES[superpowerKey];

  // Build niche from superpower
  const niche = `Faceless ${profile.name} building digital assets`;

  // Use AI to generate detailed profile if in pro/ultra mode
  let aiEnhanced = null;
  if (mode === 'proMode' || mode === 'ultraMode') {
    const systemPrompt = 'You are a career coach for Gen X women building faceless digital businesses. ' +
      'Given quiz answers, provide a detailed superpower profile with specific business model recommendations.';
    
    const userPrompt = 'Quiz answers: ' + JSON.stringify(answers) +
      '\n\nPrimary superpower: ' + profile.name +
      '\n\nGenerate a detailed profile with: strengths, blindspots, business model, pathways, confidence score, and next action.';

    try {
      const result = await aiRouter.generate(null, userPrompt, { mode, systemPrompt, jsonMode: true });
      if (!result.error) {
        aiEnhanced = parseJsonReply(typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply));
      }
    } catch (err) {
      logger.warn('AI quiz enhancement failed, using defaults', { error: err.message });
    }
  }

  return {
    superpowerName: profile.name,
    superpowerDescription: profile.description,
    persona: profile.name,
    personaDescription: 'You are a ' + profile.name.toLowerCase() + '. ' + profile.description,
    strengths: aiEnhanced?.strengths || ['Systems thinking', 'Pattern recognition', 'Scalable execution'],
    blindspots: aiEnhanced?.blindspots || ['Perfectionism', 'Over-engineering', 'Analysis paralysis'],
    businessModel: profile.businessModel,
    recommendedPathways: profile.pathways,
    confidenceScore: aiEnhanced?.confidenceScore || 78,
    energyLevel: aiEnhanced?.energyLevel || 'High',
    burnoutRisk: aiEnhanced?.burnoutRisk || 'Low',
    privacyNeeds: aiEnhanced?.privacyNeeds || 'High',
    overwhelmLevel: aiEnhanced?.overwhelmLevel || 'Moderate',
    readinessLevel: aiEnhanced?.readinessLevel || 'Ready to start',
    facelessComfort: aiEnhanced?.facelessComfort || 'Comfortable',
    profitabilityScore: aiEnhanced?.profitabilityScore || 82,
    competitionLevel: aiEnhanced?.competitionLevel || 'Medium',
    trendStrength: aiEnhanced?.trendStrength || 'Growing',
    nicheViability: aiEnhanced?.nicheViability || 'High',
    audienceInsight: aiEnhanced?.audienceInsight || 'Gen X women want systems, not more information',
    opportunityGaps: aiEnhanced?.opportunityGaps || ['No done-with-you implementation', 'Missing community accountability'],
    niche,
    superpowerNiche: niche,
    personaNiche: niche,
    roadmapSteps: aiEnhanced?.roadmapSteps || [
      'Define your signature framework',
      'Build your first digital asset',
      'Create a lead magnet',
      'Launch to warm audience',
    ],
    estimatedTime: aiEnhanced?.estimatedTime || '30-60 days',
    tools: aiEnhanced?.tools || ['Notion', 'Canva', 'Email platform'],
    aiTools: aiEnhanced?.aiTools || ['Claude', 'ChatGPT', 'Perplexity'],
    nextAction: aiEnhanced?.nextAction || 'Map your expertise to a teachable framework',
    mode: mode,
    provider: aiEnhanced?.provider || 'local-logic',
    model: aiEnhanced?.model || 'rule-based',
    timestamp: Date.now(),
  };
}

export default { processQuiz };