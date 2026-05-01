#!/usr/bin/env bash
# Lalela dev launcher
#
# Usage:
#   bash start-dev.sh            # auto-detect local IP (physical device on same WiFi)
#   bash start-dev.sh emulator   # use 10.0.2.2 (Android emulator)
#   bash start-dev.sh tunnel     # use Cloudflare tunnel (device on different network)

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
MODE="${1:-local}"

# ─── Kill any stale processes ─────────────────────────────────────────────────
pkill -f cloudflared 2>/dev/null || true
fuser -k 4000/tcp 2>/dev/null || kill "$(lsof -ti:4000)" 2>/dev/null || true
sleep 1

# ─── Determine API base URL ───────────────────────────────────────────────────

if [[ "$MODE" == "emulator" ]]; then
  API_URL="http://10.0.2.2:4000/api"
  echo "Mode: emulator → $API_URL"

elif [[ "$MODE" == "tunnel" ]]; then
  LOG="/tmp/cf-tunnel.log"
  echo "Starting Cloudflare tunnel..."
  rm -f "$LOG"
  cloudflared tunnel --url http://localhost:4000 >"$LOG" 2>&1 &
  CF_PID=$!
  trap 'echo "Stopping tunnel..."; kill "$CF_PID" 2>/dev/null' EXIT

  TUNNEL_URL=""
  for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1) || true
    [[ -n "$TUNNEL_URL" ]] && break
    printf '.'
    sleep 1
  done
  echo ""

  if [[ -z "$TUNNEL_URL" ]]; then
    echo "ERROR: Could not get tunnel URL after 30s. Check /tmp/cf-tunnel.log"
    exit 1
  fi
  echo "Tunnel URL: $TUNNEL_URL"
  API_URL="${TUNNEL_URL}/api"

else
  # local mode — detect LAN IP automatically
  LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
  if [[ -z "$LOCAL_IP" ]]; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  if [[ -z "$LOCAL_IP" ]]; then
    echo "ERROR: Could not detect local IP. Run with 'emulator' or 'tunnel' argument."
    exit 1
  fi
  API_URL="http://${LOCAL_IP}:4000/api"
  echo "Mode: local → $API_URL  (physical device must be on the same WiFi)"
fi

# ─── Write EXPO_PUBLIC_API_URL to .env ────────────────────────────────────────
if grep -q '^EXPO_PUBLIC_API_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=${API_URL}|" "$ENV_FILE"
else
  echo "EXPO_PUBLIC_API_URL=${API_URL}" >> "$ENV_FILE"
fi
echo "Updated .env: EXPO_PUBLIC_API_URL=${API_URL}"
echo ""
echo "⚠  Restart Metro (npm run android) if it was already running, so it picks up the new URL."
echo ""

# ─── Start Docker services (MinIO + pgAdmin; skip postgres — using native) ────
echo "Starting Docker services..."
cd "$SCRIPT_DIR"
docker compose up minio minio-init pgadmin -d
echo ""

# ─── Start API server ─────────────────────────────────────────────────────────
echo "Starting API server..."
npm run server
