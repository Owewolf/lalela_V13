import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView from 'react-native-maps';
import {
  MapPin,
  Siren,
  ChevronUp,
  ChevronDown,
  Shield,
  Navigation,
  ArrowLeft,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { EmergencyMap } from './EmergencyMap';
import { ChatWindow } from '../chat/ChatWindow';
import { ChatComposer } from '../chat/ChatComposer';

interface EmergencyHubProps {
  emergencyId: string;
}

const MAP_EXPANDED_HEIGHT = 280;
const MAP_COLLAPSED_HEIGHT = 72;

export const EmergencyHub: React.FC<EmergencyHubProps> = ({ emergencyId }) => {
  const router = useRouter();
  const {
    posts,
    securityResponders,
    members,
    startConversation,
    setActiveConversation,
    messages,
    sendMessage,
    activeConversation,
  } = useCommunity();
  const { userProfile } = useAuth();

  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const mapHeightAnim = useRef(new Animated.Value(MAP_EXPANDED_HEIGHT)).current;
  const mapRef = useRef<MapView | null>(null);

  // Find the emergency post from the posts list
  const emergencyPost = useMemo(
    () => posts.find((p) => p.id === emergencyId) ?? null,
    [posts, emergencyId],
  );

  // Animate map height when expanded/collapsed
  useEffect(() => {
    Animated.timing(mapHeightAnim, {
      toValue: isMapExpanded ? MAP_EXPANDED_HEIGHT : MAP_COLLAPSED_HEIGHT,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [isMapExpanded]);

  // Extract shared locations from chat messages
  const sharedLocations = useMemo(() => {
    return messages
      .filter((msg) => msg.text.startsWith('Shared Location:'))
      .map((msg) => {
        const coords = msg.text
          .replace('Shared Location:', '')
          .split(',')
          .map((c) => parseFloat(c.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          return {
            id: msg.id,
            lat: coords[0],
            lng: coords[1],
            senderName: msg.senderName,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ id: string; lat: number; lng: number; senderName: string }>;
  }, [messages]);

  // Enrich messages with member data
  const enrichedMessages = useMemo(() => {
    return messages.map((msg) => {
      let senderName = msg.senderName;
      let senderImage = msg.senderImage;
      let role = msg.senderRole;

      const senderMember = members.find((m) => m.user_id === msg.senderId);
      if (senderMember) {
        if (!senderName) senderName = senderMember.name || `Member ${msg.senderId.slice(0, 4)}`;
        if (!senderImage) senderImage = senderMember.image;
      }

      const responder = securityResponders.find((r) => r.user_id === msg.senderId);
      if (responder) {
        if (!senderName) senderName = responder.name;
        if (!senderImage) senderImage = responder.image;
        role = 'Responder' as any;
      }

      if (emergencyPost && msg.senderId === emergencyPost.author_id) {
        role = 'Author' as any;
      }

      return {
        ...msg,
        senderRole: role,
        senderName: senderName || 'Community Member',
        senderImage,
      };
    });
  }, [messages, emergencyPost, securityResponders, members]);

  // Initialise the emergency conversation
  useEffect(() => {
    if (!emergencyPost) return;

    const initChat = async () => {
      const allMemberIds = members.map((m) => m.user_id);
      const participantSet = new Set(allMemberIds);
      if (emergencyPost.author_id) participantSet.add(emergencyPost.author_id);
      if (userProfile?.id) participantSet.add(userProfile.id);
      securityResponders.forEach((r) => participantSet.add(r.user_id));

      const convId = await startConversation({
        participants: Array.from(participantSet),
        type: 'emergency',
        emergencyId: emergencyPost.id,
        metadata: {
          title: emergencyPost.title,
          location: emergencyPost.locationName,
        },
      });
      setActiveConversation(convId);
    };

    initChat();
    return () => setActiveConversation(null);
  }, [emergencyId, members.length, securityResponders.length]);

  const handleSendLocation = () => {
    if (userProfile?.liveLocation) {
      sendMessage(
        `Shared Location: ${userProfile.liveLocation.latitude}, ${userProfile.liveLocation.longitude}`,
        'text',
      );
    }
  };

  if (!emergencyPost) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#0d3d47" size="large" />
        <Text className="text-sm text-gray-500 mt-3">Loading emergency...</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <SafeAreaView className="flex-1 bg-white">
      {/* Map section */}
      <Animated.View style={{ height: mapHeightAnim }} className="relative bg-gray-100 border-b border-gray-200">
        {isMapExpanded ? (
          <EmergencyMap
            emergencyPost={emergencyPost}
            resetTrigger={resetTrigger}
            mapRef={mapRef}
          />
        ) : (
          <View className="absolute inset-0 flex-row items-center px-5 bg-white/80">
            <View className="bg-red-100 p-2 rounded-full mr-3">
              <MapPin color="#DC2626" size={16} />
            </View>
            <View>
              <Text className="text-xs font-bold text-primary">Map Minimized</Text>
              <Text className="text-xs text-gray-400">Tap to expand situational awareness</Text>
            </View>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-4 left-4 bg-white/95 p-2 rounded-xl shadow"
          style={{ zIndex: 30, elevation: 8 }}
          activeOpacity={0.8}
        >
          <ArrowLeft color="#0d3d47" size={20} />
        </TouchableOpacity>

        {/* Map controls */}
        <View className="absolute top-4 right-4 gap-2">
          <TouchableOpacity
            onPress={() => setIsMapExpanded((prev) => !prev)}
            className="bg-white/90 p-2 rounded-xl shadow"
            activeOpacity={0.8}
          >
            {isMapExpanded ? (
              <ChevronUp color="#0d3d47" size={20} />
            ) : (
              <ChevronDown color="#0d3d47" size={20} />
            )}
          </TouchableOpacity>
          {isMapExpanded && (
            <TouchableOpacity
              onPress={() => setResetTrigger((t) => t + 1)}
              className="bg-white/90 p-2 rounded-xl shadow"
              activeOpacity={0.8}
            >
              <Navigation color="#0d3d47" size={20} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Chat section */}
      <View className="flex-1 bg-white overflow-hidden">
        {/* Channel header */}
        <View className="py-2.5 bg-white/70 border-b border-gray-100 items-center">
          <View className="flex-row items-center gap-2 bg-gray-100 px-4 py-1.5 rounded-full">
            <Shield color="#DC2626" size={12} />
            <Text className="text-xs font-black text-gray-600 uppercase tracking-widest">
              Coordination Channel
            </Text>
          </View>
        </View>

        {/* Chat messages */}
        <View className="flex-1 overflow-hidden">
          {activeConversation ? (
            <ChatWindow
              messages={enrichedMessages}
              conversation={activeConversation}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#0d3d47" size="large" />
            </View>
          )}
        </View>

        {/* Responder count + priority bar */}
        <View className="px-4 py-2 bg-white border-t border-gray-100 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="flex-row" style={{ marginRight: 4 }}>
              {securityResponders.slice(0, 3).map((r) => (
                <View
                  key={r.user_id}
                  className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 overflow-hidden"
                  style={{ marginLeft: -6 }}
                >
                  {r.image ? (
                    <Image source={{ uri: r.image }} className="w-full h-full" resizeMode="cover" />
                  ) : null}
                </View>
              ))}
            </View>
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {securityResponders.length} Responders Active
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Siren color="#DC2626" size={12} />
            <Text className="text-xs font-bold text-red-600">High Priority</Text>
          </View>
        </View>

        {/* Composer */}
        <ChatComposer
          placeholder="Send a quick update..."
          onSend={(text) => sendMessage(text)}
          onSendAttachment={(url) => sendMessage('', 'image', url)}
          onTyping={() => {}}
          onSendLocation={handleSendLocation}
        />
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default EmergencyHub;
