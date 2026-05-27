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
  ScrollView,
} from 'react-native';
import MapView from 'react-native-maps';
import {
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  ArrowLeft,
  AlertTriangle,
  Users,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { EmergencyMap } from './EmergencyMap';
import { deriveEmergencyResponders } from './responderUtils';
import { ChatWindow } from '../chat/ChatWindow';
import { ChatComposer } from '../chat/ChatComposer';
import { THEME_COLORS } from '../../theme/colors';
import { LAYER_ELEVATION, LAYER_Z_INDEX } from '../../theme/layers';

interface EmergencyHubProps {
  emergencyId: string;
}

const MAP_EXPANDED_HEIGHT = 280;
const MAP_COLLAPSED_HEIGHT = 72;

export const EmergencyHub: React.FC<EmergencyHubProps> = ({ emergencyId }) => {
  const router = useRouter();
  const { forceCenter } = useLocalSearchParams<{ forceCenter?: string }>();
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
  const isEmergencyPost = React.useCallback(
    (p: any) => p?.urgencyLevel === 'emergency' || p?.urgency === 'emergency',
    []
  );
  const isWarningPost = React.useCallback(
    (p: any) => !isEmergencyPost(p) && (p?.urgencyLevel === 'warning' || p?.urgency === 'high'),
    [isEmergencyPost]
  );
  const activeIncidentPosts = useMemo(() => {
    const emergencies = posts
      .filter((p: any) => isEmergencyPost(p))
      .slice()
      .sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
      .map((p: any) => ({ ...p, incidentType: 'emergency' as const }));
    const warnings = posts
      .filter((p: any) => isWarningPost(p))
      .slice()
      .sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
      .map((p: any) => ({ ...p, incidentType: 'warning' as const }));
    return [...emergencies, ...warnings];
  }, [posts, isEmergencyPost, isWarningPost]);

  const unifiedResponders = useMemo(() => {
    const latitude = emergencyPost?.latitude;
    const longitude = emergencyPost?.longitude;
    const referenceLocation =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude: latitude as number, longitude: longitude as number }
        : undefined;
    return deriveEmergencyResponders(securityResponders, members, referenceLocation);
  }, [securityResponders, members, emergencyPost?.latitude, emergencyPost?.longitude]);

  // Always recenter map on mount or when emergencyId changes, or if forceCenter param is present
  useEffect(() => {
    setResetTrigger((t) => t + 1);
  }, [emergencyId, emergencyPost?.id, forceCenter]);

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
      .filter((msg) => msg.content.startsWith('Shared Location:'))
      .map((msg) => {
        const coords = msg.content
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

      const senderMember = members.find((m) => m.userId === msg.userId);
      if (senderMember) {
        if (!senderName) senderName = senderMember.name || `Member ${msg.userId.slice(0, 4)}`;
        if (!senderImage) senderImage = senderMember.image;
      }

      const responder = securityResponders.find((r) => r.userId === msg.userId);
      if (responder) {
        if (!senderName) senderName = responder.name;
        if (!senderImage) senderImage = responder.image;
        role = 'Responder' as any;
      }

      if (emergencyPost && msg.userId === emergencyPost.authorId) {
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
      const allMemberIds = members.map((m) => m.userId);
      const participantSet = new Set(allMemberIds);
      if (emergencyPost.authorId) participantSet.add(emergencyPost.authorId);
      if (userProfile?.id) participantSet.add(userProfile.id);
      unifiedResponders.forEach((r) => participantSet.add(r.userId));

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
  }, [emergencyId, members.length, unifiedResponders.length]);

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
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: THEME_COLORS.surface }}>
        <ActivityIndicator color={THEME_COLORS.primary} size="large" />
        <Text className="text-sm text-gray-500 mt-3">Loading emergency...</Text>
      </SafeAreaView>
    );
  }

  const authorInitial = emergencyPost.authorName?.trim()?.charAt(0)?.toUpperCase() || 'E';
  const isWarningIncident = isWarningPost(emergencyPost);
  const accentColor = isWarningIncident ? THEME_COLORS.warning : THEME_COLORS.errorStrong;
  const accentBg = isWarningIncident ? THEME_COLORS.warningSurface : THEME_COLORS.errorSurface;
  const incidentLabel = isWarningIncident ? 'Warning' : 'Emergency';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <SafeAreaView className="flex-1" style={{ backgroundColor: THEME_COLORS.surface }}>
      {/* Map section */}
      <Animated.View style={{ height: mapHeightAnim, backgroundColor: THEME_COLORS.surfaceContainerLow, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.neutralBorderSoft }} className="relative">
        {isMapExpanded ? (
          <EmergencyMap
            emergencyPost={emergencyPost}
            resetTrigger={resetTrigger}
            mapRef={mapRef}
          />
        ) : (
          <View className="absolute inset-0 flex-row items-center px-5" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
            <View className="p-2 rounded-full mr-3" style={{ backgroundColor: accentBg }}>
              <MapPin color={accentColor} size={16} />
            </View>
            <View>
              <Text className="text-xs font-bold text-primary">Map Minimized</Text>
              <Text className="text-xs text-gray-400">Tap to expand situational awareness</Text>
            </View>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          className="absolute top-4 left-4 p-2 rounded-xl shadow"
          style={{ zIndex: LAYER_Z_INDEX.emergencyBackButton, elevation: LAYER_ELEVATION.emergencyBackButton, backgroundColor: THEME_COLORS.surfaceContainerLow }}
          activeOpacity={0.8}
        >
          <ArrowLeft color={THEME_COLORS.primary} size={20} />
        </TouchableOpacity>

        {/* Map controls */}
        <View className="absolute top-4 right-4 gap-2">
          <TouchableOpacity
            onPress={() => setIsMapExpanded((prev) => !prev)}
            className="p-2 rounded-xl shadow"
            style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
            activeOpacity={0.8}
          >
            {isMapExpanded ? (
              <ChevronUp color={THEME_COLORS.primary} size={20} />
            ) : (
              <ChevronDown color={THEME_COLORS.primary} size={20} />
            )}
          </TouchableOpacity>
          {isMapExpanded && (
            <TouchableOpacity
              onPress={() => setResetTrigger((t) => t + 1)}
              className="p-2 rounded-xl shadow"
              style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
              activeOpacity={0.8}
            >
              <Navigation color={THEME_COLORS.primary} size={20} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Chat section */}
      <View className="flex-1 overflow-hidden" style={{ backgroundColor: THEME_COLORS.surface }}>
        {/* Emergency header */}
        <View className="px-4 py-3 border-b" style={{ backgroundColor: THEME_COLORS.surface, borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
          <View className="flex-row items-center gap-3">
            {emergencyPost.authorImage ? (
              <Image
                source={{ uri: emergencyPost.authorImage }}
                className="w-12 h-12 rounded-2xl"
                resizeMode="cover"
              />
            ) : (
              <View className="w-12 h-12 rounded-2xl bg-surface items-center justify-center">
                <Text className="text-primary font-bold text-lg">{authorInitial}</Text>
              </View>
            )}

            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="font-black text-gray-900 text-[18px] leading-[22px]">
                {emergencyPost.authorName || 'Emergency Source'}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                <View className="px-1.5 py-0.5 rounded flex-row items-center gap-1" style={{ backgroundColor: accentBg }}>
                  <AlertTriangle size={10} color={accentColor} />
                  <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                    {incidentLabel}
                  </Text>
                </View>
                {!!emergencyPost.locationName && (
                  <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                    <MapPin size={10} color={THEME_COLORS.neutralTextDefault} />
                    <Text numberOfLines={1} className="text-[10px] text-gray-600 font-semibold max-w-[150px]">
                      {emergencyPost.locationName}
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} className="text-[11px] text-gray-500 mt-1 font-semibold">
                {emergencyPost.title}
              </Text>
            </View>
          </View>
        </View>

        {activeIncidentPosts.length > 1 && (
          <View className="px-4 py-2 border-b" style={{ backgroundColor: THEME_COLORS.surface, borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {activeIncidentPosts.map((incident: any) => {
                  const active = incident.id === emergencyId;
                  const emergency = incident.incidentType === 'emergency';
                  const chipBg = active
                    ? emergency
                      ? THEME_COLORS.errorStrong
                      : THEME_COLORS.aliasHex_fde047
                    : THEME_COLORS.surface;
                  const chipBorder = emergency ? THEME_COLORS.errorStrong : THEME_COLORS.warningStrong;
                  const chipText = active
                    ? emergency
                      ? THEME_COLORS.white
                      : THEME_COLORS.aliasHex_713f12
                    : THEME_COLORS.neutralTextHeading;
                  return (
                    <TouchableOpacity
                      key={incident.id}
                      onPress={() => router.replace(`/emergency/${incident.id}?forceCenter=1` as any)}
                      className="px-3 py-2 rounded-full"
                      style={{ backgroundColor: chipBg, borderWidth: 1, borderColor: chipBorder }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-[11px] font-bold" style={{ color: chipText }} numberOfLines={1}>
                        {incident.title || 'Incident'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Chat messages */}
        <View className="flex-1 overflow-hidden">
          {activeConversation ? (
            <ChatWindow
              messages={enrichedMessages}
              conversation={activeConversation}
              emptyStateText="No updates yet. Responders can post status and location updates here."
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={THEME_COLORS.primary} size="large" />
            </View>
          )}
        </View>

        {/* Active responders strip */}
        <View className="px-4 py-2 border-t" style={{ backgroundColor: THEME_COLORS.surface, borderTopColor: THEME_COLORS.neutralBorderSoft }}>
          <View className="flex-row items-center gap-2 mb-1.5">
            <Users color={THEME_COLORS.primary} size={13} />
            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Active Responders ({unifiedResponders.length})
            </Text>
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
