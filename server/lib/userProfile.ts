import type { Prisma } from '@prisma/client';

export const ME_USER_SELECT = {
  id: true, email: true, name: true, firstName: true, lastName: true,
  phone: true, mobileNumber: true, address: true, profileImage: true,
  emailVerified: true, phoneVerified: true, status: true, role: true,
  profileCompleted: true, communityCreated: true, onboardingCompleted: true,
  licenseStatus: true, trialExpiresAt: true,
  subscriptionActive: true, subscriptionRenewalDate: true, autoRenew: true,
  twoFactorEnabled: true, twoFactorMethod: true, loginAlertsEnabled: true,
  profileVisibility: true, piiVisibility: true,
  lastPasswordChanged: true, securityScore: true,
  locationSharing: true, isSecurityMember: true, emergencyLocationOptIn: true,
  latitude: true, longitude: true, lastCommunityId: true,
  agreedToTerms: true, marketingConsent: true,
  notificationPreferences: true,
  fcmToken: true, pushToken: true, pushPlatform: true,
  pendingInviteCode: true,
  passwordHash: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

type MeUserRecord = Prisma.UserGetPayload<{ select: typeof ME_USER_SELECT }>;

export function serializeMeUser(user: MeUserRecord) {
  const defaultLocation =
    user.latitude != null && user.longitude != null
      ? { name: user.address ?? '', latitude: user.latitude, longitude: user.longitude }
      : undefined;

  const { passwordHash, ...safeUser } = user;
  return { ...safeUser, hasPassword: passwordHash != null, defaultLocation };
}