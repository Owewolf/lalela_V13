# Lalela Native — Project Context

## What this is
React Native mobile app (iOS + Android, with Expo Web preview) for the Lalela
community platform. Built with Expo SDK 54, Expo Router v6, NativeWind v4, a
custom Express + Prisma + PostgreSQL API, and MinIO-backed media storage.
The production API runs at `https://api.wolfslair.cc/api`.

## Key tech
- **Expo SDK 54** / **expo-router v6** — file-based routing under `app/`
- **React 19.1** + **React Native 0.81.5** with the **New Architecture** enabled
- **NativeWind v4** + **Tailwind CSS v3** — utility classes via `className`
- **JWT auth + AsyncStorage session cache** — tokens and cached profile in
  `src/context/AuthContext.tsx`
- **Express + Prisma 7 + PostgreSQL** — API and persistence under `server/`
- **Socket.IO + WebRTC** (`react-native-webrtc`) — chat, presence, call signaling
- **MinIO object storage** — uploads go through the API upload endpoint
- **expo-notifications + direct APNs / FCM HTTP v1 delivery** — native push
  tokens registered through the API
- **`react-native-maps`** — Google Maps on Android, Apple MapKit on iOS
  (iOS intentionally leaves `provider` undefined; see [app.config.js](app.config.js))
- **`react-native-reanimated` v4** — Reanimated plugin in [babel.config.js](babel.config.js) is mandatory
- **`@google/genai`** — Gemini integration for AI-assisted features
- **`pdfkit` + `sharp`** — invoice/PDF generation and image processing on the server
- Always build with a **dev client** (`npm run android` / `npm run ios`); Expo Go is not enough

## Brand palette
| Token | Hex |
|---|---|
| Primary teal | `#0d3d47` |
| Orange accent | `#fc7127` / `#f97316` |
| Cream background | `#fff8f0` |

## Directory layout
```
app/                   # Expo Router routes (never import from here directly)
  _layout.tsx          # Root layout — AuthProvider, CommunityProvider, GoogleMapsProvider, CallProvider, AppGuard
  +html.tsx            # Web-only root HTML shell for static rendering
  landing.tsx          # Auth landing (re-exports src/components/auth/LandingPage)
  onboarding.tsx       # Profile onboarding flow
  onboarding-create.tsx # Community-creation onboarding flow
  join.tsx             # Invite / deep-link entry point
  notifications-settings.tsx
  security.tsx         # Account security hub
  (tabs)/              # Main authenticated tabs (renders null while auth loads)
    _layout.tsx
    index.tsx          # Home
    market.tsx         # Marketplace
    chat.tsx           # Chat list
    posts.tsx          # Posts / notices
    settings.tsx       # Settings
  admin.tsx            # Admin dashboard modal
  checkout.tsx         # Checkout modal
  pricing.tsx          # Pricing modal
  create-post.tsx      # Create post modal
  chat/[id].tsx        # Individual chat room
  emergency/[id].tsx   # Emergency detail
  call/[id].tsx        # Active call screen
src/
  context/
    AuthContext.tsx        # JWT auth state, profile cache, push-token registration
    CommunityContext.tsx   # REST + socket-backed community/post/chat/member state
    GoogleMapsContext.tsx  # Maps provider wrapper
    CallContext.tsx        # Call state and WebRTC signaling helpers
  lib/
    api.ts             # Axios client with token refresh
    config.ts          # Resolved API base URL / runtime config
    socket.ts          # Socket.IO client auth + connection lifecycle
    webrtc.ts          # WebRTC peer-connection helpers
    maps.ts            # Map helpers
    mapViewProps.ts    # Cross-platform MapView prop normalization
    uploadImage.ts     # Image upload helper (MinIO via API)
    migrateStorage.ts  # Legacy AsyncStorage key migration
    utils.ts
  components/
    auth/              # LandingPage, Onboarding, OnboardingCreate
    call/              # Call UI and incoming-call overlay
    home/              # HomePage, InteractiveCoverageMap
    market/            # MarketPage
    posts/             # PostsPage, CreatePostPage, CreateNoticeForm
    chat/              # ChatPage, ChatRoom, MessageComposer
    emergency/         # EmergencyHub, EmergencyMap
    settings/          # SettingsPage
    security/          # AccountSecurityPage + Profile/Sessions/AuditLogs/
                       # CommunityAccess/Licensing/Location/DangerZone sections
    admin/             # AdminDashboard, ModerationCenter
    shared/            # Header, MobileSidebar, NotificationCenter
  hooks/               # Reusable hooks
  services/            # Client-side service helpers
  mocks/               # Mock data used by some screens during development
  types/               # Domain-specific type declarations
  types.ts             # Shared TypeScript types
  constants.ts         # BUSINESS_CATEGORIES etc.
server/                # Express API (run separately, not bundled by Metro)
  index.ts             # Entry point — `npm run server`
  api.ts               # Main API router wiring
  db.ts                # Prisma client + public community helpers
  lib/urls.ts          # Default API base URL + link builders
  middleware/          # asyncHandler, auth (JWT), licenseCheck
  routes/              # auth, users, communities, conversations, businesses
  services/            # emailService, emailTemplates, pushService, smsService
  billing/             # routes, cronService, inviteService, invoiceService,
                       # paymentService, emailAssets
  generated/prisma/    # Generated Prisma client output (gitignored)
prisma/
  schema.prisma        # Database schema
  migrations/          # Prisma migrations
scripts/
  patch-google-places.js  # Runs in `postinstall` to patch react-native-google-places-autocomplete
  send-invoice-email.ts   # Manual invoice email utility
  send-test-emails.ts     # Manual SMTP test utility
deploy/                # nginx, coturn, and deploy notes
android/, ios/         # Native projects (managed by Expo prebuild)
.env                   # ⚠ gitignored — DB, JWT, SMTP, Maps, MinIO, APNs/FCM, Gemini keys
```

