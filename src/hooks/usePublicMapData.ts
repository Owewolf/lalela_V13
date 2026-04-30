import { useState, useEffect } from 'react';
import type { PublicCommunity } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lalela.net/api';

interface PublicMapData {
  communities: PublicCommunity[];
  isLoading: boolean;
  error: string | null;
}

let cachedCommunities: PublicCommunity[] | null = null;

export function usePublicMapData(): PublicMapData {
  const [communities, setCommunities] = useState<PublicCommunity[]>(cachedCommunities || []);
  const [isLoading, setIsLoading] = useState(!cachedCommunities);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedCommunities) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/communities`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PublicCommunity[] = await res.json();

        if (!cancelled) {
          cachedCommunities = data;
          setCommunities(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load communities');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { communities, isLoading, error };
}
