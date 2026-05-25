import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import { Shield, Siren, Users } from 'lucide-react-native';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { useCommunity } from '../../context/CommunityContext';
import { CommunityNotice } from '../../types';
import { deriveEmergencyResponders } from './responderUtils';

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
  const [focusedPerson, setFocusedPerson] = useState<{
    id: string;
    name: string;
    role: 'Responder' | 'Member';
    distanceKm: string;
  } | null>(null);

  const internalRef = React.useRef<MapView>(null);
  const ref = mapRef ?? internalRef;

  const emergencyLat = emergencyPost.latitude ?? -26.2041;
  const emergencyLng = emergencyPost.longitude ?? 28.0473;

  const initialRegion = regionForRadius(emergencyLat, emergencyLng, EMERGENCY_RADIUS);

  const recenterToEmergencyRadius = React.useCallback(() => {
    if (!ref.current) return;
    if (Platform.OS === 'web') return;
    try {
      ref.current.animateToRegion(
        regionForRadius(emergencyLat, emergencyLng, EMERGENCY_RADIUS),
        450,
      );
    } catch (error) {
      console.warn('Map animation error:', error);
    }
  }, [ref, emergencyLat, emergencyLng]);

  // Recenter when resetTrigger changes
  React.useEffect(() => {
    if (resetTrigger === undefined) return;
    recenterToEmergencyRadius();
  }, [resetTrigger, recenterToEmergencyRadius]);

  const activeResponders = useMemo(
    () =>
      deriveEmergencyResponders(securityResponders, members, {
        latitude: emergencyLat,
        longitude: emergencyLng,
      }),
    [securityResponders, members, emergencyLat, emergencyLng],
  );

  const responderIds = useMemo(
    () => new Set(activeResponders.map((r) => r.userId)),
    [activeResponders],
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

  React.useEffect(() => {
    recenterToEmergencyRadius();
  }, [recenterToEmergencyRadius]);

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
        {activeResponders.map((responder) => {
          const distanceKm = calculateDistance(
            responder.latitude,
            responder.longitude,
            emergencyLat,
            emergencyLng,
          );

          return (
            <Marker
              key={`resp-${responder.userId}`}
              coordinate={{
                latitude: responder.latitude,
                longitude: responder.longitude,
              }}
              onSelect={() =>
                setFocusedPerson({
                  id: responder.userId,
                  name: responder.name,
                  role: 'Responder',
                  distanceKm,
                })
              }
              onDeselect={() => {
                setFocusedPerson((prev) => (prev?.id === responder.userId ? null : prev));
              }}
              onPress={() =>
                setFocusedPerson({
                  id: responder.userId,
                  name: responder.name,
                  role: 'Responder',
                  distanceKm,
                })
              }
            >
              <View
                className="bg-teal-700 p-1.5 rounded-full border-2 border-white"
                style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 }}
              >
                <Shield color="white" size={14} />
              </View>
              <Callout tooltip>
                <View className="bg-white rounded-2xl p-3 min-w-[180px] shadow-lg">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Shield color="#0D9488" size={14} />
                    <Text className="text-xs font-black text-teal-700 uppercase tracking-widest">Responder</Text>
                  </View>
                  <Text className="text-sm font-bold text-primary">{responder.name}</Text>
                  <Text className="text-xs text-gray-400 mt-1">{distanceKm}km from emergency</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Community members with location */}
        {visibleMembers.map((member) => {
          const distanceKm = calculateDistance(
            member.latitude!,
            member.longitude!,
            emergencyLat,
            emergencyLng,
          );

          return (
            <Marker
              key={`mem-${member.userId}`}
              coordinate={{
                latitude: member.latitude!,
                longitude: member.longitude!,
              }}
              onSelect={() =>
                setFocusedPerson({
                  id: member.userId,
                  name: member.name || 'Community Member',
                  role: 'Member',
                  distanceKm,
                })
              }
              onDeselect={() => {
                setFocusedPerson((prev) => (prev?.id === member.userId ? null : prev));
              }}
              onPress={() =>
                setFocusedPerson({
                  id: member.userId,
                  name: member.name || 'Community Member',
                  role: 'Member',
                  distanceKm,
                })
              }
            >
              <View
                className="bg-emerald-500 rounded-full border-2 border-white"
                style={{ width: 14, height: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 }}
              />
              <Callout tooltip>
                <View className="bg-white rounded-2xl p-3 min-w-[180px] shadow-lg">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Users color="#10B981" size={14} />
                    <Text className="text-xs font-black text-emerald-600 uppercase tracking-widest">Community Member</Text>
                  </View>
                  <Text className="text-sm font-bold text-primary">{member.name || 'Community Member'}</Text>
                  <Text className="text-xs text-gray-400 mt-1">{distanceKm}km from emergency</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {focusedPerson && (
        <View className="absolute bottom-4 left-4 right-4 bg-white/95 border border-gray-200 rounded-2xl px-4 py-3 shadow">
          <Text className="text-sm font-black text-primary" numberOfLines={1}>
            {focusedPerson.name}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {focusedPerson.role} • {focusedPerson.distanceKm}km from emergency
          </Text>
        </View>
      )}
    </View>
  );
};

export default EmergencyMap;
