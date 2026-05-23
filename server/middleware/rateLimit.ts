/**
 * Rate limiters for sensitive auth endpoints.
 *
 * Keys are IP + identifier (phone / userId / email) where applicable, so an
 * attacker rotating phones from one IP, or one phone across many IPs, is still
 * throttled.
 */
import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';

function ipKey(req: Request): string {
  return req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown';
}

const common: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Phone OTP send/verify limiter — 5 per 10 minutes, keyed on IP + phone.
 * Applied to /phone/send-otp, /phone/send-reset-otp, /auth/link-phone.
 */
export const otpRateLimiter = rateLimit({
  ...common,
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests. Please wait before trying again.' },
  keyGenerator: (req) => {
    const phone =
      (req.body && (req.body.phone as string | undefined)) ??
      'no-phone';
    return `${ipKey(req)}:${phone}`;
  },
});

/**
 * Password-reset limiter — 5 per hour, keyed on IP + identifier (email or phone).
 */
export const passwordResetRateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please wait before trying again.' },
  keyGenerator: (req) => {
    const id =
      (req.body && ((req.body.email as string | undefined) ?? (req.body.phone as string | undefined))) ??
      'no-id';
    return `${ipKey(req)}:${id}`;
  },
});

/**
 * SMS invite limiter — 20 per hour, keyed on authenticated userId (falls back to IP).
 */
export const inviteRateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many invites sent. Please try again later.' },
  keyGenerator: (req) => req.auth?.userId ?? ipKey(req),
});
