import prisma from '../db.js';
import { sendPushToUser, type PushPayload } from './pushService.js';

type NotificationPreferenceCategory =
  | 'generalNotices'
  | 'listingUpdates'
  | 'communityActivity'
  | 'businessActivity'
  | 'charitySuggestions'
  | 'securityAlerts';

type CommunityNotificationOverride = Partial<
  Record<NotificationPreferenceCategory, boolean>
>;

type NotificationPreferences = {
  globalEnabled: boolean;
  generalNotices: boolean;
  listingUpdates: boolean;
  communityActivity: boolean;
  businessActivity: boolean;
  charitySuggestions: boolean;
  securityAlerts: boolean;
  priorityCommunityIds: string[];
  communityOverrides?: Record<string, CommunityNotificationOverride>;
};

type NotificationEmitter = (userId: string, notification: any) => void;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  globalEnabled: true,
  generalNotices: true,
  listingUpdates: true,
  communityActivity: true,
  businessActivity: true,
  charitySuggestions: true,
  securityAlerts: true,
  priorityCommunityIds: [],
  communityOverrides: {},
};

let emitNotification: NotificationEmitter | null = null;

export function registerNotificationEmitter(emitter: NotificationEmitter) {
  emitNotification = emitter;
}

function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(raw as Partial<NotificationPreferences>),
    communityOverrides: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.communityOverrides,
      ...((raw as Partial<NotificationPreferences>).communityOverrides ?? {}),
    },
  };
}

function isCategoryEnabled(
  preferencesRaw: unknown,
  category: NotificationPreferenceCategory,
  communityId: string | undefined,
  mandatory: boolean,
) {
  if (mandatory) return true;

  const preferences = normalizeNotificationPreferences(preferencesRaw);
  if (!preferences.globalEnabled) return false;

  if (communityId) {
    const override = preferences.communityOverrides?.[communityId];
    if (override && typeof override[category] === 'boolean') {
      return override[category] as boolean;
    }
  }

  return preferences[category];
}

function normalizePushPayload(
  payload: PushPayload | undefined,
  title: string,
  message: string,
): PushPayload {
  return {
    title: payload?.title ?? title,
    body: payload?.body ?? message,
    data: payload?.data,
  };
}

export async function createNotificationForUsers(options: {
  recipientUserIds: string[];
  actorUserId?: string;
  communityId?: string;
  category: NotificationPreferenceCategory;
  mandatory?: boolean;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  push?: PushPayload;
}) {
  const uniqueRecipients = Array.from(
    new Set(
      options.recipientUserIds.filter(
        (userId) => !!userId && userId !== options.actorUserId,
      ),
    ),
  );

  if (uniqueRecipients.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueRecipients } },
    select: { id: true, notificationPreferences: true },
  });

  const eligibleRecipients = users.filter((user) =>
    isCategoryEnabled(
      user.notificationPreferences,
      options.category,
      options.communityId,
      options.mandatory ?? false,
    ),
  );

  if (eligibleRecipients.length === 0) return [];

  const createdNotifications = await Promise.all(
    eligibleRecipients.map((user) =>
      prisma.notification.create({
        data: {
          userId: user.id,
          type: options.type,
          title: options.title,
          message: options.message,
          metadata: options.metadata as any,
        },
      }),
    ),
  );

  const pushPayload = normalizePushPayload(
    options.push,
    options.title,
    options.message,
  );

  await Promise.allSettled(
    createdNotifications.map(async (notification) => {
      emitNotification?.(notification.userId, notification);
      await sendPushToUser(notification.userId, pushPayload);
    }),
  );

  return createdNotifications;
}

export async function notifyCommunityMembers(options: {
  communityId: string;
  actorUserId?: string;
  category: NotificationPreferenceCategory;
  mandatory?: boolean;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  push?: PushPayload;
}) {
  const members = await prisma.communityMember.findMany({
    where: { communityId: options.communityId, status: 'ACTIVE' },
    select: { userId: true },
  });

  return createNotificationForUsers({
    ...options,
    recipientUserIds: members.map((member) => member.userId),
  });
}