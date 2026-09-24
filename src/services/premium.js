// src/services/premium.js
// ============================================================================
// Premium entitlement verification via the Gumroad License API.
// ============================================================================
// Env: GUMROAD_API_KEY (from src/config/env.js)
// Canonical entitlement shape (§2.6 of the Unified System Fix Blueprint):
//   { licensed, reason, email, product, plan, cachedAt }
// Only the backend verifies licenses — clients never trust local state.
// ============================================================================

import env from '../config/env.js';
import logger from '../utils/logger.js';

const GUMROAD_LICENSE_API = 'https://api.gumroad.com/v2/licenses/verify';
const GUMROAD_PRODUCT_API = 'https://api.gumroad.com/v2/products';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h server-side soft cache

// In-memory entitlement cache: email -> { entitlement, expiresAt }
const entitlementCache = new Map();

const PREMIUM_PRODUCTS = new Set([
  'digitallydefined-os',
  'digitallydefined-premium',
  'digitallydefined-dashboard',
  'faceless-digital-real-estate',
  'the-digital-superpower-framework',
  'digital-superpower',
]);

function productToPlan(productName) {
  if (!productName) return 'free';
  return PREMIUM_PRODUCTS.has(String(productName).toLowerCase()) ? 'premium' : 'free';
}

function readCached(email) {
  const entry = entitlementCache.get(email);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    entitlementCache.delete(email);
    return null;
  }
  return entry.entitlement;
}

function writeCache(email, entitlement) {
  entitlementCache.set(email, { entitlement, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** True when Gumroad is configured (API key present). */
export function isGumroadConfigured() {
  return Boolean(env.gumroad && env.gumroad.apiKey);
}

/**
 * Verify a Gumroad license key.
 * @param {object} params
 * @param {string} params.licenseKey - Gumroad license key
 * @param {string} [params.email] - purchaser email (used as cache key)
 * @param {string} [params.productId] - product permalink to scope the check
 * @returns {Promise<{licensed:boolean, reason:string, email?:string, product?:string, plan:string, cachedAt:number}>}
 */
export async function verifyLicense({ licenseKey, email = '', productId = '' } = {}) {
  if (!isGumroadConfigured()) {
    logger.warn('license.verify called but GUMROAD_API_KEY is not configured');
    return { licensed: false, reason: 'Gumroad API key not configured', email: email || '', product: productId || null, plan: 'free', cachedAt: Date.now() };
  }

  const cacheKey = String(email || licenseKey || 'default');
  const cached = readCached(cacheKey);
  if (cached) return cached;

  const body = new URLSearchParams({ product_permalink: productId, license_key: licenseKey });
  if (email) body.set('email', email);

  try {
    const response = await fetch(GUMROAD_LICENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      const product = (data.purchase && data.purchase.product_name) || productId || '';
      const plan = productToPlan(product);
      const entitlement = {
        licensed: true,
        reason: 'valid',
        email: email || (data.purchase && data.purchase.email) || '',
        product,
        plan,
        cachedAt: Date.now(),
      };
      writeCache(cacheKey, entitlement);
      return entitlement;
    }

    const reason = data.message || `Gumroad rejected license (${response.status})`;
    logger.warn('Gumroad license verify failed', { reason, status: response.status });
    return { licensed: false, reason, email: email || '', product: productId || null, plan: 'free', cachedAt: Date.now() };
  } catch (err) {
    logger.error('Gumroad verify error', { error: err.message });
    return { licensed: false, reason: 'Gumroad verify request failed: ' + err.message, email: email || '', product: productId || null, plan: 'free', cachedAt: Date.now() };
  }
}

/**
 * List Gumroad products (used by the dashboard premium module to show the paywall).
 * @returns {Promise<{products: object[], error?: string}>}
 */
export async function listGumroadProducts() {
  if (!isGumroadConfigured()) {
    return { products: [], error: 'GUMROAD_API_KEY not configured' };
  }
  try {
    const response = await fetch(GUMROAD_PRODUCT_API, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + env.gumroad.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { products: [], error: data.message || 'Gumroad products request failed' };
    }
    return { products: Array.isArray(data.products) ? data.products : [] };
  } catch (err) {
    return { products: [], error: 'Gumroad products request failed: ' + err.message };
  }
}

export default { verifyLicense, listGumroadProducts, isGumroadConfigured, productToPlan };