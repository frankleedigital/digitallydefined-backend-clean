// src/services/websitePlanner.js
// Turn a plain-English website request into concrete, reviewable file edits.
//
// DESIGN: plan-then-apply, never write-while-planning.
//   1. planWebsiteEdit()  — READ-ONLY. Reads candidate files, asks the model for
//      full replacement contents, validates them, returns a plan with diffs.
//   2. applyWebsitePlan() — WRITES. Commits the planned edits via githubEditor.
//
// Splitting these is the core safety property: a model that hallucinates a file
// name, mangles JSX, or decides to "also tidy up" something unrelated cannot
// damage the repo on its own. The caller sees a diff and opts in.

import { aiRouter } from './aiRouter.js';
import * as editor from './githubEditor.js';
import logger from '../utils/logger.js';

const PLANNER_SYSTEM_PROMPT = `You are Hermes, the DigitallyDefined engineering partner. You edit a small React + Vite + Tailwind website.

RULES
- Return ONLY valid JSON. No prose, no markdown fences.
- You receive the current contents of specific files. Return the FULL new contents of each file you change — never a diff, never a fragment, never "...rest of file".
- Only touch files you were given. Never invent a file path.
- If a request needs a file you were not given, set needsMoreContext=true and explain in "question" instead of guessing.
- Preserve existing behavior, routing, and imports unless the request requires changing them.
- Do not add dependencies. Only use packages already imported in the provided files.
- Keep the brand: soft brutalism, white cards, thin black frames, editorial spacing, no gradients, no emoji, no generic AI copy.
- Prefer the smallest change that satisfies the request.

OUTPUT SHAPE
{
  "understood": "one sentence restating the change",
  "question": "string or null — ask only if genuinely blocked",
  "needsMoreContext": false,
  "files": [{ "path": "pages/Home.jsx", "content": "<full new file contents>" }],
  "notes": ["short note per changed file"]
}`;

/** Heuristic: does this message look like it wants a code change? */
export function looksLikeWebsiteEdit(message) {
  const m = String(message || '').toLowerCase();
  const editWords = [
    'fix', 'change', 'update', 'edit', 'rewrite', 'make', 'improve', 'add', 'remove',
    'delete', 'rename', 'replace', 'adjust', 'tweak', 'clean up', 'redesign', 'rebuild',
    'homepage', 'home page', 'landing', 'page', 'copy', 'headline', 'button', 'nav',
    'hero', 'footer', 'header', 'style', 'css', 'layout', 'section', 'component', 'site', 'website',
  ];
  const hasEditWord = editWords.some((w) => m.includes(w));
  const isQuestion = /^(what|why|how|should|who|when)\b/.test(m.trim())
    && !/\b(fix|change|update|edit|rewrite|make|add|remove|delete)\b/.test(m);
  return hasEditWord && !isQuestion;
}

