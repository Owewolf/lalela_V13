import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Conversation, Message } from '../../types';
import { useFirebase } from '../../context/FirebaseContext';

interface MessageBubbleProps {
  message: Message;
  isSequential?: boolean;
  isFirstInCluster?: boolean;
  isMiddleInCluster?: boolean;
  isLastInCluster?: boolean;
  conversationType: Conversation['type'];
}

const AVATAR_SIZE = 32;
const AVATAR_GUTTER = 40;

const SENDER_NAME_COLORS = ['#d81b60', '#00897b', '#5e35b1', '#ef6c00', '#1565c0', '#2e7d32'];

const getSenderNameColor = (message: Message) => {
  const seed = message.senderId || message.senderName || 'sender';
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
}) => {
  const { user } = useFirebase();
  const isMe = message.senderId === user?.uid;
  const isDirectConversation = conversationType === 'direct';
  const firstInCluster = isFirstInCluster ?? !isSequential;
  const middleInCluster = isMiddleInCluster ?? false;
  const lastInCluster = isLastInCluster ?? true;
  const showSenderName = !isMe && !isDirectConversation && firstInCluster;
  const showSenderAvatar = !isMe && !isDirectConversation && lastInCluster;
  const isListingIntro = !!message.isListingIntro;
  const senderInitial = (message.senderName || '?').charAt(0).toUpperCase();
  const senderNameColor = getSenderNameColor(message);
  const imageCaption = (message.text || '').trim();
  const showImageCaption = imageCaption.length > 0 && imageCaption.toLowerCase() !== 'photo';

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
        <View className="bg-[#e9edef] px-4 py-1.5 rounded-full border border-[#d7dde0]">
          <Text className="text-[10px] font-bold text-[#54656f] uppercase tracking-widest">
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  const bubbleClassName = [
    'relative overflow-hidden',
    isMe ? 'rounded-[18px] rounded-br-md' : 'rounded-[18px] rounded-bl-md',
    message.messageType === 'image' ? '' : 'px-3 py-1.5',
    isListingIntro ? 'border-l-4 border-[#fc7127]' : '',
  ].join(' ');

  const bubbleStyle = isMe
    ? {
        backgroundColor: '#d9fdd3',
        maxWidth: isDirectConversation ? '92%' as const : '87%' as const,
      }
    : {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
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
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, marginBottom: 1, marginRight: 8, borderRadius: AVATAR_SIZE / 2 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  marginBottom: 1,
                  marginRight: 8,
                  borderRadius: AVATAR_SIZE / 2,
                }}
                className="bg-[#dfe5e7] items-center justify-center"
              >
                <Text className="text-[11px] font-bold text-[#54656f]">{senderInitial}</Text>
              </View>
            )
          ) : (
            <View style={{ width: AVATAR_GUTTER }} />
          )
        ) : null}

        <View>
          <View className={bubbleClassName} style={bubbleStyle}>
            {showSenderName && (
              <View className="mb-0.5">
                <Text className="text-[14px] font-black leading-4" style={{ color: senderNameColor }}>
                  {message.senderName}
                </Text>
              </View>
            )}

            {message.messageType === 'image' && message.attachment_url ? (
              <>
                <TouchableOpacity
                  onPress={() => message.attachment_url && Linking.openURL(message.attachment_url)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: message.attachment_url }}
                    className="w-60 h-44"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {showImageCaption ? (
                  <Text className="text-[16px] leading-5 px-3 pt-1.5 text-[#111b21]">
                    {imageCaption}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text
                  className={isListingIntro ? 'text-[17px] leading-6 text-[#111b21] font-black' : 'text-[16px] leading-6 text-[#111b21]'}
                  style={{
                    paddingBottom: 1,
                  }}
                >
                  {message.text}
                </Text>
                <View
                  className="flex-row items-center justify-end gap-0.5"
                  style={{
                    marginTop: 2,
                    paddingBottom: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: Platform.OS === 'ios' ? 14 : 15,
                      color: '#667781',
                      fontWeight: '500',
                    }}
                  >
                    {formatTime(message.createdAt)}
                  </Text>
                  {isMe && (
                    <View className="justify-center" style={{ minWidth: 16 }}>
                      {message.status === 'read' ? (
                        <CheckCheck size={15} color="#53bdeb" />
                      ) : (
                        <Check size={15} color="#667781" />
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
                  paddingHorizontal: 14,
                  paddingBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: Platform.OS === 'ios' ? 14 : 15,
                    color: '#667781',
                    fontWeight: '500',
                  }}
                >
                  {formatTime(message.createdAt)}
                </Text>
                {isMe && (
                  <View className="justify-center" style={{ minWidth: 16 }}>
                    {message.status === 'read' ? (
                      <CheckCheck size={15} color="#53bdeb" />
                    ) : (
                      <Check size={15} color="#667781" />
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
