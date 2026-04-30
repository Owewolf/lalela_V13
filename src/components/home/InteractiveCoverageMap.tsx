import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import MapView, { Marker, Circle, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  Siren,
  Shield,
  Users,
  Tag,
  AlertTriangle,
  Store,
  Navigation,
  MapPin,
} from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { useCommunity } from '../../context/CommunityContext';

type MapFilter = 'members' | 'listings' | 'notices' | 'businesses';

interface InteractiveCoverageMapProps {
  center: { 
    latitude: number; 
    longitude: number; 
    latitudeDelta?: number; 
    longitudeDelta?: number; 
  };
  zoom?: number;
  isEmergencyActive?: boolean;
  showFilters?: boolean;
  showLegend?: boolean;
  showPulseOverlay?: boolean;
  showEmergencyOverlay?: boolean;
  height?: number;
  className?: string;
  onMarkerClick?: (type: string, data: any) => void;
  onOpenEmergencyHub?: () => void;
  resetTrigger?: number;
  initialFilter?: MapFilter;
  isLocked?: boolean;
  onUnlock?: () => void;
  onResetMap?: () => void;
  children?: React.ReactNode;
}

const DELTA = 0.04;
const FALLBACK_CENTER = { latitude: -26.2041, longitude: 28.0473 };

const toFiniteNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const InteractiveCoverageMap: React.FC<InteractiveCoverageMapProps> = ({
  center,
  zoom = 14,
  isEmergencyActive = false,
  showFilters = false,
  showLegend = false,
  showPulseOverlay = false,
  showEmergencyOverlay = false,
  height = 300,
  className,
  onMarkerClick,
  onOpenEmergencyHub,
  resetTrigger,
  initialFilter,
  isLocked = false,
  onUnlock,
  onResetMap,
  children,
}) => {
  const { currentCommunity, posts, members, securityResponders, communityBusinesses } =
    useCommunity();

  const [mapFilter, setMapFilter] = useState<MapFilter>(initialFilter || 'members');
  const mapRef = React.useRef<MapView>(null);

  const safeCenter = useMemo(
    () => ({
      latitude: toFiniteNumber(center.latitude, FALLBACK_CENTER.latitude),
      longitude: toFiniteNumber(center.longitude, FALLBACK_CENTER.longitude),
      latitudeDelta: toFiniteNumber(center.latitudeDelta, DELTA),
      longitudeDelta: toFiniteNumber(center.longitudeDelta, DELTA),
    }),
    [center.latitude, center.longitude, center.latitudeDelta, center.longitudeDelta]
  );

  useEffect(() => {
    if (initialFilter) setMapFilter(initialFilter);
  }, [initialFilter]);

  // Fly to new center when reset is triggered
  useEffect(() => {
    if (mapRef.current && mapRef.current.animateToRegion) {
      try {
        mapRef.current.animateToRegion(
          {
            latitude: safeCenter.latitude,
            longitude: safeCenter.longitude,
            latitudeDelta: safeCenter.latitudeDelta,
            longitudeDelta: safeCenter.longitudeDelta,
          },
          800
        );
      } catch (error) {
        console.warn('Map animation error on web:', error);
      }
    }
  }, [
    resetTrigger,
    safeCenter.latitude,
    safeCenter.longitude,
    safeCenter.latitudeDelta,
    safeCenter.longitudeDelta,
  ]);

  const allResponders = useMemo(() => {
    const calcDist = (lat: number, lng: number) => {
      const R = 6371;
      const dLat = ((lat - safeCenter.latitude) * Math.PI) / 180;
      const dLng = ((lng - safeCenter.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((safeCenter.latitude * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
    };

    const responderIds = new Set(securityResponders.map((r) => r.user_id));
    const fromDedicated = securityResponders.map((r) => ({
      ...r,
      distance: calcDist(r.latitude, r.longitude),
    }));
    const fromMembers = members
      .filter(
        (m) =>
          m.isSecurityMember && m.latitude && m.longitude && !responderIds.has(m.user_id)
      )
      .map((m) => ({
        user_id: m.user_id,
        name: m.name || 'Security Member',
        image:
          m.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user_id}`,
        latitude: m.latitude!,
        longitude: m.longitude!,
        timestamp: new Date().toISOString(),
        distance: calcDist(m.latitude!, m.longitude!),
      }));
    return [...fromDedicated, ...fromMembers].sort(
      (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
    );
  }, [securityResponders, members, safeCenter.latitude, safeCenter.longitude]);

  const emergencyPost = posts.find(
    (p) => p.urgency === 'emergency' || p.urgency_level === 'emergency'
  );

  const coverageCenter =
    isEmergencyActive && emergencyPost?.latitude && emergencyPost?.longitude
      ? { latitude: emergencyPost.latitude, longitude: emergencyPost.longitude }
      : currentCommunity?.coverageArea
      ? {
          latitude: currentCommunity.coverageArea.latitude,
          longitude: currentCommunity.coverageArea.longitude,
        }
      : null;

  const initialRegion = {
    latitude: safeCenter.latitude,
    longitude: safeCenter.longitude,
    latitudeDelta: safeCenter.latitudeDelta,
    longitudeDelta: safeCenter.longitudeDelta,
  };

  const filterItems: { id: MapFilter; color: string; label: string }[] = [
    { id: 'members', color: '#10b981', label: 'Members' },
    { id: 'listings', color: '#3b82f6', label: 'Listings' },
    { id: 'notices', color: '#f59e0b', label: 'Notices' },
    { id: 'businesses', color: '#a855f7', label: 'Businesses' },
  ];

  return (
    <View className={cn('space-y-3', className)}>
      {/* Map Container */}
      <View
        className="relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200"
        style={{ height }}
      >
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          scrollEnabled={!isLocked}
          zoomEnabled={!isLocked}
          rotateEnabled={!isLocked}
          pitchEnabled={false}
          onPress={() => {
            if (isLocked) onUnlock?.();
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
        >
          {/* Coverage Area Circle */}
          {coverageCenter && currentCommunity?.coverageArea && (
            <Circle
              center={coverageCenter}
              radius={currentCommunity.coverageArea.radius * 1000}
              strokeColor={isEmergencyActive ? '#B3261E' : '#134E42'}
              strokeWidth={2}
              fillColor={
                isEmergencyActive
                  ? 'rgba(179,38,30,0.08)'
                  : 'rgba(19,78,66,0.08)'
              }
            />
          )}

          {/* Emergency Ripple Rings */}
          {isEmergencyActive &&
            coverageCenter &&
            [120, 280, 500].map((radius, i) => (
              <Circle
                key={`ripple-${i}`}
                center={coverageCenter}
                radius={radius}
                strokeColor="#B3261E"
                strokeWidth={2}
                fillColor="rgba(179,38,30,0.04)"
              />
            ))}

          {/* Emergency Marker */}
          {isEmergencyActive && coverageCenter && (
              <Marker
                coordinate={coverageCenter}
                anchor={{ x: 0.5, y: 0.5 }}
                onCalloutPress={() => onOpenEmergencyHub?.()}
                onPress={(e) => {
                  if (isLocked) {
                    onUnlock?.();
                  } else {
                    // Optional: open hub without callout if tapped directly?
                    // Currently relying on Callout press is standard MapView UX.
                  }
                }}
              >
                <View className="bg-red-600 p-2 rounded-full border-2 border-white shadow-xl">
                  <Siren size={18} color="#fff" />
                </View>
                <Callout tooltip onPress={() => onOpenEmergencyHub?.()}>
                  <View className="bg-white rounded-lg p-3 min-w-[200px] shadow-sm border border-red-100">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2">
                        <Siren size={14} color="#B3261E" />
                        <Text className="text-[10px] font-black uppercase tracking-widest text-red-600">
                          Active Emergency
                        </Text>
                      </View>
                      <Text className="text-[10px] text-gray-400 font-medium ml-2">
                          Tap to open hub
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-primary-container leading-tight">
                    {emergencyPost
                      ? emergencyPost.title
                      : 'Emergency reported at this location.'}
                  </Text>
                  {emergencyPost?.locationName && (
                    <Text className="text-[10px] text-gray-500 font-bold mt-1">
                      {emergencyPost.locationName}
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          )}

          {/* Members Layer */}
          {mapFilter === 'members' &&
            members
              .filter((m) => m.latitude && m.longitude)
              .map((member) => {
                const isSecurityActive =
                  member.isSecurityMember && isEmergencyActive;
                return (
                  <Marker
                    key={member.user_id}
                    coordinate={{
                      latitude: member.latitude!,
                      longitude: member.longitude!,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      if (isLocked) onUnlock?.();
                    }}
                  >
                    <View
                      className="p-1.5 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: isSecurityActive
                          ? '#6366f1'
                          : '#10b981',
                      }}
                    >
                      {isSecurityActive ? (
                        <Shield size={14} color="#fff" />
                      ) : (
                        <Users size={14} color="#fff" />
                      )}
                    </View>
                    <Callout>
                      <View className="p-2 min-w-[180px]">
                        <Text className="font-bold text-sm text-primary-container">
                          {member.name}
                        </Text>
                        <Text className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                          {isSecurityActive ? 'Emergency Responder' : member.role}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })}

          {/* Listings Layer */}
          {mapFilter === 'listings' &&
            posts
              .filter((p) => p.type === 'listing' && p.latitude && p.longitude)
              .map((listing) => (
                <Marker
                  key={listing.id}
                  coordinate={{
                    latitude: listing.latitude!,
                    longitude: listing.longitude!,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    if (isLocked) onUnlock?.();
                  }}
                >
                  <View className="bg-blue-500 p-1.5 rounded-full border-2 border-white">
                    <Store size={14} color="#fff" />
                  </View>
                  <Callout>
                    <View className="p-2 min-w-[200px]">
                      <Text className="font-bold text-sm text-primary-container leading-tight">
                        {listing.title}
                      </Text>
                      {listing.price != null && (
                        <Text className="text-xs font-black text-indigo-700 mt-0.5">
                          R{listing.price}
                        </Text>
                      )}
                      <Text
                        className="text-[10px] text-gray-500 mt-1"
                        numberOfLines={2}
                      >
                        {listing.description}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              ))}

          {/* Notices Layer */}
          {mapFilter === 'notices' &&
            posts
              .filter((p) => p.type === 'notice' && p.latitude && p.longitude)
              .map((notice) => {
                const isEmergencyNotice =
                  notice.priority === 'emergency' ||
                  notice.urgency === 'emergency' ||
                  notice.urgency_level === 'emergency';
                return (
                  <Marker
                    key={notice.id}
                    coordinate={{
                      latitude: notice.latitude!,
                      longitude: notice.longitude!,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      if (isLocked) onUnlock?.();
                    }}
                  >
                    <View
                      className="p-1.5 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: isEmergencyNotice
                          ? '#ef4444'
                          : '#f59e0b',
                      }}
                    >
                      <AlertTriangle size={14} color="#fff" />
                    </View>
                    <Callout>
                      <View className="p-2 min-w-[200px]">
                        <Text className="font-bold text-sm text-primary-container leading-tight">
                          {notice.title}
                        </Text>
                        <Text
                          className="text-[10px] text-gray-500 mt-1"
                          numberOfLines={2}
                        >
                          {notice.description}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })}

          {/* Businesses Layer */}
          {mapFilter === 'businesses' &&
            communityBusinesses.map((business) => (
              <Marker
                key={business.id}
                coordinate={{
                  latitude: business.latitude,
                  longitude: business.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => {
                  if (isLocked) onUnlock?.();
                }}
              >
                <View className="bg-purple-500 p-1.5 rounded-full border-2 border-white">
                  <Store size={14} color="#fff" />
                </View>
                <Callout>
                  <View className="p-2 min-w-[200px]">
                    <Text className="font-bold text-sm text-primary-container leading-tight">
                      {business.name}
                    </Text>
                    <Text className="text-[10px] text-purple-600 font-black uppercase tracking-widest mt-0.5">
                      {business.category}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}

          {/* Security Responders (always visible during emergency) */}
          {isEmergencyActive &&
            securityResponders.map((responder) => (
              <Marker
                key={`responder-${responder.user_id}`}
                coordinate={{
                  latitude: responder.latitude,
                  longitude: responder.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={800}
              >
                <View className="bg-indigo-600 p-1.5 rounded-full border-2 border-white">
                  <Shield size={14} color="#fff" />
                </View>
                <Callout>
                  <View className="p-2 min-w-[150px]">
                    <Text className="text-xs font-bold">{responder.name}</Text>
                    <Text className="text-[10px] text-indigo-600">
                      Security Responder
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
        </MapView>

        {/* Lock Overlay */}
        {isLocked && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={onUnlock}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
          />
        )}

        {/* Pulse Overlay (top-left badge) */}
        {showPulseOverlay && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onResetMap}
            className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-md flex-row items-center gap-2 border border-gray-200"
          >
            <View
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isEmergencyActive ? '#ef4444' : '#10b981',
              }}
            />
            <Text
              className="text-[11px] font-bold"
              style={{ color: isEmergencyActive ? '#ef4444' : '#0d3d47' }}
            >
              {isEmergencyActive
                ? 'EMERGENCY MODE ACTIVE'
                : 'Live Pulse: All Secure'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Emergency Hub Overlay (bottom panel) */}
        {showEmergencyOverlay && isEmergencyActive && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onOpenEmergencyHub}
            className="absolute bottom-4 left-4 right-4 z-10"
          >
            <View className="bg-red-600 px-4 py-3 rounded-2xl shadow-2xl">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-3">
                  <Shield size={18} color="#fff" />
                  <View>
                    <Text className="text-white text-xs font-bold">
                      {allResponders.length} Security Responder
                      {allResponders.length !== 1 ? 's' : ''} Active
                    </Text>
                    <Text className="text-white/80 text-[10px]">
                      Coordinating response...
                    </Text>
                  </View>
                </View>
                <Navigation size={18} color="#fff" />
              </View>
              {allResponders.length > 0 && (
                <View className="border-t border-white/20 pt-2 gap-1.5">
                  {allResponders.slice(0, 3).map((responder) => (
                    <View
                      key={responder.user_id}
                      className="flex-row items-center gap-2"
                    >
                      <View className="w-5 h-5 rounded-full bg-white/20 items-center justify-center">
                        <Text className="text-white text-[8px] font-bold">
                          {responder.name.charAt(0)}
                        </Text>
                      </View>
                      <Text
                        className="text-white text-[11px] font-bold flex-1"
                        numberOfLines={1}
                      >
                        {responder.name}
                      </Text>
                      <Text className="text-white text-[10px] font-bold ml-auto">
                        {responder.distance}km
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {children}
      </View>

      {/* Filter Legend */}
      {showLegend && (
        <View className="flex-row items-center justify-between w-full pt-1 px-1">
          {filterItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => setMapFilter(item.id)}
              className={cn(
                'flex-1 flex-row items-center justify-center gap-1 py-1.5 mx-0.5 rounded-full border',
                mapFilter === item.id
                  ? 'bg-primary border-primary'
                  : 'bg-white border-gray-200'
              )}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    mapFilter === item.id ? '#fff' : item.color,
                }}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className={cn(
                  'text-[8px] font-black uppercase tracking-wider',
                  mapFilter === item.id ? 'text-white' : 'text-primary-container'
                )}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default InteractiveCoverageMap;
