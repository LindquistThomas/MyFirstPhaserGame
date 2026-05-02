#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Orphan music checker.
 *
 * Scans public/music/ for *.mp3, *.ogg, and *.wav files and verifies that
 * every file is referenced by `STATIC_MUSIC_ASSETS` in
 * src/config/audioConfig.ts.  Exits non-zero if any orphan is found.
 *
 * Run with: node scripts/check-orphan-music.cjs
 * Wired into CI via the `check:orphan-music` npm script.
 *
 * Uses only Node built-ins — no extra dependencies.
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const MUSIC_DIR   = path.join(ROOT, 'public', 'music');
const CONFIG_FILE = path.join(ROOT, 'src', 'config', 'audioConfig.ts');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively collect all audio files under `dir`.
 * @param {string} dir
 * @returns {string[]} Absolute file paths.
 */
function collectAudioFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectAudioFiles(full));
    } else if (/\.(mp3|ogg|wav)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Parse `src/config/audioConfig.ts` and return every `path` value found
 * inside `STATIC_MUSIC_ASSETS`.  Paths are relative to `public/`.
 * @returns {Set<string>}
 */
function getReferencedPaths() {
  const src = fs.readFileSync(CONFIG_FILE, 'utf8');

  // Extract the STATIC_MUSIC_ASSETS array literal.
  // Strategy: grab text between the opening `[` and the closing `];`.
  const arrayMatch = src.match(/STATIC_MUSIC_ASSETS[^=]*=\s*(\[[\s\S]*?\]);/);
  if (!arrayMatch) {
    console.error('✗  Could not locate STATIC_MUSIC_ASSETS in', CONFIG_FILE);
    process.exit(1);
  }

  const arrayText = arrayMatch[1];
  const pathRe    = /path\s*:\s*['"]([^'"]+)['"]/g;

  /** @type {Set<string>} */
  const paths = new Set();
  for (const m of arrayText.matchAll(pathRe)) {
    // Paths in the config are relative to public/ (e.g. "music/8bit-chiptune/bgm_menu.mp3").
    // Normalise to forward slashes for cross-platform comparison.
    paths.add(m[1].replace(/\\/g, '/'));
  }
  return paths;
}

// ── main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(MUSIC_DIR)) {
  console.error('✗  public/music/ directory not found.');
  process.exit(1);
}

const referencedPaths = getReferencedPaths();
const audioFiles      = collectAudioFiles(MUSIC_DIR);

/** @type {string[]} */
const orphans = [];

for (const absPath of audioFiles) {
  // Convert to the same relative-to-public/ forward-slash format used in the config.
  const rel = path.relative(path.join(ROOT, 'public'), absPath).replace(/\\/g, '/');
  if (!referencedPaths.has(rel)) {
    orphans.push(rel);
  }
}

console.log('\nOrphan music check\n');

if (orphans.length === 0) {
  console.log('  ✓  All music files in public/music/ are referenced by STATIC_MUSIC_ASSETS.\n');
} else {
  for (const o of orphans) {
    console.error(`  ✗  Orphan (not in STATIC_MUSIC_ASSETS): ${o}`);
  }
  console.error(
    `\n${orphans.length} orphan file(s) found in public/music/.\n` +
    'Either add them to STATIC_MUSIC_ASSETS in src/config/audioConfig.ts ' +
    'or delete them from the repository.\n',
  );
  process.exit(1);
}
