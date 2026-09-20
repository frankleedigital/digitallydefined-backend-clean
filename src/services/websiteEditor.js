// src/services/websiteEditor.js — Read/write the website source and commit via git
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Resolve paths relative to the repo root (parent of digitallydefined-backend-clean)
const REPO_ROOT = path.resolve(process.cwd(), '..');
const WEBSITE_SRC = path.resolve(REPO_ROOT, 'digitallydefined-website-clean', 'src');

function abs(p) { return path.resolve(WEBSITE_SRC, p); }
function rel(a) { return path.relative(WEBSITE_SRC, a).replace(/\\/g, '/'); }
function assertInside(a) {
  if (!a.startsWith(WEBSITE_SRC + path.sep) && a !== WEBSITE_SRC)
    throw new Error('Path outside allowed website directory: ' + rel(a));
}
function git(args, cwd = WEBSITE_SRC) {
  return execSync('git ' + args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/** List all .jsx/.js/.css files under src/ as relative paths. */
export function scanWebsite() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.(jsx?|css)$/.test(entry.name)) {
        files.push(rel(full));
      }
    }
  }
  walk(WEBSITE_SRC);
  return files.sort();
}

/** Read a source file by relative path (e.g. "pages/Home.jsx"). */
export function readFile(relativePath) {
  const absPath = abs(relativePath);
  assertInside(absPath);
  if (!fs.existsSync(absPath)) throw new Error('File not found: ' + relativePath);
  return fs.readFileSync(absPath, 'utf8');
}

/**
 * Write content to a source file, stage it, commit, and push.
 */
export function writeFile(relativePath, newContent) {
  const absPath = abs(relativePath);
  assertInside(absPath);

  const oldContent = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : null;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, newContent, 'utf8');

  // Stage only this file
  const relPath = rel(absPath);
  git('add ' + JSON.stringify(relPath));

  // Commit
  const hashBefore = git('rev-parse HEAD');
  const commitMsg = `chore: edit ${relPath} via Hermes`;
  git('commit -m ' + JSON.stringify(commitMsg));
  const hashAfter = git('rev-parse HEAD');
  const committed = hashAfter !== hashBefore;

  // Push (best-effort — don't fail the whole request if push is blocked)
  let pushed = false;
  let pushError = null;
  try {
    git('push origin master');
    pushed = true;
  } catch (err) {
    pushError = err.message.split('\n')[0];
    logger.warn('Website push failed (commit saved locally)', { error: pushError });
  }

  return {
    ok: true,
    file: relativePath,
    committed,
    pushed,
    commitHash: committed ? hashAfter : hashBefore,
    pushError,
    hunks: computeDiff(oldContent, newContent),
  };
}

/** Simple line-level diff for display. */
function computeDiff(oldStr, newStr) {
  if (!oldStr) return [{ type: 'added', lines: newStr.split('\n').length }];
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const hunks = [];
  let inHunk = false;
  let hunk = [];
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const o = oldLines[i] ?? '';
    const n = newLines[i] ?? '';
    if (o !== n) {
      if (!inHunk) { inHunk = true; hunk = []; }
      if (o) hunk.push({ type: 'removed', line: i + 1, content: o });
      if (n) hunk.push({ type: 'added', line: i + 1, content: n });
    } else if (inHunk) {
      hunk.push({ type: 'context', line: i + 1, content: o });
      if (hunk.length > 20) {
        hunks.push(hunk);
        hunk = [];
        inHunk = false;
      }
    }
  }
  if (hunk.length) hunks.push(hunk);
  return hunks;
}

export default { scanWebsite, readFile, writeFile };
