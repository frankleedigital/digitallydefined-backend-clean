// src/services/notion.js - Notion Integration Service
import env from '../config/env.js';
import constants from '../config/constants.js';
import logger from '../utils/logger.js';

const NOTION_API_BASE = constants.NOTION_API_BASE;
const NOTION_VERSION = constants.NOTION_API_VERSION;

function getToken() { return env.notion.apiKey; }
export function isNotionConfigured() { return !!(getToken()); }

async function notionRequest(path, method = 'GET', body = null, timeoutMs = constants.FETCH_TIMEOUT_MS) {
  const token = getToken();
  if (!token) throw new Error('NOTION_API_KEY is not configured');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(NOTION_API_BASE + path, { method, headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    if (!response.ok) { const errorText = await response.text().catch(() => ''); throw new Error('Notion API error (' + response.status + '): ' + errorText.slice(0, 500)); }
    return await response.json();
  } catch (error) { if (error.name === 'AbortError') throw new Error('Notion API request timed out'); throw error; } finally { clearTimeout(timeoutId); }
}

export async function createDatabase(payload) { if (!payload) throw new Error('Database payload is required'); const result = await notionRequest('/databases', 'POST', payload); logger.info('Database created', { databaseId: result.id }); return result; }
export async function updateDatabase(databaseId, payload) { if (!databaseId) throw new Error('databaseId is required'); return notionRequest('/databases/' + databaseId, 'PATCH', payload); }
export async function queryDatabase(databaseId, filter = null, limit = 100) { if (!databaseId) throw new Error('databaseId is required'); const payload = { page_size: Math.min(limit, 100) }; if (filter && typeof filter === 'object') payload.filter = filter; return notionRequest('/databases/' + databaseId + '/query', 'POST', payload); }
export async function getPage(pageId) { if (!pageId) throw new Error('pageId is required'); return notionRequest('/pages/' + pageId, 'GET'); }
export async function createPage(databaseId, properties = {}, title = null) { if (!databaseId) throw new Error('databaseId is required'); const payload = { parent: { database_id: databaseId }, properties: Object.assign({}, properties) }; if (title) payload.properties.title = [{ text: { content: title } }]; return notionRequest('/pages', 'POST', payload); }
export async function updatePage(pageId, properties) { if (!pageId) throw new Error('pageId is required'); return notionRequest('/pages/' + pageId, 'PATCH', { properties: properties }); }
export async function appendBlock(pageId, text) { if (!pageId) throw new Error('pageId is required'); if (!text) throw new Error('text is required'); return notionRequest('/blocks/' + pageId + '/children', 'POST', { children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } }] }); }

export function getNotionStatus() { return { configured: !!env.notion.apiKey, hasDatabaseId: !!env.notion.databases.ideas, databaseId: env.notion.databases.ideas || null, apiKeySet: !!env.notion.apiKey, liveMode: env.notion.liveMode || false, webhookSecret: !!env.notion.webhookSecret }; }

export const propertyTypes = { title: () => ({ title: {} }), richText: () => ({ rich_text: {} }), number: (f = 'number') => ({ number: { format: f } }), select: (opts = []) => ({ select: { options: opts.map(o => ({ name: o, color: 'default' })) } }), multiSelect: (opts = []) => ({ multi_select: { options: opts.map(o => ({ name: o, color: 'default' })) } }), status: (opts = []) => ({ status: { options: opts.map(o => ({ name: o, color: 'default' })) } }), date: () => ({ date: {} }), checkbox: () => ({ checkbox: {} }), url: () => ({ url: {} }), email: () => ({ email: {} }), phoneNumber: () => ({ phone_number: {} }), formula: (exp) => ({ formula: { expression: exp } }) };

export default { isNotionConfigured, createDatabase, updateDatabase, queryDatabase, getPage, createPage, updatePage, appendBlock, getNotionStatus, propertyTypes };