/**
 * SMS Service — Africa's Talking (primary) with Twilio fallback.
 *
 * Required env vars:
 *   SMS_PROVIDER        = "africastalking" | "twilio"  (default: africastalking)
 *   AT_API_KEY          Africa's Talking API key
 *   AT_USERNAME         Africa's Talking username (use "sandbox" for testing)
 *   AT_SENDER_ID        (optional) shortcode or alphanumeric sender
 *   TWILIO_ACCOUNT_SID  Twilio account SID (fallback)
 *   TWILIO_AUTH_TOKEN   Twilio auth token (fallback)
 *   TWILIO_FROM_NUMBER  Twilio from number (fallback)
 */

// ─── Africa's Talking ─────────────────────────────────────────────────────────

async function sendViaAT(to: string, message: string): Promise<void> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    throw new Error('AT_API_KEY and AT_USERNAME must be set for Africa\'s Talking SMS');
  }

  // Africa's Talking v3 uses a simple REST API
  const endpoint =
    username === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

  const params = new URLSearchParams({
    username,
    to,
    message,
    ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey,
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Africa's Talking SMS failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { SMSMessageData?: { Recipients?: Array<{ status: string }> } };
  const recipient = json.SMSMessageData?.Recipients?.[0];
  if (recipient && recipient.status !== 'Success') {
    throw new Error(`Africa's Talking: message not delivered — status: ${recipient.status}`);
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
  const provider = (process.env.SMS_PROVIDER ?? 'africastalking').toLowerCase();

  if (provider === 'twilio') {
    return sendViaTwilio(to, message);
  }
  return sendViaAT(to, message);
}

export function generateOtp(): string {
  // Cryptographically random 6-digit code
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}
