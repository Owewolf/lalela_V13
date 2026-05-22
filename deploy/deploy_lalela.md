# Lalela — Go-Live Deployment Guide
# lalela.net · api.wolfslair.cc

> **Architecture at a glance**
>
> | Layer | Where | How |
> |---|---|---|
> | Frontend (static web) | cPanel shared hosting — `public_html` on lalela.net | Upload `lalela-static.zip` |
> | Backend API + Socket.io | Your local machine — port 4000 | PM2 keeps it alive |
> | Cloudflare Tunnel | Local machine → api.wolfslair.cc | PM2 keeps cloudflared alive |
> | Database | Local machine — Docker PostgreSQL | `docker-compose up -d` |
> | File storage | Local machine — Docker MinIO | `docker-compose up -d` |
>
> **Key deployment constraint:** the backend now runs on infrastructure you control. Your machine or server must be **on and connected** at all times, and PM2 + Cloudflare Tunnel keep the API reachable.

---

## Prerequisites Checklist

- [ ] `cloudflared` is installed (`which cloudflared`)
- [ ] Tunnel `4b361416-2b2f-4865-b5a2-e5a4d003b579` is created in your Cloudflare account
- [ ] Credentials file exists: `~/.cloudflared/4b361416-2b2f-4865-b5a2-e5a4d003b579.json`
- [ ] `docker` and `docker compose` are installed
- [ ] `docker-compose up -d` has been run — PostgreSQL and MinIO are healthy
- [ ] Prisma migrations are up to date: `npm run db:migrate` (run once)
- [ ] `.env` at project root is filled with production values (see Section 3)
- [ ] `lalela.net` DNS is managed by Cloudflare

---

## 1 — Cloudflare Tunnel Configuration

### 1.1 Update `~/.cloudflared/config.yml`

Open (or create) `~/.cloudflared/config.yml` and set it to exactly:

```yaml
tunnel: 4b361416-2b2f-4865-b5a2-e5a4d003b579
credentials-file: /home/<YOUR_USER>/.cloudflared/4b361416-2b2f-4865-b5a2-e5a4d003b579.json

ingress:
  # Lalela API (primary production domain)
  - hostname: api.wolfslair.cc
    service: http://localhost:4000

  # Dev/personal API domain (keep for continuity)
  - hostname: api.wolfslair.cc
    service: http://localhost:4000

  # Home Assistant (unchanged)
  - hostname: home.wolfslair.cc
    service: http://localhost:8123

  # Catch-all — must be last
  - service: http_status:404
```

Replace `<YOUR_USER>` with your Linux username (e.g. `wolf`).

### 1.2 Add CNAME in Cloudflare Dashboard

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select the **lalela.net** zone
3. Go to **DNS → Records → Add record**
4. Fill in:

   | Field | Value |
   |---|---|
   | Type | `CNAME` |
   | Name | `api` |
   | Target | `4b361416-2b2f-4865-b5a2-e5a4d003b579.cfargotunnel.com` |
   | Proxy status | **Proxied** (orange cloud — ON) |
   | TTL | Auto |

5. Click **Save**

> The CNAME must be **proxied** (orange cloud). If you set it to DNS-only (grey cloud) the tunnel will not work.

### 1.3 Verify the tunnel route

```bash
cloudflared tunnel info 4b361416-2b2f-4865-b5a2-e5a4d003b579
```

You should see `api.wolfslair.cc` listed as a hostname.

---

## 2 — PM2 Setup (backend + tunnel process manager)

PM2 keeps both the Express server and the Cloudflare Tunnel alive and restarts them on crash or machine reboot.

### 2.1 Install PM2

```bash
npm install -g pm2
```

Verify:

```bash
pm2 --version
```

### 2.2 Start both processes

From the project root (`/home/wolf/Projects/lalela/lalela_platformV2`):

```bash
pm2 start ecosystem.config.js
```

You should see output like:

```
┌──────────────────┬────┬──────┬──────────┐
│ name             │ id │ mode │ status   │
├──────────────────┼────┼──────┼──────────┤
│ lalela-server    │ 0  │ fork │ online   │
│ lalela-tunnel    │ 1  │ fork │ online   │
└──────────────────┴────┴──────┴──────────┘
```

