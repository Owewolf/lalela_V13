/**
 * Shared licensing predicates aligned with `Pricing Licensing Model.md`.
 *
 * Backend states (source of truth):
 *   Community:  type = 'TRIAL' | 'ACTIVE'   (+ isPaid, trialExpiresAt, activatedAt)
 *   User:       licenseStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'UNLICENSED'
 *               (+ subscriptionActive, subscriptionRenewalDate, trialExpiresAt)
 *
 * Use these helpers everywhere the UI needs to decide whether a community
 * or a user is "currently active". Never compare against the legacy 'LICENSED'
 * string in the UI — the backend no longer issues it.
 */

type CommunityLike = {
  type?: string;
  isPaid?: boolean;
  trialExpiresAt?: string | Date | null;
} | null | undefined;

type UserLike = {
  licenseStatus?: string;
  subscriptionActive?: boolean;
  subscriptionRenewalDate?: string | Date | null;
  trialExpiresAt?: string | Date | null;
} | null | undefined;

export type PlatformMembershipStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED';
export type CommunityLicenseStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED';

/** True when the community is permanently activated OR inside its 30-day trial window. */
export function isCommunityActive(c: CommunityLike): boolean {
  if (!c) return false;
  if (c.isPaid === true) return true;
  if (c.type === 'ACTIVE') return true;
  if (c.type === 'TRIAL' && c.trialExpiresAt) {
    return new Date(c.trialExpiresAt) > new Date();
  }
  return false;
}

/** True when the community is in its 30-day trial window (not yet paid). */
export function isCommunityTrial(c: CommunityLike): boolean {
  if (!c || c.isPaid === true || c.type === 'ACTIVE') return false;
  if (c.type === 'TRIAL' && c.trialExpiresAt) {
    return new Date(c.trialExpiresAt) > new Date();
  }
  return false;
}

/**
 * True only when the community has been *licensed* (R999 once-off paid).
 * A community in its 30-day trial window is NOT considered licensed.
 * Use this for badge display — surfaces that must read "Active" only after
 * payment, and "Trial"/"Unlicensed" while still on trial.
 */
export function isCommunityLicensed(c: CommunityLike): boolean {
  if (!c) return false;
  return c.isPaid === true || c.type === 'ACTIVE';
}

/** Canonical selected-community status for status chips (Active/Trial/Expired). */
export function getCommunityLicenseStatus(c: CommunityLike): CommunityLicenseStatus {
  if (isCommunityLicensed(c)) return 'ACTIVE';
  if (isCommunityTrial(c)) return 'TRIAL';
  return 'EXPIRED';
}

/** True when the user's *own* platform membership is active (paid R99/year, not expired). */
export function isUserSubscriptionActive(u: UserLike): boolean {
  if (!u) return false;
  if (u.licenseStatus !== 'ACTIVE') return false;
  if (u.subscriptionActive !== true) return false;
  if (!u.subscriptionRenewalDate) return false;
  return new Date(u.subscriptionRenewalDate) > new Date();
}

/** True when the user is inside their 1-year free membership trial. */
export function isUserTrial(u: UserLike): boolean {
  if (!u || u.licenseStatus !== 'TRIAL') return false;
  if (!u.trialExpiresAt) return false;
  return new Date(u.trialExpiresAt) > new Date();
}

/**
 * True when the user currently has platform access — either via an active
 * paid subscription, an active 1-year trial, or by being inside an active
 * community (community-granted access during community trial/active).
 *
 * This is what drives the green avatar ring and "Active subscription" pills.
 */
export function isUserLicensed(u: UserLike, c?: CommunityLike): boolean {
  if (isUserSubscriptionActive(u)) return true;
  if (isUserTrial(u)) return true;
  if (c && isCommunityActive(c)) return true;
  return false;
}

/** True when the user has an active paid platform membership (R99/year). */
export function isUserPaidMembershipActive(u: UserLike): boolean {
  return isUserSubscriptionActive(u);
}

/**
 * Returns the canonical platform membership status used by UI surfaces.
 *
 * Rules:
 * - ACTIVE: user has an active paid membership.
 * - TRIAL: user has a valid personal trial OR is in an active community.
 * - EXPIRED: neither paid membership nor trial access is active.
 */
export function getPlatformMembershipStatus(
  u: UserLike,
  c?: CommunityLike,
): PlatformMembershipStatus {
  if (isUserSubscriptionActive(u)) return 'ACTIVE';
  if (isUserTrial(u)) return 'TRIAL';
  if (c && isCommunityActive(c)) return 'TRIAL';
  return 'EXPIRED';
}
