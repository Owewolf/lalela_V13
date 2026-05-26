import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { Camera } from 'lucide-react-native';
import { Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { THEME_COLORS } from '../../theme/colors';

interface ChatListProps {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
  activeId?: string | null;
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

export const ChatList: React.FC<ChatListProps> = ({ conversations, onSelect, activeId }) => {
  const { userProfile } = useAuth();

  if (conversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20 px-4">
        <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
          <Text className="text-4xl">💬</Text>
        </View>
        <Text className="text-lg font-bold text-gray-900 mb-2 text-center">
          No conversations yet
        </Text>
        <Text className="text-sm text-gray-400 text-center max-w-xs">
          Start a conversation from a listing, community post, or by messaging a member directly.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item: conv }: { item: Conversation }) => {
    const unreadCount = conv.unreadCount || 0;
    const isEmergency = conv.type === 'emergency';
    const isListing = conv.type === 'listing';
    const isNotice = conv.type === 'notice';
    const isActive = activeId === conv.id;

    const title =
      conv.metadata?.title || conv.otherParticipant?.name || 'Conversation';
    const image =
      conv.metadata?.image ||
      conv.otherParticipant?.profileImage ||
      `https://picsum.photos/seed/${conv.id}/100/100`;
    const normalizedLastMessage = (conv.lastMessage || '').trim();
    const isPhotoPreview = normalizedLastMessage === '📷 Photo' || normalizedLastMessage === 'Photo';

    return (
      <TouchableOpacity
        onPress={() => onSelect(conv)}
        activeOpacity={0.75}
        className={[
          'flex-row items-center gap-4 px-4 py-4 border-b border-gray-100',
          isActive ? 'bg-surface-container-low' : unreadCount > 0 ? 'bg-gray-50/50' : 'bg-white',
        ].join(' ')}
      >
        {/* Active indicator bar */}
        {isActive && (
          <View className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
        )}

        {/* Avatar */}
        <View className="relative flex-shrink-0">
          <Image
            source={{ uri: image }}
            className={[
              'w-14 h-14 rounded-2xl',
              isEmergency ? 'border-2 border-red-500' : '',
            ].join(' ')}
            resizeMode="cover"
          />
          {conv.otherParticipant && (
            <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary border-2 border-white rounded-full" />
          )}
        </View>

        {/* Content */}
        <View className="flex-1 min-w-0">
          <View className="flex-row items-baseline mb-1">
            <View className="flex-row items-center gap-2 flex-1 min-w-0">
              <Text
                numberOfLines={1}
                className={[
                  'font-bold text-base flex-shrink',
                  unreadCount > 0 ? 'text-gray-900' : 'text-gray-700',
                ].join(' ')}
              >
                {title}
              </Text>
              {isEmergency && (
                <View className="bg-red-500 rounded px-1.5 py-0.5">
                  <Text className="text-white text-[8px] font-black uppercase tracking-tighter">
                    Emergency
                  </Text>
                </View>
              )}
              {isListing && (
                <View className="bg-purple-500 rounded px-1.5 py-0.5">
                  <Text className="text-white text-[8px] font-black uppercase tracking-tighter">
                    Listing
                  </Text>
                </View>
              )}
              {isNotice && (
                <View className="bg-amber-500 rounded px-1.5 py-0.5">
                  <Text className="text-white text-[8px] font-black uppercase tracking-tighter">
                    Notice
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {isPhotoPreview ? (
              <View className="flex-row items-center gap-1 flex-1">
                <Camera size={12} color={THEME_COLORS.neutralTextSubtle} />
                <Text
                  numberOfLines={1}
                  className={[
                    'text-sm flex-1',
                    unreadCount > 0 ? 'text-primary font-bold' : 'text-gray-400',
                  ].join(' ')}
                >
                  Photo
                </Text>
              </View>
            ) : (
              <Text
                numberOfLines={1}
                className={[
                  'text-sm flex-1',
                  unreadCount > 0 ? 'text-primary font-bold' : 'text-gray-400',
                ].join(' ')}
              >
                {normalizedLastMessage}
              </Text>
            )}
          </View>
        </View>

        <View className="items-end gap-1.5 flex-shrink-0 min-w-[32px] self-stretch">
          <Text className="text-[10px] text-green-600 font-semibold flex-shrink-0">
            {formatRelativeTime(conv.lastMessageAt)}
          </Text>
          {unreadCount > 0 && (
            <View className="bg-green-500 rounded-full h-5 min-w-[20px] px-1.5 items-center justify-center">
              <Text className="text-[10px] text-white font-bold">{unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  );
};
