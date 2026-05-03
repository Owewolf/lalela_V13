# Lalela Platform — VPS Deployment Guide

> **Purpose:** Step-by-step manual reference for deploying the Lalela platform on a fresh VPS.
> Every command here is intentional and will later be extracted into `deploy-vps.sh` verbatim.
> Run all commands as your non-root deploy user unless noted with `(root)`.

---

## Stack Summary

| Layer | Technology | Port (internal) |
|---|---|---|
| Reverse proxy | Nginx + Certbot (SSL) | 80, 443 |
| Backend API + Socket.io | Node 22 / Express (Docker) | 4000 |
| Database | PostgreSQL 16 (Docker) | 5432 |
| Object storage | MinIO AIStor (Docker) | 9000 API, 9001 console |
| TURN / WebRTC | Coturn (Docker) | 3478 UDP/TCP |
| DB admin | pgAdmin (Docker) | 5050 |
| Domain | lalela.net | — |
| Storage subdomain | storage.lalela.net | — |

---

## Phase 0 — Pre-flight & DNS

### 0.1 VPS Minimum Specs

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Fedora 42 | Fedora 42 |

### 0.2 DNS Records (add at your registrar BEFORE provisioning SSL)

```
A     lalela.net           →  <YOUR_VPS_IP>
A     www.lalela.net       →  <YOUR_VPS_IP>
A     storage.lalela.net   →  <YOUR_VPS_IP>
```

Wait for DNS propagation (~5–30 min) before running Certbot.

### 0.3 Local Machine — Copy SSH Key to VPS (run from your local machine)

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<YOUR_VPS_IP>
```

---

## Phase 1 — Initial VPS Setup

### 1.1 SSH in as root

```bash
ssh root@<YOUR_VPS_IP>
```

### 1.2 (root) Update and upgrade Fedora

```bash
dnf update -y && dnf upgrade -y
```

### 1.3 (root) Install base tools

```bash
dnf install -y git curl wget unzip nano htop net-tools firewalld
```

### 1.4 (root) Create non-root deploy user

```bash
useradd -m -G wheel lalela
passwd lalela
```

### 1.5 (root) Copy SSH key to deploy user

```bash
rsync --archive --chown=lalela:lalela ~/.ssh /home/lalela
```

### 1.6 (root) Lock down SSH — edit sshd_config

```bash
nano /etc/ssh/sshd_config
```

Set these values:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart sshd
```

### 1.7 Reconnect as deploy user from your local machine

```bash
ssh lalela@<YOUR_VPS_IP>
```

All subsequent commands run as the `lalela` user.

---

## Phase 2 — Install Docker & Docker Compose

### 2.1 Install Docker CE on Fedora

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.2 Enable and start Docker

```bash
sudo systemctl enable --now docker
```

### 2.3 Add deploy user to docker group (avoids sudo on every docker command)

```bash
sudo usermod -aG docker lalela
```

### 2.4 Re-login so group takes effect

```bash
exit
ssh lalela@<YOUR_VPS_IP>
```

### 2.5 Verify Docker

```bash
docker run --rm hello-world
docker compose version
```

---

## Phase 3 — Install Nginx & Certbot

### 3.1 Install Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable --now nginx
```

### 3.2 Install Certbot with Nginx plugin

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

---

## Phase 4 — Clone the Repository

### 4.1 Clone from GitHub

```bash
cd /home/lalela
git clone https://github.com/Owewolf/lalela_V13.git lalela
cd lalela
```

### 4.2 Install Node.js 22 (needed for Prisma CLI + migrations)

```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
node -v   # should output v22.x.x
```

### 4.3 Install Node dependencies (triggers prisma generate via postinstall)

```bash
npm ci --omit=dev
```

---

## Phase 5 — Configure Environment Variables

### 5.1 Create the .env file

```bash
nano /home/lalela/lalela/.env
```

Paste and fill in all values:

```dotenv
# ─── Server ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000
API_BASE_URL=https://lalela.net

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:CHANGE_ME_DB_PASS@postgres:5432/lalela

