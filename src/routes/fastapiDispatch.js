// src/routes/fastapiDispatch.js
// Handles `fastapi.*` actions by proxying to the FastAPI microservice layer.
//
// Public-facing website tools (Trends Explorer, Product Designer, Roadmap
// Builder, Wealth Calculator, Rank & Rent, Asset Plan) are served here rather
// than by duplicated Node logic, so the Python services stay the single
// source of truth.
import logger from '../utils/logger.js';
import {
  isFastapiConfigured,
  resolveFastapiRoute,
  unwrapInputData,
  callFastapi,
  FASTAPI_ROUTES,
} from '../services/fastapi.js';

/**
 * POST /api with { action: 'fastapi.<tool>', inputData: {...} }
 *
 * Returns the FastAPI response verbatim under `data` so the frontend can read
 * the same shape it would from a direct call.
 */
export async function handleFastapi(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');

  const route = resolveFastapiRoute(action);
  if (!route) {
    return res.status(400).json({
      success: false,
      error: `Unknown fastapi action: ${action}`,
      available: Object.keys(FASTAPI_ROUTES),
    });
  }

  // Fail clearly when the microservice has not been deployed. This is a
  // configuration problem, not a client error, so it must not look like a 400.
  if (!isFastapiConfigured()) {
    logger.warn('[fastapi] service not configured; set FASTAPI_BASE_URL and FASTAPI_API_KEY');
    return res.status(503).json({
      success: false,
      error: 'FastAPI tools are not available right now. Please try again shortly.',
      code: 'FASTAPI_NOT_CONFIGURED',
      action,
    });
  }

  const inputData = unwrapInputData(body);
  const result = await callFastapi(route, inputData);

  if (!result.ok) {
    logger.warn(`[fastapi] ${action} -> ${result.status}: ${result.error}`);
    // A FastAPI 422 means the payload was malformed — surface it verbatim so
    // the form can show field-level messages. Anything else is an upstream fault.
    const status = result.status === 422 ? 422 : 502;
    return res.status(status).json({
      success: false,
      error: result.error,
      action,
      details: result.data?.detail || null,
    });
  }

  return res.status(200).json({
    success: true,
    action,
    data: result.data,
  });
}

/** GET /api/fastapi/status — reachability probe for the microservice layer. */
export async function handleFastapiStatus(req, res) {
  const status = await import('../services/fastapi.js').then((m) => m.getFastapiStatus());
  return res.status(200).json({ success: true, ...status });
}

export default { handleFastapi, handleFastapiStatus };