### 2.3 Save the process list (survives reboots)

```bash
pm2 save
```

### 2.4 Enable PM2 startup on boot

```bash
pm2 startup
```

PM2 will print a command like:

```
sudo env PATH=... pm2 startup systemd -u wolf --hp /home/wolf
```

**Copy and run that exact command.** This is the only step that requires `sudo`.

### 2.5 Useful PM2 commands

```bash
pm2 status                        # show all processes
pm2 logs lalela-server            # live server logs
pm2 logs lalela-tunnel            # live tunnel logs
pm2 restart lalela-server         # restart after .env changes
pm2 restart lalela-tunnel         # restart after config.yml changes
pm2 restart all                   # restart everything
pm2 monit                         # real-time dashboard
```

---

## 3 — Backend `.env` (Production Values)

The `.env` at the project root is loaded by PM2 via `env_file: '.env'` in `ecosystem.config.js`. It is **never** uploaded to cPanel or committed to git.

Minimum required values for production:

```bash
# Server
PORT=4000
NODE_ENV=production
ALLOWED_ORIGINS=https://lalela.net,https://api.wolfslair.cc

# Database (docker-compose default — change password in production)
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD@localhost:5432/lalela

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<different-64-char-hex>

# Email (SMTP via mail.lalela.net)
SMTP_HOST=mail.lalela.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@lalela.net
SMTP_PASSWORD=<your-smtp-password>
SMTP_FROM=Lalela <admin@lalela.net>

# API base URL (used in outgoing email links)
API_BASE_URL=https://api.wolfslair.cc/api

# App deep link (email verification redirect)
APP_DEEP_LINK=lalela://verified

# MinIO (docker-compose)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=lalela
MINIO_SECRET_KEY=<strong-password>
MINIO_BUCKET=lalela
MINIO_PUBLIC_URL=https://storage.lalela.net   # <-- update if you expose MinIO publicly

# Google Maps (for Places search endpoint)
GOOGLE_MAPS_API_KEY=<your-key>

# Push notifications — iOS
APNS_KEY_PATH=/etc/lalela/apns.p8
APNS_KEY_ID=<key-id>
APNS_TEAM_ID=<team-id>
APNS_BUNDLE_ID=net.lalela.app
APNS_PRODUCTION=true

# Push notifications — Android
GOOGLE_SA_PATH=/etc/lalela/google-sa.json
FCM_PROJECT_ID=lalela-2e9d5

# SMS (Africa's Talking)
SMS_PROVIDER=africastalking
AT_API_KEY=<your-key>
AT_USERNAME=lalela
```

After editing `.env`, apply it:

```bash
pm2 restart lalela-server
```

---

## 4 — Build & Package Frontend

From the project root, run the build script:

```bash
./deploy-lalela.sh
```

This will:
1. Type-check the codebase (`tsc --noEmit`)
2. Run `npm audit` (warns but does not block)
3. Build the web app with `EXPO_PUBLIC_API_URL=https://api.wolfslair.cc/api` baked in
4. Inject `.htaccess` into `dist/` for SPA routing
5. Remove source maps and dev artifacts
6. Create `lalela-static.zip` (latest) and `lalela-static-vX.X.X.zip` (versioned)

Output:

```
lalela-static.zip            ← upload this
lalela-static-v1.1.0.zip     ← keep as a versioned backup
```

### Override version

```bash
VERSION=1.2.0 ./deploy-lalela.sh
```

---

## 5 — Upload to cPanel (lalela.net)

### Via File Manager (recommended)

1. Log in to cPanel at your host's control panel URL
2. Open **File Manager**
3. Navigate to **`public_html`**
4. Click **Upload** → select `lalela-static.zip`
5. Wait for upload to complete
6. Right-click `lalela-static.zip` → **Extract**
7. In the extract dialog, set the path to `public_html` (it extracts into `dist/` by default — see note below)
8. Click **Extract File(s)**
9. If the files ended up in `public_html/dist/`, move them up one level: select all files inside `dist/` → **Move** → destination: `/public_html`
10. Confirm `public_html/index.html` and `public_html/.htaccess` are visible

