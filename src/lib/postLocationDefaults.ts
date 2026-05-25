import type { Community, CommunityNotice, UserProfile } from '../types';

export type PostLocationSource = NonNullable<CommunityNotice['source']>;

export interface ResolvedCreateLocationState {
  latitude?: number;
  longitude?: number;
  locationName: string;
  source: PostLocationSource;
}

export interface LocationResetTarget {
  latitude: number;
  longitude: number;
  locationName: string;
  source: 'profile_default';
  kind: 'community_default' | 'profile_default';
}

export interface CreatePostLocationDefaults {
  initialState: ResolvedCreateLocationState;
  mapFallback: {
    latitude: number;
    longitude: number;
    locationName: string;
  };
  resetTarget: LocationResetTarget | null;
  shouldUseCurrentLocation: boolean;
}

const HARD_FALLBACK = {
  latitude: -26.2041,
  longitude: 28.0473,
  locationName: 'Johannesburg, South Africa',
};

const hasValidCoords = (latitude?: number, longitude?: number) => {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

const resolveCoverageLocation = (currentCommunity?: Community | null) => {
  const coverage = currentCommunity?.coverageArea;
  if (!coverage || !hasValidCoords(coverage.latitude, coverage.longitude)) return null;

  return {
    latitude: coverage.latitude,
    longitude: coverage.longitude,
    locationName: coverage.locationName || 'Community Area',
  };
};

const resolveProfileLocation = (userProfile?: UserProfile | null) => {
  const profileLocation = userProfile?.defaultLocation;
  if (!userProfile?.locationSharing || !profileLocation) return null;
  if (!hasValidCoords(profileLocation.latitude, profileLocation.longitude)) return null;

  return {
    latitude: profileLocation.latitude,
    longitude: profileLocation.longitude,
    locationName: profileLocation.name || 'My Location',
  };
};

export const resolveCreatePostLocationDefaults = (
  currentCommunity?: Community | null,
  userProfile?: UserProfile | null,
): CreatePostLocationDefaults => {
  const coverageLocation = resolveCoverageLocation(currentCommunity);
  const profileLocation = resolveProfileLocation(userProfile);

  if (coverageLocation) {
    return {
      initialState: {
        ...coverageLocation,
        source: 'profile_default',
      },
      mapFallback: coverageLocation,
      resetTarget: {
        ...coverageLocation,
        source: 'profile_default',
        kind: 'community_default',
      },
      shouldUseCurrentLocation: false,
    };
  }

  if (profileLocation) {
    return {
      initialState: {
        ...profileLocation,
        source: 'profile_default',
      },
      mapFallback: profileLocation,
      resetTarget: {
        ...profileLocation,
        source: 'profile_default',
        kind: 'profile_default',
      },
      shouldUseCurrentLocation: false,
    };
  }

  if (userProfile?.locationSharing) {
    return {
      initialState: {
        locationName: '',
        source: 'profile_default',
      },
      mapFallback: HARD_FALLBACK,
      resetTarget: null,
      shouldUseCurrentLocation: true,
    };
  }

  return {
    initialState: {
      ...HARD_FALLBACK,
      source: 'profile_default',
    },
    mapFallback: HARD_FALLBACK,
    resetTarget: null,
    shouldUseCurrentLocation: false,
  };
};
