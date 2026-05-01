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

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

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
  const enrichedMembers = useMemo(() => {
    const otherMembers = members.filter((m) => m.user_id !== userProfile?.id);

    const businessOwnerIds = new Set(communityBusinesses.map((b) => b.owner_id));
    const responderIds = new Set(securityResponders.map((r) => r.user_id));
    const authorPostMap = new Map<string, string>();
    for (const p of posts) {
      if (!p.author_id) continue;
      const existing = authorPostMap.get(p.author_id);
      if (!existing || p.timestamp > existing) {
        authorPostMap.set(p.author_id, p.timestamp);
      }
    }

    type UnreadInfo = {
      direct: number;
      listing: number;
      notice: number;
      marketplace: number;
      directConv?: Conversation;
      listingConv?: Conversation;
      noticeConv?: Conversation;
      marketplaceConv?: Conversation;
    };
    const unreadInfoMap = new Map<string, UnreadInfo>();

    for (const conv of conversations) {
      if (!userProfile) continue;
      if (conv.type === 'community' || conv.type === 'emergency') continue;
      const otherId = conv.participants.find((p) => p !== userProfile.id);
      if (!otherId) continue;
      const myUnread = conv.unreadCount?.[userProfile.id] || 0;
      const info = unreadInfoMap.get(otherId) || {
        direct: 0,
        listing: 0,
        notice: 0,
        marketplace: 0,
      };
      if (conv.type === 'direct') {
        info.direct += myUnread;
        if (myUnread > 0 && !info.directConv) info.directConv = conv;
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
      unreadInfoMap.set(otherId, info);
    }

    return otherMembers.map((m) => {
      const info = unreadInfoMap.get(m.user_id) || {
        direct: 0,
        listing: 0,
        notice: 0,
        marketplace: 0,
      };

      // Find most recent conversation with this member (any type except emergency/community)
      let lastMessagePreview = '';
      let lastMessageTime = '';
      let lastMessageConv: Conversation | null = null;

      for (const conv of conversations) {
        if (conv.type === 'community' || conv.type === 'emergency') continue;
        const otherId = conv.participants.find(p => p !== userProfile?.id);
        if (otherId === m.user_id) {
          if (!lastMessageConv || new Date(conv.lastMessageAt).getTime() > new Date(lastMessageConv.lastMessageAt).getTime()) {
            lastMessageConv = conv;
            lastMessagePreview = conv.lastMessage || '';
            lastMessageTime = formatRelativeTime(conv.lastMessageAt);
          }
        }
      }

      return {
        member: m,
        hasActivePost: authorPostMap.has(m.user_id),
        hasBusiness: businessOwnerIds.has(m.user_id),
        isSecurity: m.isSecurityMember || responderIds.has(m.user_id),
        isEmergencyAuthor: isEmergency && emergencyPost?.author_id === m.user_id,
        latestActivity: authorPostMap.get(m.user_id) || m.joined_at || '',
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
        lastMessage: lastMessagePreview,
        lastMessageTime,
        lastMessageConv,
      };
    });
  }, [members, userProfile, posts, communityBusinesses, securityResponders, isEmergency, emergencyPost, conversations]);

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
      const aTime = typeof a.latestActivity === 'string' ? a.latestActivity : '';
      const bTime = typeof b.latestActivity === 'string' ? b.latestActivity : '';
      return bTime.localeCompare(aTime);
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

  const handleMemberTap = async (member: CommunityMember) => {
    if (!userProfile) return;
    try {
      const convId = await startConversation({
        participants: [userProfile.id, member.user_id],
        type: 'direct',
        communityId: currentCommunity?.id,
      });
      setActiveConversation(convId);
      router.push(`/chat/${convId}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const roleBadgeBg = (role: string) => {
    switch (role) {
      case 'Admin': return '#0d3d47';
      case 'Moderator': return '#8b5cf6';
      default: return '#9ca3af';
    }
  };

  type EnrichedItem = (typeof sorted)[0];

  const renderItem = ({ item }: { item: EnrichedItem }) => {
    const { member, hasActivePost, hasBusiness, isSecurity, isEmergencyAuthor, emergencyDistance, unread, lastMessage, lastMessageTime, lastMessageConv } = item;
    const normalizedLastMessage = (lastMessage || '').trim();
    const isPhotoPreview = normalizedLastMessage === '📷 Photo' || normalizedLastMessage === 'Photo';

    return (
      <View>
        <TouchableOpacity
          onPress={() => handleMemberTap(member)}
          activeOpacity={0.6}
          className={[
            'flex-row items-center gap-3 px-4 py-3',
            isEmergencyAuthor ? 'bg-red-50' : 'bg-white',
          ].join(' ')}
        >
          {/* Avatar */}
          <View
            className={[
              'relative w-14 h-14 rounded-full flex-shrink-0',
              hasActivePost ? 'ring-2 ring-orange-500' : '',
            ].join(' ')}
            style={
              hasActivePost
                ? { borderWidth: 2, borderColor: '#fc7127', borderRadius: 999 }
                : undefined
            }
          >
            {member.image ? (
              <Image
                source={{ uri: member.image }}
                className="w-14 h-14 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center">
                <Text className="text-primary font-bold text-base">
                  {(member.name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {isSecurity && (
              <View
                className={[
                  'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center',
                  isEmergency ? 'bg-red-500' : 'bg-primary',
                ].join(' ')}
              >
                <Shield size={10} color="white" />
              </View>
            )}
          </View>

          {/* Center: Name, badges, and last message */}
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

                {/* Role and Business badges */}
                <View className="flex-row items-center gap-1 mt-0.5">
                  <View
                    style={{ backgroundColor: roleBadgeBg(member.role) }}
                    className="px-1.5 py-0.5 rounded"
                  >
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                      {member.role}
                    </Text>
                  </View>
                  {hasBusiness && (
                    <View className="flex-row items-center gap-0.5 bg-amber-100 px-1.5 py-0.5 rounded">
                      <Store size={9} color="#d97706" />
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        Biz
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Last message preview */}
            {normalizedLastMessage ? (
              isPhotoPreview ? (
                <View className="flex-row items-center gap-1">
                  <Camera size={12} color="#6b7280" />
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

          {/* Right side: time, unread badge, and distance */}
          <View className="items-end gap-2 flex-shrink-0 ml-2 self-stretch">
            <Text className="text-[11px] text-green-600 font-semibold flex-shrink-0">
              {lastMessageTime}
            </Text>
            {unread.direct > 0 ? (
              <View className="bg-green-500 rounded-full h-6 min-w-[24px] px-1.5 items-center justify-center">
                <Text className="text-[11px] text-white font-black">
                  {unread.direct > 99 ? '99+' : unread.direct}
                </Text>
              </View>
            ) : null}

            {unread.marketplace > 0 && unread.marketplaceConv ? (
              <TouchableOpacity
                onPress={() => openConversation(unread.marketplaceConv!)}
                activeOpacity={0.7}
                className="flex-row items-center gap-0.5 bg-purple-500 rounded-full h-6 min-w-[24px] px-1.5 items-center justify-center"
              >
                <Store size={9} color="white" />
                <Text className="text-[11px] text-white font-black">
                  {unread.marketplace > 99 ? '99+' : unread.marketplace}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isEmergency && isSecurity && emergencyDistance != null ? (
              <View className="flex-row items-center gap-1">
                <Navigation size={11} color="#ef4444" />
                <Text className="text-[10px] font-bold text-red-500">
                  {emergencyDistance.toFixed(1)}km
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Line separator */}
        <View className="h-px bg-gray-100 ml-14" />
      </View>
    );
  };

  const ListHeaderComponent = () => (
    <View className="px-4 mb-3">
      {/* Title row */}
      <View className="flex-row items-center justify-between mb-4 mt-2">
        <Text className="text-2xl font-black text-gray-900 tracking-tight">Community</Text>
        <View className="bg-gray-100 px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-gray-500">{members.length} members</Text>
        </View>
      </View>

      {/* Search bar */}
      <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3 border border-gray-200">
        <Search size={18} color="#9ca3af" />
        <TextInput
          className="flex-1 ml-3 text-sm text-gray-900"
          placeholder="Search members..."
          placeholderTextColor="#9ca3af"
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
                  : 'bg-white border-gray-200',
              ].join(' ')}
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
      <View className="h-px bg-gray-100 mt-3" />
    </View>
  );

  const ListEmptyComponent = () => (
    <View className="items-center justify-center py-20 px-4">
      <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
        <Search size={28} color="#9ca3af" />
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
    <View className="flex-1 bg-white">
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.member.user_id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollIndicatorInsets={{ right: 1 }}
      />
    </View>
  );
};
