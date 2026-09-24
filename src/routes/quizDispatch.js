// src/routes/quizDispatch.js
// ============================================================================
// Quiz actions handled by the dispatcher: quiz / quiz.complete / agent.quiz
// ============================================================================
// The public website quiz is deterministic and client-side; the canonical
// result lives in localStorage (`dd-quiz-results`) under the shape defined in
// §2.1 of the Unified System Fix Blueprint.
//
// This handler gives the dispatcher a real implementation:
//   - persists a submitted quiz result server-side (best-effort, Supabase),
//   - returns the canonical intelligence-style quiz payload the dashboard
//     IntelligencePage expects.
// It never blocks on persistence failures.
// ===========================================================================

import { checkDashboardApiKey } from '../middleware/auth.js';
import { respond, respondError } from '../utils/respond.js';
import { isSupabaseRestConfigured, upsert, select } from '../services/supabaseRest.js';
import { processQuiz } from '../agents/quiz.js';
import { sendQuizRoadmapEmail } from '../services/brevo.js';
import logger from '../utils/logger.js';

const QUIZ_TABLE = 'quiz_roadmaps';

/**
 * Persist a quiz result to Supabase (best-effort, never throws).
 * @param {object} quizResult
 * @param {object} opts
 */
async function persistQuizResult(quizResult, { userId = 'anonymous' } = {}) {
  if (!isSupabaseRestConfigured()) return { persisted: false, reason: 'Supabase REST not configured' };
  try {
    const row = {
      user_id: userId,
      email: quizResult.email || quizResult.userId || '',
      answers: quizResult.answers || {},
      persona_key: quizResult.superpower || quizResult.persona || '',
      result: quizResult,
      created_at: new Date().toISOString(),
    };
    await upsert(QUIZ_TABLE, row, 'user_id');
    return { persisted: true };
  } catch (err) {
    logger.warn('Quiz persistence failed', { error: err.message });
    return { persisted: false, reason: err.message };
  }
}

/**
 * Handle a quiz *submission / completion* request.
 * POST /api/quiz/submit (also reached via dispatch action: quiz / quiz.complete)
 */
export async function handleQuiz(req, res) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const body = req.body || {};
    const answers = body.answers || body.inputData?.answers || {};
    const userId = body.userId || body.user_id || 'anonymous';
    const email = body.email || '';

    let personaResult = null;
    try {
      personaResult = await processQuiz({ answers, mode: body.mode || 'freeMode' });
    } catch (err) {
      logger.warn('Quiz agent failed; using answers only', { error: err.message });
    }

    const payload = {
      ...(personaResult || {}),
      answers,
      superpower: personaResult?.persona?.toLowerCase() || body.superpower || '',
      userId,
      email,
    };

    const persistence = await persistQuizResult(payload, { userId });

    let emailResult = null;
    if (email && payload.roadmap) {
      emailResult = await sendQuizRoadmapEmail({
        email,
        superpower: payload.superpower,
        superpowerName: payload.superpowerName,
        superpowerDescription: payload.superpowerDescription,
        roadmapSteps: payload.roadmap.steps || [],
        estimatedTime: payload.roadmap.estimatedTime,
      });
      logger.info('Quiz roadmap email sent', { email, ok: emailResult?.ok });
    }

    return respond(res, {
      quizResult: payload,
      superpower: payload.superpower,
      superpowerName: payload.superpowerName || '',
      superpowerDescription: payload.superpowerDescription || '',
      persona: payload.persona || '',
      roadmap: payload.roadmap,
      persisted: persistence.persisted,
      emailSent: emailResult?.ok || false,
    }, { provider: personaResult?.provider || null, model: personaResult?.model || null });
  } catch (err) {
    logger.error('Quiz dispatch failed', { error: err.message });
    return respondError(res, err);
  }
}

/**
 * GET /api/quiz/roadmap?email=xxx — retrieve a previously saved quiz result.
 * Used by the website + dashboard to hydrate a saved roadmap.
 */
export async function handleQuizRoadmap(req, res) {
  if (!checkDashboardApiKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const email = String(req.query.email || req.body?.email || '').trim().toLowerCase();
    if (!email) return respondError(res, new Error('email is required'), { status: 400 });

    if (!isSupabaseRestConfigured()) {
      return respond(res, { found: false, reason: 'Supabase REST not configured', email });
    }

    const rows = await select(QUIZ_TABLE, `email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`);
    const row = rows[0];
    if (!row) return respond(res, { found: false, email });

    return respond(res, { found: true, email, result: row.result, persona_key: row.persona_key });
  } catch (err) {
    logger.error('Quiz roadmap lookup failed', { error: err.message });
    return respondError(res, err);
  }
}

export default { handleQuiz, handleQuizRoadmap };