// src/routes/dispatch.js — Catch-all action dispatcher
// The dashboard sends POST / with { action, ...payload }.
// This routes every action to the correct handler.

import { checkDashboardApiKey } from '../middleware/auth.js';
import logger from '../utils/logger.js';

export async function handleDispatch(req, res) {
  if (!checkDashboardApiKey(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const action = body.action || '';
  if (!action) return res.status(400).json({ error: 'Missing action field' });

  logger.info('Dispatch request', { action });
  console.log('[dispatch] action:', action);

  // Agent endpoints (niche, roadmap, scorecard, product, social, trends,
  // competition, opportunities, audience).
  // NOTE: `quiz` is intentionally NOT here — quiz actions route to
  // quizDispatch below so submissions persist server-side and return the
  // canonical quiz/roadmap shape. `dashboard` and `chat` are also not agents;
  // they are named routes delegated below. Including them here caused
  // guaranteed 500s (Phase 1 fix).
  const agentNames = ['niche', 'roadmap', 'scorecard', 'product', 'social', 'trends', 'competition', 'opportunities', 'audience'];
  const agentName = action.startsWith('agent.') ? action.replace('agent.', '') : action;
  if (agentNames.includes(agentName)) {
    try {
      const { executeAgent } = await import('../agents/index.js');
      const result = await executeAgent(agentName, body.inputData || body);
      return res.status(200).json({ success: true, data: result, provider: result.provider || null, model: result.model || null, timestamp: Date.now() });
    } catch (err) {
      logger.error('Agent dispatch failed', { agent: agentName, error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Agent request failed', provider: null, model: null, timestamp: Date.now() });
    }
  }

  // Dashboard — delegated to the existing named route (NOT a dispatch agent).
  if (action === 'dashboard' || action === 'agent.dashboard') {
    try {
      const { default: dashboardRoute } = await import('./dashboard.js');
      const handler = dashboardRoute.handleDashboard || dashboardRoute;
      return await handler(req, res);
    } catch (err) {
      logger.error('Dashboard dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Dashboard failed' });
    }
  }

  // Chat — delegated to the existing named route (NOT a dispatch agent).
  if (action === 'chat' || action === 'agent.chat') {
    try {
      const chatMod = await import('./chat.js');
      const handler = chatMod.default?.handleChat || chatMod.handleChat;
      req.body = { ...body, message: body.message || body.content || '', history: body.history || [], systemPrompt: body.systemPrompt || '' };
      return await handler(req, res);
    } catch (err) {
      logger.error('Chat dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Chat failed' });
    }
  }

  // Quiz — routes to the real quizDispatch handler (quiz / quiz.complete /
  // agent.quiz / quiz.submit all persist server-side).
  if (action === 'quiz' || action === 'quiz.complete' || action === 'quiz.submit' || action === 'agent.quiz') {
    try {
      const quizMod = await import('./quizDispatch.js');
      const handler = quizMod.handleQuiz || quizMod.default?.handleQuiz;
      return await handler(req, res);
    } catch (err) {
      logger.error('Quiz dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Quiz failed', timestamp: Date.now() });
    }
  }

  // Quiz roadmap lookup.
  if (action === 'quiz.roadmap' || action === 'quiz.roadmap.get') {
    try {
      const quizMod = await import('./quizDispatch.js');
      const handler = quizMod.handleQuizRoadmap || quizMod.default?.handleQuizRoadmap;
      return await handler(req, res);
    } catch (err) {
      logger.error('Quiz roadmap dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Quiz roadmap failed', timestamp: Date.now() });
    }
  }

  // Intelligence & personalize — real composed pipeline.
  if (action === 'intelligence' || action === 'personalize' || action === 'agent.intelligence') {
    try {
      const intelMod = await import('./intelligenceDispatch.js');
      const handler = intelMod.handleIntelligence || intelMod.default?.handleIntelligence;
      return await handler(req, res);
    } catch (err) {
      logger.error('Intelligence dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Intelligence failed', timestamp: Date.now() });
    }
  }

  // Integrations
  if (action.startsWith('integration.')) {
    try {
      const mod = await import('./integrationsDispatch.js');
      const handler = action.endsWith('.start') ? mod.handleIntegrationStart : mod.handleIntegrationData;
      return await handler(req, res, action);
    } catch (err) {
      logger.error('Integration dispatch failed', { action, error: err.message });
      return res.status(500).json({ error: err.message || 'Integration failed' });
    }
  }

  // Notion
  if (action.startsWith('notion.')) {
    try {
      const notionMod = await import('../services/notion.js');
      const innerAction = action.replace('notion.', '');
      const handler = notionMod[innerAction] || notionMod.default?.[innerAction];
      if (typeof handler === 'function') return await handler(req, res);
      const listActions = Object.keys(notionMod.default || notionMod).filter((k) => typeof (notionMod.default || notionMod)[k] === 'function');
      return res.status(200).json({ success: true, data: { scaffolded: true, action: innerAction, availableActions: listActions }, provider: null, model: null, timestamp: Date.now() });
    } catch (err) {
      logger.error('Notion dispatch failed', { action, error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Notion dispatch failed', timestamp: Date.now() });
    }
  }

    // Antigravity (Notion Architect)
  if (action.startsWith('antigravity.')) {
    try {
      const am = await import('../services/antigravity.js');
      const innerAction = action.replace('antigravity.', '');
      req.body = { ...body, action: innerAction };
      const handler = am.default?.handleAntigravity || am.handleAntigravity;
      return await handler(req, res);
    } catch (err) {
      logger.error('Antigravity dispatch failed', { action, error: err.message });
      return res.status(500).json({ ok: false, action, error: err.message || 'Antigravity failed' });
    }
  }

  // Onboarding
  if (action.startsWith('onboarding.')) {
    try {
      const mod = await import('./onboardingDispatch.js');
      const handler = mod.handleOnboarding || mod.default?.handleOnboarding;
      return await handler(req, res);
    } catch (err) {
      logger.error('Onboarding dispatch failed', { action, error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Onboarding failed', timestamp: Date.now() });
    }
  }

  // Website content
  if (action === 'website.content') {
    return res.status(200).json({ success: true, data: { content: body.content || null }, provider: null, model: null, timestamp: Date.now() });
  }

  // Subscribe — wires to Brevo (real) in a later phase; emits canonical envelope.
  if (action === 'subscribe') {
    const email = body.email || '';
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
    logger.info('Subscribe', { email });
    return res.status(200).json({ ok: true, success: true, message: 'Subscribed', data: { email, provider: 'brevo' }, timestamp: Date.now() });
  }

  // License verify — delegated to premium service (real Gumroad verification).
  if (action === 'license.verify') {
    try {
      const { verifyLicense } = await import('../services/premium.js');
      const result = await verifyLicense({ licenseKey: body.licenseKey || body.license_key || '', email: body.email || '', productId: body.productId || body.product_permalink || '' });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      logger.error('License verify dispatch failed', { error: err.message });
      return res.status(500).json({ ok: true, licensed: false, reason: 'License verification failed: ' + err.message });
    }
  }

  // Hermes agent / chat
  if (['hermes.agent', 'public.chat', 'mentor.dev'].includes(action)) {
    try {
      const chatMod = await import('./chat.js');
      const handler = chatMod.default?.handleChat || chatMod.handleChat;
      req.body = { ...body, message: body.message || body.content || '' };
      return await handler(req, res);
    } catch (err) {
      logger.error('Chat dispatch failed', { error: err.message });
      return res.status(500).json({ error: err.message || 'Chat failed' });
    }
  }

  // AI Business Partner — structured JSON business intelligence
  if (action === 'business.partner' || action === 'agent.business-partner') {
    try {
      const bpMod = await import('./businessPartner.js');
      const handler = bpMod.default?.handleBusinessPartner || bpMod.handleBusinessPartner;
      return await handler(req, res);
    } catch (err) {
      logger.error('Business partner dispatch failed', { error: err.message });
      return res.status(500).json({ error: err.message || 'Business partner failed' });
    }
  }

  // Analytics / events / optimization / report — scaffolded (persistence in Phase 2).
  if (['analytics', 'events', 'optimization', 'report'].includes(action)) {
    return res.status(200).json({ success: true, data: { action, processed: false, message: 'Received' }, provider: null, model: null, timestamp: Date.now() });
  }

  logger.warn('Unknown action', { action });
  return res.status(404).json({ error: 'Unknown action: ' + action });
}

export default { handleDispatch };