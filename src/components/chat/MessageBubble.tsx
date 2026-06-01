import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Conversation, ConversationMetadata, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../lib/config';
import { THEME_COLORS } from '../../theme/colors';

interface MessageBubbleProps {
  message: Message;
  isSequential?: boolean;
  isFirstInCluster?: boolean;
  isMiddleInCluster?: boolean;
  isLastInCluster?: boolean;
  conversationType: Conversation['type'];
  conversationMetadata?: ConversationMetadata;
}

const AVATAR_SIZE = 32;
const AVATAR_GUTTER = 40;
const TYPE_SCALE = {
  sm: 12,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 1,
  xs: 2,
  sm: 8,
  lg: 10,
  xl: 14,
};

const SENDER_NAME_COLORS = [THEME_COLORS.aliasHex_d81b60, THEME_COLORS.aliasHex_00897b, THEME_COLORS.aliasHex_5e35b1, THEME_COLORS.aliasHex_ef6c00, THEME_COLORS.aliasHex_1565c0, THEME_COLORS.aliasHex_2e7d32];

const getSenderNameColor = (message: Message) => {
  const seed = message.userId || message.senderName || 'sender';
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return SENDER_NAME_COLORS[hash % SENDER_NAME_COLORS.length];
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSequential,
  isFirstInCluster,
  isMiddleInCluster,
  isLastInCluster,
  conversationType,
  conversationMetadata,
}) => {
  const { userProfile } = useAuth();
  const isMe = message.userId === userProfile?.id;
  const isDirectConversation = conversationType === 'direct';
  const firstInCluster = isFirstInCluster ?? !isSequential;
  const middleInCluster = isMiddleInCluster ?? false;
  const lastInCluster = isLastInCluster ?? true;
  const showSenderName = !isMe && !isDirectConversation && firstInCluster;
  const showSenderAvatar = !isMe && !isDirectConversation && lastInCluster;
  const isListingIntro = !!message.isListingIntro;
  const senderInitial = (message.senderName || '?').charAt(0).toUpperCase();
  const senderNameColor = getSenderNameColor(message);
  const imageCaption = (message.content || '').trim();
  const showImageCaption = imageCaption.length > 0 && imageCaption.toLowerCase() !== 'photo';
  const metadataLabel =
    typeof message.metadataLabel === 'string' && message.metadataLabel.trim().length > 0
      ? message.metadataLabel.trim()
      : null;

  const rowTopSpacing = firstInCluster ? 6 : 2;

  const formatTime = (createdAt: string) => {
    try {
         return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  if (message.messageType === 'system') {
    return (
      <View className="flex-row justify-center my-3">
        <View
          className="bg-surface-container px-4 py-1.5 rounded-full border"
          style={{ borderColor: THEME_COLORS.neutralBorderSoft }}
        >
          <Text className="text-[10px] font-bold text-neutralTextMuted uppercase tracking-widest">
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const bubbleClassName = [
    'relative overflow-hidden',
    isMe ? 'rounded-[18px] rounded-br-md' : 'rounded-[18px] rounded-bl-md',
    message.messageType === 'image' ? '' : 'px-3 py-2',
    isListingIntro ? 'border-l-4 border-secondary-container' : '',
  ].join(' ');

  const bubbleStyle = isMe
    ? {
        backgroundColor: THEME_COLORS.aliasHex_d9fdd3,
        maxWidth: isDirectConversation ? '92%' as const : '87%' as const,
      }
    : {
        backgroundColor: THEME_COLORS.white,
        borderWidth: 1,
        borderColor: THEME_COLORS.chatBorder,
        maxWidth: isDirectConversation ? '90%' as const : '82%' as const,
      };

  return (
    <View style={{ marginTop: rowTopSpacing }} className={isMe ? 'items-end' : 'items-start'}>
      <View className={[isMe ? 'self-end' : 'self-start', 'flex-row items-end'].join(' ')}>
        {!isMe && !isDirectConversation ? (
          showSenderAvatar ? (
            message.senderImage ? (
              <Image
                source={{ uri: message.senderImage }}
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, marginBottom: SPACE.xxs, marginRight: SPACE.sm, borderRadius: AVATAR_SIZE / 2 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  marginBottom: SPACE.xxs,
                  marginRight: SPACE.sm,
                  borderRadius: AVATAR_SIZE / 2,
                }}
                className="bg-surface-container items-center justify-center"
              >
                <Text className="text-[11px] font-bold text-neutralTextMuted">{senderInitial}</Text>
              </View>
            )
          ) : (
            <View style={{ width: AVATAR_GUTTER }} />
          )
        ) : null}

        <View>
          <View className={bubbleClassName} style={bubbleStyle}>
            {metadataLabel ? (
              <View className="mb-1">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-neutralTextMuted">
                  {metadataLabel}
                </Text>
              </View>
            ) : null}

            {showSenderName && (
              <View className="mb-0.5">
                <Text className="text-[14px] font-black leading-4" style={{ color: senderNameColor }}>
                  {message.senderName}
                </Text>
              </View>
            )}

            {message.messageType === 'image' && message.attachmentUrl ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const u = resolveMediaUrl(message.attachmentUrl);
                    if (u) Linking.openURL(u);
                  }}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(message.attachmentUrl) }}
                    className="w-60 h-44"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {showImageCaption ? (
                  <Text className="text-[16px] leading-5 px-3 pt-1.5 text-neutralTextStrong">
                    {imageCaption}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text
                  className={isListingIntro ? 'text-[17px] leading-6 text-neutralTextStrong font-black' : 'text-[16px] leading-6 text-neutralTextStrong'}
                  style={{
                    paddingBottom: SPACE.xs,
                  }}
                >
                  {message.content}
                </Text>
                <View
                  className="flex-row items-center justify-end gap-0.5"
                  style={{
                    marginTop: SPACE.xs,
                    paddingBottom: SPACE.xxs,
                  }}
                >
                  <Text
                    style={{
                      fontSize: TYPE_SCALE.sm,
                      lineHeight: Platform.OS === 'ios' ? 14 : 15,
                      color: THEME_COLORS.neutralTextWhatsapp,
                      fontWeight: FONT_WEIGHT.medium,
                    }}
                  >
                    {formatTime(message.createdAt)}
                  </Text>
                  {isMe && (
                    <View className="justify-center" style={{ minWidth: 16 }}>
                      {message.status === 'read' ? (
                        <CheckCheck size={15} color={THEME_COLORS.aliasHex_53bdeb} />
                      ) : (
                        <Check size={15} color={THEME_COLORS.neutralTextWhatsapp} />
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {message.messageType === 'image' ? (
              <View
                className="flex-row items-center justify-end gap-0.5 self-end"
                style={{
                  minHeight: 16,
                  marginTop: showSenderName ? 2 : 4,
                  paddingHorizontal: SPACE.xl,
                  paddingBottom: SPACE.lg,
                }}
              >
                <Text
                  style={{
                    fontSize: TYPE_SCALE.sm,
                    lineHeight: Platform.OS === 'ios' ? 14 : 15,
                    color: THEME_COLORS.neutralTextWhatsapp,
                    fontWeight: FONT_WEIGHT.medium,
                  }}
                >
                  {formatTime(message.createdAt)}
                </Text>
                {isMe && (
                  <View className="justify-center" style={{ minWidth: 16 }}>
                    {message.status === 'read' ? (
                      <CheckCheck size={15} color={THEME_COLORS.aliasHex_53bdeb} />
                    ) : (
                      <Check size={15} color={THEME_COLORS.neutralTextWhatsapp} />
                    )}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};
