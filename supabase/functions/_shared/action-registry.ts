// _shared/action-registry.ts
// SINGLE SOURCE OF TRUTH for Hermes action names + access rules.
// Used by: supabase/functions/hermes/index.ts (edge dispatcher)
// Mirrored by: api/index.js (Vercel dispatcher) — keep both in sync.

/** Form/community actions that never require an API key. */
export const PUBLIC_FORM_ACTIONS = [
  "subscribe",
  "contact",
  "quiz.complete",
  "public.chat",
] as const;

/** Public read-only actions (rate-limited) that return site copy, not secrets. */
export const PUBLIC_READ_ACTIONS = ["website.content"] as const;

/** Action prefixes that are public (rate-limited only). */
export const PUBLIC_ACTION_PREFIXES = ["agent."] as const;

/**
 * FastAPI microservice actions.
 *
 * These are NOT handled by Hermes. They are routed by the Vercel dispatcher
 * (`api/index.js`) and/or the `/fastapi/*` proxy to the FastAPI layer
 * (product-generator / niche / domain / affiliate / rank-rent / blueprint /
 * roadmap / trends). isKnownAction() deliberately does NOT include them, so a
 * stray `fastapi.*` sent to this edge function is rejected with 400.
 */
export const FASTAPI_ACTION_PREFIX = "fastapi." as const;

export function isFastAPIAction(action: string): boolean {
  return action.startsWith(FASTAPI_ACTION_PREFIX);
}

/** Actions any authenticated caller (x-api-key) may use via GET or POST. */
export const AUTHED_ACTIONS = [
  "status",
  "routes",
  "auth.verify",
  "test-env",
  "dashboard",
  "ai.recommendations",
  "brain.brief",
  "chat",
  "mentor.dev",
  "hermes.agent",
  "intelligence",
  "automation.list",
  "automation.logs",
  "automation.events",
  "automation.sync",
  "automation.run",
  "integration.googleAnalytics",
  "integration.social",
  "integration.email",
  "integration.community",
  "integration.google.start",
  "integration.social.start",
  "integration.email.start",
  "integration.community.start",
  "license.verify",
  "website.edit",
  // Model switching (dashboard selector -> backend-clean -> Hermes runtime)
  "hermes.setActiveModel",
  "hermes.getActiveModel",
  // Antigravity MCP (Notion Architect)
  "antigravity",
  "antigravity.createNotionPage",
  "antigravity.updateDatabase",
  "antigravity.buildTemplate",
  "antigravity.reconcileDatabase",
  "antigravity.runAutomation",
  "antigravity.status",
] as const;

/** GET-only actions (system probes). */
export const GET_ONLY_ACTIONS = [
  "status",
  "routes",
  "auth.verify",
  "test-env",
] as const;

/**
 * Read-only actions callable via GET or POST. The dashboard issues these over
 * the JSON POST contract, while some legacy clients still use GET. Kept in sync
 * with api/index.js (Vercel dispatcher).
 */
export const GET_OR_POST_ACTIONS = [
  "dashboard",
  "automation.list",
  "automation.logs",
  "automation.events",
] as const;

/** POST-only actions (state mutations). */
export const POST_ONLY_ACTIONS = [
  "automation.sync",
  "automation.run",
] as const;

export function isPublicAction(action: string): boolean {
  return (
    (PUBLIC_FORM_ACTIONS as readonly string[]).includes(action) ||
    (PUBLIC_READ_ACTIONS as readonly string[]).includes(action) ||
    PUBLIC_ACTION_PREFIXES.some((p) => action.startsWith(p))
  );
}

export function isKnownAction(action: string): boolean {
  return (
    isPublicAction(action) ||
    (AUTHED_ACTIONS as readonly string[]).includes(action)
  );
}
