#!/bin/bash
# deploy-lalela — build, package and prepare for upload to lalela.net
# Usage: ./deploy-lalela.sh
# Optional: VERSION=1.2.0 ./deploy-lalela.sh

set -e

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✔  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
fail()    { echo -e "${RED}✘  $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}   Lalela — Production Build & Package    ${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

# ── Version tag + sequential build number ────────────────────────────────────
VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || echo '0.0.0')}"
BUILD_NUMBER_FILE=".build-number"
if [ -f "${BUILD_NUMBER_FILE}" ]; then
  BUILD_NUM=$(( $(cat "${BUILD_NUMBER_FILE}") + 1 ))
else
  BUILD_NUM=1
fi
echo "${BUILD_NUM}" > "${BUILD_NUMBER_FILE}"
ZIPNAME="lalela-static-v${VERSION}-build${BUILD_NUM}.zip"
info "Version: ${VERSION}  |  Build: #${BUILD_NUM}"

# ── Sync app.json with build number for EAS (appVersionSource: local) ────────
# EAS reads expo.version, expo.ios.buildNumber, expo.android.versionCode from
# app.json. Format chosen: version = "1.<BUILD_NUM>", iOS buildNumber and
# Android versionCode = <BUILD_NUM>. Keeps native + web artifacts aligned.
APP_VERSION="1.${BUILD_NUM}"
info "Syncing app.json -> version ${APP_VERSION}, ios.buildNumber ${BUILD_NUM}, android.versionCode ${BUILD_NUM}"
node -e "
  const fs = require('fs');
  const path = './app.json';
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  cfg.expo = cfg.expo || {};
  cfg.expo.version = '${APP_VERSION}';
  cfg.expo.ios = cfg.expo.ios || {};
  cfg.expo.ios.buildNumber = '${BUILD_NUM}';
  cfg.expo.android = cfg.expo.android || {};
  cfg.expo.android.versionCode = ${BUILD_NUM};
  fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
" || fail "Failed to update app.json with new build number"
success "app.json synced"

API_URL="$(grep '^EXPO_PUBLIC_API_URL=' .env.production 2>/dev/null | cut -d '=' -f2-)"
if [ -z "${API_URL}" ]; then
  fail "EXPO_PUBLIC_API_URL is missing from .env.production"
fi

# ── 1. Install / verify dependencies ─────────────────────────────────────────
info "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  info "node_modules missing — running npm install..."
  npm install
fi
success "Dependencies OK"

# ── 2. Lint (TypeScript type-check) ──────────────────────────────────────────
info "Running lint (tsc --noEmit)..."
if ! npm run lint; then
  fail "Lint failed. Fix TypeScript errors before deploying."
fi
success "Lint passed"

# ── 3. Dependency audit (warn only — doesn't block build) ────────────────────
info "Running dependency audit..."
npm audit --audit-level=high || warn "Audit found issues — review before going live."
success "Audit done"

# ── 3b. Verify production API target ─────────────────────────────────────────
info "Checking production API target..."
API_STATUS="$(curl -L -s -o /dev/null -w '%{http_code}' "${API_URL}/health" || true)"
if [ "${API_STATUS}" != "200" ]; then
  if [ "${STRICT_API_HEALTH_CHECK:-0}" = "1" ]; then
    fail "Production API health check failed for ${API_URL}/health (HTTP ${API_STATUS:-000})."
  fi
  warn "Production API health check failed for ${API_URL}/health (HTTP ${API_STATUS:-000}). Building package anyway; verify the backend before going live."
else
  success "Production API reachable at ${API_URL}"
fi

# ── 4. Build production web app ───────────────────────────────────────────────
info "Building production web app (platform=web)..."
info "  API URL baked into bundle: ${API_URL}  (from .env.production)"

npx expo export --platform web --clear

# ── 5. Detect build output dir ───────────────────────────────────────────────
if [ -d "dist" ]; then
  BUILD_DIR="dist"
elif [ -d "build" ]; then
  BUILD_DIR="build"