## Auth flow (email/password)
1. **Sign up** — client calls `POST /api/auth/register` via `AuthContext.register()`.
2. **Account creation** — server creates the user, hashes the password, issues
   a verification token, and sends an email via `server/services/emailService.ts`.
3. **Verification** — `GET /api/auth/verify-email` marks the token used, sets
   `emailVerified = true`, and redirects to the frontend or app deep link.
4. **Login** — `POST /api/auth/login` verifies credentials and returns
   `accessToken`, `refreshToken`, and a user payload.
5. **Session restore** — `AuthContext` stores tokens in AsyncStorage, restores
   the cached profile on boot, and refreshes `/users/me` via `src/lib/api.ts`.
6. **Refresh** — expired access tokens are renewed through `POST /api/auth/refresh`;
   refresh tokens are rotated server-side.

## Routing guard (`AppGuard` in [app/_layout.tsx](app/_layout.tsx))
- Renders nothing while auth bootstrap is still loading.
- Unauthenticated users are routed to `/landing` unless they are on a public
  onboarding/create or invite entry point.
- Authenticated users with `profileCompleted !== true` are routed to `/onboarding`.
- Authenticated, onboarded users are routed to `/(tabs)` unless they are already
  on an allowed modal/detail route.
- Push-token registration happens after sign-in on native devices and is sent to
  `PUT /api/users/me/push-token`.

[app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) returns `null` when auth is unresolved so authenticated
screens never render against missing user state.

## Backend shape
- **Database** — PostgreSQL via Prisma 7 ([server/db.ts](server/db.ts), [prisma/schema.prisma](prisma/schema.prisma)),
  using `@prisma/adapter-pg` over `pg`.
- **Auth** — JWT access/refresh tokens with server-side session rows; middleware
  in [server/middleware/auth.ts](server/middleware/auth.ts).
- **Licensing** — request-level enforcement in [server/middleware/licenseCheck.ts](server/middleware/licenseCheck.ts).
- **Storage** — MinIO-compatible object storage via the API upload route.
- **Realtime** — Socket.IO rooms + WebRTC signaling wired in [server/index.ts](server/index.ts).
- **Notifications** — APNs (iOS) via `@parse/node-apn` and FCM HTTP v1 (Android)
  in [server/services/pushService.ts](server/services/pushService.ts).
- **Messaging** — SMTP via Nodemailer and Africa's Talking SMS helpers.
- **Billing** — invoices, payments, invites, and cron jobs under [server/billing](server/billing).

## Server (Express API)
Runs as a standalone Node process and is **not** bundled into the mobile app.
Production base URL: `https://api.wolfslair.cc/api`.

Start with `npm run server` (or `npm run server:dev` for watch mode via `tsx watch`).

Key endpoints:
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`,
  `GET /api/auth/verify-email`
- `GET /api/users/me`, `PUT /api/users/me`, `PUT /api/users/me/push-token`
- `POST /api/upload` — uploads media to MinIO
- `GET /api/public/communities` — active communities for the landing-page map
- `GET /api/og-image?url=` — scrapes OG images (with SSRF protection)
- `POST /api/places-search` — Google Places nearby search proxy
- `/api/billing/*` — invoices, payments, invites (see [server/billing/routes.ts](server/billing/routes.ts))

## Building, running & deploying
- Android dev build: `npm run android` (uses bundled JDK from Android Studio snap)
- iOS local run: `npm run ios`
- Web preview: `npm run web`
- Web static export: `npm run build` (output in `dist/`)
- Type-check: `npm run lint` (runs `tsc --noEmit`)
- API server: `npm run server` / `npm run server:dev`
- Combined dev with iPhone (LAN) + tunnelled API: `npm run dev:iphone`
  (`dev:iphone:clean` first stops any running servers/tunnels)
- Stop dev processes: `npm run dev:stop`
- Prisma client generation: `npm run db:generate`
- Local schema migration: `npm run db:migrate`
- Push schema changes without migration files: `npm run db:push`
- `postinstall` auto-runs `prisma generate` and [scripts/patch-google-places.js](scripts/patch-google-places.js)
- EAS Preview build: `eas build --profile preview --platform android`
- EAS Production build: `eas build --profile production --platform android`
- Deploy helpers: [deploy-lalela.sh](deploy-lalela.sh), [ecosystem.config.js](ecosystem.config.js) (PM2), [deploy](deploy)

## Common gotchas
- **Always use `npm run android` / `npm run ios`** for native-device work;
  `expo start` alone is not enough for `react-native-maps`, `expo-notifications`,
  and WebRTC.
- iOS maps use **Apple MapKit** (no `provider` set); only Android passes a Google
  Maps API key via [app.config.js](app.config.js).
- `AuthContext` is the source of truth; any older compatibility hooks only exist
  to keep older call sites working during migration.
- `CommunityContext.tsx` is the live REST + Socket.IO implementation; any
  legacy backup files alongside it are reference only.
- `KeyboardAvoidingView` behavior must be `'height'` on Android and `'padding'` on iOS.
- Do not use React Native's `background` CSS shorthand; use `backgroundColor`.
- React/React DOM versions are pinned via `overrides` in [package.json](package.json) — keep
  them aligned with Expo SDK 54 requirements.
- `react-native-webrtc` is excluded from the Expo doctor `reactNativeDirectoryCheck`
  on purpose; do not re-enable it.
