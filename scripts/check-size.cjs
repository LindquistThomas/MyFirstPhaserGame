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
 *   Eager music assets               2 MB raw
 *   Total music assets (all)       6.5 MB raw   ← guards against audio bloat
 *
 * Orphan check: every file in dist/music/ must be declared in
 * STATIC_MUSIC_ASSETS (src/config/audioConfig.ts).  Any undeclared file
 * fails the check so orphaned audio cannot sneak in via a PR.
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

/**
 * Parse `src/config/audioConfig.ts` to find ALL `path` values declared in
 * `STATIC_MUSIC_ASSETS` (both eager and non-eager).
 * Returns paths relative to `public/`, e.g. `'music/8bit-chiptune/bgm_menu.mp3'`.
 * @returns {string[]}
 */
function getAllMusicPaths() {
  const configFile = path.join(ROOT, 'src', 'config', 'audioConfig.ts');
  if (!fs.existsSync(configFile)) return [];

  const src = fs.readFileSync(configFile, 'utf8');

  // Find the STATIC_MUSIC_ASSETS array literal and extract every `path` value.
  // Strategy: locate the array opening bracket, then walk the source character-
  // by-character tracking bracket depth until the array closes, then harvest
  // all `path: '…'` values from that slice.  Assumptions (the only ones the
  // parser truly depends on):
  //   • `path` values are string literals using single or double quotes with
  //     no escaped quotes inside.
  //   • No literal bracket characters (`[` / `]`) appear inside string values.
  //     If a future path contains a literal bracket (e.g. 'music/track[remix].mp3'),
  //     the depth counter will miscount and the slice will be truncated early.
  //     Switch to a proper TS-AST parser if that ever happens.
  //   • The array is assigned to `STATIC_MUSIC_ASSETS`.
  const arrayStartRe = /STATIC_MUSIC_ASSETS[^=]*=\s*\[/;
  const startMatch   = arrayStartRe.exec(src);
  if (!startMatch) return [];

  const arrayBody = src.slice(startMatch.index + startMatch[0].length);

  // Walk until the matching `]` that closes the array.
  let depth = 1;
  let i = 0;
  let body = '';
  while (i < arrayBody.length && depth > 0) {
    const ch = arrayBody[i];
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) break; }
    body += ch;
    i++;
  }

  const pathRe = /path\s*:\s*['"]([^'"]+)['"]/g;
  // Note: this regex matches any property named `path` in the extracted body.
  // It is intentionally scoped to `body` (the STATIC_MUSIC_ASSETS array slice)
  // so that `path` properties in other objects in audioConfig.ts are ignored.
  // The assumption is that only MusicAsset entries appear in that array.
  /** @type {string[]} */
  const paths = [];
  for (const m of body.matchAll(pathRe)) {
    paths.push(m[1]);
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
    // 750 KB: `music_menu` (OGG q0 22 kHz mono, ~331 KB) + `music_elevator_jazz`
    // (OGG q0 44 kHz stereo, ~354 KB) = ~685 KB actual; 65 KB headroom.
    // Previous budget was 1300 KB (pre-re-encode). Tightened 2026-05.
    limitKB:  750,
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
  {
    label:    'Total music assets (raw)',
    limitKB:  4096,   // 4 MB — calibrated 2026-05 after re-encoding the two eager tracks to OGG (total on disk ~3475 KB with ~620 KB headroom for future tracks)
    raw:      true,
    required: false,
    measure() {
      const distMusic = path.join(DIST, 'music');
      if (!fs.existsSync(distMusic)) return { bytes: 0, found: false };
      const files = walk(distMusic, (f) => /\.(mp3|ogg|wav)$/i.test(f));
      if (files.length === 0) return { bytes: 0, found: false };
      const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
      return { bytes: total, found: true };
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

// ── music orphan check ────────────────────────────────────────────────────────

{
  const distMusic = path.join(DIST, 'music');
  if (fs.existsSync(distMusic)) {
    const declaredPaths = new Set(getAllMusicPaths());
    const audioFiles    = walk(distMusic, (f) => /\.(mp3|ogg|wav)$/i.test(f));

    /** @type {string[]} */
    const orphans = [];
    /** @type {string[]} */
    const summary = [];

    for (const f of audioFiles.sort()) {
      // Convert absolute dist path → relative path the same way audioConfig
      // declares it, e.g. 'music/8bit-chiptune/bgm_menu.mp3'.
      const rel  = path.relative(DIST, f).replace(/\\/g, '/');
      const size = `${kb(fs.statSync(f).size)} raw`;
      if (declaredPaths.has(rel)) {
        summary.push(`  ✓  ${rel}  (${size})`);
      } else {
        orphans.push(rel);
        summary.push(`  ✗  ${rel}  (${size})  ← ORPHAN`);
      }
    }

    console.log('Music catalog\n');
    if (audioFiles.length === 0) {
      console.log('  (none)\n');
    } else {
      for (const line of summary) console.log(line);
      console.log('');
    }

    if (orphans.length > 0) {
      console.error(`  ✗  Music orphan check: ${orphans.length} file(s) in dist/music/ not declared in STATIC_MUSIC_ASSETS:`);
      for (const o of orphans) console.error(`       ${o}`);
      console.error('     Remove the file(s) from public/music/ or add them to STATIC_MUSIC_ASSETS.\n');
      failed = true;
    } else {
      console.log(`  ✓  Music orphan check: all ${audioFiles.length} file(s) declared in STATIC_MUSIC_ASSETS\n`);
    }
  }
}

if (failed) {
  console.error('Bundle size budget exceeded. Raise the limits in scripts/check-size.cjs only with explicit justification.\n');
  process.exit(1);
} else {
  console.log('All bundle size budgets pass.\n');
}
