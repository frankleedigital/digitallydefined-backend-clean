// src/routes/intelligenceDispatch.js
// ============================================================================
// Intelligence actions handled by the dispatcher: intelligence / personalize
// ============================================================================
// Composes the (formerly orphaned, now registered) quiz, niche, audience,
// competition, and opportunities agents into the canonical intelligence shape
// the dashboard IntelligencePage renders:
//   { superpower, superpowerDescription, persona, strengths, blindspots,
//     businessModel, recommendations, roadmap, niches, trends, competition,
//     opportunities, audience }
//
// The quiz persona is computed deterministically by the quiz agent, then the
// remaining agents are run with the inferred superpower niche for context.
// Each agent failure degrades gracefully so the intelligence package always
// returns something useful.
// ===========================================================================

import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import { executeAgent } from '../agents/index.js';
import logger from '../utils/logger.js';

/**
 * Build the canonical superpower → niche for the context agents.
 * Mirrors the website's persona → niche mapping so output stays aligned.
 */
function superpowerToNiche(superpower, answers = {}) {
  const profiles = {
    architect: 'faceless systems and templates for Gen X women',
    builder: 'faceless systems and templates for Gen X women',
    creator: 'faceless content creation for Gen X women',
    educator: 'faceless digital courses and coaching for Gen X women',
    strategist: 'faceless strategy and positioning for Gen X women',
    connector: 'faceless community building for Gen X women',
    researcher: 'faceless market research for Gen X women',
    automator: 'faceless automation and workflows for Gen X women',
  };
  const key = String(superpower || '').toLowerCase();
  if (profiles[key]) return profiles[key];
  const firstAnswer = String(Object.values(answers || {})[0] || 'niche').trim();
  return firstAnswer || 'faceless digital products for Gen X women';
}

/**
 * Handle a personalization / intelligence request.
 * POST /api/intelligence (also reached via dispatch action: intelligence, personalize)
 */
export async function handleIntelligence(req, res) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const body = req.body || {};
    const answers = body.answers || body.inputData?.answers || {};
    const userId = body.userId || body.user_id || 'anonymous';
    const mode = body.mode || 'freeMode';

    // 1. Quiz agent: deterministic persona + enhanced profile.
    let quizResult = null;
    try {
      quizResult = await executeAgent('quiz', { answers, mode });
    } catch (err) {
      logger.warn('Intelligence: quiz agent failed', { error: err.message });
    }

    const superpower = quizResult?.persona?.toLowerCase() || body.superpower || 'builder';
    const niche = superpowerToNiche(superpower, answers);

    // 2. Context agents run against the inferred niche (all fail-soft).
    const [nicheResult, audienceResult, competitionResult, opportunitiesResult] = await Promise.all([
      runSoft('niche', { topic: niche, mode }),
      runSoft('audience', { niche, mode }),
      runSoft('competition', { niche, depth: 'overview', mode }),
      runSoft('opportunities', { niche, mode }),
    ]);

    // 3. Compose the canonical intelligence package.
    const recommendations = [
      ...(opportunitiesResult?.quickWins || []),
      ...(opportunitiesResult?.recommendedProducts || []).map((p) => p.name).filter(Boolean),
      ...(competitionResult?.actions || []),
    ].slice(0, 6);

    const strengths = quizResult?.strengths || [];
    const blindspots = quizResult?.blindspots || [];

    const data = {
      superpower,
      superpowerName: quizResult?.superpowerName || quizResult?.persona || '',
      superpowerDescription: quizResult?.superpowerDescription
        || audienceResult?.primaryPersona?.name
        || 'Heading toward a faceless digital business built on your superpower',
      persona: superpower,
      personaDescription: quizResult?.personaDescription || '',
      strengths: strengths.length ? strengths : (audienceResult?.messagingAngles || []),
      blindspots: blindspots.length ? blindspots : ['Over-planning before shipping'],
      businessModel: quizResult?.businessModel || opportunitiesResult?.recommendedProducts?.[0]?.format || 'Digital products',
      recommendedPathways: quizResult?.recommendedPathways || [],
      recommendations,
      roadmap: quizResult?.roadmapSteps
        ? { steps: quizResult.roadmapSteps, estimatedTime: quizResult.estimatedTime || '30-60 days' }
        : { steps: [], estimatedTime: '30-60 days' },
      niches: [niche],
      trends: nicheResult?.recommendations || [],
      competition: competitionResult?.topCompetitors || [],
      opportunities: opportunitiesResult?.opportunityGaps || [],
      audience: audienceResult ? {
        description: audienceResult.primaryPersona?.name || '',
        personas: audienceResult.secondaryPersonas || [],
        painPoints: audienceResult.primaryPersona?.painPoints || [],
        messagingAngles: audienceResult.messagingAngles || [],
        contentPillars: audienceResult.contentPillars || [],
      } : {},
      confidenceScore: quizResult?.confidenceScore || 78,
      userId,
      mode,
    };

    return respond(res, data, { provider: quizResult?.provider || 'composed', model: quizResult?.model || 'multi-agent' });
  } catch (err) {
    logger.error('Intelligence dispatch failed', { error: err.message });
    return respondError(res, err);
  }
}

/**
 * Run one agent, swallowing failures so a single agent never kills the package.
 */
async function runSoft(agentName, params) {
  try {
    const result = await executeAgent(agentName, params);
    return result && result.error ? null : result;
  } catch (err) {
    logger.warn('Intelligence sub-agent failed', { agent: agentName, error: err.message });
    return null;
  }
}

export default { handleIntelligence };