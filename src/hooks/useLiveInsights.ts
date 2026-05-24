import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';

export type CommunityEnergy = 'QUIET' | 'MEDIUM' | 'ACTIVE' | 'HIGH';

export type LiveFeedItem = {
  id: string;
  kind: 'post' | 'join' | 'business' | 'donation';
  icon: string;
  message: string;
  timestamp: string;
};

export interface LiveInsightsCounts {
  postsLast24h: number;
  newMembersLast7d: number;
  alertsActive: number;
  alertsResolved24h: number;
  donationsTotal: number;
  donationsLast24h: number;
  businessesAdded7d: number;
  respondersOnline: number;
  moderatorsOnline: number;
  activeReports: number;
}

export interface LiveInsightsData {
  energy: CommunityEnergy;
  counts: LiveInsightsCounts;
  feed: LiveFeedItem[];
  insights: {
    mostActiveArea: string | null;
    topCategory: string | null;
    activeVolunteers: number;
    engagementScore: number;
  };
}

const POLL_INTERVAL_MS = 30_000;

export function useLiveInsights(communityId: string | undefined | null) {
  const [data, setData] = useState<LiveInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!communityId || communityId === 'loading') return;
    try {
      const { data: res } = await api.get(`/communities/${communityId}/live-insights`);
      if (!cancelledRef.current) {
        setData(res);
        setError(null);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load insights');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!communityId || communityId === 'loading') {
      setData(null);
      return;
    }
    setLoading(true);
    fetchOnce();
    timerRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [communityId, fetchOnce]);

  return { data, loading, error, refresh: fetchOnce };
}
