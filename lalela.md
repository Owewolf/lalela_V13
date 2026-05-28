# Lalela Native — Project Context

## What this is
Lalela Native is the Expo-based mobile app for the Lalela community platform, with iOS, Android, and Expo Web preview support. The app uses Expo SDK 54, Expo Router v6, NativeWind v4, a custom Express + Prisma + PostgreSQL API, and MinIO-backed media storage. The production API base URL is `https://api.wolfslair.cc/api`.

## Current stack
- **Expo SDK 54** and **Expo Router v6** for file-based routing under `app/`
- **React 19.1** and **React Native 0.81.5** with the New Architecture enabled
- **NativeWind v4** and **Tailwind CSS v3** for `className` styling
- **JWT auth + AsyncStorage session cache** in `src/context/AuthContext.tsx`
- **Express + Prisma 7 + PostgreSQL** for the server in `server/`
- **Socket.IO + react-native-webrtc** for chat, presence, location sharing, and call signaling
- **MinIO object storage** for uploaded media
- **expo-notifications + direct APNs / FCM HTTP v1** for push delivery
- **react-native-maps** with Android Google Maps and iOS Apple MapKit
- **react-native-reanimated v4** with the Reanimated Babel plugin enabled
- **@google/genai** for Gemini-backed AI features
- **pdfkit + sharp** for invoice and image processing on the server

## Theme and design system
Theme is centralized rather than scattered across screens.

### Theme files
- [src/theme/colors.ts](src/theme/colors.ts) exports `THEME_COLORS`, the app-wide token set for surfaces, text, status colors, borders, overlays, and brand accents.
- [src/theme/cardStyles.ts](src/theme/cardStyles.ts) provides `getCardSurfaceColor()`, `getCardBorderColor()`, and `getCardShadow()` so cards stay visually consistent across screens.
- [src/theme/shadows.ts](src/theme/shadows.ts) contains the shared `createShadow()` helper used throughout the app.
- [src/theme/layers.ts](src/theme/layers.ts) defines z-index/elevation constants for overlays and dropdowns.
- [src/theme/foundationThemes.ts](src/theme/foundationThemes.ts) holds the foundation theme preset data used by the theme layer.

### Styling pipeline
- [global.css](global.css) is intentionally minimal and only imports Tailwind layers.
- [tailwind.config.js](tailwind.config.js) uses `nativewind/preset`, scans `app/` and `src/`, and extends the palette with the Lalela token colors.
- `className` usage in components is translated by NativeWind at runtime; custom card look and feel is expected to come from the shared theme helpers and tokens.
- [app.config.js](app.config.js) uses a dynamic Expo config and now includes the `expo-font` plugin alongside `@config-plugins/react-native-webrtc`.

## App structure
The route layer is thin and mostly re-exports feature components.

### Routing and guard flow
- [app/_layout.tsx](app/_layout.tsx) wraps the app in `AuthProvider`, `CommunityProvider`, `ThemeProvider`, `GoogleMapsProvider`, and `CallProvider`.
- `AppGuard` in [app/_layout.tsx](app/_layout.tsx) keeps unauthenticated users on the landing flow, sends incomplete profiles to onboarding, and allows authenticated users into the tab shell and approved modal/detail routes.
- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) renders the floating tab bar and returns `null` while auth is unresolved so protected screens do not flash.

### Main routes
- [app/(tabs)/index.tsx](app/(tabs)/index.tsx) renders the home page.
- [app/(tabs)/market.tsx](app/(tabs)/market.tsx) renders the market page and accepts optional `listingId` and `businessId` query params.
- [app/(tabs)/settings.tsx](app/(tabs)/settings.tsx) renders the settings page.
- [app/(tabs)/posts.tsx](app/(tabs)/posts.tsx) renders the posts/notices feed.
- [app/(tabs)/chat.tsx](app/(tabs)/chat.tsx) renders chat.

## Screen behavior that matters now

### Home
- [src/components/home/HomePage.tsx](src/components/home/HomePage.tsx) uses a single scroll container with safe-area-aware bottom padding so content clears the fixed bottom menu.
- Home cards and list sections now use consistent spacing and lower-card padding so the owner row and other footer content stay visible above the tab bar.
- The listings section shows a two-column grid on the home page, with the three-dot menu moved next to the listing title, CAT pull shown in the action row, location on the right, and the owner avatar shown beside the owner name.
- Home uses map, notices, charity, and listings sections in one page, with the community/safety blocks above the listing grid.

### Market
- [src/components/market/MarketPage.tsx](src/components/market/MarketPage.tsx) powers the listings and businesses views.
- Listings are displayed in a list layout with listing detail modal support.
- Business cards use the shared card style helpers and keep the market/business surface language consistent.

### Settings
- [src/components/settings/SettingsPage.tsx](src/components/settings/SettingsPage.tsx) also uses safe-area-aware bottom spacing so the licensed-community section and lower cards can scroll fully past the tab bar.
- The settings page contains the profile identity card, community switcher, general settings, and the licensing/community panel.

### Posts and notices
- [src/components/posts/PostsPage.tsx](src/components/posts/PostsPage.tsx) is the main feed for notices and posts.
- The app has a shared bottom-tab shell, but individual pages still control their own card spacing and detail presentation.

