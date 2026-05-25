import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import {
  Siren,
  Flame,
  Car,
  Shield,
  Users,
  Tag,
  AlertTriangle,
  Store,
  MapPin,
} from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import {
  extractMapCoordinates,
  regionForCoordinateCircles,
} from '../../lib/mapBounds';
import { useCommunity } from '../../context/CommunityContext';

type MapFilter = 'members' | 'listings' | 'notices' | 'businesses';

interface EmergencyIncident {
  id: string;
  title: string | undefined;
  locationName: string | undefined;
  emergencyType: 'fire' | 'accident' | 'security' | 'generic';
  latitude: number;
  longitude: number;
}

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
  onOpenEmergencyHub?: (incidentId: string) => void;
  onOpenEmergencySelection?: () => void;
  resetTrigger?: number;
  initialFilter?: MapFilter;
  isLocked?: boolean;
  onUnlock?: () => void;
  onResetMap?: () => void;
  children?: React.ReactNode;
}

const DELTA = 0.04;
const FALLBACK_CENTER = { latitude: -26.2041, longitude: 28.0473 };
const SINGLE_EMERGENCY_DELTA = 0.02;
const EMERGENCY_RADIUS_METERS = 10000;

const classifyEmergencyType = (
  title?: string,
  description?: string,
  category?: string
): EmergencyIncident['emergencyType'] => {
  const haystack = `${title || ''} ${description || ''} ${category || ''}`.toLowerCase();

  if (/(fire|smoke|burn|blaze)/.test(haystack)) return 'fire';
  if (/(accident|crash|collision|vehicle|car|traffic|road)/.test(haystack)) {
    return 'accident';
  }
  if (/(crime|security|robbery|theft|assault|break-in|violence|intruder)/.test(haystack)) {
    return 'security';
  }
  return 'generic';
};

