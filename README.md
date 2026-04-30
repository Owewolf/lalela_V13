<p align="center">
	<img src="images/lalela_logo.png" alt="Lalela logo" width="180" />
</p>

<h1 align="center">Lalela Community Platform</h1>

<p align="center">
	A modern community operating system for notices, local trade, messaging, and emergency coordination.
</p>

<p align="center">
	<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
	<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
	<img src="https://img.shields.io/badge/Vite-Fast%20Dev%20Server-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
	<img src="https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
</p>

---

## Overview

Lalela brings the operational side of a community into one place.

Instead of juggling chats, paper notices, separate business directories, and ad hoc emergency updates, the platform gives residents, moderators, and administrators a shared workspace to:

- publish and consume community notices
- browse and post local listings
- chat in context around posts, businesses, and incidents
- coordinate emergencies in a dedicated command view
- manage community roles, settings, and support workflows

The demo data currently centers on Parkwood and a small set of neighboring communities, but the architecture supports multiple communities, roles, and coverage areas.

## Product Highlights

### Community Feed

- Interactive home view with a coverage map
- Urgency-aware alerts and notices
- Quick access to emergency help and incident reporting
- Live location support for security and opted-in users

### Local Market

- Listings for goods and services
- Search, category filters, and featured views
- Map and list browsing
- Nearby ranking and distance-based discovery

### Contextual Chat

- Start conversations from listings and notices
- Keep posts and messages linked together
- Track unread conversations
- Support direct and group coordination

### Emergency Coordination

- Dedicated emergency hub
- Shared incident map and responder visibility
- Location sharing in chat for situational awareness
- High-priority coordination channel for active incidents

### Community Management

- Admin and moderator dashboard
- Account security and profile settings
- Charity management and suggestions
- Benefits and pricing flow for upgrades

## Screens

The repository currently includes brand assets rather than captured UI screenshots.

<p align="center">
	<img src="images/lalela_logo.png" alt="Lalela logo" width="320" />
</p>

If you want to add product screenshots later, place them in an `images/` subfolder and reference them here.

## Built With

- React 19
- TypeScript
- Vite
- Express
- Firebase Authentication and Firestore
- Leaflet and Google Maps
- Tailwind CSS
- Motion
- Lucide React

## Repo Structure

- [src/App.tsx](src/App.tsx) is the main application shell and route coordinator.
- [src/components/](src/components) contains the major product surfaces.
- [src/context/](src/context) provides Firebase, community, and maps state.
- [src/server/](src/server) contains the Express and API layer.
- [src/services/](src/services) contains service helpers.

## Getting Started

Requirements:

- Node.js 18 or newer

Install dependencies:

```bash
npm install
```

Start the app locally:

```bash
npm run dev
```

Open `http://localhost:3030` in your browser.

## Environment Variables

The app ships with bundled Firebase configuration, but you can override values locally with Vite environment variables.

Supported variables:

- `GEMINI_API_KEY` for AI-assisted business import tooling
- `VITE_GOOGLE_MAPS_API_KEY` for map features
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_DATABASE_ID`

## Common Commands

```bash
npm run build
npm run preview
npm run lint
```

## Notes

- The repo includes mock community data so the product can be explored without a full production backend.
- Emergency and location-aware flows are designed around community safety and rapid coordination.
- Some areas are role-aware, so admins, moderators, and regular members may see different capabilities.
