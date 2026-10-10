// _shared/notion-architect.ts
// NOTION ARCHITECT — single contract for every Notion OS ↔ Automation OS write.
//
// Restores the DD Notion OS Sync cron's 8-database mapping as one authoritative
// schema map consumed by:
//   - supabase/functions/notion-sync (bidirectional cron)
//   - supabase/functions/hermes (agent outputs)
//   - fastapi/app/notion_architect.py (Python mirror for the microservice layer)
//
// Dry-run safe: pure functions + env reads; it NEVER performs I/O itself.
//
// Env (DB IDs — all optional; a DB without an ID is skipped by callers):
//   NOTION_ASSETS_DB_ID       → Digital Assets DB
//   NOTION_IDEAS_DB_ID        → Ideas & Intake DB
//   NOTION_MONEY_DB_ID        → Money Snapshot DB
//   NOTION_MONTHLY_DB_ID      → Monthly Review DB
//   NOTION_REPUTATION_DB_ID   → Reputation Signals DB
//   NOTION_CONTENT_DB_ID      → Content Blocks DB
//   NOTION_AUTOMATIONS_DB_ID  → Automations Log DB
//   NOTION_TEMPLATES_DB_ID    → Templates Library DB

export type NotionPropType =
  | "title"
  | "rich_text"
  | "select"
  | "multi_select"
  | "email"
  | "url"
  | "number"
  | "date";

export type NotionPropSpec = {
  name: string;
  type: NotionPropType;
  required: boolean;
  /** Canonical select options (normalization maps synonyms into these). */
  options?: string[];
  /** Synonyms → canonical option (lowercased keys). */
  synonyms?: Record<string, string>;
  /** Hard cap for rich_text content (Notion limit is 2000). */
  maxChars?: number;
  /**
   * Legacy/old Notion property name. Accepted on input during transition
   * after a rename run. When set alongside `name`, it keeps old stored
   * data readable while new writes target the canonical name.
   */
  legacyNames?: string[];
  /**
   * Notion-generated field (e.g. created_time). Readable, never written —
   * the Notion API rejects writes to these.
   */
  readOnly?: boolean;
};

export type NotionDbSpec = {
  /** Architect key (sync-safe, used by callers). */
  key: string;
  /** Human name from the original Notion OS. */
  label: string;
  envVar: string;
  /**
   * Fallback env var names. Lets the contract and a deployed environment
   * disagree on the variable name without silently resolving to null.
   */
  envVarAliases?: string[];
  /** Canonical dedup keys (queried/skipped by notion-sync). */
  dedupKeys: string[];
  properties: NotionPropSpec[];
};

const STATUS_SYNONYMS: Record<string, string> = {
  live: "Published",
  published: "Published",
  on: "Published",
  active: "Published",
  draft: "Draft",
  wip: "Draft",
  idea: "Draft",
  pending: "Draft",
  paused: "Paused",
  scheduled: "Scheduled",
  archived: "Archived",
  done: "Done",
  complete: "Done",
  completed: "Done",
  failed: "Failed",
  error: "Failed",
};

const DATE_SYNONYMS: Record<string, string> = {
  month: "Month",
  period: "Period",
  created: "Created",
  createdat: "Created",
  created_at: "Created",
  publishedat: "Created",
};