# ─── Auth / JWT ───────────────────────────────────────────────────────────────
JWT_SECRET=CHANGE_ME_LONG_RANDOM_STRING_64_CHARS
JWT_REFRESH_SECRET=CHANGE_ME_ANOTHER_LONG_RANDOM_STRING

# ─── MinIO (S3-compatible storage) ────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=lalela
MINIO_SECRET_KEY=CHANGE_ME_MINIO_SECRET
MINIO_BUCKET=lalela
MINIO_PUBLIC_URL=https://storage.lalela.net

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://lalela.net,https://www.lalela.net

# ─── Email (SMTP) ─────────────────────────────────────────────────────────────
SMTP_HOST=mail.lalela.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@lalela.net
SMTP_PASSWORD=CHANGE_ME_SMTP_PASS
SMTP_FROM=Lalela <admin@lalela.net>

# ─── SMS — Africa's Talking ───────────────────────────────────────────────────
SMS_PROVIDER=africastalking
AT_USERNAME=lalela
AT_API_KEY=CHANGE_ME_AT_KEY
AT_SENDER_ID=LALELA

# ─── Google Maps (server-side geocoding) ─────────────────────────────────────
GOOGLE_MAPS_API_KEY=CHANGE_ME_MAPS_KEY

# ─── Google Service Account (FCM push via REST) ───────────────────────────────
GOOGLE_SA_PATH=/home/lalela/lalela/service-account/service-account.json
FCM_PROJECT_ID=lalela-2e9d5

# ─── Apple Push Notifications (APNs) ─────────────────────────────────────────
APNS_KEY_PATH=/home/lalela/lalela/service-account/apns.p8
APNS_KEY_ID=CHANGE_ME
APNS_TEAM_ID=CHANGE_ME
APNS_BUNDLE_ID=net.lalela.app
APNS_PRODUCTION=true

# ─── Deep link ────────────────────────────────────────────────────────────────
APP_DEEP_LINK=lalela://
```

> ⚠️ Never commit `.env` to git. It is already in `.gitignore`.

### 5.2 Generate secure random secrets (run these and paste the output into .env)

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5.3 Place the MinIO license file

```bash
# Copy your minio.license from local machine to VPS
# Run this from your LOCAL machine:
scp ~/path/to/minio.license lalela@<YOUR_VPS_IP>:/home/lalela/lalela/minio.license
```

### 5.4 Place the Google service account JSON (FCM push notifications)

This is a Google Cloud service account key — used by the backend to send Android push notifications via the FCM REST v1 API. It is **not** the Firebase SDK; Firebase has been removed from this project.

```bash
# Run this from your LOCAL machine:
scp ~/path/to/service-account.json lalela@<YOUR_VPS_IP>:/home/lalela/lalela/service-account/service-account.json
```

### 5.5 Update docker-compose.yml for production passwords

Edit the file to use the same `CHANGE_ME_DB_PASS` you set in `.env`:

```bash
nano /home/lalela/lalela/docker-compose.yml
```

Change:
```yaml
POSTGRES_PASSWORD: lalela123   # → CHANGE_ME_DB_PASS
PGADMIN_DEFAULT_PASSWORD: lalela123  # → set a strong password
```

Also update `DATABASE_URL` in the `backend` service to match.

---

## Phase 6 — Create Coturn Config

### 6.1 Create coturn directory and config

```bash
mkdir -p /home/lalela/lalela/deploy/coturn
nano /home/lalela/lalela/deploy/coturn/turnserver.conf
```

Paste:

```ini
listening-port=3478
fingerprint
lt-cred-mech
realm=lalela.net
server-name=turn.lalela.net

# Use a strong shared secret
static-auth-secret=CHANGE_ME_TURN_SECRET

