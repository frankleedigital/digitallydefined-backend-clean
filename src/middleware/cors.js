// src/middleware/cors.js - CORS Middleware
// Purpose: Allow the public website + dashboard to call the backend.
import constants from '../config/constants.js';

export function setCORSHeaders(res, origin) {
  const allowed = constants.ALLOWED_ORIGINS;
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-user-id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOPTIONS(req, res) {
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res, req.headers && req.headers.origin);
    return res.status(200).end();
  }
  return null;
}

export default { setCORSHeaders, handleOPTIONS };