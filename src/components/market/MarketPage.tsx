import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import {
  SlidersHorizontal,
  Map as MapIcon,
  List as ListIcon,
  Search,
  X,
  MessageSquare,
  MapPin,
  Clock,
  Heart,
} from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
import { BusinessCard } from './BusinessCard';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS_CATEGORIES } from '../../constants';
import { calculateDistance } from '../../lib/utils';
import { resolveMediaUrl } from '../../lib/config';
import { resolveActiveCharity } from '../../lib/activeCharity';
import type { UserBusiness } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 11,
  md: 12,
  body: 14,
  label: 13,
  title: 18,
  h3: 22,
  price: 28,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const LINE_HEIGHT = {
  title: 28,
  body: 22,
};
const SPACE = {
  zero: 0,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 20,
  s30: 30,
  s36: 36,
  s40: 40,
  s120: 120,
  imageHeight: 240,
};
const RADIUS = {
  md: 16,
  lg: 18,
  full: 999,
};
const LETTER_SPACING = {
  wide: 1,
};

const SURFACE_BORDER_STYLE = {
  borderColor: THEME_COLORS.neutralBorderSoft,
};

interface MarketBusiness {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  image?: string;
  description?: string;
  phone?: string;
  website?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  label?: string;
  labelType?: 'top-rated' | 'new';
  neighbors?: number;
  closingTime?: string;
  hasCall?: boolean;
  isExternal?: boolean;
  isFeatured?: boolean;
  distance: string;
  isExplicitlyLinked: boolean;
  isMemberBusiness: boolean;
  status: 'Open' | 'Closed';
}

const PRIMARY = THEME_COLORS.primary;

interface MarketPageProps {
  initialListingId?: string;
  initialBusinessId?: string;
}

