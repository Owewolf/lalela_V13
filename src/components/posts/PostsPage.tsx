import { defaultMapViewProps } from "../../lib/mapViewProps";
import { resolveMediaUrl } from "../../lib/config";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Modal,
  Alert,
  Share as NativeShare,
} from 'react-native';
import {
  Plus,
  Search,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Siren,
  Clock,
  MoreVertical,
  Heart,
  MessageSquare,
  Share2,
  MapPin,
  Info,
  X,
  Pencil,
} from 'lucide-react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import type { CommunityNotice } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardShadow } from '../../theme/cardStyles';
import { createShadow } from '../../theme/shadows';
import RecordSaleModal from '../market/RecordSaleModal';

const PRIMARY = THEME_COLORS.primary;
const SPACE = {
  s24: 24,
  s120: 120,
};
const CARD_DEPTH_HERO = getCardShadow('hero');
const CARD_DEPTH = getCardShadow('default');
const CARD_DEPTH_SOFT = getCardShadow('soft');
const SURFACE_BORDER_STYLE = { borderColor: getCardBorderColor('default') };

interface PostsPageProps {
  initialNoticeId?: string;
}

function getUrgencyPriority(level?: string, urgency?: string): number {
  const l =
    level ||
    (urgency === 'high' ? 'warning' : urgency === 'normal' ? 'info' : urgency === 'low' ? 'general' : urgency);
  switch (l) {
    case 'emergency': return 4;
    case 'warning': return 3;
    case 'info': return 2;
    case 'general': return 1;
    default: return 0;
  }
}

function getUrgencyColors(level?: string, urgency?: string) {
  const l =
    level ||
    (urgency === 'high' ? 'warning' : urgency === 'normal' ? 'info' : urgency === 'low' ? 'general' : urgency);
  switch (l) {
    case 'emergency':
      return { text: THEME_COLORS.errorStrong, bg: THEME_COLORS.errorSurface, border: THEME_COLORS.errorBorder };
    case 'warning':
      return { text: THEME_COLORS.warning, bg: THEME_COLORS.warningSurface, border: THEME_COLORS.warningBorderStrong };
    case 'info':
      return { text: THEME_COLORS.brandBlueText, bg: THEME_COLORS.infoSurfaceSoft, border: THEME_COLORS.aliasHex_bfdbfe };
    case 'general':
      return { text: THEME_COLORS.successStrongAlt, bg: THEME_COLORS.successSurfaceSoft, border: THEME_COLORS.aliasHex_a7f3d0 };
    default:
      return { text: THEME_COLORS.neutralTextSubtle, bg: THEME_COLORS.neutralBg, border: THEME_COLORS.neutralBorderSoft };
  }
}

function getPostBorderColor(post: CommunityNotice): string {
  if (post.type !== 'notice') return THEME_COLORS.neutralBorderSoft;
  const urgency =
    post.urgencyLevel ||
    (post.urgency === 'high' ? 'warning' : post.urgency === 'normal' ? 'info' : post.urgency === 'low' ? 'general' : post.urgency);
  switch (urgency) {
    case 'emergency': return THEME_COLORS.aliasHex_fca5a5;
    case 'warning': return THEME_COLORS.warningBorderStrong;
    case 'info': return THEME_COLORS.infoBorderStrong;
    case 'general': return THEME_COLORS.aliasHex_6ee7b7;
    default: return THEME_COLORS.neutralBorderSoft;
  }
}

function getUrgencyLabel(level?: string, urgency?: string): string {
  const l =
    level ||
    (urgency === 'high' ? 'warning' : urgency === 'normal' ? 'info' : urgency === 'low' ? 'general' : urgency);
  return l || 'Info';
}

