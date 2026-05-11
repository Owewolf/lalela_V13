<p align="center">
  <img src="lalela_colour.png" alt="Lalela logo" width="180" />
</p>

<h1 align="center">Lalela Community Platform</h1>

<p align="center">
  A mobile-first community operating system for neighbourhood notices, local trade, real-time messaging, emergency coordination, and WebRTC voice/video calls.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

---

## Description

Lalela replaces the fragmented tools most neighbourhoods rely on — group chats, paper notices, spreadsheets, ad-hoc phone trees — with a single platform where residents, community managers, and administrators share one workspace.

**What it solves:**

| Problem | Lalela feature |
|---|---|
| Notices get lost in group chats | Community feed with urgency-aware alerts |
| No local marketplace | Listings with map + category discovery |
| Emergency coordination is chaotic | Dedicated hub with live location + responder map |
| Voice/video calls need third-party apps | Built-in WebRTC calls with TURN relay |
| File sharing has no permanent home | MinIO object storage at `storage.lalela.net` |
| Admin has no dashboard | Role-aware admin + moderation centre |

**Primary features:**

- 📢 Community feed — notices, alerts, posts, incident reports
- 🛒 Local marketplace — listings, businesses, categories, map view
- 💬 Contextual chat — conversations linked to posts, listings, incidents
- 🚨 Emergency hub — incident map, live location sharing, responder coordination
- 📞 WebRTC voice & video calls — peer-to-peer with Coturn TURN fallback
- 🏘️ Multi-community — one app, multiple neighbourhoods, roles per community
- 🔔 Push notifications — APNs (iOS) + Android push (HTTP v1) via Google service account
- 🛡️ Admin dashboard — member management, moderation, community settings

---

## Tech Stack

### Mobile Frontend

| Technology | Version | Role |
|---|---|---|
| React Native | 0.81.5 | UI runtime |
| Expo SDK | 54 | Build tooling, device APIs |
| Expo Router | v6 | File-based navigation |
| NativeWind | v4 | Tailwind CSS utility classes in JSX |
| React Native Reanimated | 4.x | Animations |
| React Native Maps | 1.20.1 | Coverage and incident maps |
| react-native-webrtc | 124.x | Voice and video calls |
| Socket.io Client | 4.8 | Real-time events |
| TypeScript | 5.x | Static typing throughout |

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 22 | Server runtime |
| Express | 4.x | REST API framework |
| Socket.io | 4.8 | Real-time chat, location, WebRTC signaling |
| Prisma | 7.x | ORM + migration engine |
| `@prisma/adapter-pg` | 7.x | PostgreSQL adapter |
| jsonwebtoken | 9.x | JWT auth (access + refresh tokens) |
| Multer | 2.x | File upload handling |
| MinIO SDK | 8.x | Object storage client |
| Nodemailer | 8.x | SMTP transactional email |
| Africa's Talking | 0.8 | SMS OTP delivery |
| tsx | 4.x | TypeScript execution (dev + production) |

### Database & Storage

| Technology | Role |
|---|---|
| PostgreSQL 16 | Primary relational database |
| Prisma Migrations | Schema versioning and evolution |
| MinIO AIStor | S3-compatible object storage (images, videos, audio) |

### Infrastructure

| Technology | Role |
|---|---|
| Docker + Docker Compose | Containerised services (Postgres, MinIO, backend, pgAdmin, Coturn) |
| Nginx | Reverse proxy, SSL termination, WebSocket upgrade |
| Let's Encrypt / Certbot | Automated TLS certificates |
| Coturn | TURN server for WebRTC NAT traversal |
| EAS (Expo Application Services) | Cloud builds for Android (APK/AAB) and iOS (IPA) |
| Android push (HTTP v1 API) | Android push — via Google service account JSON |
| APNs | iOS push — via .p8 key |
| Fedora 42 VPS | Production hosting OS |

### Domain Layout

| Domain | Serves |
|---|---|
| `lalela.net` | Static landing page + API reverse proxy |
| `lalela.net/api/*` | Express REST API |
| `lalela.net/socket.io/*` | Socket.io WebSocket |
| `storage.lalela.net` | MinIO object storage (public reads) |

---