export default function MarketPage({ initialListingId, initialBusinessId }: MarketPageProps) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const {
    currentCommunity,
    userBusinesses,
    posts,
    communityBusinesses,
    charities,
    startConversation,
    setActiveConversation,
    markPostSold,
  } = useCommunity();

  const [activeTab, setActiveTab] = useState<'featured' | 'listings' | 'businesses' | 'sold'>('businesses');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<(typeof listings)[0] | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [focusedBusinessId, setFocusedBusinessId] = useState<string | null>(null);

  const coverageArea = currentCommunity?.coverageArea;
  // Resolve the active community charity via the shared rule:
  //   catCycleActive ON  → admin-marked Featured charity is active
  //   catCycleActive OFF → CAT baseline charity is active
  const cycleFeaturedCharity = resolveActiveCharity(charities, currentCommunity ?? null).active;

  const listings = useMemo(() => {
    let l = posts.filter(p => p.type === 'listing');
    l.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.category || '').localeCompare(b.category || '');
    });
    return l;
  }, [posts]);

  const soldListings = useMemo(
    () => listings.filter((listing) => String(listing.status || '').toUpperCase() === 'SOLD'),
    [listings]
  );

  const activeListings = useMemo(
    () => listings.filter((listing) => String(listing.status || '').toUpperCase() !== 'SOLD'),
    [listings]
  );

  useEffect(() => {
    if (initialListingId && posts.length > 0) {
      const listing = posts.find(p => p.type === 'listing' && p.id === initialListingId);
      if (listing) {
        const isSold = String((listing as any).status || '').toUpperCase() === 'SOLD';
        setActiveTab(isSold ? 'sold' : 'listings');
        setSelectedListing(listing as any);
      }
    }
  }, [initialListingId, posts]);

  useEffect(() => {
    if (!initialBusinessId || (communityBusinesses || []).length === 0) return;
    const target = (communityBusinesses || []).find((b) => b.id === initialBusinessId);
    if (!target) return;
    setActiveTab('businesses');
    setViewMode('list');
    setSelectedCategory(null);
    setSearchQuery(target.name || '');
    setFocusedBusinessId(target.id);
  }, [initialBusinessId, communityBusinesses]);

  const handleOpenListingChat = useCallback(
    async (listing: (typeof listings)[0]) => {
      if (!userProfile?.id || !listing.authorId) return;

      try {
        const conversationId = await startConversation({
          participants: Array.from(new Set([userProfile?.id, listing.authorId])),
          type: 'listing',
          communityId: currentCommunity?.id,
          listingId: listing.id,
          metadata: {
            title: listing.title,
            type: 'listing',
            image: listing.postsImage,
            author: listing.authorName,
            authorImage: listing.authorImage,
            location: listing.locationName,
            description: listing.description,
            price: listing.price !== undefined ? `R${(listing.communityPrice || listing.price).toLocaleString()}` : undefined,
          },
        });
        setActiveConversation(conversationId);
        router.push(`/chat/${conversationId}`);
      } catch (error) {
        console.error('Failed to open listing chat:', error);
        Alert.alert('Chat unavailable', 'We could not open the conversation for this listing.');
      }
    },
    [currentCommunity?.id, router, setActiveConversation, startConversation, userProfile?.id]
  );

  const enabledCategories = useMemo(() => {
    if (!currentCommunity?.enabledCategories) return BUSINESS_CATEGORIES;
    return BUSINESS_CATEGORIES.filter(cat =>
      currentCommunity.enabledCategories!.includes(cat.id)
    );
  }, [currentCommunity?.enabledCategories]);

  const filteredBusinesses = useMemo((): MarketBusiness[] => {
    if (!coverageArea) return [];

    const internalBusinesses: MarketBusiness[] = (currentCommunity?.businesses || []).map(b => ({
      ...b,
      isExternal: false,
      isFeatured: b.isFeatured ?? true,
      isExplicitlyLinked: true,
      isMemberBusiness: false,
      status: (b.status as 'Open' | 'Closed') || 'Open',
      distance:
        b.latitude && b.longitude
          ? calculateDistance(coverageArea.latitude, coverageArea.longitude, b.latitude, b.longitude).toFixed(1) + ' km'
          : '0.0 km',
    }));

    // User and imported businesses are visible in the marketplace by default.
    const eligibleCommunityBusinesses = communityBusinesses || [];

    const allCommunityUserBusinesses: MarketBusiness[] = eligibleCommunityBusinesses.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      subcategory: b.subcategory,
      latitude: b.latitude,
      longitude: b.longitude,
      address: b.address,
      image: b.image,
      description: b.description,
      phone: b.contactPhone,
      website: undefined,
      isExternal: false,
      isFeatured: false,
      isMemberBusiness: b.source !== 'IMPORT',
      label: b.ownerId === userProfile?.id ? 'My Business' : undefined,
      labelType: 'new' as const,
      status: 'Open' as const,
      distance:
        calculateDistance(coverageArea.latitude, coverageArea.longitude, b.latitude, b.longitude).toFixed(1) + ' km',
      isExplicitlyLinked: true,
    }));

    let combined: MarketBusiness[] = [...allCommunityUserBusinesses, ...internalBusinesses];

    // Filter by coverage area
    combined = combined.filter(b => {
      if (b.isExplicitlyLinked) return true;
      if (b.latitude && b.longitude) {
        const dist = calculateDistance(coverageArea.latitude, coverageArea.longitude, b.latitude, b.longitude);
        return dist <= coverageArea.radius;
      }
      return true;
    });

    // Filter by category
    if (selectedCategory) {
      combined = combined.filter(b => {
        const cat = enabledCategories.find(c => c.id === selectedCategory);
        if (!cat) return b.category === selectedCategory;
        return b.category === cat.label || cat.types.includes(b.category.toLowerCase());
      });
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      combined = combined.filter(
        b =>
          b.name.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          (b.description && b.description.toLowerCase().includes(q))
      );
    }

    // Sort: member businesses first, then by distance
    combined.sort((a, b) => {
      if (focusedBusinessId) {
        if (a.id === focusedBusinessId && b.id !== focusedBusinessId) return -1;
        if (a.id !== focusedBusinessId && b.id === focusedBusinessId) return 1;
      }
      if (a.isMemberBusiness && !b.isMemberBusiness) return -1;
      if (!a.isMemberBusiness && b.isMemberBusiness) return 1;
      return parseFloat(a.distance || '0') - parseFloat(b.distance || '0');
    });

    if (activeTab === 'featured') return combined.filter(b => b.isFeatured);
    return combined;
  }, [
    currentCommunity,
    userBusinesses,
    communityBusinesses,
    activeTab,
    coverageArea,
    selectedCategory,
    searchQuery,
    enabledCategories,
    userProfile?.id,
    focusedBusinessId,
  ]);

  const renderBusiness = useCallback(
    ({ item: biz }: { item: MarketBusiness }) => (
      <View className="mb-4">
        <BusinessCard
          name={biz.name}
          distance={biz.distance}
          category={biz.category}
          status={biz.status}
          image={biz.image}
          iconBg={biz.iconBg}
          iconColor={biz.iconColor}
          label={biz.label || (biz.isExternal ? 'Suggest to Add' : undefined)}
          labelType={biz.labelType || (biz.isExternal ? 'new' : undefined)}
          neighbors={biz.neighbors}
          closingTime={biz.closingTime}
          hasCall={biz.hasCall}
          isMemberBusiness={biz.isMemberBusiness}
          phone={biz.phone}
          website={biz.website}
          description={biz.description}
          address={biz.address}
          onChat={
            biz.isMemberBusiness
              ? () => {
                  // Chat not wired in standalone tab — no-op for now
                }
              : undefined
          }
        />
      </View>
    ),
    [communityBusinesses]
  );

  const renderListing = useCallback(
    ({ item: listing }: { item: (typeof listings)[0] }) => {
      const charity = charities.find(c => c.id === listing.charityId);
      const isSold = String(listing.status || '').toUpperCase() === 'SOLD';
      const hasListingImage = typeof listing.postsImage === 'string' && listing.postsImage.trim().length > 0;
      const hasAuthorImage = typeof listing.authorImage === 'string' && listing.authorImage.trim().length > 0;
      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setSelectedListing(listing)}
          className="mb-4 bg-surface-container-low rounded-[2rem] overflow-hidden border shadow-sm"
          style={SURFACE_BORDER_STYLE}
        >
          {hasListingImage ? (
            <View className="w-full aspect-[4/3] overflow-hidden">
              <Image
                source={{ uri: resolveMediaUrl(listing.postsImage) }}
                className="w-full h-full"
                resizeMode="cover"
              />
              {listing.isCommunityPick && (
                <View className="absolute top-4 left-4 bg-orange-500 px-3 py-1 rounded-full flex-row items-center gap-1">
                  <View className="w-2 h-2 bg-surface-container-low rounded-full" />
                  <Text className="text-white text-[10px] font-bold uppercase tracking-widest">
                    Community Pick
                  </Text>
                </View>
              )}
              {/* Gradient overlay */}
              <View
                className="absolute bottom-0 left-0 right-0 h-32"
                style={{ backgroundColor: 'transparent' }}
                pointerEvents="none"
              />
              <View className="absolute bottom-4 left-4 right-4">
                <Text className="text-white text-xl font-bold leading-tight" numberOfLines={2}>
                  {listing.title}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Details */}
          <View className="p-4 gap-3">
            {!hasListingImage ? (
              <View className="gap-2">
                {listing.isCommunityPick ? (
                  <View className="self-start bg-orange-500 px-3 py-1 rounded-full flex-row items-center gap-1">
                    <View className="w-2 h-2 bg-surface-container-low rounded-full" />
                    <Text className="text-white text-[10px] font-bold uppercase tracking-widest">
                      Community Pick
                    </Text>
                  </View>
                ) : null}
                <Text className="text-primary text-xl font-bold leading-tight" numberOfLines={2}>
                  {listing.title}
                </Text>
              </View>
            ) : null}

            {/* Price row */}
            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">
                  Local Price
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-primary text-[28px] font-black">
                    R{(listing.communityPrice || listing.price || 0).toLocaleString()}
                  </Text>
                  <Text className="text-primary/60 font-bold text-sm">.00</Text>
                </View>
              </View>
              {listing.isPublic && listing.publicPrice ? (
                <View className="items-end">
                  <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Public Price
                  </Text>
                  <Text className="text-gray-400 font-bold text-lg line-through decoration-orange-400">
                    R{listing.publicPrice.toLocaleString()}
                  </Text>
                </View>
              ) : null}
            </View>

            {isSold ? (
              <View className="self-start bg-surface-container px-3 py-1 rounded-full">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Sold</Text>
              </View>
            ) : null}

            {/* Charity */}
            {listing.isPublic && listing.charityId ? (
              <View className="bg-surface-container p-3 rounded-2xl flex-row items-start gap-3 border" style={SURFACE_BORDER_STYLE}>
                <View className="bg-orange-50 p-2 rounded-full items-center justify-center">
                  <Heart size={20} color={THEME_COLORS.secondaryContainer} fill={THEME_COLORS.secondaryContainer} />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-primary font-bold text-sm">Charity Impact</Text>
                    <Text className="text-orange-500 font-black text-sm">
                      R{(listing.charityAmount || 0).toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-[11px] leading-relaxed">
                    {currentCommunity?.catCycleActive && cycleFeaturedCharity
                      ? `CAT pooled to ${cycleFeaturedCharity.name} during active charity cycle.`
                      : `Seller CAT earning via ${charity?.name || 'Local Charity'} for public sale.`}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Location */}
            {listing.locationName ? (
              <View className="flex-row items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 self-start">
                <MapPin size={14} color={THEME_COLORS.secondaryContainer} />
                <Text className="text-[11px] font-extrabold text-orange-500" numberOfLines={1}>
                  {listing.locationName}
                </Text>
              </View>
            ) : null}

            {/* Author row */}
            <View className="flex-row items-center justify-between pt-2 border-t" style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}>
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-surface-container overflow-hidden border" style={SURFACE_BORDER_STYLE}>
                  {hasAuthorImage ? (
                    <Image
                      source={{ uri: listing.authorImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-primary/10">
                      <Text className="text-primary font-bold text-xs">
                        {(listing.authorName || '?').trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </View>
                <View>
                  <Text className="text-gray-800 font-bold text-xs">
                    {listing.authorName || 'Artisan'}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={10} color={THEME_COLORS.neutralTextSoft} />
                    <Text className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {new Date(listing.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-surface-container items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => handleOpenListingChat(listing)}
                >
                  <MessageSquare size={20} color={PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Heart size={20} color={THEME_COLORS.secondaryContainer} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [charities, currentCommunity?.catCycleActive, cycleFeaturedCharity, handleOpenListingChat]
  );

  const handleMarkListingSold = useCallback(async (listing: (typeof listings)[0]) => {
    const isOwner = listing.authorId && userProfile?.id && listing.authorId === userProfile.id;
    if (!isOwner) return;

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
              setSelectedListing(null);
              Alert.alert(
                'Listing updated',
                result.catTriggered
                  ? `Sold marked. CAT recorded: R${Number(result.catAmount || 0).toFixed(2)}${result.pooledToCharity ? ' (pooled to charity).' : '.'}`
                  : 'Sold marked with no CAT trigger (local listing).'
              );
            } catch (error) {
              Alert.alert('Unable to mark sold', 'Please try again.');
            } finally {
              setMarkingSoldId(null);
            }
          },
        },
      ]
    );
  }, [markPostSold, userProfile?.id]);

  const ListingDetailModal = () => {
    if (!selectedListing) return null;

    const charity = selectedListing.charityId ? charities.find((item) => item.id === selectedListing.charityId) : null;
    const hasListingImage = typeof selectedListing.postsImage === 'string' && selectedListing.postsImage.trim().length > 0;
    const hasAuthorImage = typeof selectedListing.authorImage === 'string' && selectedListing.authorImage.trim().length > 0;
    const isOwner = selectedListing.authorId && userProfile?.id && selectedListing.authorId === userProfile.id;
    const isSold = String(selectedListing.status || '').toUpperCase() === 'SOLD';

    return (
      <Modal visible={!!selectedListing} transparent animationType="fade" onRequestClose={() => setSelectedListing(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_45 }}>
          <View className="bg-surface-container-low rounded-t-[32px] max-h-[88%] overflow-hidden">
            <ScrollView contentContainerStyle={{ paddingBottom: SPACE.s30 }}>
              {hasListingImage ? (
                <Image
                  source={{ uri: resolveMediaUrl(selectedListing.postsImage) }}
                  style={{ width: '100%', height: SPACE.imageHeight }}
                  resizeMode="cover"
                />
              ) : null}

              <View style={{ padding: SPACE.xxxl, gap: SPACE.xxl }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.lg }}>
                  <View style={{ flex: 1, gap: SPACE.sm }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
                      <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full, backgroundColor: THEME_COLORS.aliasHex_eef2ff }}>
                        <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.indigo, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
                          {selectedListing.category}
                        </Text>
                      </View>
                      {selectedListing.locationName ? (
                        <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full, backgroundColor: THEME_COLORS.aliasHex_fff7ed, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                          <MapPin size={TYPE_SCALE.md} color={THEME_COLORS.secondaryContainer} />
                          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.secondaryContainer }}>{selectedListing.locationName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: TYPE_SCALE.h3, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextStrong, lineHeight: LINE_HEIGHT.title }}>{selectedListing.title}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedListing(null)}
                    style={{ width: SPACE.s36, height: SPACE.s36, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSubtle }}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.lg, padding: SPACE.xl, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_79_70_229_0_12 }}>
                  <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSubtle, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>Community Price</Text>
                  <Text style={{ fontSize: TYPE_SCALE.price, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.indigo, marginTop: SPACE.xs }}>
                    R{(selectedListing.communityPrice || selectedListing.price || 0).toLocaleString()}
                  </Text>
                  {selectedListing.isPublic && selectedListing.publicPrice ? (
                    <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.sm }}>
                      Public price: R{selectedListing.publicPrice.toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ fontSize: TYPE_SCALE.body, lineHeight: LINE_HEIGHT.body, color: THEME_COLORS.neutralTextEmphasis }}>{selectedListing.description}</Text>

                {selectedListing.isPublic && charity ? (
                  <View style={{ backgroundColor: THEME_COLORS.aliasHex_fff7ed, borderRadius: RADIUS.lg, padding: SPACE.xl, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_249_115_22_0_18 }}>
                    <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.aliasHex_9a3412 }}>Charity contribution</Text>
                    <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.aliasHex_7c2d12, marginTop: SPACE.xs }}>
                      This listing supports {charity.name} with R{selectedListing.charityAmount?.toFixed(2) || '0.00'} per sale.
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
                  <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: SPACE.xxxl, overflow: 'hidden', backgroundColor: THEME_COLORS.neutralBorderSoft }}>
                    {hasAuthorImage ? (
                      <Image
                        source={{ uri: selectedListing.authorImage }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_COLORS.primaryTintSoft }}>
                        <Text style={{ fontSize: TYPE_SCALE.label, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>
                          {(selectedListing.authorName || '?').trim().charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text style={{ fontSize: TYPE_SCALE.label, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong }}>{selectedListing.authorName || 'Community Member'}</Text>
                    <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle }}>{new Date(selectedListing.timestamp).toLocaleDateString()}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenListingChat(selectedListing)}
                  style={{ backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.xl, alignItems: 'center' }}
                >
                  <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
                    Open Chat
                  </Text>
                </TouchableOpacity>

                {isOwner && !isSold ? (
                  <TouchableOpacity
                    onPress={() => handleMarkListingSold(selectedListing)}
                    disabled={markingSoldId === selectedListing.id}
                    style={{ backgroundColor: THEME_COLORS.warningStrong, borderRadius: RADIUS.md, paddingVertical: SPACE.xl, alignItems: 'center' }}
                  >
                    <Text style={{ color: THEME_COLORS.neutralTextStrong, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
                      {markingSoldId === selectedListing.id ? 'Marking...' : 'Mark as Sold'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const tabs = [
    { id: 'featured', label: 'Featured' },
    { id: 'listings', label: 'Listings' },
    { id: 'businesses', label: 'Businesses' },
    { id: 'sold', label: 'Sold' },
  ] as const;

  const headingText =
    activeTab === 'featured'
      ? 'Admin Picks'
      : activeTab === 'businesses'
      ? 'Community Businesses'
      : activeTab === 'sold'
      ? 'Sold Items'
      : 'Items for Sale';

  const subText =
    activeTab === 'businesses'
      ? `${filteredBusinesses.length} business${filteredBusinesses.length !== 1 ? 'es' : ''} in ${coverageArea?.locationName || currentCommunity?.name || 'your area'}`
      : activeTab === 'sold'
      ? `Showing ${soldListings.length} sold item${soldListings.length !== 1 ? 's' : ''} in ${coverageArea?.locationName || currentCommunity?.name || 'your area'}`
      : `Showing ${activeListings.length} listings in ${coverageArea?.locationName || currentCommunity?.name || 'your area'}`;

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <StatusBar barStyle="dark-content" />

      {/* Search + filters header */}
      <View
        className="px-5 pt-4 pb-2 gap-4 border-b"
        style={{ backgroundColor: APP_SHELL_COLORS.body, borderBottomColor: THEME_COLORS.neutralBorderSoft }}
      >
        {/* Search bar */}
        <View className="relative flex-row items-center bg-surface-container rounded-2xl px-4 py-3 gap-3">
          <Search size={16} color={THEME_COLORS.neutralTextSoft} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search businesses..."
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            className="flex-1 text-sm font-medium text-gray-800"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
              <X size={16} color={THEME_COLORS.neutralTextSoft} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            className={[
              'px-4 py-2 rounded-2xl border mr-2',
              !selectedCategory
                ? 'bg-primary border-primary'
                : 'bg-surface-container-low',
            ].join(' ')}
            style={!selectedCategory ? undefined : SURFACE_BORDER_STYLE}
            activeOpacity={0.8}
          >
            <Text
              className={[
                'text-xs font-bold whitespace-nowrap',
                !selectedCategory ? 'text-white' : 'text-gray-500',
              ].join(' ')}
            >
              All Categories
            </Text>
          </TouchableOpacity>
          {enabledCategories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              className={[
                'px-4 py-2 rounded-2xl border flex-row items-center gap-2 mr-2',
                selectedCategory === cat.id
                  ? 'bg-primary border-primary'
                  : 'bg-surface-container-low',
              ].join(' ')}
              style={selectedCategory === cat.id ? undefined : SURFACE_BORDER_STYLE}
              activeOpacity={0.8}
            >
              <Text className="text-sm">{cat.icon}</Text>
              <Text
                className={[
                  'text-xs font-bold',
                  selectedCategory === cat.id ? 'text-white' : 'text-gray-500',
                ].join(' ')}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabs + view toggle */}
      <View className="px-5 pt-4 pb-3 gap-4 bg-surface-container-low">
        <View className="flex-row items-center justify-between">
          {/* Tabs */}
          <View className="flex-row bg-surface-container p-1 rounded-full border" style={SURFACE_BORDER_STYLE}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-1.5 rounded-full',
                  activeTab === tab.id ? 'bg-primary' : '',
                ].join(' ')}
                activeOpacity={0.8}
              >
                <Text
                  className={[
                    'text-xs font-bold',
                    activeTab === tab.id ? 'text-white' : 'text-gray-500',
                  ].join(' ')}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* View toggle */}
          <View className="flex-row bg-surface-container p-1 rounded-full border" style={SURFACE_BORDER_STYLE}>
            <TouchableOpacity
              onPress={() => setViewMode('list')}
              className={[
                'p-1.5 rounded-full',
                viewMode === 'list' ? 'bg-primary' : '',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <ListIcon size={16} color={viewMode === 'list' ? THEME_COLORS.white : THEME_COLORS.neutralTextSoft} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('map')}
              className={[
                'p-1.5 rounded-full',
                viewMode === 'map' ? 'bg-primary' : '',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <MapIcon size={16} color={viewMode === 'map' ? THEME_COLORS.white : THEME_COLORS.neutralTextSoft} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Heading + filter badge */}
        <View className="flex-row justify-between items-end">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-primary">{headingText}</Text>
            <Text className="text-gray-400 text-sm opacity-70">{subText}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {selectedCategory && (
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                className="flex-row items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg"
                activeOpacity={0.8}
              >
                <X size={12} color={THEME_COLORS.secondaryContainer} />
                <Text className="text-orange-500 text-[10px] font-bold">
                  {enabledCategories.find(c => c.id === selectedCategory)?.label}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity className="flex-row items-center gap-1" activeOpacity={0.8}>
              <SlidersHorizontal size={16} color={THEME_COLORS.secondaryContainer} />
              <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                Filter
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'map' ? (
        <View className="flex-1 m-4 rounded-3xl overflow-hidden border" style={SURFACE_BORDER_STYLE}>
          {coverageArea ? (
            <MapView
              {...defaultMapViewProps}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: coverageArea.latitude,
                longitude: coverageArea.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {filteredBusinesses
                .filter(b => b.latitude && b.longitude)
                .map(biz => (
                  <Marker
                    key={biz.id}
                    coordinate={{ latitude: biz.latitude!, longitude: biz.longitude! }}
                    title={biz.name}
                    description={biz.category}
                    pinColor={biz.isMemberBusiness ? THEME_COLORS.aliasHex_9333ea : PRIMARY}
                  />
                ))}
            </MapView>
          ) : (
            <View className="flex-1 items-center justify-center bg-surface-container-low">
              <Text className="text-gray-400 text-sm">No coverage area configured</Text>
            </View>
          )}
        </View>
      ) : activeTab === 'businesses' || activeTab === 'featured' ? (
        <FlatList
          data={filteredBusinesses}
          keyExtractor={item => item.id}
          renderItem={renderBusiness}
          contentContainerStyle={{ paddingHorizontal: SPACE.xxxl, paddingTop: SPACE.sm, paddingBottom: SPACE.s120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-20 h-20 bg-surface-container rounded-full items-center justify-center">
                <SlidersHorizontal size={40} color={THEME_COLORS.neutralBorderMuted} />
              </View>
              <Text className="text-primary font-bold text-lg">No businesses found</Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                Try adjusting your search or category filter.
              </Text>
            </View>
          }
        />
      ) : (
        /* Listings/Sold tabs */
        <FlatList
          data={activeTab === 'sold' ? soldListings : activeListings}
          keyExtractor={item => item.id}
          renderItem={renderListing}
          contentContainerStyle={{ paddingHorizontal: SPACE.xxxl, paddingTop: SPACE.sm, paddingBottom: SPACE.s120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-20 h-20 bg-surface-container rounded-full items-center justify-center">
                <MapPin size={40} color={THEME_COLORS.neutralBorderMuted} />
              </View>
              <Text className="text-primary font-bold text-lg">
                {activeTab === 'sold' ? 'No sold items yet' : 'No listings yet'}
              </Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                {activeTab === 'sold'
                  ? 'Sold listings will appear here once items are marked as sold.'
                  : 'Community members haven\'t posted any listings yet.'}
              </Text>
            </View>
          }
        />
      )}
      <ListingDetailModal />
    </View>
  );
}
