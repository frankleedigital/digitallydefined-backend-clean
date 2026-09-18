// src/services/antigravity.js - Notion Architect (Phase 21)
// All writes gated behind NOTION_LIVE_MODE + NOTION_PHASE21_LIVE_APPROVAL
import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';
import * as notion from './notion.js';

const NOTION_API_BASE = constants.NOTION_API_BASE;
const NOTION_VERSION = constants.NOTION_API_VERSION;

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

const PHASE21_SCHEMAS = {
  gtd_inbox: { name: 'GTD Inbox', properties: { Task: { title: {} }, Area: { select: { options: [{name:'Business',color:'blue'},{name:'Health',color:'green'},{name:'Relationships',color:'orange'},{name:'Finance',color:'red'},{name:'Learning',color:'purple'}] }}, Status: { select: { options: [{name:'Inbox',color:'gray'},{name:'Next',color:'yellow'},{name:'Doing',color:'blue'},{name:'Done',color:'green'}] }}, DueDate: { date: {} }, Tags: { multi_select: { options: [{name:'Quick win',color:'green'},{name:'Big project',color:'blue'},{name:'Urgent',color:'red'}] } } } },
  projects: { name: 'Projects', properties: { Project: { title: {} }, Status: { select: { options: [{name:'Backlog',color:'gray'},{name:'Active',color:'yellow'},{name:'On Hold',color:'orange'},{name:'Completed',color:'green'},{name:'Archived',color:'brown'}] }}, Owner: { rich_text: {} }, Deadline: { date: {} }, RevenuePotential: { number: { format: 'dollar' } } } },
  areas: { name: 'Areas', properties: { Area: { title: {} }, Owner: { rich_text: {} }, CurrentFocus: { checkbox: {} } } },
  someday_maybe: { name: 'Someday / Maybe', properties: { Idea: { title: {} }, Status: { select: { options: [{name:'Maybe',color:'yellow'},{name:'Someday',color:'blue'},{name:'Archived',color:'gray'}] }}, Reviewed: { date: {} } } },
};

function normalizeProperties(props) {
  const n = {};
  for (const [key, def] of Object.entries(props)) {
    n[key] = typeof def === 'object' && def !== null && !Array.isArray(def) ? def : { title: {} };
  }
  return n;
}

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
      default: return res.status(400).json({ ok: false, error: 'Unknown Antigravity action: ' + action + '. Available: status, createDatabase, updateDatabase, createNotionPage, buildTemplate, runAutomation, phase21.rollout, queryDatabase, getPage' });
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

export default { handleAntigravity, handleStatus, handleCreateDatabase, handleUpdateDatabase, handleCreateNotionPage, handleBuildTemplate, handleRunAutomation, handlePhase21Rollout, handleQueryDatabase, handleGetPage, isAntigravityConfigured };