# Logging
log-file=/var/log/coturn/turnserver.log
simple-log

# Restrict relay to VPS public IP
external-ip=<YOUR_VPS_IP>

# TLS (optional — requires cert)
# cert=/etc/letsencrypt/live/lalela.net/fullchain.pem
# pkey=/etc/letsencrypt/live/lalela.net/privkey.pem
# tls-listening-port=5349
```

---

## Phase 7 — Launch Docker Compose (All Backend Services)

### 7.1 Build and start all services

```bash
cd /home/lalela/lalela
docker compose up -d --build
```

### 7.2 Verify all services are running

```bash
docker compose ps
```

Expected output (all should show `Up` or `running`):

```
NAME                STATUS
lalela-postgres-1   running (healthy)
lalela-minio-1      running (healthy)
lalela-minio-init-1 exited (0)   ← one-shot init, exit 0 is correct
lalela-backend-1    running
lalela-pgadmin-1    running
lalela-coturn-1     running
```

### 7.3 Check backend logs

```bash
docker compose logs -f backend
```

Look for:
```
Lalela API + Socket.io running on port 4000
Environment: production
```

Press `Ctrl+C` to exit log tail.

### 7.4 Check PostgreSQL is accessible from backend

```bash
docker compose exec backend sh -c "npx prisma db push --skip-generate" 2>&1 | tail -5
```

---

## Phase 8 — Run Database Migrations (Prisma)

### 8.1 Run migrations (applies all schema changes)

```bash
cd /home/lalela/lalela
DATABASE_URL="postgresql://postgres:CHANGE_ME_DB_PASS@localhost:5432/lalela" \
  npx prisma migrate deploy
```

### 8.2 (First deployment only) Seed initial data if you have a seed script

```bash
DATABASE_URL="postgresql://postgres:CHANGE_ME_DB_PASS@localhost:5432/lalela" \
  npx prisma db seed
```

### 8.3 Verify tables were created

```bash
docker compose exec postgres psql -U postgres -d lalela -c "\dt"
```

---

## Phase 9 — Configure Nginx (Production Reverse Proxy)

### 9.1 Copy the production nginx config

```bash
sudo cp /home/lalela/lalela/deploy/nginx.conf /etc/nginx/sites-available/lalela.net
sudo ln -sf /etc/nginx/sites-available/lalela.net /etc/nginx/sites-enabled/lalela.net
```

> On Fedora, Nginx uses `/etc/nginx/conf.d/` instead of `sites-available/`. Use this instead:

```bash
sudo cp /home/lalela/lalela/deploy/nginx.conf /etc/nginx/conf.d/lalela.net.conf
```

### 9.2 Temporarily point nginx to port 80 only (needed for Certbot HTTP challenge)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Phase 10 — Obtain SSL Certificates (Let's Encrypt)

### 10.1 Issue certificates for all domains

```bash
sudo certbot --nginx \
  -d lalela.net \
  -d www.lalela.net \
  -d storage.lalela.net \
  --email admin@lalela.net \
  --agree-tos \
  --no-eff-email
```

Certbot will automatically update your nginx config with SSL directives.

### 10.2 Verify auto-renewal timer

```bash
sudo systemctl status certbot-renew.timer
```

### 10.3 Test renewal dry-run

```bash
sudo certbot renew --dry-run
```

### 10.4 Reload nginx with final SSL config

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Phase 11 — Configure Firewall

Fedora uses `firewalld`, not `ufw`.

### 11.1 Enable firewalld

```bash
sudo systemctl enable --now firewalld
```

### 11.2 Open required ports

```bash
# HTTP + HTTPS (web traffic)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# MinIO S3 API (public, served via storage.lalela.net)
# Already handled by Nginx proxy — no direct port exposure needed

# Coturn TURN server (WebRTC)
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=5349/udp

# TURN relay port range
sudo firewall-cmd --permanent --add-port=49152-65535/udp

