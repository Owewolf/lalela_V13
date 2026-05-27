import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import {
  Bell,
  X,
  Check,
  Trash2,
  Mail,
  Shield,
  AlertTriangle,
  Clock,
  Tag,
  Megaphone,
  HeartHandshake,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { PostConfirmationModal } from './PostConfirmationModal';
import { THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardShadow, getCardSurfaceColor } from '../../theme/cardStyles';
import { createShadow } from '../../theme/shadows';

const PRIMARY = THEME_COLORS.primary;
const ERROR = THEME_COLORS.errorStrong;
const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  base: 12,
  lg: 13,
  xl: 18,
  title: 20,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  zero: 0,
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  s16: 16,
  s20: 20,
  s32: 32,
  s40: 40,
  s64: 64,
  s360: 360,
  s80: 80,
};
const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  round: 20,
  circle: 32,
};
const LETTER_SPACING = {
  normal: 1,
  compact: 0.8,
};
const LINE_HEIGHT = {
  body: 18,
};

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledgeAlert?: (communityId: string, postData: any) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onAcknowledgeAlert,
}) => {
  const router = useRouter();
  const {
    notifications,
    markNotificationAsRead,
    deleteNotification,
    acceptInvitation,
    declineInvitation,
    setCurrentCommunity,
  } = useCommunity();

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  const translateX = React.useRef(new Animated.Value(SPACE.s360)).current;

  React.useEffect(() => {
    if (isOpen) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: SPACE.s360,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [isOpen]);

  const navigateFromNotification = React.useCallback(async (notification: any) => {
    const meta = notification.metadata ?? {};

    await markNotificationAsRead(notification.id);

    if (meta.communityId) {
      setCurrentCommunity(meta.communityId);
    }

    if (notification.type === 'alert') {
      if (meta.communityId && onAcknowledgeAlert) {
        const postData = {
          id: meta.postId,
          title: meta.postTitle || 'Emergency',
          description: meta.postDescription || '',
          authorName: meta.authorName || 'Community Member',
          urgency: 'emergency',
          urgency_level: 'emergency',
          timestamp: new Date().toISOString(),
        };
        onAcknowledgeAlert(meta.communityId, postData);
      } else if (meta.emergencyId || meta.postId) {
        router.push(`/emergency/${meta.emergencyId || meta.postId}` as any);
      }
      onClose();
      return;
    }

    if (notification.type === 'listing' && meta.postId) {
      router.push(`/(tabs)/market?listingId=${encodeURIComponent(String(meta.postId))}` as any);
      onClose();
      return;
    }

    if (notification.type === 'notice' && meta.postId) {
      router.push(`/(tabs)/posts?noticeId=${encodeURIComponent(String(meta.postId))}` as any);
      onClose();
      return;
    }

    if (notification.type === 'charity_suggestion') {
      router.push('/settings?charityMode=manage' as any);
      onClose();
      return;
    }

    if (typeof meta.route === 'string' && meta.route.length > 0) {
      router.push(meta.route as any);
    }

    onClose();
  }, [markNotificationAsRead, onAcknowledgeAlert, onClose, router, setCurrentCommunity]);

  const handleAction = async (notification: any, action: 'accept' | 'decline') => {
    if (notification.type === 'invitation' && notification.metadata?.invitationId) {
      try {
        if (action === 'accept') {
          await acceptInvitation(notification.metadata.invitationId);
        } else {
          await declineInvitation(notification.metadata.invitationId);
        }
      } catch (error) {
        console.error(`Failed to ${action} invitation:`, error);
      }
    }
  };

  const handleAcknowledgeAlert = async (notification: any) => {
    const meta = notification.metadata;
    if (!meta?.communityId) return;

    await markNotificationAsRead(notification.id);
    setCurrentCommunity(meta.communityId);

    if (onAcknowledgeAlert) {
      const postData = {
        id: meta.postId,
        title: meta.postTitle || 'Emergency',
        description: meta.postDescription || '',
        authorName: meta.authorName || 'Community Member',
        urgency: 'emergency',
        urgency_level: 'emergency',
        timestamp: new Date().toISOString(),
      };
      onAcknowledgeAlert(meta.communityId, postData);
    }
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteNotification(pendingDeleteId);
      setPendingDeleteId(null);
      setPendingDeleteTitle('');
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'invitation': return <Mail size={16} color={PRIMARY} />;
      case 'alert': return <AlertTriangle size={16} color={ERROR} />;
      case 'listing': return <Tag size={16} color={THEME_COLORS.brandBlueText} />;
      case 'notice': return <Megaphone size={16} color={THEME_COLORS.warningText} />;
      case 'charity_suggestion': return <HeartHandshake size={16} color={THEME_COLORS.successStrong} />;
      case 'system': return <Shield size={16} color={THEME_COLORS.md3Primary} />;
      default: return <Bell size={16} color={THEME_COLORS.neutralTextMuted} />;
    }
  };

  const getIconBg = (type: string, read: boolean) => {
    if (read) return THEME_COLORS.neutralBg;
    switch (type) {
      case 'invitation': return THEME_COLORS.successSurface;
      case 'alert': return THEME_COLORS.errorSurface;
      case 'listing': return THEME_COLORS.infoSurfaceSoft;
      case 'notice': return THEME_COLORS.warningSurface;
      case 'charity_suggestion': return THEME_COLORS.successSurface;
      case 'system': return THEME_COLORS.brandPurpleSurface;
      default: return THEME_COLORS.neutralBg;
    }
  };

  const formatTime = (created_at: any) => {
    if (!created_at) return 'Just now';
    try {
      const date = created_at.toDate ? created_at.toDate() : new Date(created_at);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const renderItem = ({ item: notification }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.notifCard,
        notification.read ? styles.notifCardRead : styles.notifCardUnread,
      ]}
      onPress={() => navigateFromNotification(notification)}
      activeOpacity={0.8}
    >
      <View style={styles.notifRow}>
        {/* Icon */}
        <View
          style={[
            styles.notifIcon,
            { backgroundColor: getIconBg(notification.type, notification.read) },
          ]}
        >
          {getIconForType(notification.type)}
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text
              style={[
                styles.notifTitle,
                { color: notification.read ? THEME_COLORS.neutralTextSubtle : THEME_COLORS.neutralTextStrong },
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                setPendingDeleteId(notification.id);
                setPendingDeleteTitle(notification.title);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={13} color={THEME_COLORS.neutralTextMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.notifMessage} numberOfLines={3}>
            {notification.message}
          </Text>

          {/* Invitation actions */}
          {notification.type === 'invitation' && !notification.read && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: PRIMARY }]}
                onPress={() => handleAction(notification, 'accept')}
              >
                <Check size={12} color={THEME_COLORS.white} />
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: THEME_COLORS.neutralBgSoft }]}
                onPress={() => handleAction(notification, 'decline')}
              >
                <X size={12} color={THEME_COLORS.neutralTextSubtle} />
                <Text style={[styles.actionBtnText, { color: THEME_COLORS.neutralTextSubtle }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Alert acknowledge */}
          {notification.type === 'alert' &&
            !notification.read &&
            notification.metadata?.communityId && (
              <TouchableOpacity
                style={styles.alertAckBtn}
                onPress={() => handleAcknowledgeAlert(notification)}
              >
                <AlertTriangle size={14} color={THEME_COLORS.white} />
                <Text style={styles.alertAckText}>Acknowledge & Open Emergency Hub</Text>
              </TouchableOpacity>
            )}

          {/* Time */}
          <View style={styles.timeRow}>
            <Clock size={12} color={THEME_COLORS.neutralTextMuted} />
            <Text style={styles.timeText}>{formatTime(notification.createdAt ?? notification.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sliding Panel */}
        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <View style={styles.bellWrapper}>
                <Bell size={24} color={PRIMARY} />
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.panelTitle}>Notifications</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={THEME_COLORS.neutralTextMuted} />
            </TouchableOpacity>
          </View>

          {/* List */}
          {notifications.length > 0 ? (
            <FlatList
              data={notifications}
              keyExtractor={(item: any) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Bell size={32} color={THEME_COLORS.neutralBorderStrong} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyMsg}>No new notifications at the moment.</Text>
            </View>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={() => notifications.forEach((n: any) => markNotificationAsRead(n.id))}
              >
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* Confirm delete modal */}
      <PostConfirmationModal
        isOpen={!!pendingDeleteId}
        ctaLabel="Delete Notification"
        postType="Notification"
        communityName="Lalela"
        title={pendingDeleteTitle}
        themeColor="bg-error"
        customTitle="Confirm Notification Deletion"
        customMessage="This notification will be permanently removed."
        cancelLabel="Cancel"
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        confirmDisabled={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (isDeleting) return;
          setPendingDeleteId(null);
          setPendingDeleteTitle('');
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME_COLORS.blackOverlay20,
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SPACE.s360,
    maxWidth: '90%',
    backgroundColor: getCardSurfaceColor('subtle'),
    ...getCardShadow('hero'),
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.s20,
    borderBottomWidth: 1,
    borderBottomColor: getCardBorderColor('strong'),
    backgroundColor: getCardSurfaceColor('muted'),
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
  },
  bellWrapper: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -SPACE.xs,
    right: -SPACE.xs,
    width: SPACE.s16,
    height: SPACE.s16,
    backgroundColor: THEME_COLORS.errorStrong,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: THEME_COLORS.white,
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  panelTitle: {
    fontSize: TYPE_SCALE.title,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.primary,
  },
  closeBtn: {
    padding: SPACE.md,
    borderRadius: RADIUS.round,
  },
  listContent: {
    padding: SPACE.s16,
    gap: SPACE.xl,
  },
  notifCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACE.s16,
    marginBottom: SPACE.md,
  },
  notifCardRead: {
    backgroundColor: getCardSurfaceColor('default'),
    borderColor: getCardBorderColor('default'),
    opacity: 0.8,
  },
  notifCardUnread: {
    backgroundColor: getCardSurfaceColor('muted'),
    borderColor: THEME_COLORS.successTintBorderAlt,
    ...createShadow(THEME_COLORS.primary, SPACE.zero, SPACE.xxs, 0.05, 8, 2),
  },
  notifRow: {
    flexDirection: 'row',
    gap: SPACE.xxl,
  },
  notifIcon: {
    width: SPACE.s40,
    height: SPACE.s40,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: SPACE.xs,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACE.xs,
  },
  notifTitle: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.bold,
    flex: 1,
  },
  deleteBtn: {
    padding: SPACE.xs,
  },
  notifMessage: {
    fontSize: TYPE_SCALE.base,
    color: THEME_COLORS.neutralTextSubtle,
    lineHeight: LINE_HEIGHT.body,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginTop: SPACE.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
  },
  actionBtnText: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  alertAckBtn: {
    backgroundColor: THEME_COLORS.errorStrong,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  alertAckText: {
    color: THEME_COLORS.white,
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.compact,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    marginTop: SPACE.sm,
  },
  timeText: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.compact,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.s80,
    paddingHorizontal: SPACE.s32,
    gap: SPACE.xl,
  },
  emptyIcon: {
    width: SPACE.s64,
    height: SPACE.s64,
    borderRadius: RADIUS.circle,
    backgroundColor: THEME_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.primary,
  },
  emptyMsg: {
    fontSize: TYPE_SCALE.lg,
    color: THEME_COLORS.neutralTextSubtle,
    textAlign: 'center',
  },
  footer: {
    padding: SPACE.s16,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.neutralBorderSoft,
    backgroundColor: THEME_COLORS.surface,
    alignItems: 'center',
  },
  markAllText: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
    paddingVertical: SPACE.xl,
  },
});
