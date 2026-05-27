#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIR = path.join(ROOT, 'src/components');
const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);

const IGNORE_FILES = new Set([
  'src/components/shared/CardSurface.tsx',
]);

const RE_LOCAL_CARD_DEPTH = /const\s+CARD_DEPTH(?:_[A-Z]+)?\s*=\s*(?:createShadow|getCardShadow)\(/;
const RE_THEME_CARD_BG = /backgroundColor\s*:\s*THEME_COLORS\.(surface|surfaceContainer|surfaceContainerLow)\b/;
const RE_THEME_BORDER = /borderColor\s*:\s*THEME_COLORS\.(neutralBgSoft|neutralBorderSoft|neutralBorder)\b/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
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

function hasLocalCardBackgroundPair(lines, i) {
  const start = Math.max(0, i - 4);
  const end = Math.min(lines.length - 1, i + 4);
  let hasBg = false;
  let hasBorder = false;
  for (let j = start; j <= end; j++) {
    if (RE_THEME_CARD_BG.test(lines[j])) hasBg = true;
    if (RE_THEME_BORDER.test(lines[j])) hasBorder = true;
  }
  return hasBg && hasBorder;
}

function main() {
  const files = [];
  walk(SCAN_DIR, files);

  const violations = [];

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (IGNORE_FILES.has(rel)) continue;

    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (RE_LOCAL_CARD_DEPTH.test(line)) {
        violations.push(`${rel}:${i + 1} local CARD_DEPTH constant detected`);
      }

      if (RE_THEME_CARD_BG.test(line) && hasLocalCardBackgroundPair(lines, i)) {
        violations.push(`${rel}:${i + 1} direct card bg+border pair; use cardStyles helpers/CardSurface`);
      }
    }
  }

  if (violations.length === 0) {
    console.log('[card-guard] OK - no local card style literals detected.');
    process.exit(0);
  }

  console.error(`[card-guard] Found ${violations.length} violation(s):`);
  for (const v of violations.slice(0, 80)) {
    console.error(`  - ${v}`);
  }
  if (violations.length > 80) {
    console.error(`  ...and ${violations.length - 80} more`);
  }
  process.exit(1);
}

main();
