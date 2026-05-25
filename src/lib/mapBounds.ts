export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const KM_PER_LATITUDE_DEGREE = 111;
const DEFAULT_PADDING_FACTOR = 1.25;
const DEFAULT_MIN_DELTA = 0.008;

const sanitizeCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const extractMapCoordinates = (records: any[]): MapCoordinate[] =>
  records
    .map((record) => {
      const latitude = sanitizeCoordinate(record?.latitude);
      const longitude = sanitizeCoordinate(record?.longitude);
      if (latitude == null || longitude == null) return null;
      return { latitude, longitude };
    })
    .filter((point): point is MapCoordinate => !!point);

export const regionForRadius = (
  latitude: number,
  longitude: number,
  radiusMeters: number,
  paddingFactor = 2.2
): MapRegion => {
  const latDelta = ((radiusMeters * paddingFactor) / 1000) / KM_PER_LATITUDE_DEGREE;
  const lonDelta = latDelta / Math.max(Math.cos((latitude * Math.PI) / 180), 0.1);
  return {
    latitude,
    longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
};

export const regionForCoordinates = (
  coordinates: MapCoordinate[],
  options?: {
    baselineRadiusMeters?: number;
    paddingFactor?: number;
    minDelta?: number;
  }
): MapRegion | null => {
  if (!coordinates.length) return null;

  const minLat = Math.min(...coordinates.map((c) => c.latitude));
  const maxLat = Math.max(...coordinates.map((c) => c.latitude));
  const minLng = Math.min(...coordinates.map((c) => c.longitude));
  const maxLng = Math.max(...coordinates.map((c) => c.longitude));

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const paddingFactor = options?.paddingFactor ?? DEFAULT_PADDING_FACTOR;
  const minDelta = options?.minDelta ?? DEFAULT_MIN_DELTA;

  const boundsLatitudeDelta = Math.max((maxLat - minLat) * paddingFactor, minDelta);
  const boundsLongitudeDelta = Math.max((maxLng - minLng) * paddingFactor, minDelta);

  if (!options?.baselineRadiusMeters) {
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: boundsLatitudeDelta,
      longitudeDelta: boundsLongitudeDelta,
    };
  }

  const baseline = regionForRadius(centerLat, centerLng, options.baselineRadiusMeters);
  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max(boundsLatitudeDelta, baseline.latitudeDelta),
    longitudeDelta: Math.max(boundsLongitudeDelta, baseline.longitudeDelta),
  };
};

export const regionForCoordinateCircles = (
  coordinates: MapCoordinate[],
  radiusMeters: number,
  options?: {
    paddingFactor?: number;
    minDelta?: number;
  }
): MapRegion | null => {
  if (!coordinates.length) return null;

  const radiusLatitudeDegrees = (radiusMeters / 1000) / KM_PER_LATITUDE_DEGREE;

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const coordinate of coordinates) {
    const longitudeDegrees =
      radiusLatitudeDegrees /
      Math.max(Math.cos((coordinate.latitude * Math.PI) / 180), 0.1);

    minLat = Math.min(minLat, coordinate.latitude - radiusLatitudeDegrees);
    maxLat = Math.max(maxLat, coordinate.latitude + radiusLatitudeDegrees);
    minLng = Math.min(minLng, coordinate.longitude - longitudeDegrees);
    maxLng = Math.max(maxLng, coordinate.longitude + longitudeDegrees);
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const paddingFactor = options?.paddingFactor ?? 1.08;
  const minDelta = options?.minDelta ?? DEFAULT_MIN_DELTA;

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max((maxLat - minLat) * paddingFactor, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * paddingFactor, minDelta),
  };
};