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
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS_CATEGORIES } from '../../constants';
import { calculateDistance } from '../../lib/utils';
import type { UserBusiness } from '../../types';

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
  isVerified?: boolean;
  isFeatured?: boolean;
  distance: string;
  isExplicitlyLinked: boolean;
  isMemberBusiness: boolean;
  status: 'Open' | 'Closed';
}

const PRIMARY = '#0d3d47';

interface MarketPageProps {
  initialListingId?: string;
}

export default function MarketPage({ initialListingId }: MarketPageProps) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { currentCommunity, userBusinesses, posts, communityBusinesses, charities, startConversation, setActiveConversation } = useCommunity();

  const [activeTab, setActiveTab] = useState<'featured' | 'listings' | 'businesses'>('businesses');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<(typeof listings)[0] | null>(null);

  const coverageArea = currentCommunity?.coverageArea;

  const listings = useMemo(() => {
    let l = posts.filter(p => p.type === 'listing');
    l.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.category || '').localeCompare(b.category || '');
    });
    return l;
  }, [posts]);

  useEffect(() => {
    if (initialListingId && posts.length > 0) {
      const listing = posts.find(p => p.type === 'listing' && p.id === initialListingId);
      if (listing) {
        setActiveTab('listings');
        setSelectedListing(listing as any);
      }
    }
  }, [initialListingId, posts]);

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
      isVerified: b.isVerified ?? true,
      isFeatured: b.isFeatured ?? b.isVerified ?? true,
      isExplicitlyLinked: true,
      isMemberBusiness: false,
      status: (b.status as 'Open' | 'Closed') || 'Open',
      distance:
        b.latitude && b.longitude
          ? calculateDistance(coverageArea.latitude, coverageArea.longitude, b.latitude, b.longitude).toFixed(1) + ' km'
          : '0.0 km',
    }));

    const allCommunityUserBusinesses: MarketBusiness[] = (communityBusinesses || []).map(b => ({
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
      isVerified: true,
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
      const hasListingImage = typeof listing.postsImage === 'string' && listing.postsImage.trim().length > 0;
      const hasAuthorImage = typeof listing.authorImage === 'string' && listing.authorImage.trim().length > 0;
      return (
        <TouchableOpacity activeOpacity={0.92} onPress={() => setSelectedListing(listing)} className="mb-4 bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
          {hasListingImage ? (
            <View className="w-full aspect-[4/3] overflow-hidden">
              <Image
                source={{ uri: listing.postsImage }}
                className="w-full h-full"
                resizeMode="cover"
              />
              {listing.isCommunityPick && (
                <View className="absolute top-4 left-4 bg-orange-500 px-3 py-1 rounded-full flex-row items-center gap-1">
                  <View className="w-2 h-2 bg-white rounded-full" />
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
                    <View className="w-2 h-2 bg-white rounded-full" />
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

            {/* Charity */}
            {listing.isPublic && listing.charityId ? (
              <View className="bg-gray-100 p-3 rounded-2xl flex-row items-start gap-3 border border-gray-200">
                <View className="bg-orange-50 p-2 rounded-full items-center justify-center">
                  <Heart size={20} color="#f97316" fill="#f97316" />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-primary font-bold text-sm">Charity Impact</Text>
                    <Text className="text-orange-500 font-black text-sm">
                      R{(listing.charityAmount || 0).toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-[11px] leading-relaxed">
                    Benefiting{' '}
                    <Text className="font-bold text-primary">
                      {charity?.name || 'Local Charity'}
                    </Text>{' '}
                    from this purchase.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Location */}
            {listing.locationName ? (
              <View className="flex-row items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 self-start">
                <MapPin size={14} color="#f97316" />
                <Text className="text-[11px] font-extrabold text-orange-500" numberOfLines={1}>
                  {listing.locationName}
                </Text>
              </View>
            ) : null}

            {/* Author row */}
            <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
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
                    <Clock size={10} color="#9ca3af" />
                    <Text className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {new Date(listing.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => handleOpenListingChat(listing)}
                >
                  <MessageSquare size={20} color={PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Heart size={20} color="#f97316" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [charities, handleOpenListingChat]
  );

  const ListingDetailModal = () => {
    if (!selectedListing) return null;

    const charity = selectedListing.charityId ? charities.find((item) => item.id === selectedListing.charityId) : null;
    const hasListingImage = typeof selectedListing.postsImage === 'string' && selectedListing.postsImage.trim().length > 0;
    const hasAuthorImage = typeof selectedListing.authorImage === 'string' && selectedListing.authorImage.trim().length > 0;

    return (
      <Modal visible={!!selectedListing} transparent animationType="fade" onRequestClose={() => setSelectedListing(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white rounded-t-[32px] max-h-[88%] overflow-hidden">
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              {hasListingImage ? (
                <Image
                  source={{ uri: selectedListing.postsImage }}
                  style={{ width: '100%', height: 240 }}
                  resizeMode="cover"
                />
              ) : null}

              <View style={{ padding: 20, gap: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eef2ff' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {selectedListing.category}
                        </Text>
                      </View>
                      {selectedListing.locationName ? (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff7ed', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MapPin size={12} color="#f97316" />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#f97316' }}>{selectedListing.locationName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 28 }}>{selectedListing.title}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedListing(null)}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#6b7280' }}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: '#f8fafc', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(79,70,229,0.12)' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Community Price</Text>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#4f46e5', marginTop: 6 }}>
                    R{(selectedListing.communityPrice || selectedListing.price || 0).toLocaleString()}
                  </Text>
                  {selectedListing.isPublic && selectedListing.publicPrice ? (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                      Public price: R{selectedListing.publicPrice.toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ fontSize: 14, lineHeight: 22, color: '#374151' }}>{selectedListing.description}</Text>

                {selectedListing.isPublic && charity ? (
                  <View style={{ backgroundColor: '#fff7ed', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.18)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#9a3412' }}>Charity contribution</Text>
                    <Text style={{ fontSize: 12, color: '#7c2d12', marginTop: 6 }}>
                      This listing supports {charity.name} with R{selectedListing.charityAmount?.toFixed(2) || '0.00'} per sale.
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#e5e7eb' }}>
                    {hasAuthorImage ? (
                      <Image
                        source={{ uri: selectedListing.authorImage }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,61,71,0.08)' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d3d47' }}>
                          {(selectedListing.authorName || '?').trim().charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{selectedListing.authorName || 'Community Member'}</Text>
                    <Text style={{ fontSize: 11, color: '#6b7280' }}>{new Date(selectedListing.timestamp).toLocaleDateString()}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenListingChat(selectedListing)}
                  style={{ backgroundColor: '#0d3d47', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Open Chat
                  </Text>
                </TouchableOpacity>
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
  ] as const;

  const headingText =
    activeTab === 'featured'
      ? 'Admin Picks'
      : activeTab === 'businesses'
      ? 'Community Businesses'
      : 'Items for Sale';

  const subText =
    activeTab === 'businesses'
      ? `${filteredBusinesses.length} business${filteredBusinesses.length !== 1 ? 'es' : ''} in ${coverageArea?.locationName || currentCommunity?.name || 'your area'}`
      : `Showing ${activeTab === 'listings' ? listings.length : filteredBusinesses.length} ${activeTab === 'listings' ? 'listings' : 'businesses'} in ${coverageArea?.locationName || currentCommunity?.name || 'your area'}`;

  const currentData = activeTab === 'listings' ? listings : filteredBusinesses;

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Search + filters header */}
      <View className="px-5 pt-4 pb-2 gap-4 bg-white border-b border-gray-100">
        {/* Search bar */}
        <View className="relative flex-row items-center bg-gray-100 rounded-2xl px-4 py-3 gap-3">
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search businesses..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-sm font-medium text-gray-800"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
              <X size={16} color="#9ca3af" />
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
                : 'bg-gray-50 border-gray-200',
            ].join(' ')}
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
                  : 'bg-gray-50 border-gray-200',
              ].join(' ')}
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
      <View className="px-5 pt-4 pb-3 gap-4 bg-white">
        <View className="flex-row items-center justify-between">
          {/* Tabs */}
          <View className="flex-row bg-gray-100 p-1 rounded-full border border-gray-200">
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
          <View className="flex-row bg-gray-100 p-1 rounded-full border border-gray-200">
            <TouchableOpacity
              onPress={() => setViewMode('list')}
              className={[
                'p-1.5 rounded-full',
                viewMode === 'list' ? 'bg-primary' : '',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <ListIcon size={16} color={viewMode === 'list' ? '#fff' : '#9ca3af'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('map')}
              className={[
                'p-1.5 rounded-full',
                viewMode === 'map' ? 'bg-primary' : '',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <MapIcon size={16} color={viewMode === 'map' ? '#fff' : '#9ca3af'} />
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
                <X size={12} color="#f97316" />
                <Text className="text-orange-500 text-[10px] font-bold">
                  {enabledCategories.find(c => c.id === selectedCategory)?.label}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity className="flex-row items-center gap-1" activeOpacity={0.8}>
              <SlidersHorizontal size={16} color="#f97316" />
              <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                Filter
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'map' ? (
        <View className="flex-1 m-4 rounded-3xl overflow-hidden border border-gray-200">
          {coverageArea ? (
            <MapView
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
                    pinColor={biz.isMemberBusiness ? '#9333ea' : PRIMARY}
                  />
                ))}
            </MapView>
          ) : (
            <View className="flex-1 items-center justify-center bg-gray-50">
              <Text className="text-gray-400 text-sm">No coverage area configured</Text>
            </View>
          )}
        </View>
      ) : activeTab === 'businesses' || activeTab === 'featured' ? (
        <FlatList
          data={filteredBusinesses}
          keyExtractor={item => item.id}
          renderItem={renderBusiness}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center">
                <SlidersHorizontal size={40} color="#d1d5db" />
              </View>
              <Text className="text-primary font-bold text-lg">No businesses found</Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                Try adjusting your search or category filter.
              </Text>
            </View>
          }
        />
      ) : (
        /* Listings tab */
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={renderListing}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center">
                <MapPin size={40} color="#d1d5db" />
              </View>
              <Text className="text-primary font-bold text-lg">No listings yet</Text>
              <Text className="text-gray-400 text-sm text-center max-w-[240px]">
                Community members haven't posted any listings yet.
              </Text>
            </View>
          }
        />
      )}
      <ListingDetailModal />
    </View>
  );
}