const emergencyVisualConfig = (
  type: EmergencyIncident['emergencyType']
): { icon: React.ComponentType<{ size?: number; color?: string }>; bgColor: string; label: string } => {
  switch (type) {
    case 'fire':
      return { icon: Flame, bgColor: '#ef4444', label: 'Fire Emergency' };
    case 'accident':
      return { icon: Car, bgColor: '#f97316', label: 'Accident Emergency' };
    case 'security':
      return { icon: Shield, bgColor: '#dc2626', label: 'Security Emergency' };
    default:
      return { icon: Siren, bgColor: '#dc2626', label: 'Emergency' };
  }
};

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
  onOpenEmergencySelection,
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
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleOpenDirections = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };
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

  const activeEmergencyPosts = useMemo(
    () =>
      [...posts]
        .filter((p: any) => p.urgency === 'emergency' || p.urgencyLevel === 'emergency')
        .sort(
          (a: any, b: any) =>
            new Date((b?.timestamp || b?.createdAt || 0) as any).getTime() -
            new Date((a?.timestamp || a?.createdAt || 0) as any).getTime()
        ),
    [posts]
  );

  const emergencyIncidents = useMemo<EmergencyIncident[]>(
    () =>
      activeEmergencyPosts
        .map((post: any): EmergencyIncident | null => {
          const latitude = toFiniteNumber(post?.latitude, NaN);
          const longitude = toFiniteNumber(post?.longitude, NaN);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          return {
            id: String(post.id),
            title: typeof post.title === 'string' ? post.title : undefined,
            locationName:
              typeof post.locationName === 'string' ? post.locationName : undefined,
            emergencyType: classifyEmergencyType(
              typeof post.title === 'string' ? post.title : undefined,
              typeof post.description === 'string' ? post.description : undefined,
              typeof post.category === 'string' ? post.category : undefined
            ),
            latitude,
            longitude,
          };
        })
        .filter((incident): incident is EmergencyIncident => incident !== null),
    [activeEmergencyPosts]
  );

  const emergencyCoordinates = useMemo(
    () => extractMapCoordinates(emergencyIncidents),
    [emergencyIncidents]
  );

  const emergencyViewportTarget = useMemo(() => {
    if (!isEmergencyActive || emergencyCoordinates.length === 0) return null;

    if (emergencyCoordinates.length === 1) {
      const [single] = emergencyCoordinates;
      return {
        latitude: single.latitude,
        longitude: single.longitude,
        latitudeDelta: SINGLE_EMERGENCY_DELTA,
        longitudeDelta: SINGLE_EMERGENCY_DELTA,
      };
    }

    return regionForCoordinateCircles(emergencyCoordinates, EMERGENCY_RADIUS_METERS, {
      paddingFactor: 1.08,
      minDelta: 0.008,
    });
  }, [isEmergencyActive, emergencyCoordinates]);

  const emergencyPost = emergencyIncidents[0];
  const emergencyAttentionLabel = useMemo(() => {
    if (!isEmergencyActive || emergencyIncidents.length === 0) return null;
    if (emergencyIncidents.length > 1) return 'Multiple emergencies';
    return emergencyPost?.title || 'Emergency active';
  }, [isEmergencyActive, emergencyIncidents.length, emergencyPost?.title]);

  useEffect(() => {
    if (!emergencyViewportTarget) return;
    if (!mapRef.current?.animateToRegion) return;

    try {
      mapRef.current.animateToRegion(emergencyViewportTarget, 650);
    } catch (error) {
      console.warn('Emergency viewport animation error:', error);
    }
  }, [
    emergencyViewportTarget?.latitude,
    emergencyViewportTarget?.longitude,
    emergencyViewportTarget?.latitudeDelta,
    emergencyViewportTarget?.longitudeDelta,
    resetTrigger,
  ]);

  const coverageCenter = currentCommunity?.coverageArea
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
          {...defaultMapViewProps}
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          scrollEnabled={!isLocked}
          zoomEnabled={!isLocked}
          rotateEnabled={!isLocked}
          pitchEnabled={false}
          onPress={() => {
            if (isLocked) onUnlock?.();
            setSelectedLocation(null);
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
        >
          {/* Coverage Area Circle */}
          {!isEmergencyActive && coverageCenter && currentCommunity?.coverageArea && (
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
            emergencyIncidents.length === 1 &&
            emergencyPost &&
            [120, 280, 500].map((radius, i) => (
              <Circle
                key={`ripple-${i}`}
                center={{
                  latitude: emergencyPost.latitude,
                  longitude: emergencyPost.longitude,
                }}
                radius={radius}
                strokeColor="#B3261E"
                strokeWidth={2}
                fillColor="rgba(179,38,30,0.04)"
              />
            ))}

          {/* Emergency 10km Radius Per Incident */}
          {isEmergencyActive &&
            emergencyIncidents.map((incident) => (
              <Circle
                key={`emergency-radius-${incident.id}`}
                center={{
                  latitude: incident.latitude,
                  longitude: incident.longitude,
                }}
                radius={EMERGENCY_RADIUS_METERS}
                strokeColor="rgba(179, 38, 30, 0.55)"
                strokeWidth={2}
                fillColor="rgba(179, 38, 30, 0.08)"
              />
            ))}

          {/* Emergency Marker */}
          {isEmergencyActive && emergencyIncidents.length > 0 && (
            <>
              {emergencyIncidents.map((incident) => {
                const visual = emergencyVisualConfig(incident.emergencyType);
                const EmergencyIcon = visual.icon;
                return (
              <Marker
                key={`emergency-${incident.id}`}
                coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onCalloutPress={() => {
                  onOpenEmergencyHub?.(incident.id);
                }}
                onPress={() => {
                  if (isLocked) {
                    onUnlock?.();
                  }
                  onOpenEmergencyHub?.(incident.id);
                }}
              >
                <View
                  className="p-2 rounded-full border-2 border-white shadow-xl"
                  style={{ backgroundColor: visual.bgColor }}
                >
                  <EmergencyIcon size={18} color="#fff" />
                </View>
                <Callout
                  tooltip
                  onPress={() => {
                    onOpenEmergencyHub?.(incident.id);
                  }}
                >
                  <View className="bg-white rounded-lg p-3 min-w-[200px] shadow-sm border border-red-100">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2">
                        <EmergencyIcon size={14} color="#B3261E" />
                        <Text className="text-[10px] font-black uppercase tracking-widest text-red-600">
                          {visual.label}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-gray-400 font-medium ml-2">
                          Tap to open hub
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-primary-container leading-tight">
                    {incident.title || 'Emergency reported at this location.'}
                  </Text>
                  {incident.locationName && (
                    <Text className="text-[10px] text-gray-500 font-bold mt-1">
                      {incident.locationName}
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
                );
              })}
            </>
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
                    key={member.userId}
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
                  notice.urgencyLevel === 'emergency';
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

          {/* Businesses Layer — only user-created (no AI/imported) */}
          {mapFilter === 'businesses' &&
            communityBusinesses.filter((b) => b.source !== 'IMPORT').map((business) => (
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
                key={`responder-${responder.userId}`}
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
        {isLocked && !isEmergencyActive && (
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

        {/* Emergency Attention Button */}
        {isEmergencyActive && emergencyAttentionLabel && (
          <View className="absolute bottom-3 left-0 right-0 z-10 items-center px-3">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (emergencyIncidents.length > 1) {
                  onOpenEmergencySelection?.();
                  return;
                }
                const single = emergencyIncidents[0];
                if (single?.id) onOpenEmergencyHub?.(single.id);
              }}
              className="bg-red-600 px-4 py-2 rounded-full shadow-md border border-red-500 max-w-[82%]"
            >
              <Text className="text-[11px] font-black text-white" numberOfLines={1}>
                {emergencyAttentionLabel.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
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

      {/* Universal Floating Navigation Button (Required for Web, Fallback/Enhancement for all) */}
      {selectedLocation && (
        <View className="absolute bottom-6 right-4 shadow-xl z-50">
          <TouchableOpacity 
            className="flex-row items-center space-x-2 bg-blue-600 px-4 py-3 rounded-full shadow-lg border border-blue-500"
            onPress={() => handleOpenDirections(selectedLocation.latitude, selectedLocation.longitude)}
            activeOpacity={0.8}
          >
            <MapPin size={18} color="white" />
            <Text className="text-white font-bold text-sm ml-2 tracking-wide">Navigate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Universal Floating Navigation Button (Required for Web, Fallback/Enhancement for all) */}
      {selectedLocation && (
        <View className="absolute bottom-6 right-4 shadow-xl z-50">
          <TouchableOpacity 
            className="flex-row items-center space-x-2 bg-blue-600 px-4 py-3 rounded-full shadow-lg border border-blue-500"
            onPress={() => handleOpenDirections(selectedLocation.latitude, selectedLocation.longitude)}
            activeOpacity={0.8}
          >
            <MapPin size={18} color="white" />
            <Text className="text-white font-bold text-sm ml-2 tracking-wide">Navigate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default InteractiveCoverageMap;
