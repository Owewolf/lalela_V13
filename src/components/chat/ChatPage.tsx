import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import {
  Search,
  Shield,
  Store,
  Navigation,
  Camera,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { calculateDistance } from '../../lib/utils';
import { CommunityMember, Conversation } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';

const RADIUS = {
  pill: 999,
};
const SPACE = {
  xxs: 1,
  s100: 100,
};

// The REST API returns conversation.participants as an array of
// ConversationParticipant objects ({ userId, user, ... }), but legacy code paths
// (and some socket payloads) may still supply plain string IDs. Normalise here
// so member ↔ conversation matching works in either shape.
function getParticipantId(p: any): string | null {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object') return p.userId ?? p.user?.id ?? p.id ?? null;
  return null;
}

function otherParticipantId(conv: Conversation, myId: string): string | null {
  for (const p of conv.participants as any[]) {
    const id = getParticipantId(p);
    if (id && id !== myId) return id;
  }
  return null;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

type ChatMemberListItem = {
  member: CommunityMember;
  hasBusiness: boolean;
  isSecurity: boolean;
  isEmergencyAuthor: boolean;
  latestActivityMs: number;
  emergencyDistance: number | null;
  unread: {
    direct: number;
    listing: number;
    notice: number;
    marketplace: number;
    directConv?: Conversation;
    listingConv?: Conversation;
    noticeConv?: Conversation;
    marketplaceConv?: Conversation;
    lastMessagePreview?: string;
    lastMessageTime?: string;
    lastMessageConv?: Conversation | null;
    latestConversationAtMs?: number;
  };
  lastMessage: string;
  lastMessageTime: string;
  lastMessageConv: Conversation | null;
};

const getRoleBadgeBg = (role: string) => {
  switch (role) {
    case 'ADMIN': return THEME_COLORS.primary;
    case 'MODERATOR': return THEME_COLORS.secondary;
    default: return THEME_COLORS.neutralTextSoft;
  }
};

interface ChatMemberRowProps {
  item: ChatMemberListItem;
  onOpenConversation: (conversation: Conversation) => void;
  onMemberTap: (item: ChatMemberListItem) => void;
  isEmergency: boolean;
}

const ChatMemberRow = React.memo(
  ({ item, onOpenConversation, onMemberTap, isEmergency }: ChatMemberRowProps) => {
    const { member, hasBusiness, isSecurity, isEmergencyAuthor, emergencyDistance, unread, lastMessage, lastMessageTime } = item;
    const normalizedLastMessage = (lastMessage || '').trim();
    const isPhotoPreview = normalizedLastMessage === '📷 Photo' || normalizedLastMessage === 'Photo';

    return (
      <View>
        <TouchableOpacity
          onPress={() => onMemberTap(item)}
          activeOpacity={0.6}
          className={[
            'flex-row items-center gap-3 px-4 py-3',
            isEmergencyAuthor ? 'bg-red-50' : 'bg-surface-container-low',
          ].join(' ')}
        >
          <View className="relative w-14 h-14 rounded-full flex-shrink-0">
            {member.image ? (
              <Image
                source={{ uri: member.image }}
                className="w-14 h-14 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-14 h-14 rounded-full bg-surface-container items-center justify-center">
                <Text className="text-primary font-bold text-base">
                  {(member.name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {isSecurity && (
              <View
                className={[
                  'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center',
                  'bg-primary',
                ].join(' ')}
                style={{ backgroundColor: THEME_COLORS.brandBlueText }}
              >
                <Shield size={10} color="white" />
              </View>
            )}
          </View>

          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 mb-1">
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                  <Text
                    numberOfLines={1}
                    className={[
                      'font-bold text-sm flex-shrink',
                      isEmergencyAuthor ? 'text-red-600' : 'text-gray-900',
                    ].join(' ')}
                  >
                    {member.name || 'Community Member'}
                  </Text>
                  {isEmergencyAuthor && (
                    <View className="bg-red-100 px-1.5 py-0.5 rounded">
                      <Text className="text-[10px] font-black uppercase tracking-wider text-red-600">
                        Alert
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center gap-1 mt-0.5">
                  <View
                    style={{ backgroundColor: getRoleBadgeBg(member.role) }}
                    className="px-1.5 py-0.5 rounded"
                  >
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                      {member.role}
                    </Text>
                  </View>
                  {hasBusiness && (
                    <View className="flex-row items-center gap-0.5 bg-amber-100 px-1.5 py-0.5 rounded">
                      <Store size={9} color={THEME_COLORS.warning} />
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        Biz
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {normalizedLastMessage ? (
              isPhotoPreview ? (
                <View className="flex-row items-center gap-1">
                  <Camera size={12} color={THEME_COLORS.neutralTextSubtle} />
                  <Text
                    numberOfLines={1}
                    className="text-xs text-gray-500 leading-tight"
                  >
                    Photo
                  </Text>
                </View>
              ) : (
                <Text
                  numberOfLines={1}
                  className="text-xs text-gray-500 leading-tight"
                >
                  {normalizedLastMessage}
                </Text>
              )
            ) : (
              <Text className="text-xs text-gray-400 italic">No messages yet</Text>
            )}
          </View>

          <View className="items-end gap-2 flex-shrink-0 ml-2 self-stretch">
            <Text className="text-[11px] text-green-600 font-semibold flex-shrink-0">
              {lastMessageTime}
            </Text>
            {(() => {
              const totalUnread =
                unread.direct + unread.listing + unread.notice + unread.marketplace;
              if (totalUnread <= 0) return null;
              const targetConv =
                unread.directConv ||
                unread.marketplaceConv ||
                unread.listingConv ||
                unread.noticeConv ||
                null;
              const onPress = targetConv
                ? () => onOpenConversation(targetConv)
                : () => onMemberTap(item);
              return (
                <TouchableOpacity
                  onPress={onPress}
                  activeOpacity={0.7}
                  className="rounded-full h-6 min-w-[24px] px-1.5 items-center justify-center"
                  style={{ backgroundColor: THEME_COLORS.primary }}
                >
                  <Text className="text-[9px] text-white font-black">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {isEmergency && isSecurity && emergencyDistance != null ? (
              <View className="flex-row items-center gap-1">
                <Navigation size={11} color={THEME_COLORS.errorStrong} />
                <Text className="text-[10px] font-bold text-red-500">
                  {emergencyDistance.toFixed(1)}km
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <View className="h-px bg-surface-container ml-14" />
      </View>
    );
  },
  (prev, next) => {
    const prevItem = prev.item;
    const nextItem = next.item;

    return (
      prev.isEmergency === next.isEmergency &&
      prev.onOpenConversation === next.onOpenConversation &&
      prev.onMemberTap === next.onMemberTap &&
      prevItem.member.userId === nextItem.member.userId &&
      prevItem.member.name === nextItem.member.name &&
      prevItem.member.image === nextItem.member.image &&
      prevItem.member.role === nextItem.member.role &&
      prevItem.member.joinedAt === nextItem.member.joinedAt &&
      prevItem.member.isSecurityMember === nextItem.member.isSecurityMember &&
      prevItem.member.latitude === nextItem.member.latitude &&
      prevItem.member.longitude === nextItem.member.longitude &&
      prevItem.hasBusiness === nextItem.hasBusiness &&
      prevItem.isSecurity === nextItem.isSecurity &&
      prevItem.isEmergencyAuthor === nextItem.isEmergencyAuthor &&
      prevItem.latestActivityMs === nextItem.latestActivityMs &&
      prevItem.emergencyDistance === nextItem.emergencyDistance &&
      prevItem.lastMessage === nextItem.lastMessage &&
      prevItem.lastMessageTime === nextItem.lastMessageTime &&
      prevItem.lastMessageConv?.id === nextItem.lastMessageConv?.id &&
      prevItem.unread.direct === nextItem.unread.direct &&
      prevItem.unread.listing === nextItem.unread.listing &&
      prevItem.unread.notice === nextItem.unread.notice &&
      prevItem.unread.marketplace === nextItem.unread.marketplace &&
      prevItem.unread.directConv?.id === nextItem.unread.directConv?.id &&
      prevItem.unread.listingConv?.id === nextItem.unread.listingConv?.id &&
      prevItem.unread.noticeConv?.id === nextItem.unread.noticeConv?.id &&
      prevItem.unread.marketplaceConv?.id === nextItem.unread.marketplaceConv?.id
    );
  }
);

export const ChatPage: React.FC = () => {
  const router = useRouter();
  const {
    members,
    posts,
    communityBusinesses,
    securityResponders,
    startConversation,
    conversations,
    setActiveConversation,
    currentCommunity,
    markAsRead,
    chatUnreadTotals,
  } = useCommunity();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'notices' | 'listings'>('all');

  const isEmergency = !!currentCommunity?.isEmergencyMode;

  const emergencyPost = useMemo(
    () => posts.find((p) => p.urgency === 'emergency' || p.priority === 'emergency'),
    [posts]
  );

  // Build enriched member list
  const enrichedMembers = useMemo<ChatMemberListItem[]>(() => {
    const otherMembers = members.filter((m) => m.userId !== userProfile?.id);

    const businessOwnerIds = new Set(communityBusinesses.map((b) => b.ownerId));
    const responderIds = new Set(securityResponders.map((r) => r.userId));

    type UnreadInfo = {
      direct: number;
      listing: number;
      notice: number;
      marketplace: number;
      directConv?: Conversation;
      listingConv?: Conversation;
      noticeConv?: Conversation;
      marketplaceConv?: Conversation;
      lastMessagePreview?: string;
      lastMessageTime?: string;
      lastMessageConv?: Conversation | null;
      latestConversationAtMs?: number;
    };
    const conversationInfoMap = new Map<string, UnreadInfo>();

    for (const conv of conversations) {
      if (!userProfile) continue;
      if (conv.type === 'community' || conv.type === 'emergency') continue;
      const otherId = otherParticipantId(conv, userProfile.id);
      if (!otherId) continue;
      const myUnread = conv.unreadCount || 0;
      const info = conversationInfoMap.get(otherId) || {
        direct: 0,
        listing: 0,
        notice: 0,
        marketplace: 0,
      };
      const contextType = conv.metadata?.type;
      if (conv.type === 'direct') {
        if (contextType === 'listing') {
          info.listing += myUnread;
          if (myUnread > 0 && !info.listingConv) info.listingConv = conv;
        } else if (contextType === 'notice') {
          info.notice += myUnread;
          if (myUnread > 0 && !info.noticeConv) info.noticeConv = conv;
        } else {
          info.direct += myUnread;
          if (myUnread > 0 && !info.directConv) info.directConv = conv;
        }
      } else if (conv.type === 'listing' && conv.metadata?.source === 'marketplace') {
        info.marketplace += myUnread;
        if (myUnread > 0 && !info.marketplaceConv) info.marketplaceConv = conv;
      } else if (conv.type === 'listing') {
        info.listing += myUnread;
        if (myUnread > 0 && !info.listingConv) info.listingConv = conv;
      } else if (conv.type === 'notice') {
        info.notice += myUnread;
        if (myUnread > 0 && !info.noticeConv) info.noticeConv = conv;
      }

      const convTimeMs = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
      if (!info.latestConversationAtMs || convTimeMs > info.latestConversationAtMs) {
        info.latestConversationAtMs = convTimeMs;
        info.lastMessagePreview = conv.lastMessage || '';
        info.lastMessageTime = formatRelativeTime(conv.lastMessageAt);
        info.lastMessageConv = conv;
      }

      conversationInfoMap.set(otherId, info);
    }

    return otherMembers.map((m) => {
      const info = conversationInfoMap.get(m.userId) || {
        direct: 0,
        listing: 0,
        notice: 0,
        marketplace: 0,
      };

      const postActivityMs = (() => {
        return 0;
      })();
      const joinedAtMs = (() => {
        const value = m.joinedAt ? new Date(m.joinedAt).getTime() : 0;
        return Number.isFinite(value) ? value : 0;
      })();
      const latestActivityMs = Math.max(info.latestConversationAtMs ?? 0, postActivityMs, joinedAtMs);

      return {
        member: m,
        hasBusiness: businessOwnerIds.has(m.userId),
        isSecurity: m.isSecurityMember || responderIds.has(m.userId),
        isEmergencyAuthor: isEmergency && emergencyPost?.authorId === m.userId,
        latestActivityMs,
        emergencyDistance:
          isEmergency &&
          emergencyPost?.latitude &&
          emergencyPost?.longitude &&
          m.latitude &&
          m.longitude
            ? calculateDistance(
                emergencyPost.latitude,
                emergencyPost.longitude,
                m.latitude,
                m.longitude
              )
            : null,
        unread: info,
        lastMessage: info.lastMessagePreview || '',
        lastMessageTime: info.lastMessageTime || '',
        lastMessageConv: info.lastMessageConv || null,
      };
    });
  }, [members, userProfile, communityBusinesses, securityResponders, isEmergency, emergencyPost, conversations]);

  // Filter by search first
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return enrichedMembers;
    const q = searchQuery.toLowerCase();
    return enrichedMembers.filter((e) => (e.member.name || '').toLowerCase().includes(q));
  }, [enrichedMembers, searchQuery]);

  // Then apply chat filter chip
  const chipFiltered = useMemo(() => {
    return searchFiltered.filter((item) => {
      if (activeFilter === 'all') return true;

      const unreadForFilter = item.unread.direct + item.unread.listing + item.unread.notice;
      if (activeFilter === 'unread') return unreadForFilter > 0;
      if (activeFilter === 'notices') return item.unread.notice > 0;
      if (activeFilter === 'listings') return item.unread.listing > 0;
      return true;
    });
  }, [searchFiltered, activeFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...chipFiltered].sort((a, b) => {
      if (isEmergency) {
        if (a.isEmergencyAuthor && !b.isEmergencyAuthor) return -1;
        if (!a.isEmergencyAuthor && b.isEmergencyAuthor) return 1;
        if (a.isSecurity && !b.isSecurity) return -1;
        if (!a.isSecurity && b.isSecurity) return 1;
      }
      const aTotal = a.unread.direct + a.unread.listing + a.unread.notice + a.unread.marketplace;
      const bTotal = b.unread.direct + b.unread.listing + b.unread.notice + b.unread.marketplace;
      if (aTotal > 0 && bTotal === 0) return -1;
      if (aTotal === 0 && bTotal > 0) return 1;
      return (b.latestActivityMs ?? 0) - (a.latestActivityMs ?? 0);
    });
  }, [chipFiltered, isEmergency]);

  const openConversation = useCallback(
    (conv: Conversation) => {
      setActiveConversation(conv.id);
      markAsRead(conv.id);
      router.push(`/chat/${conv.id}`);
    },
    [setActiveConversation, markAsRead, router]
  );

  const handleMemberTap = async (item: ChatMemberListItem) => {
    const { member, lastMessageConv } = item;

    if (lastMessageConv?.id) {
      openConversation(lastMessageConv);
      return;
    }

    if (!userProfile) return;
    try {
      const convId = await startConversation({
        participants: [userProfile.id, member.userId],
        type: 'direct',
        communityId: currentCommunity?.id,
      });
      setActiveConversation(convId);
      router.push(`/chat/${convId}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ChatMemberListItem }) => (
      <ChatMemberRow
        item={item}
        onOpenConversation={openConversation}
        onMemberTap={handleMemberTap}
        isEmergency={isEmergency}
      />
    ),
    [handleMemberTap, isEmergency, openConversation]
  );

  const ListHeaderComponent = () => (
    <View className="px-4 mb-3">
      {/* Title row */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <Text className="text-2xl font-black text-gray-900 tracking-tight">Community</Text>
        <View className="bg-surface-container px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-neutralTextMuted">{members.length} members</Text>
        </View>
      </View>

      {/* Search bar */}
      <View className="flex-row items-center bg-surface-container rounded-2xl px-4 py-3 border border-outlineVariant">
        <Search size={18} color={THEME_COLORS.neutralTextSoft} />
        <TextInput
          className="flex-1 ml-3 text-sm text-neutralTextStrong"
          placeholder="Search members..."
          placeholderTextColor={THEME_COLORS.neutralTextSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      {/* Filter chips */}
      <View className="flex-row items-center gap-2 mt-3">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${chatUnreadTotals.unreadFilterTotal})` },
          { key: 'notices', label: `Notices (${chatUnreadTotals.notice})` },
          { key: 'listings', label: `Listings (${chatUnreadTotals.listing})` },
        ].map((chip) => {
          const isActive = activeFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setActiveFilter(chip.key as typeof activeFilter)}
              activeOpacity={0.8}
              className={[
                'px-3 py-1.5 rounded-full border',
                isActive
                  ? 'bg-primary border-primary'
                  : 'bg-surface-container-low',
              ].join(' ')}
              style={isActive ? undefined : { borderColor: THEME_COLORS.neutralBorderSoft }}
            >
              <Text
                className={[
                  'text-xs font-bold',
                  isActive ? 'text-white' : 'text-gray-600',
                ].join(' ')}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Emergency banner */}
      {isEmergency ? (
        <View className="mt-3 flex-row items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <Text className="text-xs font-bold text-red-600 flex-1">
            Emergency Active — Security responders shown first
          </Text>
        </View>
      ) : null}

      {/* Top divider */}
      <View className="h-px bg-surface-container mt-3" />
    </View>
  );

  const ListEmptyComponent = () => (
    <View className="items-center justify-center py-20 px-4">
      <View className="w-16 h-16 bg-surface-container rounded-full items-center justify-center mb-4">
        <Search size={28} color={THEME_COLORS.neutralTextSoft} />
      </View>
      <Text className="text-lg font-bold text-gray-900 mb-1 text-center">
        {(searchQuery || activeFilter !== 'all') ? 'No members found' : 'No community members'}
      </Text>
      <Text className="text-sm text-gray-400 text-center">
        {searchQuery
          ? `No members matching "${searchQuery}"`
          : activeFilter !== 'all'
          ? 'No members match this filter'
          : 'Members will appear here once they join'}
      </Text>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.member.userId}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACE.s100 }}
        scrollIndicatorInsets={{ right: SPACE.xxs }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
};
