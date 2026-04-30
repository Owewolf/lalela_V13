import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import {
  Siren,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Shield,
  Navigation,
  Tag,
  Info,
  Compass,
  Plus,
  Heart,
  MoreVertical,
  Share2,
  MapPin,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useFirebase } from '../../context/FirebaseContext';
import { cn } from '../../lib/utils';
import { InteractiveCoverageMap } from './InteractiveCoverageMap';
import { CommunityNotice } from '../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

const getUrgencyPriority = (level?: string, urgency?: string): number => {
  const l =
    level ||
    (urgency === 'high'
      ? 'warning'
      : urgency === 'normal'
      ? 'info'
      : urgency === 'low'
      ? 'general'
      : urgency);
  switch (l) {
    case 'emergency': return 4;
    case 'warning':   return 3;
    case 'info':      return 2;
    case 'general':   return 1;
    default:          return 0;
  }
};

const resolvedUrgency = (level?: string, urgency?: string) =>
  level ||
  (urgency === 'high'
    ? 'warning'
    : urgency === 'normal'
    ? 'info'
    : urgency === 'low'
    ? 'general'
    : urgency);

// ─── Notice card helpers ─────────────────────────────────────────────────────

const urgencyBgColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return '#fef2f2';
    case 'warning':   return '#fffbeb';
    case 'info':      return '#eff6ff';
    case 'general':   return '#f0fdf4';
    default:          return '#f9fafb';
  }
};

const urgencyBorderColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return '#fca5a5';
    case 'warning':   return '#fcd34d';
    case 'info':      return '#93c5fd';
    case 'general':   return '#ffddb9';
    default:          return '#e5e7eb';
  }
};

const urgencyTextColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return '#dc2626';
    case 'warning':   return '#d97706';
    case 'info':      return '#2563eb';
    case 'general':   return '#0d3d47';
    default:          return '#6b7280';
  }
};

