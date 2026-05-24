import { useCallback, useEffect, useState } from 'react';
import { useCommunity } from '../context/CommunityContext';

export type MapFilter = 'members' | 'listings' | 'notices' | 'businesses' | undefined;

export interface MapCenter {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

/**
 * Shared state + handlers for the InteractiveCoverageMap.
 *
 * Used by HomePage and AdminDashboard so both maps behave identically:
 * - Centers on the community's coverageArea on load.
 * - Recenters on the latest emergency post when one exists.
 * - "Live Pulse: All Secure" recenters and relocks the map.
 * - Tracks unlock state and an optional UI-driven filter override.
 */
export function useCommunityMap() {
  const { currentCommunity, posts } = useCommunity();

  const [mapCenter, setMapCenter] = useState<MapCenter>({
    latitude: -26.2041,
    longitude: 28.0473,
  });
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [mapFilterOverride, setMapFilterOverride] = useState<MapFilter>(undefined);
  const [mapUnlocked, setMapUnlocked] = useState(false);

  // Center on the community's coverage area when it changes.
  useEffect(() => {
    if (currentCommunity?.coverageArea) {
      const { latitude, longitude, radius } = currentCommunity.coverageArea;
      const latDelta = (radius * 2.2) / 111;
      const latRad = latitude * (Math.PI / 180);
      const lonDelta = (radius * 2.2) / (111 * Math.cos(latRad));
      setMapCenter({
        latitude,
        longitude,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      });
    }
  }, [currentCommunity?.id, currentCommunity?.coverageArea]);

  // Track emergency activity + recenter on the latest emergency post.
  useEffect(() => {
    const hasEmergencyPost = posts.some(
      (p: any) => p.urgency === 'emergency' || p.urgencyLevel === 'emergency'
    );
    const isEmergency = hasEmergencyPost || !!currentCommunity?.isEmergencyMode;
    setIsEmergencyActive(isEmergency);

    if (isEmergency) {
      const latest = posts.find(
        (p: any) => p.urgency === 'emergency' || p.urgencyLevel === 'emergency'
      );
      if (latest?.latitude && latest?.longitude) {
        setMapCenter({
          latitude: latest.latitude,
          longitude: latest.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    }
  }, [currentCommunity?.isEmergencyMode, posts]);

  const resetCommunityMapView = useCallback(() => {
    if (currentCommunity?.coverageArea) {
      const { latitude, longitude, radius } = currentCommunity.coverageArea;
      const latDelta = (radius * 2.2) / 111;
      const latRad = latitude * (Math.PI / 180);
      const lonDelta = (radius * 2.2) / (111 * Math.cos(latRad));
      setMapCenter({
        latitude,
        longitude,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      });
      setResetTrigger((t) => t + 1);
      setMapUnlocked(false);
    }
  }, [currentCommunity?.coverageArea]);

  const findLatestEmergencyPost = useCallback(() => {
    return posts.find(
      (p: any) => p.urgency === 'emergency' || p.urgencyLevel === 'emergency'
    );
  }, [posts]);

  return {
    // state
    mapCenter,
    setMapCenter,
    resetTrigger,
    setResetTrigger,
    isEmergencyActive,
    mapFilterOverride,
    setMapFilterOverride,
    mapUnlocked,
    setMapUnlocked,
    // helpers
    resetCommunityMapView,
    findLatestEmergencyPost,
  };
}
