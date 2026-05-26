#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'src'];
const BASELINE_PATH = path.join(ROOT, 'docs/theme-refactor/reports/hardcoded-style-literals.raw.txt');

const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_PATH_PARTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'docs',
]);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /rgba?\([^\)]+\)/g;

function shouldSkipFile(relPath) {
  const normalized = relPath.split(path.sep);
  return normalized.some((part) => SKIP_PATH_PARTS.has(part));
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs);
    if (shouldSkipFile(rel)) continue;
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!FILE_EXTENSIONS.has(ext)) continue;
    out.push(abs);
  }
}

function extractLiteralsFromLine(line) {
  const literals = [];

  HEX_RE.lastIndex = 0;
  RGB_RE.lastIndex = 0;

  for (const m of line.matchAll(HEX_RE)) {
    literals.push(m[0].toLowerCase());
  }
  for (const m of line.matchAll(RGB_RE)) {
    literals.push(m[0].replace(/\s+/g, '').toLowerCase());
  }
  return literals;
}

function parseBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }

  const baseline = new Set();

  const text = fs.readFileSync(BASELINE_PATH, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const firstColon = line.indexOf(':');
    if (firstColon <= 0) continue;
    const secondColon = line.indexOf(':', firstColon + 1);
    if (secondColon <= firstColon) continue;

    const file = line.slice(0, firstColon).replace(/^\.\//, '');
    const content = line.slice(secondColon + 1);
    const literals = extractLiteralsFromLine(content);
    for (const lit of literals) {
      baseline.add(`${file}|${lit}`);
    }
  }
  return baseline;
}

function collectCurrentFindings() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(ROOT, dir), files);
  }

  const findings = [];
  const keySet = new Set();

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');

    // Central token definition file is intentionally literal.
    if (rel === 'src/theme/colors.ts') continue;

    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('THEME_COLORS.')) continue;
      const literals = extractLiteralsFromLine(line);
      if (literals.length === 0) continue;

      for (const lit of literals) {
        const key = `${rel}|${lit}`;
        if (keySet.has(key)) continue;
        keySet.add(key);
        findings.push({ file: rel, line: i + 1, literal: lit, key });
      }
    }
  }

  return findings;
}

function main() {
  const baseline = parseBaseline();
  const findings = collectCurrentFindings();

  if (baseline === null) {
    console.log('[theme-guard] Baseline not found.');
    console.log(`[theme-guard] Expected baseline at: ${path.relative(ROOT, BASELINE_PATH)}`);
    console.log('[theme-guard] Running in non-blocking mode until baseline exists.');
    process.exit(0);
  }

  const violations = findings.filter((f) => !baseline.has(f.key));

  if (violations.length === 0) {
    console.log(`[theme-guard] OK - no new hardcoded color literals detected across ${SCAN_DIRS.join(', ')}.`);
    process.exit(0);
  }

  console.error(`[theme-guard] Found ${violations.length} new hardcoded color literal(s) not present in baseline:`);
  for (const v of violations.slice(0, 60)) {
    console.error(`  - ${v.file}:${v.line} ${v.literal}`);
  }
  if (violations.length > 60) {
    console.error(`  ...and ${violations.length - 60} more`);
  }
  console.error('[theme-guard] Replace with THEME_COLORS tokens or update the baseline intentionally.');
  process.exit(1);
}

main();
