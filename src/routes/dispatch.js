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

  // Agent endpoints (niche, roadmap, scorecard, product, social, trends, chat, dashboard)
  const agentNames = ['niche', 'roadmap', 'scorecard', 'product', 'social', 'trends', 'chat', 'dashboard'];
  const agentName = action.startsWith('agent.') ? action.replace('agent.', '') : action;
  if (agentNames.includes(agentName)) {
    try {
      const { executeAgent } = await import('../agents/index.js');
      const result = await executeAgent(agentName, body.inputData || body);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Agent dispatch failed', { agent: agentName, error: err.message });
      return res.status(500).json({ error: err.message || 'Agent request failed' });
    }
  }

  // Quiz
  if (action === 'quiz' || action === 'quiz.complete' || action === 'agent.quiz') {
    try {
      const { handleQuiz } = await import('./quizDispatch.js');
      return await handleQuiz(req, res);
    } catch (err) {
      logger.error('Quiz dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Quiz failed' });
    }
  }

  // Intelligence
  if (action === 'intelligence' || action === 'personalize') {
    try {
      const { handleIntelligence } = await import('./intelligenceDispatch.js');
      return await handleIntelligence(req, res);
    } catch (err) {
      logger.error('Intelligence dispatch failed', { error: err.message });
      return res.status(500).json({ success: false, error: err.message || 'Intelligence failed' });
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
  if (action.startsWith('notion.')) return res.status(200).json({ ok: true, message: 'Notion handler scaffolded' });

  // Antigravity (Notion Architect MCP)
  if (action.startsWith('antigravity.')) return res.status(200).json({ ok: true, message: 'Antigravity handler scaffolded' });

  // Website content
  if (action === 'website.content') {
    return res.status(200).json({ ok: true, content: null });
  }

  // Subscribe
  if (action === 'subscribe') {
    const email = body.email || '';
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
    logger.info('Subscribe', { email });
    return res.status(200).json({ ok: true, message: 'Subscribed' });
  }

  // License verify
  if (action === 'license.verify') return res.status(200).json({ ok: true, licensed: false });

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

  // Analytics / events / optimization / report
  if (['analytics', 'events', 'optimization', 'report'].includes(action)) {
    return res.status(200).json({ ok: true, action, message: 'Received' });
  }

  logger.warn('Unknown action', { action });
  return res.status(404).json({ error: 'Unknown action: ' + action });
}

export default { handleDispatch };