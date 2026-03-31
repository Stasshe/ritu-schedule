#!/usr/bin/env node
/*
 * Create .gitkeep files in empty directories (recursive).
 *
 * Usage:
 *   node scripts/add-gitkeeps.js [path] [--dry-run] [--exclude=a,b]
 *
 * Defaults:
 *   path: current directory
 *   excludes: .git, node_modules
 */
'use strict';

const fs = require('fs').promises;
const path = require('path');

const DEFAULT_EXCLUDES = new Set(['.git', 'node_modules']);

function parseArgs() {
  const argv = process.argv.slice(2);
  let root = '.';
  let dryRun = false;
  const excludes = new Set(DEFAULT_EXCLUDES);
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: add-gitkeeps.js [path] [--dry-run] [--exclude=a,b]');
      process.exit(0);
    } else if (arg.startsWith('--root=')) {
      root = arg.slice('--root='.length);
    } else if (arg.startsWith('--exclude=')) {
      const parts = arg.slice('--exclude='.length).split(',');
      for (const p of parts) if (p) excludes.add(p);
    } else if (arg.startsWith('--')) {
      console.warn('Unknown option:', arg);
    } else if (root === '.') {
      root = arg;
    }
  }
  return {root, dryRun, excludes};
}

async function processDir(dir, excludes, dryRun) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error('Failed to read', dir, err.message);
    return false;
  }

  let hasContent = false;
  for (const entry of entries) {
    if (excludes.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childHas = await processDir(full, excludes, dryRun);
      if (childHas) hasContent = true;
    } else {
      if (entry.name === '.gitkeep') continue;
      hasContent = true;
    }
  }

  if (!hasContent) {
    const gitkeep = path.join(dir, '.gitkeep');
    try {
      await fs.access(gitkeep);
      // .gitkeep already exists
    } catch {
      if (dryRun) {
        console.log('[dry-run] would create', gitkeep);
      } else {
        try {
          await fs.writeFile(gitkeep, '');
          console.log('Created', gitkeep);
        } catch (err) {
          console.error('Failed to create', gitkeep, err.message);
        }
      }
    }
    return true;
  }

  return true;
}

(async () => {
  const { root, dryRun, excludes } = parseArgs();
  const start = path.resolve(root);
  console.log('Scanning', start, dryRun ? '(dry-run)' : '');
  await processDir(start, excludes, dryRun);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
