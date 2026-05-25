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
  Gavel,
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
import { Lock, ScrollText, FileWarning } from 'lucide-react-native';

const PRIMARY = '#0d3d47';
const ERROR = '#dc2626';
const SECONDARY = '#7c3aed';

const APP_LOGO = require('../../../assets/lalela_logo.png');

interface AdminDashboardProps {
  onBack?: () => void;
  onManageCharity?: () => void;
  initialView?: 'dashboard' | 'moderation' | 'members';
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
  readOnly = false,
  guidedSetup = false,
  onSetupComplete,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, updateUserProfile } = useAuth();
  const { currentCommunity, updateCommunityCoverage, posts, members, securityResponders, charities } = useCommunity();
  const { data: liveInsights } = useLiveInsights(currentCommunity?.id);
  const previousRaisedRef = useRef<number | null>(null);
  const previousLiveDonationsRef = useRef<number | null>(null);
  const [donationTicker, setDonationTicker] = React.useState<Array<{ id: string; amount: number; at: number }>>([]);

  const [activeView, setActiveView] = React.useState<'dashboard' | 'moderation' | 'members'>(
    readOnly ? 'dashboard' : initialView
  );
  const [moderationTab, setModerationTab] = React.useState<any>('members');
  const [memberCount, setMemberCount] = React.useState(0);
  const [activeAlertsCount, setActiveAlertsCount] = React.useState(0);
  const [recentActivities, setRecentActivities] = React.useState<any[]>([]);
  const [systemUptime, setSystemUptime] = React.useState(99.9);
  const [securityThreats, setSecurityThreats] = React.useState(0);
  const [activeVolunteersCount, setActiveVolunteersCount] = React.useState(0);

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
    findLatestEmergencyPost,
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

  const respondersOnline = liveInsights?.counts?.respondersOnline ?? 0;
  const emergencyCount = activeEmergencyPosts.length;
  const warningCount = activeWarningPosts.length;
  const openAlertsDisplay = Math.max(activeAlertsCount, emergencyCount + warningCount);

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
      ? ['#fef2f2', '#fecaca']
      : hasWarnings
        ? ['#fffbeb', '#fde68a']
        : ['#ffffff', '#ffffff'],
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

  // Derive member/volunteer counts from CommunityContext state
  React.useEffect(() => {
    setMemberCount(members.length);
    setActiveVolunteersCount(
      members.filter(
        (m: any) => m.role === 'LIAISON' || m.role === 'MODERATOR'
      ).length
    );
  }, [members]);

  // Derive charity totals directly from the context charities list
  const totalCharityRaised = React.useMemo(
    () => charities.reduce((s: number, c: any) => s + (c.raisedAmount || c.totalRaised || 0), 0),
    [charities],
  );

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
          iconBg: d.action === 'approve' ? '#f0fdf4' : '#fef2f2',
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

  const stats = [
    { label: 'Active Users', value: memberCount.toLocaleString(), icon: Users, color: PRIMARY },
    { label: 'Total Charity', value: `R${totalCharityRaised.toLocaleString()}`, icon: HeartHandshake, color: SECONDARY },
    { label: 'Active Alerts', value: activeAlertsCount.toString(), icon: Bell, color: ERROR, pulse: activeAlertsCount > 0 },
  ];

  const activities = recentActivities.length > 0 ? recentActivities : [
    {
      id: 'no-activity', title: 'No recent activity', subtitle: 'System is quiet',
      time: 'NOW', icon: History, iconBg: '#f8fafc', iconColor: '#94a3b8',
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
            <Text style={styles.statLabel}>{stat.label}</Text>
            <View style={styles.statBottom}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <View style={{ position: 'relative' }}>
                <stat.icon size={20} color={stat.color} style={{ opacity: 0.4 }} />
                {(stat as any).pulse && (
                  <View style={styles.pulseDot} />
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Interactive Community Map */}
      <View style={[styles.bentoCard, { padding: 12 }]}>
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
          onOpenEmergencyHub={() => {
            const latest = findLatestEmergencyPost();
            if (latest?.id) router.push(`/emergency/${latest.id}` as any);
          }}
        />
      </View>

      {/* Moderation Center CTA */}
      <View style={[styles.bentoCard, styles.bentoCardLarge]}>
        {(() => {
          const c = liveInsights?.counts;
          const tiles: Array<{
            id: string;
            label: string;
            tab: any;
            Icon: any;
            color: string;
            bg: string;
            count: number;
          }> = [
            { id: 'moderation-center', label: 'Moderation Center', tab: 'members', Icon: Gavel, color: PRIMARY, bg: '#f0fdf4', count: c?.respondersOnline ?? 0 },
            { id: 'members', label: 'Members', tab: 'members', Icon: Users, color: PRIMARY, bg: '#f0fdf4', count: memberCount },
            { id: 'alerts', label: 'Alerts', tab: 'logs', Icon: Bell, color: ERROR, bg: '#fef2f2', count: c?.alertsActive ?? activeAlertsCount },
            { id: 'charity', label: 'Charity', tab: 'charity', Icon: HeartHandshake, color: SECONDARY, bg: '#f5f3ff', count: availableCharities.length },
            { id: 'reports', label: 'Reports', tab: 'content', Icon: FileWarning, color: '#fc7127', bg: '#fff7ed', count: c?.activeReports ?? 0 },
            { id: 'rules', label: 'Rules', tab: 'rules', Icon: ScrollText, color: PRIMARY, bg: '#f0fdf4', count: 0 },
          ];
          return (
            <View style={styles.tileGrid}>
              {tiles.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tile, readOnly && styles.tileLocked]}
                  onPress={() => {
                    if (readOnly) return;
                    setModerationTab(t.tab);
                    setActiveView('moderation');
                  }}
                  activeOpacity={readOnly ? 1 : 0.8}
                  disabled={readOnly}
                >
                  <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>
                    <t.Icon size={18} color={t.color} />
                  </View>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  {readOnly && (
                    <View style={styles.tileLockBadge}>
                      <Lock size={10} color="#94a3b8" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}
      </View>

      {/* Charity Hub */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoHeader}>
          <View style={[styles.bentoIcon, { backgroundColor: '#f0fdf4' }]}>
            <HeartHandshake size={24} color={PRIMARY} />
          </View>
          {canManageCharity ? (
            <TouchableOpacity style={styles.manageFundsBtn} onPress={handleOpenManageCharity} activeOpacity={0.8}>
              <Settings size={14} color="#fff" />
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
                <CheckCircle2 size={12} color="#fc7127" />
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
            <Droplets size={28} color="#cbd5e1" />
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

      {/* Community Insights (rotating mini-cards) */}
      <CommunityInsightPanels insights={liveInsights?.insights ?? null} />

      {/* Security Panel */}
      <Animated.View
        style={[
          styles.bentoCard,
          hasAnyIncidents && { backgroundColor: securityPulseBg },
          hasEmergencies && { borderColor: '#fecaca' },
          !hasEmergencies && hasWarnings && { borderColor: '#fde68a' },
        ]}
      >
        <View style={styles.bentoHeader}>
          <Shield
            size={22}
            color={hasEmergencies ? ERROR : hasWarnings ? '#d97706' : SECONDARY}
          />
          <Text
            style={[
              styles.bentoTitle,
              hasEmergencies && { color: ERROR },
              !hasEmergencies && hasWarnings && { color: '#d97706' },
            ]}
          >
            Security Panel
          </Text>
          {hasEmergencies && (
            <View style={styles.emergencyBadge}>
              <View style={styles.emergencyDot} />
              <Text style={styles.emergencyText}>
                {hasWarnings ? 'Emergency + Warning Active' : 'Emergency Active'}
              </Text>
            </View>
          )}
          {!hasEmergencies && hasWarnings && (
            <View style={styles.warningBadge}>
              <View style={styles.warningDot} />
              <Text style={styles.warningText}>Warning Active</Text>
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
            <Text style={[styles.securityStatValue, hasWarnings && { color: '#d97706' }]}>
              {warningCount}
            </Text>
          </View>
          <View style={styles.securityStat}>
            <Text style={styles.securityStatLabel}>RESPONDERS</Text>
            <View style={styles.securityValueRow}>
              <Text style={styles.securityStatValue}>{respondersOnline}</Text>
              {respondersOnline > 0 && <View style={styles.onlinePulseDot} />}
            </View>
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
                <Text style={[styles.incidentSectionLabel, { color: '#d97706' }]}>Active Warnings</Text>
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
                    <Text style={[styles.incidentTime, { color: '#d97706' }]}>
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

      {/* System Health */}
      <View style={styles.bentoCard}>
        <View style={styles.bentoHeader}>
          <Activity size={20} color="#fc7127" />
          <Text style={styles.bentoTitle}>System Health</Text>
        </View>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>UPTIME</Text>
          <Text style={[styles.healthValue, { color: '#fc7127' }]}>{systemUptime}%</Text>
        </View>
        <View style={styles.uptimeBar}>
          <View style={[styles.uptimeFill, { width: '99.9%' }]} />
        </View>
        <View style={[styles.healthRow, { marginTop: 16 }]}>
          <Text style={styles.healthLabel}>SECURITY THREATS</Text>
          <Text style={[styles.healthValue, securityThreats > 0 ? { color: ERROR } : { color: '#fc7127' }]}>
            {securityThreats === 0 ? 'None' : securityThreats}
          </Text>
        </View>
        <View style={styles.threatRow}>
          <View style={[styles.threatDot, { backgroundColor: securityThreats === 0 ? '#fc7127' : ERROR }]} />
          <Text style={styles.threatText}>
            {securityThreats === 0 ? 'All systems operational' : 'Active threats detected'}
          </Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.bentoCard}>
        <Text style={styles.bentoTitle}>Recent Moderator Activity</Text>
        <View style={{ gap: 10, marginTop: 12 }}>
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

        {/* View switcher */}
        <View style={styles.viewSwitcher}>
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            ...(!readOnly ? [
              { id: 'moderation', icon: Gavel },
              { id: 'members', icon: Users },
            ] : []),
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.viewSwitcherBtn, activeView === item.id && styles.viewSwitcherBtnActive]}
              onPress={() => {
                if (item.id === 'moderation') setModerationTab('members');
                setActiveView(item.id as any);
              }}
              activeOpacity={0.7}
            >
              <item.icon size={18} color={activeView === item.id ? PRIMARY : '#94a3b8'} />
            </TouchableOpacity>
          ))}
        </View>
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
              <CheckCircle2 size={14} color="#fff" />
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
              <CheckCircle2 size={40} color="#fc7127" />
            </View>
            <Text style={styles.setupCompleteTitle}>Your Community is Ready!</Text>
            <Text style={styles.setupCompleteDesc}>
              {currentCommunity?.name || 'Your community'} is set up and ready for members. You can
              always adjust settings from the Admin Dashboard.
            </Text>
            <TouchableOpacity style={styles.setupCompleteBtn} onPress={handleFinishSetup} activeOpacity={0.85}>
              <Text style={styles.setupCompleteBtnText}>Go to Home</Text>
              <ArrowUpRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default AdminDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  backBtn: { padding: 6 },
  logoBox: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: 26, height: 26 },
  topBarTitle: { fontSize: 15, fontWeight: '900', color: PRIMARY, flex: 1 },
  viewSwitcher: { flexDirection: 'row', gap: 4 },
  viewSwitcherBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  viewSwitcherBtnActive: { backgroundColor: '#f0fdf4' },

  dashScroll: { flex: 1 },
  dashContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  heroSection: { gap: 4, marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: PRIMARY },
  heroSubtitle: { fontSize: 14, color: '#64748b', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    gap: 4,
  },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  statBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: '900' },
  pulseDot: {
    position: 'absolute', top: -2, right: -2, width: 7, height: 7,
    borderRadius: 4, backgroundColor: ERROR,
  },

  bentoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 8,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  bentoCardLarge: {},
  bentoCardClickable: {},
  bentoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bentoIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bentoTitle: { fontSize: 18, fontWeight: '900', color: PRIMARY, marginTop: 4 },
  bentoDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  alertBox: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  alertBoxLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  alertBoxValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },

  coverageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  syncBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  mapPreview: { height: 140, borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  mapFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4,
  },
  mapFooterText: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  manageFundsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
  },
  manageFundsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  featuredCharity: {
    backgroundColor: PRIMARY, borderRadius: 16, padding: 16, gap: 6, marginTop: 8,
  },
  featuredCharityLabel: {
    fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  featuredCharityName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  completedBadgeText: { fontSize: 11, fontWeight: '700', color: '#fc7127' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  goalText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  progressTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: '#fc7127', borderRadius: 3 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, marginTop: 8,
  },
  completeBtnText: { color: PRIMARY, fontWeight: '700', fontSize: 14 },
  noCharity: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
    backgroundColor: '#f8fafc', borderRadius: 12, gap: 8, marginTop: 8,
  },
  noCharityText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  noCharitySubtext: { fontSize: 12, color: '#94a3b8' },
  potentialCatBox: {
    marginTop: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 86, 103, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  potentialCatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(30, 86, 103, 0.7)',
  },
  potentialCatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e5667',
  },
  potentialCatMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(30, 86, 103, 0.7)',
  },
  previousCampaigns: { marginTop: 8, gap: 8 },
  previousCampaignsTitle: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  prevCampaignRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  prevCampaignName: { fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 1 },
  prevCampaignAmount: { fontSize: 13, fontWeight: '900', color: '#fc7127' },

  emergencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  emergencyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ERROR },
  emergencyText: { fontSize: 10, fontWeight: '900', color: ERROR, textTransform: 'uppercase', letterSpacing: 0.8 },
  emergencyInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: 'auto',
    backgroundColor: '#fffbeb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  warningDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d97706' },
  warningText: { fontSize: 10, fontWeight: '900', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.8 },
  securityStats: { flexDirection: 'row', gap: 24, marginTop: 8 },
  securityStat: { gap: 4 },
  securityStatLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  securityStatValue: { fontSize: 28, fontWeight: '900', color: PRIMARY },
  incidentListWrap: {
    marginTop: 10,
    gap: 10,
  },
  incidentSection: {
    gap: 6,
  },
  incidentSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  incidentRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  incidentRowEmergency: {
    backgroundColor: 'rgba(254,242,242,0.8)',
    borderColor: '#fecaca',
  },
  incidentRowWarning: {
    backgroundColor: 'rgba(255,251,235,0.8)',
    borderColor: '#fde68a',
  },
  incidentMain: {
    flex: 1,
    minWidth: 0,
  },
  incidentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  incidentMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  incidentTime: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthLabel: { fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 },
  healthValue: { fontSize: 12, fontWeight: '700' },
  uptimeBar: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  uptimeFill: { height: '100%', backgroundColor: '#fc7127' },
  threatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  threatDot: { width: 8, height: 8, borderRadius: 4 },
  threatText: { fontSize: 12, color: '#64748b' },

  activityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  activitySubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },
  activityTime: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Setup bar
  setupBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  setupProgress: { height: 3, backgroundColor: '#f1f5f9' },
  setupProgressFill: { height: '100%', backgroundColor: PRIMARY },
  setupBarInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  setupStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setupStepLabel: { fontSize: 12, fontWeight: '900', color: PRIMARY },
  setupStepCount: {
    fontSize: 9, fontWeight: '900', color: '#94a3b8',
    backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  setupStepDesc: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  skipBtnText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  doneBtnText: { fontSize: 10, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  setupCompleteCard: {
    backgroundColor: '#fff', borderRadius: 32, padding: 32,
    width: '100%', maxWidth: 400, alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 10,
  },
  setupCompleteIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4',
    alignItems: 'center', justifyContent: 'center',
  },
  setupCompleteTitle: { fontSize: 22, fontWeight: '900', color: PRIMARY, textAlign: 'center' },
  setupCompleteDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  setupCompleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    marginTop: 8,
  },
  setupCompleteBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  suggestCard: {
    backgroundColor: '#fff', borderRadius: 32, padding: 24,
    width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 10,
    maxHeight: '90%',
  },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  suggestTitle: { fontSize: 22, fontWeight: '900', color: PRIMARY },
  suggestSubtitle: { fontSize: 12, color: '#64748b', marginTop: 4 },
  suggestField: { gap: 6 },
  suggestRow: { flexDirection: 'row', gap: 12 },
  suggestLabel: {
    fontSize: 9, fontWeight: '900', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  suggestInput: {
    backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#f1f5f9',
  },
  suggestTextarea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontSize: 12, color: ERROR, fontWeight: '600' },
  suggestButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelSuggestBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelSuggestBtnText: { color: '#64748b', fontWeight: '700', fontSize: 14 },
  submitSuggestBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 16, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitSuggestBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Moderation tile grid
  tileGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
  },
  tile: {
    width: '31.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    position: 'relative',
  },
  tileLocked: { opacity: 0.5 },
  tileIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 10, fontWeight: '900', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4,
    textAlign: 'center',
  },
  tileCount: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  tileLockBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
  },

  // Donor ticker chips
  donorTickerRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  donorChip: {
    backgroundColor: 'rgba(252,113,39,0.15)',
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(252,113,39,0.35)',
  },
  donorChipText: { fontSize: 11, fontWeight: '900', color: '#fc7127' },

  // Security online pulse
  securityValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlinePulseDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY,
  },
  onlineHint: {
    fontSize: 10, fontWeight: '700', color: PRIMARY,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2,
  },
});
