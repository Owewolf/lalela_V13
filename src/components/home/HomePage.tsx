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
  Share as NativeShare,
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
  CheckCircle2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { resolveMediaUrl } from '../../lib/config';
import { resolveActiveCharity } from '../../lib/activeCharity';
import { InteractiveCoverageMap } from './InteractiveCoverageMap';
import { useCommunityMap } from '../../hooks/useCommunityMap';
import { CommunityNotice } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

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

const SPACE = {
  xxs: 4,
  sm: 8,
  s32: 32,
  s36: 36,
  s40: 40,
};

const CARD_DEPTH_HERO = createShadow(THEME_COLORS.black, 0, 10, 0.16, 18, 8);
const CARD_DEPTH = createShadow(THEME_COLORS.black, 0, 7, 0.12, 14, 5);
const CARD_DEPTH_SOFT = createShadow(THEME_COLORS.black, 0, 5, 0.09, 10, 3);

// ─── Notice card helpers ─────────────────────────────────────────────────────

const urgencyBgColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return THEME_COLORS.errorSurface;
    case 'warning':   return THEME_COLORS.warningSurface;
    case 'info':      return THEME_COLORS.infoSurfaceSoft;
    case 'general':   return THEME_COLORS.successSurface;
    default:          return THEME_COLORS.neutralBg;
  }
};

const urgencyBorderColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return THEME_COLORS.aliasHex_fca5a5;
    case 'warning':   return THEME_COLORS.warningBorderStrong;
    case 'info':      return THEME_COLORS.infoBorderStrong;
    case 'general':   return THEME_COLORS.tertiaryFixed;
    default:          return THEME_COLORS.neutralBorderSoft;
  }
};

