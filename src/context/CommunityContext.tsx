/**
 * CommunityContext — REST + Socket.io replacing all Firestore onSnapshot.
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
import { useAuth } from './AuthContext';
import api from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import type {
  Community, CommunityContextType, UserBusiness, CoverageArea, Business,
  Charity, CommunityNotice, CommunityMember, UserProfile, UserRole,
  Conversation, Message, CharitySuggestion, CommunityInvitation,
  CommunityInviteLink, AppNotification, NotificationPreferences, ChatUnreadTotals,
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CommunityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userProfile, updateUserProfile } = useAuth();
  const userId = userProfile?.id ?? null;
  const currentCommunityId = userProfile?.lastCommunityId ?? null;

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
  const [chatUnreadTotals, setChatUnreadTotals] = useState<ChatUnreadTotals>(EMPTY_UNREAD);

  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  // Holds the latest `load` function so it can be called outside the useEffect.
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  const refreshCommunities = useCallback(async () => {
    if (loadRef.current) await loadRef.current();
  }, []);

  const currentCommunity = useMemo(
    () => communities.find((c) => c.id === currentCommunityId) ?? EMPTY_COMMUNITY,
    [communities, currentCommunityId],
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setCommunities([]);
      setMembers([]);
      setPosts([]);
      setConversations([]);
      setNotifications([]);
      return;
    }

    const load = async () => {
      try {
        const [commRes, convRes, notifRes] = await Promise.allSettled([
          api.get('/communities'),
          api.get('/conversations'),
          api.get('/users/me/notifications'),
        ]);
        if (commRes.status === 'fulfilled') setCommunities(commRes.value.data.map(mapServerCommunity));
        if (convRes.status === 'fulfilled') setConversations(convRes.value.data);
        if (notifRes.status === 'fulfilled') setNotifications(notifRes.value.data);
      } catch (err) {
        console.error('CommunityContext load error:', err);
      }
    };

    load();
    // Expose load so callers can trigger a re-fetch (e.g. after community creation).
    loadRef.current = load;
  }, [userId]);

  // If lastCommunityId is set but not yet in the communities list (e.g. just
  // created), re-fetch once to pick it up with the correct userRole.
  useEffect(() => {
    if (!currentCommunityId) return;
    const alreadyLoaded = communities.some((c) => c.id === currentCommunityId);
    if (!alreadyLoaded && loadRef.current) {
      loadRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCommunityId]);

  // Load community-specific data when current community changes
  useEffect(() => {
    if (!currentCommunityId) return;

    const loadCommunity = async () => {
      try {
        const [membersRes, postsRes, charitiesRes, bizRes, invRes, locRes] = await Promise.allSettled([
          api.get(`/communities/${currentCommunityId}/members`),
          api.get(`/communities/${currentCommunityId}/posts`),
          api.get(`/communities/${currentCommunityId}/charities`),
          api.get('/businesses'),
          api.get('/communities'),   // refresh to get invites embedded
          api.get(`/communities/${currentCommunityId}/locations`),
        ]);
        // Members always use their default location (lat/lng from user profile)
        if (membersRes.status === 'fulfilled') setMembers(membersRes.value.data);
        // Live locations from /locations are used only for security responders
        if (locRes.status === 'fulfilled') {
          const liveLocations: { userId: string; name: string; image: string; latitude: number; longitude: number; timestamp: string }[] =
            locRes.value.data?.security ?? [];
          setSecurityResponders(liveLocations);
        }
        if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data);
        if (charitiesRes.status === 'fulfilled') setCharities(charitiesRes.value.data);
        if (bizRes.status === 'fulfilled') {
          const all: UserBusiness[] = bizRes.value.data;
          setUserBusinesses(all.filter((b) => b.ownerId === userId));
          setCommunityBusinesses(all.filter((b) => (b.communityIds ?? []).includes(currentCommunityId!)));
        }
      } catch (err) {
        console.error('CommunityContext community load error:', err);
      }
    };

    loadCommunity();
  }, [currentCommunityId, userId]);

  // ── Socket.io realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    let active = true;

    const connect = async () => {
      const socket = await getSocket();
      if (!active) return;
      socketRef.current = socket;

      // Join rooms
      if (currentCommunityId) socket.emit('join:community', { communityId: currentCommunityId });

      // ── Inbound events ──
      socket.on('post:new', (post: CommunityNotice) => {
        setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      });
      socket.on('post:updated', (post: CommunityNotice) => {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      });
      socket.on('post:deleted', ({ id }: { id: string }) => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      });

      socket.on('message:new', (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
        setConversations((prev) =>
          prev.map((c) => c.id === (msg as any).conversationId ? { ...c, lastMessage: msg.content ?? '' } : c)
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
  }, [userId, currentCommunityId]);

  // Join conversation room when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    socketRef.current?.emit('join:conversation', { conversationId: activeConversationId });
    // Load messages
    api.get(`/conversations/${activeConversationId}/messages`)
      .then((res) => setMessages(res.data))
      .catch(console.error);
  }, [activeConversationId]);

  // ── Context methods ───────────────────────────────────────────────────────

  const setCurrentCommunity = useCallback(async (id: string) => {
    // Update local auth state immediately so the UI reacts without waiting for the server
    await updateUserProfile({ lastCommunityId: id } as any);
    // Persist to server in background
    api.put('/users/me', { lastCommunityId: id }).catch(console.error);
    if (socketRef.current) {
      if (currentCommunityId) socketRef.current.emit('leave:community', { communityId: currentCommunityId });
      socketRef.current.emit('join:community', { communityId: id });
    }
  }, [currentCommunityId, updateUserProfile]);

  const createCommunity = useCallback(async (name: string): Promise<string> => {
    const { data } = await api.post('/communities', { name });
    setCommunities((prev) => [...prev, mapServerCommunity(data)]);
    return data.id;
  }, []);

  const licenseCommunity = useCallback(async (communityId: string) => {
    const { data } = await api.post(`/communities/${communityId}/license`);
    setCommunities((prev) => prev.map((c) => c.id === communityId
      ? { ...c, type: 'LICENSED', status: 'ACTIVE', licenseId: data.licenseId }
      : c
    ));
    // Sync the user's licenseStatus locally so the green ring appears immediately
    await updateUserProfile({ licenseStatus: 'LICENSED', licenseType: 'SELF' } as any);
  }, [updateUserProfile]);

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
    setCommunityBusinesses((prev) => [...prev, data]);
  }, []);

  const updateCommunityBusiness = useCallback(async (_communityId: string, business: Business) => {
    const { data } = await api.put(`/businesses/${business.id}`, business);
    setCommunityBusinesses((prev) => prev.map((b) => b.id === business.id ? data : b));
  }, []);

  const removeCommunityBusiness = useCallback(async (_communityId: string, businessId: string) => {
    await api.delete(`/businesses/${businessId}`);
    setCommunityBusinesses((prev) => prev.filter((b) => b.id !== businessId));
  }, []);

  const bulkAddCommunityBusinesses = useCallback(async (communityId: string, businesses: Business[]) => {
    await api.post('/businesses/import', { communityId, businesses });
    const { data } = await api.get('/businesses');
    setCommunityBusinesses(data.filter((b: UserBusiness) => (b.communityIds ?? []).includes(communityId)));
  }, []);

  const addUserBusiness = useCallback(async (business: Omit<UserBusiness, 'id'>) => {
    const { data } = await api.post('/businesses', business);
    setUserBusinesses((prev) => [...prev, data]);
    if (currentCommunityId && (data.communityIds ?? []).includes(currentCommunityId)) {
      setCommunityBusinesses((prev) => [...prev, data]);
    }
  }, [currentCommunityId]);

  const updateUserBusiness = useCallback(async (business: UserBusiness) => {
    const { data } = await api.put(`/businesses/${business.id}`, business);
    setUserBusinesses((prev) => prev.map((b) => b.id === business.id ? data : b));
    setCommunityBusinesses((prev) => prev.map((b) => b.id === business.id ? data : b));
  }, []);

  const removeUserBusiness = useCallback(async (id: string) => {
    await api.delete(`/businesses/${id}`);
    setUserBusinesses((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const deleteUserBusiness = removeUserBusiness;

  // ── Charities ─────────────────────────────────────────────────────────────
  const addCharity = useCallback(async (charity: Omit<Charity, 'id' | 'createdAt'>) => {
    if (!currentCommunityId) return;
    const { data } = await api.post(`/communities/${currentCommunityId}/charities`, charity);
    setCharities((prev) => [...prev, data]);
  }, [currentCommunityId]);

  const updateCharity = useCallback(async (charity: Charity) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/charities/${charity.id}`, charity);
    setCharities((prev) => prev.map((c) => c.id === charity.id ? data : c));
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
    // Create the charity
    const { data: charity } = await api.post(`/communities/${currentCommunityId}/charities`, charityData);
    setCharities((prev) => [...prev, charity]);
    // Mark suggestion as approved in the backend
    await api.patch(`/communities/${currentCommunityId}/charity-suggestions/${suggestionId}/approve`, { feedback });
    setCharitySuggestions((prev) => prev.map((s) => s.id === suggestionId ? { ...s, status: 'approved', adminFeedback: feedback } : s));
  }, [currentCommunityId]);

  const rejectCharitySuggestion = useCallback(async (suggestionId: string, feedback: string) => {
    if (!currentCommunityId) return;
    // Mark suggestion as rejected in the backend
    await api.patch(`/communities/${currentCommunityId}/charity-suggestions/${suggestionId}/reject`, { feedback });
    setCharitySuggestions((prev) => prev.map((s) => s.id === suggestionId ? { ...s, status: 'rejected', adminFeedback: feedback } : s));
  }, [currentCommunityId]);

  // ── Posts ─────────────────────────────────────────────────────────────────
  const addPost = useCallback(async (post: Omit<CommunityNotice, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!currentCommunityId) return null;
    const { data } = await api.post(`/communities/${currentCommunityId}/posts`, post);
    setPosts((prev) => [data, ...prev]);
    return data.id;
  }, [currentCommunityId]);

  const updatePost = useCallback(async (post: CommunityNotice) => {
    if (!currentCommunityId) return;
    const { data } = await api.put(`/communities/${currentCommunityId}/posts/${post.id}`, post);
    setPosts((prev) => prev.map((p) => p.id === post.id ? data : p));
  }, [currentCommunityId]);

  const removePost = useCallback(async (id: string) => {
    if (!currentCommunityId) return;
    await api.delete(`/communities/${currentCommunityId}/posts/${id}`);
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
    const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
    return data;
  }, []);

  // ── Emergency / Security ──────────────────────────────────────────────────
  const toggleEmergencyMode = useCallback(async (communityId: string, _alertId?: string) => {
    await api.put(`/communities/${communityId}`, { emergency_mode: true });
  }, []);

  const toggleCommunityResponder = useCallback(async (communityId: string, isResponder: boolean) => {
    await api.put(`/communities/${communityId}/members/${userId}`, { is_responder: isResponder });
  }, [userId]);

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
  }, []);

  const startConversation = useCallback(async (params: Parameters<CommunityContextType['startConversation']>[0]): Promise<string> => {
    let endpoint: string;
    let body: object;
    if (params.type === 'direct') {
      endpoint = '/conversations/direct';
      body = { participantId: params.participants[1] };
    } else {
      endpoint = '/conversations';
      body = params;
    }
    const { data } = await api.post(endpoint, body);
    setConversations((prev) => prev.find((c) => c.id === data.id) ? prev : [data, ...prev]);
    return data.id;
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    type: Message['messageType'] = 'text',
    attachmentUrl?: string,
    fileName?: string,
  ) => {
    if (!activeConversationId) return;
    const msg = { content: text, type, attachmentUrl: attachmentUrl, file_name: fileName };
    const { data } = await api.post(`/conversations/${activeConversationId}/messages`, msg);
    setMessages((prev) => [...prev, data]);
    socketRef.current?.emit('message:send', { conversationId: activeConversationId, ...msg });
  }, [activeConversationId]);

  const markAsRead = useCallback(async (conversationId: string) => {
    await api.put(`/conversations/${conversationId}/read`);
    setConversations((prev) => prev.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: {} as Record<string, number> } : c
    ));
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
    const { data: communityData } = await api.get(`/communities/${data.communityId}`);
    setCommunities((prev) =>
      prev.find((c) => c.id === data.communityId)
        ? prev.map((c) => (c.id === data.communityId ? mapServerCommunity(communityData) : c))
        : [...prev, mapServerCommunity(communityData)]
    );
    // Select the joined community immediately
    await updateUserProfile({ lastCommunityId: data.communityId } as any);
    return data.communityId;
  }, [updateUserProfile]);

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
