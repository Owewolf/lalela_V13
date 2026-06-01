/**
 * CommunityContext — REST + Socket.io community state.
 *
 * Data flow:
 *   Initial load  → REST GET via src/lib/api.ts (axios + JWT)
 *   Realtime push → Socket.io events from server/index.ts
 *   Writes        → REST POST/PUT/DELETE, then server emits socket event to all subscribers
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback,
  useRef, useMemo, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../lib/api';
import { resolveMediaUrl } from '../lib/config';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { useCommunityBootstrap } from '../hooks/queries/useCommunityBootstrap';
import { useCommunityBundle } from '../hooks/queries/useCommunityBundle';
import { prefetchConversationMessages, useConversationMessages } from '../hooks/queries/useConversationMessages';
import { getSocket, disconnectSocket } from '../lib/socket';
import type {
  Community, CommunityContextType, UserBusiness, CoverageArea, Business,
  Charity, CommunityNotice, CommunityMember, UserProfile, UserRole,
  Conversation, Message, CharitySuggestion, CommunityInvitation,
  CommunityInviteLink, AppNotification, NotificationPreferences, ChatUnreadTotals,
  FeaturedCharitySummary,
} from '../types';

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_COMMUNITY: Community = {
  id: '',
  name: '',
  ownerId: '',
  type: 'TRIAL',
  trialEndDate: null,
  status: 'ACTIVE',
  coverageArea: { latitude: 0, longitude: 0, radius: 1, locationName: '' },
};

const EMPTY_UNREAD: ChatUnreadTotals = {
  direct: 0, listing: 0, notice: 0, marketplace: 0,
  community: 0, emergency: 0, totalMessages: 0, unreadFilterTotal: 0,
};

const CONVERSATION_CACHE_LIMIT = 80;
const MESSAGE_CACHE_LIMIT = 200;
const BUSINESS_PLACEHOLDER_IMAGE = '/defaults/business-placeholder.png';

function conversationsCacheKey(userId: string) {
  return `chat:conversations:${userId}`;
}

function messagesCacheKey(userId: string, conversationId: string) {
  return `chat:messages:${userId}:${conversationId}`;
}

function parseCachedArray<T>(raw: string | null): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

/** Map raw Prisma/REST response to the client-side Community shape. */
function mapServerCommunity(raw: any): Community {
  // Prisma returns camelCase; also accept snake_case fallback for any legacy payloads
  const lat  = raw.coverageLat  ?? raw.coverage_lat;
  const lng  = raw.coverageLng  ?? raw.coverage_lng;
  const rad  = raw.coverageRadius  ?? raw.coverage_radius ?? 1;
  const loc  = raw.coverageLocation ?? raw.coverage_location ?? '';
  const coverageArea: CoverageArea | undefined =
    lat != null && lng != null
      ? { latitude: lat, longitude: lng, radius: rad, locationName: loc }
      : raw.coverageArea;
  return { ...raw, coverageArea };
}

function normalizePostMedia(post: CommunityNotice): CommunityNotice {
  const listingImage = post.type === 'listing'
    ? (post.postsImage ?? (post as any).imageUrl ?? null)
    : (post.postsImage ?? null);
  const normalizedPostsImage = resolveMediaUrl(listingImage) ?? listingImage;
  const normalizedAuthorImage = resolveMediaUrl(post.authorImage ?? null) ?? post.authorImage ?? null;

  return {
    ...post,
    postsImage: normalizedPostsImage,
    authorImage: normalizedAuthorImage,
  };
}

function normalizePostsMedia(posts: CommunityNotice[]): CommunityNotice[] {
  return posts.map(normalizePostMedia);
}

function normalizeBusinessMedia<T extends Record<string, any>>(business: T): T {
  const raw = [business?.imageUrl, business?.image]
    .map((value) => String(value ?? '').trim())
    .find(Boolean) ?? BUSINESS_PLACEHOLDER_IMAGE;
  const resolved = resolveMediaUrl(raw);
  const normalized = (typeof resolved === 'string' && resolved.trim()) ? resolved : raw;
  return {
    ...business,
    image: normalized,
    imageUrl: normalized,
  };
}

function normalizeBusinessesMedia<T extends Record<string, any>>(businesses: T[]): T[] {
  return businesses.map(normalizeBusinessMedia);
}

function appendUniqueMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing;

  const seen = new Set(existing.map((item) => item.id));
  const additions: Message[] = [];

  for (const item of incoming) {
    if (!item?.id) {
      additions.push(item);
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    additions.push(item);
  }

  if (additions.length === 0) return existing;
  return [...existing, ...additions];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CommunityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile, updateUserProfile, refreshProfile } = useAuth();
  const userId = userProfile?.id ?? null;
  const currentCommunityId = userProfile?.lastCommunityId ?? null;
  const bootstrapQuery = useCommunityBootstrap(userId);
  const fallbackCommunityId = bootstrapQuery.data?.communities?.[0]?.id ?? null;
  const activeCommunityId = currentCommunityId ?? fallbackCommunityId;
  const bundleQuery = useCommunityBundle(activeCommunityId, userId);

  // ── State ─────────────────────────────────────────────────────────────────
  const [communities, setCommunities] = useState<Community[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<CommunityNotice[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [charitySuggestions, setCharitySuggestions] = useState<CharitySuggestion[]>([]);
  const [userBusinesses, setUserBusinesses] = useState<UserBusiness[]>([]);
  const [communityBusinesses, setCommunityBusinesses] = useState<UserBusiness[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userInvitations, setUserInvitations] = useState<CommunityInvitation[]>([]);
  const [communityInvitations, setCommunityInvitations] = useState<CommunityInvitation[]>([]);
  const [activeCommunityLink, setActiveCommunityLink] = useState<CommunityInviteLink | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [securityResponders, setSecurityResponders] = useState<CommunityContextType['securityResponders']>([]);
  const messagesQuery = useConversationMessages(activeConversationId);

  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const autoSelectAttemptedCommunityRef = useRef<string | null>(null);
  const hydratedConversationsForUserRef = useRef<string | null>(null);
  // Tracks the active conversation id so socket handlers (bound once per
  // community/user) can read the current value without closing over stale state.
  const activeConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const refreshCommunities = useCallback(async () => {
    await bootstrapQuery.refetch();
  }, [bootstrapQuery]);

  const currentCommunity = useMemo(
    () => communities.find((c) => c.id === activeCommunityId) ?? EMPTY_COMMUNITY,
    [communities, activeCommunityId],
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  // Aggregate unread totals across all conversations for the viewer.
  // Used by the bottom tab badge (totalMessages) and chat filter chips.
  const chatUnreadTotals = useMemo<ChatUnreadTotals>(() => {
    const totals = { ...EMPTY_UNREAD };
    for (const conv of conversations) {
      const n = conv.unreadCount || 0;
      if (n <= 0) continue;
      totals.totalMessages += n;
      const contextType = (conv.metadata?.type as string | undefined) ?? null;
      switch (conv.type) {
        case 'direct':
          if (contextType === 'listing') totals.listing += n;
          else if (contextType === 'notice') totals.notice += n;
          else totals.direct += n;
          break;
        case 'listing':
          if (conv.metadata?.source === 'marketplace') totals.marketplace += n;
          else totals.listing += n;
          break;
        case 'notice':
          totals.notice += n;
          break;
        case 'community':
          totals.community += n;
          break;
        case 'emergency':
          totals.emergency += n;
          break;
      }
    }
    totals.unreadFilterTotal =
      totals.direct + totals.listing + totals.notice + totals.marketplace;
    return totals;
  }, [conversations]);

  // ─── Bootstrap queries ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      hydratedConversationsForUserRef.current = null;
      return;
    }

    let cancelled = false;

    AsyncStorage.getItem(conversationsCacheKey(userId))
      .then((raw) => {
        if (cancelled) return;
        const cached = parseCachedArray<Conversation>(raw);
        if (!cached || cached.length === 0) return;
        setConversations((prev) => (prev.length > 0 ? prev : cached));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) hydratedConversationsForUserRef.current = userId;
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCommunities([]);
      setConversations([]);
      setNotifications([]);
      return;
    }

    if (!bootstrapQuery.data) return;

    setCommunities((bootstrapQuery.data?.communities ?? []).map(mapServerCommunity));
    setConversations(bootstrapQuery.data?.conversations ?? []);
    setNotifications(bootstrapQuery.data?.notifications ?? []);
  }, [userId, bootstrapQuery.data]);

  useEffect(() => {
    if (!userId) return;
    if (hydratedConversationsForUserRef.current !== userId) return;
    AsyncStorage.setItem(
      conversationsCacheKey(userId),
      JSON.stringify(conversations.slice(0, CONVERSATION_CACHE_LIMIT))
    ).catch(() => undefined);
  }, [userId, conversations]);

  // If lastCommunityId is set but not yet in the communities list (e.g. just
  // created), re-fetch once to pick it up with the correct userRole.
  useEffect(() => {
    if (!activeCommunityId) {
      setMembers([]);
      setPosts([]);
      setCharities([]);
      setCharitySuggestions([]);
      setUserBusinesses([]);
      setCommunityBusinesses([]);
      setSecurityResponders([]);
      return;
    }

    if (!bundleQuery.data) return;

    setMembers(bundleQuery.data?.members ?? []);
    setPosts(normalizePostsMedia(bundleQuery.data?.posts ?? []));
    setCharities(bundleQuery.data?.charities ?? []);
    setCharitySuggestions(bundleQuery.data?.charitySuggestions ?? []);
    const allBusinesses = normalizeBusinessesMedia(bundleQuery.data?.businesses ?? []) as UserBusiness[];
    setUserBusinesses(allBusinesses.filter((b) => b.ownerId === userId));
    setCommunityBusinesses(allBusinesses.filter((b) => (b.communityIds ?? []).includes(activeCommunityId)));
    setSecurityResponders(bundleQuery.data?.locations?.security ?? []);
  }, [activeCommunityId, bundleQuery.data, userId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    if (!userId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    AsyncStorage.getItem(messagesCacheKey(userId, activeConversationId))
      .then((raw) => {
        if (cancelled) return;
        const cached = parseCachedArray<Message>(raw) ?? [];
        setMessages(cached);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (messagesQuery.data === undefined) return;
    setMessages(messagesQuery.data);
  }, [activeConversationId, messagesQuery.data]);

  useEffect(() => {
    if (!userId || !activeConversationId) return;
    AsyncStorage.setItem(
      messagesCacheKey(userId, activeConversationId),
      JSON.stringify(messages.slice(-MESSAGE_CACHE_LIMIT))
    ).catch(() => undefined);
  }, [userId, activeConversationId, messages]);

  // ── Socket.io realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    let active = true;

    const connect = async () => {
      const socket = await getSocket();
      if (!active) return;
      socketRef.current = socket;

      // Join rooms
      if (activeCommunityId) socket.emit('join:community', { communityId: activeCommunityId });

      // ── Inbound events ──
      socket.on('post:new', (post: CommunityNotice) => {
        const normalizedPost = normalizePostMedia(post);
        setPosts((prev) => [normalizedPost, ...prev.filter((p) => p.id !== normalizedPost.id)]);
      });
      socket.on('post:updated', (post: CommunityNotice) => {
        const normalizedPost = normalizePostMedia(post);
        setPosts((prev) => prev.map((p) => (p.id === normalizedPost.id ? normalizedPost : p)));
      });
      socket.on('post:deleted', ({ id }: { id: string }) => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      });

      socket.on('message:new', (msg: Message) => {
        const convId = (msg as any).conversationId as string | undefined;
        const senderId = (msg as any).userId as string | undefined;
        const activeId = activeConversationIdRef.current;
        if (convId) {
          queryClient.setQueryData(queryKeys.conversationMessages(convId), (existing: Message[] | undefined) => {
            return appendUniqueMessages(existing ?? [], [msg]);
          });
        }
        // Only append to in-memory messages list if it belongs to the open conversation.
        setMessages((prev) => (convId && convId === activeId ? appendUniqueMessages(prev, [msg]) : prev));
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const isMine = senderId === userId;
            const isActive = convId === activeId;
            // Bump unread for the viewer only when the message is from someone else
            // and the conversation isn't currently open.
            const shouldIncrement = !isMine && !isActive;
            return {
              ...c,
              lastMessage: msg.content ?? '',
              lastMessageAt: (msg as any).createdAt ?? c.lastMessageAt,
              unreadCount: shouldIncrement ? (c.unreadCount || 0) + 1 : c.unreadCount,
            };
          })
        );
      });

      socket.on('typing:start', ({ userId: tId }: { userId: string }) => {
        if (tId !== userId) setIsTyping(true);
      });
      socket.on('typing:stop', ({ userId: tId }: { userId: string }) => {
        if (tId !== userId) setIsTyping(false);
      });

      socket.on('location:update', (loc: { userId: string; name: string; image: string; latitude: number; longitude: number; timestamp: string }) => {
        setSecurityResponders((prev) => {
          const filtered = prev.filter((r) => r.userId !== loc.userId);
          return [...filtered, loc];
        });
      });

      socket.on('notification:new', (notif: AppNotification) => {
        setNotifications((prev) => [notif, ...prev]);
      });
    };

    connect().catch(console.error);

    return () => {
      active = false;
      socketRef.current?.off('post:new');
      socketRef.current?.off('post:updated');
      socketRef.current?.off('post:deleted');
      socketRef.current?.off('message:new');
      socketRef.current?.off('typing:start');
      socketRef.current?.off('typing:stop');
      socketRef.current?.off('location:update');
      socketRef.current?.off('notification:new');
    };
  }, [userId, activeCommunityId]);

    // Join conversation room when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    socketRef.current?.emit('join:conversation', { conversationId: activeConversationId });
  }, [activeConversationId]);

  // ── Context methods ───────────────────────────────────────────────────────

  const setCurrentCommunity = useCallback(async (id: string) => {
    // Update local auth state immediately so the UI reacts without waiting for the server
    await updateUserProfile({ lastCommunityId: id } as any);
    // Persist to server in background
    api.put('/users/me', { lastCommunityId: id }).catch(console.error);
    if (socketRef.current) {
      if (activeCommunityId) socketRef.current.emit('leave:community', { communityId: activeCommunityId });
      socketRef.current.emit('join:community', { communityId: id });
    }
  }, [activeCommunityId, updateUserProfile]);

  useEffect(() => {
    if (currentCommunityId) {
      autoSelectAttemptedCommunityRef.current = null;
      return;
    }

    if (!activeCommunityId) return;
    if (autoSelectAttemptedCommunityRef.current === activeCommunityId) return;

    autoSelectAttemptedCommunityRef.current = activeCommunityId;
    setCurrentCommunity(activeCommunityId).catch((error) => {
      autoSelectAttemptedCommunityRef.current = null;
      console.error('Failed to persist selected community:', error);
    });
  }, [currentCommunityId, activeCommunityId, setCurrentCommunity]);

  const createCommunity = useCallback(async (name: string): Promise<string> => {
    const { data } = await api.post('/communities', { name });
    setCommunities((prev) => [...prev, mapServerCommunity(data)]);
    return data.id;
  }, []);

  const licenseCommunity = useCallback(async (communityId: string) => {
    const { data } = await api.post(`/communities/${communityId}/license`);
    // Server transitions the community to ACTIVE (isPaid=true, activatedAt=now)
    // and the owner's membership to ACTIVE (subscriptionActive=true, +1y renewal).
    // Mirror those fields locally so the UI flips immediately, then refresh from
    // the server in the background to pick up activatedAt / licenseId / etc.
    const renewalDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    setCommunities((prev) => prev.map((c) => c.id === communityId
      ? {
          ...c,
          ...mapServerCommunity(data),
          type: 'ACTIVE',
          status: 'ACTIVE',
          isPaid: true,
          activatedAt: data?.activatedAt ?? new Date().toISOString(),
          licenseId: data?.licenseId ?? c.licenseId,
        }
      : c
    ));
    await updateUserProfile({
      licenseStatus: 'ACTIVE',
      subscriptionActive: true,
      subscriptionRenewalDate: renewalDate,
    } as any);
    await bootstrapQuery.refetch();
  }, [updateUserProfile, bootstrapQuery]);

  const updateCommunityCoverage = useCallback(async (communityId: string, coverage: CoverageArea) => {
    await api.put(`/communities/${communityId}`, {
      coverageLat: coverage.latitude,
      coverageLng: coverage.longitude,
      coverageRadius: coverage.radius,
      coverageLocation: coverage.locationName,
    });
    setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, coverageArea: coverage } : c));
  }, []);

  const updateCommunityCategories = useCallback(async (communityId: string, categories: string[]) => {
    await api.put(`/communities/${communityId}`, { categories });
    setCommunities((prev) => prev.map((c) => c.id === communityId ? { ...c, categories } : c));
  }, []);

  // ── Businesses ────────────────────────────────────────────────────────────
  const addCommunityBusiness = useCallback(async (communityId: string, business: Business) => {
    const { data } = await api.post('/businesses', { ...business, communityId: communityId });
    const normalized = normalizeBusinessMedia(data);
    setCommunityBusinesses((prev) => [...prev, normalized]);
  }, []);

  const updateCommunityBusiness = useCallback(async (_communityId: string, business: Business) => {
    const { data } = await api.put(`/businesses/${business.id}`, business);
    const normalized = normalizeBusinessMedia(data);
    setCommunityBusinesses((prev) => prev.map((b) => b.id === business.id ? normalized : b));
  }, []);

  const removeCommunityBusiness = useCallback(async (_communityId: string, businessId: string) => {
    await api.delete(`/businesses/${businessId}`);
    setCommunityBusinesses((prev) => prev.filter((b) => b.id !== businessId));
    setUserBusinesses((prev) => prev.filter((b) => b.id !== businessId));
    setCommunities((prev) => prev.map((community) => {
      const communityBusinesses = Array.isArray((community as any).businesses)
        ? (community as any).businesses.filter((b: any) => b?.id !== businessId)
        : (community as any).businesses;
      return { ...community, businesses: communityBusinesses };
    }));
    if (currentCommunityId) {
      queryClient.setQueryData(queryKeys.communityBundle(currentCommunityId), (prev: any) => {
        if (!prev) return prev;
        const bundleBusinesses = Array.isArray(prev.businesses)
          ? prev.businesses.filter((b: any) => b?.id !== businessId)
          : prev.businesses;
        return { ...prev, businesses: bundleBusinesses };
      });
    }
  }, [currentCommunityId]);

  const bulkAddCommunityBusinesses = useCallback(async (communityId: string, businesses: Business[]) => {
    await api.post('/businesses/import', { communityId, businesses });
    if (currentCommunityId === communityId) {
      await bundleQuery.refetch();
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.communityBundle(communityId) });
  }, [bundleQuery, currentCommunityId]);

  const addUserBusiness = useCallback(async (business: Omit<UserBusiness, 'id'>) => {
    const { data } = await api.post('/businesses', business);
    const normalized = normalizeBusinessMedia(data);
    setUserBusinesses((prev) => [...prev, normalized]);
    if (currentCommunityId && (data.communityIds ?? []).includes(currentCommunityId)) {
      setCommunityBusinesses((prev) => [...prev, normalized]);
    }
  }, [currentCommunityId]);

  const updateUserBusiness = useCallback(async (business: UserBusiness) => {
    const { data } = await api.put(`/businesses/${business.id}`, business);
    const normalized = normalizeBusinessMedia(data);
    setUserBusinesses((prev) => prev.map((b) => b.id === business.id ? normalized : b));
    setCommunityBusinesses((prev) => prev.map((b) => b.id === business.id ? normalized : b));
  }, []);

  const removeUserBusiness = useCallback(async (id: string) => {
    await api.delete(`/businesses/${id}`);
    setUserBusinesses((prev) => prev.filter((b) => b.id !== id));
    setCommunityBusinesses((prev) => prev.filter((b) => b.id !== id));
    setCommunities((prev) => prev.map((community) => {
      const communityBusinesses = Array.isArray((community as any).businesses)
        ? (community as any).businesses.filter((b: any) => b?.id !== id)
        : (community as any).businesses;
      return { ...community, businesses: communityBusinesses };
    }));
    if (currentCommunityId) {
      queryClient.setQueryData(queryKeys.communityBundle(currentCommunityId), (prev: any) => {
        if (!prev) return prev;
        const bundleBusinesses = Array.isArray(prev.businesses)
          ? prev.businesses.filter((b: any) => b?.id !== id)
          : prev.businesses;
        return { ...prev, businesses: bundleBusinesses };
      });
    }
  }, [currentCommunityId]);

  const deleteUserBusiness = removeUserBusiness;

  // ── Charities ─────────────────────────────────────────────────────────────
  const addCharity = useCallback(async (charity: Omit<Charity, 'id' | 'createdAt'>) => {
    if (!currentCommunityId) return;
    const { data } = await api.post(`/communities/${currentCommunityId}/charities`, charity);
    if (Array.isArray(data?.charities)) {
      setCharities(data.charities);
    } else {
      const created = data?.charity ?? data;
      if (created) setCharities((prev) => [...prev, created]);
    }
    if (data?.community) {
      setCommunities((prev) => prev.map((community) =>
        community.id === currentCommunityId
          ? {
              ...community,
              catCycleActive: Boolean(data.community?.catCycleActive),
              catFeaturedCharityId: data.community?.catFeaturedCharityId ?? null,
            }
          : community,
      ));
    }
  }, [currentCommunityId]);

  const updateCharity = useCallback(async (charity: Charity) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/charities/${charity.id}`, charity);
    if (Array.isArray(data?.charities)) {
      setCharities(data.charities);
    } else {
      const updated = data?.charity ?? data;
      setCharities((prev) => prev.map((c) => c.id === charity.id ? updated : c));
    }
    if (data?.community) {
      setCommunities((prev) => prev.map((community) =>
        community.id === currentCommunityId
          ? {
              ...community,
              catCycleActive: Boolean(data.community?.catCycleActive),
              catFeaturedCharityId: data.community?.catFeaturedCharityId ?? null,
            }
          : community,
      ));
    }
  }, [currentCommunityId]);

  const removeCharity = useCallback(async (id: string) => {
    if (!currentCommunityId) return;
    await api.delete(`/communities/${currentCommunityId}/charities/${id}`);
    setCharities((prev) => prev.filter((c) => c.id !== id));
  }, [currentCommunityId]);

  const deleteCharity = removeCharity;

  const addCharitySuggestion = useCallback(async (suggestion: Omit<CharitySuggestion, 'id' | 'status' | 'createdAt'> & { suggestedDonationAmount: number }) => {
    if (!currentCommunityId) return;
    const { data } = await api.post(`/communities/${currentCommunityId}/charity-suggestions`, suggestion);
    setCharitySuggestions((prev) => [...prev, data]);
  }, [currentCommunityId]);

  const approveCharitySuggestion = useCallback(async (suggestionId: string, feedback: string, charityData: Omit<Charity, 'id' | 'createdAt'>) => {
    if (!currentCommunityId) return;
    const { data } = await api.patch(`/communities/${currentCommunityId}/charity-suggestions/${suggestionId}/approve`, {
      feedback,
      charityData,
    });
    if (Array.isArray(data?.charities)) {
      setCharities(data.charities);
    } else if (data?.charity?.id) {
      setCharities((prev) => {
        if (prev.some((charity) => charity.id === data.charity.id)) return prev;
        return [...prev, data.charity];
      });
    }
    if (data?.community) {
      setCommunities((prev) => prev.map((community) =>
        community.id === currentCommunityId
          ? {
              ...community,
              catCycleActive: Boolean(data.community?.catCycleActive),
              catFeaturedCharityId: data.community?.catFeaturedCharityId ?? null,
            }
          : community,
      ));
    }
    setCharitySuggestions((prev) => prev.map((s) => s.id === suggestionId ? { ...s, status: 'approved', adminFeedback: feedback } : s));
  }, [currentCommunityId]);

  const rejectCharitySuggestion = useCallback(async (suggestionId: string, feedback: string) => {
    if (!currentCommunityId) return;
    // Mark suggestion as rejected in the backend
    await api.patch(`/communities/${currentCommunityId}/charity-suggestions/${suggestionId}/reject`, { feedback });
    setCharitySuggestions((prev) => prev.map((s) => s.id === suggestionId ? { ...s, status: 'rejected', adminFeedback: feedback } : s));
  }, [currentCommunityId]);

  const setCatCycle = useCallback(async (active: boolean, featuredCharityId?: string) => {
    if (!currentCommunityId) return;
    const payload: { active: boolean; featuredCharityId?: string } = { active };
    if (featuredCharityId) payload.featuredCharityId = featuredCharityId;
    const { data } = await api.post(`/communities/${currentCommunityId}/cat-cycle`, payload);
    if (Array.isArray(data?.charities)) {
      setCharities(data.charities);
    }
    setCommunities((prev) => prev.map((community) =>
      community.id === currentCommunityId
        ? {
            ...community,
            catCycleActive: Boolean(data?.catCycleActive),
            catFeaturedCharityId: data?.catFeaturedCharityId ?? null,
          }
        : community,
    ));
  }, [currentCommunityId]);

  const markPostSold = useCallback(async (postId: string, quantity = 1) => {
    if (!currentCommunityId) return { catTriggered: false };
    const safeQuantity = Number.isFinite(Number(quantity)) ? Math.max(1, Math.floor(Number(quantity))) : 1;
    const { data } = await api.post(`/communities/${currentCommunityId}/posts/${postId}/sold`, { quantity: safeQuantity });
    const soldPost = data?.post;
    if (soldPost?.id) {
      const normalizedPost = normalizePostMedia(soldPost);
      setPosts((prev) => prev.map((post) => (post.id === normalizedPost.id ? normalizedPost : post)));
    }
    return {
      catTriggered: Boolean(data?.catTriggered),
      catAmount: data?.catAmount,
      pooledToCharity: Boolean(data?.pooledToCharity),
      post: soldPost,
    };
  }, [currentCommunityId]);

  const getCatHub = useCallback(async () => {
    if (!currentCommunityId) {
      return {
        totalCATGenerated: 0,
        totalRaisedForCharity: 0,
        catCycleActive: false,
        activeCycleCharity: null,
        recentTransactions: [],
      };
    }
    return queryClient.fetchQuery({
      queryKey: queryKeys.catHub(currentCommunityId),
      queryFn: async () => {
        const { data } = await api.get(`/communities/${currentCommunityId}/cat-hub`);
        return data;
      },
    });
  }, [currentCommunityId]);

  const getFeaturedCharity = useCallback(async (): Promise<FeaturedCharitySummary> => {
    if (!currentCommunityId) {
      return {
        charityId: null,
        name: null,
        goalAmount: 0,
        potentialEarnings: 0,
        raisedEarnings: 0,
        progressPercentage: 0,
        itemsAvailable: 0,
        itemsSold: 0,
        activeCampaign: false,
        isCATBaseline: false,
        campaignStartedAt: null,
        lifetimeRaised: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    return queryClient.fetchQuery({
      queryKey: queryKeys.featuredCharity(currentCommunityId),
      queryFn: async () => {
        const { data } = await api.get(`/communities/${currentCommunityId}/featured-charity`);
        return data;
      },
    });
  }, [currentCommunityId]);

  // ── Posts ─────────────────────────────────────────────────────────────────
  const addPost = useCallback(async (post: Omit<CommunityNotice, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!currentCommunityId) {
      throw new Error('No active community selected');
    }
    const { data } = await api.post(`/communities/${currentCommunityId}/posts`, post);
    const normalizedPost = normalizePostMedia(data);
    setPosts((prev) => [normalizedPost, ...prev]);
    return data.id;
  }, [currentCommunityId]);

  const updatePost = useCallback(async (post: CommunityNotice) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/posts/${post.id}`, post);
    const normalizedPost = normalizePostMedia(data);
    setPosts((prev) => prev.map((p) => p.id === post.id ? normalizedPost : p));
  }, [currentCommunityId]);

  const removePost = useCallback(async (id: string) => {
    if (!currentCommunityId) return;
    try {
      await api.delete(`/communities/${currentCommunityId}/posts/${id}`);
    } catch (error: any) {
      const status = error?.response?.status;
      // Idempotent delete on client: if the post is already gone (or was deleted
      // in another session/community context), treat this as success and keep UI in sync.
      if (status !== 404) {
        throw error;
      }
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, [currentCommunityId]);

  // ── Members ───────────────────────────────────────────────────────────────
  const addMember = useCallback(async (userId: string, role: UserRole, _email?: string) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/members/${userId}`, { role });
    setMembers((prev) => [...prev.filter((m) => m.userId !== userId), data]);
  }, [currentCommunityId]);

  const removeMember = useCallback(async (mUserId: string) => {
    if (!currentCommunityId) return;
    await api.delete(`/communities/${currentCommunityId}/members/${mUserId}`);
    setMembers((prev) => prev.filter((m) => m.userId !== mUserId));
  }, [currentCommunityId]);

  const deleteMember = removeMember;

  const updateMemberRole = useCallback(async (mUserId: string, role: UserRole) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/members/${mUserId}`, { role });
    setMembers((prev) => prev.map((m) => m.userId === mUserId ? data : m));
  }, [currentCommunityId]);

  // ── Notifications ─────────────────────────────────────────────────────────
  const addNotification = useCallback(async (toUserId: string, notification: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>) => {
    // Server-side push — no local state update needed (socket will deliver it)
    await api.post('/users/me/notifications', { ...notification, target_userId: toUserId });
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    await api.put(`/users/me/notifications/${notificationId}`, { read: true });
    setNotifications((prev) => prev.map((n) => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await api.delete(`/users/me/notifications/${notificationId}`);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const updateNotificationPreferences = useCallback(async (prefs: NotificationPreferences) => {
    await api.put('/users/me/notifications', prefs);
  }, []);

  // ── User search ───────────────────────────────────────────────────────────
  const searchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
    return queryClient.fetchQuery({
      queryKey: queryKeys.userSearch(query),
      queryFn: async (): Promise<UserProfile[]> => {
        const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
        return data ?? [];
      },
      staleTime: 30_000,
    });
  }, []);

  // ── Emergency / Security ──────────────────────────────────────────────────
  const toggleEmergencyMode = useCallback(async (communityId: string, _alertId?: string) => {
    await api.put(`/communities/${communityId}`, { emergency_mode: true });
  }, []);

  const toggleCommunityResponder = useCallback(async (communityId: string, isResponder: boolean, options?: { emergencyLocationOptIn?: boolean }) => {
    let previousResponder: boolean | undefined;
    setCommunities((prev) => prev.map((community) => (
      community.id === communityId
        ? (() => {
            previousResponder = !!community.isSecurityMember;
            return { ...community, isSecurityMember: isResponder };
          })()
        : community
    )));
    try {
      await api.put(`/communities/${communityId}/me/responder`, {
        isSecurityMember: isResponder,
        ...(typeof options?.emergencyLocationOptIn === 'boolean' ? { emergencyLocationOptIn: options.emergencyLocationOptIn } : {}),
      });
      if (communityId === activeCommunityId) {
        await bundleQuery.refetch();
      } else {
        await queryClient.invalidateQueries({ queryKey: queryKeys.communityBundle(communityId) });
      }
    } catch (error) {
      setCommunities((prev) => prev.map((community) => (
        community.id === communityId
          ? { ...community, isSecurityMember: previousResponder ?? false }
          : community
      )));
      throw error;
    }
  }, [activeCommunityId, bundleQuery]);

  const shareSecurityLocation = useCallback(async (communityId: string, latitude: number, longitude: number) => {
    socketRef.current?.emit('location:update', { communityId, latitude, longitude, isSecurity: true });
    await api.put(`/communities/${communityId}/location`, { latitude, longitude, isSecurity: true });
    if (communityId === activeCommunityId) {
      await bundleQuery.refetch();
    } else {
      await queryClient.invalidateQueries({ queryKey: queryKeys.communityBundle(communityId) });
    }
  }, [activeCommunityId, bundleQuery]);

  const clearSecurityLocation = useCallback(async (communityId: string) => {
    await api.delete(`/communities/${communityId}/location`, { data: { isSecurity: true } });
    if (communityId === activeCommunityId) {
      await bundleQuery.refetch();
    } else {
      await queryClient.invalidateQueries({ queryKey: queryKeys.communityBundle(communityId) });
    }
  }, [activeCommunityId, bundleQuery]);

  const updateLiveLocation = useCallback(async (latitude: number, longitude: number) => {
    if (!currentCommunityId) return;
    socketRef.current?.emit('location:update', { communityId: currentCommunityId, latitude, longitude });
    // Also persist to server
    await api.put(`/communities/${currentCommunityId}/location`, { latitude, longitude });
  }, [currentCommunityId]);

  const deleteReport = useCallback(async (communityId: string, reportId: string) => {
    await api.delete(`/communities/${communityId}/reports/${reportId}`);
  }, []);

  // ── Conversations / Chat ──────────────────────────────────────────────────
  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationIdState(conversationId);
    if (conversationId) {
      prefetchConversationMessages(queryClient, conversationId).catch(() => undefined);
    }
  }, []);

  const startConversation = useCallback(async (params: Parameters<CommunityContextType['startConversation']>[0]): Promise<string> => {
    let endpoint: string;
    let body: object;
    const myUserId = userProfile?.id ?? null;
    const candidateOtherId = params.participants.find((id) => id !== myUserId) ?? null;
    const shouldUseDirectResolver =
      params.type === 'direct' ||
      ((params.type === 'listing' || params.type === 'notice') && params.participants.length === 2 && !!candidateOtherId);

    if (shouldUseDirectResolver) {
      endpoint = '/conversations/direct';
      body = {
        otherUserId: candidateOtherId,
        communityId: params.communityId,
        listingId: params.listingId,
        noticeId: params.noticeId,
        metadata: params.metadata,
        contextType: params.type,
      };
    } else {
      endpoint = '/conversations';
      body = params;
    }
    const { data } = await api.post(endpoint, body);
    const payload = (data as { conversation?: Conversation })?.conversation ?? data;

    setConversations((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === payload.id);
      if (existingIndex === -1) return [payload, ...prev];
      const next = [...prev];
      next[existingIndex] = payload;
      return next;
    });

    return payload.id;
  }, [userProfile?.id]);

  const sendMessage = useCallback(async (
    text: string,
    type: Message['messageType'] = 'text',
    attachmentUrl?: string,
    fileName?: string,
  ) => {
    if (!activeConversationId) return;
    const msg = { content: text, type, attachmentUrl: attachmentUrl, file_name: fileName };
    const { data } = await api.post(`/conversations/${activeConversationId}/messages`, msg);
    const persistedMessage = data as Message;

    queryClient.setQueryData(queryKeys.conversationMessages(activeConversationId), (existing: Message[] | undefined) => {
      return appendUniqueMessages(existing ?? [], [persistedMessage]);
    });
    setMessages((prev) => appendUniqueMessages(prev, [persistedMessage]));
    socketRef.current?.emit('message:send', {
      conversationId: activeConversationId,
      content: persistedMessage.content,
      type: persistedMessage.messageType,
      attachmentUrl: persistedMessage.attachmentUrl,
      fileName: persistedMessage.fileName,
    });
  }, [activeConversationId]);

  const markAsRead = useCallback(async (conversationId: string) => {
    // Optimistically clear locally first so badges disappear immediately.
    setConversations((prev) => prev.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    ));
    try {
      await api.put(`/conversations/${conversationId}/read`);
    } catch (err) {
      console.error('markAsRead failed:', err);
    }
  }, []);

  const setTypingStatus = useCallback(async (conversationId: string, typing: boolean) => {
    const event = typing ? 'typing:start' : 'typing:stop';
    socketRef.current?.emit(event, { conversationId });
  }, []);

  // ── Invite links ──────────────────────────────────────────────────────────
  const generateInviteLink = useCallback(async (): Promise<string> => {
    if (!currentCommunityId) throw new Error('No current community');
    const { data } = await api.post(`/communities/${currentCommunityId}/invite-links`, { role: 'MEMBER' });
    setActiveCommunityLink(data);
    return data.code;
  }, [currentCommunityId]);

  const joinViaInviteLink = useCallback(async (linkCode: string): Promise<string> => {
    const { data } = await api.post(`/communities/join/${linkCode}`);
    // Reload the joined community from the server so the list is always fresh
    const communityData = await queryClient.fetchQuery({
      queryKey: queryKeys.communityById(data.communityId),
      queryFn: async () => {
        const { data: responseData } = await api.get(`/communities/${data.communityId}`);
        return mapServerCommunity(responseData);
      },
    });
    setCommunities((prev) =>
      prev.find((c) => c.id === data.communityId)
        ? prev.map((c) => (c.id === data.communityId ? communityData : c))
        : [...prev, communityData]
    );
    // Select the joined community immediately
    await updateUserProfile({ lastCommunityId: data.communityId } as any);
    await refreshProfile();
    return data.communityId;
  }, [refreshProfile, updateUserProfile]);

  // ── Invitations ───────────────────────────────────────────────────────────
  const inviteMember = useCallback(async (toUserId: string, role: 'MEMBER' | 'MODERATOR') => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/members/${toUserId}`, { role, status: 'INVITED' });
    setCommunityInvitations((prev) => [...prev, data]);
  }, [currentCommunityId]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    await api.put(`/communities/${currentCommunityId}/members/${userId}`, { status: 'ACTIVE' });
    setUserInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  }, [currentCommunityId, userId]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    await api.delete(`/communities/${currentCommunityId}/members/${userId}`);
    setUserInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  }, [currentCommunityId, userId]);

  // ── Misc ──────────────────────────────────────────────────────────────────
  const syncAllUsersToSearch = useCallback(async () => {
    // No-op in the new stack — search is done via /users?search= REST endpoint
  }, []);

  return (
    <CommunityContext.Provider
      value={{
        currentCommunity,
        communities,
        setCurrentCommunity,
        createCommunity,
        licenseCommunity,
        updateCommunityCoverage,
        updateCommunityCategories,
        addCommunityBusiness,
        updateCommunityBusiness,
        removeCommunityBusiness,
        bulkAddCommunityBusinesses,
        userBusinesses,
        addUserBusiness,
        updateUserBusiness,
        removeUserBusiness,
        deleteUserBusiness,
        charities,
        addCharity,
        updateCharity,
        removeCharity,
        deleteCharity,
        addCharitySuggestion,
        approveCharitySuggestion,
        rejectCharitySuggestion,
        setCatCycle,
        markPostSold,
        getCatHub,
        getFeaturedCharity,
        charitySuggestions,
        posts,
        addPost,
        removePost,
        updatePost,
        members,
        addMember,
        removeMember,
        deleteMember,
        updateMemberRole,
        addNotification,
        searchUsers,
        communityBusinesses,
        toggleEmergencyMode,
        toggleCommunityResponder,
        shareSecurityLocation,
        clearSecurityLocation,
        updateLiveLocation,
        securityResponders,
        conversations,
        chatUnreadTotals,
        activeConversation,
        messages,
        setActiveConversation,
        sendMessage,
        startConversation,
        markAsRead,
        isTyping,
        setTypingStatus,
        deleteReport,
        userInvitations,
        communityInvitations,
        notifications,
        inviteMember,
        acceptInvitation,
        declineInvitation,
        markNotificationAsRead,
        deleteNotification,
        updateNotificationPreferences,
        activeCommunityLink,
        generateInviteLink,
        joinViaInviteLink,
        syncAllUsersToSearch,
        refreshCommunities,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
  return ctx;
};
