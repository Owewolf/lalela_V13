/**
 * Invite link helper — get or create a community invite link for use in emails.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '../generated/prisma/index.js';
import { getAppBaseUrl } from '../lib/urls.js';

const APP_URL = () => getAppBaseUrl();

export async function getOrCreateCommunityInviteLink(
  prisma: PrismaClient,
  communityId: string,
  userId: string,
): Promise<string> {
  // Reuse an existing active, non-expired link if one exists
  const existing = await prisma.communityInviteLink.findFirst({
    where: {
      communityId,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return `${APP_URL()}/join?join=${existing.code}`;
  }

  const link = await prisma.communityInviteLink.create({
    data: {
      communityId,
      createdBy: userId,
      code: randomUUID(),
      role: 'MEMBER',
      active: true,
    },
  });

  return `${APP_URL()}/join?join=${link.code}`;
}
