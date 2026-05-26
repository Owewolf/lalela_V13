#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['app', 'src'];
const SKIP_FILES = new Set(['src/theme/colors.ts']);

const LITERAL_TO_TOKEN = new Map([
  ['#0d3d47', 'primary'],
  ['#1e5667', 'primaryContainer'],
  ['#9c4421', 'secondary'],
  ['#fc7127', 'secondaryContainer'],
  ['#ffddb9', 'tertiaryFixed'],
  ['#fff8f0', 'surface'],
  ['#1a1c1a', 'onSurface'],
  ['#efeeeb', 'surfaceContainer'],
  ['#f4f3f1', 'surfaceContainerLow'],
  ['#737971', 'outline'],
  ['#c2c8bf', 'outlineVariant'],
  ['#ba1a1a', 'error'],
  ['#dc2626', 'errorStrong'],
  ['#ef4444', 'errorStrong'],
  ['#d97706', 'warning'],
  ['#10b981', 'success'],
  ['#075985', 'info'],
  ['#059669', 'successStrongAlt'],
  ['#fcd34d', 'warningBorderStrong'],

  ['#f0fdf4', 'successSurface'],
  ['#bbf7d0', 'successBorder'],
  ['#166534', 'successText'],

  ['#fffbeb', 'warningSurface'],
  ['#fde68a', 'warningBorder'],
  ['#f59e0b', 'warningStrong'],
  ['#b45309', 'warningText'],

  ['#fef2f2', 'errorSurface'],
  ['#fecaca', 'errorBorder'],
  ['#991b1b', 'errorText'],

  ['#e0f2fe', 'infoSurface'],
  ['#bae6fd', 'infoBorder'],
  ['#155e75', 'infoText'],

  ['#f8fafc', 'neutralBg'],
  ['#f1f5f9', 'neutralBgSoft'],
  ['#f3f4f6', 'neutralBgSofter'],
  ['#f5f5f5', 'surfaceContainerLow'],
  ['#f9fafb', 'neutralBg'],
  ['#e2e8f0', 'neutralBorder'],
  ['#e5e7eb', 'neutralBorderSoft'],
  ['#d1d5db', 'neutralBorderMuted'],
  ['#cbd5e1', 'neutralBorderStrong'],
  ['#9ca3af', 'neutralTextSoft'],
  ['#94a3b8', 'neutralTextMuted'],
  ['#888', 'neutralTextSoft'],
  ['#aaa', 'neutralTextPlaceholder'],
  ['#64748b', 'neutralTextSubtle'],
  ['#6b7280', 'neutralTextSubtle'],
  ['#475569', 'neutralTextDefault'],
  ['#4b5563', 'neutralTextDefault'],
  ['#667781', 'neutralTextWhatsapp'],
  ['#374151', 'neutralTextEmphasis'],
  ['#334155', 'neutralTextHeading'],
  ['#0f172a', 'neutralTextStrong'],
  ['#111827', 'neutralTextStrong'],
  ['#1a1a1a', 'onSurface'],

  ['#3b82f6', 'brandBlue'],
  ['#2563eb', 'brandBlueText'],
  ['#1d4ed8', 'brandBlueText'],
  ['#7c3aed', 'brandPurple'],
  ['#f3e8ff', 'brandPurpleLight'],
  ['#f5f3ff', 'brandPurpleSurface'],
  ['#6d28d9', 'brandPurpleText'],

  ['#16a34a', 'successStrong'],
  ['#dcfce7', 'successSurfaceStrong'],
  ['#fef3c7', 'warningSurfaceAlt'],
  ['#ecfeff', 'infoSurfaceAlt'],
  ['#eff6ff', 'infoSurfaceSoft'],
  ['#fff5f5', 'errorSurfaceStrong'],

  ['#fff', 'white'],
  ['#ffffff', 'white'],
  ['#000', 'black'],
  ['#000000', 'black'],

  ['rgba(0,0,0,0.06)', 'overlayBorderSoft'],
  ['rgba(0,0,0,0.08)', 'overlayBorder'],
  ['rgba(239,68,68,0.1)', 'errorTintSoft'],
  ['rgba(37,99,235,0.1)', 'infoTintSoft'],
  ['rgba(22,163,74,0.1)', 'successTintSoft'],
  ['rgba(16,185,129,0.1)', 'successTintSoftAlt'],
  ['rgba(16,185,129,0.2)', 'successTintStrongAlt'],
  ['rgba(22,163,74,0.05)', 'successTintSofter'],
  ['rgba(22,163,74,0.08)', 'successTintSofterAlt'],
  ['rgba(22,163,74,0.2)', 'successTintBorderAlt'],
  ['rgba(13,61,71,0.08)', 'primaryTintSoft'],
  ['rgba(245,158,11,0.1)', 'warningTintSoft'],
  ['rgba(107,114,128,0.1)', 'neutralTintSoft'],
  ['rgba(255,255,255,0.8)', 'whiteOverlay80'],
  ['rgba(255,255,255,0.9)', 'whiteOverlay90'],
  ['rgba(255,255,255,0.7)', 'whiteOverlay70'],
  ['rgba(255,255,255,0.2)', 'whiteOverlay20'],
  ['rgba(0,0,0,0.2)', 'blackOverlay20'],
  ['rgba(0,0,0,0.5)', 'blackOverlay50'],
  ['rgba(0,0,0,0.6)', 'blackOverlay60'],
  ['rgba(30,86,103,0.06)', 'primaryContainerTint06'],
  ['rgba(30,86,103,0.7)', 'primaryContainerTint70'],
  ['rgba(220,38,38,0.45)', 'errorOverlay45'],
  ['rgba(220,38,38,0.08)', 'errorOverlay08'],
  ['rgba(179,38,30,0.55)', 'md3ErrorOverlay55'],
  ['rgba(179,38,30,0.08)', 'md3ErrorOverlay08'],

  ['#6750a4', 'md3Primary'],
  ['#b3261e', 'md3Error'],
  ['#666', 'neutralTextSoftAlt'],
  ['#666666', 'neutralTextSoftAlt'],
  ['#4f46e5', 'indigo'],
  ['#a8c4cb', 'tealMuted'],
  ['#54656f', 'slateWhatsapp'],
  ['#93c5fd', 'infoBorderStrong'],
  ['#ecfdf5', 'successSurfaceSoft'],
  ['#111b21', 'chatTextStrong'],
  ['#e9edef', 'chatSurface'],
  ['#d7dde0', 'chatBorder'],
  ['#dfe5e7', 'chatAvatarSurface'],
  ['#25d366', 'whatsappGreen'],
  ['#f7f8fc', 'pageBgSoft'],
]);

