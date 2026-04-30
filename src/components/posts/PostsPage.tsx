import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useCallback } from 'react';
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
} from 'lucide-react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useFirebase } from '../../context/FirebaseContext';
import type { CommunityNotice } from '../../types';

const PRIMARY = '#0d3d47';

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
      return { text: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    case 'warning':
      return { text: '#d97706', bg: '#fffbeb', border: '#fcd34d' };
    case 'info':
      return { text: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    case 'general':
      return { text: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    default:
      return { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  }
}

function getPostBorderColor(post: CommunityNotice): string {
  if (post.type !== 'notice') return '#e5e7eb';
  const urgency =
    post.urgency_level ||
    (post.urgency === 'high' ? 'warning' : post.urgency === 'normal' ? 'info' : post.urgency === 'low' ? 'general' : post.urgency);
  switch (urgency) {
    case 'emergency': return '#fca5a5';
    case 'warning': return '#fcd34d';
    case 'info': return '#93c5fd';
    case 'general': return '#6ee7b7';
    default: return '#e5e7eb';
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

export default function PostsPage() {
  const router = useRouter();
    const { posts, currentCommunity, removePost, charities, startConversation, setActiveConversation, members } = useCommunity();
    const { user } = useFirebase();
  const [filter, setFilter] = useState<'all' | 'listing' | 'notice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [mapPost, setMapPost] = useState<CommunityNotice | null>(null);

  const baseLat = currentCommunity?.coverageArea?.latitude;
  const baseLng = currentCommunity?.coverageArea?.longitude;

  const notices = posts
    .filter(p => p.type === 'notice')
    .sort((a, b) => {
      const pa = getUrgencyPriority(a.urgency_level, a.urgency);
      const pb = getUrgencyPriority(b.urgency_level, b.urgency);
      if (pa !== pb) return pb - pa;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const listings = posts
    .filter(p => p.type === 'listing')
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

  const handleOpenContextChat = useCallback(
    async (post: CommunityNotice) => {
      const isEmergencyNotice =
        post.type === 'notice' &&
        (post.urgency === 'emergency' ||
          post.urgency_level === 'emergency' ||
          post.priority === 'emergency');

      if (isEmergencyNotice) {
        router.push(`/emergency/${post.id}`);
        return;
      }

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
            type: post.type,
            image: post.posts_image,
            author: post.authorName,
            authorImage: post.authorImage,
            authorId: post.author_id,
            authorRole: post.authorRole,
            location: post.locationName,
            urgency: post.urgency,
            urgencyLevel: post.urgency_level,
            description: post.description,
            price: post.type === 'listing' && post.price !== undefined ? `R${(post.community_price || post.price).toLocaleString()}` : undefined,
          },
        });
        setActiveConversation(conversationId);
        router.push(`/chat/${conversationId}`);
      } catch (error) {
        console.error('Failed to open contextual chat:', error);
      }
    },
    [currentCommunity?.id, router, setActiveConversation, startConversation, user?.uid, members]
  );

  const renderNotice = useCallback(
    ({ item: notice }: { item: CommunityNotice }) => {
      const urgencyColors = getUrgencyColors(notice.urgency_level, notice.urgency);
      const borderColor = getPostBorderColor(notice);
      const isEmergency =
        notice.urgency === 'emergency' || notice.urgency_level === 'emergency';
      const isWarning = notice.urgency_level === 'warning' || notice.urgency === 'high';
      const showMap =
        (isEmergency || isWarning) && notice.latitude && notice.longitude;
      const dist = calculateDistance(notice.latitude, notice.longitude, baseLat, baseLng);
      const isOwner = notice.author_id === user?.uid;
      const isAdmin = currentCommunity?.userRole === 'Admin';

      return (
        <View
          className="rounded-2xl bg-white overflow-hidden mb-3"
          style={{ borderWidth: 1, borderColor, shadowColor: borderColor, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}
        >
          {/* Inline map for emergency/warning */}
          {showMap ? (
            <TouchableOpacity
              onPress={() => setMapPost(notice)}
              activeOpacity={0.9}
              style={{ height: 160, overflow: 'hidden', borderBottomWidth: 1, borderColor: '#f3f4f6' }}
            >
              <MapView
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
                  pinColor={isEmergency ? '#dc2626' : '#d97706'}
                />
                <Circle
                  center={{ latitude: notice.latitude!, longitude: notice.longitude! }}
                  radius={10000}
                  strokeColor={isEmergency ? '#dc2626' : '#d97706'}
                  fillColor={isEmergency ? 'rgba(220,38,38,0.05)' : 'rgba(217,119,6,0.05)'}
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
          {notice.posts_image && !showMap ? (
            <View className="w-full aspect-video border-b border-gray-100 overflow-hidden">
              <Image
                source={{ uri: notice.posts_image }}
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
                  className="p-2 rounded-full bg-gray-100"
                  activeOpacity={0.8}
                >
                  <MoreVertical size={16} color="#9ca3af" />
                </TouchableOpacity>
                {activeMenuId === notice.id && (
                  <View
                    className="absolute right-0 top-10 w-48 bg-white rounded-2xl border border-gray-100 py-2 z-50"
                    style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 }}
                  >
                    {(isOwner || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => {
                          setPostToDelete(notice.id);
                          setActiveMenuId(null);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <AlertTriangle size={16} color="#dc2626" />
                        <Text className="text-red-600 text-sm font-bold">Delete Notice</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setActiveMenuId(null)}
                      className="flex-row items-center gap-2 px-4 py-2"
                      activeOpacity={0.8}
                    >
                      <Share2 size={16} color="#6b7280" />
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
              <UrgencyIcon level={notice.urgency_level} urgency={notice.urgency} size={9} />
              <Text
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: urgencyColors.text }}
              >
                {getUrgencyLabel(notice.urgency_level, notice.urgency)}
              </Text>
            </View>

            {/* Location tag */}
            {notice.locationName || notice.latitude ? (
              <View className="flex-row items-center gap-1.5 bg-orange-50 self-start px-2 py-1 rounded-md">
                <MapPin size={12} color="#f97316" />
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
            <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <Image
                    source={{
                      uri:
                        notice.authorImage ||
                        `https://picsum.photos/seed/${notice.author_id}/50/50`,
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text className="text-xs font-bold text-gray-800">{notice.authorName}</Text>
                  <Text className="text-[10px] text-gray-400">
                    {notice.authorRole || 'Member'} • {formatDate(notice.timestamp)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                {isEmergency ? (
                  <TouchableOpacity
                    className="p-2 rounded-full bg-red-50"
                    activeOpacity={0.8}
                  >
                    <Siren size={16} color="#dc2626" />
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
    [activeMenuId, user?.uid, currentCommunity?.userRole, baseLat, baseLng]
  );

  const renderListing = useCallback(
    ({ item: post }: { item: CommunityNotice }) => {
      const urgencyColors = getUrgencyColors(post.urgency);
      const isEmergency = post.urgency === 'emergency';
      const charity = charities.find(c => c.id === post.charityId);
      const isOwner = post.author_id === user?.uid;
      const isAdmin = currentCommunity?.userRole === 'Admin';

      return (
        <View className="bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 mb-6 shadow-sm">
          {/* Map (emergency) or image */}
          {isEmergency && post.latitude && post.longitude ? (
            <View className="w-full aspect-video overflow-hidden border-b border-gray-100">
              <MapView
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
                  pinColor="#dc2626"
                />
              </MapView>
              <View className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full">
                <Text className="text-white text-[10px] font-bold uppercase tracking-widest">
                  Live Situation
                </Text>
              </View>
            </View>
          ) : post.posts_image ? (
            <View className="w-full aspect-video overflow-hidden border-b border-gray-100">
              <Image
                source={{ uri: post.posts_image }}
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
                      <View className="w-1.5 h-1.5 bg-white rounded-full" />
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
                  <MoreVertical size={20} color="#9ca3af" />
                </TouchableOpacity>
                {activeMenuId === post.id && (
                  <View
                    className="absolute right-0 top-10 w-48 bg-white rounded-2xl border border-gray-100 py-2 z-50"
                    style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 }}
                  >
                    {(isOwner || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => {
                          setPostToDelete(post.id);
                          setActiveMenuId(null);
                        }}
                        className="flex-row items-center gap-2 px-4 py-2"
                        activeOpacity={0.8}
                      >
                        <AlertTriangle size={16} color="#dc2626" />
                        <Text className="text-red-600 text-sm font-bold">Delete Post</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setActiveMenuId(null)}
                      className="flex-row items-center gap-2 px-4 py-2"
                      activeOpacity={0.8}
                    >
                      <Share2 size={16} color="#6b7280" />
                      <Text className="text-gray-500 text-sm font-bold">Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <Text className="text-gray-500 font-medium text-sm leading-relaxed">
              {post.description}
            </Text>

            {/* Price block */}
            {post.type === 'listing' && post.price !== undefined ? (
              <View className="bg-white p-5 rounded-2xl border border-gray-100 gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-6">
                    <View>
                      <Text className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">
                        Local Price
                      </Text>
                      <View className="flex-row items-baseline gap-0.5">
                        <Text className="text-2xl font-black text-orange-500 leading-none">
                          R{(post.community_price || post.price).toLocaleString()}
                        </Text>
                        <Text className="text-orange-400 font-bold text-xs">.00</Text>
                      </View>
                    </View>
                    {post.isPublic &&
                      post.public_price &&
                      post.public_price > (post.community_price || post.price) ? (
                      <View className="opacity-50">
                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Public Price
                        </Text>
                        <Text className="text-lg font-bold text-gray-400 leading-none line-through">
                          R{post.public_price.toLocaleString()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {post.isPublic && post.charityId ? (
                    <View className="items-end">
                      <View className="flex-row items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-lg mb-1">
                        <Heart size={12} color="#f97316" fill="#f97316" />
                        <Text className="text-[9px] font-black text-orange-500 uppercase tracking-wider">
                          {charity?.name || 'Charity Impact'}
                        </Text>
                      </View>
                      <Text className="text-[10px] font-bold text-gray-400">
                        Contribution: R{post.charity_amount?.toFixed(2) || '0.00'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Location */}
            {post.locationName ? (
              <View className="flex-row items-center gap-2 bg-orange-50 self-start px-4 py-2 rounded-full border border-orange-100">
                <MapPin size={14} color="#f97316" />
                <Text className="text-[11px] font-extrabold text-orange-500" numberOfLines={1}>
                  {post.locationName}
                </Text>
              </View>
            ) : null}

            {/* Author row */}
            <View className="flex-row items-center justify-between pt-4 border-t border-gray-100">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
                  <Image
                    source={{
                      uri:
                        post.authorImage ||
                        `https://picsum.photos/seed/${post.author_id}/100/100`,
                    }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text className="text-sm font-bold text-primary">{post.authorName}</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {new Date(post.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                <TouchableOpacity className="p-2" activeOpacity={0.8}>
                  <Heart size={20} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2" activeOpacity={0.8} onPress={() => handleOpenContextChat(post)}>
                  <MessageSquare size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [activeMenuId, user?.uid, currentCommunity?.userRole, charities, handleOpenContextChat]
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

  const feedData: FeedSection[] = [];

  if (filter === 'all' || filter === 'notice') {
    if (notices.length > 0) {
      feedData.push({ kind: 'noticeHeader' });
      notices.forEach(n => feedData.push({ kind: 'notice', item: n }));
    }
  }
  if (filter === 'all' && notices.length > 0 && listings.length > 0) {
    feedData.push({ kind: 'divider' });
  }
  if (filter === 'all' || filter === 'listing') {
    feedData.push({ kind: 'listingHeader' });
    if (listings.length > 0) {
      listings.forEach(l => feedData.push({ kind: 'listing', item: l }));
    } else {
      feedData.push({ kind: 'emptyListings' });
    }
  }

  const renderFeedItem = ({ item }: { item: FeedSection }) => {
    switch (item.kind) {
      case 'noticeHeader':
        return (
          <View className="flex-row items-center justify-between px-2 mb-4 mt-2">
            <View className="flex-row items-center gap-2">
              <Siren size={16} color="#dc2626" />
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
        return <View className="h-px bg-gray-100 my-6" />;
      case 'listingHeader':
        return (
          <View className="flex-row items-center gap-2 px-2 mb-4 mt-2">
            <Tag size={16} color="#f97316" />
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
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center">
              <Tag size={40} color="#d1d5db" />
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
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Sub-header */}
      <View className="bg-white border-b border-gray-100 px-6 py-4 gap-4">
        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3 gap-3">
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search community listings..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-sm font-medium text-gray-800"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
              <X size={16} color="#9ca3af" />
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
                  : 'bg-gray-100 border-gray-200',
              ].join(' ')}
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
        data={feedData}
        keyExtractor={(item, index) => {
          if (item.kind === 'notice' || item.kind === 'listing') return item.item.id;
          return `${item.kind}-${index}`;
        }}
        renderItem={renderFeedItem}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/create-post')}
        className="absolute bottom-28 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center"
        style={{ shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
        activeOpacity={0.85}
      >
        <Plus size={32} color="#fff" />
      </TouchableOpacity>

      {/* Full-screen map modal */}
      <Modal
        visible={!!mapPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapPost(null)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
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
              className="p-2 rounded-full bg-gray-100"
              activeOpacity={0.8}
            >
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          {mapPost?.latitude && mapPost?.longitude ? (
            <MapView
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
                  mapPost.urgency === 'emergency' || mapPost.urgency_level === 'emergency'
                    ? '#dc2626'
                    : '#d97706'
                }
              />
              <Circle
                center={{ latitude: mapPost.latitude, longitude: mapPost.longitude }}
                radius={10000}
                strokeColor={
                  mapPost.urgency === 'emergency' || mapPost.urgency_level === 'emergency'
                    ? '#dc2626'
                    : '#d97706'
                }
                fillColor={
                  mapPost.urgency === 'emergency' || mapPost.urgency_level === 'emergency'
                    ? 'rgba(220,38,38,0.05)'
                    : 'rgba(217,119,6,0.05)'
                }
                strokeWidth={1}
              />
            </MapView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