const UrgencyIcon = ({
  level,
  urgency,
  size = 12,
}: {
  level?: string;
  urgency?: string;
  size?: number;
}) => {
  const color = urgencyTextColor(level, urgency);
  const u = resolvedUrgency(level, urgency);
  switch (u) {
    case 'emergency': return <Siren size={size} color={color} />;
    case 'warning':   return <AlertTriangle size={size} color={color} />;
    case 'info':      return <Info size={size} color={color} />;
    case 'general':   return <Tag size={size} color={color} />;
    default:          return <Compass size={size} color={color} />;
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'general' | 'info' | 'warning' | 'emergency';

interface HomePageProps {
  onOpenEmergencyHub?: (post: any) => void;
  onOpenChat?: (post: any) => void;
  onStartEmergencyPost?: () => void;
  onStartIncidentReport?: (urgency: UrgencyLevel) => void;
  onEditPost?: (post: CommunityNotice) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const HomePage: React.FC<HomePageProps> = ({
  onOpenEmergencyHub,
  onOpenChat,
  onStartEmergencyPost,
  onStartIncidentReport,
  onEditPost,
}) => {
  const router = useRouter();

  // Fallback navigation when no callback prop is provided (component used as a route)
  const openEmergencyHub = (post: any) => {
    if (onOpenEmergencyHub) { onOpenEmergencyHub(post); return; }
    if (post?.id) router.push(`/emergency/${post.id}` as any);
  };
  const startEmergencyPost = () => {
    if (onStartEmergencyPost) { onStartEmergencyPost(); return; }
    router.push('/create-post?type=notice&urgency=emergency' as any);
  };
  const startIncidentReport = (urgency: UrgencyLevel) => {
    if (onStartIncidentReport) { onStartIncidentReport(urgency); return; }
    router.push(`/create-post?type=notice&urgency=${urgency}` as any);
  };

  const {
    currentCommunity,
    posts,
    members,
    securityResponders,
    communityBusinesses,
    charities,
    removePost,
    startConversation,
    setActiveConversation,
  } = useCommunity();

  const { user } = useFirebase();

  const handleOpenContextChat = useCallback(
    async (post: CommunityNotice) => {
      if (!user?.uid || !post.author_id) return;

      try {
        const participantSet = new Set((members || []).map((m) => m.user_id));
        if (post.author_id) participantSet.add(post.author_id);
        participantSet.add(user.uid);
        const participants =
          post.type === 'listing'
            ? Array.from(new Set([user.uid, post.author_id]))
            : Array.from(participantSet);

        const conversationId = await startConversation({
          participants,
          type: post.type === 'listing' ? 'listing' : 'notice',
          communityId: currentCommunity?.id,
          listingId: post.type === 'listing' ? post.id : undefined,
          noticeId: post.type === 'notice' ? post.id : undefined,
          metadata: {
            title: post.title,
            image: post.posts_image || undefined,
            price: post.type === 'listing' ? post.price?.toString() : undefined,
            description: post.description,
            author: post.authorName,
            authorImage: post.authorImage,
            authorId: post.author_id,
            authorRole: post.authorRole,
            location: post.locationName,
            urgency: post.urgency,
            urgencyLevel: post.urgency_level,
          },
        });

        setActiveConversation(conversationId);
        router.push(`/chat/${conversationId}` as any);
      } catch (error) {
        console.error('Failed to open contextual chat:', error);
      }
    },
    [currentCommunity?.id, router, setActiveConversation, startConversation, user?.uid, members]
  );

  // ─── local state ──────────────────────────────────────────────────────────
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  }>({
    latitude: -26.2041,
    longitude: 28.0473,
  });
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [mapFilterOverride, setMapFilterOverride] = useState<
    'members' | 'listings' | 'notices' | 'businesses' | undefined
  >(undefined);
  const [mapUnlocked, setMapUnlocked] = useState(false);

  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showIncidentMenu, setShowIncidentMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  // Progress bar animation value
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ─── derived data ─────────────────────────────────────────────────────────

  const userRole = currentCommunity?.userRole || 'Member';

  const notices = useMemo(
    () =>
      [...posts]
        .filter(
          (p) =>
            p.type === 'notice' &&
            p.urgency !== 'emergency' &&
            p.urgency_level !== 'emergency'
        )
        .sort((a, b) => {
          const pA = getUrgencyPriority(a.urgency_level, a.urgency);
          const pB = getUrgencyPriority(b.urgency_level, b.urgency);
          if (pA !== pB) return pB - pA;
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }),
    [posts]
  );

  const listings = useMemo(
    () =>
      [...posts]
        .filter((p) => p.type === 'listing')
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
    [posts]
  );

  const alert = currentCommunity?.alerts?.[0];

  const communityData = (currentCommunity as unknown as Record<string, unknown>) ?? {};

  const selectedCharityId =
    typeof communityData.selected_charity === 'string'
      ? communityData.selected_charity
      : undefined;

  const selectedCharity =
    charities.find((c) => c.id === selectedCharityId) ??
    charities.find((c) => c.isFeatured) ??
    (charities.length === 1 ? charities[0] : undefined);

  const approvedPublicCharityListings = useMemo(() => {
    if (!selectedCharity) return [] as CommunityNotice[];
    return posts.filter((post) => {
      if (post.type !== 'listing') return false;
      if (!post.isPublic) return false;
      if (post.charityId !== selectedCharity.id) return false;
      const s = typeof post.status === 'string' ? post.status.toLowerCase() : '';
      return s === 'active' || s === 'pinned';
    });
  }, [posts, selectedCharity]);

  const totalCollectedAmount = useMemo(() => {
    return approvedPublicCharityListings.reduce((sum, listing) => {
      if (
        typeof listing.charity_amount === 'number' &&
        Number.isFinite(listing.charity_amount)
      ) {
        return sum + Math.max(0, listing.charity_amount);
      }
      const base =
        typeof listing.community_price === 'number'
          ? listing.community_price
          : typeof listing.price === 'number'
          ? listing.price
          : 0;
      const pub =
        typeof listing.public_price === 'number'
          ? listing.public_price
          : typeof listing.price === 'number'
          ? listing.price
          : base;
      return sum + Math.max(0, pub - base);
    }, 0);
  }, [approvedPublicCharityListings]);

  const fundraisingGoal =
    typeof selectedCharity?.fundraisingGoal === 'number'
      ? selectedCharity.fundraisingGoal
      : undefined;
  const hasFundraisingGoal =
    typeof fundraisingGoal === 'number' && fundraisingGoal > 0;
  const progressDenominator = hasFundraisingGoal
    ? fundraisingGoal!
    : Math.max(totalCollectedAmount, 1);
  const potentialProgressPercent = Math.min(
    100,
    Math.max((totalCollectedAmount / progressDenominator) * 100, 0)
  );
  const totalCollectedLabel = `R${totalCollectedAmount.toLocaleString()}`;
  const progressTargetLabel = hasFundraisingGoal
    ? `R${fundraisingGoal!.toLocaleString()}`
    : totalCollectedLabel;
  const progressPercentLabel = `${Math.round(potentialProgressPercent)}% to goal`;

  const charityDescription =
    typeof communityData.charity_description === 'string'
      ? communityData.charity_description
      : selectedCharity?.description;
  const charityImage =
    typeof communityData.charity_image === 'string'
      ? communityData.charity_image
      : selectedCharity?.logo || selectedCharity?.coverImage;

  const hasNoNotices = notices.length === 0;

  // ─── effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (currentCommunity?.coverageArea) {
      setMapCenter({
        latitude: currentCommunity.coverageArea.latitude,
        longitude: currentCommunity.coverageArea.longitude,
      });
    }
  }, [currentCommunity?.id]);

  useEffect(() => {
    const hasEmergencyPost = posts.some(
      (p) => p.urgency === 'emergency' || p.urgency_level === 'emergency'
    );
    
    const isEmergency = hasEmergencyPost || !!currentCommunity?.isEmergencyMode;

    setIsEmergencyActive(isEmergency);

    if (isEmergency) {
      const latest = posts.find(
        (p) => p.urgency === 'emergency' || p.urgency_level === 'emergency'
      );
      if (latest?.latitude && latest?.longitude) {
        setMapCenter({ latitude: latest.latitude, longitude: latest.longitude });
      }
    }
  }, [currentCommunity?.isEmergencyMode, posts]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: potentialProgressPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [potentialProgressPercent]);

  // ─── helpers ──────────────────────────────────────────────────────────────

  const scrollViewRef = useRef<ScrollView>(null);

  const calculateDistance = (lat?: number, lng?: number) => {
    if (!lat || !lng || !currentCommunity?.coverageArea) return null;
    const { latitude: lat1, longitude: lon1 } = currentCommunity.coverageArea;
    const R = 6371;
    const dLat = ((lat - lat1) * Math.PI) / 180;
    const dLon = ((lng - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const handleDeletePost = () => {
    if (!postToDelete) return;
    removePost(postToDelete);
    setPostToDelete(null);
  };

  const resetCommunityMapView = () => {
    if (currentCommunity?.coverageArea) {
      const { latitude, longitude, radius } = currentCommunity.coverageArea;
      
      // Calculate delta to fit the entire diameter (radius * 2) precisely.
      // 1 degree latitude ~= 111km
      const latDelta = (radius * 2) / 111;
      
      // 1 degree longitude ~= 111km * cos(latitude)
      const latRad = latitude * (Math.PI / 180);
      const lonDelta = (radius * 2) / (111 * Math.cos(latRad));

      setMapCenter({
        latitude,
        longitude,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      });
      setResetTrigger((t) => t + 1);
      setMapUnlocked(false);
    }
  };

  // ─── Incident urgency menu items ──────────────────────────────────────────
  const urgencyMenuItems: {
    level: UrgencyLevel;
    label: string;
    color: string;
    sub: string;
  }[] = [
    {
      level: 'warning',
      label: 'Warning',
      color: '#d97706',
      sub: 'Immediate attention needed',
    },
    {
      level: 'info',
      label: 'Info',
      color: '#2563eb',
      sub: 'Standard community notice',
    },
    {
      level: 'general',
      label: 'General',
      color: '#0d3d47',
      sub: 'General information',
    },
  ];

  // ─── render helpers ───────────────────────────────────────────────────────

  const renderNoticeCard = ({ item: notice }: { item: CommunityNotice }) => {
    const isEmergencyOrWarning =
      notice.urgency === 'emergency' ||
      notice.urgency_level === 'emergency' ||
      notice.urgency_level === 'warning' ||
      notice.urgency === 'high';

    const borderColor = urgencyBorderColor(notice.urgency_level, notice.urgency);
    const bgColor = urgencyBgColor(notice.urgency_level, notice.urgency);
    const textColor = urgencyTextColor(notice.urgency_level, notice.urgency);
    const dist = calculateDistance(notice.latitude, notice.longitude);

    return (
      <View
        key={notice.id}
        style={{ borderColor, backgroundColor: bgColor }}
        className="rounded-3xl border shadow-sm overflow-hidden mb-4"
      >
        {/* Mini map for emergency/warning with location */}
        {isEmergencyOrWarning && notice.latitude && notice.longitude && (
          <View className="w-full overflow-hidden border-b border-gray-200/30">
            <InteractiveCoverageMap
              center={{ latitude: notice.latitude, longitude: notice.longitude }}
              height={160}
              isEmergencyActive={
                notice.urgency === 'emergency' ||
                notice.urgency_level === 'emergency'
              }
              showFilters={false}
              showLegend={false}
              showPulseOverlay={false}
              showEmergencyOverlay={false}
              isLocked={true}
              onUnlock={() => {}}
            />
            <View
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  notice.urgency === 'emergency' ||
                  notice.urgency_level === 'emergency'
                    ? '#dc2626'
                    : '#f59e0b',
              }}
            >
              <Text className="text-white text-[8px] font-bold uppercase tracking-widest">
                {notice.urgency === 'emergency' ||
                notice.urgency_level === 'emergency'
                  ? 'Live Situation'
                  : 'Warning Zone'}
              </Text>
            </View>
          </View>
        )}

        {/* Attached image (non-emergency) layout at top */}
        {notice.posts_image && !isEmergencyOrWarning && (
          <View className="w-full aspect-video border-b border-gray-200/30 overflow-hidden">
            <Image
              source={{ uri: notice.posts_image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        )}

        <View className="p-5 flex-1">
          {/* Title and Context Menu Row */}
          <View className="flex-row items-start justify-between gap-3 mb-2">
            <Text className="text-lg font-bold text-gray-900 leading-snug flex-1">
              {notice.title}
            </Text>
            {/* Context menu */}
            <View className="relative shrink-0">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  setActiveMenuId(
                    activeMenuId === notice.id ? null : notice.id
                  )
                }
                className="p-2 rounded-full bg-gray-100"
              >
                <MoreVertical size={16} color="#6b7280" />
              </TouchableOpacity>
              {activeMenuId === notice.id && (
                <View
                  className="absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 overflow-hidden"
                  style={{ top: 36 }}
                >
                  {(notice.author_id === user?.uid ||
                    currentCommunity?.userRole === 'Admin') && (
                    <>
                      {notice.author_id === user?.uid && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            onEditPost?.(notice);
                            setActiveMenuId(null);
                          }}
                          className="flex-row items-center gap-2 px-4 py-2"
                        >
                          <Tag size={14} color="#0d3d47" />
                          <Text className="text-sm font-bold text-primary">
                            Edit Notice
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setPostToDelete(notice.id);
                          setActiveMenuId(null);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                      >
                        <AlertTriangle size={14} color="#dc2626" />
                        <Text className="text-sm font-bold text-red-600">
                          Delete Notice
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActiveMenuId(null)}
                    className="flex-row items-center gap-2 px-4 py-2"
                  >
                    <Share2 size={14} color="#6b7280" />
                    <Text className="text-sm font-bold text-gray-500">
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

            {/* Urgency badge */}
            <View
              className="self-start flex-row items-center gap-1.5 px-3 py-1 rounded-full border mb-3"
              style={{ borderColor, backgroundColor: `${textColor}15` }}
            >
              <UrgencyIcon
                level={notice.urgency_level}
                urgency={notice.urgency}
                size={10}
              />
              <Text
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: textColor }}
              >
                {notice.urgency_level || notice.urgency || 'Info'}
              </Text>
            </View>

          {/* Location chip */}
          {(notice.locationName || notice.latitude) && (
            <View className="flex-row items-center gap-1.5 bg-surface-container-low self-start px-2 py-1 rounded-md mb-3">
              <MapPin size={10} color="#0d3d47" />
              <Text className="text-[10px] font-bold text-primary">
                {notice.locationName || 'Location Provided'}
              </Text>
              {dist && (
                <Text className="text-[10px] text-gray-400 ml-1">
                  • {dist}km
                </Text>
              )}
            </View>
          )}

          {/* Description */}
          <Text className="text-gray-500 text-sm leading-relaxed mb-4" numberOfLines={2}>
            {notice.description}
          </Text>

          {/* Footer row */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden">
                {notice.authorImage ? (
                  <Image
                    source={{ uri: notice.authorImage }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Text className="text-gray-500 text-xs font-bold">
                      {notice.authorName?.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View>
                <Text className="text-xs font-bold text-gray-800">
                  {notice.authorName}
                </Text>
                <Text className="text-[10px] text-gray-400">
                  {notice.authorRole} • {formatDate(notice.timestamp)}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              {(notice.urgency === 'emergency' ||
                notice.urgency_level === 'emergency' ||
                notice.priority === 'emergency') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="p-2 rounded-full bg-red-50"
                  onPress={() => openEmergencyHub(notice)}
                >
                  <Siren size={16} color="#dc2626" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                className="p-2 rounded-full bg-surface-container-low"
                onPress={() => onOpenChat ? onOpenChat(notice) : handleOpenContextChat(notice)}
              >
                <MessageSquare size={16} color="#0d3d47" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderListingCard = ({ item: listing }: { item: CommunityNotice }) => {
    const linkedCharity = listing.charityId
      ? charities.find((c) => c.id === listing.charityId)
      : null;

    const localPrice = listing.price ?? 0;
    const publicPrice = listing.public_price ?? 0;
    const hasPublicPrice =
      listing.isPublic === true &&
      listing.public_price != null &&
      listing.price != null &&
      publicPrice > localPrice;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/market?listingId=${listing.id}`)}
        key={listing.id}
        className="flex-1 mx-0.5 mb-3 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {typeof listing.posts_image === 'string' && listing.posts_image.trim().length > 0 && (
          <Image 
            source={{ uri: listing.posts_image }} 
            className="w-full h-24 bg-gray-100" 
            resizeMode="cover" 
          />
        )}
        <View className="p-3 gap-1">
          <Text
            className="text-sm font-bold text-gray-900 leading-tight"
            numberOfLines={2}
          >
            {listing.title}
          </Text>

          <Text
            className="text-xs text-gray-500 leading-snug"
            numberOfLines={2}
          >
            {listing.description}
          </Text>

          <View className="flex-row items-end justify-between mt-1">
            <View className="gap-2 items-start">
              <Text className="text-xl font-black text-gray-900 tracking-tight">
                R{localPrice.toLocaleString()}
              </Text>
              {hasPublicPrice && (
                <View className="flex-row items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                  <Heart size={10} color="#4f46e5" />
                  <Text
                    className="text-[10px] font-bold text-indigo-700"
                    numberOfLines={1}
                  >
                    {linkedCharity?.name || 'CAT'}
                  </Text>
                </View>
              )}
            </View>

            {(listing.latitude && listing.longitude) && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setMapFilterOverride('listings');
                  setMapCenter({
                    latitude: listing.latitude!,
                    longitude: listing.longitude!,
                  });
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }}
                className="flex-row items-center justify-center rounded-full bg-indigo-50 w-8 h-8"
              >
                <MapPin size={14} color="#4f46e5" />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row items-center gap-2 pt-1 mt-1 border-t border-gray-50">
            <View className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
              {listing.authorImage ? (
                <Image
                  source={{ uri: listing.authorImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Text className="text-[10px] font-bold text-gray-500">
                    {listing.authorName?.charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="flex-1 text-[10px] font-semibold text-gray-800"
              numberOfLines={1}
            >
              {listing.authorName}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Delete confirmation modal ────────────────────────────────────────────
  const DeleteModal = () => (
    <Modal
      visible={!!postToDelete}
      transparent
      animationType="fade"
      onRequestClose={() => setPostToDelete(null)}
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <View className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <View className="bg-red-50 w-16 h-16 rounded-full items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} color="#dc2626" />
          </View>
          <Text className="text-xl font-bold text-primary text-center mb-2">
            Delete Post?
          </Text>
          <Text className="text-sm text-gray-500 text-center leading-relaxed mb-6">
            This action cannot be undone. This post will be permanently removed.
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleDeletePost}
              className="bg-red-600 py-4 rounded-full items-center"
            >
              <Text className="text-white font-bold">Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPostToDelete(null)}
              className="py-3 items-center"
            >
              <Text className="text-gray-500 font-semibold text-sm">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── Urgency picker modal ────────────────────────────────────────────────
  const UrgencyPickerModal = () => (
    <Modal
      visible={showIncidentMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowIncidentMenu(false)}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={() => setShowIncidentMenu(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl pb-8">
            <View className="p-5 border-b border-gray-100">
              <View className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Select Notice Type
              </Text>
            </View>
            {urgencyMenuItems.map((item) => (
              <TouchableOpacity
                key={item.level}
                activeOpacity={0.7}
                onPress={() => {
                  // Dismiss our Modal first; navigate after its close animation
                  // completes — iOS won't present a new modal while one is still visible.
                  setShowIncidentMenu(false);
                  setTimeout(() => startIncidentReport(item.level), 350);
                }}
                className="flex-row items-center gap-4 px-6 py-4 border-b border-gray-50"
              >
                <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: `${item.color}18` }}>
                  <UrgencyIcon level={item.level} urgency={undefined} size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-sm" style={{ color: item.color }}>{item.label}</Text>
                  <Text className="text-[11px] text-gray-400">{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // ─── Emergency dialog modal ───────────────────────────────────────────────
  const EmergencyDialog = () => (
    <Modal
      visible={showEmergencyDialog}
      transparent
      animationType="fade"
      onRequestClose={() => setShowEmergencyDialog(false)}
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <View className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl gap-6">
          <View className="bg-red-50 w-16 h-16 rounded-full items-center justify-center mx-auto">
            <Siren size={32} color="#dc2626" />
          </View>
          <View className="items-center gap-2">
            <Text className="text-xl font-bold text-primary">
              Emergency in Progress
            </Text>
            <Text className="text-sm text-gray-500 text-center leading-relaxed">
              A community emergency is already active. Would you like to join
              the coordination hub or report a new emergency?
            </Text>
          </View>
          <View className="gap-3">
            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-red-600 py-4 rounded-full flex-row items-center justify-center gap-2"
              onPress={() => {
                const latest = posts.find(
                  (p) => p.urgency === 'emergency'
                );
                if (latest) openEmergencyHub(latest);
                setShowEmergencyDialog(false);
              }}
            >
              <MessageSquare size={18} color="#fff" />
              <Text className="text-white font-bold">
                Join Coordination Hub
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              className="bg-gray-100 py-4 rounded-full items-center"
              onPress={() => {
                startEmergencyPost();
                setShowEmergencyDialog(false);
              }}
            >
              <Text className="font-bold text-primary-container">
                Report New Emergency
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowEmergencyDialog(false)}
              className="items-center py-2"
            >
              <Text className="text-sm font-semibold text-gray-400">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── main render ──────────────────────────────────────────────────────────

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={() => {
        if (activeMenuId) setActiveMenuId(null);
        if (showIncidentMenu) setShowIncidentMenu(false);
      }}
    >
      <View className="px-4 pt-6 gap-8">
        {/* ── Quick Action Buttons ─────────────────────────────────────── */}
        <View className="flex-row gap-4">
          {/* Emergency button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (isEmergencyActive) {
                setShowEmergencyDialog(true);
              } else {
                startEmergencyPost();
              }
            }}
            disabled={currentCommunity?.status === 'READ-ONLY'}
            className={cn(
              'flex-1 flex-col items-center justify-center py-5 rounded-3xl gap-2 shadow-md',
              currentCommunity?.status === 'READ-ONLY' && 'opacity-50'
            )}
            style={{ backgroundColor: '#0d3d47' }}
          >
            <Siren
              size={24}
              color="#fff"
              fill={isEmergencyActive ? '#fff' : 'transparent'}
            />
            <Text className="text-white font-bold text-sm text-center">
              {isEmergencyActive ? 'ACTIVE EMERGENCY' : 'Emergency Help'}
            </Text>
            {isEmergencyActive && (
              <View className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full" />
            )}
          </TouchableOpacity>

          {/* Create Notice button + urgency picker modal */}
          <View className="flex-1">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowIncidentMenu(true)}
              disabled={currentCommunity?.status === 'READ-ONLY'}
              className={cn(
                'flex-col items-center justify-center py-5 rounded-3xl gap-2 shadow-md',
                currentCommunity?.status === 'READ-ONLY' && 'opacity-50'
              )}
              style={{ backgroundColor: '#1e5667' }}
            >
              <Plus size={24} color="#fff" />
              <Text className="text-white font-bold text-sm">
                Create Notice
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Emergency Alert Banner ───────────────────────────────────── */}
        {alert && (
          <View className="relative overflow-hidden bg-red-600 rounded-3xl p-6 shadow-xl">
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-row items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                <AlertTriangle size={14} color="#fff" fill="#fff" />
                <Text className="text-white text-[10px] font-bold tracking-widest uppercase">
                  {alert.priority} Priority Alert
                </Text>
              </View>
              <Text className="text-white/80 text-xs font-medium italic">
                {alert.timestamp}
              </Text>
            </View>
            <View className="gap-2 mb-6">
              <Text className="text-white text-3xl font-extrabold leading-tight">
                {alert.title}
              </Text>
              <Text className="text-white/90 font-light leading-relaxed">
                {alert.description}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.85}
                className="bg-white px-6 py-3 rounded-full"
              >
                <Text className="text-red-600 font-bold text-sm">
                  Acknowledge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-white/10 px-6 py-3 rounded-full"
              >
                <Text className="text-white font-medium text-sm">
                  View Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Community Pulse Map ──────────────────────────────────────── */}
        <View
          className={cn(
            'bg-white rounded-3xl p-5 shadow-sm gap-5',
            isEmergencyActive && 'border-2 border-red-300 bg-red-50/30'
          )}
        >
          <InteractiveCoverageMap
            center={mapCenter}
            resetTrigger={resetTrigger}
            isEmergencyActive={isEmergencyActive}
            showFilters
            showLegend
            showPulseOverlay
            showEmergencyOverlay
            height={notices.length > 0 ? 300 : 420}
            initialFilter={mapFilterOverride}
            isLocked={!mapUnlocked}
            onUnlock={() => setMapUnlocked(true)}
            onResetMap={resetCommunityMapView}
            onOpenEmergencyHub={() => {
              const latest = posts.find(
                (p) =>
                  p.urgency === 'emergency' || p.urgency_level === 'emergency'
              );
              if (latest) openEmergencyHub(latest);
            }}
          />
        </View>

        {/* ── Community Notices ────────────────────────────────────────── */}
        <View className="gap-4">
          <View className="flex-row items-end justify-between px-1">
            <Text className="text-xl font-bold text-gray-900">
              Community Notices
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center gap-1"
            >
              <Text className="text-primary font-semibold text-sm">
                View All
              </Text>
              <ArrowRight size={14} color="#1e5667" />
            </TouchableOpacity>
          </View>

          {notices.length === 0 ? (
            <View className="items-center justify-center gap-3 py-10 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <View className="w-14 h-14 rounded-full bg-surface-container-low items-center justify-center">
                <Shield size={28} color="#10b981" />
              </View>
              <View className="items-center">
                <Text className="font-bold text-primary text-lg">
                  All Secure
                </Text>
                <Text className="text-sm text-gray-500 mt-1 text-center">
                  No active notices right now. Your community is all clear.
                </Text>
              </View>
              {currentCommunity?.status !== 'READ-ONLY' && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => startIncidentReport('general')}
                  className="mt-2 bg-gray-100 px-5 py-2 rounded-full"
                >
                  <Text className="text-primary text-xs font-bold">
                    Post a Notice
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={notices}
              keyExtractor={(item) => item.id}
              renderItem={renderNoticeCard}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* ── Community Charity ────────────────────────────────────────── */}
        <View className="gap-3">
          <View className="px-1">
            <Text className="text-lg font-bold text-primary">
              Community Charity
            </Text>
            <Text className="text-xs text-gray-400">
              Listen, connect, and act together.
            </Text>
          </View>

          <View
            className={cn(
              'relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm',
              hasNoNotices ? 'border-outline-variant' : 'border-gray-200'
            )}
          >
            {/* Background image */}
            {selectedCharity && charityImage && (
              <Image
                source={{ uri: charityImage }}
                className="absolute inset-0 w-full h-full"
                resizeMode="cover"
                style={{ opacity: 0.12 }}
              />
            )}

            {selectedCharity ? (
              <View className="flex-row items-start gap-4">
                {/* Logo */}
                <View className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                  {charityImage ? (
                    <Image
                      source={{ uri: charityImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Heart size={20} color="#9ca3af" />
                    </View>
                  )}
                </View>

                <View className="flex-1 gap-2">
                  <Text
                    className="text-base font-bold text-primary"
                    numberOfLines={1}
                  >
                    {selectedCharity.name}
                  </Text>
                  <Text
                    className="text-sm text-gray-500 leading-relaxed"
                    numberOfLines={3}
                  >
                    {charityDescription ||
                      'Supporting this month as a community-backed initiative.'}
                  </Text>

                  {/* Progress bar */}
                  <View className="gap-1 pt-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] font-semibold text-primary">
                        Total Collected: {totalCollectedLabel}
                      </Text>
                      {hasFundraisingGoal && (
                        <Text className="text-[10px] font-semibold text-primary">
                          {progressPercentLabel}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="h-2 flex-1 rounded-full bg-surface overflow-hidden">
                        <Animated.View
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: progressAnim.interpolate({
                              inputRange: [0, 100],
                              outputRange: ['0%', '100%'],
                            }),
                          }}
                        />
                      </View>
                      <Text className="text-[10px] font-semibold text-primary">
                        {progressTargetLabel}
                      </Text>
                    </View>
                  </View>

                </View>
              </View>
            ) : (
              <View className="gap-2">
                <Text className="text-base font-bold text-primary">
                  No featured charity yet
                </Text>
                <Text className="text-sm text-gray-500">
                  Charity management and suggestions are handled through the dashboard workflow.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Listings ─────────────────────────────────────────────────── */}
        {listings.length > 0 && (
          <View className="gap-4">
            <View className="flex-row items-end justify-between px-1">
              <Text className="text-xl font-bold text-gray-900">
                Listings
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/market')}
                className="flex-row items-center gap-1"
              >
                <Text className="text-primary font-semibold text-sm">
                  View Market
                </Text>
                <ArrowRight size={14} color="#1e5667" />
              </TouchableOpacity>
            </View>

            <FlatList
              key={2}
              data={listings}
              numColumns={2}
              columnWrapperStyle={{ gap: 8, paddingHorizontal: 4 }}
              keyExtractor={(item) => item.id}
              renderItem={renderListingCard}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <UrgencyPickerModal />
      <EmergencyDialog />
      <DeleteModal />
    </ScrollView>
  );
};

export default HomePage;