## Security

Lalela is no longer backed by a managed BaaS. The repository reflects a self-hosted architecture built around JWT auth, PostgreSQL, object storage, and direct push delivery. That changes the security model: infrastructure, secrets, and access control now live inside this codebase and deployment process.

**Current security posture:**

- JWT-based access and refresh tokens with server-side session rotation
- Prisma-backed PostgreSQL access instead of client-side database rules
- Direct APNs and Android push delivery using provider credentials stored outside the app bundle
- Object uploads routed through the API instead of exposing raw write credentials to clients
- Socket authentication tied to the same bearer token lifecycle as REST

**Operational best practices for this app:**

- Keep all signing keys, JWT secrets, SMTP credentials, APNs keys, and Google service-account files outside git and outside `public_html`
- Restrict CORS and deployment origins to known frontend domains in production
- Rotate refresh tokens on use and revoke sessions on sign-out or account deletion
- Gate write routes on authenticated server-side authorization checks rather than trusting client state
- Serve the frontend, API, storage, and WebSocket endpoints over TLS only
- Run dependency audits and type checks before deployment, and keep Prisma migrations in sync with production
- Treat uploaded media as untrusted input: validate type, size, and ownership before persisting or serving it
- Limit who can access server logs, PM2, tunnel credentials, database backups, and object-storage admin credentials

**Repository hygiene:**

- No committed cloud-function packages or legacy BaaS service-account files
- No checked-in agent skill packs that describe a different platform stack than the running application
- Documentation aligned to the current Express, Socket.io, PostgreSQL, MinIO, and native push architecture

---

## Installation (Local Development)

> For full VPS production deployment, see **[Build a Deployment Guide for VPS.md](Build%20a%20Deployment%20Guide%20for%20VPS.md)**.

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22.x |
| npm | 10.x |
| Docker + Docker Compose | Latest CE |
| Android Studio + JDK | For Android dev build |
| Expo CLI | Installed via `npx` |
| EAS CLI | `npm install -g eas-cli` |

### 1. Clone the repository

```bash
git clone https://github.com/Owewolf/lalela_V13.git
cd lalela_V13
```

### 2. Install dependencies

```bash
npm install
# postinstall automatically runs: prisma generate
```

### 3. Start backend services (Postgres, MinIO, pgAdmin, Coturn)

```bash
docker compose up -d
```

Verify all services are healthy:

```bash
docker compose ps
```

### 4. Set up environment variables

```bash
cp .env.example .env   # (or create .env manually)
nano .env
```

Minimum required variables for local dev:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:lalela123@localhost:5432/lalela
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=lalela
MINIO_SECRET_KEY=lalela123
MINIO_BUCKET=lalela
MINIO_PUBLIC_URL=http://localhost:9000
SMTP_HOST=mail.lalela.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@lalela.net
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=Lalela <admin@lalela.net>
```

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Start the backend server

```bash
npm run server:dev
# API available at http://localhost:4000
```

### 7. Start the mobile app (requires development client — not Expo Go)

```bash
npm run android
# or
npm run ios
```

> `react-native-maps` and `expo-notifications` require a **development client build**, not Expo Go.
> The first `npm run android` will build and install the dev client on your device/emulator automatically.

---

## Usage

### Key commands

| Command | Description |
|---|---|
| `npm run android` | Build and launch on Android (dev client) |
| `npm run ios` | Build and launch on iOS (dev client) |
| `npm run server` | Start Express + Socket.io backend |
| `npm run server:dev` | Start backend in watch mode (tsx watch) |
| `npm run build` | Export Expo web build to `dist/` |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm run db:generate` | Re-generate Prisma client |
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:push` | Push schema changes without migration files |
| `docker compose up -d` | Start all backend services |
| `docker compose logs -f backend` | Stream backend logs |

### EAS cloud builds (production)

```bash
# Android APK (preview)
eas build --platform android --profile preview

# Android AAB (production/Play Store)
eas build --platform android --profile production

# iOS IPA
eas build --platform ios --profile production
```

### Database admin

pgAdmin runs at `http://localhost:5050` when Docker Compose is up.
Login: `admin@lalela.net` / `lalela123` (change in production).

