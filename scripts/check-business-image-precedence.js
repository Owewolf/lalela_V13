#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'src'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_PATH_PARTS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const BUSINESS_IDENTIFIERS = ['business', 'biz', 'b', 'userBusiness', 'communityBusiness', 'importedBusiness', 'memberBusiness'];

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
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(abs);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectViolations() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(ROOT, dir), files);
  }

  const violations = [];

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWithoutComments = line.split('//')[0];
      const lower = lineWithoutComments.toLowerCase();

      if (!lineWithoutComments.includes('.image')) continue;
      if (lower.includes('business-image-lint:ignore')) continue;

      for (const identifier of BUSINESS_IDENTIFIERS) {
        const id = escapeRegex(identifier);
        const imageRe = new RegExp(`\\b${id}(?:\\?\\.|\\.)image\\b`);
        if (!imageRe.test(lineWithoutComments)) continue;

        if (identifier === 'b' && !lower.includes('business')) {
          continue;
        }

        const imageUrlRe = new RegExp(`\\b${id}(?:\\?\\.|\\.)imageUrl\\b`);
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length - 1, i + 2);
        const snippet = lines.slice(start, end + 1).join(' ');
        if (imageUrlRe.test(snippet)) {
          continue;
        }

        violations.push({
          file: rel,
          line: i + 1,
          identifier,
          snippet: line.trim(),
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations = collectViolations();

  if (violations.length === 0) {
    console.log('[business-image-guard] OK - no business.image-first regressions found.');
    process.exit(0);
  }

  console.error(`[business-image-guard] Found ${violations.length} violation(s). Prefer imageUrl first (e.g., business.imageUrl ?? business.image).`);
  for (const v of violations.slice(0, 80)) {
    console.error(`  - ${v.file}:${v.line} (${v.identifier}.image) ${v.snippet}`);
  }
  if (violations.length > 80) {
    console.error(`  ...and ${violations.length - 80} more`);
  }
  process.exit(1);
}

main();
