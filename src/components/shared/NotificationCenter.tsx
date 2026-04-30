import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
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
} from 'lucide-react-native';
import { useCommunity } from '../../context/CommunityContext';
import { PostConfirmationModal } from './PostConfirmationModal';

const PRIMARY = '#0d3d47';
const ERROR = '#dc2626';

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
  const {
    notifications,
    markNotificationAsRead,
    deleteNotification,
    acceptInvitation,
    declineInvitation,
    setCurrentCommunity,
  } = useCommunity();

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  const translateX = React.useRef(new Animated.Value(350)).current;

  React.useEffect(() => {
    if (isOpen) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen]);

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
      case 'system': return <Shield size={16} color="#6750a4" />;
      default: return <Bell size={16} color="#94a3b8" />;
    }
  };

  const getIconBg = (type: string, read: boolean) => {
    if (read) return '#f8fafc';
    switch (type) {
      case 'invitation': return '#f0fdf4';
      case 'alert': return '#fef2f2';
      case 'system': return '#f5f3ff';
      default: return '#f8fafc';
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
      onPress={() => markNotificationAsRead(notification.id)}
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
                { color: notification.read ? '#64748b' : '#0f172a' },
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
              <Trash2 size={13} color="#94a3b8" />
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
                <Check size={12} color="#fff" />
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => handleAction(notification, 'decline')}
              >
                <X size={12} color="#64748b" />
                <Text style={[styles.actionBtnText, { color: '#64748b' }]}>Decline</Text>
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
                <AlertTriangle size={14} color="#fff" />
                <Text style={styles.alertAckText}>Acknowledge & Open Emergency Hub</Text>
              </TouchableOpacity>
            )}

          {/* Time */}
          <View style={styles.timeRow}>
            <Clock size={12} color="#94a3b8" />
            <Text style={styles.timeText}>{formatTime(notification.created_at)}</Text>
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
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.panelTitle}>Notifications</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94a3b8" />
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
                <Bell size={32} color="#cbd5e1" />
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
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 360,
    maxWidth: '90%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellWrapper: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d3d47',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  notifCardRead: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    opacity: 0.8,
  },
  notifCardUnread: {
    backgroundColor: '#fff',
    borderColor: 'rgba(22,163,74,0.2)',
    shadowColor: '#0d3d47',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  notifRow: {
    flexDirection: 'row',
    gap: 14,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
  },
  notifMessage: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  alertAckBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  alertAckText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0d3d47',
  },
  emptyMsg: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingVertical: 12,
  },
});
