// supabase/functions/notion-sync/index.ts
// Scheduled Edge Function — pushes new Supabase records (website leads, quiz
// roadmaps, contact messages) into the Notion workspace.
//
// Schedule: every 6 hours (see supabase/config.toml).
// Trigger: either Supabase cron (x-supabase-intention header) or manual POST
//   with the shared DASHBOARD_API_KEY.
//
// Safety: gated by NOTION_LIVE_MODE. When "false" (default) this only logs what
// it WOULD write (dry-run). Set NOTION_LIVE_MODE=true to actually create pages.
// Dedup: before creating a Notion page it queries the target database for an
//   existing page with the same Email value and skips it (cross-run idempotency).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  NOTION_OS_DBS,
  buildNotionProperties,
  getNotionDbId,
  getNotionDedupTuple,
  getNotionPropType,
  mapAutomationRecordToNotion,
  mapNotionRecordToAutomation,
  normalizeNotionRecord,
  validateNotionRecord,
} from "../_shared/notion-architect.ts";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const env = (name: string, def = ""): string => (Deno.env.get(name) || def).trim();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://dashboard.digitallydefined.agency",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, apikey, Authorization",
};
const cors = (headers: object = {}) => ({ ...CORS_HEADERS, ...headers });

async function supabaseFetch(url: string, key: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// --- Direction A: Supabase → Notion (Automation OS writes) -------------
// Every Supabase row lands in the Automations Log DB via the architect mapper.
type PushSource = { table: string };

const PUSH_SOURCES: PushSource[] = [
  { table: "website_leads" },
  { table: "quiz_roadmaps" },
  { table: "contact_messages" },
];

// --- Direction B: Notion → Supabase (Notion OS reads) -----------------
// Architect keys + their Supabase mirror tables (migration 006).
type PullSource = { dbKey: string; table: string };

const PULL_SOURCES: PullSource[] = [
  { dbKey: "content", table: "notion_content_blocks" },
  { dbKey: "templates", table: "notion_templates" },
  { dbKey: "assets", table: "notion_assets" },
  { dbKey: "ideas", table: "notion_ideas" },
];

// --- Notion helpers (architect-driven) --------------------------------
const NOTION_API = "https://api.notion.com/v1";
const NOTION_HEADERS = () => ({
  Authorization: `Bearer ${env("NOTION_API_KEY")}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

/** Notion-side dedup: does a page already exist matching the dedup-key tuple? */
async function notionPageExists(dbId: string, dbKey: string, record: Record<string, unknown>): Promise<boolean> {
  const tuple = getNotionDedupTuple(dbKey, record);
  const keys = Object.keys(tuple || {});
  if (!dbId || keys.length === 0) return false;

  const filter = keys.length === 1
    ? { property: keys[0], [getNotionPropType(dbKey, keys[0]) || "rich_text"]: { equals: String(tuple![keys[0]]) } }
    : { and: keys.map((k) => ({ property: k, [getNotionPropType(dbKey, k) || "rich_text"]: { equals: String(tuple![k]) } })) };

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: NOTION_HEADERS(),
    body: JSON.stringify({ page_size: 1, filter }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion dedup query failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.results) && data.results.length > 0;
}

/** Create a Notion page from an architect-normalized record. */
async function notionCreatePage(dbId: string, dbKey: string, record: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: NOTION_HEADERS(),
    body: JSON.stringify({
      parent: { type: "database_id", database_id: dbId },
      properties: buildNotionProperties(dbKey, record),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion create page failed (${res.status}): ${t.slice(0, 200)}`);
  }
}

/** Upsert a Notion page row into its Supabase mirror (dedup on notion_page_id). */
async function upsertSupabaseMirror(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/${table}?on_conflict=notion_page_id`;
  const res = await supabaseFetch(url, serviceKey, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase mirror ${table}: ${res.status} ${t.slice(0, 200)}`);
  }
}

/**
 * Direction B worker: query a Notion OS DB, map each page through the
 * architect into its Supabase mirror row, and upsert (dedup on notion_page_id).
 * Returns the number of rows processed (mirrored or would-mirror).
 */
