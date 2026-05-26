#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'src'];
const OUT_DIR = path.join(ROOT, 'docs/theme-refactor/reports');
const STATE_MATRIX_FILE = path.join(OUT_DIR, 'interaction-state-evidence-matrix.md');
const STATE_HARDCODED_FILE = path.join(OUT_DIR, 'interaction-state-hardcoded-literals.raw.txt');

const STATE_DEFAULTS = {
  // Approved cross-app touch feedback defaults.
  activeOpacity: new Set(['0.6', '0.7', '0.75', '0.8', '0.85', '0.9', '0.92', '1']),
};

const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_PARTS = new Set(['node_modules', '.git', 'dist', 'build']);

const PATTERNS = {
  typography: /fontSize\s*:\s*\d+|lineHeight\s*:\s*\d+|fontWeight\s*:\s*'?[0-9]{3}'?|letterSpacing\s*:\s*-?\d+(\.\d+)?/g,
  spacing: /padding(Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*\d+|margin(Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*\d+|gap\s*:\s*\d+/g,
  radius: /borderRadius\s*:\s*\d+|borderRadius\s*:\s*'\d+px'/g,
  shadow: /shadow(Color|Offset|Opacity|Radius)\s*:|elevation\s*:\s*\d+|linear-gradient|gradient|boxShadow\s*:/g,
  states: /(activeOpacity\s*=|\bdisabled\s*=|\bdisabled\s*:|\bisDisabled\b|\bpressed\b|\bisPressed\b|\bfocused\b|\bisFocused\b|\bonHover(In|Out)\b|\bonFocus\b|\bonBlur\b|\bhover\b|\bfocusVisible\b)/g,
};

const OUTPUT_FILES = {
  typography: 'noncolor-typography-literals.raw.txt',
  spacing: 'noncolor-spacing-literals.raw.txt',
  radius: 'noncolor-radius-literals.raw.txt',
  shadow: 'noncolor-shadow-gradient-literals.raw.txt',
  states: 'interaction-state-coverage.raw.txt',
};

function shouldSkip(relPath) {
  return relPath.split(path.sep).some((part) => SKIP_PARTS.has(part));
}

function walk(absDir, files) {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = path.relative(ROOT, abs);
    if (shouldSkip(rel)) continue;
    if (entry.isDirectory()) {
      walk(abs, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(abs);
  }
}

function collectFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(ROOT, dir), files);
  }
  return files;
}

function runScan(files) {
  const findings = {
    typography: [],
    spacing: [],
    radius: [],
    shadow: [],
    states: [],
  };

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const [kind, re] of Object.entries(PATTERNS)) {
        re.lastIndex = 0;
        if (re.test(line)) {
          findings[kind].push(`${rel}:${i + 1}:${line}`);
        }
      }
    }
  }

  return findings;
}

function runHardcodedStateScan(files) {
  const findings = [];
  const activeOpacityLiteral = /activeOpacity\s*=\s*\{?\s*([0-9]+(?:\.[0-9]+)?)\s*\}?/g;
  const disabledLiteral = /\bdisabled\s*=\s*\{\s*(true|false)\s*\}/g;

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      activeOpacityLiteral.lastIndex = 0;
      let activeMatch;
      while ((activeMatch = activeOpacityLiteral.exec(line)) !== null) {
        const value = activeMatch[1];
        if (!STATE_DEFAULTS.activeOpacity.has(value)) {
          findings.push(`${rel}:${i + 1}:${line}`);
          break;
        }
      }

      disabledLiteral.lastIndex = 0;
      if (disabledLiteral.test(line)) {
        findings.push(`${rel}:${i + 1}:${line}`);
      }
    }
  }

  return findings;
}

function writeOutputs(findings) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [kind, lines] of Object.entries(findings)) {
    const outFile = path.join(OUT_DIR, OUTPUT_FILES[kind]);
    fs.writeFileSync(outFile, `${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
  }
}

function getUnresolvedStateRows() {
  if (!fs.existsSync(STATE_MATRIX_FILE)) {
    return null;
  }

  const content = fs.readFileSync(STATE_MATRIX_FILE, 'utf8');
  const lines = content.split(/\r?\n/);
  let unresolved = 0;

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (line.includes('| Status |')) continue;
    if (line.includes('| --- |')) continue;
    if (!line.includes('| `')) continue;

    const cols = line.split('|').map((part) => part.trim());
    const status = cols[1];
    if (status === 'PENDING') {
      unresolved += 1;
    }
  }

  return unresolved;
}

function main() {
  const failOnFindings = process.argv.includes('--fail-on-findings');
  const files = collectFiles();
  const findings = runScan(files);
  const hardcodedStateFindings = runHardcodedStateScan(files);
  writeOutputs(findings);
  fs.writeFileSync(
    STATE_HARDCODED_FILE,
    `${hardcodedStateFindings.join('\n')}${hardcodedStateFindings.length ? '\n' : ''}`,
    'utf8'
  );

  const counts = Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length]));
  const unresolvedStates = getUnresolvedStateRows();
  const stateScore = unresolvedStates == null ? counts.states : unresolvedStates;
  const stateInventory = hardcodedStateFindings.length;

  console.log('[theme-noncolor-audit] Completed');
  console.log(`[theme-noncolor-audit] typography=${counts.typography}`);
  console.log(`[theme-noncolor-audit] spacing=${counts.spacing}`);
  console.log(`[theme-noncolor-audit] radius=${counts.radius}`);
  console.log(`[theme-noncolor-audit] shadow=${counts.shadow}`);
  console.log(`[theme-noncolor-audit] states=${stateScore}`);
  console.log(`[theme-noncolor-audit] states_inventory=${stateInventory}`);
  console.log(`[theme-noncolor-audit] states_inventory_raw=${counts.states}`);
  console.log('[theme-noncolor-audit] states policy: unresolved matrix rows (PENDING) from interaction-state-evidence-matrix.md');
  console.log('[theme-noncolor-audit] states_inventory policy: hardcoded non-default state literals (see interaction-state-hardcoded-literals.raw.txt)');

  const totalBlocking = counts.typography + counts.spacing + counts.radius;
  if (failOnFindings && totalBlocking > 0) {
    console.error(`[theme-noncolor-audit] FAIL: found ${totalBlocking} typography/spacing/radius findings.`);
    process.exit(1);
  }
}

main();