## Backend shape
- **Database** — PostgreSQL via Prisma 7 in [server/db.ts](server/db.ts) and [prisma/schema.prisma](prisma/schema.prisma), using `@prisma/adapter-pg`.
- **Auth** — JWT access and refresh tokens with server-side session handling in [server/middleware/auth.ts](server/middleware/auth.ts).
- **Licensing** — request-level enforcement in [server/middleware/licenseCheck.ts](server/middleware/licenseCheck.ts).
- **Storage** — MinIO-compatible object storage through the API upload route.
- **Realtime** — Socket.IO rooms and WebRTC signaling in [server/index.ts](server/index.ts).
- **Notifications** — APNs for iOS and FCM HTTP v1 for Android in [server/services/pushService.ts](server/services/pushService.ts).
- **Messaging** — SMTP via Nodemailer plus Clickatell/Twilio SMS helpers in [server/services/smsService.ts](server/services/smsService.ts).
- **Billing** — invoices, payments, invites, and cron jobs under [server/billing](server/billing).

## SMS and push configuration
- The app no longer depends on `africastalking` at runtime.
- SMS is configured through `SMS_PROVIDER`, with Clickatell as the primary provider and Twilio as fallback in [server/services/smsService.ts](server/services/smsService.ts).
- Env examples in [`.env.example`](.env.example) now follow Clickatell + Twilio settings instead of Africa’s Talking.
- Push token registration happens after sign-in on native devices and is sent to `PUT /api/users/me/push-token`.

## Client architecture
- [src/context/AuthContext.tsx](src/context/AuthContext.tsx) is the source of truth for auth, profile caching, token refresh, and phone OTP helpers.
- [src/context/CommunityContext.tsx](src/context/CommunityContext.tsx) owns the live community, listings, notices, members, and chat state.
- [src/context/GoogleMapsContext.tsx](src/context/GoogleMapsContext.tsx) wraps map-specific setup.
- [src/context/CallContext.tsx](src/context/CallContext.tsx) owns call state and signaling helpers.
- [src/lib/api.ts](src/lib/api.ts) is the Axios client with token refresh handling.
- [src/lib/socket.ts](src/lib/socket.ts) manages Socket.IO connection lifecycle and auth.
- [src/lib/config.ts](src/lib/config.ts) resolves runtime API configuration.

## Directory layout
```
app/                   # Expo Router routes
  _layout.tsx          # Root layout and auth guard
  +html.tsx            # Web HTML shell
  landing.tsx          # Auth landing
  onboarding.tsx      # Profile onboarding
  onboarding-create.tsx # Community creation flow
  join.tsx             # Invite / deep-link entry point
  notifications-settings.tsx
  security.tsx         # Account security hub
  (tabs)/              # Main authenticated tabs
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
  context/             # Auth, Community, Maps, Call providers
  lib/                 # API, socket, config, maps, helpers
  components/          # Feature UI by domain
  hooks/               # Reusable hooks
  services/            # Client-side service helpers
  mocks/               # Dev/test mock data
  types/               # Domain-specific type declarations
  types.ts             # Shared types
  constants.ts         # Business categories and shared constants
server/                # Express API, separate from Metro
prisma/                # Prisma schema and migrations
scripts/               # Utilities and audits
deploy/                # nginx, coturn, and deploy notes
android/, ios/         # Native projects from Expo prebuild
global.css             # Tailwind base import
```

## Database and storage
- [prisma/schema.prisma](prisma/schema.prisma) defines the app schema and migrations in [prisma/migrations](prisma/migrations).
- Object uploads go through the API rather than directly from the client.
- The server includes helpers for public communities and community counts used by the landing map and dashboard surfaces.

## Build, run, and deploy
- `npm start` — Expo Metro dev server
- `npm run start:lan` — LAN mode for the dev client
- `npm run dev:iphone` — starts the server and Expo for LAN-based iPhone development
- `npm run dev:stop` — stops local dev processes
- `npm run server` / `npm run server:dev` — run the API server
- `npm run android` — Android dev build
- `npm run ios` — iOS dev client build
- `npm run web` — Expo web preview
- `npm run build` — static web export
- `npm run lint` — `tsc --noEmit`
- `npm run lint:theme-guard` — checks for hardcoded colors
- `npm run lint:card-guard` — checks for card-style literal misuse
- `npm run audit:theme-noncolor` — checks non-color style literals
- `npm run db:generate` — Prisma client generation
- `npm run db:migrate` — Prisma migrations
- `npm run db:push` — push schema without migration files
- `postinstall` runs Prisma generate and patch scripts automatically

## Common gotchas
- Use `npm run android` and `npm run ios` for native work; Expo Go is not enough for the current maps, notifications, and WebRTC setup.
- iOS maps intentionally use Apple MapKit; Android passes a Google Maps API key through [app.config.js](app.config.js).
- `react-native-webrtc` remains excluded from the Expo doctor React Native directory check on purpose.
- `KeyboardAvoidingView` behavior must still be platform-specific where used: `'padding'` on iOS and `'height'` on Android.
- The bottom tab bar is fixed/floating, so scroll containers on long pages should include enough bottom inset to keep footer content visible.

## Recent UI patterns to keep
- Listing cards on the home page are intentionally two-column and should keep the current spacing and card language.
- The home listing card currently places the three-dot menu beside the title, shows CAT pull in the action row, keeps the location button to the right, and shows the owner avatar next to the owner name.
- The settings page and home page both now use safe-area-aware bottom padding so their lower sections do not hide behind the menu bar.