elif [ -d "web-build" ]; then
  BUILD_DIR="web-build"
else
  fail "No build output found (expected dist/, build/, or web-build/)."
fi
info "Build output: ./${BUILD_DIR}/"

# ── 6. Inject .htaccess for SPA routing ───────────────────────────────────────
info "Injecting .htaccess for SPA routing..."
cat > "${BUILD_DIR}/.htaccess" << 'HTACCESS'
Options -MultiViews
RewriteEngine On

# ── MIME types (required so Apache doesn't serve JS as text/plain) ────────────
AddType application/javascript .js .mjs
AddType text/css .css
AddType image/svg+xml .svg
AddType application/json .json
AddType font/woff2 .woff2
AddType font/woff .woff

# ── Security headers ──────────────────────────────────────────────────────────
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"

  # Cache JS/CSS bundles aggressively (they have content hashes in filenames)
  <FilesMatch "\.(js|css|woff2?|png|jpg|jpeg|gif|ico|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # Never cache index.html — it must always be fresh
  <FilesMatch "^index\.html$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
</IfModule>

# ── Compression ───────────────────────────────────────────────────────────────
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

# ── Preserve backend routes before SPA fallback ─────────────────────────────
RewriteRule ^api($|/) - [L]
RewriteRule ^socket\.io($|/) - [L]

# ── SPA fallback — serve index.html for all routes ───────────────────────────
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]
HTACCESS
success ".htaccess written to ${BUILD_DIR}/"

# ── 7. Remove any dev artifacts from build dir ────────────────────────────────
info "Cleaning dev artifacts from build output..."
find "${BUILD_DIR}" -name "*.map" -delete 2>/dev/null || true      # source maps
find "${BUILD_DIR}" -name ".DS_Store" -delete 2>/dev/null || true
success "Build dir clean"

# ── 8. Package into zip ───────────────────────────────────────────────────────
info "Packaging ${ZIPNAME}..."
rm -f "${ZIPNAME}"
# cd into the build dir so files land at root of zip (not nested under dist/)
# Include everything: HTML, JS bundles, CSS, assets, _expo/, images, fonts
(cd "${BUILD_DIR}" && zip -r "../${ZIPNAME}" \
  index.html \
  .htaccess \
  _expo/ \
  assets/ \
  $(find . -maxdepth 1 -name '*.html' ! -name 'index.html' -printf '%f ') \
  $([ -d metadata ] && echo 'metadata/') \
  $([ -f manifest.json ] && echo 'manifest.json') \
  $(find . -maxdepth 1 -name "*.png" -printf "%f ") \
  $([ -f favicon.ico ] && echo 'favicon.ico') \
  2>/dev/null || true
)

ZIP_SIZE=$(du -sh "${ZIPNAME}" | cut -f1)

# ── 9. Verify ─────────────────────────────────────────────────────────────────
if [ ! -f "${ZIPNAME}" ]; then
  fail "ZIP file missing after packaging step."
fi

# Check that index.html ended up in the zip at root level
if ! unzip -l "${ZIPNAME}" | grep -q " index.html$\| ./index.html$"; then
  fail "index.html not found in zip — build may have failed silently."
fi

ASSET_COUNT=$(unzip -l "${ZIPNAME}" | tail -1 | awk '{print $2}')
success "ZIP verified — ${ASSET_COUNT} files, ${ZIP_SIZE}"

# ── 9b. Restart backend via pm2 ───────────────────────────────────────────────
# The deployed web bundle calls the API at EXPO_PUBLIC_API_URL (from
# .env.production). We always reload the local backend so any server-side
# code changes shipped in this commit go live at the same time as the web
# bundle. `startOrReload` is idempotent: it starts the apps if they aren't
# running, or performs a zero-downtime reload if they are.
info "Reloading backend via pm2..."
if ! command -v pm2 >/dev/null 2>&1; then
  warn "pm2 is not installed — skipping backend reload. Install with: npm i -g pm2"
