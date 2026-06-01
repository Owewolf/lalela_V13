import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, FlatList, Animated, Platform } from 'react-native';
import { Message, Conversation } from '../../types';
import { MessageBubble } from './MessageBubble';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';

interface ChatWindowProps {
  messages: Message[];
  conversation: Conversation;
  isTyping?: boolean;
  emptyStateText?: string;
  onScrollOffsetChange?: (offsetY: number) => void;
}

type TimelineItem =
  | { type: 'date'; id: string; label: string }
  | {
      type: 'message';
      id: string;
      message: Message;
      isSequential: boolean;
      isFirstInCluster: boolean;
      isMiddleInCluster: boolean;
      isLastInCluster: boolean;
    };

const CLUSTER_WINDOW_MS = 5 * 60 * 1000;
const SPACE = {
  xxs: 4,
  md: 10,
  lg: 18,
};

const isSameClusterMessage = (left?: Message, right?: Message) => {
  if (!left || !right) return false;
  if (left.messageType === 'system' || right.messageType === 'system') return false;
  if (left.userId !== right.userId) return false;

  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;

  return Math.abs(rightTime - leftTime) < CLUSTER_WINDOW_MS;
};

const formatDateLabel = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(1)).current;
  const dot2 = useRef(new Animated.Value(1)).current;
  const dot3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1.4, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, []);

  return (
    <View className="flex-row items-center gap-2 ml-1 mt-4 mb-2">
      <View
        className="flex-row items-center gap-1 px-3 py-2 rounded-full rounded-tl-none border"
        style={{ borderColor: THEME_COLORS.chatBorder, backgroundColor: THEME_COLORS.white }}
      >
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{ transform: [{ scale: dot }] }}
            className="w-1.5 h-1.5 bg-primary rounded-full"
          />
        ))}
      </View>
      <Text className="text-[10px] font-bold text-neutralTextMuted">Someone is typing...</Text>
    </View>
  );
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  conversation,
  isTyping,
  emptyStateText,
  onScrollOffsetChange,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    let previousDateKey: string | undefined;

    messages.forEach((message, index) => {
      const createdAt = new Date(message.createdAt);
      const dateKey = Number.isNaN(createdAt.getTime()) ? `unknown-${message.id}` : createdAt.toDateString();

      if (dateKey !== previousDateKey) {
        items.push({
          type: 'date',
          id: `date-${dateKey}`,
          label: formatDateLabel(message.createdAt),
        });
        previousDateKey = dateKey;
      }

      const previousMessage = messages[index - 1];
      const nextMessage = messages[index + 1];

      const previousSharesCluster = isSameClusterMessage(previousMessage, message);
      const nextSharesCluster = isSameClusterMessage(message, nextMessage);

      const isSequential = previousSharesCluster;
      const isFirstInCluster = !previousSharesCluster;
      const isLastInCluster = !nextSharesCluster;
      const isMiddleInCluster = previousSharesCluster && nextSharesCluster;

      items.push({
        type: 'message',
        id: message.id,
        message,
        isSequential,
        isFirstInCluster,
        isMiddleInCluster,
        isLastInCluster,
      });
    });

    return items;
  }, [messages]);

  // Scroll to end when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isTyping]);

  const renderItem = ({ item }: { item: TimelineItem }) => {
    if (item.type === 'date') {
      return (
        <View className="items-center my-3">
          <View
            className="border rounded-full px-3 py-1"
            style={{
              borderColor: THEME_COLORS.overlayBorder,
              backgroundColor: THEME_COLORS.whiteOverlay90,
            }}
          >
            <Text className="text-[11px] font-semibold" style={{ color: THEME_COLORS.slateWhatsapp }}>{item.label}</Text>
          </View>
        </View>
      );
    }

    return (
      <MessageBubble
        message={item.message}
        isSequential={item.isSequential}
        isFirstInCluster={item.isFirstInCluster}
        isMiddleInCluster={item.isMiddleInCluster}
        isLastInCluster={item.isLastInCluster}
        conversationType={conversation.type}
        conversationMetadata={conversation.metadata}
      />
    );
  };

  const ListEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-20 opacity-50">
      <View className="w-16 h-16 bg-surface-container rounded-full items-center justify-center mb-4">
        <Text className="text-2xl">👋</Text>
      </View>
      <Text className="text-sm font-medium text-gray-500 text-center">
        {emptyStateText || 'Say hello to start the conversation!'}
      </Text>
    </View>
  );

  const ListFooterComponent = () => (
    <View>
      {isTyping && <TypingIndicator />}
      <View className="h-4" />
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <FlatList
        ref={flatListRef}
        data={timelineItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={{
          paddingLeft: SPACE.md,
          paddingRight: SPACE.xxs,
          paddingTop: SPACE.lg,
          paddingBottom: SPACE.md,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />
    </View>
  );
};
