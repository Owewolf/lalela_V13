// react-async-hook@3.6.1 ships a package.json whose `module` field points to
// `react-async-hook.esm.js`, a file that does NOT exist in the published
// tarball (only `dist/` is shipped). Metro (used by Expo for web) prefers the
// `module` field over `main`, which causes web bundling to fail with:
//
//   Error: While trying to resolve module `react-async-hook` ...
//   the package itself specifies a `main` module field that could not be
//   resolved (`.../react-async-hook.esm.js`).
//
// This patch rewrites the `module` field to point at the real built file
// (`dist/index.js`) so Metro can resolve it. It is idempotent and safe to run
// repeatedly.

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-async-hook',
  'package.json'
);

if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const desired = 'dist/index.js';
if (pkg.module === desired) {
  process.exit(0);
}

pkg.module = desired;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('[patch-react-async-hook] Rewrote `module` field to dist/index.js');