function UrgencyIcon({ level, urgency, size = 12 }: { level?: string; urgency?: string; size?: number }) {
  const l =
    level ||
    (urgency === 'high' ? 'warning' : urgency === 'normal' ? 'info' : urgency === 'low' ? 'general' : urgency);
  const colors = getUrgencyColors(l);
  switch (l) {
    case 'emergency':
      return <Siren size={size} color={colors.text} />;
    case 'warning':
      return <AlertTriangle size={size} color={colors.text} />;
    case 'info':
      return <Info size={size} color={colors.text} />;
    default:
      return <Tag size={size} color={colors.text} />;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function calculateDistance(lat?: number, lng?: number, baseLat?: number, baseLng?: number): string | null {
  if (!lat || !lng || !baseLat || !baseLng) return null;
  const R = 6371;
  const dLat = ((lat - baseLat) * Math.PI) / 180;
  const dLon = ((lng - baseLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((baseLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

export default function PostsPage({ initialNoticeId }: PostsPageProps) {
  const router = useRouter();
  const { posts, currentCommunity, removePost, charities, startConversation, setActiveConversation, members, markPostSold } = useCommunity();
  const { userProfile } = useAuth();
  const [filter, setFilter] = useState<'all' | 'listing' | 'notice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [mapPost, setMapPost] = useState<CommunityNotice | null>(null);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [saleListing, setSaleListing] = useState<CommunityNotice | null>(null);
  const feedListRef = useRef<FlatList<FeedSection> | null>(null);

  const baseLat = currentCommunity?.coverageArea?.latitude;
  const baseLng = currentCommunity?.coverageArea?.longitude;

  const notices = posts
    .filter(p => p.type === 'notice')
    .sort((a, b) => {
      const pa = getUrgencyPriority(a.urgencyLevel, a.urgency);
      const pb = getUrgencyPriority(b.urgencyLevel, b.urgency);
      if (pa !== pb) return pb - pa;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const listings = posts
    .filter(p => p.type === 'listing' && String(p.status || '').toUpperCase() !== 'SOLD')
    .filter(
      p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const confirmDelete = useCallback(() => {
    if (!postToDelete) return;
    Alert.alert('Delete Post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setPostToDelete(null) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removePost(postToDelete);
          setPostToDelete(null);
        },
      },
    ]);
  }, [postToDelete, removePost]);

  // Trigger delete alert when postToDelete is set
  React.useEffect(() => {
    if (postToDelete) confirmDelete();
  }, [postToDelete]);

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

      const initialQuantity = Math.max(1, Number(listing.initialQuantity ?? 1));
      const soldQuantity = Math.max(0, Number(listing.soldQuantity ?? 0));
      const remainingQuantity = Math.max(0, Number(listing.remainingQuantity ?? (initialQuantity - soldQuantity)));
      const isMultiItem = remainingQuantity > 1;

      if (isMultiItem) {
        setSaleListing(listing);
        return;
      }

      Alert.alert(
        'Mark as sold',
        'This will mark the listing sold and record the CAT contribution for the community.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              setMarkingSoldId(listing.id);
              try {
                const result = await markPostSold(listing.id, 1);
                Alert.alert(
                  'Listing updated',
                  result.catTriggered
                    ? `Sold marked. CAT recorded: R${Number(result.catAmount || 0).toFixed(2)}${result.pooledToCharity ? ' (pooled to charity).' : '.'}`
                    : 'Sold marked.'
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

  const handleOpenContextChat = useCallback(
    async (post: CommunityNotice) => {
      const isEmergencyNotice =
        post.type === 'notice' &&
        (post.urgency === 'emergency' ||
          post.urgencyLevel === 'emergency' ||
          post.priority === 'emergency');

      if (isEmergencyNotice) {
        router.push(`/emergency/${post.id}`);
        return;
      }

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
            type: post.type,
            image: post.postsImage,
            author: post.authorName,
            authorImage: post.authorImage,
            authorId: post.authorId,
            authorRole: post.authorRole,
            location: post.locationName,
            urgency: post.urgency,
            urgencyLevel: post.urgencyLevel,
            description: post.description,
            price: post.type === 'listing' && post.price !== undefined ? `R${(post.communityPrice || post.price).toLocaleString()}` : undefined,
          },
        });
        setActiveConversation(conversationId);
        router.push(`/chat/${conversationId}`);
      } catch (error) {
        console.error('Failed to open contextual chat:', error);
      }
    },
    [currentCommunity?.id, router, setActiveConversation, startConversation, userProfile?.id, members]
  );

  const renderNotice = useCallback(
    ({ item: notice }: { item: CommunityNotice }) => {
      const urgencyColors = getUrgencyColors(notice.urgencyLevel, notice.urgency);
      const borderColor = getPostBorderColor(notice);
      const isEmergency =
        notice.urgency === 'emergency' || notice.urgencyLevel === 'emergency';
      const isWarning = notice.urgencyLevel === 'warning' || notice.urgency === 'high';
      const showMap =
        (isEmergency || isWarning) && notice.latitude && notice.longitude;
      const dist = calculateDistance(notice.latitude, notice.longitude, baseLat, baseLng);
      const isOwner = notice.authorId === userProfile?.id;
      const isAdmin = currentCommunity?.userRole === 'ADMIN';

      return (
        <View
          className="rounded-2xl bg-surface-container-low overflow-hidden mb-3"
          style={{
            borderWidth: 1,
            borderColor: highlightedNoticeId === notice.id ? PRIMARY : borderColor,
            ...(highlightedNoticeId === notice.id
              ? createShadow(THEME_COLORS.black, 0, 12, 0.22, 20, 9)
              : CARD_DEPTH),
          }}
        >
          {/* Inline map for emergency/warning */}
          {showMap ? (
            <TouchableOpacity
              onPress={() => setMapPost(notice)}
              activeOpacity={0.9}
              style={{ height: 160, overflow: 'hidden', borderBottomWidth: 1, borderColor: THEME_COLORS.neutralBgSofter }}
            >
              <MapView {...defaultMapViewProps}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: notice.latitude!,
                  longitude: notice.longitude!,
                  latitudeDelta: 0.08,
                  longitudeDelta: 0.08,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: notice.latitude!, longitude: notice.longitude! }}
                  pinColor={isEmergency ? THEME_COLORS.errorStrong : THEME_COLORS.warning}
                />
                <Circle
                  center={{ latitude: notice.latitude!, longitude: notice.longitude! }}
                  radius={10000}
                  strokeColor={isEmergency ? THEME_COLORS.errorStrong : THEME_COLORS.warning}
                  fillColor={isEmergency ? THEME_COLORS.alias_rgba_220_38_38_0_05 : THEME_COLORS.alias_rgba_217_119_6_0_05}
                  strokeWidth={1}
                />
              </MapView>
              <View
                className={[
                  'absolute top-2 right-2 px-2 py-0.5 rounded-full',
                  isEmergency ? 'bg-red-600' : 'bg-amber-500',
                ].join(' ')}
              >
                <Text className="text-white text-[8px] font-bold uppercase tracking-widest">
                  {isEmergency ? 'Live Situation' : 'Warning Zone'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Image (non-emergency) edge-to-edge layout at top */}
          {notice.postsImage && !showMap ? (
            <View className="w-full aspect-video border-b overflow-hidden" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
              <Image
                source={{ uri: resolveMediaUrl(notice.postsImage) }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          ) : null}

          <View className="p-6 gap-4">
            {/* Title and Menu Row */}
            <View className="flex-row justify-between items-start -mb-2 gap-3">
              <Text className="text-gray-900 font-bold text-lg leading-snug flex-1">{notice.title}</Text>
              {/* Menu */}
              <View className="relative shrink-0">
                <TouchableOpacity
                  onPress={() => setActiveMenuId(activeMenuId === notice.id ? null : notice.id)}
                  className="p-2 rounded-full bg-surface-container"
                  activeOpacity={0.8}
                >
                  <MoreVertical size={16} color={THEME_COLORS.neutralTextSoft} />
                </TouchableOpacity>
                {activeMenuId === notice.id && (
                  <View
                    className="absolute right-0 top-10 w-48 bg-surface-container-low rounded-2xl border py-2 z-50"
                    style={{ ...createShadow(THEME_COLORS.black, 0, 0, 0.1, 12, 8), ...SURFACE_BORDER_STYLE }}
                  >
                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveMenuId(null);
                          router.push({ pathname: '/create-post', params: { postId: notice.id } });
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <Pencil size={16} color={THEME_COLORS.primary} />
                        <Text className="text-primary text-sm font-bold">Edit Notice</Text>
                      </TouchableOpacity>
                    )}
                    {(isOwner || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => {
                          setPostToDelete(notice.id);
                          setActiveMenuId(null);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <AlertTriangle size={16} color={THEME_COLORS.errorStrong} />
                        <Text className="text-red-600 text-sm font-bold">Delete Notice</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setActiveMenuId(null)}
                      className="flex-row items-center gap-2 px-4 py-2"
                      activeOpacity={0.8}
                    >
                      <Share2 size={16} color={THEME_COLORS.neutralTextSubtle} />
                      <Text className="text-gray-500 text-sm font-bold">Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Urgency badge */}
            <View
              className="self-start flex-row items-center gap-1.5 px-3 py-1 rounded-full border"
              style={{
                backgroundColor: urgencyColors.bg,
                borderColor: urgencyColors.border,
              }}
            >
              <UrgencyIcon level={notice.urgencyLevel} urgency={notice.urgency} size={9} />
              <Text
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: urgencyColors.text }}
              >
                {getUrgencyLabel(notice.urgencyLevel, notice.urgency)}
              </Text>
            </View>

            {/* Location tag */}
            {notice.locationName || notice.latitude ? (
              <View className="flex-row items-center gap-1.5 bg-orange-50 self-start px-2 py-1 rounded-md">
                <MapPin size={12} color={THEME_COLORS.secondaryContainer} />
                <Text className="text-[10px] font-bold text-orange-500">
                  {notice.locationName || 'Location Provided'}
                </Text>
                {dist ? (
                  <Text className="text-[10px] text-gray-400 ml-1">• {dist}km away</Text>
                ) : null}
              </View>
            ) : null}

            <Text className="text-gray-500 text-sm leading-relaxed" numberOfLines={2}>
              {notice.description}
            </Text>

            {/* Author row */}
            <View className="flex-row items-center justify-between pt-2 border-t" style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}>
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border" style={SURFACE_BORDER_STYLE}>
                  <Image
                    source={{
                      uri:
                        notice.authorImage ||
                        `https://picsum.photos/seed/${notice.authorId}/50/50`,
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text className="text-xs font-bold text-gray-800">{notice.authorName}</Text>
                  <Text className="text-[10px] text-gray-400">
                    {notice.authorRole || 'MEMBER'} • {formatDate(notice.timestamp)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                {isEmergency ? (
                  <TouchableOpacity
                    className="p-2 rounded-full bg-red-50"
                    activeOpacity={0.8}
                  >
                    <Siren size={16} color={THEME_COLORS.errorStrong} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  className="p-2 rounded-full bg-surface-container-low"
                  activeOpacity={0.8}
                  onPress={() => handleOpenContextChat(notice)}
                >
                  <MessageSquare size={16} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [activeMenuId, userProfile?.id, currentCommunity?.userRole, baseLat, baseLng, highlightedNoticeId]
  );

  const renderListing = useCallback(
    ({ item: post }: { item: CommunityNotice }) => {
      const urgencyColors = getUrgencyColors(post.urgency);
      const isEmergency = post.urgency === 'emergency';
      const charity = charities.find(c => c.id === post.charityId);
      const isOwner = post.authorId === userProfile?.id;
      const isAdmin = currentCommunity?.userRole === 'ADMIN';
      const isSold = String(post.status || '').toUpperCase() === 'SOLD';
      const isMarkingSold = markingSoldId === post.id;
      const initialQuantity = Math.max(1, Number(post.initialQuantity ?? 1));
      const soldQuantity = Math.max(0, Number(post.soldQuantity ?? 0));
      const remainingQuantity = Math.max(0, Number(post.remainingQuantity ?? (initialQuantity - soldQuantity)));
      const saleActionLabel = remainingQuantity > 1 ? 'Record Sale' : 'Mark as Sold';

      return (
        <View className="bg-surface-container-low rounded-[2rem] overflow-hidden border mb-6" style={{ ...CARD_DEPTH_HERO, ...SURFACE_BORDER_STYLE }}>
          {/* Map (emergency) or image */}
          {isEmergency && post.latitude && post.longitude ? (
            <View className="w-full aspect-video overflow-hidden border-b" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
              <MapView {...defaultMapViewProps}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: post.latitude,
                  longitude: post.longitude,
                  latitudeDelta: 0.08,
                  longitudeDelta: 0.08,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: post.latitude, longitude: post.longitude }}
                  pinColor={THEME_COLORS.errorStrong}
                />
              </MapView>
              <View className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full">
                <Text className="text-white text-[10px] font-bold uppercase tracking-widest">
                  Live Situation
                </Text>
              </View>
            </View>
          ) : post.postsImage ? (
            <View className="w-full aspect-video overflow-hidden border-b" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
              <Image
                source={{ uri: resolveMediaUrl(post.postsImage) }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          ) : null}

          <View className="p-6 gap-6">
            {/* Title + menu */}
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-3 flex-wrap">
                  {post.urgency && post.urgency !== 'normal' ? (
                    <View
                      className="px-3 py-1 rounded-full border flex-row items-center gap-1"
                      style={{
                        backgroundColor: urgencyColors.bg,
                        borderColor: urgencyColors.border,
                      }}
                    >
                      <UrgencyIcon urgency={post.urgency} size={10} />
                      <Text
                        className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: urgencyColors.text }}
                      >
                        {post.urgency}
                      </Text>
                    </View>
                  ) : null}
                  {post.isCommunityPick ? (
                    <View className="bg-orange-500 px-3 py-1 rounded-full flex-row items-center gap-1">
                      <View className="w-1.5 h-1.5 bg-surface-container-low rounded-full" />
                      <Text className="text-white text-[10px] font-bold uppercase tracking-widest">
                        Pick
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-2xl font-black text-primary leading-tight" numberOfLines={2}>
                  {post.title}
                </Text>
              </View>

              <View className="relative">
                <TouchableOpacity
                  onPress={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                  className="p-2"
                  activeOpacity={0.8}
                >
                  <MoreVertical size={20} color={THEME_COLORS.neutralTextSoft} />
                </TouchableOpacity>
                {activeMenuId === post.id && (
                  <View
                    className="absolute right-0 top-10 w-48 bg-surface-container-low rounded-2xl border py-2 z-50"
                    style={{ ...createShadow(THEME_COLORS.black, 0, 0, 0.1, 12, 8), ...SURFACE_BORDER_STYLE }}
                  >
                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveMenuId(null);
                          router.push({ pathname: '/create-post', params: { postId: post.id } });
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <Pencil size={16} color={THEME_COLORS.primary} />
                        <Text className="text-primary text-sm font-bold">Edit Listing</Text>
                      </TouchableOpacity>
                    )}
                    {(isOwner || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => {
                          setPostToDelete(post.id);
                          setActiveMenuId(null);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <AlertTriangle size={16} color={THEME_COLORS.errorStrong} />
                        <Text className="text-red-600 text-sm font-bold">Delete Listing</Text>
                      </TouchableOpacity>
                    )}
                    {isOwner && !isSold && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveMenuId(null);
                          handleMarkListingSold(post);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                        disabled={isMarkingSold}
                      >
                        <CheckCircle2 size={16} color={THEME_COLORS.successStrongAlt} />
                        <Text className="text-green-600 text-sm font-bold">
                          {isMarkingSold ? 'Saving...' : saleActionLabel}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!isOwner && (
                      <TouchableOpacity
                        onPress={async () => {
                          setActiveMenuId(null);
                          await handleShareListing(post);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <Share2 size={16} color={THEME_COLORS.neutralTextSubtle} />
                        <Text className="text-gray-500 text-sm font-bold">Share</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            <Text className="text-gray-500 font-medium text-sm leading-relaxed">
              {post.description}
            </Text>

            {/* Price block */}
            {post.type === 'listing' && post.price !== undefined ? (
              <View className="bg-surface-container p-5 rounded-2xl border gap-4" style={{ ...CARD_DEPTH_SOFT, ...SURFACE_BORDER_STYLE }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-6">
                    <View>
                      <Text className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">
                        Local Price
                      </Text>
                      <View className="flex-row items-baseline gap-0.5">
                        <Text className="text-2xl font-black text-orange-500 leading-none">
                          R{(post.communityPrice || post.price).toLocaleString()}
                        </Text>
                        <Text className="text-orange-400 font-bold text-xs">.00</Text>
                      </View>
                    </View>
                    {post.publicPrice &&
                      post.publicPrice > (post.communityPrice || post.price) ? (
                      <View className="opacity-50">
                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Public Price
                        </Text>
                        <Text className="text-lg font-bold text-gray-400 leading-none line-through">
                          R{post.publicPrice.toLocaleString()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {post.charityId ? (
                    <View className="items-end">
                      <View className="flex-row items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-lg mb-1">
                        <Heart size={12} color={THEME_COLORS.secondaryContainer} fill={THEME_COLORS.secondaryContainer} />
                        <Text className="text-[9px] font-black text-orange-500 uppercase tracking-wider">
                          {charity?.name || 'Charity Impact'}
                        </Text>
                      </View>
                      <Text className="text-[10px] font-bold text-gray-400">
                        Contribution: R{post.charityAmount?.toFixed(2) || '0.00'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Location */}
            {post.locationName ? (
              <View className="flex-row items-center gap-2 bg-orange-50 self-start px-4 py-2 rounded-full border border-orange-100">
                <MapPin size={14} color={THEME_COLORS.secondaryContainer} />
                <Text className="text-[11px] font-extrabold text-orange-500" numberOfLines={1}>
                  {post.locationName}
                </Text>
              </View>
            ) : null}

            {/* Author row */}
            <View className="flex-row items-center justify-between pt-4 border-t" style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}>
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border" style={SURFACE_BORDER_STYLE}>
                  <Image
                    source={{
                      uri:
                        post.authorImage ||
                        `https://picsum.photos/seed/${post.authorId}/100/100`,
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text className="text-sm font-bold text-primary">{post.authorName}</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={12} color={THEME_COLORS.neutralTextSoft} />
                    <Text className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {new Date(post.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                <TouchableOpacity className="p-2" activeOpacity={0.8}>
                  <Heart size={20} color={THEME_COLORS.neutralTextSoft} />
                </TouchableOpacity>
                <TouchableOpacity className="p-2" activeOpacity={0.8} onPress={() => handleOpenContextChat(post)}>
                  <MessageSquare size={20} color={THEME_COLORS.neutralTextSoft} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [
      activeMenuId,
      userProfile?.id,
      currentCommunity?.userRole,
      charities,
      handleOpenContextChat,
      handleMarkListingSold,
      handleShareListing,
      markingSoldId,
      router,
    ]
  );

  const filterTabs = [
    { id: 'all', label: 'All Feed' },
    { id: 'listing', label: 'Listings' },
    { id: 'notice', label: 'Notices' },
  ] as const;

  // Combined feed data for FlatList
  type FeedSection =
    | { kind: 'noticeHeader' }
    | { kind: 'notice'; item: CommunityNotice }
    | { kind: 'divider' }
    | { kind: 'listingHeader' }
    | { kind: 'listing'; item: CommunityNotice }
    | { kind: 'emptyListings' };

  const feedData = useMemo(() => {
    const data: FeedSection[] = [];

    if (filter === 'all' || filter === 'notice') {
      if (notices.length > 0) {
        data.push({ kind: 'noticeHeader' });
        notices.forEach(n => data.push({ kind: 'notice', item: n }));
      }
    }
    if (filter === 'all' && notices.length > 0 && listings.length > 0) {
      data.push({ kind: 'divider' });
    }
    if (filter === 'all' || filter === 'listing') {
      data.push({ kind: 'listingHeader' });
      if (listings.length > 0) {
        listings.forEach(l => data.push({ kind: 'listing', item: l }));
      } else {
        data.push({ kind: 'emptyListings' });
      }
    }

    return data;
  }, [filter, listings, notices]);

  useEffect(() => {
    if (!initialNoticeId || notices.length === 0) return;

    const targetNotice = notices.find((notice) => notice.id === initialNoticeId);
    if (!targetNotice) return;

    setFilter('notice');
    setHighlightedNoticeId(initialNoticeId);

    const timer = setTimeout(() => {
      const targetIndex = feedData.findIndex(
        (item) => item.kind === 'notice' && item.item.id === initialNoticeId,
      );

      if (targetIndex >= 0) {
        feedListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.15,
        });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [feedData, initialNoticeId, notices]);

  useEffect(() => {
    if (!highlightedNoticeId) return;
    const timer = setTimeout(() => setHighlightedNoticeId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedNoticeId]);

  const renderFeedItem = ({ item }: { item: FeedSection }) => {
    switch (item.kind) {
      case 'noticeHeader':
        return (
          <View className="flex-row items-center justify-between px-2 mb-4 mt-2">
            <View className="flex-row items-center gap-2">
              <Siren size={16} color={THEME_COLORS.errorStrong} />
              <Text className="text-sm font-black text-primary uppercase tracking-widest">
                Community Notices
              </Text>
            </View>
            <Text className="text-[10px] font-bold text-gray-400">Read Only</Text>
          </View>
        );
      case 'notice':
        return renderNotice({ item: item.item });
      case 'divider':
        return <View className="h-px bg-surface-container my-6" />;
      case 'listingHeader':
        return (
          <View className="flex-row items-center gap-2 px-2 mb-4 mt-2">
            <Tag size={16} color={THEME_COLORS.secondaryContainer} />
            <Text className="text-sm font-black text-primary uppercase tracking-widest">
              Community Listing
            </Text>
          </View>
        );
      case 'listing':
        return renderListing({ item: item.item });
      case 'emptyListings':
        return (
          <View className="items-center justify-center py-20 gap-4">
            <View className="w-20 h-20 bg-surface-container rounded-full items-center justify-center" style={CARD_DEPTH_SOFT}>
              <Tag size={40} color={THEME_COLORS.neutralBorderMuted} />
            </View>
            <Text className="text-lg font-bold text-primary">No listings found</Text>
            <Text className="text-sm text-gray-400 text-center max-w-[240px]">
              Try adjusting your search query to find what you're looking for.
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
                <Text className="text-orange-500 font-bold text-sm">Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <StatusBar barStyle="dark-content" />

      {/* Sub-header */}
      <View
        className="border-b px-6 py-4 gap-4"
        style={{ backgroundColor: APP_SHELL_COLORS.body, borderBottomColor: THEME_COLORS.neutralBorderSoft }}
      >
        {/* Search */}
        <View className="flex-row items-center bg-surface-container rounded-2xl px-4 py-3 gap-3" style={CARD_DEPTH_SOFT}>
          <Search size={16} color={THEME_COLORS.neutralTextSoft} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search community listings..."
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            className="flex-1 text-sm font-medium text-gray-800"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
              <X size={16} color={THEME_COLORS.neutralTextSoft} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
          {filterTabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setFilter(tab.id)}
              className={[
                'px-4 py-1.5 rounded-full border mr-2',
                filter === tab.id
                  ? 'bg-primary border-primary'
                  : 'bg-surface-container',
              ].join(' ')}
              style={filter === tab.id ? undefined : SURFACE_BORDER_STYLE}
              activeOpacity={0.8}
            >
              <Text
                className={[
                  'text-[10px] font-black uppercase tracking-widest',
                  filter === tab.id ? 'text-white' : 'text-gray-400',
                ].join(' ')}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Feed */}
      <FlatList
        ref={feedListRef}
        data={feedData}
        keyExtractor={(item, index) => {
          if (item.kind === 'notice' || item.kind === 'listing') return item.item.id;
          return `${item.kind}-${index}`;
        }}
        renderItem={renderFeedItem}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            feedListRef.current?.scrollToOffset({
              offset: Math.max(0, index * 220),
              animated: true,
            });
          }, 120);
        }}
        contentContainerStyle={{ paddingHorizontal: SPACE.s24, paddingTop: SPACE.s24, paddingBottom: SPACE.s120 }}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/create-post')}
        className="absolute bottom-28 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center"
        style={createShadow(PRIMARY, 0, 0, 0.4, 12, 8)}
        activeOpacity={0.85}
      >
        <Plus size={32} color={THEME_COLORS.white} />
      </TouchableOpacity>

      {/* Full-screen map modal */}
      <Modal
        visible={!!mapPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapPost(null)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
          <View className="flex-row items-center justify-between px-6 py-4 border-b" style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}>
            <View>
              <Text className="font-bold text-gray-800 text-base" numberOfLines={1}>
                {mapPost?.title}
              </Text>
              {mapPost?.locationName ? (
                <Text className="text-sm text-gray-400">{mapPost.locationName}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setMapPost(null)}
              className="p-2 rounded-full bg-surface-container"
              activeOpacity={0.8}
            >
              <X size={20} color={THEME_COLORS.neutralTextEmphasis} />
            </TouchableOpacity>
          </View>
          {mapPost?.latitude && mapPost?.longitude ? (
            <MapView {...defaultMapViewProps}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: mapPost.latitude,
                longitude: mapPost.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker
                coordinate={{ latitude: mapPost.latitude, longitude: mapPost.longitude }}
                title={mapPost.title}
                description={mapPost.locationName}
                pinColor={
                  mapPost.urgency === 'emergency' || mapPost.urgencyLevel === 'emergency'
                    ? THEME_COLORS.errorStrong
                    : THEME_COLORS.warning
                }
              />
              <Circle
                center={{ latitude: mapPost.latitude, longitude: mapPost.longitude }}
                radius={10000}
                strokeColor={
                  mapPost.urgency === 'emergency' || mapPost.urgencyLevel === 'emergency'
                    ? THEME_COLORS.errorStrong
                    : THEME_COLORS.warning
                }
                fillColor={
                  mapPost.urgency === 'emergency' || mapPost.urgencyLevel === 'emergency'
                    ? THEME_COLORS.alias_rgba_220_38_38_0_05
                    : THEME_COLORS.alias_rgba_217_119_6_0_05
                }
                strokeWidth={1}
              />
            </MapView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <RecordSaleModal
        visible={Boolean(saleListing)}
        listingTitle={saleListing?.title || 'Listing'}
        charityName={saleListing?.charityId ? charities.find((c) => c.id === saleListing.charityId)?.name || null : null}
        quantityType={saleListing?.quantityType}
        unitPrice={Number(saleListing?.communityPrice ?? saleListing?.price ?? 0)}
        unitCatAmount={Number(saleListing?.charityAmount ?? 0)}
        remainingQuantity={Math.max(
          1,
          Number(
            saleListing?.remainingQuantity ??
              (Math.max(1, Number(saleListing?.initialQuantity ?? 1)) -
                Math.max(0, Number(saleListing?.soldQuantity ?? 0)))
          )
        )}
        loading={markingSoldId === saleListing?.id}
        onClose={() => setSaleListing(null)}
        onConfirm={async (quantity) => {
          if (!saleListing) return;
          setMarkingSoldId(saleListing.id);
          try {
            const result = await markPostSold(saleListing.id, quantity);
            Alert.alert(
              'Listing updated',
              result.catTriggered
                ? `Sale recorded. CAT recorded: R${Number(result.catAmount || 0).toFixed(2)}${result.pooledToCharity ? ' (pooled to charity).' : '.'}`
                : 'Sale recorded.'
            );
            setSaleListing(null);
          } catch (error: any) {
            const remaining = Number(error?.response?.data?.remainingQuantity ?? NaN);
            if (Number.isFinite(remaining)) {
              Alert.alert('Unable to record sale', `Only ${remaining} item(s) remaining. Please try again.`);
            } else {
              Alert.alert('Unable to record sale', 'Please try again.');
            }
          } finally {
            setMarkingSoldId(null);
          }
        }}
      />
    </View>
  );
}