> **Tip:** Before extracting, delete the old `index.html` and `assets/` to avoid stale file conflicts.

### Via FTP / SFTP

```bash
# Upload
scp lalela-static.zip YOUR_CPANEL_FTP_USER@lalela.net:~/public_html/

# Then SSH in (if your host allows it) and extract:
cd ~/public_html
unzip -o lalela-static.zip
mv dist/* .
rm -rf dist lalela-static.zip
```

---

## 6 — Post-Deployment Verification Checklist

Run these checks after uploading and confirming the backend is online.

### Backend health

```bash
curl https://api.wolfslair.cc/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Frontend loads

Open `https://lalela.net` in a browser.

- [ ] Site loads without blank screen
- [ ] No CORS errors in browser DevTools → Console
- [ ] Login page (`/landing`) renders correctly

### Auth flow

- [ ] Register a new account → verification email arrives
- [ ] Click verification link → redirected correctly
- [ ] Login → JWT issued, app opens to home tab

### Real-time (Socket.io)

Open browser DevTools → Network → filter by **WS**:

- [ ] A WebSocket connection appears to `wss://api.wolfslair.cc`
- [ ] It stays open (not repeatedly reconnecting)

### File uploads

- [ ] Profile photo upload completes without error
- [ ] Uploaded image displays correctly (check URL is from `MINIO_PUBLIC_URL`)

### Invite links (Admin)

- [ ] Admin → Moderation Center → Community invite link shows `api.wolfslair.cc` domain (not `api.wolfslair.cc`)

---

## 7 — What Is NOT in `public_html`

| Item | Reason |
|---|---|
| `node_modules/` | Server-side — never in web root |
| `.env` | Contains secrets |
| `server/` | Backend source code |
| `service-account/` | Google service-account credentials for Android push |
| `api/invitations/email/index.php` | Removed — Express handles email now |
| PHPMailer | Removed — no PHP runtime needed |
| Source maps (`*.map`) | Stripped by build script |
| `src/`, `app/`, `prisma/` | Source code — build artifacts only go to cPanel |

---

## 8 — Keeping the Service Running

Your machine must be **on and connected to the internet** for lalela.net to work.

| Scenario | Effect | Fix |
|---|---|---|
| Machine powered off | Site loads (static), API calls fail | Power on → `pm2 status` (auto-restarts) |
| Machine reboots | PM2 auto-starts both processes (if `pm2 startup` was run) | Verify with `pm2 status` after boot |
| `lalela-server` crashes | PM2 restarts it (max 10 times) | `pm2 logs lalela-server` to diagnose |
| Tunnel disconnects | PM2 restarts cloudflared | `pm2 logs lalela-tunnel` to diagnose |
| `.env` changed | Restart manually | `pm2 restart lalela-server` |
| `config.yml` changed | Restart tunnel | `pm2 restart lalela-tunnel` |

---

## 9 — Re-deploying (Updates)

For every code change you want to go live:

```bash
# 1. Build + package
./deploy-lalela.sh

# 2. Upload lalela-static.zip to cPanel and extract (step 5 above)

# 3. If server code changed, restart the backend
pm2 restart lalela-server
```

Frontend-only changes (UI, styles) only require steps 1 and 2.
Backend-only changes only require step 3 — no new zip needed.

---

## Quick Reference Card

```bash
# Build + package frontend
./deploy-lalela.sh

# PM2 — start everything
pm2 start ecosystem.config.js && pm2 save

# PM2 — check status
pm2 status

# PM2 — restart after env change
pm2 restart lalela-server

# Verify API is live
curl https://api.wolfslair.cc/api/health

# View server logs (live)
pm2 logs lalela-server

# View tunnel logs (live)
pm2 logs lalela-tunnel

# Migrate DB (run once, or after schema changes)
npm run db:migrate

# Start Docker services
docker compose up -d
```
