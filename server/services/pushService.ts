/**
 * Push Notification Service — direct APNs (iOS) + FCM HTTP v1 (Android).
 * Bypasses Expo Push Service entirely. Sends raw device tokens.
 *
 * Required env vars:
 *   APNS_KEY_PATH       Path to Apple .p8 private key file
 *   APNS_KEY_ID         Apple Key ID (from Developer Portal)
 *   APNS_TEAM_ID        Apple Team ID
 *   APNS_BUNDLE_ID      App bundle ID (e.g. net.lalela.app)
 *   APNS_PRODUCTION     "true" for production APNs, "false" for sandbox (default: false)
 *
 *   GOOGLE_SA_PATH      Path to Google service account JSON (FCM-only scope)
 *   FCM_PROJECT_ID      Google Cloud messaging project ID (lalela-2e9d5)
 */

import fs from 'fs';
import apn from '@parse/node-apn';

// ─── APNs Provider (iOS) ──────────────────────────────────────────────────────

let _apnProvider: apn.Provider | null = null;

function getApnProvider(): apn.Provider {
  if (_apnProvider) return _apnProvider;

  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;

  if (!keyPath || !keyId || !teamId) {
    throw new Error('APNS_KEY_PATH, APNS_KEY_ID, and APNS_TEAM_ID must be set for iOS push');
  }

  _apnProvider = new apn.Provider({
    token: {
      key: keyPath,
      keyId,
      teamId,
    },
    production: process.env.APNS_PRODUCTION === 'true',
  });

  return _apnProvider;
}

async function sendApns(deviceToken: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const provider = getApnProvider();
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) throw new Error('APNS_BUNDLE_ID must be set');

  const note = new apn.Notification();
  note.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
  note.badge = 1;
  note.sound = 'default';
  note.alert = { title, body };
  note.topic = bundleId;
  if (data) note.payload = data;

  const result = await provider.send(note, deviceToken);
  if (result.failed.length > 0) {
    const err = result.failed[0];
    throw new Error(`APNs delivery failed: ${err.response?.reason ?? 'unknown'}`);
  }
}

// ─── FCM HTTP v1 (Android) ────────────────────────────────────────────────────

let _fcmAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(): Promise<string> {
  const now = Date.now();
  if (_fcmAccessToken && _fcmAccessToken.expiresAt > now + 60_000) {
    return _fcmAccessToken.token;
  }

  const saPath = process.env.GOOGLE_SA_PATH;
  if (!saPath) throw new Error('GOOGLE_SA_PATH must be set for Android push');

  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8')) as {
    client_email: string;
    private_key: string;
  };

  // Build JWT for Google OAuth2 token exchange
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat,
    })
  ).toString('base64url');

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claimSet}`);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${claimSet}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`FCM token fetch failed: ${tokenRes.status} ${text}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token: string; expires_in: number };
  _fcmAccessToken = {
    token: tokenJson.access_token,
    expiresAt: now + tokenJson.expires_in * 1000,
  };
  return _fcmAccessToken.token;
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const projectId = process.env.FCM_PROJECT_ID;
  if (!projectId) throw new Error('FCM_PROJECT_ID must be set');

  const accessToken = await getFcmAccessToken();

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          android: { priority: 'high' },
          data: data ?? {},
        },
      }),
    }
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: { message?: string } };
    throw new Error(`FCM send failed: ${json.error?.message ?? response.status}`);
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPush(
  deviceToken: string,
  platform: 'ios' | 'android',
  payload: PushPayload
): Promise<void> {
  if (platform === 'ios') {
    await sendApns(deviceToken, payload.title, payload.body, payload.data);
  } else {
    await sendFcm(deviceToken, payload.title, payload.body, payload.data);
  }
}

/**
 * Send a push notification to a user by userId.
 * Looks up push_token + push_platform from the DB.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const { default: db } = await import('../db.js') as unknown as { default: import('../generated/prisma/index.js').PrismaClient };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pushToken: true, pushPlatform: true },
  });

  if (!user?.pushToken || !user.pushPlatform) return; // no token registered

  await sendPush(user.pushToken, user.pushPlatform as 'ios' | 'android', payload);
}