# SSH (already open by default, verify)
sudo firewall-cmd --permanent --add-service=ssh

# Reload rules
sudo firewall-cmd --reload
```

### 11.3 List active rules to verify

```bash
sudo firewall-cmd --list-all
```

---

## Phase 12 — Verify Full Deployment

### 12.1 API health check

```bash
curl -s https://lalela.net/api/health | jq .
```

Expected: `{"status":"ok","timestamp":"..."}`

### 12.2 Check MinIO storage subdomain

```bash
curl -I https://storage.lalela.net/lalela/
```

Expected: `HTTP/2 403` or `200` (bucket exists, anonymous access depends on bucket policy)

### 12.3 Test Socket.io WebSocket endpoint

```bash
curl -s "https://lalela.net/socket.io/?EIO=4&transport=polling" | head -c 100
```

Expected: Socket.io handshake response starting with `0{...}`

### 12.4 Check all Docker containers are still healthy

```bash
docker compose ps
docker stats --no-stream
```

### 12.5 Check Nginx error log

```bash
sudo tail -50 /var/log/nginx/error.log
```

---

## Phase 13 — Auto-Restart on Reboot

Docker Compose services already use `restart: unless-stopped`.
Ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

### 13.1 Verify post-reboot behaviour (simulate)

```bash
sudo reboot
```

After reboot reconnect and check:

```bash
ssh lalela@<YOUR_VPS_IP>
cd /home/lalela/lalela
docker compose ps
```

---

## Phase 14 — Mobile App Configuration

The mobile app (React Native/Expo) is **not deployed to the VPS** — it runs on users' devices.
You must update the API endpoint in the mobile app config before building production APK/IPA.

### 14.1 Update API base URL (in your mobile app source)

Set the production API URL to `https://lalela.net` wherever the app constructs API calls.

### 14.2 Build production Android APK via EAS

```bash
# Run from your local dev machine (not VPS)
cd /path/to/lalela_platformV2
eas build --platform android --profile production
```

### 14.3 Build production iOS IPA via EAS

```bash
eas build --platform ios --profile production
```

---

## Phase 15 — Ongoing Operations

### Update application code

```bash
cd /home/lalela/lalela
git pull origin main
docker compose up -d --build backend
```

### Run new database migrations after code update

```bash
DATABASE_URL="postgresql://postgres:CHANGE_ME_DB_PASS@localhost:5432/lalela" \
  npx prisma migrate deploy
```

### View real-time backend logs

```bash
docker compose logs -f backend
```

### Restart a single service

```bash
docker compose restart backend
docker compose restart minio
docker compose restart postgres
```

### Full stack restart

```bash
docker compose down && docker compose up -d
```

### Backup PostgreSQL database

```bash
docker compose exec postgres pg_dump -U postgres lalela > /home/lalela/backups/lalela_$(date +%Y%m%d_%H%M%S).sql
```

### Access pgAdmin (web UI for database)

pgAdmin runs on internal port 5050. Access via SSH tunnel from your local machine:

```bash
# Run from LOCAL machine
ssh -L 5050:localhost:5050 lalela@<YOUR_VPS_IP>
```

Then open: `http://localhost:5050`
Login: `admin@lalela.net` / (password set in docker-compose.yml)

### Access MinIO Console (object storage admin)

MinIO console runs on internal port 9001. Access via SSH tunnel:

```bash
# Run from LOCAL machine
ssh -L 9001:localhost:9001 lalela@<YOUR_VPS_IP>
```

Then open: `http://localhost:9001`

---

## Architecture Overview

