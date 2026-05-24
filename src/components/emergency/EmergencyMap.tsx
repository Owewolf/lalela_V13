import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import { Shield, Siren, Users, Navigation } from 'lucide-react-native';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { useCommunity } from '../../context/CommunityContext';
import { CommunityNotice } from '../../types';

interface EmergencyMapProps {
  emergencyPost: CommunityNotice;
  resetTrigger?: number;
  mapRef?: React.RefObject<MapView | null>;
}

const EMERGENCY_RADIUS = 10000; // 10km in meters

// ~111 km per degree of latitude. Pad slightly so the circle isn't flush to the edge.
const regionForRadius = (lat: number, lng: number, radiusMeters: number) => {
  const latDelta = ((radiusMeters * 2.4) / 1000) / 111;
  const lonDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
};

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): string => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
};

export const EmergencyMap: React.FC<EmergencyMapProps> = ({
  emergencyPost,
  resetTrigger,
  mapRef,
}) => {
  const { members, securityResponders } = useCommunity();
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const internalRef = React.useRef<MapView>(null);
  const ref = mapRef ?? internalRef;

  const emergencyLat = emergencyPost.latitude ?? -26.2041;
  const emergencyLng = emergencyPost.longitude ?? 28.0473;

  const initialRegion = regionForRadius(emergencyLat, emergencyLng, EMERGENCY_RADIUS);

  // Recenter when resetTrigger changes
  React.useEffect(() => {
    if (resetTrigger === undefined) return;
    fitToAllMarkers();
  }, [resetTrigger]);

  const responderIds = useMemo(
    () => new Set(securityResponders.map((r) => r.userId)),
    [securityResponders],
  );

  const activeResponders = useMemo(
    () =>
      securityResponders.filter(
        (responder) =>
          Number.isFinite(responder.latitude) && Number.isFinite(responder.longitude),
      ),
    [securityResponders],
  );

  const visibleMembers = useMemo(
    () =>
      members.filter((m) => {
        if (responderIds.has(m.userId)) return false;
        const hasLocation = Number.isFinite(m.latitude) && Number.isFinite(m.longitude);
        return hasLocation;
      }),
    [members, responderIds],
  );

  const fitToAllMarkers = () => {
    if (Platform.OS === 'web') return;
    const markerPoints = [
      { latitude: emergencyLat, longitude: emergencyLng },
      ...activeResponders.map((r) => ({ latitude: r.latitude, longitude: r.longitude })),
      ...visibleMembers.map((m) => ({ latitude: m.latitude!, longitude: m.longitude! })),
    ];
    try {
      if (markerPoints.length <= 1) {
        ref.current?.animateToRegion(initialRegion, 400);
        return;
      }
      ref.current?.fitToCoordinates(markerPoints, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    } catch (error) {
      console.warn('Map animation error on web:', error);
    }
  };

  React.useEffect(() => {
    if (!ref.current) return;
    // Keep the map locked on the 10km emergency view as the emergency coords change.
    if (Platform.OS === 'web') return;
    try {
      ref.current.animateToRegion(
        regionForRadius(emergencyLat, emergencyLng, EMERGENCY_RADIUS),
        400,
      );
    } catch (error) {
      console.warn('Map animation error:', error);
    }
  }, [emergencyLat, emergencyLng]);

  return (
    <View className="flex-1 relative">
      <MapView
        {...defaultMapViewProps}
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {/* 10km emergency radius */}
        <Circle
          center={{ latitude: emergencyLat, longitude: emergencyLng }}
          radius={EMERGENCY_RADIUS}
          strokeColor="rgba(220, 38, 38, 0.45)"
          fillColor="rgba(220, 38, 38, 0.08)"
          strokeWidth={2}
        />

        {/* Emergency source marker */}
        <Marker
          coordinate={{ latitude: emergencyLat, longitude: emergencyLng }}
          pinColor="#B3261E"
          onPress={() => setSelectedMarkerId('emergency')}
        >
          <Callout tooltip>
            <View className="bg-white rounded-2xl p-3 min-w-[180px] max-w-[260px] shadow-lg">
              <View className="flex-row items-center gap-2 mb-2">
                <Siren color="#B3261E" size={14} />
                <Text className="text-xs font-black text-red-600 uppercase tracking-widest">Active Emergency</Text>
              </View>
              <Text className="text-sm font-bold text-primary">{emergencyPost.title}</Text>
              {!!emergencyPost.description && (
                <Text className="text-xs text-gray-500 mt-1" numberOfLines={3}>
                  {emergencyPost.description}
                </Text>
              )}
              <Text className="text-xs text-gray-400 mt-2">By {emergencyPost.authorName}</Text>
            </View>
          </Callout>
        </Marker>

        {/* Security responders */}
        {activeResponders.map((responder) => (
          <Marker
            key={`resp-${responder.userId}`}
            coordinate={{
              latitude: responder.latitude,
              longitude: responder.longitude,
            }}
          >
            <View
              className="bg-teal-700 p-1.5 rounded-full border-2 border-white"
              style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 }}
            >
              <Shield color="white" size={14} />
            </View>
            <Callout tooltip>
              <View className="bg-white rounded-2xl p-3 min-w-[160px] shadow-lg">
                <View className="flex-row items-center gap-2 mb-2">
                  <Shield color="#0D9488" size={14} />
                  <Text className="text-xs font-black text-teal-700 uppercase tracking-widest">Responder</Text>
                </View>
                <Text className="text-sm font-bold text-primary">{responder.name}</Text>
                <Text className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-0.5">En Route</Text>
                <Text className="text-xs text-gray-400 mt-1">
                  {calculateDistance(responder.latitude, responder.longitude, emergencyLat, emergencyLng)}km away
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Community members with location */}
        {visibleMembers.map((member) => (
          <Marker
            key={`mem-${member.userId}`}
            coordinate={{
              latitude: member.latitude!,
              longitude: member.longitude!,
            }}
          >
            <View
              className="bg-emerald-500 rounded-full border-2 border-white"
              style={{ width: 14, height: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 }}
            />
            <Callout tooltip>
              <View className="bg-white rounded-2xl p-3 min-w-[160px] shadow-lg">
                <View className="flex-row items-center gap-2 mb-2">
                  <Users color="#10B981" size={14} />
                  <Text className="text-xs font-black text-emerald-600 uppercase tracking-widest">Community Member</Text>
                </View>
                <Text className="text-sm font-bold text-primary">{member.name}</Text>
                <Text className="text-xs text-gray-400 mt-1">
                  {calculateDistance(member.latitude!, member.longitude!, emergencyLat, emergencyLng)}km from emergency
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Legend overlay */}
      <View className="absolute top-20 left-4 bg-white/90 p-3 rounded-2xl shadow-lg gap-2">
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded-full bg-red-600" />
          <Text className="text-xs font-black text-primary-container uppercase tracking-widest">Source</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded-full bg-teal-700" />
          <Text className="text-xs font-black text-primary-container uppercase tracking-widest">Responders</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded-full bg-emerald-500" />
          <Text className="text-xs font-black text-primary-container uppercase tracking-widest">Members</Text>
        </View>
      </View>
    </View>
  );
};

export default EmergencyMap;
