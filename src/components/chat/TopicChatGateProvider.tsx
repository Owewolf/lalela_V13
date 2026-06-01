import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { CommunityNotice, ConversationMetadata } from '../../types';
import { prefetchConversationMessages } from '../../hooks/queries/useConversationMessages';
import { TopicInfoModal } from './TopicInfoModal';

type TopicChatRequest = {
  post: CommunityNotice;
  communityId?: string;
};

type TopicChatGateValue = {
  openTopicChat: (request: TopicChatRequest) => void;
};

const TopicChatGateContext = createContext<TopicChatGateValue | null>(null);

const buildTopicMetadata = (post: CommunityNotice, charityShort?: string): ConversationMetadata => {
  const postImage = post.postsImage || (post as any).imageUrl;
  return {
    type: post.type,
    listing_id: post.type === 'listing' ? post.id : undefined,
    notice_id: post.type === 'notice' ? post.id : undefined,
    listing_title: post.type === 'listing' ? post.title : undefined,
    notice_title: post.type === 'notice' ? post.title : undefined,
    thumbnail_url: postImage,
    title: post.title,
    image: postImage,
    community_price: post.communityPrice ?? post.price,
    public_price: post.publicPrice,
    charity_price: post.charityAmount,
    charity: {
      supported_short: charityShort,
      contribution_per_item: post.charityAmount,
    },
    author: post.authorName,
    authorImage: post.authorImage,
    authorRole: post.authorRole,
    location: post.locationName,
    latitude: post.latitude,
    longitude: post.longitude,
    urgency: post.urgency,
    urgencyLevel: post.urgencyLevel,
    isOpenExchange: post.isOpenExchange,
    exchangePreference: post.isOpenExchange ? 'EXCHANGE' : 'CAT',
    description: post.description,
    price: post.type === 'listing' && typeof post.price === 'number' ? `R${(post.communityPrice || post.price).toLocaleString()}` : undefined,
  };
};

export function TopicChatGateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const { charities, startConversation, setActiveConversation } = useCommunity();
  const [pending, setPending] = useState<TopicChatRequest | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  const openTopicChat = useCallback((request: TopicChatRequest) => {
    setPending(request);
  }, []);

  const closeModal = useCallback(() => {
    if (openingChat) return;
    setPending(null);
  }, [openingChat]);

  const handleOpenChat = useCallback(async () => {
    if (!pending) return;
    if (!userProfile?.id || !pending.post.authorId) {
      Alert.alert('Chat unavailable', 'This topic cannot be opened for chat right now.');
      return;
    }
    if (pending.post.authorId === userProfile.id) {
      Alert.alert('Unavailable', 'You cannot open a direct chat with yourself.');
      return;
    }

    setOpeningChat(true);
    try {
      const charity = charities.find((entry) => entry.id === pending.post.charityId);
      const charityShort = charity?.name
        ? charity.name
            .split(/\s+/)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
            .slice(0, 5)
        : undefined;

      const conversationId = await startConversation({
        participants: Array.from(new Set([userProfile.id, pending.post.authorId])),
        type: pending.post.type,
        communityId: pending.communityId,
        listingId: pending.post.type === 'listing' ? pending.post.id : undefined,
        noticeId: pending.post.type === 'notice' ? pending.post.id : undefined,
        metadata: buildTopicMetadata(pending.post, charityShort),
      });

      setActiveConversation(conversationId);
      await prefetchConversationMessages(queryClient, conversationId);
      setPending(null);
      router.push(`/chat/${conversationId}` as any);
    } catch (error) {
      console.error('Failed to open topic chat:', error);
      Alert.alert('Chat unavailable', 'We could not open the conversation for this topic.');
    } finally {
      setOpeningChat(false);
    }
  }, [charities, pending, router, setActiveConversation, startConversation, userProfile?.id]);

  const value = useMemo<TopicChatGateValue>(() => ({
    openTopicChat,
  }), [openTopicChat]);

  return (
    <TopicChatGateContext.Provider value={value}>
      {children}
      <TopicInfoModal
        visible={!!pending}
        post={pending?.post ?? null}
        loading={openingChat}
        onClose={closeModal}
        onOpenChat={handleOpenChat}
      />
    </TopicChatGateContext.Provider>
  );
}

export const useTopicChatGate = () => {
  const context = useContext(TopicChatGateContext);
  if (!context) {
    throw new Error('useTopicChatGate must be used within TopicChatGateProvider');
  }
  return context;
};
