// src/services/antigravity.js - Notion Architect (Phase 21)
// All writes gated behind NOTION_LIVE_MODE + NOTION_PHASE21_LIVE_APPROVAL
import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';
import * as notion from './notion.js';

const NOTION_API_BASE = constants.NOTION_API_BASE;
const NOTION_VERSION = constants.NOTION_API_VERSION;

// ─── 8-core Notion OS database schemas (for reconcile) ─────────────────────
const STATUS_SYNONYMS = {
  live: 'Published', published: 'Published', on: 'Published', active: 'Published',
  draft: 'Draft', wip: 'Draft', idea: 'Draft', pending: 'Draft',
  paused: 'Paused', scheduled: 'Scheduled', archived: 'Archived',
  done: 'Done', complete: 'Done', completed: 'Done', failed: 'Failed', error: 'Failed',
};
const DATE_SYNONYMS = {
  month: 'Month', period: 'Period', created: 'Created', createdat: 'Created', created_at: 'Created', publishedat: 'Created',
};

const NOTION_OS_DBS = {
  assets: {
    key: 'assets', label: 'Digital Assets DB',
    envVar: 'NOTION_ASSETS_DB_ID', envVarAliases: ['NOTION_DIGITAL_ASSETS_DB_ID'],
    dedupKeys: ['Name', 'URL'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'URL', type: 'url', required: false },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Paused', 'Scheduled', 'Archived'], synonyms: STATUS_SYNONYMS },
      { name: 'Niche', type: 'rich_text', required: false, maxChars: 500 },
      { name: 'AssetValue', type: 'number', required: false },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  ideas: {
    key: 'ideas', label: 'Ideas & Intake DB',
    envVar: 'NOTION_IDEAS_DB_ID',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Archived'], synonyms: STATUS_SYNONYMS },
      { name: 'Source', type: 'rich_text', required: false, maxChars: 200 },
      { name: 'Niche', type: 'rich_text', required: false, maxChars: 500 },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  money: {
    key: 'money', label: 'Money Snapshot DB',
    envVar: 'NOTION_MONEY_DB_ID',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Month', type: 'date', required: false, synonyms: DATE_SYNONYMS },
      { name: 'Revenue', type: 'number', required: false },
      { name: 'Expenses', type: 'number', required: false },
      { name: 'Net', type: 'number', required: false },
      { name: 'Created', type: 'date', required: false, notionName: 'CreatedTime', readOnly: true, synonyms: DATE_SYNONYMS },
    ],
  },
  monthly: {
    key: 'monthly', label: 'Monthly Review DB',
    envVar: 'NOTION_MONTHLY_DB_ID',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Period', type: 'date', required: false, synonyms: DATE_SYNONYMS },
      { name: 'Wins', type: 'rich_text', required: false, maxChars: 2000 },
      { name: 'Risks', type: 'rich_text', required: false, maxChars: 2000 },
      { name: 'NextActions', type: 'rich_text', required: false, maxChars: 2000 },
      { name: 'Created', type: 'date', required: false, notionName: 'CreatedTime', readOnly: true, synonyms: DATE_SYNONYMS },
    ],
  },
  reputation: {
    key: 'reputation', label: 'Reputation Signals DB',
    envVar: 'NOTION_REPUTATION_DB_ID',
    dedupKeys: ['Name', 'URL'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'URL', type: 'url', required: false },
      { name: 'Signal', type: 'select', required: false, options: ['Positive', 'Neutral', 'Negative'] },
      { name: 'Score', type: 'number', required: false },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  content: {
    key: 'content', label: 'Content Blocks DB',
    envVar: 'NOTION_CONTENT_DB_ID',
    dedupKeys: ['Name', 'URL'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Scheduled', 'Archived'], synonyms: STATUS_SYNONYMS },
      { name: 'ContentType', type: 'select', required: false, options: ['Blog', 'Newsletter', 'Social', 'Video', 'Guide', 'Template'] },
      { name: 'Niche', type: 'rich_text', required: false, maxChars: 500 },
      { name: 'URL', type: 'url', required: false },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  automations: {
    key: 'automations', label: 'Automations Log DB',
    envVar: 'NOTION_AUTOMATIONS_DB_ID',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Done', 'Failed'], synonyms: STATUS_SYNONYMS },
      { name: 'Source', type: 'rich_text', required: false, maxChars: 200 },
      { name: 'Email', type: 'email', required: false },
      { name: 'Superpower', type: 'rich_text', required: false, maxChars: 100 },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  templates: {
    key: 'templates', label: 'Templates Library DB',
    envVar: 'NOTION_TEMPLATES_DB_ID',
    dedupKeys: ['Name', 'URL'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Archived'], synonyms: STATUS_SYNONYMS },
      { name: 'Format', type: 'select', required: false, options: ['PDF', 'Notion', 'Spreadsheet', 'Checklist', 'Playbook'] },
      { name: 'URL', type: 'url', required: false },
      { name: 'Niche', type: 'rich_text', required: false, maxChars: 500 },
      { name: 'Created', type: 'date', required: false, notionName: 'CreatedTime', readOnly: true, synonyms: DATE_SYNONYMS },
    ],
  },
  engagementLog: {
    key: 'engagementLog', label: 'Engagement Log DB',
    envVar: 'NOTION_DATABASE_ENGAGEMENT_LOG',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Platform', type: 'select', required: false, options: ['Facebook', 'Instagram', 'Threads', 'LinkedIn', 'TikTok', 'YouTube', 'Email'] },
      { name: 'Type', type: 'select', required: false, options: ['Like', 'Comment', 'Share', 'DM', 'Review', 'Mention'] },
      { name: 'Sentiment', type: 'select', required: false, options: ['Positive', 'Neutral', 'Negative'] },
      { name: 'Notes', type: 'rich_text', required: false, maxChars: 1000 },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  aiDrafts: {
    key: 'aiDrafts', label: 'AI Drafts DB',
    envVar: 'NOTION_DATABASE_AI_DRAFTS',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Review', 'Published', 'Archived'], synonyms: STATUS_SYNONYMS },
      { name: 'ContentType', type: 'select', required: false, options: ['Blog', 'Newsletter', 'Social', 'Video', 'Guide', 'Template'] },
      { name: 'Niche', type: 'rich_text', required: false, maxChars: 500 },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
  automationEvents: {
    key: 'automationEvents', label: 'Automation Events DB',
    envVar: 'AUTOMATION_EVENTSDB_ID',
    dedupKeys: ['Name', 'Created'],
    properties: [
      { name: 'Name', type: 'title', required: true, maxChars: 2000 },
      { name: 'Status', type: 'select', required: false, options: ['Draft', 'Published', 'Done', 'Failed'], synonyms: STATUS_SYNONYMS },
      { name: 'Source', type: 'rich_text', required: false, maxChars: 200 },
      { name: 'Email', type: 'email', required: false },
      { name: 'Superpower', type: 'rich_text', required: false, maxChars: 100 },
      { name: 'Created', type: 'date', required: false, synonyms: DATE_SYNONYMS },
    ],
  },
};

function getConfig() {
  return {
    apiKey: (process.env.ANTIGRAVITY_API_KEY || '').trim(),
    notionToken: (process.env.ANTIGRAVITY_NOTION_TOKEN || env.notion.apiKey || '').trim(),
    workspaceId: (process.env.ANTIGRAVITY_WORKSPACE_ID || '').trim(),
    liveMode: (process.env.NOTION_LIVE_MODE || 'false').trim().toLowerCase() === 'true',
    approval: (process.env.NOTION_PHASE21_LIVE_APPROVAL || 'false').trim().toLowerCase() === 'true',
  };
}

async function notionRest(path, method, body, timeoutMs = 30000) {
  const cfg = getConfig();
  const token = cfg.notionToken || env.notion.apiKey;
  if (!token) throw new Error('ANTIGRAVITY_NOTION_TOKEN (or NOTION_API_KEY) is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(NOTION_API_BASE + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Notion API error ' + res.status + ': ' + path);
    return data;
  } finally { clearTimeout(timer); }
}

async function mcpPost(path, body, timeoutMs = 30000) {
  const cfg = getConfig();
  const base = (process.env.ANTIGRAVITY_URL || 'https://mcp.notion.com').replace(/\/+$/, '');
  if (!cfg.apiKey) throw new Error('ANTIGRAVITY_API_KEY is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'MCP error ' + res.status + ': ' + path);
    return data;
  } finally { clearTimeout(timer); }
}

function ensureLiveMode() {
  const cfg = getConfig();
  if (!cfg.liveMode) { logger.warn('Antigravity write blocked - NOTION_LIVE_MODE=false'); return { dryRun: true, skipped: true, reason: 'NOTION_LIVE_MODE is not enabled' }; }
  if (!cfg.approval) { logger.warn('Antigravity write blocked - NOTION_PHASE21_LIVE_APPROVAL=false'); return { dryRun: true, skipped: true, reason: 'NOTION_PHASE21_LIVE_APPROVAL is not enabled' }; }
  return { dryRun: false, skipped: false };
}

/** Env-driven DB ID lookup matching the os-backend contract. */
function getNotionDbId(key) {
  const spec = NOTION_OS_DBS[key];
  if (!spec) return null;
  for (const name of [spec.envVar, ...(spec.envVarAliases || [])]) {
    const raw = process.env[name];
    if (raw && String(raw).trim()) return String(raw).trim();
  }
  if (env.notion.databases && env.notion.databases[key]) return env.notion.databases[key];
  return null;
}

/** Reverse-lookup: which architect DB key owns this databaseId? */
function resolveDbKeyForId(databaseId) {
  if (!databaseId) return null;
  const target = String(databaseId).trim();
  for (const key of Object.keys(NOTION_OS_DBS)) {
    if (getNotionDbId(key) === target) return key;
  }
  return null;
}

/** Get the writable (non-readOnly) property specs for a DB key. */
function getWritableNotionProps(dbKey) {
  const spec = NOTION_OS_DBS[dbKey];
  if (!spec) return [];
  return spec.properties.filter((p) => !p.readOnly);
}

/** Translate an architect property spec into a Notion "add property" payload. */
function propertyCreatePayload(prop) {
  const maxChars = prop.maxChars ?? 2000;
  switch (prop.type) {
    case 'title': return { title: {} };
    case 'rich_text': return { rich_text: {} };
    case 'email': return { email: {} };
    case 'url': return { url: {} };
    case 'number': return { number: { format: 'number' } };
    case 'date': return { date: {} };
    case 'select':
      return { select: { options: (Array.isArray(prop.options) ? prop.options : []).map((n) => ({ name: String(n) })) } };
    case 'multi_select':
      return { multi_select: { options: (Array.isArray(prop.options) ? prop.options : []).map((n) => ({ name: String(n) })) } };
    default: throw new Error('Unsupported architect property type: ' + prop.type);
  }
}

export async function handleReconcileDatabase(params) {
  const { databaseId, dbKey, diffOnly = false, verbose = false } = params || {};
  const targetDbKey = dbKey || resolveDbKeyForId(databaseId);
  if (!targetDbKey) throw new Error('dbKey or matching databaseId is required (must be one of: ' + Object.keys(NOTION_OS_DBS).join(', ') + ')');
  const spec = NOTION_OS_DBS[targetDbKey];
  if (!spec) throw new Error('Unknown architect DB key: ' + targetDbKey);
  const writableProps = getWritableNotionProps(targetDbKey);
  if (!writableProps.length) throw new Error('No writable properties on ' + spec.label);
  const resolvedId = databaseId || getNotionDbId(targetDbKey);
  if (!resolvedId) throw new Error(spec.label + ' has no Notion ID configured (check env var ' + spec.envVar + ')');
  const targetDb = await notion.queryDatabase(resolvedId, null, 1);
  const existing = (targetDb && targetDb.results && targetDb.results[0]) ? targetDb.results[0].properties : {};
  const diffs = [];
  for (const prop of writableProps) {
    const notionName = prop.notionName || prop.name;
    const current = existing[notionName];
    if (!current) {
      diffs.push({ name: notionName, type: prop.type, action: 'missing', severity: 'error' });
      continue;
    }
    const currentType = current.type || (current.title ? 'title' : current.rich_text ? 'rich_text' : current.number ? 'number' : current.select ? 'select' : current.multi_select ? 'multi_select' : current.url ? 'url' : current.date ? 'date' : current.email ? 'email' : 'unknown');
    if (prop.type !== currentType) {
      diffs.push({ name: notionName, expected: prop.type, actual: currentType, action: 'migrate', severity: 'warning' });
    }
    if (prop.type === 'select' && current.select) {
      const expected = new Set((prop.options || []).map((n) => String(n).toLowerCase()));
      const missingOpts = (current.select.options || [])
        .filter((o) => o && !expected.has(String(o.name).toLowerCase()))
        .map((o) => o.name);
      if (missingOpts.length) diffs.push({ name: notionName, action: 'add_options', severity: 'info', missingOptions: missingOpts });
    }
    if (prop.type === 'multi_select' && current.multi_select) {
      const expected = new Set((prop.options || []).map((n) => String(n).toLowerCase()));
      const missingOpts = (current.multi_select.options || [])
        .filter((o) => o && !expected.has(String(o.name).toLowerCase()))
        .map((o) => o.name);
      if (missingOpts.length) diffs.push({ name: notionName, action: 'add_options', severity: 'info', missingOptions: missingOpts });
    }
  }
  const result = { ok: true, dbKey: targetDbKey, label: spec.label, databaseId: resolvedId, totalDiffs: diffs.length, status: diffs.length === 0 ? 'conformant' : 'drifted', diffs };
  if (!diffOnly) {
    const patches = [];
    for (const diff of diffs) {
      try {
        const patchPayload = { properties: {} };
        if (diff.action === 'missing') {
          const payload = propertyCreatePayload(writableProps.find((p) => (p.notionName || p.name) === diff.name));
          patchPayload.properties[diff.name] = payload;
        } else if (diff.action === 'migrate') {
          const payload = propertyCreatePayload(writableProps.find((p) => (p.notionName || p.name) === diff.name));
          patchPayload.properties[diff.name] = payload;
        } else if (diff.action === 'add_options') {
          const prop = writableProps.find((p) => (p.notionName || p.name) === diff.name);
          if (prop) {
            const combined = [...new Set([...(prop.options || []), ...(diff.missingOptions || [])])];
            patchPayload.properties[diff.name] = propertyCreatePayload(prop);
          }
        }
        if (Object.keys(patchPayload.properties).length) {
          const patched = await notion.updateDatabase(resolvedId, patchPayload);
          patches.push({ name: diff.name, action: diff.action, ok: true });
          logger.info('Reconcile patch applied', { dbKey: targetDbKey, property: diff.name, action: diff.action });
        }
      } catch (err) {
        patches.push({ name: diff.name, action: diff.action, ok: false, error: err.message });
        logger.error('Reconcile patch failed', { dbKey: targetDbKey, property: diff.name, error: err.message });
      }
    }
    result.patches = patches;
    result.summary = { attempted: patches.length, succeeded: patches.filter((p) => p.ok).length, failed: patches.filter((p) => !p.ok).length };
  }
  return result;
}

export async function handlePatch(params) {
  const { databaseId, properties } = params || {};
  if (!databaseId) throw new Error('databaseId is required');
  if (!properties || typeof properties !== 'object' || Object.keys(properties).length === 0) throw new Error('properties object with at least one property is required');
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const result = await notion.updateDatabase(databaseId, { properties: normalizeProperties(properties) });
  logger.info('Database patched via Antigravity', { databaseId, keys: Object.keys(properties) });
  return { ok: true, databaseId, patchedProperties: Object.keys(properties) };
}

function normalizeProperties(props) {
  const n = {};
  for (const [key, def] of Object.entries(props)) {
    n[key] = typeof def === 'object' && def !== null && !Array.isArray(def) ? def : { title: {} };
  }
  return n;
}

const PHASE21_SCHEMAS = {
  gtd_inbox: { name: 'GTD Inbox', properties: { Task: { title: {} }, Area: { select: { options: [{name:'Business',color:'blue'},{name:'Health',color:'green'},{name:'Relationships',color:'orange'},{name:'Finance',color:'red'},{name:'Learning',color:'purple'}] }}, Status: { select: { options: [{name:'Inbox',color:'gray'},{name:'Next',color:'yellow'},{name:'Doing',color:'blue'},{name:'Done',color:'green'}] }}, DueDate: { date: {} }, Tags: { multi_select: { options: [{name:'Quick win',color:'green'},{name:'Big project',color:'blue'},{name:'Urgent',color:'red'}] } } } },
  projects: { name: 'Projects', properties: { Project: { title: {} }, Status: { select: { options: [{name:'Backlog',color:'gray'},{name:'Active',color:'yellow'},{name:'On Hold',color:'orange'},{name:'Completed',color:'green'},{name:'Archived',color:'brown'}] }}, Owner: { rich_text: {} }, Deadline: { date: {} }, RevenuePotential: { number: { format: 'dollar' } } } },
  areas: { name: 'Areas', properties: { Area: { title: {} }, Owner: { rich_text: {} }, CurrentFocus: { checkbox: {} } } },
  someday_maybe: { name: 'Someday / Maybe', properties: { Idea: { title: {} }, Status: { select: { options: [{name:'Maybe',color:'yellow'},{name:'Someday',color:'blue'},{name:'Archived',color:'gray'}] }}, Reviewed: { date: {} } } },
};

export async function handleStatus() {
  const cfg = getConfig();
  return {
    ok: true,
    config: { base: (process.env.ANTIGRAVITY_URL || 'https://mcp.notion.com').replace(/\/+$/, ''), workspaceId: cfg.workspaceId || null, hasApiKey: !!cfg.apiKey, hasNotionToken: !!cfg.notionToken, liveMode: cfg.liveMode, approvalMode: cfg.approval, notionApiKeySet: !!env.notion.apiKey },
    databases: { configured: Object.keys(env.notion.databases).filter(k => env.notion.databases[k]).length },
    dryRunNote: cfg.liveMode ? 'LIVE mode enabled' : 'DRY-RUN mode - no writes will be performed',
  };
}

export async function handleCreateDatabase(params) {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const { name, parentPageId, properties } = params;
  if (!name) throw new Error('name is required');
  const props = properties || (PHASE21_SCHEMAS[name.toLowerCase()]?.properties) || { name: { title: {} } };
  const parent = parentPageId ? { type: 'page_id', page_id: parentPageId } : { type: 'workspace', workspace: true };
  const result = await notion.createDatabase({ parent, title: [{ type: 'text', text: { content: name } }], properties: normalizeProperties(props) });
  logger.info('Database created via Antigravity', { name, databaseId: result.id });
  return { ok: true, databaseId: result.id, url: result.url, name };
}

export async function handleUpdateDatabase(params) {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const { databaseId, properties } = params;
  if (!databaseId) throw new Error('databaseId is required');
  if (!properties || typeof properties !== 'object') throw new Error('properties object is required');
  const result = await notion.updateDatabase(databaseId, { properties: normalizeProperties(properties) });
  logger.info('Database updated via Antigravity', { databaseId });
  return { ok: true, databaseId, updatedProperties: Object.keys(properties) };
}

export async function handleCreateNotionPage(params) {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const { databaseId, title, properties } = params;
  if (!databaseId) throw new Error('databaseId is required');
  if (!title) throw new Error('title is required');
  const props = { ...properties };
  if (!props.title) props.title = { title: [{ text: { content: title } }] };
  const result = await notion.createPage(databaseId, props, title);
  logger.info('Page created via Antigravity', { databaseId, pageId: result.id });
  return { ok: true, pageId: result.id, url: result.url, title };
}

export async function handleBuildTemplate(params) {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const { name, schema, parentPageId } = params;
  if (!name) throw new Error('name is required');
  const props = schema || { Name: { title: {} } };
  const parent = parentPageId ? { type: 'page_id', page_id: parentPageId } : { type: 'workspace', workspace: true };
  const result = await notion.createDatabase({ parent, title: [{ type: 'text', text: { content: name } }], properties: normalizeProperties(props) });
  return { ok: true, databaseId: result.id, url: result.url, name };
}

export async function handleRunAutomation(params) {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason, params };
  const { name, databaseId, input } = params;
  if (!name) throw new Error('name is required');
  try {
    const mcpResult = await mcpPost('/automations/run', { name, database_id: databaseId || null, workspace_id: getConfig().workspaceId || null, input: input || {} });
    logger.info('Automation ran via MCP', { name, databaseId });
    return { ok: true, mode: 'mcp', ...mcpResult };
  } catch (mcpErr) {
    logger.warn('MCP automation unavailable, falling back to Notion log', { name, error: mcpErr.message });
  }
  if (databaseId) {
    const page = await notion.createPage(databaseId, {}, 'Automation run: ' + name);
    return { ok: true, mode: 'notion-log', pageId: page.id, name };
  }
  return { ok: true, mode: 'noop', name, reason: 'No databaseId provided and MCP unavailable' };
}

export async function handlePhase21Rollout() {
  const guard = ensureLiveMode();
  if (guard.skipped) return { ok: true, dryRun: true, skipped: true, reason: guard.reason };
  const results = [];
  for (const [key, schema] of Object.entries(PHASE21_SCHEMAS)) {
    try {
      const existingId = env.notion.databases[key] || env.notion.databases[schema.name.toLowerCase()];
      if (existingId) {
        await notion.updateDatabase(existingId, { properties: normalizeProperties(schema.properties) });
        results.push({ phase: key, action: 'updated', databaseId: existingId, ok: true });
      } else {
        const created = await notion.createDatabase({ parent: { type: 'workspace', workspace: true }, title: [{ type: 'text', text: { content: schema.name } }], properties: normalizeProperties(schema.properties) });
        results.push({ phase: key, action: 'created', databaseId: created.id, url: created.url, ok: true });
      }
    } catch (err) {
      results.push({ phase: key, action: 'failed', error: err.message, ok: false });
    }
  }
  return { ok: true, dryRun: false, phases: results, summary: { created: results.filter(r => r.action === 'created').length, updated: results.filter(r => r.action === 'updated').length, failed: results.filter(r => !r.ok).length } };
}

export async function handleQueryDatabase(params) {
  const { databaseId, filter, limit = 20 } = params;
  if (!databaseId) throw new Error('databaseId is required');
  const result = await notion.queryDatabase(databaseId, filter, limit);
  return { ok: true, ...result };
}

export async function handleGetPage(params) {
  const { pageId } = params;
  if (!pageId) throw new Error('pageId is required');
  const result = await notion.getPage(pageId);
  return { ok: true, ...result };
}

export async function handleAntigravity(req, res) {
  const body = req.body || {};
  const action = body.action || '';
  const params = { ...body };
  delete params.action;
  try {
    let result;
    switch (action) {
      case 'status': result = await handleStatus(); break;
      case 'createDatabase': result = await handleCreateDatabase(params); break;
      case 'updateDatabase': result = await handleUpdateDatabase(params); break;
      case 'createNotionPage': result = await handleCreateNotionPage(params); break;
      case 'buildTemplate': result = await handleBuildTemplate(params); break;
      case 'runAutomation': result = await handleRunAutomation(params); break;
      case 'phase21.rollout': result = await handlePhase21Rollout(); break;
      case 'queryDatabase': result = await handleQueryDatabase(params); break;
      case 'getPage': result = await handleGetPage(params); break;
      case 'reconcileDatabase': result = await handleReconcileDatabase(params); break;
      case 'patch': result = await handlePatch(params); break;
      default: return res.status(400).json({ ok: false, error: 'Unknown Antigravity action: ' + action + '. Available: status, createDatabase, updateDatabase, createNotionPage, buildTemplate, runAutomation, phase21.rollout, queryDatabase, getPage, reconcileDatabase, patch' });
    }
    return res.status(200).json({ ok: true, action, result });
  } catch (error) {
    logger.error('Antigravity action failed', { action, error: error.message });
    return res.status(500).json({ ok: false, action, error: error.message, params });
  }
}

export function isAntigravityConfigured() {
  const cfg = getConfig();
  return !!(cfg.notionToken && cfg.liveMode);
}

export default { handleAntigravity, handleStatus, handleCreateDatabase, handleUpdateDatabase, handleCreateNotionPage, handleBuildTemplate, handleRunAutomation, handlePhase21Rollout, handleQueryDatabase, handleGetPage, handleReconcileDatabase, handlePatch, isAntigravityConfigured };
