#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Bundle size budget checker.
 *
 * Run after `npm run build`. Exits non-zero if any budget is exceeded.
 * Uses only Node built-ins — no extra dependencies.
 *
 * Budgets (update with deliberate justification):
 *   App chunk (index-*.js)         150 KB gzipped
 *   Phaser chunk (phaser-*.js)     400 KB gzipped
 *   Total dist/ (excl. music)      700 KB gzipped
 *   Eager music assets              2 MB  raw
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT      = path.join(__dirname, '..');
const DIST      = path.join(ROOT, 'dist');
const ASSETS    = path.join(DIST, 'assets');

// ── helpers ───────────────────────────────────────────────────────────────────

/** Gzip-compress a file and return the compressed byte count. */
function gzipSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return zlib.gzipSync(buf, { level: 9 }).length;
}

/**
 * Recursively list all files under `dir`, optionally filtered by `predicate`.
 * @param {string} dir
 * @param {(f: string) => boolean} [predicate]
 * @returns {string[]}
 */
function walk(dir, predicate) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, predicate));
    } else if (!predicate || predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Return files in `dir` whose name matches a simple glob pattern
 * (supports `*` as a wildcard within a single path segment).
 * @param {string} dir
 * @param {string} pattern  e.g. 'index-*.js'
 * @returns {string[]}
 */
function globFiles(dir, pattern) {
  const re = new RegExp(
    '^' +
    pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') +
    '$',
  );
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => re.test(n)).map((n) => path.join(dir, n))
    : [];
}

/** Pretty-print bytes as KB. */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ── read eager music paths from audioConfig.ts ───────────────────────────────

/**
 * Parse `src/config/audioConfig.ts` to find the `path` values of entries
 * marked `eager: true` in `STATIC_MUSIC_ASSETS`.
 * Returns paths relative to `public/`, e.g. `'music/8bit-chiptune/bgm_menu.mp3'`.
 * @returns {string[]}
 */
function getEagerMusicPaths() {
  const configFile = path.join(ROOT, 'src', 'config', 'audioConfig.ts');
  if (!fs.existsSync(configFile)) return [];

  const src = fs.readFileSync(configFile, 'utf8');

  // Match object literals that contain `eager: true` and extract their `path`
  // field.  Assumptions about the source format (all satisfied by the current
  // audioConfig.ts layout):
  //   • Each MusicAsset entry is a single-line object literal `{ … }`.
  //   • No brace characters appear inside string values in the same literal.
  //   • The `path` and `eager` properties use single or double quotes.
  // If the format ever changes to multi-line objects, update this regex or
  // switch to a proper TS-AST approach.
  const blockRe = /\{[^}]*eager\s*:\s*true[^}]*\}/gs;
  const pathRe  = /path\s*:\s*['"]([^'"]+)['"]/;

  /** @type {string[]} */
  const paths = [];
  for (const m of src.matchAll(blockRe)) {
    const pm = m[0].match(pathRe);
    if (pm) paths.push(pm[1]);
  }
  return paths;
}

// ── budget table ──────────────────────────────────────────────────────────────

const BUDGETS = /** @type {const} */ ([
  {
    label:    'App chunk  (index-*.js)',
    limitKB:  150,
    raw:      false,
    required: true,
    measure() {
      const files = globFiles(ASSETS, 'index-*.js');
      return { bytes: files.reduce((s, f) => s + gzipSize(f), 0), found: files.length > 0 };
    },
  },
  {
    label:    'Phaser chunk (phaser-*.js)',
    limitKB:  400,
    raw:      false,
    required: true,
    measure() {
      const files = globFiles(ASSETS, 'phaser-*.js');
      return { bytes: files.reduce((s, f) => s + gzipSize(f), 0), found: files.length > 0 };
    },
  },
  {
    label:    'Total dist/ (excl. music)',
    limitKB:  700,
    raw:      false,
    required: false,
    measure() {
      if (!fs.existsSync(DIST)) return { bytes: 0, found: false };
      // Normalise path separators for the exclude check.
      const files = walk(DIST, (f) => !f.replace(/\\/g, '/').includes('/dist/music/'));
      return { bytes: files.reduce((s, f) => s + gzipSize(f), 0), found: true };
    },
  },
  {
    label:    'Eager music assets (raw)',
    limitKB:  2048,
    raw:      true,
    required: false,
    measure() {
      const eagerPaths = getEagerMusicPaths();
      if (eagerPaths.length === 0) return { bytes: 0, found: false };
      let total = 0;
      /** @type {string[]} */
      const missing = [];
      for (const rel of eagerPaths) {
        const abs = path.join(ROOT, 'public', rel);
        if (!fs.existsSync(abs)) {
          // A declared eager asset that doesn't exist on disk is a hard error:
          // it means either the file was deleted or the config path is wrong.
          missing.push(rel);
          continue;
        }
        total += fs.statSync(abs).size;
      }
      return { bytes: total, found: true, missing };
    },
  },
]);

// ── run checks ────────────────────────────────────────────────────────────────

if (!fs.existsSync(DIST)) {
  console.error('✗  dist/ not found — run `npm run build` first.');
  process.exit(1);
}

let failed = false;

console.log('\nBundle size budget check\n');

for (const { label, limitKB, raw, required, measure } of BUDGETS) {
  const { bytes, found, missing } = /** @type {{ bytes: number, found: boolean, missing?: string[] }} */ (measure());

  if (!found) {
    if (required) {
      console.error(`  ✗  ${label}: no files matched — expected chunk missing (build output changed?)`);
      failed = true;
    } else {
      console.log(`  ⚠  ${label}: no files matched — skipping`);
    }
    continue;
  }

  // Report missing eager assets before the budget line so the ✗ status
  // and the root cause appear together.
  if (missing && missing.length > 0) {
    for (const rel of missing) {
      console.error(`  ✗  ${label}: declared eager file not found on disk: ${rel}`);
    }
    failed = true;
  }

  const limitBytes = limitKB * 1024;
  const ok         = bytes <= limitBytes && !(missing && missing.length > 0);
  const unit       = raw ? 'raw' : 'gz';
  const actual     = `${kb(bytes)} ${unit}`;
  const limit      = `${kb(limitBytes)} ${unit}`;

  if (ok) {
    console.log(`  ✓  ${label}: ${actual}  (limit ${limit})`);
  } else {
    console.error(`  ✗  ${label}: ${actual}  (limit ${limit})${bytes > limitBytes ? `  — over by ${kb(bytes - limitBytes)}` : ''}`);
    failed = true;
  }
}

console.log('');

if (failed) {
  console.error('Bundle size budget exceeded. Raise the limits in scripts/check-size.cjs only with explicit justification.\n');
  process.exit(1);
} else {
  console.log('All bundle size budgets pass.\n');
}