```
Internet
    │
    ▼
[Nginx :443 SSL]
    ├── lalela.net /api/*        → backend:4000  (Express REST)
    ├── lalela.net /socket.io/*  → backend:4000  (Socket.io WS)
    ├── lalela.net /             → /var/www/lalela/public (static SPA)
    └── storage.lalela.net /*   → minio:9000     (S3 object storage)

[Docker Compose Network]
    ├── backend:4000    (Node 22 / Express / Socket.io)
    │       └── prisma → postgres:5432
    │       └── minio  → minio:9000
    ├── postgres:5432   (PostgreSQL 16)
    ├── minio:9000      (MinIO AIStor object storage)
    ├── minio:9001      (MinIO Console — internal only)
    ├── pgadmin:5050    (pgAdmin — internal only)
    └── coturn:3478     (TURN server for WebRTC calls)

[Mobile App - not on VPS]
    Android/iOS app → HTTPS → lalela.net/api
                    → WSS  → lalela.net/socket.io
                    → TURN → lalela.net:3478
```

---

## Environment Variable Reference

| Variable | Required | Example Value | Description |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | Node environment |
| `PORT` | ✅ | `4000` | Backend listen port |
| `API_BASE_URL` | ✅ | `https://lalela.net` | Public API base URL |
| `DATABASE_URL` | ✅ | `postgresql://postgres:pw@postgres:5432/lalela` | Prisma DB connection |
| `JWT_SECRET` | ✅ | 64-char hex string | JWT signing secret |
| `JWT_REFRESH_SECRET` | ✅ | 64-char hex string | JWT refresh token secret |
| `MINIO_ENDPOINT` | ✅ | `minio` | MinIO hostname (Docker service name) |
| `MINIO_PORT` | ✅ | `9000` | MinIO API port |
| `MINIO_USE_SSL` | ✅ | `false` | Nginx handles SSL externally |
| `MINIO_ACCESS_KEY` | ✅ | `lalela` | MinIO access key |
| `MINIO_SECRET_KEY` | ✅ | strong secret | MinIO secret key |
| `MINIO_BUCKET` | ✅ | `lalela` | Default storage bucket |
| `MINIO_PUBLIC_URL` | ✅ | `https://storage.lalela.net` | Public URL for uploaded files |
| `ALLOWED_ORIGINS` | ✅ | `https://lalela.net,https://www.lalela.net` | CORS whitelist |
| `SMTP_HOST` | ✅ | `mail.lalela.net` | SMTP server |
| `SMTP_PORT` | ✅ | `587` | SMTP port |
| `SMTP_SECURE` | ✅ | `false` | TLS (false = STARTTLS on 587) |
| `SMTP_USER` | ✅ | `admin@lalela.net` | SMTP username |
| `SMTP_PASSWORD` | ✅ | secret | SMTP password |
| `SMTP_FROM` | ✅ | `Lalela <admin@lalela.net>` | From header |
| `SMS_PROVIDER` | ⬜ | `africastalking` | SMS provider |
| `AT_USERNAME` | ⬜ | `lalela` | Africa's Talking username |
| `AT_API_KEY` | ⬜ | key | Africa's Talking API key |
| `AT_SENDER_ID` | ⬜ | `LALELA` | SMS sender ID |
| `GOOGLE_MAPS_API_KEY` | ⬜ | key | Server-side geocoding |
| `GOOGLE_SA_PATH` | ⬜ | `/home/lalela/lalela/service-account/service-account.json` | Google service account for FCM REST v1 (Android push) |
| `FCM_PROJECT_ID` | ⬜ | `lalela-2e9d5` | Google Cloud project ID (FCM) |
| `APNS_KEY_PATH` | ⬜ | path to .p8 file | Apple push cert |
| `APNS_KEY_ID` | ⬜ | 10-char string | APNs key ID |
| `APNS_TEAM_ID` | ⬜ | 10-char string | Apple Developer team ID |
| `APNS_BUNDLE_ID` | ⬜ | `net.lalela.app` | App bundle ID |
| `APNS_PRODUCTION` | ⬜ | `true` | Use APNs production gateway |
| `APP_DEEP_LINK` | ⬜ | `lalela://` | Deep link scheme |

---

*This document is the source of truth for the future `deploy-vps.sh` automation script.*