const CLASS_REPLACEMENTS = [
  [/text-\[#0d3d47\]/g, 'text-primary'],
  [/bg-\[#0d3d47\]/g, 'bg-primary'],
  [/border-\[#0d3d47\]/g, 'border-primary'],
  [/text-\[#fc7127\]/g, 'text-secondary-container'],
  [/bg-\[#fc7127\]/g, 'bg-secondary-container'],
  [/text-\[#9ca3af\]/g, 'text-neutralTextSoft'],
  [/text-\[#94a3b8\]/g, 'text-neutralTextMuted'],
  [/bg-\[#f0fdf4\]/g, 'bg-successSurface'],
  [/bg-\[#1e5667\]/g, 'bg-primary-container'],
  [/text-\[#111b21\]/g, 'text-neutralTextStrong'],
  [/bg-\[#e9edef\]/g, 'bg-slate-200'],
  [/border-\[#d7dde0\]/g, 'border-slate-300'],
  [/bg-\[#dfe5e7\]/g, 'bg-slate-200'],
  [/text-\[#54656f\]/g, 'text-slate-600'],
  [/bg-\[#25d366\]/g, 'bg-green-500'],
  [/bg-\[#f7f8fc\]/g, 'bg-slate-50'],
  [/bg-\[#fff8f0\]/g, 'bg-surface'],
  [/border-\[#fc7127\]/g, 'border-secondary-container'],
  [/text-\[#fff\]/g, 'text-white'],
  [/bg-\[#fff\]/g, 'bg-white'],
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
      walk(abs, out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!rel.endsWith('.ts') && !rel.endsWith('.tsx')) continue;
    if (SKIP_FILES.has(rel)) continue;
    out.push(rel);
  }
}

function tokenForLiteral(rawLiteral) {
  const normalized = rawLiteral.toLowerCase().replace(/\s+/g, '');
  return LITERAL_TO_TOKEN.get(normalized) || null;
}

function ensureThemeImport(content, relFile) {
  if (!content.includes('THEME_COLORS.')) return content;
  if (content.includes("from '../../theme/colors'") || content.includes("from '../theme/colors'") || content.includes("from './theme/colors'") || content.includes("from '../../../theme/colors'") || content.includes("from '../src/theme/colors'") || content.includes("from '../../src/theme/colors'")) {
    return content;
  }

  const from = relFile.replace(/\\/g, '/');
  const target = 'src/theme/colors.ts';
  let relImport = path.relative(path.dirname(from), target).replace(/\\/g, '/').replace(/\.ts$/, '');
  if (!relImport.startsWith('.')) relImport = `./${relImport}`;

  const importStmt = `import { THEME_COLORS } from '${relImport}';\n`;

  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s.+from\s['"].+['"];?\s*$/.test(lines[i])) {
      lastImportIdx = i;
    }
  }

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importStmt.trimEnd());
    return lines.join('\n');
  }

  return `${importStmt}${content}`;
}

function migrateFile(relFile) {
  const abs = path.join(ROOT, relFile);
  let content = fs.readFileSync(abs, 'utf8');
  const original = content;

  content = content.replace(/(['"])(#[0-9A-Fa-f]{3,8}|rgba?\([^'"\n\r]+\))\1/g, (m, q, literal) => {
    const token = tokenForLiteral(literal);
    if (!token) return m;
    return `THEME_COLORS.${token}`;
  });

  for (const [re, to] of CLASS_REPLACEMENTS) {
    content = content.replace(re, to);
  }

  content = ensureThemeImport(content, relFile);

  if (content !== original) {
    fs.writeFileSync(abs, content);
    return 1;
  }
  return 0;
}

function main() {
  const files = [];
  for (const d of TARGET_DIRS) walk(path.join(ROOT, d), files);

  let changed = 0;
  for (const rel of files) {
    changed += migrateFile(rel);
  }

  console.log(`Migrated files: ${changed}`);
}

main();
