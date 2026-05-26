#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COLORS_PATH = path.join(ROOT, 'src/theme/colors.ts');
const CSV_PATH = path.join(ROOT, 'docs/theme-refactor/reports/hardcoded-style-inventory.full.csv');

if (!fs.existsSync(CSV_PATH)) {
  console.error('Missing inventory CSV. Run generate-hardcoded-style-inventory first.');
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function tokenNameForLiteral(lit) {
  const l = lit.toLowerCase().replace(/\s+/g, '');
  if (l.startsWith('#')) {
    return `aliasHex_${l.slice(1)}`;
  }
  if (l.startsWith('rgba(') || l.startsWith('rgb(')) {
    return `alias_${l.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
  }
  return `alias_${l.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function getGapLiterals() {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  const gaps = new Set();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    // file,component,line,literal,category,replaceWith,priority,platform
    const literal = (row[3] || '').replace(/^"|"$/g, '');
    const replaceWith = (row[5] || '').replace(/^"|"$/g, '');
    if (replaceWith === 'TOKEN_GAP' && literal) {
      gaps.add(literal);
    }
  }
  return Array.from(gaps).sort();
}

function appendAliasesToColors(gapLiterals) {
  let content = fs.readFileSync(COLORS_PATH, 'utf8');
  const existing = new Set();
  const re = /^\s*([a-zA-Z0-9_]+):\s*/gm;
  let m;
  while ((m = re.exec(content)) !== null) existing.add(m[1]);

  const additions = [];
  for (const lit of gapLiterals) {
    const token = tokenNameForLiteral(lit);
    if (existing.has(token)) continue;
    additions.push(`  ${token}: '${lit.toLowerCase().replace(/\s+/g, '')}',`);
    existing.add(token);
  }

  if (additions.length === 0) return 0;

  content = content.replace(/\n\}\s+as const;\s*$/, `\n${additions.join('\n')}\n} as const;\n`);
  fs.writeFileSync(COLORS_PATH, content);
  return additions.length;
}

function walkFiles() {
  const out = [];
  const targets = ['app', 'src'];
  for (const t of targets) {
    walk(path.join(ROOT, t), out);
  }
  return out;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      walk(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    if (!(rel.endsWith('.ts') || rel.endsWith('.tsx'))) continue;
    if (rel === 'src/theme/colors.ts') continue;
    out.push(rel);
  }
}

function ensureImport(content, rel) {
  if (!content.includes('THEME_COLORS.')) return content;
  if (content.includes("theme/colors'")) return content;

  const target = 'src/theme/colors.ts';
  let relImport = path.relative(path.dirname(rel), target).replace(/\\/g, '/').replace(/\.ts$/, '');
  if (!relImport.startsWith('.')) relImport = `./${relImport}`;
  const stmt = `import { THEME_COLORS } from '${relImport}';`;

  const lines = content.split('\n');
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s.+from\s['"].+['"];?\s*$/.test(lines[i])) idx = i;
  }
  if (idx >= 0) {
    lines.splice(idx + 1, 0, stmt);
    return lines.join('\n');
  }
  return `${stmt}\n${content}`;
}

function replaceGaps(gapLiterals) {
  const files = walkFiles();
  let changed = 0;

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let content = fs.readFileSync(abs, 'utf8');
    const original = content;

    for (const lit of gapLiterals) {
      const token = tokenNameForLiteral(lit);
      const escaped = lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(['"])${escaped}\\1`, 'gi');
      content = content.replace(re, `THEME_COLORS.${token}`);
    }

    // Fix JSX prop values like color=THEME_COLORS.foo -> color={THEME_COLORS.foo}
    content = content.replace(/(\b[A-Za-z_][A-Za-z0-9_]*)=THEME_COLORS\.([A-Za-z0-9_]+)/g, '$1={THEME_COLORS.$2}');

    content = ensureImport(content, rel);

    if (content !== original) {
      fs.writeFileSync(abs, content);
      changed++;
    }
  }

  return changed;
}

function main() {
  const gaps = getGapLiterals();
  if (gaps.length === 0) {
    console.log('No TOKEN_GAP literals found.');
    return;
  }

  const added = appendAliasesToColors(gaps);
  const changedFiles = replaceGaps(gaps);

  console.log(`Gap literals processed: ${gaps.length}`);
  console.log(`Aliases added: ${added}`);
  console.log(`Files updated: ${changedFiles}`);
}

main();
