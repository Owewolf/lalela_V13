/**
 * License check middleware.
 *
 * Provides:
 *   isLicenseValid(user) — pure helper for evaluating license state
 *   requireActiveLicense — Express middleware that blocks EXPIRED users from mutation routes
 */
import type { Request, Response, NextFunction } from 'express';
import prisma from '../db.js';

interface LicenseUser {
  licenseStatus: string;
  trialExpiresAt: Date | null;
  subscriptionActive: boolean;
  subscriptionRenewalDate: Date | null;
}

/** Returns true if the user currently has valid platform access. */
export function isLicenseValid(user: LicenseUser): boolean {
  const now = new Date();

  if (user.licenseStatus === 'TRIAL') {
    return !!user.trialExpiresAt && user.trialExpiresAt > now;
  }

  if (user.licenseStatus === 'ACTIVE') {
    return user.subscriptionActive && !!user.subscriptionRenewalDate && user.subscriptionRenewalDate > now;
  }

  return false; // EXPIRED or unknown
}

/**
 * Middleware: blocks requests from users whose trial or subscription has lapsed.
 * Only apply to write/mutation routes (posts, chat messages, etc.).
 * Read routes remain accessible so users can see their expired status.
 */
export async function requireActiveLicense(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      licenseStatus: true,
      trialExpiresAt: true,
      subscriptionActive: true,
      subscriptionRenewalDate: true,
    },
  });

  if (!user || !isLicenseValid(user)) {
    return res.status(403).json({
      error: 'LICENSE_EXPIRED',
      message:
        'Your platform access has expired. Subscribe for R99/year to continue.',
    });
  }

  return next();
}