async function pullNotionToSupabase(opts: {
  supabaseUrl: string;
  serviceKey: string;
  table: string;
  dbKey: string;
  dbId: string;
  live: boolean;
}): Promise<number> {
  const { supabaseUrl, serviceKey, table, dbKey, dbId, live } = opts;

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: NOTION_HEADERS(),
    body: JSON.stringify({ page_size: 50, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion query ${dbKey} failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const pages: Record<string, any>[] = Array.isArray(data?.results) ? data.results : [];
  let processed = 0;

  // Supabase-side dedup: which page ids are already mirrored?
  const pageIds = pages.map((p) => String(p.id));
  const existing = new Set<string>();
  if (pageIds.length > 0) {
    const mirrorUrl = `${supabaseUrl}/rest/v1/${table}?select=notion_page_id&notion_page_id=in.(${encodeURIComponent(
      pageIds.join(",")
    )})`;
    const mirrorRes = await supabaseFetch(mirrorUrl, serviceKey);
    if (mirrorRes.ok) {
      const mirrorRows: { notion_page_id: string }[] = await mirrorRes.json();
      for (const r of mirrorRows) existing.add(r.notion_page_id);
    }
  }

  for (const page of pages) {
    // Architect: Notion page → canonical row shape (+ legacy property names).
    const mapped = mapNotionRecordToAutomation(dbKey, page);
    if (!mapped || !mapped.name) continue;
    if (existing.has(String(page.id))) continue; // already mirrored

    // Architect normalization → sync-safe column values.
    const normalized = normalizeNotionRecord(dbKey, {
      name: mapped.name,
      status: mapped.status,
      contentType: mapped.contentType,
      format: mapped.format,
      source: mapped.source,
      niche: mapped.niche,
      url: mapped.url,
      assetValue: mapped.assetValue,
      created: mapped.created,
    }) || {};

    const insertRow: Record<string, unknown> = {
      notion_page_id: page.id,
      name: normalized.Name,
      status: normalized.Status,
      content_type: normalized.ContentType,
      format: normalized.Format,
      source: normalized.Source,
      niche: normalized.Niche,
      url: normalized.URL,
      asset_value: normalized.AssetValue,
      created: normalized.Created,
    };

    if (live) {
      await upsertSupabaseMirror(supabaseUrl, serviceKey, table, insertRow);
    } else {
      console.log(`[notion-sync][dry-run] would mirror ${dbKey} page ${page.id} → ${table}`);
    }
    processed += 1;
  }
  return processed;
}

// --- Report shape -----------------------------------------------------
type SourceResult = {
  table: string;
  dbKey: string;
  dbId: string | null;
  scanned: number;
  created: number;
  skipped: number;
  dryRun: boolean;
  error?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors() });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth — Supabase cron sends x-supabase-intention; manual calls need the key.
  const isCron = req.headers.get("x-supabase-intention")?.startsWith("supabase.cron.");
  if (!isCron) {
    const provided = String(req.headers.get("x-api-key") || req.headers.get("apikey") || "").trim();
    const expected = env("DASHBOARD_API_KEY");
    if (expected && provided !== expected) return json({ error: "Unauthorized" }, 401, cors());
  }

  // Smoke tests can force dry-run so calling the endpoint never writes to
  // Notion, even if NOTION_LIVE_MODE=true in the deployed environment.
  let forcedDryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      forcedDryRun = body?.dryRun === true;
    } catch {
      // No JSON body (e.g. GET) — not forced.
    }
  }

  const supabaseUrl = env("SUPABASE_URL", "https://dijjlppdljpcgyoakdnq.supabase.co").replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const notionKey = env("NOTION_API_KEY");
  const live = !forcedDryRun && env("NOTION_LIVE_MODE").toLowerCase() === "true";

  if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500, cors());
  if (!notionKey) return json({ error: "NOTION_API_KEY is not configured" }, 500, cors());

  // Only scan records created within the sync window (default 7h to overlap the 6h cron).
  const windowMin = Number(env("NOTION_SYNC_WINDOW_MIN", "420")) || 420;
  const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();

  const report: {
    live: boolean;
    forcedDryRun: boolean;
    windowMinutes: number;
    since: string;
    push: SourceResult[];
    pull: SourceResult[];
  } = { live, forcedDryRun, windowMinutes: windowMin, since, push: [], pull: [] };

  // ---- Direction A: Supabase → Notion (Automations Log DB) ----------
  const automationsDbId = getNotionDbId("automations");
  for (const source of PUSH_SOURCES) {
    const entry: SourceResult = {
      table: source.table,
      dbKey: "automations",
      dbId: automationsDbId,
      scanned: 0,
      created: 0,
      skipped: 0,
      dryRun: !live,
    };
    try {
      if (!automationsDbId) throw new Error("NOTION_AUTOMATIONS_DB_ID is not configured");

      const url = `${supabaseUrl}/rest/v1/${source.table}?select=*&created_at=gt.${encodeURIComponent(
        since
      )}&order=created_at.desc`;
      const res = await supabaseFetch(url, serviceKey);
      if (!res.ok) throw new Error(`Supabase ${source.table}: ${res.status}`);
      const rows: Record<string, unknown>[] = await res.json();
      entry.scanned = Array.isArray(rows) ? rows.length : 0;

      for (const row of Array.isArray(rows) ? rows : []) {
        // Architect: map + normalize into the automations schema.
        const mapped = mapAutomationRecordToNotion(row);
        if (!mapped) continue;
        const validation = validateNotionRecord("automations", mapped);
        if (!validation.valid) {
          entry.skipped += 1;
          continue;
        }
        if (await notionPageExists(automationsDbId, "automations", mapped)) {
          entry.skipped += 1; // architect dedup tuple already synced
          continue;
        }
        if (live) {
          await notionCreatePage(automationsDbId, "automations", mapped);
        } else {
          console.log(`[notion-sync][dry-run] would create automations page for ${mapped.Name}`);
        }
        entry.created += 1;
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
    }
    report.push.push(entry);
  }

  // ---- Direction B: Notion → Supabase (content/templates/assets/ideas) ----
  for (const source of PULL_SOURCES) {
    const dbId = getNotionDbId(source.dbKey);
    const entry: SourceResult = {
      table: source.table,
      dbKey: source.dbKey,
      dbId,
      scanned: 0,
      created: 0,
      skipped: 0,
      dryRun: !live,
    };
    try {
      if (!dbId) {
        const names = [NOTION_OS_DBS[source.dbKey]?.envVar, ...(NOTION_OS_DBS[source.dbKey]?.envVarAliases || [])]
          .filter(Boolean).join(" or ");
        throw new Error(`${NOTION_OS_DBS[source.dbKey]?.label || source.dbKey} is not configured (set ${names})`);
      }
      entry.created = await pullNotionToSupabase({
        supabaseUrl,
        serviceKey,
        table: source.table,
        dbKey: source.dbKey,
        dbId,
        live,
      });
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
    }
    report.pull.push(entry);
  }

  return json({ ok: true, ...report }, 200, cors());
});