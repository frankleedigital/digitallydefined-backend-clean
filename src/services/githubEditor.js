// src/services/githubEditor.js — Read/write the website source through the GitHub API.
//
// WHY THIS EXISTS
// ---------------
// The original websiteEditor.js wrote files with `fs.writeFileSync` and then ran
// `git commit && git push` via execSync. That only works when the backend runs on
// a developer laptop. The production backend runs on Vercel serverless, where:
//   * the filesystem is read-only and ephemeral,
//   * no sibling checkout of the website exists,
//   * there is no git binary.
//
// So from the live dashboard, every write silently failed. This module talks to
// the GitHub REST Contents API instead, which works identically from a laptop and
// from Vercel, and — because a commit to the repo triggers Vercel's GitHub
// integration — a successful write also deploys the site.
//
// SAFETY MODEL
// ------------
// Writes are NEVER implicit. Planning is always read-only. Applying a plan
// requires an explicit `apply` call. Every write records the base blob SHA so
// concurrent edits fail loudly instead of clobbering someone else's work.

const DEFAULT_REPO = process.env.WEBSITE_GITHUB_REPO || 'frankleedigital/digitallydefined-os-backend';
const DEFAULT_BRANCH = process.env.WEBSITE_GITHUB_BRANCH || 'master';
const DEFAULT_PREFIX = process.env.WEBSITE_GITHUB_PREFIX || 'digitallydefined-website-clean/src';

const API_ROOT = 'https://api.github.com';

// Extensions Hermes may read/plan/write. Anything else is rejected so a
// prompt-injected request can't rewrite config, dotfiles, or CI.
const ALLOWED_EXT = /\.(jsx?|css|html|json|md|svg|txt)$/i;
const MAX_FILE_BYTES = 400_000;
const MAX_EDIT_BYTES = 200_000;

const token = () => String(process.env.WEBSITE_GITHUB_TOKEN || '').trim();

export function isGithubEditorConfigured() {
  return Boolean(token());
}

/** Normalize a user-supplied relative path into a safe in-repo path. */
function safeRelPath(relativePath) {
  const raw = String(relativePath || '').trim().replace(/\\/g, '/');
  if (!raw) throw new Error('file is required');

  // Strip any leading src/ or full-prefix the model may have included.
  let rel = raw.replace(/^\.\//, '');
  if (rel.startsWith(DEFAULT_PREFIX + '/')) rel = rel.slice(DEFAULT_PREFIX.length + 1);
  if (rel.startsWith('src/')) rel = rel.slice(4);

  if (rel.includes('..')) throw new Error('Path traversal is not allowed: ' + raw);

  const segments = rel.split('/');
  if (segments.some((s) => !s || s === '.' || s === '..')) {
    throw new Error('Invalid path: ' + raw);
  }
  if (!ALLOWED_EXT.test(rel)) {
    throw new Error(`Unsupported file type: ${rel}`);
  }
  if (segments.some((s) => s.startsWith('.'))) {
    throw new Error('Dotfiles are not editable: ' + rel);
  }
  // Block well-known build/dependency/config files by exact name. These sit at
  // the repo root or src root and would either break the deploy or let an edit
  // pull in code that the app already resolves from node_modules.
  const DENIED_BASENAMES = new Set(['package.json', 'package-lock.json', 'tsconfig.json']);
  if (DENIED_BASENAMES.has(rel.toLowerCase().split('/').pop() || '')) {
    throw new Error('Dependency manifests are not editable: ' + rel);
  }
  if (segments.some((s) => s === 'node_modules' || s === 'dist' || s === 'build')) {
    throw new Error('Generated/dependency directories are not editable: ' + rel);
  }

  return rel;
}

const repoPathFor = (relativePath) => `${DEFAULT_PREFIX}/${safeRelPath(relativePath)}`;

async function ghFetch(pathOrUrl, { method = 'GET', body } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
  const headers = {
    Authorization: `Bearer ${token()}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'digitallydefined-hermes-editor',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${json?.message || text?.slice(0, 200) || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return json;
}


/**
 * Write content to a file and commit.
 * `expectedSha` guards against clobbering a concurrent edit.
 */
export async function writeFile(relativePath, newContent, { expectedSha, message } = {}) {
  const rel = safeRelPath(relativePath);
  const full = repoPathFor(rel);
  const content = String(newContent ?? '');

  if (Buffer.byteLength(content, 'utf8') > MAX_EDIT_BYTES) {
    throw new Error(`Edit too large (max ${MAX_EDIT_BYTES} bytes): ${rel}`);
  }

  let sha = expectedSha;
  let existing = null;
  try {
    existing = await readFile(rel);
    if (sha && existing.sha && sha !== existing.sha) {
      throw new Error(
        `Conflict: ${rel} changed on the server since it was read. Re-plan and retry.`
      );
    }
    sha = existing.sha;
  } catch (err) {
    // 404 means a new file — that is allowed, so sha stays undefined.
    if (err.status !== 404) throw err;
  }

  const result = await ghFetch(`/repos/${DEFAULT_REPO}/contents/${full}`, {
    method: 'PUT',
    body: {
      message: message || `chore(hermes): update ${rel}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: DEFAULT_BRANCH,
      ...(sha ? { sha } : {}),
    },
  });

  return {
    ok: true,
    file: rel,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    created: !existing,
    committed: Boolean(result?.commit?.sha),
    commitHash: result?.commit?.sha || null,
    commitUrl: result?.commit?.html_url || null,
    pushed: true,
    hunks: computeDiff(existing?.content ?? null, content),
  };
}

