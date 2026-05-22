#!/usr/bin/env bash
# Lalela dev launcher — starts everything except the emulator (run: npm run android)

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ─── Kill stale API server on port 4000 ──────────────────────────────────────
fuser -k 4000/tcp 2>/dev/null || kill "$(lsof -ti:4000)" 2>/dev/null || true

# ─── Start Cloudflare tunnel ──────────────────────────────────────────────────
echo "Starting Cloudflare tunnel (api.wolfslair.cc)..."
pkill -f "cloudflared tunnel run" 2>/dev/null || true
cloudflared tunnel run lalela-api >/tmp/cf-tunnel.log 2>&1 &
echo "  → https://api.wolfslair.cc/api  (logs: /tmp/cf-tunnel.log)"
echo ""

# ─── Set EXPO_PUBLIC_API_URL to emulator address ─────────────────────────────
API_URL="http://10.0.2.2:4000/api"
sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=${API_URL}|" "$ENV_FILE"
echo "EXPO_PUBLIC_API_URL → $API_URL"
echo ""

# ─── Start Docker services ────────────────────────────────────────────────────
echo "Starting Docker services..."
cd "$SCRIPT_DIR"
docker compose stop minio minio-init pgadmin 2>/dev/null || true
docker compose up postgres minio minio-init pgadmin -d
echo ""

# ─── Start API server (foreground) ───────────────────────────────────────────
echo "Starting API server..."
npm run server:dev