/** Pull the first JSON object out of a model response, tolerating fences. */
function extractJson(text) {
  if (!text) return null;
  const bare = text.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = bare.indexOf('{');
  const end = bare.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(bare.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Cheap sanity checks so a bad generation fails in planning, not in the commit. */
function validateProposedFile(path, content) {
  if (typeof content !== 'string' || !content.trim()) return 'empty content';
  if (content.includes('...rest of') || content.includes('// ...')) {
    return 'contains an elision instead of full file contents';
  }
  if (/\.jsx?$/i.test(path)) {
    const opens = (content.match(/\{/g) || []).length;
    const closes = (content.match(/\}/g) || []).length;
    if (Math.abs(opens - closes) > 2) return 'unbalanced braces — will not compile';
    if (/^import .* from ['"]['"]/m.test(content)) return 'malformed import statement';
  }
  return null;
}


/** Rank files by likely relevance so the model sees the right ones first. */
function preferCandidates(files, message) {
  const m = String(message || '').toLowerCase();
  const score = (f) => {
    const lf = f.toLowerCase();
    let s = 0;
    if (/homepage|home page|home|landing|index/.test(m) && /(^|\/)home|landing|index|app\/app/.test(lf)) s += 10;
    if (/nav|header|menu/.test(m) && /nav|header|menu|layout/.test(lf)) s += 8;
    if (/footer/.test(m) && /footer/.test(lf)) s += 8;
    if (/hero/.test(m) && /hero/.test(lf)) s += 8;
    if (/quiz/.test(m) && /quiz/.test(lf)) s += 6;
    if (/page/.test(m) && /pages\//.test(lf)) s += 4;
    if (/style|css|design|layout/.test(m) && (/\.css$|components\/ui/.test(lf))) s += 4;
    return s;
  };
  return [...files].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

/**
 * READ-ONLY. Build a plan for `message` without writing anything.
 */
export async function planWebsiteEdit(message) {
  if (!editor.isGithubEditorConfigured()) {
    throw new Error('Website editing is not configured (WEBSITE_GITHUB_TOKEN missing).');
  }

  const files = await editor.scanWebsite();
  if (!files.length) throw new Error('No editable website files found.');

  // Cap candidates to bound token spend.
  const MAX_CANDIDATES = 6;
  const MAX_FILE_CHARS = 12_000;
  const preferred = preferCandidates(files, message).slice(0, MAX_CANDIDATES);

  const contents = [];
  for (const path of preferred) {
    try {
      const { content, sha } = await editor.readFile(path);
      contents.push({
        path,
        sha,
        content: content.length > MAX_FILE_CHARS
          ? content.slice(0, MAX_FILE_CHARS) + '\n/* ...truncated for planning... */'
          : content,
      });
    } catch (err) {
      logger.warn('Planner could not read file', { path, error: err.message });
    }
  }
  if (!contents.length) throw new Error('Could not read any candidate files.');

  const prompt = [
    `WEBSITE REQUEST: ${message}`,
    '',
    'AVAILABLE FILES:',
    files.map((f) => `- ${f}`).join('\n'),
    '',
    'CURRENT CONTENTS:',
    ...contents.map((c) => `\n===== ${c.path} =====\n${c.content}\n`),
    '',
    'Return the JSON now. For any file you change, "content" must be the complete new file.',
  ].join('\n');

  const result = await aiRouter.generate(null, prompt, {
    mode: 'ultraMode',
    job: 'coding',
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    jsonMode: true,
  });
  if (result.error) throw new Error('Planner AI failed: ' + result.error);

  const parsed = extractJson(result.reply);
  if (!parsed) throw new Error('Planner did not return usable JSON.');

  const blocked = (question) => ({
    planId: null,
    needsMoreContext: true,
    understood: parsed.understood || String(message),
    question: question || 'Which page or component should I change?',
    edits: [],
    notes: parsed.notes || [],
    provider: result.provider,
    model: result.model,
  });

  if (parsed.needsMoreContext || !(parsed.files || []).length) {
    return blocked(parsed.question);
  }

  const byPath = new Map(contents.map((c) => [c.path, c]));
  const edits = [];
  const problems = [];

  for (const f of parsed.files || []) {
    const path = String(f.path || '').trim();
    if (!byPath.has(path)) {
      problems.push(`Ignored "${path}": not one of the files I was given.`);
      continue;
    }
    const issue = validateProposedFile(path, f.content);
    if (issue) {
      problems.push(`Rejected ${path}: ${issue}.`);
      continue;
    }
    const original = byPath.get(path);
    if (original.content === f.content) continue;
    edits.push({
      path,
      content: f.content,
      expectedSha: original.sha,
      hunks: editor.computeDiff(original.content, f.content),
    });
  }

  if (!edits.length) {
    return blocked(problems[0] || 'I could not produce a valid change. Try naming the file or section.');
  }

  const planId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  logger.info('Website edit planned', { planId, files: edits.map((e) => e.path) });

  return {
    planId,
    needsMoreContext: false,
    understood: parsed.understood || String(message),
    question: null,
    edits,
    notes: parsed.notes || [],
    warnings: problems,
    provider: result.provider,
    model: result.model,
  };
}

/**
 * WRITE. Apply a previously produced plan. `plan` is the object returned by
 * planWebsiteEdit(), passed back by the caller from the preview step.
 */
export async function applyWebsitePlan(plan, { confirm } = {}) {
  if (!plan || !Array.isArray(plan.edits) || !plan.edits.length) {
    throw new Error('Nothing to apply.');
  }
  if (plan.planId && confirm !== undefined && confirm !== plan.planId) {
    throw new Error('Confirmation does not match the plan id.');
  }

  const results = [];
  for (const edit of plan.edits) {
    try {
      results.push(await editor.writeFile(edit.path, edit.content, {
        expectedSha: edit.expectedSha,
        message: `chore(hermes): ${edit.path} — ${String(plan.understood || 'website edit').slice(0, 80)}`,
      }));
    } catch (err) {
      results.push({ ok: false, file: edit.path, error: err.message });
    }
  }

  const applied = results.filter((r) => r.ok);
  logger.info('Website plan applied', { applied: applied.length, total: results.length });
  return { appliedEdit: results, applied: applied.length, total: results.length };
}

export default { planWebsiteEdit, applyWebsitePlan, looksLikeWebsiteEdit };
