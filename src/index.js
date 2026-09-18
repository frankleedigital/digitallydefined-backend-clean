// src/index.js - Main Entry Point
import 'dotenv/config';
import express from 'express';
import { env, getIntegrationReport, validateEnv, logEnvValidation, REQUIRED_VARS, OPTIONAL_VARS } from './config/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { setCORSHeaders, handleOPTIONS } from './middleware/cors.js';
import logger from './utils/logger.js';
import { logRouting } from './services/aiRouter.js';

// Import route handlers
import { nicheRoute, roadmapRoute, scorecardRoute, productRoute, socialRoute, trendsRoute, chatRoute, dashboardRoute } from './routes/index.js';

const app = express();
const PORT = env.port;

// Validate environment before anything else - logs any missing keys.
const envValidation = logEnvValidation();

// Log which AI provider/model every agent will use.
logRouting();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  setCORSHeaders(res, req.headers.origin);
  if (handleOPTIONS(req, res)) return;
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  const report = getIntegrationReport();
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    service: 'DigitallyDefined Clean Backend',
    version: '1.0.0',
    timestamp: Date.now(),
    env: env.nodeEnv,
    aiProvider: report.ai.primary || 'none',
    aiFallbacks: (getIntegrationReport().ai.fallbacks || []).join(', ') || 'none',
    configured: report,
    missingRequired: envValidation.missingRequired,
  });
});

// API routes
app.post('/api/niche', nicheRoute.handleNiche);
app.post('/api/roadmap', roadmapRoute.handleRoadmap);
app.post('/api/scorecard', scorecardRoute.handleScorecard);
app.post('/api/product', productRoute.handleProduct);
app.post('/api/social', socialRoute.handleSocial);
app.post('/api/trends', trendsRoute.handleTrends);
app.post('/api/chat', chatRoute.handleChat);
app.post('/api/dashboard', dashboardRoute.handleDashboard);

// Test endpoint (no auth required)
app.get('/api/test-env', (req, res) => {
  const validation = validateEnv();
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    ok: validation.ok,
    missingRequired: validation.missingRequired,
    missingOptional: validation.missingOptional,
    checks: validation.configured,
    counts: {
      requiredConfigured: REQUIRED_VARS.length - validation.missingRequired.length,
      requiredTotal: REQUIRED_VARS.length,
      optionalConfigured: OPTIONAL_VARS.length - validation.missingOptional.length,
      optionalTotal: OPTIONAL_VARS.length,
    },
    notes: {
      antigravity: 'MCP Notion Architect - requires ANTIGRAVITY_API_KEY',
      hermes: 'Hermes MCP Gateway - requires HERMES_GATEWAY_URL',
      supabase: 'Database - requires SUPABASE_URL and SUPABASE_ANON_KEY',
      vertex: 'Vertex AI Gemini fallback - requires VERTEX_PROJECT_ID (optional)',
      omniroute: 'PRIMARY AI provider - OmniRoute via Cloudflare tunnel (' + env.omniroute.model + ')',
    },
  });
});

// Error handling
app.use((req, res, next) => {
  // Global catch-all: ensure every response (including 404s) carries CORS headers
  // so the browser never sees a cross-origin rejection on error pages.
  setCORSHeaders(res, req.headers && req.headers.origin);
  next();
});
app.use(errorHandler);

// Start server (skipped on Vercel - serverless handles it)
const isNodeEnvironment = typeof process !== 'undefined' && process.env && !process.env.VERCEL;

if (isNodeEnvironment) {
  app.listen(PORT, () => {
    logger.info('DigitallyDefined Clean Backend started', {
      port: PORT,
      env: env.nodeEnv,
      integrations: getIntegrationReport(),
    });
    console.log('Server running on http://localhost:' + PORT);
    console.log('Supabase connected: ' + (env.supabase.url ? 'yes' : 'no'));
    console.log('Hermes agent router loaded: ' + (env.hermes.gatewayUrl ? 'yes' : 'no'));
    console.log('Dashboard API ready: ' + (env.dashboardApiKey ? 'yes' : 'no'));
  });
}

export default app;
