/**
 * lib/notion-write.js
 *
 * Write executor for Hermes live mode.
 * Routes Notion API calls based on action type and live mode flag.
 *
 * Architect (Phase 3 restoration): record writes route through the Notion
 * Architect (normalize + validate + property payload) and are gated behind
 * NOTION_LIVE_MODE — the previous gate read `'false' === 'true'` (always false),
 * which dead-locked every write; that bug is fixed below.
 */

import { createDatabase, updateDatabase } from './notion-client.ts';
import {
  buildNotionProperties,
  getNotionDbId,
  getNotionDedupTuple,
  getNotionPropType,
  normalizeNotionRecord,
  validateNotionRecord,
} from './notion-architect.ts';

/** The correct live-mode read: env var with a 'false' default, compared to 'true'. */
function isLiveMode(): boolean {
  return (Deno.env.get('NOTION_LIVE_MODE') || 'false').trim().toLowerCase() === 'true';
}

function notionSecret(): string {
  return (Deno.env.get('NOTION_SECRET') || Deno.env.get('NOTION_API_KEY') || '').trim();
}

/**
 * Execute a Notion write operation
 * @param {string} phaseName - Name of the phase being executed
 * @param {string} action - Action type (createDatabase, updateDatabase)
 * @param {object} payload - Payload for the operation
 * @returns {Promise<object>} Result object with dryRun flag and response data
 */
export async function executeNotionWrite(
  phaseName: string,
  action: string,
  payload: Record<string, any>
) {
  const LIVE_MODE = isLiveMode();
  const SECRET = notionSecret();

  // Dry-run mode: log and return
  if (!LIVE_MODE) {
    console.log(`[DRY-RUN] ${phaseName} → ${action}`);
    console.log(`  Payload: ${JSON.stringify(payload, null, 2)}`);
    return { dryRun: true, phaseName, action };
  }

  // Live mode: validate secret and execute
  if (!SECRET) {
    throw new Error('NOTION_SECRET environment variable is not set');
  }

  console.log(`[LIVE] Executing ${phaseName} → ${action}`);

  let result;
  switch (action) {
    case 'createDatabase':
      result = await createDatabase(SECRET, payload);
      break;
    case 'updateDatabase':
      // Extract database ID from payload or use target field
      const databaseId = payload.databaseId || payload.target;
      if (!databaseId) {
        throw new Error('updateDatabase requires databaseId or target in payload');
      }
      // Remove target from payload if present (not part of Notion API)
      const { target, ...updatePayload } = payload;
      result = await updateDatabase(SECRET, databaseId, updatePayload);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  console.log(`[LIVE] ${phaseName} completed successfully`);
  return { dryRun: false, phaseName, action, result };
}

/**
 * Architect-gated record upsert — the single path for agent/service record
 * writes into a Notion OS database (content/templates/assets/ideas/automations).
 *
 * - Normalizes + validates via the architect before any fetch.
 * - Dry-run returns a simulated result without I/O.
 * - Dedup: skips when a page with the same dedup tuple already exists.
 *
 * @param {string} dbKey   Architect DB key (assets/ideas/content/templates/...)
 * @param {object} record  Arbitrary caller fields (legacy names accepted)
 * @returns {Promise<object>} { dryRun, created, skipped, reason? }
 */
export async function upsertNotionRecord(
  dbKey: string,
  record: Record<string, unknown>
): Promise<{ dryRun: boolean; created: boolean; skipped: boolean; reason?: string }> {
  const normalized = normalizeNotionRecord(dbKey, record);
  if (!normalized) throw new Error(`Unknown architect DB key: ${dbKey}`);

  const validation = validateNotionRecord(dbKey, normalized);
  if (!validation.valid) {
    return { dryRun: true, created: false, skipped: true, reason: validation.error ?? 'validation failed' };
  }

  const dbId = getNotionDbId(dbKey);
  if (!dbId) {
    return { dryRun: true, created: false, skipped: true, reason: `${dbKey} DB id is not configured` };
  }

  if (!isLiveMode()) {
    console.log(`[DRY-RUN] notion.upsert ${dbKey} → ${JSON.stringify(buildNotionProperties(dbKey, normalized)).slice(0, 300)}`);
    return { dryRun: true, created: false, skipped: false, reason: 'NOTION_LIVE_MODE is off' };
  }

  const secret = notionSecret();
  if (!secret) throw new Error('NOTION_SECRET (or NOTION_API_KEY) is not set');

  const headers = {
    Authorization: `Bearer ${secret}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  // Dedup via the architect tuple before creating (first dedup key).
  const tuple = getNotionDedupTuple(dbKey, normalized);
  const dedupKey = tuple ? Object.keys(tuple)[0] : null;
  if (dedupKey) {
    const dedupType = getNotionPropType(dbKey, dedupKey) || 'rich_text';
    const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        page_size: 1,
        filter: { property: dedupKey, [dedupType]: { equals: String(normalized[dedupKey]) } },
      }),
    });
    if (queryRes.ok) {
      const data = await queryRes.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        return { dryRun: false, created: false, skipped: true, reason: 'dedup match' };
      }
    }
    // A failed dedup query is non-fatal: fall through and create.
  }

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { type: 'database_id', database_id: dbId },
      properties: buildNotionProperties(dbKey, normalized),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion upsert failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { dryRun: false, created: true, skipped: false };
}