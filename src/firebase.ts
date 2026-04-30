/**
 * src/firebase.ts — Firebase SDK removed.
 *
 * All auth, database, and storage functionality now goes through:
 *   Auth     → src/context/AuthContext.tsx  (JWT via REST API)
 *   Database → src/lib/api.ts               (axios + REST)
 *   Realtime → src/lib/socket.ts            (Socket.io)
 *   Storage  → src/lib/uploadImage.ts       (MinIO via /api/upload)
 *
 * This file is kept as an empty module so any stale imports resolve without
 * build errors while the remaining files are being migrated.
 */

export const auth: any = null;
export const db: any = null;
export const storage: any = null;
export const functions: any = null;