// -------------------------------
// The 8 core Notion OS databases
// -------------------------------
export const NOTION_OS_DBS: Record<string, NotionDbSpec> = {
  assets: {
    key: "assets",
    label: "Digital Assets DB",
    envVar: "NOTION_ASSETS_DB_ID",
    // The deployed .env uses NOTION_DIGITAL_ASSETS_DB_ID. Accept both so the
    // contract and the environment agree without renaming either side.
    envVarAliases: ["NOTION_DIGITAL_ASSETS_DB_ID"],
    dedupKeys: ["Name", "URL"],
    properties: [
      { name: "Name", type: "title", required: true, maxChars: 2000 },
      { name: "URL", type: "url", required: false },
      { name: "Status", type: "select", required: false, options: ["Draft", "Published", "Paused", "Scheduled", "Archived"], synonyms: STATUS_SYNONYMS },
      { name: "Niche", type: "rich_text", required: false, maxChars: 500 },
      { name: "AssetValue", type: "number", required: false },
      { name: "Created", type: "date", required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  ideas: {
    key: "ideas",
    label: "Ideas & Intake DB",
    envVar: "NOTION_IDEAS_DB_ID",
    dedupKeys: ["Name", "Created"],
    properties: [
      { name: "Name", type: "title", required: true, maxChars: 2000 },
      { name: "Status", type: "select", required: false, options: ["Draft", "Published", "Archived"], synonyms: STATUS_SYNONYMS },
      { name: "Source", type: "rich_text", required: false, maxChars: 200 },
      { name: "Niche", type: "rich_text", required: false, maxChars: 500 },
      { name: "Created", type: "date", required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  money: {
    key: "money",
    label: "Money Snapshot DB",
    envVar: "NOTION_MONEY_DB_ID",
    dedupKeys: ["Name", "Created"],
    properties: [
      // Rename plan: live title "Month" → canonical "Name".
      // legacyNames keeps old inputs readable during the transition.
      { name: "Name", type: "title", required: true, maxChars: 2000, legacyNames: ["Month"] },
      { name: "Month", type: "date", required: false, synonyms: DATE_SYNONYMS },
      { name: "Revenue", type: "number", required: false },
      { name: "Expenses", type: "number", required: false },
      { name: "Net", type: "number", required: false },
      // Auto-generated by Notion; readable, never written.
      { name: "Created", type: "date", required: false, legacyNames: ["CreatedTime"], readOnly: true, synonyms: DATE_SYNONYMS },
    ],
  },
  monthly: {
    key: "monthly",
    label: "Monthly Review DB",
    envVar: "NOTION_MONTHLY_DB_ID",
    dedupKeys: ["Name", "Created"],
    properties: [
      // Rename plan: live title "Month" → "Name"; "Key Wins" → "Wins".
      { name: "Name", type: "title", required: true, maxChars: 2000, legacyNames: ["Month"] },
      { name: "Period", type: "date", required: false, synonyms: DATE_SYNONYMS },
      { name: "Wins", type: "rich_text", required: false, maxChars: 2000, legacyNames: ["Key Wins"] },
      { name: "Risks", type: "rich_text", required: false, maxChars: 2000 },
      { name: "NextActions", type: "rich_text", required: false, maxChars: 2000 },
      { name: "Created", type: "date", required: false, legacyNames: ["CreatedTime"], readOnly: true, synonyms: DATE_SYNONYMS },
    ],
  },
  reputation: {
    key: "reputation",
    label: "Reputation Signals DB",
    envVar: "NOTION_REPUTATION_DB_ID",
    dedupKeys: ["Name", "URL"],
    properties: [
      { name: "Name", type: "title", required: true, maxChars: 2000 },
      { name: "URL", type: "url", required: false },
      // Rename plan: "Sentiment" → "Signal".
      { name: "Signal", type: "select", required: false, legacyNames: ["Sentiment"], options: ["Positive", "Neutral", "Negative"] },
      // Rename plan: "Sentiment Score" → "Score".
      { name: "Score", type: "number", required: false, legacyNames: ["Sentiment Score"] },
      // Rename plan: "Date" → "Created" (writable date).
      { name: "Created", type: "date", required: false, legacyNames: ["Date"], synonyms: DATE_SYNONYMS },
    ],
  },
  content: {
    key: "content",
    label: "Content Blocks DB",
    envVar: "NOTION_CONTENT_DB_ID",
    dedupKeys: ["Name", "URL"],
    properties: [
      { name: "Name", type: "title", required: true, maxChars: 2000 },
      { name: "Status", type: "select", required: false, options: ["Draft", "Published", "Scheduled", "Archived"], synonyms: STATUS_SYNONYMS },
      { name: "ContentType", type: "select", required: false, options: ["Blog", "Newsletter", "Social", "Video", "Guide", "Template"] },
      { name: "Niche", type: "rich_text", required: false, maxChars: 500 },
      { name: "URL", type: "url", required: false },
      { name: "Created", type: "date", required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  automations: {
    key: "automations",
    label: "Automations Log DB",
    envVar: "NOTION_AUTOMATIONS_DB_ID",
    dedupKeys: ["Name", "Created"],
    properties: [
      { name: "Name", type: "title", required: true, maxChars: 2000 },
      { name: "Status", type: "select", required: false, options: ["Draft", "Published", "Done", "Failed"], synonyms: STATUS_SYNONYMS },
      { name: "Source", type: "rich_text", required: false, maxChars: 200 },
      { name: "Email", type: "email", required: false },
      { name: "Superpower", type: "rich_text", required: false, maxChars: 100 },
      { name: "Created", type: "date", required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  templates: {
    key: "templates",
    label: "Templates Library DB",
    envVar: "NOTION_TEMPLATES_DB_ID",
    dedupKeys: ["Name", "URL"],
    properties: [
      // Rename plan: live title "Template Name" → canonical "Name".
      { name: "Name", type: "title", required: true, maxChars: 2000, legacyNames: ["Template Name"] },
      { name: "Status", type: "select", required: false, options: ["Draft", "Published", "Archived"], synonyms: STATUS_SYNONYMS },
      // Rename plan: "Type" → "Format".
      { name: "Format", type: "select", required: false, legacyNames: ["Type"], options: ["PDF", "Notion", "Spreadsheet", "Checklist", "Playbook"] },
      { name: "URL", type: "url", required: false },
      { name: "Niche", type: "rich_text", required: false, maxChars: 500 },
      { name: "Created", type: "date", required: false, synonyms: DATE_SYNONYMS },
    ],
  },
};

/** Env-driven DB IDs. A DB whose env var is empty resolves to null (skipped). */
export function getNotionDbId(key: string): string | null {
  const spec = NOTION_OS_DBS[key];
  if (!spec) return null;
  // Accept the canonical env var first, then any documented aliases so a
  // deployed environment can disagree on the name without silently skipping
  // the database.
  for (const name of [spec.envVar, ...(spec.envVarAliases ?? [])]) {
    const value = (Deno.env.get(name) || "").trim();
    if (value) return value;
  }
  return null;
}

/** The canonical architect property name. Returns the `name` field. */
export function notionPropName(prop: NotionPropSpec): string {
  return prop.name;
}

/**
 * Legacy property names accepted on input during/after a rename transition.
 * Returns both old notionName (pre-rerename) and explicit legacyNames.
 */
export function legacyPropNames(prop: NotionPropSpec): string[] {
  const out: string[] = [];
  if (prop.legacyNames) {
    for (const n of prop.legacyNames) {
      if (n && n !== prop.name && !out.includes(n)) out.push(n);
    }
  }
  return out;
}

/**
 * Resolve an architect property name (e.g. "Name", "Signal") to the name the
 * property actually carries in the live Notion database (e.g. "Month",
 * "Sentiment"). Returns null for an unknown DB/property.
 */
export function getNotionPropName(dbKey: string, propName: string): string | null {
  const spec = NOTION_OS_DBS[dbKey];
  const prop = spec?.properties.find((p) => p.name === propName);
  return prop ? notionPropName(prop) : null;
}

/** The DB's title property: architect name + live Notion name. */
export function getNotionTitleProp(dbKey: string): { architectName: string; notionName: string; readOnly: boolean } | null {
  const spec = NOTION_OS_DBS[dbKey];
  const prop = spec?.properties.find((p) => p.type === "title");
  return prop
    ? { architectName: prop.name, notionName: notionPropName(prop), readOnly: !!prop.readOnly }
    : null;
}

/**
 * Properties the Architect may write. Excludes read-only fields such as
 * Notion's auto-generated created_time, which the API rejects on write.
 */
export function getWritableNotionProps(dbKey: string): NotionPropSpec[] {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return [];
  return spec.properties.filter((p) => !p.readOnly);
}

export function listNotionDbIds(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of Object.keys(NOTION_OS_DBS)) out[key] = getNotionDbId(key);
  return out;
}

// -------------------------------
// Unified schema map
// -------------------------------
export type SchemaMapEntry = {
  key: string;
  label: string;
  envVar: string;
  dbId: string | null;
  dedupKeys: string[];
  syncSafeKeys: string[];
  properties: NotionPropSpec[];
};

/** Unified schema map for all 8 DBs (with env-resolved IDs). */
export function getNotionSchemaMap(): Record<string, SchemaMapEntry> {
  const out: Record<string, SchemaMapEntry> = {};
  for (const [key, spec] of Object.entries(NOTION_OS_DBS)) {
    out[key] = {
      key: spec.key,
      label: spec.label,
      envVar: spec.envVar,
      dbId: getNotionDbId(key),
      dedupKeys: spec.dedupKeys.map((k) => getNotionPropName(key, k) || k),
      syncSafeKeys: spec.properties.map((p) => notionPropName(p)),
      properties: spec.properties,
    };
  }
  return out;
}

// -------------------------------
// Validation
// -------------------------------
export type ValidationResult = { valid: boolean; error: string | null; missing: string[] };

/**
 * Validate an already-normalized record against a DB spec.
 * Missing required props → invalid; unknown props are ignored (dropped later).
 */
export function validateNotionRecord(dbKey: string, record: Record<string, unknown>): ValidationResult {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return { valid: false, error: `Unknown architect DB key: ${dbKey}`, missing: [] };

  const missing: string[] = [];
  for (const prop of spec.properties) {
    if (!prop.required) continue;
    // Read-only properties are Notion-generated; they can never be "missing".
    if (prop.readOnly) continue;
    const value = record[prop.name];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      missing.push(prop.name);
    }
  }
  if (missing.length > 0) {
    return { valid: false, error: `${spec.label}: missing required ${missing.join(", ")}`, missing };
  }
  return { valid: true, error: null, missing: [] };
}

// -------------------------------
// Normalization
// -------------------------------
/** Trim + cap text content per spec. */
function normalizeText(value: unknown, maxChars: number): string {
  const text = value == null ? "" : String(value).trim();
  return text.slice(0, maxChars);
}

/**
 * Normalize an arbitrary input record into the DB's sync-safe field names:
 * emails lowercased, selects canonicalized via synonym table, numbers coerced
 * (dropped when non-numeric), dates → ISO 8601, rich_text truncated per spec.
 */
export function normalizeNotionRecord(dbKey: string, input: Record<string, unknown>): Record<string, unknown> | null {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return null;

  const out: Record<string, unknown> = {};
  const matches = (k: string, target: string) =>
    k.replace(/[\s_]/g, "").toLowerCase() === target.replace(/[\s_]/g, "").toLowerCase();

  for (const prop of spec.properties) {
    // Read-only (Notion-generated) properties are never part of a write.
    if (prop.readOnly) continue;
    // Case/space-insensitive lookup so legacy field names still map in, plus
    // the live Notion name so DB-wins aliases are accepted too.
    const candidates = [prop.name, ...legacyPropNames(prop)];
    let found: string | undefined;
    for (const candidate of candidates) {
      found = Object.keys(input).find((k) => matches(k, candidate));
      if (found !== undefined) break;
    }
    const raw = found !== undefined ? input[found] : undefined;
    if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) continue;

    switch (prop.type) {
      case "title":
      case "rich_text":
        out[prop.name] = normalizeText(raw, prop.maxChars ?? 2000);
        break;
      case "email":
        out[prop.name] = normalizeText(raw, 320).toLowerCase();
        break;
      case "url":
        out[prop.name] = normalizeText(raw, 2000);
        break;
      case "select": {
        const text = normalizeText(raw, 100);
        const synonym = prop.synonyms?.[text.replace(/[\s_]/g, "").toLowerCase()];
        out[prop.name] = synonym || text;
        break;
      }
      case "multi_select": {
        const list = Array.isArray(raw) ? raw : String(raw).split(",");
        out[prop.name] = list.map((v) => normalizeText(v, 100)).filter(Boolean).slice(0, 50);
        break;
      }
      case "number": {
        const num = Number(raw);
        if (Number.isFinite(num)) out[prop.name] = num;
        break;
      }
      case "date": {
        const synonym = prop.synonyms?.[normalizeText(raw, 40).replace(/[\s_]/g, "").toLowerCase()];
        if (synonym) { out[prop.name] = synonym; break; }
        const parsed = new Date(raw as string);
        out[prop.name] = Number.isNaN(parsed.getTime())
          ? normalizeText(raw, 60)
          : parsed.toISOString();
        break;
      }
    }
  }

  // Title fallback: synthesize a title when the caller supplied none. The title
  // property is resolved per-DB (it may not be called "Name").
  const titleProp = spec.properties.find((p) => p.type === "title");
  if (titleProp && !out[titleProp.name]) {
    const fallback = input.email || input.url || input.source || input.id;
    if (fallback) out[titleProp.name] = normalizeText(fallback, titleProp.maxChars ?? 2000);
  }
  return out;
}

// -------------------------------
// Dedup keys
// -------------------------------
/** Extract the dedup-key tuple for a DB (used by notion-sync to skip duplicates). */
export function getNotionDedupTuple(dbKey: string, record: Record<string, unknown>): Record<string, unknown> | null {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return null;
  const tuple: Record<string, unknown> = {};
  for (const key of spec.dedupKeys) {
    if (record[key] === undefined) continue;
    // Key the tuple by the live Notion property name so callers can use it
    // directly as a Notion query filter.
    tuple[getNotionPropName(dbKey, key) || key] = record[key];
  }
  return tuple;
}

// -------------------------------
// Property payload builder (pure — no I/O)
// -------------------------------
/**
 * Turn an architect-normalized record into a Notion `properties` payload.
 * Pure: callers perform the fetch themselves (notion-sync, hermes, FastAPI).
 */
export function buildNotionProperties(dbKey: string, record: Record<string, unknown>): Record<string, unknown> {
  const spec = NOTION_OS_DBS[dbKey];
  const props: Record<string, unknown> = {};
  if (!spec) return props;

  for (const prop of spec.properties) {
    // Never emit read-only fields (Notion rejects writes to created_time etc.).
    if (prop.readOnly) continue;
    const value = record[prop.name];
    if (value === undefined || value === null || value === "") continue;

    // Payload keys must be the LIVE Notion property names (DB-wins mapping),
    // not the architect's logical names.
    const key = notionPropName(prop);

    switch (prop.type) {
      case "title":
        props[key] = { title: [{ text: { content: String(value).slice(0, prop.maxChars ?? 2000) } }] };
        break;
      case "rich_text":
        props[key] = { rich_text: [{ text: { content: String(value).slice(0, prop.maxChars ?? 2000) } }] };
        break;
      case "email":
        props[key] = { email: String(value) };
        break;
      case "url":
        props[key] = { url: String(value) };
        break;
      case "number":
        if (typeof value === "number" && Number.isFinite(value)) props[key] = { number: value };
        break;
      case "date":
        props[key] = { date: { start: String(value) } };
        break;
      case "select":
        if (typeof value === "string" && value) props[key] = { select: { name: value } };
        break;
      case "multi_select":
        if (Array.isArray(value)) props[key] = { multi_select: value.map((n) => ({ name: String(n) })) };
        break;
    }
  }
  return props;
}

// -------------------------------
// Property type lookup (for dedup filters)
// -------------------------------
/** Look up the architect type for a property name (architect or legacy name). */
export function getNotionPropType(dbKey: string, propName: string): string | null {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return null;
  const byArchitect = spec.properties.find((p) => p.name === propName);
  if (byArchitect) return byArchitect.type;
  // Legacy names (pre-rerename Notion property names) still resolve here.
  const byLegacy = spec.properties.find((p) => legacyPropNames(p).includes(propName));
  return byLegacy?.type ?? null;
}

// -------------------------------
// Supabase → Notion (Automation OS writes)
// -------------------------------
/** Map a Supabase row (leads/quiz/contact/automation-log) into the Automations Log DB. */
export function mapAutomationRecordToNotion(row: Record<string, unknown>): Record<string, unknown> | null {
  const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  return normalizeNotionRecord("automations", {
    name: row.email || row.name || row.id,
    email: row.email,
    source: row.source,
    superpower: row.superpower ?? metadata.superpower,
    status: metadata.status || "Done",
    created: row.created_at,
  });
}

// -------------------------------
// Notion → Supabase (Notion OS reads)
// -------------------------------
/**
 * Map a Notion page (content/templates/assets/ideas/money/monthly/reputation)
 * into a Supabase row shape. Reads canonical property names + common legacy
 * names, so partial databases still round-trip.
 */
export function mapNotionRecordToAutomation(
  dbKey: string,
  page: Record<string, any>
): Record<string, unknown> | null {
  const props = (page && page.properties) || {};
  if (!NOTION_OS_DBS[dbKey]) return null;

  // Reads come off a live Notion page, so every architect property name must be
  // translated to the name the property actually carries in that database.
  const nName = (architectName: string) => getNotionPropName(dbKey, architectName) || architectName;

  const readTitle = (name: string): string => {
    const prop = props[nName(name)] || {};
    const list = prop.title || [];
    return Array.isArray(list) && list[0]?.plain_text ? String(list[0].plain_text).trim() : "";
  };
  const readText = (name: string): string => {
    const prop = props[nName(name)] || {};
    const list = prop.rich_text || [];
    return Array.isArray(list) && list[0]?.plain_text ? String(list[0].plain_text).trim() : "";
  };
  const readSelect = (name: string): string => {
    const prop = props[nName(name)] || {};
    return prop.select?.name ? String(prop.select.name).trim() : "";
  };
  const readUrl = (name: string): string => {
    const prop = props[nName(name)] || {};
    return prop.url ? String(prop.url).trim() : "";
  };
  const readNumber = (name: string): number | null => {
    const prop = props[nName(name)] || {};
    return typeof prop.number === "number" ? prop.number : null;
  };
  const readDate = (name: string): string | null => {
    const date = props[nName(name)]?.date?.start
      || props[nName("Created")]?.date?.start
      || props.Created?.date?.start
      || page.created_time;
    return date ? String(date).trim() : null;
  };

  const base = {
    notionPageId: page.id,
    name: readTitle("Name"),
    status: readSelect("Status"),
    niche: readText("Niche"),
    url: readUrl("URL"),
    created: readDate("Created"),
  };

  switch (dbKey) {
    case "content":
      return { ...base, contentType: readSelect("ContentType") };
    case "templates":
      return { ...base, format: readSelect("Format") };
    case "assets":
      return { ...base, assetValue: readNumber("AssetValue") };
    case "ideas":
      return { ...base, source: readText("Source") };
    case "money":
      return {
        notionPageId: page.id,
        name: readTitle("Name"),
        month: readDate("Month"),
        revenue: readNumber("Revenue"),
        expenses: readNumber("Expenses"),
        net: readNumber("Net"),
        created: readDate("Created"),
      };
    case "monthly":
      return {
        notionPageId: page.id,
        name: readTitle("Name"),
        period: readDate("Period"),
        wins: readText("Wins"),
        risks: readText("Risks"),
        nextActions: readText("NextActions"),
        created: readDate("Created"),
      };
    case "reputation":
      return {
        notionPageId: page.id,
        name: readTitle("Name"),
        url: readUrl("URL"),
        signal: readSelect("Signal"),
        score: readNumber("Score"),
        created: readDate("Created"),
      };
    default:
      return base;
  }
}