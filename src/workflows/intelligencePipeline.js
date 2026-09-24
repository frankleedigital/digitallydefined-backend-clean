// src/workflows/intelligencePipeline.js
// DigitallyDefined Intelligence Orchestrator
// Runs the full intelligence pipeline:
// 1. Quiz → Superpower Profile
// 2. Roadmap Generation
// 3. Trend Analysis
// 4. Competition Analysis
// 5. Opportunity Scanning
// 6. Audience Insights

import { executeAgent } from '../agents/index.js';
import logger from '../utils/logger.js';

/**
 * Run the complete intelligence pipeline from quiz answers.
 * @param {object} quizAnswers - User's quiz responses
 * @returns {Promise<object>} Unified intelligence package
 */
export async function runIntelligencePipeline(quizAnswers) {
  logger.info('Starting intelligence pipeline', { quizAnswersKeys: Object.keys(quizAnswers) });

  // Step 1: Run the quiz + roadmap agent
  const pkg = await executeAgent('quiz', { answers: quizAnswers });

  // Extract niche correctly
  const niche =
    pkg.niche ||
    pkg.personaNiche ||
    pkg.superpowerNiche ||
    'digital business';

  // Step 2: Trend analysis
  const trends = await executeAgent('trends', { niche });

  // Step 3: Competition analysis
  const competition = await executeAgent('competition', { niche });

  // Step 4: Opportunity scanning
  const opportunities = await executeAgent('opportunities', { niche });

  // Step 5: Audience insights
  const audience = await executeAgent('audience', { niche });

  // Step 6: Build unified intelligence package
  const result = {
    // Identity
    superpowerName: pkg.superpowerName,
    superpowerDescription: pkg.superpowerDescription,
    persona: pkg.persona,
    personaDescription: pkg.personaDescription,

    // Strengths & blindspots
    strengths: pkg.strengths,
    blindspots: pkg.blindspots,

    // Business model
    businessModel: pkg.businessModel,
    recommendedPathways: pkg.recommendedPathways,

    // Emotional signals
    confidenceScore: pkg.confidenceScore,
    energyLevel: pkg.energyLevel,
    burnoutRisk: pkg.burnoutRisk,
    privacyNeeds: pkg.privacyNeeds,
    overwhelmLevel: pkg.overwhelmLevel || null,
    readinessLevel: pkg.readinessLevel || null,
    facelessComfort: pkg.facelessComfort || null,

    // Niche & viability
    niche,
    profitabilityScore: pkg.profitabilityScore,
    competitionLevel: pkg.competitionLevel,
    trendStrength: pkg.trendStrength,
    nicheViability: pkg.nicheViability,
    audienceInsight: pkg.audienceInsight,
    opportunityGaps: pkg.opportunityGaps,

    // Roadmap
    roadmap: {
      steps: pkg.roadmapSteps || pkg.steps || [],
      estimatedTime: pkg.estimatedTime,
      tools: pkg.tools,
      aiTools: pkg.aiTools,
      nextAction: pkg.nextAction,
    },

    // Intelligence modules
    trends,
    competition,
    opportunities,
    audience,
  };

  logger.info('Intelligence pipeline completed', { niche, hasRoadmap: !!result.roadmap.steps.length });
  return result;
}

export default { runIntelligencePipeline };