MinIO console runs at `http://localhost:9001`.

### Auth flow summary

1. **Sign up** → email verification sent → user stored in PostgreSQL (unverified)
2. **Click verification link** in email → account marked `emailVerified = true`
3. **Sign in** → server issues JWT access token (15 min) + refresh token (30 days)
4. **JWT stored** in AsyncStorage → attached to every API + Socket.io request
5. **Onboarding completed** → `profileCompleted = true` → routed to `/(tabs)` main app

---

## Project Structure

```
app/                    # Expo Router routes (file-based navigation)
  _layout.tsx           # Root layout — AuthProvider, CommunityProvider, AppGuard
  (tabs)/               # Authenticated tab screens
    index.tsx           # Home feed
    market.tsx          # Marketplace
    chat.tsx            # Chat list
    posts.tsx           # Notices
    settings.tsx        # Settings
  admin.tsx             # Admin dashboard (modal)
  chat/[id].tsx         # Individual chat room
  emergency/[id].tsx    # Emergency detail

src/
  context/
    AuthContext.tsx      # JWT auth state — signIn, signOut, userProfile, tokens
    CommunityContext.tsx # Communities, posts, chat, members (REST + Socket.io)
    GoogleMapsContext.tsx# Maps provider stub
  components/           # Feature components (home, market, chat, emergency, admin…)
  lib/
    api.ts              # Axios instance with JWT Authorization header
    socket.ts           # Socket.io client singleton
  types.ts              # All shared TypeScript types
  constants.ts          # BUSINESS_CATEGORIES, etc.

server/                 # Express API (standalone Node process)
  index.ts              # Entry — HTTP server + Socket.io
  api.ts                # Route aggregator
  db.ts                 # Prisma client singleton
  routes/               # auth, users, communities, conversations, businesses
  services/             # pushService (APNs + FCM REST)
  middleware/           # JWT auth middleware

prisma/
  schema.prisma         # Database schema
  migrations/           # Migration history

deploy/
  nginx.conf            # Production Nginx config (lalela.net + storage.lalela.net)
  deploy.sh             # CI build + EAS queue script
  lalela-static/        # Built static web assets

docker-compose.yml      # All backend services
Dockerfile.server       # Backend Docker image (Node 22 alpine, multi-stage)
```

---

## Contributing

### Getting set up

1. Fork the repository and clone your fork
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Follow the [Installation](#installation-local-development) steps above
4. Make your changes, keeping the scope focused

### Coding standards

- **TypeScript** is mandatory — `npm run lint` must pass with no errors before committing
- **NativeWind / Tailwind** for all styling — no inline `StyleSheet.create` for new components
- **Prisma** for all database access — no raw SQL in application code
- Follow the existing naming convention: Prisma fields `camelCase`, DB columns `snake_case` via `@map`
- `KeyboardAvoidingView` behavior: `'height'` on Android, `'padding'` on iOS
- All API calls go through `src/lib/api.ts` (Axios with JWT header) — do not call `fetch` directly
- All real-time events go through `src/lib/socket.ts` — do not create additional Socket.io instances

### Commit messages

Use conventional commit format:

```
feat: add emergency broadcast to community rooms
fix: correct KAV behavior on Android login screen
chore: update Prisma to 7.9.0
```

### Pull requests

- Target the `main` branch
- Include a short description of the change and why
- Ensure `npm run lint` passes
- For schema changes, include the generated migration file

---

## Licensing

This project is **proprietary software** owned by Lalela (Pty) Ltd.

All rights reserved. Unauthorised copying, distribution, modification, or use of this software — in whole or in part — without explicit written permission from Lalela (Pty) Ltd is strictly prohibited.

The MinIO AIStor component used in this project is governed by the [MinIO AIStor License](minio.license). A valid MinIO license file must be present at the path specified in `docker-compose.yml`.

---

## Contact

| Role | Contact |
|---|---|
| Platform maintainer | admin@lalela.net |
| Technical issues | Open a GitHub issue on [Owewolf/lalela_V13](https://github.com/Owewolf/lalela_V13/issues) |
| Business enquiries | admin@lalela.net |

---

<p align="center">
  Built with ❤️ for safer, better-connected communities.
</p>
