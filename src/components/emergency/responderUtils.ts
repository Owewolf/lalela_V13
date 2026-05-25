import { CommunityMember } from '../../types';

interface SecurityResponderLocation {
  userId: string;
  name: string;
  image: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface EmergencyResponder {
  userId: string;
  name: string;
  image?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  source: 'live' | 'member';
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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
  return R * c;
};

export const deriveEmergencyResponders = (
  securityResponders: SecurityResponderLocation[],
  members: CommunityMember[],
  referenceLocation?: { latitude: number; longitude: number },
): EmergencyResponder[] => {
  const unique = new Map<string, EmergencyResponder>();

  for (const responder of securityResponders) {
    const latitude = toFiniteNumber(responder.latitude);
    const longitude = toFiniteNumber(responder.longitude);
    if (latitude === null || longitude === null) continue;

    unique.set(responder.userId, {
      userId: responder.userId,
      name: responder.name || 'Security Responder',
      image: responder.image,
      latitude,
      longitude,
      timestamp: responder.timestamp || new Date().toISOString(),
      source: 'live',
    });
  }

  for (const member of members) {
    if (!member.isSecurityMember || unique.has(member.userId)) continue;
    const latitude = toFiniteNumber(member.latitude);
    const longitude = toFiniteNumber(member.longitude);
    if (latitude === null || longitude === null) continue;

    unique.set(member.userId, {
      userId: member.userId,
      name: member.name || 'Security Member',
      image: member.image,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      source: 'member',
    });
  }

  const responders = Array.from(unique.values());
  if (!referenceLocation) return responders;

  return responders.sort((a, b) => {
    const aDistance = distanceKm(a.latitude, a.longitude, referenceLocation.latitude, referenceLocation.longitude);
    const bDistance = distanceKm(b.latitude, b.longitude, referenceLocation.latitude, referenceLocation.longitude);
    return aDistance - bDistance;
  });
};