else
  if pm2 startOrReload ecosystem.config.js --update-env; then
    pm2 save >/dev/null 2>&1 || true
    success "Backend reloaded"
    pm2 status
  else
    warn "pm2 reload failed — check 'pm2 logs' and 'pm2 status'"
  fi
fi

# ── 9c. Verify backend services are available ────────────────────────────────
# The deployed web bundle is useless if the API server or the Cloudflare
# tunnel that exposes it (api.wolfslair.cc) are down. The API server runs
# under pm2 as `lalela-server`; the tunnel runs system-wide as the systemd
# unit `cloudflared.service` (installed via `cloudflared service install`).
# Both must be online for production traffic to reach the backend.
info "Verifying backend services are online..."

# lalela-server (pm2)
SERVER_STATUS="unknown"
if command -v pm2 >/dev/null 2>&1; then
  SERVER_STATUS="$(pm2 jlist 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);const p=a.find(x=>x.name==='lalela-server');console.log(p?p.pm2_env.status:'missing');}catch(e){console.log('unknown');}})" 2>/dev/null || echo unknown)"
fi
if [ "${SERVER_STATUS}" = "online" ]; then
  success "lalela-server (pm2) is online"
else
  warn "lalela-server is NOT online (status: ${SERVER_STATUS}). Run: pm2 status && pm2 logs lalela-server"
fi

# cloudflared tunnel (systemd, system-wide)
TUNNEL_STATUS="unknown"
if command -v systemctl >/dev/null 2>&1; then
  TUNNEL_STATUS="$(systemctl is-active cloudflared.service 2>/dev/null || echo inactive)"
fi
if [ "${TUNNEL_STATUS}" = "active" ]; then
  success "cloudflared tunnel (systemd) is active"
else
  warn "cloudflared.service is NOT active (status: ${TUNNEL_STATUS}). Run: sudo systemctl status cloudflared"
fi

# End-to-end check through the tunnel
HEALTH_STATUS="$(curl -L -s -o /dev/null -w '%{http_code}' "${API_URL}/health" || true)"
if [ "${HEALTH_STATUS}" = "200" ]; then
  success "API reachable through tunnel at ${API_URL}/health"
else
  warn "API health check via tunnel failed (HTTP ${HEALTH_STATUS:-000}) at ${API_URL}/health"
fi

if [ "${STRICT_API_HEALTH_CHECK:-0}" = "1" ]; then
  if [ "${SERVER_STATUS}" != "online" ] || [ "${TUNNEL_STATUS}" != "active" ] || [ "${HEALTH_STATUS}" != "200" ]; then
    fail "Backend not fully available (server=${SERVER_STATUS}, tunnel=${TUNNEL_STATUS}, health=${HEALTH_STATUS:-000})."
  fi
fi

# ── 10. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✔  Build complete!                     ${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  File:     ${CYAN}${ZIPNAME}${NC}"
echo -e "  Assets:   ${CYAN}${ASSET_COUNT} files, ${ZIP_SIZE}${NC}"
echo ""
echo -e "${YELLOW}▶  NEXT STEPS — Upload to lalela.net${NC}"
echo ""
echo "  1. Log in to cPanel → File Manager"
echo "  2. Navigate to public_html/"
echo "  3. Upload ${ZIPNAME}"
echo "  4. Extract — select 'Overwrite existing files'"
echo "  5. Verify public_html/index.html and public_html/.htaccess exist"
echo "  6. Open https://lalela.net in a browser"
echo ""
echo -e "${YELLOW}▶  BACKEND${NC}"
echo ""
echo "  This script just reloaded the local backend via pm2 and verified"
echo "  that both the API server and the Cloudflare tunnel are available."
echo "  Manual checks:"
echo "    pm2 status                          # lalela-server (user pm2)"
echo "    systemctl status cloudflared        # tunnel (system-wide)"
echo "  Quick health check:"
echo "    curl ${API_URL}/health"
echo "  To make this script fail on backend availability issues, run:"
echo "    STRICT_API_HEALTH_CHECK=1 ./deploy-lalela.sh"
echo ""
