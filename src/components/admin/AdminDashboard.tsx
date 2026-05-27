import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import {
  LayoutDashboard,
  HeartHandshake,
  Shield,
  Users,
  LogOut,
  Bell,
  Settings,
  Megaphone,
  TrendingUp,
  ArrowUpRight,
  ArrowLeft,
  Droplets,
  UserPlus,
  CreditCard,
  Flag,
  History,
  Activity,
  Siren,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { ModerationCenter, ModerationCenterHandle } from './ModerationCenter';
import { useLiveInsights } from '../../hooks/useLiveInsights';
import { CommunityInsightPanels } from './CommunityInsightPanels';
import { InteractiveCoverageMap } from '../home/InteractiveCoverageMap';
import { useCommunityMap } from '../../hooks/useCommunityMap';
import type { CatHubSummary } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';
import { getCardBorderColor, getCardShadow, getCardSurfaceColor } from '../../theme/cardStyles';

const PRIMARY = THEME_COLORS.primary;
const ERROR = THEME_COLORS.error;
const SECONDARY = THEME_COLORS.secondary;

const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 12,
  xl: 13,
  xxl: 14,
  h3: 15,
  h2: 16,
  h1: 18,
  display: 22,
  hero: 26,
  metric: 28,
} as const;

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const LINE_HEIGHT = {
  compact: 18,
  base: 20,
  display: 26,
} as const;

const LETTER_SPACING = {
  tight: 0.4,
  normal: 0.5,
  wide: 0.8,
  wider: 0.9,
  widest: 1,
  ultra: 1.2,
  hero: 1.5,
} as const;

const SPACE = {
  zero: 0,
  xxxs: 1,
  xxs: 2,
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  xxxl: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s24: 24,
  s32: 32,
} as const;

const RADIUS = {
  sm: 3,
  md: 4,
  lg: 8,
  xl: 10,
  xxl: 12,
  card: 14,
  cardLg: 16,
  panel: 20,
  modal: 32,
  circle: 40,
  pill: 99,
} as const;

const APP_LOGO = require('../../../assets/lalela_logo.png');

interface AdminDashboardProps {
  onBack?: () => void;
  onManageCharity?: () => void;
  initialView?: 'dashboard' | 'moderation' | 'members';
  initialModerationTab?: 'members' | 'content' | 'businesses' | 'rules' | 'logs' | 'categories' | 'coverage' | 'charity';
  readOnly?: boolean;
  guidedSetup?: boolean;
  onSetupComplete?: () => void;
}

