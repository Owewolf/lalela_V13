import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo } from 'react';
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
import { ArrowLeft, Shield, Store, FileText, ChevronDown, Search, MapPin, AlertTriangle, Info, Video, Phone } from 'lucide-react-native';
import { Conversation } from '../../types';
import { ChatWindow } from './ChatWindow';
import { ChatComposer } from './ChatComposer';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

interface ChatDetailPageProps {
  conversationId: string;
}

export const ChatDetailPage: React.FC<ChatDetailPageProps> = ({ conversationId }) => {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { startCall } = useCall();
  const {
    messages,
    sendMessage,
    setTypingStatus,
    isTyping,
    markAsRead,
    members,
    posts,
    communityBusinesses,
    currentCommunity,
    conversations,
    setActiveConversation,
  } = useCommunity();

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

  const otherId = chat?.otherParticipant?.id ?? chat?.participants?.find((p, i) => i === 1);
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
  const isDirectConversation = chat?.type === 'direct' || chat?.type === 'listing';
  const isNoticeConversation = chat?.type === 'notice';

  const name =
    member?.name ||
    chat?.otherParticipant?.name ||
    'Conversation';
  const image = member?.image || chat?.otherParticipant?.profileImage;
  const directPhone =
    chat?.otherParticipant?.mobileNumber ||
    chat?.otherParticipant?.phone ||
    null;
  const role = member?.role || 'MEMBER';
  const directSubtitleParts: string[] = [];
  if (member?.role) directSubtitleParts.push(member.role);
  if (hasBusiness) directSubtitleParts.push('Business owner');
  if (isSecurity) directSubtitleParts.push('Security');

  const noticeTitle = chat?.metadata?.title || 'Notice';
  const noticeImage = chat?.metadata?.image;
  const noticeDescription = chat?.metadata?.description;
  const noticeLocation = chat?.metadata?.location;
  const noticeAuthor = chat?.metadata?.author;
  const noticeAuthorImage = chat?.metadata?.authorImage;
  const noticeUrgency = chat?.metadata?.urgencyLevel || chat?.metadata?.urgency || 'general';

  const noticeUrgencyStyle = () => {
    const value = String(noticeUrgency).toLowerCase();
    if (value === 'emergency') {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        label: 'Emergency',
      };
    }
    if (value === 'warning' || value === 'high') {
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        label: 'Warning',
      };
    }
    if (value === 'info' || value === 'medium') {
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: 'Info',
      };
    }
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'General',
    };
  };

  const urgencyBadge = noticeUrgencyStyle();

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

  const handleVideoPress = async () => {
    if (!isDirectConversation) return;
    if (!otherId) {
      Alert.alert('Cannot start call', 'Unable to identify the other participant.');
      return;
    }
    await startCall(otherId as string, name, 'video', conversationId);
  };

  const roleBadgeBg = (r: string) => {
    switch (r) {
      case 'ADMIN': return '#0d3d47';
      case 'MODERATOR': return '#8b5cf6';
      default: return '#9ca3af';
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

  // Fallback: if conversation not loaded yet, show minimal UI
  const placeholder = chat?.type === 'emergency' ? 'Send emergency update...' : 'Type a message...';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#f7f8fc' }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between px-4 py-2.5 min-h-[70px]">
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
            <TouchableOpacity
              onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/chat');
            }
          }}
              activeOpacity={0.7}
              className="p-1.5 -ml-1.5 rounded-xl"
            >
              <ArrowLeft size={20} color="#111827" />
            </TouchableOpacity>

            {isNoticeConversation ? (
              <>
                <View className="relative flex-shrink-0">
                  {noticeImage ? (
                    <Image
                      source={{ uri: noticeImage }}
                      className="w-12 h-12 rounded-2xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-2xl bg-amber-100 items-center justify-center">
                      <AlertTriangle size={18} color="#b45309" />
                    </View>
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} className="font-black text-gray-900 text-[18px] leading-[22px]">
                    {noticeTitle}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                    <View className={[urgencyBadge.bg, 'px-1.5 py-0.5 rounded flex-row items-center gap-1'].join(' ')}>
                      {urgencyBadge.label === 'Info' ? (
                        <Info size={10} color="#1d4ed8" />
                      ) : (
                        <AlertTriangle size={10} color={urgencyBadge.label === 'Emergency' ? '#b91c1c' : '#b45309'} />
                      )}
                      <Text className={[urgencyBadge.text, 'text-[10px] font-bold uppercase tracking-wider'].join(' ')}>
                        {urgencyBadge.label}
                      </Text>
                    </View>
                    {!!noticeLocation && (
                      <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100">
                        <MapPin size={10} color="#4b5563" />
                        <Text numberOfLines={1} className="text-[10px] text-gray-600 font-semibold max-w-[140px]">
                          {noticeLocation}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!noticeAuthor && (
                    <View className="flex-row items-center gap-1.5 mt-1">
                      {noticeAuthorImage ? (
                        <Image source={{ uri: noticeAuthorImage }} className="w-4 h-4 rounded-full" resizeMode="cover" />
                      ) : (
                        <View className="w-4 h-4 rounded-full bg-gray-200 items-center justify-center">
                          <Text className="text-[9px] font-bold text-gray-600">{noticeAuthor.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text className="text-[10px] text-gray-500 font-semibold" numberOfLines={1}>
                        Posted by {noticeAuthor}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : isDirectConversation ? (
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="font-black text-gray-900 text-[18px] leading-[22px]">
                  {name}
                </Text>
                {directSubtitleParts.length > 0 ? (
                  <Text numberOfLines={1} className="text-[12px] text-gray-500 mt-0.5">
                    {directSubtitleParts.join(' · ')}
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
                {/* Avatar */}
                <View className="relative flex-shrink-0">
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      className="w-12 h-12 rounded-2xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-2xl bg-surface items-center justify-center">
                      <Text className="text-primary font-bold text-lg">
                        {(name)[0].toUpperCase()}
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
                      <Shield size={12} color="white" />
                    </View>
                  )}
                </View>

                {/* Name + badges */}
                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} className="font-black text-gray-900 text-[18px] leading-[22px]">
                    {name}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <View
                      style={{ backgroundColor: roleBadgeBg(role) }}
                      className="px-1.5 py-0.5 rounded"
                    >
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                        {role}
                      </Text>
                    </View>
                    {hasBusiness && (
                      <View className="flex-row items-center gap-0.5 bg-amber-100 px-1.5 py-0.5 rounded">
                        <Store size={10} color="#d97706" />
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                          Biz
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
            </View>

            {isDirectConversation ? (
              <View className="flex-row items-center gap-2 pl-3">
                <TouchableOpacity
                  onPress={handleVideoPress}
                  className="w-11 h-11 rounded-full bg-[#f5f5f5] items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Video size={21} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePhonePress}
                  className="w-11 h-11 rounded-full bg-[#f5f5f5] items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Phone size={20} color="#111827" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 pl-3">
                <TouchableOpacity className="p-1 rounded-xl" activeOpacity={0.8}>
                  <ChevronDown size={22} color="#0d3d47" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1 rounded-xl" activeOpacity={0.8}>
                  <Search size={21} color="#0d3d47" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Summary bar */}
          {!isNoticeConversation && !isDirectConversation && summaryParts.length > 0 && (
            <View className="flex-row items-center gap-1.5 px-4 pb-2">
              <FileText size={12} color="#9ca3af" />
              <Text className="text-[11px] text-gray-400 font-medium">
                {summaryParts.join(' · ')}
              </Text>
            </View>
          )}
        </View>

        {/* Contextual item header (non one-on-one context) */}
        {chat?.metadata?.title && !isNoticeConversation && !isDirectConversation && (
          <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row gap-3 items-center">
            {chat.metadata.image ? (
              <Image
                source={{ uri: chat.metadata.image }}
                className="w-12 h-12 rounded-lg"
                resizeMode="cover"
              />
            ) : (
              <View className="w-12 h-12 rounded-lg bg-gray-100 items-center justify-center">
                <Text className="text-gray-400 text-lg font-bold">
                  {chat.metadata.title?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>
            )}
            <View className="flex-1 min-w-0">
              <Text className="text-gray-900 text-base font-bold" numberOfLines={1}>
                {chat.metadata.title}
              </Text>
              {chat.metadata.price ? (
                <Text className="text-primary text-sm font-semibold mt-0.5">{chat.metadata.price}</Text>
              ) : null}
              {chat.metadata.description ? (
                <Text className="text-gray-500 text-xs mt-0.5 leading-snug" numberOfLines={1}>
                  {chat.metadata.description}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Message list */}
        <View className="flex-1 bg-[#f7f8fc]">
          <ChatWindow
            messages={messages}
            conversation={chat || { id: conversationId, participants: [], type: 'direct', lastMessage: '', lastMessageAt: '', priority: 'normal', unreadCount: 0 }}
            isTyping={isTyping}
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
