/**
 * SMS Service — Clickatell One API (primary) with Twilio fallback.
 *
 * Required env vars:
 *   SMS_PROVIDER         = "clickatell" | "twilio"  (default: clickatell)
 *   CLICKATELL_API_KEY   Clickatell One API key
 *   CLICKATELL_FROM      (optional) registered sender ID or long-code number
 *   TWILIO_ACCOUNT_SID   Twilio account SID (fallback)
 *   TWILIO_AUTH_TOKEN    Twilio auth token  (fallback)
 *   TWILIO_FROM_NUMBER   Twilio from number (fallback)
 */

// ─── Clickatell One API ───────────────────────────────────────────────────────
// Docs: https://help.clickatell.com/developers-api-reference/reference/one-api

async function sendViaClickatell(to: string, message: string): Promise<void> {
  const apiKey = process.env.CLICKATELL_API_KEY;

  if (!apiKey) {
    throw new Error('CLICKATELL_API_KEY must be set for Clickatell SMS');
  }

  const endpoint = 'https://platform.clickatell.com/v1/message';

  // One API expects E.164 WITHOUT the leading "+" (e.g. "27849002028").
  const recipient = to.replace(/^\+/, '');

  // One API payload: messages[] with channel/to/content.
  const msg: Record<string, unknown> = {
    channel: 'sms',
    to: recipient,
    content: message,
  };
  if (process.env.CLICKATELL_FROM) {
    msg.from = process.env.CLICKATELL_FROM;
  }
  const body = { messages: [msg] };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error('[Clickatell] request body that failed:', JSON.stringify(body));
    throw new Error(`Clickatell SMS failed: ${response.status} ${text}`);
  }

  let json: {
    error?: { code?: number; description?: string } | string | null;
    messages?: Array<{
      accepted?: boolean;
      apiMessageId?: string;
      to?: string;
      error?: { code?: number; description?: string } | string | null;
    }>;
  };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Clickatell SMS: invalid JSON response: ${text}`);
  }

  // Always log so delivery problems are diagnosable.
  console.log('[Clickatell] response:', JSON.stringify(json));

  const describeErr = (e: unknown): string => {
    if (!e) return 'unknown';
    if (typeof e === 'string') return e;
    if (typeof e === 'object') {
      const o = e as { code?: number; description?: string };
      return `${o.description ?? 'error'}${o.code !== undefined ? ` (code ${o.code})` : ''}`;
    }
    return String(e);
  };

  if (json.error) {
    throw new Error(`Clickatell: account-level error — ${describeErr(json.error)}`);
  }

  const m = json.messages?.[0];
  if (!m) {
    throw new Error('Clickatell: no message record returned');
  }

  if (m.accepted !== true) {
    throw new Error(`Clickatell: message not accepted — ${describeErr(m.error)}`);
  }
}

// ─── Twilio Fallback ──────────────────────────────────────────────────────────

async function sendViaTwilio(to: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
  });

  if (!response.ok) {
    const json = (await response.json()) as { message?: string };
    throw new Error(`Twilio SMS failed: ${json.message ?? response.status}`);
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export async function sendSms(to: string, message: string): Promise<void> {
  const provider = (process.env.SMS_PROVIDER ?? 'clickatell').toLowerCase();

  if (provider === 'twilio') {
    return sendViaTwilio(to, message);
  }
  return sendViaClickatell(to, message);
}

export function generateOtp(): string {
  // Cryptographically random 6-digit code
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}

// ─── OTP message builder ──────────────────────────────────────────────────────

/**
 * Build an OTP SMS message that is compatible with iOS Security Code AutoFill.
 * iOS detects codes when they appear early in a short, single-line message and
 * the app name (or a recognisable token) is present in the body.
 */
export function buildOtpMessage(code: string, purpose: string = 'login'): string {
  const action =
    purpose === 'reset'
      ? 'password reset'
      : purpose === 'link'
        ? 'phone linking'
        : purpose === 'signup'
          ? 'sign-up'
          : 'verification';
  return `Your Lalela ${action} code is ${code}. It expires in 10 minutes. Do not share it. Lalela`;
}

// ─── Invite message builder ───────────────────────────────────────────────────

export function buildInviteMessage(opts: { inviterName?: string | null; joinUrl: string }): string {
  const inviter = opts.inviterName?.trim() ? opts.inviterName.trim() : 'A neighbour';
  return `${inviter} invited you to join Lalela. Tap to accept: ${opts.joinUrl}`;
}
