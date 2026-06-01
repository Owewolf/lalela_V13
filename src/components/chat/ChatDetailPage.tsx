import { SafeAreaView } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, ChevronDown, Search, Phone } from 'lucide-react-native';
import { Conversation, ConversationMetadata } from '../../types';
import { ChatWindow } from './ChatWindow';
import { ChatComposer } from './ChatComposer';
import { ChatContextCard } from './ChatContextCard';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';

interface ChatDetailPageProps {
  conversationId: string;
}

function getParticipantId(participant: any): string | null {
  if (typeof participant === 'string') return participant;
  if (participant && typeof participant === 'object') {
    return participant.userId ?? participant.user?.id ?? participant.id ?? null;
  }
  return null;
}

function getParticipantProfile(participant: any): { name?: string; profileImage?: string; mobileNumber?: string; phone?: string } | null {
  if (!participant || typeof participant !== 'object') return null;
  return participant.user ?? participant;
}

function toSupportedShort(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;

  const initials = cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  if (initials.length >= 2 && initials.length <= 5) return initials;
  return cleaned.slice(0, 5).toUpperCase();
}

export const ChatDetailPage: React.FC<ChatDetailPageProps> = ({ conversationId }) => {
  const router = useRouter();
  const { userProfile } = useAuth();
  const {
    messages,
    sendMessage,
    setTypingStatus,
    isTyping,
    markAsRead,
    members,
    posts,
    charities,
    communityBusinesses,
    currentCommunity,
    conversations,
    setActiveConversation,
  } = useCommunity();
  const [isContextCardCollapsed, setIsContextCardCollapsed] = useState(false);
  const [scrollToBottomRequest, setScrollToBottomRequest] = useState(0);

  // Find the conversation by id
  const chat = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

  const isChatDisabled = userProfile?.licenseStatus === 'EXPIRED';

  useEffect(() => {
    setActiveConversation(conversationId);
    markAsRead(conversationId);
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId]);

  const otherParticipantFromList = useMemo(() => {
    if (!chat || !userProfile?.id) return null;
    return (chat.participants as any[]).find((participant) => {
      const id = getParticipantId(participant);
      return !!id && id !== userProfile.id;
    }) ?? null;
  }, [chat, userProfile?.id]);

  const otherId =
    chat?.otherParticipant?.id ??
    getParticipantId(otherParticipantFromList);
  const member = useMemo(
    () => members.find((m) => m.userId === otherId),
    [members, otherId]
  );

  const memberPosts = useMemo(() => {
    if (!otherId) return [];
    return posts.filter((p) => p.authorId === otherId);
  }, [posts, otherId]);

  const hasBusiness = useMemo(
    () => (otherId ? communityBusinesses.some((b) => b.ownerId === otherId) : false),
    [communityBusinesses, otherId]
  );

  const isEmergency = !!currentCommunity?.isEmergencyMode;
  const isSecurity = member?.isSecurityMember;
  const metadataType = (chat?.metadata as any)?.type;
  const isDirectConversation = chat?.type === 'direct' || chat?.type === 'listing';
  const isNoticeConversation = chat?.type === 'notice';
  const isContextConversation =
    chat?.type === 'listing' ||
    chat?.type === 'notice' ||
    (chat?.type === 'direct' && (metadataType === 'listing' || metadataType === 'notice'));

  const otherParticipantProfile = getParticipantProfile(otherParticipantFromList);

  const name =
    member?.name ||
    otherParticipantProfile?.name ||
    chat?.otherParticipant?.name ||
    'Conversation';
  const image = member?.image || otherParticipantProfile?.profileImage || chat?.otherParticipant?.profileImage;
  const directPhone =
    otherParticipantProfile?.mobileNumber ||
    otherParticipantProfile?.phone ||
    chat?.otherParticipant?.mobileNumber ||
    chat?.otherParticipant?.phone ||
    null;
  const role = member?.role || 'MEMBER';
  const directSubtitleParts: string[] = [];
  if (member?.role) directSubtitleParts.push(member.role);
  if (hasBusiness) directSubtitleParts.push('Business owner');
  if (isSecurity) directSubtitleParts.push('Security');

  const handlePhonePress = async () => {
    if (!isDirectConversation) return;
    if (!directPhone) {
      Alert.alert('No phone number', 'This member has not added a phone number yet.');
      return;
    }

    const normalized = directPhone.replace(/[^\d+]/g, '');
    const phoneUrl = `tel:${normalized}`;

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (!canOpen) {
        Alert.alert('Call not available', 'Your device cannot open the phone dialer right now.');
        return;
      }
      await Linking.openURL(phoneUrl);
    } catch {
      Alert.alert('Call failed', 'Unable to start the phone call. Please try again.');
    }
  };

  const summaryParts: string[] = [];
  if (memberPosts.length > 0) {
    const listings = memberPosts.filter((p) => p.type === 'listing').length;
    const notices = memberPosts.filter((p) => p.type === 'notice').length;
    if (listings > 0) summaryParts.push(`${listings} listing${listings > 1 ? 's' : ''}`);
    if (notices > 0) summaryParts.push(`${notices} notice${notices > 1 ? 's' : ''}`);
  }
  if (hasBusiness) summaryParts.push('Business owner');
  if (isSecurity) summaryParts.push('Security');

  const normalizedContextMetadata = useMemo<ConversationMetadata | undefined>(() => {
    if (!chat || !isContextConversation) return undefined;

    const fallbackPost = posts.find((post) =>
      (chat.type === 'listing' && post.id === chat.listingId) ||
      (chat.type === 'notice' && post.id === chat.noticeId)
    );

    const existing = (chat.metadata ?? {}) as ConversationMetadata;
    const charitySource = charities.find((charity) => charity.id === fallbackPost?.charityId);
    const currencySymbol = existing.currency_symbol || 'R';
    const communityPrice =
      typeof existing.community_price === 'number'
        ? existing.community_price
        : typeof fallbackPost?.communityPrice === 'number'
          ? fallbackPost.communityPrice
          : typeof fallbackPost?.price === 'number'
            ? fallbackPost.price
            : undefined;

    const publicPrice =
      typeof existing.public_price === 'number'
        ? existing.public_price
        : typeof fallbackPost?.publicPrice === 'number'
          ? fallbackPost.publicPrice
          : undefined;

    const charityPrice =
      typeof existing.charity_price === 'number'
        ? existing.charity_price
        : typeof fallbackPost?.charityAmount === 'number'
          ? fallbackPost.charityAmount
          : undefined;

    const charityShort =
      existing.charity?.supported_short ||
      toSupportedShort(charitySource?.name);

    const normalized: ConversationMetadata = {
      ...existing,
      type: existing.type || chat.type,
      listing_id: existing.listing_id || chat.listingId,
      notice_id: existing.notice_id || chat.noticeId,
      listing_title: existing.listing_title || (chat.type === 'listing' ? existing.title || fallbackPost?.title : undefined),
      notice_title: existing.notice_title || (chat.type === 'notice' ? existing.title || fallbackPost?.title : undefined),
      thumbnail_url: existing.thumbnail_url || existing.image || fallbackPost?.postsImage,
      community_price: communityPrice,
      public_price: publicPrice,
      currency_symbol: currencySymbol,
      charity_price: charityPrice,
      charity: {
        supported_short: charityShort,
        contribution_per_item:
          existing.charity?.contribution_per_item ??
          charityPrice,
      },
      title: existing.title || fallbackPost?.title,
      image: existing.image || fallbackPost?.postsImage,
    };

    if (!normalized.listing_title && !normalized.notice_title && !normalized.title) {
      return undefined;
    }

    return normalized;
  }, [charities, chat, isContextConversation, posts]);

  const handleChatScrollOffsetChange = useCallback((offsetY: number) => {
    const shouldCollapse = offsetY > 32;
    setIsContextCardCollapsed((prev) => (prev === shouldCollapse ? prev : shouldCollapse));
  }, []);

  const headerImage = image;
  const headerTitle = name;
  const headerSubtitle = directSubtitleParts.length > 0
    ? directSubtitleParts.join(' · ')
    : 'tap here for contact info';

  // Fallback: if conversation not loaded yet, show minimal UI
  const placeholder = chat?.type === 'emergency' ? 'Send emergency update...' : 'Type a message...';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{ backgroundColor: '#f0f2f5', borderBottomWidth: 1, borderBottomColor: THEME_COLORS.chatBorder }}>
          <View className="flex-row items-center justify-between px-3 py-2 min-h-[66px]">
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/chat');
                  }
                }}
                activeOpacity={0.7}
                className="p-1.5 rounded-full"
              >
                <ArrowLeft size={22} color={THEME_COLORS.chatTextStrong} />
              </TouchableOpacity>

              {headerImage ? (
                <Image
                  source={{ uri: headerImage }}
                  className="w-10 h-10 rounded-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: THEME_COLORS.chatAvatarSurface }}>
                  <Text className="font-bold" style={{ color: THEME_COLORS.chatTextStrong }}>
                    {headerTitle.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-[16px] font-bold" style={{ color: THEME_COLORS.chatTextStrong }}>
                  {headerTitle}
                </Text>
                <Text numberOfLines={1} className="text-[12px]" style={{ color: THEME_COLORS.neutralTextWhatsapp }}>
                  {headerSubtitle}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3 pl-2">
              {isDirectConversation ? (
                <TouchableOpacity onPress={handlePhonePress} className="p-1.5 rounded-full" activeOpacity={0.8}>
                  <Phone size={20} color={THEME_COLORS.neutralTextWhatsapp} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity className="p-1.5 rounded-full" activeOpacity={0.8}>
                  <Search size={20} color={THEME_COLORS.neutralTextWhatsapp} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="p-1.5 rounded-full"
                activeOpacity={0.8}
                onPress={() => setScrollToBottomRequest((prev) => prev + 1)}
              >
                <ChevronDown size={20} color={THEME_COLORS.neutralTextWhatsapp} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary bar */}
          {!isNoticeConversation && !isDirectConversation && summaryParts.length > 0 && (
            <View className="flex-row items-center gap-1.5 px-4 pb-2">
              <FileText size={12} color={THEME_COLORS.neutralTextSoft} />
              <Text className="text-[11px] text-gray-400 font-medium">
                {summaryParts.join(' · ')}
              </Text>
            </View>
          )}
        </View>

        {isContextConversation && normalizedContextMetadata ? (
          <ChatContextCard
            conversationType={chat?.type ?? 'direct'}
            metadata={normalizedContextMetadata}
            collapsed={isContextCardCollapsed}
          />
        ) : null}

        {/* Message list */}
        <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
          <ChatWindow
            messages={messages}
            conversation={chat || { id: conversationId, participants: [], type: 'direct', lastMessage: '', lastMessageAt: '', priority: 'normal', unreadCount: 0 }}
            isTyping={isTyping}
            onScrollOffsetChange={handleChatScrollOffsetChange}
            scrollToBottomRequest={scrollToBottomRequest}
          />
        </View>

        {/* Composer */}
        <ChatComposer
          onSend={(text) => sendMessage(text)}
          onSendAttachment={(url, type) => sendMessage('', type, url)}
          onTyping={(typing) => setTypingStatus(conversationId, typing)}
          placeholder={placeholder}
          disabled={!!isChatDisabled}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
