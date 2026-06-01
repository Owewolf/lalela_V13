import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
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
  MessageSquare,
  MapPin,
  Clock,
  Heart,
  X,
} from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
import { BusinessCard } from './BusinessCard';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS_CATEGORIES } from '../../constants';
import { calculateDistance } from '../../lib/utils';
import { resolveActiveCharity } from '../../lib/activeCharity';
import type { UserBusiness } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import RecordSaleModal from './RecordSaleModal';
import { OpenExchangeBadge } from '../shared/OpenExchangeBadge';
import { ListingHeroMedia } from '../shared/ListingHeroMedia';
import { useTopicChatGate } from '../chat/TopicChatGateProvider';

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
  moderationStatus?: string;
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
    markPostSold,
  } = useCommunity();
  const { openTopicChat } = useTopicChatGate();

  const [activeTab, setActiveTab] = useState<'featured' | 'listings' | 'businesses' | 'sold'>('businesses');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<(typeof listings)[0] | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [saleListing, setSaleListing] = useState<(typeof listings)[0] | null>(null);
  const [focusedBusinessId, setFocusedBusinessId] = useState<string | null>(null);
  const [brokenListingAuthorImageIds, setBrokenListingAuthorImageIds] = useState<Record<string, true>>({});

  const markListingAuthorImageBroken = useCallback((listingId: string) => {
    setBrokenListingAuthorImageIds((prev) => (prev[listingId] ? prev : { ...prev, [listingId]: true }));
  }, []);

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
    () => listings.filter((listing) => {
      const initialQuantity = Math.max(1, Number((listing as any).initialQuantity ?? 1));
      const soldQuantity = Math.max(0, Number((listing as any).soldQuantity ?? 0));
      const remainingQuantity = Math.max(0, Number((listing as any).remainingQuantity ?? (initialQuantity - soldQuantity)));
      const isMarkedSold = String(listing.status || '').toUpperCase() === 'SOLD';
      return isMarkedSold || soldQuantity > 0 || remainingQuantity === 0;
    }),
    [listings]
  );

  const activeListings = useMemo(
    () => listings.filter((listing) => {
      const initialQuantity = Math.max(1, Number((listing as any).initialQuantity ?? 1));
      const soldQuantity = Math.max(0, Number((listing as any).soldQuantity ?? 0));
      const remainingQuantity = Math.max(0, Number((listing as any).remainingQuantity ?? (initialQuantity - soldQuantity)));
      return remainingQuantity > 0;
    }),
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
    setFocusedBusinessId(target.id);
  }, [initialBusinessId, communityBusinesses]);

  const handleOpenListingChat = useCallback(
    (listing: (typeof listings)[0]) => {
      if (!userProfile?.id || !listing.authorId) return;

      openTopicChat({ post: listing, communityId: currentCommunity?.id });
    },
    [currentCommunity?.id, openTopicChat, userProfile?.id]
  );

  const enabledCategories = useMemo(() => {
    if (!currentCommunity?.enabledCategories) return BUSINESS_CATEGORIES;
    return BUSINESS_CATEGORIES.filter(cat =>
      currentCommunity.enabledCategories!.includes(cat.id)
    );
  }, [currentCommunity?.enabledCategories]);

  const selectedCategoryDef = useMemo(() => {
    if (!selectedCategory) return null;
    return enabledCategories.find((cat) => cat.id === selectedCategory) ?? null;
  }, [enabledCategories, selectedCategory]);

  const matchesSelectedCategory = useCallback((value?: string | null) => {
    if (!selectedCategory) return true;
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;

    if (!selectedCategoryDef) {
      return normalized === selectedCategory.toLowerCase();
    }

    return (
      normalized === selectedCategoryDef.label.toLowerCase() ||
      selectedCategoryDef.types.some((type) => type.toLowerCase() === normalized)
    );
  }, [selectedCategory, selectedCategoryDef]);

  const featuredPosts = useMemo(() => {
    return posts
      .filter((post) => {
        const status = String(post.status || '').toUpperCase();
        return post.type === 'listing' && status !== 'DELETED';
      })
      .filter((post) => matchesSelectedCategory(post.category))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [matchesSelectedCategory, posts]);

  const filteredBusinesses = useMemo((): MarketBusiness[] => {
    if (!coverageArea) return [];

    const internalBusinesses: MarketBusiness[] = (currentCommunity?.businesses || []).map(b => ({
      ...b,
      isExternal: false,
      isFeatured: b.isFeatured ?? true,
      moderationStatus: (b as any).status,
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
      moderationStatus: b.status,
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
      combined = combined.filter((b) => matchesSelectedCategory(b.category));
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

    // Featured only shows admin-picked businesses.
    if (activeTab === 'featured') {
      return combined.filter((b) => {
        const isPinned = String(b.moderationStatus || '').toUpperCase() === 'PINNED';
        return b.isFeatured || isPinned;
      });
    }
    return combined;
  }, [
    currentCommunity,
    userBusinesses,
    communityBusinesses,
    activeTab,
    coverageArea,
    selectedCategory,
    matchesSelectedCategory,
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
      const initialQuantity = Math.max(1, Number((listing as any).initialQuantity ?? 1));
      const soldQuantity = Math.max(0, Number((listing as any).soldQuantity ?? 0));
      const remainingQuantity = Math.max(0, Number((listing as any).remainingQuantity ?? (initialQuantity - soldQuantity)));
      const perUnitCharityImpact = Math.max(0, Number(listing.charityAmount ?? 0));
      const totalAvailableCharityImpact = perUnitCharityImpact * remainingQuantity;
      const totalSoldCharityImpact = perUnitCharityImpact * soldQuantity;
      const isSoldOut = remainingQuantity === 0 || String(listing.status || '').toUpperCase() === 'SOLD';
      const hasSales = soldQuantity > 0;
      const hasListingImage = typeof listing.postsImage === 'string' && listing.postsImage.trim().length > 0;
      const hasAuthorImage =
        typeof listing.authorImage === 'string' &&
        listing.authorImage.trim().length > 0 &&
        !brokenListingAuthorImageIds[listing.id];
      const publicPrice = Number(listing.publicPrice ?? listing.price ?? 0);
      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setSelectedListing(listing)}
          className="mb-5 bg-surface-container-low rounded-[2.2rem] overflow-hidden border"
          style={SURFACE_BORDER_STYLE}
        >
          <View className="w-full overflow-hidden">
            <ListingHeroMedia
              imageUrl={listing.postsImage}
              latitude={listing.latitude}
              longitude={listing.longitude}
              soldStateLabel={isSoldOut ? 'Sold Out' : hasSales ? 'Partially Sold' : null}
            />
            {hasListingImage && listing.isCommunityPick ? (
              <View
                className="absolute top-4 left-4 px-3 py-1 rounded-full flex-row items-center gap-1"
                style={{ backgroundColor: THEME_COLORS.primary }}
              >
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} />
                <Text
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME_COLORS.white }}
                >
                  Community Pick
                </Text>
              </View>
            ) : null}
          </View>

          {/* Details */}
          <View className="p-4 gap-3">
            <View className="gap-2">
              {!hasListingImage && listing.isCommunityPick ? (
                <View
                  className="self-start px-3 py-1 rounded-full flex-row items-center gap-1"
                  style={{ backgroundColor: THEME_COLORS.primary }}
                >
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} />
                  <Text
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: THEME_COLORS.white }}
                  >
                    Community Pick
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-start justify-between gap-3">
                <Text className="text-primary text-[28px] font-black leading-tight flex-1" numberOfLines={2}>
                  {listing.title}
                </Text>
              </View>
            </View>

            {/* Combined pricing / CAT / quantity block */}
            <View className="bg-surface-container p-4 rounded-2xl border gap-3" style={SURFACE_BORDER_STYLE}>
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text
                    className="text-[10px] uppercase font-black tracking-widest mb-1"
                    style={{ color: THEME_COLORS.neutralTextSoft }}
                  >
                    Public Price
                  </Text>
                  <Text className="text-primary text-[30px] font-black leading-none">
                    R{publicPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] uppercase font-black tracking-widest" style={{ color: THEME_COLORS.neutralTextSoft }}>
                    Local Price
                  </Text>
                  <Text className="text-[20px] font-black leading-none" style={{ color: THEME_COLORS.neutralTextMuted }}>
                    R{Number(listing.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-end justify-between gap-4">
                <View className="flex-row items-center gap-2">
                  {listing.isOpenExchange ? <OpenExchangeBadge compact /> : null}
                  <Text className="text-[12px] font-bold" style={{ color: THEME_COLORS.neutralTextMuted }}>
                    Qty {remainingQuantity}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] uppercase font-black tracking-widest" style={{ color: THEME_COLORS.neutralTextSoft }}>
                    CAT Potential
                  </Text>
                  <Text className="font-black text-[22px] leading-none" style={{ color: THEME_COLORS.primary }}>
                    R{(activeTab === 'sold' ? totalSoldCharityImpact : totalAvailableCharityImpact).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Location */}
            {listing.locationName ? (
              <View
                className="flex-row items-center gap-2 px-4 py-2 rounded-full border self-start"
                style={{
                  backgroundColor: THEME_COLORS.primaryTintSoft,
                  borderColor: THEME_COLORS.alias_rgba_13_61_71_0_12,
                }}
              >
                <MapPin size={14} color={THEME_COLORS.secondaryContainer} />
                <Text className="text-[11px] font-extrabold" style={{ color: THEME_COLORS.primary }} numberOfLines={1}>
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
                      onError={() => markListingAuthorImageBroken(listing.id)}
                    />
                  ) : (
                    <View
                      className="w-full h-full items-center justify-center"
                      style={{ backgroundColor: THEME_COLORS.primaryTintSoft }}
                    >
                      <Text className="text-primary font-bold text-xs">
                        {(listing.authorName || '?').trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </View>
                <View>
                  <Text className="font-bold text-xs" style={{ color: THEME_COLORS.neutralTextStrong }}>
                    {listing.authorName || 'Artisan'}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={10} color={THEME_COLORS.neutralTextSoft} />
                    <Text
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: THEME_COLORS.neutralTextSoft }}
                    >
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
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: THEME_COLORS.primaryTintSoft }}
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
    [
      activeTab,
      charities,
      currentCommunity?.catCycleActive,
      cycleFeaturedCharity,
      handleOpenListingChat,
      brokenListingAuthorImageIds,
      markListingAuthorImageBroken,
    ]
  );

  const handleMarkListingSold = useCallback(async (listing: (typeof listings)[0]) => {
    const isOwner = listing.authorId && userProfile?.id && listing.authorId === userProfile.id;
    if (!isOwner) return;

    const initialQuantity = Math.max(1, Number((listing as any).initialQuantity ?? 1));
    const soldQuantity = Math.max(0, Number((listing as any).soldQuantity ?? 0));
    const remainingQuantity = Math.max(0, Number((listing as any).remainingQuantity ?? (initialQuantity - soldQuantity)));
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
              if (result.post?.id === listing.id) {
                const nextRemaining = Number(result.post.remainingQuantity ?? 0);
                if (nextRemaining > 0) {
                  setSelectedListing(result.post as any);
                } else {
                  setSelectedListing(null);
                }
              } else {
                setSelectedListing(null);
              }
              Alert.alert(
                'Listing updated',
                result.catTriggered
                  ? `Sold marked. CAT recorded: R${Number(result.catAmount || 0).toFixed(2)}${result.pooledToCharity ? ' (pooled to charity).' : '.'}`
                  : 'Sold marked.'
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
    const hasAuthorImage =
      typeof selectedListing.authorImage === 'string' &&
      selectedListing.authorImage.trim().length > 0 &&
      !brokenListingAuthorImageIds[selectedListing.id];
    const isOwner = selectedListing.authorId && userProfile?.id && selectedListing.authorId === userProfile.id;
    const isSold = String(selectedListing.status || '').toUpperCase() === 'SOLD';

    return (
      <Modal visible={!!selectedListing} transparent animationType="fade" onRequestClose={() => setSelectedListing(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_45 }}>
          <View className="bg-surface-container-low rounded-t-[32px] max-h-[88%] overflow-hidden">
            <ScrollView contentContainerStyle={{ paddingBottom: SPACE.s30 }}>
              <ListingHeroMedia
                imageUrl={selectedListing.postsImage}
                latitude={selectedListing.latitude}
                longitude={selectedListing.longitude}
                imageHeight={SPACE.imageHeight}
                soldStateLabel={isSold ? 'Sold Out' : null}
              />

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
                    {selectedListing.isOpenExchange ? <OpenExchangeBadge /> : null}
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
                  {selectedListing.publicPrice ? (
                    <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.sm }}>
                      Public price: R{selectedListing.publicPrice.toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ fontSize: TYPE_SCALE.body, lineHeight: LINE_HEIGHT.body, color: THEME_COLORS.neutralTextEmphasis }}>{selectedListing.description}</Text>

                {charity ? (
                  <View style={{ backgroundColor: THEME_COLORS.aliasHex_fff7ed, borderRadius: RADIUS.lg, padding: SPACE.xl, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_249_115_22_0_18 }}>
                    <View style={{ gap: SPACE.sm }}>
                      <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.aliasHex_9a3412 }}>Charity contribution</Text>
                      {selectedListing.isOpenExchange ? <OpenExchangeBadge /> : null}
                    </View>
                    <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.aliasHex_7c2d12, marginTop: SPACE.xs }}>
                      This listing supports {charity.name} with R{selectedListing.charityAmount?.toFixed(2) || '0.00'} per item.
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
                        onError={() => markListingAuthorImageBroken(selectedListing.id)}
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
                    {selectedListing.isOpenExchange ? 'Exchange Chat' : 'Open Chat'}
                  </Text>
                </TouchableOpacity>
                {selectedListing.isOpenExchange ? (
                  <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle, textAlign: 'center' }}>
                    Trades, swaps, gifts, or mixed offers are welcome while keeping the listed value intact.
                  </Text>
                ) : null}

                {isOwner && !isSold ? (
                  (() => {
                    const initialQuantity = Math.max(1, Number((selectedListing as any).initialQuantity ?? 1));
                    const soldQuantity = Math.max(0, Number((selectedListing as any).soldQuantity ?? 0));
                    const remainingQuantity = Math.max(0, Number((selectedListing as any).remainingQuantity ?? (initialQuantity - soldQuantity)));
                    const saleActionLabel = remainingQuantity > 1 ? 'Record Sale' : 'Mark as Sold';
                    return (
                  <TouchableOpacity
                    onPress={() => handleMarkListingSold(selectedListing)}
                    disabled={markingSoldId === selectedListing.id}
                    style={{ backgroundColor: THEME_COLORS.warningStrong, borderRadius: RADIUS.md, paddingVertical: SPACE.xl, alignItems: 'center' }}
                  >
                    <Text style={{ color: THEME_COLORS.neutralTextStrong, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
                      {markingSoldId === selectedListing.id ? 'Saving...' : saleActionLabel}
                    </Text>
                  </TouchableOpacity>
                    );
                  })()
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
      ? 'Sales Activity'
      : 'Items for Sale';

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <StatusBar barStyle="dark-content" />

      {/* Filters header */}
      <View
        className="px-5 pt-4 pb-2 gap-4 border-b"
        style={{ backgroundColor: APP_SHELL_COLORS.body, borderBottomColor: THEME_COLORS.neutralBorderSoft }}
      >
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
      ) : activeTab === 'featured' ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SPACE.xxxl, paddingTop: SPACE.sm, paddingBottom: SPACE.s120 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredBusinesses.length > 0 ? (
            <View>
              <Text className="text-xs font-black uppercase tracking-widest text-gray-400" style={{ marginBottom: SPACE.md }}>
                Businesses
              </Text>
              {filteredBusinesses.map((biz) => (
                <View key={biz.id}>{renderBusiness({ item: biz })}</View>
              ))}
            </View>
          ) : null}

          {featuredPosts.length > 0 ? (
            <View style={{ marginTop: filteredBusinesses.length > 0 ? SPACE.xxl : 0 }}>
              <Text className="text-xs font-black uppercase tracking-widest text-gray-400" style={{ marginBottom: SPACE.md }}>
                Listings
              </Text>
              {featuredPosts.map((post) => {
                return <View key={post.id}>{renderListing({ item: post as any })}</View>;
              })}
            </View>
          ) : null}

          {featuredPosts.length === 0 && filteredBusinesses.length === 0 ? (
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-20 h-20 bg-surface-container rounded-full items-center justify-center">
                <SlidersHorizontal size={40} color={THEME_COLORS.neutralBorderMuted} />
              </View>
              <Text className="text-primary font-bold text-lg">No featured items found</Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                Try adjusting your category filter.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : activeTab === 'businesses' ? (
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
                Try adjusting your category filter.
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
                {activeTab === 'sold' ? 'No sales activity yet' : 'No listings yet'}
              </Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                {activeTab === 'sold'
                  ? 'Listings appear here as soon as the first sale is recorded.'
                  : 'Community members haven\'t posted any listings yet.'}
              </Text>
            </View>
          }
        />
      )}
      <ListingDetailModal />
      <RecordSaleModal
        visible={Boolean(saleListing)}
        listingTitle={saleListing?.title || 'Listing'}
        charityName={saleListing?.charityId ? charities.find((c) => c.id === saleListing.charityId)?.name || null : null}
        quantityType={(saleListing as any)?.quantityType}
        unitPrice={Number(saleListing?.communityPrice ?? saleListing?.price ?? 0)}
        unitCatAmount={Number(saleListing?.charityAmount ?? 0)}
        remainingQuantity={Math.max(
          1,
          Number(
            (saleListing as any)?.remainingQuantity ??
              (Math.max(1, Number((saleListing as any)?.initialQuantity ?? 1)) -
                Math.max(0, Number((saleListing as any)?.soldQuantity ?? 0)))
          )
        )}
        loading={markingSoldId === saleListing?.id}
        onClose={() => setSaleListing(null)}
        onConfirm={async (quantity) => {
          if (!saleListing) return;
          setMarkingSoldId(saleListing.id);
          try {
            const result = await markPostSold(saleListing.id, quantity);
            if (selectedListing?.id === saleListing.id && result.post?.id === saleListing.id) {
              const nextRemaining = Number(result.post.remainingQuantity ?? 0);
              if (nextRemaining > 0) {
                setSelectedListing(result.post as any);
              } else {
                setSelectedListing(null);
              }
            }
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