const urgencyTextColor = (level?: string, urgency?: string): string => {
  switch (resolvedUrgency(level, urgency)) {
    case 'emergency': return THEME_COLORS.error;
    case 'warning':   return THEME_COLORS.warning;
    case 'info':      return THEME_COLORS.brandBlueText;
    case 'general':   return THEME_COLORS.primary;
    default:          return THEME_COLORS.neutralTextSubtle;
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
    markPostSold,
    startConversation,
    setActiveConversation,
  } = useCommunity();

  const { userProfile } = useAuth();

  const handleOpenContextChat = useCallback(
    async (post: CommunityNotice) => {
      if (!userProfile?.id || !post.authorId) return;

      try {
        const participantSet = new Set((members || []).map((m) => m.userId));
        if (post.authorId) participantSet.add(post.authorId);
        participantSet.add(userProfile?.id);
        const participants =
          post.type === 'listing'
            ? Array.from(new Set([userProfile?.id, post.authorId]))
            : Array.from(participantSet);

        const conversationId = await startConversation({
          participants,
          type: post.type === 'listing' ? 'listing' : 'notice',
          communityId: currentCommunity?.id,
          listingId: post.type === 'listing' ? post.id : undefined,
          noticeId: post.type === 'notice' ? post.id : undefined,
          metadata: {
            title: post.title,
            image: post.postsImage || undefined,
            price: post.type === 'listing' ? post.price?.toString() : undefined,
            description: post.description,
            author: post.authorName,
            authorImage: post.authorImage,
            authorId: post.authorId,
            authorRole: post.authorRole,
            location: post.locationName,
            urgency: post.urgency,
            urgencyLevel: post.urgencyLevel,
          },
        });

        setActiveConversation(conversationId);
        router.push(`/chat/${conversationId}` as any);
      } catch (error) {
        console.error('Failed to open contextual chat:', error);
      }
    },
    [currentCommunity?.id, router, setActiveConversation, startConversation, userProfile?.id, members]
  );

  // ─── local state ──────────────────────────────────────────────────────────
  const {
    mapCenter,
    setMapCenter,
    resetTrigger,
    isEmergencyActive,
    mapFilterOverride,
    setMapFilterOverride,
    mapUnlocked,
    setMapUnlocked,
    resetCommunityMapView,
  } = useCommunityMap();

  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showIncidentMenu, setShowIncidentMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

  // Progress bar animation value
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ─── derived data ─────────────────────────────────────────────────────────

  const userRole = currentCommunity?.userRole || 'MEMBER';

  const notices = useMemo(
    () =>
      [...posts]
        .filter(
          (p) =>
            p.type === 'notice' &&
            p.urgency !== 'emergency' &&
            p.urgencyLevel !== 'emergency'
        )
        .sort((a, b) => {
          const pA = getUrgencyPriority(a.urgencyLevel, a.urgency);
          const pB = getUrgencyPriority(b.urgencyLevel, b.urgency);
          if (pA !== pB) return pB - pA;
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }),
    [posts]
  );

  const activeEmergencyPosts = useMemo(
    () =>
      [...posts]
        .filter(
          (p) => p.urgency === 'emergency' || p.urgencyLevel === 'emergency'
        )
        .sort(
          (a, b) =>
            new Date(b.timestamp || 0).getTime() -
            new Date(a.timestamp || 0).getTime()
        ),
    [posts]
  );

  // Emergency/warning/caution notices fill the row; info & general are 2-up.
  const isFullWidthNotice = (n: CommunityNotice) =>
    n.urgency === 'emergency' ||
    n.urgencyLevel === 'emergency' ||
    n.urgencyLevel === 'warning' ||
    n.urgency === 'high';

  const fullWidthNotices = useMemo(
    () => notices.filter(isFullWidthNotice),
    [notices]
  );
  const compactNotices = useMemo(
    () => notices.filter((n) => !isFullWidthNotice(n)),
    [notices]
  );

  const listings = useMemo(
    () =>
      [...posts]
        .filter((p) => p.type === 'listing' && String(p.status || '').toUpperCase() !== 'SOLD')
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

  const { active: resolvedCharity, cat: catCharity, featured: configuredFeaturedCharity } =
    resolveActiveCharity(charities, currentCommunity ?? null);

  const selectedCharity =
    resolvedCharity ??
    charities.find((c) => c.id === selectedCharityId);

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
        typeof listing.charityAmount === 'number' &&
        Number.isFinite(listing.charityAmount)
      ) {
        return sum + Math.max(0, listing.charityAmount);
      }
      const base =
        typeof listing.communityPrice === 'number'
          ? listing.communityPrice
          : typeof listing.price === 'number'
          ? listing.price
          : 0;
      const pub =
        typeof listing.publicPrice === 'number'
          ? listing.publicPrice
          : typeof listing.price === 'number'
          ? listing.price
          : base;
      return sum + Math.max(0, pub - base);
    }, 0);
  }, [approvedPublicCharityListings]);

  // Potential CAT running total across ALL approved Public listings in the
  // community (regardless of whether a charity is selected). Represents the
  // benefit CAT brings to the community when activated.
  const potentialCatTotal = useMemo(() => {
    const eligible = posts.filter((post) => {
      if (post.type !== 'listing') return false;
      if (!post.isPublic) return false;
      const s = typeof post.status === 'string' ? post.status.toLowerCase() : '';
      return s === 'active' || s === 'pinned';
    });
    return eligible.reduce((sum, listing) => {
      if (
        typeof listing.charityAmount === 'number' &&
        Number.isFinite(listing.charityAmount)
      ) {
        return sum + Math.max(0, listing.charityAmount);
      }
      const base =
        typeof listing.communityPrice === 'number'
          ? listing.communityPrice
          : typeof listing.price === 'number'
          ? listing.price
          : 0;
      const pub =
        typeof listing.publicPrice === 'number'
          ? listing.publicPrice
          : typeof listing.price === 'number'
          ? listing.price
          : base;
      return sum + Math.max(0, pub - base);
    }, 0);
  }, [posts]);
  const potentialCatLabel = `R${potentialCatTotal.toLocaleString()}`;
  const potentialCatCount = useMemo(
    () => posts.filter((p) => p.type === 'listing' && p.isPublic).length,
    [posts],
  );

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

  const handleShareListing = useCallback(async (listing: CommunityNotice) => {
    const route = `/market?listingId=${listing.id}`;
    const communityName = currentCommunity?.name || 'your community';
    const localPrice = typeof listing.price === 'number' ? `R${listing.price.toLocaleString()}` : 'Price on request';
    const message = [
      `${listing.title}`,
      listing.description || 'Community listing on Lalela.',
      `Local price: ${localPrice}`,
      `Community: ${communityName}`,
      `Open in Lalela: ${route}`,
    ].join('\n');

    try {
      await NativeShare.share({
        title: listing.title,
        message,
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  }, [currentCommunity?.name]);

  const handleMarkListingSold = useCallback(
    (listing: CommunityNotice) => {
      const isOwner = listing.authorId && userProfile?.id && listing.authorId === userProfile.id;
      const isSold = String(listing.status || '').toUpperCase() === 'SOLD';
      if (!isOwner || isSold) return;

      Alert.alert(
        'Mark as sold',
        listing.isPublic
          ? 'This will mark the listing sold and trigger CAT accounting for this public listing.'
          : 'This will mark the listing sold. Local listing sales do not trigger CAT.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              setMarkingSoldId(listing.id);
              try {
                const result = await markPostSold(listing.id);
                Alert.alert(
                  'Listing updated',
                  result.catTriggered
                    ? `Sold marked. CAT recorded: R${Number(result.catAmount || 0).toFixed(2)}${result.pooledToCharity ? ' (pooled to charity).' : '.'}`
                    : 'Sold marked with no CAT trigger (local listing).'
                );
              } catch {
                Alert.alert('Unable to mark sold', 'Please try again.');
              } finally {
                setMarkingSoldId(null);
              }
            },
          },
        ]
      );
    },
    [markPostSold, userProfile?.id]
  );

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
      color: THEME_COLORS.warning,
      sub: 'Immediate attention needed',
    },
    {
      level: 'info',
      label: 'Info',
      color: THEME_COLORS.brandBlueText,
      sub: 'Standard community notice',
    },
    {
      level: 'general',
      label: 'General',
      color: THEME_COLORS.primary,
      sub: 'General information',
    },
  ];

  // ─── render helpers ───────────────────────────────────────────────────────

  const renderNoticeCard = ({ item: notice }: { item: CommunityNotice }) => {
    const isEmergencyOrWarning =
      notice.urgency === 'emergency' ||
      notice.urgencyLevel === 'emergency' ||
      notice.urgencyLevel === 'warning' ||
      notice.urgency === 'high';

    const borderColor = urgencyBorderColor(notice.urgencyLevel, notice.urgency);
    const bgColor = urgencyBgColor(notice.urgencyLevel, notice.urgency);
    const textColor = urgencyTextColor(notice.urgencyLevel, notice.urgency);
    const dist = calculateDistance(notice.latitude, notice.longitude);

    return (
      <View
        key={notice.id}
        className={cn(
          'rounded-3xl border overflow-hidden mb-4',
          !isEmergencyOrWarning && 'flex-1'
        )}
        style={{
          borderColor,
          backgroundColor: bgColor,
          ...(isEmergencyOrWarning ? CARD_DEPTH_HERO : CARD_DEPTH),
        }}
      >
        {/* Mini map for emergency/warning with location */}
        {isEmergencyOrWarning && notice.latitude && notice.longitude && (
          <View className="w-full overflow-hidden border-b" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
            <InteractiveCoverageMap
              center={{ latitude: notice.latitude, longitude: notice.longitude }}
              height={160}
              isEmergencyActive={
                notice.urgency === 'emergency' ||
                notice.urgencyLevel === 'emergency'
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
                  notice.urgencyLevel === 'emergency'
                    ? THEME_COLORS.error
                    : THEME_COLORS.warningStrong,
              }}
            >
              <Text className="text-white text-[8px] font-bold uppercase tracking-widest">
                {notice.urgency === 'emergency' ||
                notice.urgencyLevel === 'emergency'
                  ? 'Live Situation'
                  : 'Warning Zone'}
              </Text>
            </View>
          </View>
        )}

        {/* Attached image (non-emergency) layout at top */}
        {notice.postsImage && !isEmergencyOrWarning && (
          <View className="w-full h-24 border-b overflow-hidden" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
            <Image
              source={{ uri: resolveMediaUrl(notice.postsImage) }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        )}

        {isEmergencyOrWarning ? (
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
                className="p-2 rounded-full bg-surface-container"
              >
                <MoreVertical size={16} color={THEME_COLORS.neutralTextSubtle} />
              </TouchableOpacity>
              {activeMenuId === notice.id && (
                <View
                  className="absolute right-0 mt-1 w-48 bg-surface-container-low rounded-2xl shadow-xl border z-50 py-2 overflow-hidden"
                  style={{ top: SPACE.s36, borderColor: THEME_COLORS.neutralBorderSoft }}
                >
                  {(notice.authorId === userProfile?.id ||
                    currentCommunity?.userRole === 'ADMIN') && (
                    <>
                      {notice.authorId === userProfile?.id && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            onEditPost?.(notice);
                            setActiveMenuId(null);
                          }}
                          className="flex-row items-center gap-2 px-4 py-2"
                        >
                          <Tag size={14} color={THEME_COLORS.primary} />
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
                        <AlertTriangle size={14} color={THEME_COLORS.error} />
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
                    <Share2 size={14} color={THEME_COLORS.neutralTextSubtle} />
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
                level={notice.urgencyLevel}
                urgency={notice.urgency}
                size={10}
              />
              <Text
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: textColor }}
              >
                {notice.urgencyLevel || notice.urgency || 'Info'}
              </Text>
            </View>

          {/* Location chip */}
          {(notice.locationName || notice.latitude) && (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={!notice.latitude || !notice.longitude}
              onPress={() => {
                if (!notice.latitude || !notice.longitude) return;
                setMapFilterOverride('notices');
                setMapCenter({
                  latitude: notice.latitude,
                  longitude: notice.longitude,
                });
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              className="flex-row items-center gap-1.5 bg-surface-container-low self-start px-2 py-1 rounded-md mb-3"
            >
              <MapPin size={10} color={THEME_COLORS.primary} />
              <Text className="text-[10px] font-bold text-primary">
                {notice.locationName || 'Location Provided'}
              </Text>
              {dist && (
                <Text className="text-[10px] text-gray-400 ml-1">
                  • {dist}km
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Description */}
          <Text className="text-gray-500 text-sm leading-relaxed mb-4" numberOfLines={2}>
            {notice.description}
          </Text>

          {/* Footer row */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-surface-container overflow-hidden">
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
                notice.urgencyLevel === 'emergency' ||
                notice.priority === 'emergency') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="p-2 rounded-full bg-red-50"
                  onPress={() => openEmergencyHub(notice)}
                >
                  <Siren size={16} color={THEME_COLORS.error} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                className="p-2 rounded-full bg-surface-container-low"
                onPress={() => onOpenChat ? onOpenChat(notice) : handleOpenContextChat(notice)}
              >
                <MessageSquare size={16} color={THEME_COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        ) : (
        <View className="p-3 gap-1">
          {/* Header: title + kebab */}
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-sm font-bold text-gray-900 leading-tight" numberOfLines={2}>
              {notice.title}
            </Text>
            <View className="relative shrink-0">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  setActiveMenuId(activeMenuId === notice.id ? null : notice.id)
                }
                className="w-7 h-7 rounded-full bg-surface-container items-center justify-center"
              >
                <MoreVertical size={14} color={THEME_COLORS.neutralTextSubtle} />
              </TouchableOpacity>
              {activeMenuId === notice.id && (
                <View
                  className="absolute right-0 mt-1 w-44 bg-surface-container-low rounded-2xl shadow-xl border z-50 py-2 overflow-hidden"
                  style={{ top: SPACE.s32, borderColor: THEME_COLORS.neutralBorderSoft }}
                >
                  {(notice.authorId === userProfile?.id ||
                    currentCommunity?.userRole === 'ADMIN') && (
                    <>
                      {notice.authorId === userProfile?.id && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            onEditPost?.(notice);
                            setActiveMenuId(null);
                          }}
                          className="flex-row items-center gap-2 px-4 py-2"
                        >
                          <Tag size={14} color={THEME_COLORS.primary} />
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
                        <AlertTriangle size={14} color={THEME_COLORS.error} />
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
                    <Share2 size={14} color={THEME_COLORS.neutralTextSubtle} />
                    <Text className="text-sm font-bold text-gray-500">
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Urgency badge (info / general) */}
          <View
            className="self-start flex-row items-center gap-1 px-2 py-0.5 rounded-full border"
            style={{ borderColor, backgroundColor: `${textColor}15` }}
          >
            <UrgencyIcon
              level={notice.urgencyLevel}
              urgency={notice.urgency}
              size={8}
            />
            <Text
              className="text-[8px] font-black uppercase tracking-widest"
              style={{ color: textColor }}
            >
              {notice.urgencyLevel || notice.urgency || 'Info'}
            </Text>
          </View>

          {/* Location chip */}
          {(notice.locationName || notice.latitude) && (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={!notice.latitude || !notice.longitude}
              onPress={() => {
                if (!notice.latitude || !notice.longitude) return;
                setMapFilterOverride('notices');
                setMapCenter({
                  latitude: notice.latitude,
                  longitude: notice.longitude,
                });
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              className="flex-row items-center gap-1 bg-surface-container-low self-start px-2 py-0.5 rounded-md"
            >
              <MapPin size={10} color={THEME_COLORS.primary} />
              <Text className="text-[10px] font-bold text-primary" numberOfLines={1}>
                {notice.locationName || 'Location Provided'}
              </Text>
              {dist && (
                <Text className="text-[10px] text-gray-400 ml-1">
                  • {dist}km
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Description */}
          <Text className="text-xs text-gray-500 leading-snug" numberOfLines={2}>
            {notice.description}
          </Text>

          {/* Footer: author + chat */}
          <View className="flex-row items-center gap-2 pt-1 mt-1 border-t" style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}>
            <View className="w-6 h-6 rounded-full bg-surface-container overflow-hidden">
              {notice.authorImage ? (
                <Image
                  source={{ uri: notice.authorImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Text className="text-[10px] font-bold text-gray-500">
                    {notice.authorName?.charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="flex-1 text-[10px] font-semibold text-gray-800"
              numberOfLines={1}
            >
              {notice.authorName}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-surface-container-low items-center justify-center"
              onPress={() =>
                onOpenChat ? onOpenChat(notice) : handleOpenContextChat(notice)
              }
            >
              <MessageSquare size={14} color={THEME_COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        )}
      </View>
    );
  };

  const renderListingCard = ({ item: listing }: { item: CommunityNotice }) => {
    const isOwner = listing.authorId === userProfile?.id;
    const isAdmin = currentCommunity?.userRole === 'ADMIN';
    const isSold = String(listing.status || '').toUpperCase() === 'SOLD';
    const isMarkingSold = markingSoldId === listing.id;
    const linkedCharity = listing.charityId
      ? charities.find((c) => c.id === listing.charityId)
      : null;

    const localPrice = listing.price ?? 0;
    const publicPrice = listing.publicPrice ?? 0;
    const hasPublicPrice =
      listing.isPublic === true &&
      listing.publicPrice != null &&
      listing.price != null &&
      publicPrice > localPrice;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/market?listingId=${listing.id}`)}
        key={listing.id}
        className="flex-1 mx-0.5 mb-3 bg-surface-container-low rounded-3xl border overflow-hidden"
        style={{ ...CARD_DEPTH, borderColor: THEME_COLORS.neutralBorderSoft }}
      >
        {typeof listing.postsImage === 'string' && listing.postsImage.trim().length > 0 && (
          <Image 
            source={{ uri: resolveMediaUrl(listing.postsImage) }} 
            className="w-full h-24 bg-surface-container" 
            resizeMode="cover" 
          />
        )}
        <View className="p-3 gap-1">
          {/* Header: title + kebab */}
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className="flex-1 text-sm font-bold text-gray-900 leading-tight"
              numberOfLines={2}
            >
              {listing.title}
            </Text>
            <View className="relative shrink-0">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  setActiveMenuId(
                    activeMenuId === listing.id ? null : listing.id
                  )
                }
                className="w-7 h-7 rounded-full bg-surface-container items-center justify-center"
              >
                <MoreVertical size={14} color={THEME_COLORS.neutralTextSubtle} />
              </TouchableOpacity>
              {activeMenuId === listing.id && (
                <View
                  className="absolute right-0 mt-1 w-44 bg-surface-container-low rounded-2xl shadow-xl border z-50 py-2 overflow-hidden"
                  style={{ top: SPACE.s32, borderColor: THEME_COLORS.neutralBorderSoft }}
                >
                  {isOwner && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setActiveMenuId(null);
                        router.push(`/create-post?postId=${listing.id}` as any);
                      }}
                      className="flex-row items-center gap-2 px-4 py-2"
                    >
                      <Tag size={14} color={THEME_COLORS.primary} />
                      <Text className="text-sm font-bold text-primary">
                        Edit Listing
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(isOwner || isAdmin) && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setPostToDelete(listing.id);
                        setActiveMenuId(null);
                      }}
                      className="flex-row items-center gap-2 px-4 py-2"
                    >
                      <AlertTriangle size={14} color={THEME_COLORS.error} />
                      <Text className="text-sm font-bold text-red-600">
                        Delete Listing
                      </Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && !isSold && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={isMarkingSold}
                      onPress={() => {
                        setActiveMenuId(null);
                        handleMarkListingSold(listing);
                      }}
                      className="flex-row items-center gap-2 px-4 py-2"
                    >
                      <CheckCircle2 size={14} color={THEME_COLORS.successStrongAlt} />
                      <Text className="text-sm font-bold text-green-600">
                        {isMarkingSold ? 'Marking...' : 'Mark as Sold'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!isOwner && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={async () => {
                        setActiveMenuId(null);
                        await handleShareListing(listing);
                      }}
                      className="flex-row items-center gap-2 px-4 py-2"
                    >
                      <Share2 size={14} color={THEME_COLORS.neutralTextSubtle} />
                      <Text className="text-sm font-bold text-gray-500">
                        Share
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

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
                  <Heart size={10} color={THEME_COLORS.indigo} />
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
                <MapPin size={14} color={THEME_COLORS.indigo} />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row items-center gap-2 pt-1 mt-1 border-t" style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}>
            <View className="w-6 h-6 rounded-full bg-surface-container overflow-hidden">
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
            <TouchableOpacity
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-surface-container-low items-center justify-center"
              onPress={() =>
                onOpenChat ? onOpenChat(listing) : handleOpenContextChat(listing)
              }
            >
              <MessageSquare size={14} color={THEME_COLORS.primary} />
            </TouchableOpacity>
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
        style={{ backgroundColor: THEME_COLORS.blackOverlay60 }}
      >
        <View className="bg-surface-container-low rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <View className="bg-red-50 w-16 h-16 rounded-full items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} color={THEME_COLORS.error} />
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
        style={{ flex: 1, backgroundColor: THEME_COLORS.blackOverlay50, justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={() => setShowIncidentMenu(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-surface-container-low rounded-t-3xl pb-8">
            <View className="p-5 border-b" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
              <View className="w-10 h-1 bg-surface-container rounded-full mx-auto mb-4" />
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
                className="flex-row items-center gap-4 px-6 py-4 border-b"
                style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}
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
        style={{ backgroundColor: THEME_COLORS.blackOverlay60 }}
      >
        <View className="bg-surface-container-low rounded-3xl p-8 w-full max-w-sm shadow-2xl gap-6">
          <View className="bg-red-50 w-16 h-16 rounded-full items-center justify-center mx-auto">
            <Siren size={32} color={THEME_COLORS.error} />
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
              <MessageSquare size={18} color={THEME_COLORS.white} />
              <Text className="text-white font-bold">
                Join Coordination Hub
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              className="bg-surface-container py-4 rounded-full items-center"
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
      className="flex-1"
      style={{ backgroundColor: APP_SHELL_COLORS.body }}
      contentContainerStyle={{ paddingBottom: SPACE.s40 }}
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
              'flex-1 flex-col items-center justify-center py-3 rounded-2xl gap-1.5',
              currentCommunity?.status === 'READ-ONLY' && 'opacity-50'
            )}
            style={{ backgroundColor: THEME_COLORS.secondaryContainer, ...CARD_DEPTH }}
          >
            <Siren
              size={20}
              color={THEME_COLORS.white}
              fill={isEmergencyActive ? THEME_COLORS.white : 'transparent'}
            />
            <Text className="text-white font-bold text-base text-center">
              {isEmergencyActive ? 'ACTIVE EMERGENCY' : 'Emergency Help'}
            </Text>
            {isEmergencyActive && (
              <View className="absolute top-2 right-2 w-2 h-2 bg-surface-container-low rounded-full" />
            )}
          </TouchableOpacity>

          {/* Create Notice button + urgency picker modal */}
          <View className="flex-1">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowIncidentMenu(true)}
              disabled={currentCommunity?.status === 'READ-ONLY'}
              className={cn(
                'flex-col items-center justify-center py-3 rounded-2xl gap-1.5',
                currentCommunity?.status === 'READ-ONLY' && 'opacity-50'
              )}
              style={{ backgroundColor: THEME_COLORS.primaryContainer, ...CARD_DEPTH }}
            >
              <Plus size={20} color={THEME_COLORS.white} />
              <Text className="text-white font-bold text-base">
                Create Notice
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Emergency Alert Banner ───────────────────────────────────── */}
        {alert && (
          <View className="relative overflow-hidden bg-red-600 rounded-3xl p-6" style={CARD_DEPTH_HERO}>
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-row items-center gap-2 bg-surface-container-low/20 px-3 py-1 rounded-full">
                <AlertTriangle size={14} color={THEME_COLORS.white} fill={THEME_COLORS.white} />
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
                className="bg-surface-container-low px-6 py-3 rounded-full"
              >
                <Text className="text-red-600 font-bold text-sm">
                  Acknowledge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-surface-container-low/10 px-6 py-3 rounded-full"
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
            'bg-surface-container-low rounded-3xl p-5 gap-5',
            isEmergencyActive && 'border-2 border-red-300 bg-red-50/30'
          )}
          style={CARD_DEPTH_HERO}
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
            onOpenEmergencyHub={(incidentId) => {
              if (!incidentId) return;
              router.push({
                pathname: `/emergency/${incidentId}` as any,
                params: { from: 'home-map', source: 'coverage-overlay' },
              } as any);
            }}
            onOpenEmergencySelection={() => {
              router.push({
                pathname: '/emergency' as any,
                params: { from: 'home-map', source: 'coverage-overlay' },
              } as any);
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
              onPress={() => router.push('/posts')}
              className="flex-row items-center gap-1"
            >
              <Text className="text-primary font-semibold text-sm">
                View All
              </Text>
              <ArrowRight size={14} color={THEME_COLORS.primaryContainer} />
            </TouchableOpacity>
          </View>

          {notices.length === 0 ? (
            <View
              className="items-center justify-center gap-3 py-10 px-6 bg-surface-container-low rounded-3xl border"
              style={{ ...CARD_DEPTH_SOFT, borderColor: THEME_COLORS.neutralBorderSoft }}
            >
              <View className="w-14 h-14 rounded-full bg-surface-container-low items-center justify-center">
                <Shield size={28} color={THEME_COLORS.success} />
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
                  className="mt-2 bg-surface-container px-5 py-2 rounded-full"
                >
                  <Text className="text-primary text-xs font-bold">
                    Post a Notice
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="gap-0">
              {fullWidthNotices.length > 0 && (
                <FlatList
                  key="notices-full"
                  data={fullWidthNotices}
                  keyExtractor={(item) => item.id}
                  renderItem={renderNoticeCard}
                  scrollEnabled={false}
                />
              )}
              {compactNotices.length > 0 && (
                <FlatList
                  key="notices-compact"
                  data={compactNotices}
                  numColumns={2}
                  columnWrapperStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.xxs }}
                  keyExtractor={(item) => item.id}
                  renderItem={renderNoticeCard}
                  scrollEnabled={false}
                />
              )}
            </View>
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
              'relative overflow-hidden rounded-3xl border bg-surface-container-low p-4',
              hasNoNotices ? 'border-outline-variant' : ''
            )}
            style={{ ...CARD_DEPTH_HERO, ...(hasNoNotices ? null : { borderColor: THEME_COLORS.neutralBorderSoft }) }}
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
                <View className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-container border shrink-0" style={{ borderColor: THEME_COLORS.neutralBorderSoft }}>
                  {charityImage ? (
                    <Image
                      source={{ uri: charityImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Heart size={20} color={THEME_COLORS.neutralTextSoft} />
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
              <View className="gap-3">
                <Text className="text-base font-bold text-primary">
                  CAT is in effect
                </Text>
                <Text className="text-sm text-gray-500">
                  No featured charity is selected yet. Every public listing still
                  accrues the CAT margin — funds will route once a charity is
                  featured.
                </Text>
                <View className="flex-row items-end justify-between rounded-2xl bg-primary/5 px-4 py-3">
                  <View>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                      Potential CAT Total
                    </Text>
                    <Text className="text-lg font-bold text-primary">
                      {potentialCatLabel}
                    </Text>
                  </View>
                  <Text className="text-[10px] font-semibold text-primary/70">
                    {potentialCatCount} public listing{potentialCatCount === 1 ? '' : 's'}
                  </Text>
                </View>
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
                <ArrowRight size={14} color={THEME_COLORS.primaryContainer} />
              </TouchableOpacity>
            </View>

            <FlatList
              key={2}
              data={listings}
              numColumns={2}
              columnWrapperStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.xxs }}
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