// Step 1 (community name) is completed in OnboardingCreate — guided admin setup covers steps 2–5.
const SETUP_STEPS = [
  { id: 'coverage' as const,    label: 'Coverage Area',     description: "Define your community's geographic scope" },
  { id: 'categories' as const,  label: 'Categories',        description: 'Select which business categories are visible' },
  { id: 'businesses' as const,  label: 'Import Businesses', description: 'Add local businesses to your community' },
  { id: 'rules' as const,       label: 'Community Rules',   description: 'Set posting limits and access controls' },
];
// Total steps in the full onboarding narrative (step 1 = community name, already done)
const TOTAL_ONBOARDING_STEPS = SETUP_STEPS.length + 1;
type SetupStepId = typeof SETUP_STEPS[number]['id'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack,
  onManageCharity,
  initialView = 'dashboard',
  initialModerationTab = 'members',
  readOnly = false,
  guidedSetup = false,
  onSetupComplete,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, updateUserProfile } = useAuth();
  const {
    currentCommunity,
    updateCommunityCoverage,
    posts,
    members,
    securityResponders,
    charities,
    communityBusinesses,
    getCatHub,
    startConversation,
    setActiveConversation,
  } = useCommunity();
  const { data: liveInsights } = useLiveInsights(currentCommunity?.id);
  const previousRaisedRef = useRef<number | null>(null);
  const previousLiveDonationsRef = useRef<number | null>(null);
  const [donationTicker, setDonationTicker] = React.useState<Array<{ id: string; amount: number; at: number }>>([]);

  const [activeView, setActiveView] = React.useState<'dashboard' | 'moderation' | 'members'>(
    readOnly ? 'dashboard' : initialView
  );
  const [moderationTab, setModerationTab] = React.useState<any>(initialModerationTab);
  const [memberCount, setMemberCount] = React.useState(0);
  const [activeAlertsCount, setActiveAlertsCount] = React.useState(0);
  const [recentActivities, setRecentActivities] = React.useState<any[]>([]);
  const [systemUptime, setSystemUptime] = React.useState(99.9);
  const [securityThreats, setSecurityThreats] = React.useState(0);
  const [activeVolunteersCount, setActiveVolunteersCount] = React.useState(0);
  const [catHubSummary, setCatHubSummary] = React.useState<CatHubSummary | null>(null);

  // Guided setup
  const [setupStepIndex, setSetupStepIndex] = React.useState(0);
  const [completedSetupSteps, setCompletedSetupSteps] = React.useState<Set<SetupStepId>>(new Set());
  const [showSetupComplete, setShowSetupComplete] = React.useState(false);
  const {
    mapCenter,
    resetTrigger,
    isEmergencyActive,
    mapUnlocked,
    setMapUnlocked,
    resetCommunityMapView,
  } = useCommunityMap();

  const isEmergencyPost = React.useCallback(
    (p: any) => p?.urgencyLevel === 'emergency' || p?.urgency === 'emergency',
    []
  );
  const isWarningPost = React.useCallback(
    (p: any) => !isEmergencyPost(p) && (p?.urgencyLevel === 'warning' || p?.urgency === 'high'),
    [isEmergencyPost]
  );
  const byNewest = React.useCallback((a: any, b: any) => {
    const aTime = new Date(a?.createdAt || 0).getTime();
    const bTime = new Date(b?.createdAt || 0).getTime();
    return bTime - aTime;
  }, []);

  const activeEmergencyPosts = React.useMemo(
    () => (posts || []).filter(isEmergencyPost).slice().sort(byNewest),
    [posts, isEmergencyPost, byNewest]
  );
  const activeWarningPosts = React.useMemo(
    () => (posts || []).filter(isWarningPost).slice().sort(byNewest),
    [posts, isWarningPost, byNewest]
  );
  const hasEmergencies = activeEmergencyPosts.length > 0 || isEmergencyActive;
  const hasWarnings = activeWarningPosts.length > 0;
  const hasAnyIncidents = hasEmergencies || hasWarnings;
  const adminAvatarLabel = (userProfile?.name || userProfile?.email || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'A';

  const formatInsightTime = React.useCallback((value?: string) => {
    if (!value) return 'No time';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'No time';
    return dt.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const communityResponderInsights = React.useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();

    for (const responder of securityResponders || []) {
      const key = String((responder as any)?.userId || (responder as any)?.id || (responder as any)?.name || '');
      if (!key) continue;
      const name = ((responder as any)?.name || 'Security Responder').trim();
      if (!unique.has(key)) {
        unique.set(key, { id: key, name });
      }
    }

    for (const member of members || []) {
      if (!(member as any)?.isSecurityMember) continue;
      const key = String((member as any)?.userId || (member as any)?.id || (member as any)?.email || (member as any)?.name || '');
      if (!key || unique.has(key)) continue;
      const name = ((member as any)?.name || (member as any)?.email || 'Security Member').trim();
      unique.set(key, { id: key, name });
    }

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, securityResponders]);

  const recentIncidentInsights = React.useMemo(() => {
    const combined = [...activeEmergencyPosts, ...activeWarningPosts];
    return combined
      .slice()
      .sort(byNewest)
      .slice(0, 3)
      .map((incident: any) => ({
        id: incident.id,
        title: incident.title || 'Incident update',
        location: incident.locationName || 'Unknown location',
        kind: isEmergencyPost(incident) ? 'emergency' as const : 'warning' as const,
        time: formatInsightTime(incident.createdAt || incident.timestamp),
      }));
  }, [activeEmergencyPosts, activeWarningPosts, byNewest, formatInsightTime, isEmergencyPost]);

  const recentListingInsights = React.useMemo(() => {
    return (posts || [])
      .filter((post: any) => {
        if (post?.type !== 'listing') return false;
        const status = typeof post?.status === 'string' ? post.status.toLowerCase() : '';
        return status !== 'deleted' && status !== 'archived';
      })
      .slice()
      .sort(byNewest)
      .slice(0, 3)
      .map((listing: any) => ({
        id: listing.id,
        title: listing.title || 'Untitled listing',
        meta: `${listing.locationName || listing.authorName || 'Unknown location'} • ${formatInsightTime(listing.createdAt || listing.timestamp)}`,
      }));
  }, [posts, byNewest, formatInsightTime]);

  const recentMemberBusinessInsights = React.useMemo(() => {
    return (communityBusinesses || [])
      .filter((business: any) => (business?.source || 'MEMBER') === 'MEMBER')
      .slice()
      .sort((a: any, b: any) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        if (aTime === bTime) return String(a?.name || '').localeCompare(String(b?.name || ''));
        return bTime - aTime;
      })
      .slice(0, 3)
      .map((business: any) => ({
        id: business.id,
        name: business.name || 'Unnamed business',
        meta: business.category || business.address || 'Community member business',
      }));
  }, [communityBusinesses]);

  const respondersOnline = liveInsights?.counts?.respondersOnline ?? 0;
  const responderTotal = communityResponderInsights.length;
  const emergencyCount = activeEmergencyPosts.length;
  const warningCount = activeWarningPosts.length;
  const openAlertsDisplay = Math.max(activeAlertsCount, emergencyCount + warningCount);

  const activeNoticeCount = React.useMemo(() => {
    return (posts || []).filter((post: any) => {
      if (post?.type !== 'notice') return false;
      const status = typeof post?.status === 'string' ? post.status.toLowerCase() : '';
      return status !== 'deleted' && status !== 'archived';
    }).length;
  }, [posts]);

  const activeListingCount = React.useMemo(() => {
    return (posts || []).filter((post: any) => {
      if (post?.type !== 'listing') return false;
      if (post?.soldAt) return false;
      const status = typeof post?.status === 'string' ? post.status.toLowerCase() : 'active';
      return status === 'active' || status === 'pinned';
    }).length;
  }, [posts]);

  const activeMemberBusinessCount = React.useMemo(() => {
    return (communityBusinesses || []).filter((business: any) => {
      if ((business?.source || 'MEMBER') === 'IMPORT') return false;
      const status = typeof business?.status === 'string' ? business.status.toUpperCase() : 'ACTIVE';
      return status !== 'INACTIVE';
    }).length;
  }, [communityBusinesses]);

  const activeTotalCount = emergencyCount + warningCount + activeNoticeCount + activeListingCount + activeMemberBusinessCount;

  // Pulse animation for the Security Panel (red on emergency, amber on warning).
  const securityPulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!hasAnyIncidents) {
      securityPulse.stopAnimation();
      securityPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(securityPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(securityPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasAnyIncidents, securityPulse]);

  const securityPulseBg = securityPulse.interpolate({
    inputRange: [0, 1],
    outputRange: hasEmergencies
      ? [THEME_COLORS.errorSurface, THEME_COLORS.errorBorder]
      : hasWarnings
        ? [THEME_COLORS.warningSurface, THEME_COLORS.warningBorder]
        : [THEME_COLORS.white, THEME_COLORS.white],
  });

  const formatIncidentTime = React.useCallback((value?: string) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleOpenIncident = React.useCallback((incidentId?: string) => {
    if (!incidentId) return;
    router.push({
      pathname: `/emergency/${incidentId}` as any,
      params: { from: 'security-panel' },
    } as any);
  }, [router]);

  const responderNameById = React.useMemo(() => {
    const index = new Map<string, string>();
    for (const responder of communityResponderInsights) {
      index.set(responder.id, responder.name);
    }
    return index;
  }, [communityResponderInsights]);

  const handleInsightResponderPress = React.useCallback(async (responderId: string) => {
    if (!responderId || !userProfile?.id) return;

    if (responderId === userProfile.id) {
      Alert.alert('Cannot open chat', 'You cannot chat with yourself.');
      return;
    }

    try {
      const conversationId = await startConversation({
        participants: [userProfile.id, responderId],
        type: 'direct',
        communityId: currentCommunity?.id,
        metadata: {
          type: 'security',
          title: `Security Responder: ${responderNameById.get(responderId) || 'Responder'}`,
        },
      });
      setActiveConversation(conversationId);
      router.push(`/chat/${conversationId}` as any);
    } catch (error) {
      console.error('Failed to open responder chat:', error);
      Alert.alert('Chat unavailable', 'Could not open chat with this responder right now.');
    }
  }, [
    currentCommunity?.id,
    responderNameById,
    router,
    setActiveConversation,
    startConversation,
    userProfile?.id,
  ]);

  const handleInsightIncidentPress = React.useCallback((incidentId: string) => {
    handleOpenIncident(incidentId);
  }, [handleOpenIncident]);

  const handleInsightListingPress = React.useCallback((listingId: string) => {
    if (!listingId) return;
    router.push(`/(tabs)/market?listingId=${encodeURIComponent(String(listingId))}` as any);
  }, [router]);

  const handleInsightBusinessPress = React.useCallback((businessId: string) => {
    if (!businessId) return;
    router.push(`/(tabs)/market?businessId=${encodeURIComponent(String(businessId))}` as any);
  }, [router]);

  const moderationRef = useRef<ModerationCenterHandle>(null);

  const handleBack = () => {
    if (onBack) onBack();
    else { if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/'); else router.replace('/'); }
  };

  const handleOpenManageCharity = () => {
    if (onManageCharity) {
      onManageCharity();
      return;
    }
    setModerationTab('charity');
    setActiveView('moderation');
  };

  const handleOpenSuggestCharity = () => {
    router.push({ pathname: '/settings' as any, params: { charityMode: 'suggest' } });
  };

  const canManageCharity =
    currentCommunity?.userRole === 'ADMIN' ||
    currentCommunity?.userRole === 'MODERATOR';

  React.useEffect(() => {
    if (!readOnly) return;
    if (activeView !== 'dashboard') {
      setActiveView('dashboard');
    }
  }, [readOnly, activeView]);

  React.useEffect(() => {
    if (initialModerationTab) {
      setModerationTab(initialModerationTab);
    }
  }, [initialModerationTab]);

  // Derive member/volunteer counts from CommunityContext state
  React.useEffect(() => {
    setMemberCount(members.length);
    setActiveVolunteersCount(
      members.filter(
        (m: any) => m.role === 'LIAISON' || m.role === 'MODERATOR'
      ).length
    );
  }, [members]);

  // Track donation deltas from featured charity (no donor identity) → ephemeral ticker chips
  React.useEffect(() => {
    const featured = charities.find((c: any) => c.isFeatured);
    const raised = featured?.raisedAmount ?? 0;
    const prev = previousRaisedRef.current;
    if (prev !== null && raised > prev) {
      const delta = raised - prev;
      setDonationTicker((curr) => [
        { id: `${Date.now()}`, amount: delta, at: Date.now() },
        ...curr,
      ].slice(0, 3));
    }
    previousRaisedRef.current = raised;
  }, [charities]);

  // Also derive ticker from polled live-insights donationsTotal deltas
  React.useEffect(() => {
    const total = liveInsights?.counts?.donationsTotal;
    if (total == null) return;
    const prev = previousLiveDonationsRef.current;
    if (prev !== null && total > prev) {
      const delta = total - prev;
      setDonationTicker((curr) => [
        { id: `live-${Date.now()}`, amount: delta, at: Date.now() },
        ...curr,
      ].slice(0, 3));
    }
    previousLiveDonationsRef.current = total;
  }, [liveInsights?.counts?.donationsTotal]);

  // Load moderation logs + security event counts via REST
  React.useEffect(() => {
    if (!currentCommunity?.id || readOnly) return;
    const cid = currentCommunity.id;

    api.get(`/communities/${cid}/moderation-logs?limit=5`).then(({ data }) => {
      setRecentActivities(
        data.map((d: any) => ({
          id: d.id,
          title: `${(d.action?.charAt(0)?.toUpperCase() ?? '') + (d.action?.slice(1) ?? '')} Action`,
          subtitle: `${d.target_type} • ${d.reason || 'No reason provided'}`,
          time: d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Just now',
          icon: d.action === 'approve' ? UserPlus : Flag,
          iconBg: d.action === 'approve' ? THEME_COLORS.successSurface : THEME_COLORS.errorSurface,
          iconColor: d.action === 'approve' ? PRIMARY : ERROR,
        }))
      );
    }).catch(console.error);

    api.get(`/communities/${cid}/security-events?resolved=false`).then(({ data }) => {
      setActiveAlertsCount(Array.isArray(data) ? data.length : 0);
    }).catch(console.error);

    api.get(`/communities/${cid}/security-events?severity=high,critical&status=active`).then(({ data }) => {
      setSecurityThreats(Array.isArray(data) ? data.length : 0);
    }).catch(console.error);
  }, [currentCommunity?.id, readOnly]);

  React.useEffect(() => {
    let mounted = true;
    if (!currentCommunity?.id) {
      setCatHubSummary(null);
      return;
    }
    getCatHub()
      .then((summary) => {
        if (mounted) setCatHubSummary(summary);
      })
      .catch((error) => {
        console.error('Failed to load CAT hub summary:', error);
        if (mounted) setCatHubSummary(null);
      });
    return () => {
      mounted = false;
    };
  }, [currentCommunity?.id, getCatHub]);

  // Init completed steps
  React.useEffect(() => {
    if (currentCommunity?.onboardingStepsCompleted) {
      setCompletedSetupSteps(new Set(currentCommunity.onboardingStepsCompleted as SetupStepId[]));
    }
  }, [currentCommunity?.onboardingStepsCompleted]);

  React.useEffect(() => {
    if (!guidedSetup) return;
    const firstIncomplete = SETUP_STEPS.findIndex(s => !completedSetupSteps.has(s.id));
    if (firstIncomplete !== -1) {
      setSetupStepIndex(firstIncomplete);
      navigateToStep(SETUP_STEPS[firstIncomplete].id);
    }
  }, [guidedSetup, completedSetupSteps]);

  const navigateToStep = (stepId: SetupStepId) => {
    if (readOnly) {
      setActiveView('dashboard');
      return;
    }
    // Each step maps to a tab inside ModerationCenter
    setModerationTab(stepId);
    setActiveView('moderation');
  };

  const currentSetupStep = SETUP_STEPS[setupStepIndex];

  const markSetupStepComplete = async (stepId: SetupStepId) => {
    const updated = new Set(completedSetupSteps);
    updated.add(stepId);
    setCompletedSetupSteps(updated);

    if (currentCommunity?.id) {
      try {
        await api.put(`/communities/${currentCommunity.id}`, {
          onboardingStepsCompleted: Array.from(updated),
        });
      } catch (err) { console.error('Failed to save setup step:', err); }
    }

    if (updated.size >= SETUP_STEPS.length) {
      setShowSetupComplete(true);
    } else {
      const nextIdx = SETUP_STEPS.findIndex((s, i) => i > setupStepIndex && !updated.has(s.id));
      if (nextIdx !== -1) {
        setSetupStepIndex(nextIdx);
        navigateToStep(SETUP_STEPS[nextIdx].id);
      }
    }
  };

  const handleDone = async () => {
    try { await moderationRef.current?.saveCurrentTab(); } catch (e) { console.error(e); }
    markSetupStepComplete(currentSetupStep.id);
  };

  const handleFinishSetup = async () => {
    if (currentCommunity?.id) {
      try {
        // Mark all steps completed on the community record
        await api.put(`/communities/${currentCommunity.id}`, {
          onboardingStepsCompleted: SETUP_STEPS.map(s => s.id),
        });
      } catch (e) { console.error(e); }
    }
    try { await updateUserProfile({ onboardingCompleted: true } as any); } catch (e) { console.error(e); }
    setShowSetupComplete(false);
    onSetupComplete?.();
  };

  const featuredForStats = charities.find((c: any) => c.isFeatured);
  const featuredRaisedTotal = Number(featuredForStats?.raisedAmount ?? 0);
  const catGeneratedTotal = Number(catHubSummary?.totalCATGenerated ?? 0);

  const stats = [
    { label: 'Active Users', value: memberCount.toLocaleString(), icon: Users, color: PRIMARY },
    {
      label: featuredForStats?.name?.trim() ? featuredForStats.name : 'CAT',
      value: `R${Math.round(featuredForStats ? featuredRaisedTotal : catGeneratedTotal).toLocaleString()}`,
      icon: HeartHandshake,
      color: SECONDARY,
    },
    { label: 'Active', value: activeTotalCount.toLocaleString(), icon: Bell, color: ERROR },
  ];

  const activities = recentActivities.length > 0 ? recentActivities : [
    {
      id: 'no-activity', title: 'No recent activity', subtitle: 'System is quiet',
      time: 'NOW', icon: History, iconBg: THEME_COLORS.neutralBg, iconColor: THEME_COLORS.neutralTextMuted,
    },
  ];

  const availableCharities = charities.filter((c: any) => c.status !== 'Archived');
  const featuredCharity = availableCharities.find((c: any) => c.isFeatured) || (availableCharities.length === 1 ? availableCharities[0] : undefined);
  const otherCharities = charities.filter((c: any) => c !== featuredCharity && ((c.raisedAmount || c.totalRaised || 0) > 0));

  // Potential CAT running total across all approved Public listings, shown
  // whether or not a charity is currently featured.
  const potentialCatTotal = (posts as any[])
    .filter((p) => {
      if (p?.type !== 'listing') return false;
      if (!p?.isPublic) return false;
      const s = typeof p?.status === 'string' ? p.status.toLowerCase() : '';
      return s === 'active' || s === 'pinned';
    })
    .reduce((sum: number, listing: any) => {
      if (typeof listing.charityAmount === 'number' && Number.isFinite(listing.charityAmount)) {
        return sum + Math.max(0, listing.charityAmount);
      }
      const base = typeof listing.communityPrice === 'number'
        ? listing.communityPrice
        : typeof listing.price === 'number' ? listing.price : 0;
      const pub = typeof listing.publicPrice === 'number'
        ? listing.publicPrice
        : typeof listing.price === 'number' ? listing.price : base;
      return sum + Math.max(0, pub - base);
    }, 0);
  const potentialCatCount = (posts as any[]).filter(
    (p) => p?.type === 'listing' && p?.isPublic,
  ).length;

  const renderDashboard = () => (
    <ScrollView
      style={styles.dashScroll}
      contentContainerStyle={styles.dashContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{currentCommunity?.name || 'Community'} Dashboard</Text>
        <Text style={styles.heroSubtitle}>
          Real-time activity overview for the {currentCommunity?.name || 'Community'} platform.
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((stat, idx) => (
          <View key={idx} style={styles.statCard}>
            <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
            <View style={styles.statBottom}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <View style={{ position: 'relative' }}>
                <stat.icon size={16} color={stat.color} style={{ opacity: 0.35 }} />
                {(stat as any).pulse && (
                  <View style={styles.pulseDot} />
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Interactive Community Map */}
      <View style={[styles.bentoCard, { padding: SPACE.xxl }]}>
        <InteractiveCoverageMap
          center={mapCenter}
          resetTrigger={resetTrigger}
          height={280}
          showFilters
          showLegend
          showPulseOverlay
          showEmergencyOverlay
          isEmergencyActive={isEmergencyActive}
          isLocked={!mapUnlocked}
          onUnlock={() => setMapUnlocked(true)}
          onResetMap={resetCommunityMapView}
          onOpenEmergencyHub={(incidentId) => {
            if (!incidentId) return;
            router.push({
              pathname: `/emergency/${incidentId}` as any,
              params: { from: 'admin-map', source: 'coverage-overlay' },
            } as any);
          }}
          onOpenEmergencySelection={() => {
            router.push({
              pathname: '/emergency' as any,
              params: { from: 'admin-map', source: 'coverage-overlay' },
            } as any);
          }}
        />
      </View>

      {/* Security Panel */}
      <Animated.View
        style={[
          styles.bentoCard,
          hasAnyIncidents && { backgroundColor: securityPulseBg },
          hasEmergencies && { borderColor: THEME_COLORS.errorBorder },
          !hasEmergencies && hasWarnings && { borderColor: THEME_COLORS.warningBorder },
        ]}
      >
        <View style={styles.bentoHeader}>
          <Shield
            size={22}
            color={hasEmergencies ? ERROR : hasWarnings ? THEME_COLORS.warning : SECONDARY}
          />
          <Text
            style={[
              styles.bentoTitle,
              hasEmergencies && { color: ERROR },
              !hasEmergencies && hasWarnings && { color: THEME_COLORS.warning },
            ]}
          >
            Security Panel
          </Text>
          {hasEmergencies && (
            <View style={styles.emergencyBadge}>
              <View style={styles.emergencyDot} />
              <Text style={styles.emergencyText}>Emergency</Text>
            </View>
          )}
          {!hasEmergencies && hasWarnings && (
            <View style={styles.warningBadge}>
              <View style={styles.warningDot} />
              <Text style={styles.warningText}>Warning</Text>
            </View>
          )}
        </View>

        <View style={styles.securityStats}>
          <View style={styles.securityStat}>
            <Text style={styles.securityStatLabel}>EMERGENCIES</Text>
            <Text style={[styles.securityStatValue, hasEmergencies && { color: ERROR }]}>
              {emergencyCount}
            </Text>
          </View>
          <View style={styles.securityStat}>
            <Text style={styles.securityStatLabel}>WARNINGS</Text>
            <Text style={[styles.securityStatValue, hasWarnings && { color: THEME_COLORS.warning }]}>
              {warningCount}
            </Text>
          </View>
          <View style={styles.securityStat}>
            <Text style={styles.securityStatLabel}>RESPONDERS</Text>
            <Text style={styles.securityStatValue}>{responderTotal}</Text>
          </View>
        </View>

        {hasAnyIncidents && (
          <View style={styles.incidentListWrap}>
            {hasEmergencies && (
              <View style={styles.incidentSection}>
                <Text style={[styles.incidentSectionLabel, { color: ERROR }]}>Active Emergencies</Text>
                {activeEmergencyPosts.map((incident: any) => (
                  <TouchableOpacity
                    key={incident.id}
                    style={[styles.incidentRow, styles.incidentRowEmergency]}
                    activeOpacity={0.85}
                    onPress={() => handleOpenIncident(incident.id)}
                    accessibilityLabel={`Open emergency ${incident.title || 'incident'}`}
                  >
                    <View style={styles.incidentMain}>
                      <Text style={styles.incidentTitle} numberOfLines={1}>
                        {incident.title || 'Emergency alert'}
                      </Text>
                      <Text style={styles.incidentMeta} numberOfLines={1}>
                        {incident.locationName || 'Unknown location'}
                      </Text>
                    </View>
                    <Text style={[styles.incidentTime, { color: ERROR }]}>
                      {formatIncidentTime(incident.createdAt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {hasWarnings && (
              <View style={styles.incidentSection}>
                <Text style={[styles.incidentSectionLabel, { color: THEME_COLORS.warning }]}>Active Warnings</Text>
                {activeWarningPosts.map((incident: any) => (
                  <TouchableOpacity
                    key={incident.id}
                    style={[styles.incidentRow, styles.incidentRowWarning]}
                    activeOpacity={0.85}
                    onPress={() => handleOpenIncident(incident.id)}
                    accessibilityLabel={`Open warning ${incident.title || 'incident'}`}
                  >
                    <View style={styles.incidentMain}>
                      <Text style={styles.incidentTitle} numberOfLines={1}>
                        {incident.title || 'Warning notice'}
                      </Text>
                      <Text style={styles.incidentMeta} numberOfLines={1}>
                        {incident.locationName || 'Unknown location'}
                      </Text>
                    </View>
                    <Text style={[styles.incidentTime, { color: THEME_COLORS.warning }]}>
                      {formatIncidentTime(incident.createdAt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {!hasAnyIncidents && (
          <View style={styles.securityStats}>
            <View style={styles.securityStat}>
              <Text style={styles.securityStatLabel}>SECURITY MEMBERS</Text>
              <View style={styles.securityValueRow}>
                <Text style={styles.securityStatValue}>{activeVolunteersCount}</Text>
                {respondersOnline > 0 && (
                  <View style={styles.onlinePulseDot} />
                )}
              </View>
              {respondersOnline > 0 && (
                <Text style={styles.onlineHint}>
                  {respondersOnline} online now
                </Text>
              )}
            </View>
            <View style={styles.securityStat}>
              <Text style={styles.securityStatLabel}>OPEN ALERTS</Text>
              <Text style={[styles.securityStatValue, activeAlertsCount > 0 && { color: ERROR }]}> 
                {openAlertsDisplay}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Charity Hub */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoHeader}>
          <View style={[styles.bentoIcon, { backgroundColor: THEME_COLORS.successSurface }]}>
            <HeartHandshake size={24} color={PRIMARY} />
          </View>
          {canManageCharity ? (
            <TouchableOpacity style={styles.manageFundsBtn} onPress={handleOpenManageCharity} activeOpacity={0.8}>
              <Settings size={14} color={THEME_COLORS.white} />
              <Text style={styles.manageFundsBtnText}>Manage Charity</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.manageFundsBtn}
              onPress={handleOpenSuggestCharity}
              activeOpacity={0.8}
            >
              <Text style={styles.manageFundsBtnText}>Suggest Charity</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.bentoTitle}>Charity Hub</Text>
        <Text style={styles.bentoDesc}>Community-driven support for rural upliftment projects.</Text>

        {featuredCharity ? (
          <View style={styles.featuredCharity}>
            <Text style={styles.featuredCharityLabel}>CURRENT INITIATIVE</Text>
            <Text style={styles.featuredCharityName}>{featuredCharity.name || 'Unnamed Charity'}</Text>
            {featuredCharity.campaignCompleted && (
              <View style={styles.completedBadge}>
                <CheckCircle2 size={12} color={THEME_COLORS.secondaryContainer} />
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            )}
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                R{(featuredCharity.raisedAmount ?? 0).toLocaleString()} raised
              </Text>
              <Text style={styles.goalText}>
                Goal: R{(featuredCharity.fundraisingGoal || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, {
                  width: `${Math.min(Math.max(((featuredCharity.raisedAmount ?? 0) / (featuredCharity.fundraisingGoal || 1)) * 100, 0), 100)}%`
                }]}
              />
            </View>
            {donationTicker.length > 0 && (
              <View style={styles.donorTickerRow}>
                {donationTicker.map((d) => (
                  <View key={d.id} style={styles.donorChip}>
                    <Text style={styles.donorChipText}>+R{d.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
            {!readOnly && !featuredCharity.campaignCompleted && currentCommunity?.id && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={async () => {
                  try {
                    await api.patch(`/communities/${currentCommunity.id}/charities/${featuredCharity.id}`, {
                      campaignCompleted: true
                    });
                  } catch (e) { console.error(e); }
                }}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={18} color={PRIMARY} />
                <Text style={styles.completeBtnText}>Complete Campaign</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.noCharity}>
            <Droplets size={28} color={THEME_COLORS.neutralBorderStrong} />
            <Text style={styles.noCharityText}>CAT is in effect</Text>
            <Text style={styles.noCharitySubtext}>
              No featured charity is selected yet.
            </Text>
            <View style={styles.potentialCatBox}>
              <View>
                <Text style={styles.potentialCatLabel}>Potential CAT Total</Text>
                <Text style={styles.potentialCatValue}>
                  R{potentialCatTotal.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.potentialCatMeta}>
                {potentialCatCount} public listing{potentialCatCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        )}

        {otherCharities.length > 0 && (
          <View style={styles.previousCampaigns}>
            <Text style={styles.previousCampaignsTitle}>Previous Campaigns</Text>
            {otherCharities.slice(0, 3).map((c) => (
              <View key={c.id} style={styles.prevCampaignRow}>
                <Text style={styles.prevCampaignName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.prevCampaignAmount}>R{(c.raisedAmount ?? 0).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Community Insights */}
      <CommunityInsightPanels
        responders={communityResponderInsights}
        incidents={recentIncidentInsights}
        listings={recentListingInsights}
        businesses={recentMemberBusinessInsights}
        onResponderPress={handleInsightResponderPress}
        onIncidentPress={handleInsightIncidentPress}
        onListingPress={handleInsightListingPress}
        onBusinessPress={handleInsightBusinessPress}
      />

      {/* System Health */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoHeader}>
          <Activity size={20} color={THEME_COLORS.secondaryContainer} />
          <Text style={styles.bentoTitle}>System Health</Text>
        </View>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>UPTIME</Text>
          <Text style={[styles.healthValue, { color: THEME_COLORS.secondaryContainer }]}>{systemUptime}%</Text>
        </View>
        <View style={styles.uptimeBar}>
          <View style={[styles.uptimeFill, { width: '99.9%' }]} />
        </View>
        <View style={[styles.healthRow, { marginTop: SPACE.s16 }]}> 
          <Text style={styles.healthLabel}>SECURITY THREATS</Text>
          <Text style={[styles.healthValue, securityThreats > 0 ? { color: ERROR } : { color: THEME_COLORS.secondaryContainer }]}>
            {securityThreats === 0 ? 'None' : securityThreats}
          </Text>
        </View>
        <View style={styles.threatRow}>
          <View style={[styles.threatDot, { backgroundColor: securityThreats === 0 ? THEME_COLORS.secondaryContainer : ERROR }]} />
          <Text style={styles.threatText}>
            {securityThreats === 0 ? 'All systems operational' : 'Active threats detected'}
          </Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.bentoCard}>
        <Text style={styles.bentoTitle}>Recent Moderator Activity</Text>
        <View style={{ gap: SPACE.xl, marginTop: SPACE.xxl }}>
          {activities.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: activity.iconBg }]}>
                <activity.icon size={18} color={activity.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>
              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: insets.bottom + 80 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Image source={APP_LOGO} style={styles.logoImg as any} resizeMode="contain" />
        </View>
        <Text style={styles.topBarTitle}>Admin Dashboard</Text>

        {/* Admin-only moderation shortcut */}
        {currentCommunity?.userRole === 'ADMIN' && activeView === 'dashboard' && !readOnly && (
          <TouchableOpacity
            style={[styles.viewSwitcherBtn, styles.viewSwitcherBtnActive]}
            onPress={() => {
              setModerationTab('members');
              setActiveView('moderation');
            }}
            activeOpacity={0.7}
            accessibilityLabel="Open moderation center"
          >
            <LayoutDashboard size={18} color={PRIMARY} />
          </TouchableOpacity>
        )}

        {activeView === 'moderation' && (
          <View style={styles.adminAvatar}>
            <Text style={styles.adminAvatarText}>{adminAvatarLabel}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      {activeView === 'dashboard' ? renderDashboard() : (
        <ModerationCenter
          ref={moderationRef}
          onBack={() => setActiveView('dashboard')}
          embedded
          initialTab={activeView === 'members' ? 'members' : moderationTab}
        />
      )}

      {/* Guided Setup Bar */}
      {guidedSetup && !showSetupComplete && currentSetupStep && (
        <View style={[styles.setupBar, { paddingBottom: insets.bottom || 12 }]}>
          <View style={styles.setupProgress}>
            <View
              style={[styles.setupProgressFill, {
                // Step 1 (name) already done → start at 1/5, end at 5/5
                width: `${((completedSetupSteps.size + 1) / TOTAL_ONBOARDING_STEPS) * 100}%`
              }]}
            />
          </View>
          <View style={styles.setupBarInner}>
            <View style={{ flex: 1 }}>
              <View style={styles.setupStepRow}>
                <Text style={styles.setupStepLabel}>{currentSetupStep.label}</Text>
                <Text style={styles.setupStepCount}>
                  {completedSetupSteps.size + 2} of {TOTAL_ONBOARDING_STEPS}
                </Text>
              </View>
              <Text style={styles.setupStepDesc}>{currentSetupStep.description}</Text>
            </View>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => setShowSetupComplete(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Skip All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
              <CheckCircle2 size={14} color={THEME_COLORS.white} />
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Setup Complete Modal */}
      <Modal visible={showSetupComplete} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.setupCompleteCard}>
            <View style={styles.setupCompleteIcon}>
              <CheckCircle2 size={40} color={THEME_COLORS.secondaryContainer} />
            </View>
            <Text style={styles.setupCompleteTitle}>Your Community is Ready!</Text>
            <Text style={styles.setupCompleteDesc}>
              {currentCommunity?.name || 'Your community'} is set up and ready for members. You can
              always adjust settings from the Admin Dashboard.
            </Text>
            <TouchableOpacity style={styles.setupCompleteBtn} onPress={handleFinishSetup} activeOpacity={0.85}>
              <Text style={styles.setupCompleteBtnText}>Go to Home</Text>
              <ArrowUpRight size={18} color={THEME_COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default AdminDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_SHELL_COLORS.body },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.s16,
    backgroundColor: APP_SHELL_COLORS.chrome,
    gap: SPACE.xl,
  },
  backBtn: { padding: SPACE.md, marginRight: SPACE.xs },
  logoBox: {
    width: 42, height: 42, borderRadius: RADIUS.xl, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: 30, height: 30 },
  topBarTitle: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, color: PRIMARY, flex: 1 },
  viewSwitcher: { flexDirection: 'row', gap: SPACE.sm },
  viewSwitcherBtn: {
    width: 42, height: 42, borderRadius: RADIUS.xxl, alignItems: 'center', justifyContent: 'center',
    backgroundColor: getCardSurfaceColor('default'),
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
  },
  viewSwitcherBtnActive: { backgroundColor: THEME_COLORS.successSurface },
  adminAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.secondaryContainer,
    borderWidth: 2,
    borderColor: THEME_COLORS.surface,
    ...createShadow(THEME_COLORS.black, 0, 2, 0.08, 6, 2),
  },
  adminAvatarText: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.white,
  },

  dashScroll: { flex: 1 },
  dashContent: { paddingHorizontal: SPACE.s16, paddingTop: SPACE.s16, gap: SPACE.s16 },

  heroSection: { gap: SPACE.sm, marginBottom: SPACE.xs },
  heroTitle: { fontSize: TYPE_SCALE.hero, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  heroSubtitle: { fontSize: TYPE_SCALE.xxl, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.base },

  statsRow: { flexDirection: 'row', gap: SPACE.xl },
  statCard: {
    flex: 1, backgroundColor: getCardSurfaceColor('default'), borderRadius: RADIUS.card, paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
    gap: SPACE.xs,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.widest,
    textAlign: 'center',
    width: '100%',
  },
  statBottom: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.zero,
    gap: SPACE.xxs,
    width: '100%',
  },
  statValue: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, textAlign: 'center', lineHeight: LINE_HEIGHT.display },
  pulseDot: {
    position: 'absolute', top: -2, right: -2, width: 7, height: 7,
    borderRadius: RADIUS.md, backgroundColor: ERROR,
  },

  bentoCard: {
    backgroundColor: getCardSurfaceColor('default'), borderRadius: RADIUS.panel, padding: SPACE.s18, gap: SPACE.lg,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
  },
  bentoCardClickable: {},
  bentoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bentoIcon: { width: 48, height: 48, borderRadius: RADIUS.cardLg, alignItems: 'center', justifyContent: 'center' },
  bentoTitle: { fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.black, color: PRIMARY, marginTop: SPACE.xs },
  bentoDesc: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.compact },
  alertBox: {
    backgroundColor: getCardSurfaceColor('subtle'), borderRadius: RADIUS.xxl, padding: SPACE.xxl, marginTop: SPACE.xs,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
  },
  alertBoxLabel: { fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.widest },
  alertBoxValue: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, marginTop: SPACE.xxs },

  coverageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncBadge: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
  syncBadgeText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
  mapPreview: { height: 140, borderRadius: RADIUS.card, overflow: 'hidden', marginTop: SPACE.lg },
  mapFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: THEME_COLORS.neutralBgSoft, marginTop: SPACE.xs,
  },
  mapFooterText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal },

  manageFundsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.pill,
  },
  manageFundsBtnText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold },

  featuredCharity: {
    backgroundColor: PRIMARY, borderRadius: RADIUS.cardLg, padding: SPACE.s16, gap: SPACE.md, marginTop: SPACE.lg,
  },
  featuredCharityLabel: {
    fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.alias_rgba_255_255_255_0_6,
    textTransform: 'uppercase', letterSpacing: LETTER_SPACING.hero,
  },
  featuredCharityName: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    alignSelf: 'flex-start', backgroundColor: THEME_COLORS.alias_rgba_74_222_128_0_15,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill,
  },
  completedBadgeText: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.secondaryContainer },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.xs },
  progressText: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.whiteOverlay90 },
  goalText: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.alias_rgba_255_255_255_0_6 },
  progressTrack: { height: 6, backgroundColor: THEME_COLORS.blackOverlay20, borderRadius: RADIUS.sm, overflow: 'hidden', marginTop: SPACE.md },
  progressFill: { height: '100%', backgroundColor: THEME_COLORS.secondaryContainer, borderRadius: RADIUS.sm },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.lg,
    backgroundColor: THEME_COLORS.surface, borderRadius: RADIUS.xxl, paddingVertical: SPACE.xl, marginTop: SPACE.lg,
  },
  completeBtnText: { color: PRIMARY, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xxl },
  noCharity: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.s24,
    backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.xxl, gap: SPACE.lg, marginTop: SPACE.lg,
  },
  noCharityText: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextMuted, fontWeight: FONT_WEIGHT.medium },
  noCharitySubtext: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextMuted },
  potentialCatBox: {
    marginTop: SPACE.xxl,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: THEME_COLORS.primaryContainerTint06,
    borderRadius: RADIUS.cardLg,
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.xl,
  },
  potentialCatLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: LETTER_SPACING.tight,
    textTransform: 'uppercase',
    color: THEME_COLORS.primaryContainerTint70,
  },
  potentialCatValue: {
    fontSize: TYPE_SCALE.h1,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.primaryContainer,
  },
  potentialCatMeta: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.primaryContainerTint70,
  },
  previousCampaigns: { marginTop: SPACE.lg, gap: SPACE.lg },
  previousCampaignsTitle: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  prevCampaignRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: THEME_COLORS.neutralBg, padding: SPACE.xl, borderRadius: RADIUS.xxl,
    borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
  },
  prevCampaignName: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong, flex: 1 },
  prevCampaignAmount: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.secondaryContainer },

  emergencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: THEME_COLORS.errorSurface, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill,
  },
  emergencyDot: { width: 6, height: 6, borderRadius: RADIUS.sm, backgroundColor: ERROR },
  emergencyText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, color: ERROR, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
  emergencyInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  warningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginLeft: 'auto',
    backgroundColor: THEME_COLORS.warningSurface, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill,
  },
  warningDot: { width: 6, height: 6, borderRadius: RADIUS.sm, backgroundColor: THEME_COLORS.warning },
  warningText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.warning, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
  securityStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.lg },
  securityStat: { flex: 1, gap: SPACE.sm, alignItems: 'center' },
  securityStatLabel: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.widest,
    textAlign: 'center',
  },
  securityStatValue: { fontSize: TYPE_SCALE.metric, fontWeight: FONT_WEIGHT.black, color: PRIMARY, textAlign: 'center' },
  incidentListWrap: {
    marginTop: SPACE.xl,
    gap: SPACE.xl,
  },
  incidentSection: {
    gap: SPACE.md,
  },
  incidentSectionLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  incidentRow: {
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.lg,
  },
  incidentRowEmergency: {
    backgroundColor: THEME_COLORS.alias_rgba_254_242_242_0_8,
    borderColor: THEME_COLORS.errorBorder,
  },
  incidentRowWarning: {
    backgroundColor: THEME_COLORS.alias_rgba_255_251_235_0_8,
    borderColor: THEME_COLORS.warningBorder,
  },
  incidentMain: {
    flex: 1,
    minWidth: 0,
  },
  incidentTitle: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextStrong,
  },
  incidentMeta: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.neutralTextSubtle,
    marginTop: SPACE.xxs,
  },
  incidentTime: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
  },

  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthLabel: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
  healthValue: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold },
  uptimeBar: { height: 6, backgroundColor: THEME_COLORS.neutralBgSoft, borderRadius: RADIUS.sm, overflow: 'hidden', marginTop: SPACE.md },
  uptimeFill: { height: '100%', backgroundColor: THEME_COLORS.secondaryContainer },
  threatRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginTop: SPACE.xs },
  threatDot: { width: 8, height: 8, borderRadius: RADIUS.md },
  threatText: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle },

  activityItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl,
    backgroundColor: THEME_COLORS.surfaceContainer, borderRadius: RADIUS.card, padding: SPACE.xxl,
    borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
    ...createShadow(THEME_COLORS.black, 0, 1, 0.03, 4, 1),
  },
  activityIcon: { width: 40, height: 40, borderRadius: RADIUS.panel, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  activitySubtitle: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxxs },
  activityTime: { fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal },

  // Setup bar
  setupBar: {
    position: 'absolute', bottom: SPACE.zero, left: SPACE.zero, right: SPACE.zero,
    backgroundColor: THEME_COLORS.surfaceContainer, borderTopWidth: 1, borderTopColor: THEME_COLORS.neutralBorderSoft,
    ...createShadow(THEME_COLORS.black, 0, -4, 0.08, 12, 8),
  },
  setupProgress: { height: 3, backgroundColor: THEME_COLORS.neutralBgSoft },
  setupProgressFill: { height: '100%', backgroundColor: PRIMARY },
  setupBarInner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, paddingHorizontal: SPACE.xxxl, paddingTop: SPACE.xl },
  setupStepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  setupStepLabel: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  setupStepCount: {
    fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted,
    backgroundColor: THEME_COLORS.neutralBg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs, borderRadius: RADIUS.pill,
  },
  setupStepDesc: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextMuted, marginTop: SPACE.xxs },
  skipBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  skipBtnText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextMuted },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xl, borderRadius: RADIUS.xxl,
    ...createShadow(PRIMARY, 0, 2, 0.25, 6, 4),
  },
  doneBtnText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: THEME_COLORS.blackOverlay50,
    alignItems: 'center', justifyContent: 'center', padding: SPACE.s16,
  },
  setupCompleteCard: {
    backgroundColor: THEME_COLORS.surfaceContainer, borderRadius: RADIUS.modal, padding: SPACE.s32,
    width: '100%', maxWidth: 400, alignItems: 'center', gap: SPACE.xxxl,
    borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
    ...createShadow(THEME_COLORS.black, 0, 12, 0.15, 32, 10),
  },
  setupCompleteIcon: {
    width: 80, height: 80, borderRadius: RADIUS.circle, backgroundColor: THEME_COLORS.successSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  setupCompleteTitle: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, color: PRIMARY, textAlign: 'center' },
  setupCompleteDesc: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextSubtle, textAlign: 'center', lineHeight: LINE_HEIGHT.base },
  setupCompleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
    backgroundColor: PRIMARY, borderRadius: RADIUS.cardLg, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.s24,
    ...createShadow(PRIMARY, 0, 4, 0.3, 12, 6),
    marginTop: SPACE.lg,
  },
  setupCompleteBtnText: { color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.black, fontSize: TYPE_SCALE.h3 },

  suggestCard: {
    backgroundColor: THEME_COLORS.surfaceContainer, borderRadius: RADIUS.modal, padding: SPACE.s24,
    width: '100%', maxWidth: 480,
    ...createShadow(THEME_COLORS.black, 0, 12, 0.15, 32, 10),
    maxHeight: '90%',
  },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.s20 },
  suggestTitle: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  suggestSubtitle: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs },
  suggestField: { gap: SPACE.md },
  suggestRow: { flexDirection: 'row', gap: SPACE.xxl },
  suggestLabel: {
    fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase', letterSpacing: LETTER_SPACING.ultra,
  },
  suggestInput: {
    backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.xxl, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xl,
    fontSize: TYPE_SCALE.xxl, color: THEME_COLORS.neutralTextStrong, borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
  },
  suggestTextarea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontSize: TYPE_SCALE.lg, color: ERROR, fontWeight: FONT_WEIGHT.semibold },
  suggestButtons: { flexDirection: 'row', gap: SPACE.xxl, marginTop: SPACE.lg },
  cancelSuggestBtn: {
    flex: 1, paddingVertical: SPACE.xxl, borderRadius: RADIUS.cardLg, borderWidth: 2, borderColor: THEME_COLORS.neutralBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelSuggestBtnText: { color: THEME_COLORS.neutralTextSubtle, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xxl },
  submitSuggestBtn: {
    flex: 2, paddingVertical: SPACE.xxl, borderRadius: RADIUS.cardLg, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    ...createShadow(PRIMARY, 0, 3, 0.25, 8, 4),
  },
  submitSuggestBtnText: { color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xxl },

  // Donor ticker chips
  donorTickerRow: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.lg, flexWrap: 'wrap' },
  donorChip: {
    backgroundColor: THEME_COLORS.alias_rgba_252_113_39_0_15,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
    borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_252_113_39_0_35,
  },
  donorChipText: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.secondaryContainer },

  // Security online pulse
  securityValueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  onlinePulseDot: {
    width: SPACE.xl, height: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: PRIMARY,
  },
  onlineHint: {
    fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: PRIMARY,
    textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide, marginTop: SPACE.xxs,
  },
});