/** Line-level diff for previewing a proposed change. */
export function computeDiff(oldStr, newStr) {
  if (!oldStr) return [{ type: 'added', line: 1, content: '(new file)' }];

  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const hunks = [];
  let hunk = [];
  let inHunk = false;

  const flush = () => {
    if (hunk.length) hunks.push(hunk);
    hunk = [];
    inHunk = false;
  };

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const o = oldLines[i] ?? '';
    const n = newLines[i] ?? '';
    if (o !== n) {
      inHunk = true;
      if (o) hunk.push({ type: 'removed', line: i + 1, content: o });
      if (n) hunk.push({ type: 'added', line: i + 1, content: n });
      if (hunk.length > 40) flush();
    } else if (inHunk) {
      hunk.push({ type: 'context', line: i + 1, content: o });
      if (hunk.length > 40) flush();
    }
  }
  flush();
  return hunks;
}

export default { scanWebsite, readFile, writeFile, computeDiff, isGithubEditorConfigured };

/** Recursively list every editable file under the website src prefix. */
export async function scanWebsite() {
  const files = [];

  async function walk(dir) {
    const res = await ghFetch(
      `/repos/${DEFAULT_REPO}/contents/${dir}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`
    );
    if (!Array.isArray(res)) return;
    for (const entry of res) {
      if (entry.type === 'dir') {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        await walk(`${dir}/${entry.name}`);
      } else if (entry.type === 'file' && ALLOWED_EXT.test(entry.name)) {
        files.push(entry.path.slice(DEFAULT_PREFIX.length + 1));
      }
    }
  }

  await walk(DEFAULT_PREFIX);
  return files.sort();
}

/**
 * Read one source file.
 * Returns { file, content, sha, size }. `sha` is the blob SHA to pass back on write.
 */
export async function readFile(relativePath) {
  const rel = safeRelPath(relativePath);
  const full = repoPathFor(rel);

  const meta = await ghFetch(
    `/repos/${DEFAULT_REPO}/contents/${full}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`
  );
  if (!meta || meta.type !== 'file') throw new Error('Not a file: ' + rel);
  if (meta.size > MAX_FILE_BYTES) throw new Error(`File too large to edit: ${rel}`);

  const content = Buffer.from(
    meta.content || '',
    meta.encoding === 'base64' ? 'base64' : 'utf8'
  ).toString('utf8');

  return { file: rel, content, sha: meta.sha, size: meta.size };
}

