import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  Shield,
  Users,
  FileText,
  Store,
  Settings,
  History,
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserX,
  UserCheck,
  Pin,
  Trash2,
  Flag,
  ChevronRight,
  Clock,
  Plus,
  Link,
  Mail,
  ShieldAlert,
  Ban,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Copy,
  RefreshCw,
  Activity,
  Map,
  Save,
  Loader2,
  X,
  Globe,
  Tag,
  DollarSign,
  MessageSquare,
  Sparkles,
  Heart,
  Bookmark,
} from 'lucide-react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useCommunity } from '../../context/CommunityContext';
import { useTheme } from '../../context/ThemeContext';
import { BUSINESS_CATEGORIES, GOOGLE_PLACES_API_KEY, POST_SUBTYPE_CONFIG } from '../../constants';
import { PostConfirmationModal } from '../shared/PostConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { resolveMediaUrl } from '../../lib/config';
import { Share } from 'react-native';
import type { UserRole, UserProfile } from '../../types';
import { BusinessImportTool } from './BusinessImportTool';
import ManageCommunityCharity from '../settings/ManageCommunityCharity';
import { useModerationLogs } from '../../hooks/queries/useModerationLogs';
import { useMemberInsights } from '../../hooks/queries/useMemberInsights';
import { queryClient } from '../../lib/queryClient';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import Slider from '@react-native-community/slider';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { LAYER_ELEVATION, LAYER_Z_INDEX } from '../../theme/layers';
import { createShadow } from '../../theme/shadows';
import { getCardBorderColor, getCardShadow, getCardSurfaceColor } from '../../theme/cardStyles';
import { LALELA_LIGHT_THEME, type FoundationThemePresetId } from '../../theme/foundationThemes';

const PRIMARY = THEME_COLORS.primary;
const SECONDARY = THEME_COLORS.secondary;
const ERROR = THEME_COLORS.error;
const INVITE_WEB_BASE_URL = 'https://lalela.net';

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
  title: 20,
  display: 24,
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
} as const;

const LETTER_SPACING = {
  tight: 0.4,
  normal: 0.5,
  wide: 0.8,
  widest: 1,
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
  s20: 20,
  s60: 60,
  s40: 40,
} as const;

const RADIUS = {
  sm: 3,
  dot: 7,
  chip: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  card: 16,
  round: 20,
  circle: 40,
  tab: 22,
  pill: 99,
} as const;

export interface ModerationCenterHandle {
  saveCurrentTab: () => Promise<void>;
}

type ModTab = 'members' | 'content' | 'businesses' | 'rules' | 'logs' | 'categories' | 'coverage' | 'charity';
type MemberSubView = 'list' | 'invite' | 'details';

type ThemeDraft = {
  presetId: FoundationThemePresetId;
  mode: 'light' | 'dark';
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textPrimary: string;
  textSecondary: string;
  borderRadius: string;
  fontFamily: string;
  iconUrl: string;
};

function normalizeThemeNameValue(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return LALELA_LIGHT_THEME.name;

  const lower = trimmed.toLowerCase();
  if (lower === 'lalela light' || lower === 'lalela (baseline)') {
    return LALELA_LIGHT_THEME.name;
  }

  return trimmed;
}

type ThemeColorField =
  | 'primaryColor'
  | 'secondaryColor'
  | 'backgroundColor'
  | 'surfaceColor'
  | 'textPrimary'
  | 'textSecondary';

const COLOR_SWATCH_PRESETS = [
  THEME_COLORS.aliasHex_2d4b32,
  THEME_COLORS.aliasHex_bd5d38,
  THEME_COLORS.aliasHex_fafafa,
  THEME_COLORS.aliasHex_e8ddc8,
  THEME_COLORS.neutralTextStrong,
  THEME_COLORS.aliasHex_4a4f45,
  THEME_COLORS.primary,
  THEME_COLORS.secondary,
  THEME_COLORS.surfaceContainer,
  THEME_COLORS.surfaceContainerLow,
  THEME_COLORS.onSurface,
  THEME_COLORS.aliasHex_5a655d,
  THEME_COLORS.success,
  THEME_COLORS.info,
  THEME_COLORS.errorStrong,
  THEME_COLORS.warningStrong,
  THEME_COLORS.white,
  THEME_COLORS.black,
];

const VALID_COLOR_SWATCH_PRESETS = COLOR_SWATCH_PRESETS.filter(
  (hex) => typeof hex === 'string' && hex.trim().length > 0,
);

interface ModerationCenterProps {
  onBack: () => void;
  embedded?: boolean;
  initialTab?: ModTab;
}

export const ModerationCenter = forwardRef<ModerationCenterHandle, ModerationCenterProps>(
  ({ onBack, embedded = false, initialTab }, ref) => {
    const {
      currentCommunity,
      updateCommunityCategories,
      members,
      addMember,
      removeMember,
      deleteMember,
      updateMemberRole,
      searchUsers,
      posts,
      charitySuggestions,
      removePost,
      updatePost,
      updateUserBusiness,
      removeCommunityBusiness,
      updateCommunityCoverage,
      communityBusinesses,
      deleteUserBusiness,
      inviteMember,
      communityInvitations,
      addNotification,
      toggleEmergencyMode,
      activeCommunityLink,
      generateInviteLink,
    } = useCommunity();
    const { userProfile: currentUserProfile, sendSmsInvite } = useAuth();
    const {
      theme,
      source: themeSource,
      updateTheme,
      refreshTheme,
      loading: isThemeLoading,
    } = useTheme();

    const [activeTab, setActiveTab] = useState<ModTab>(initialTab || 'members');
    const coveragePlacesRef = useRef<GooglePlacesAutocompleteRef | null>(null);
    const [tempCoverage, setTempCoverage] = useState(
      currentCommunity?.coverageArea || {
        latitude: -26.2041,
        longitude: 28.0473,
        radius: 10,
        locationName: 'Johannesburg Central',
      }
    );

    const [memberSubView, setMemberSubView] = useState<MemberSubView>('list');
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [inviteEmailRecipient, setInviteEmailRecipient] = useState('');
    const [isSendingInviteEmail, setIsSendingInviteEmail] = useState(false);
    const [inviteEmailStatus, setInviteEmailStatus] = useState<{
      type: 'success' | 'error';
      message: string;
    } | null>(null);
    const [inviteSmsRecipient, setInviteSmsRecipient] = useState('');
    const [isSendingInviteSms, setIsSendingInviteSms] = useState(false);
    const [inviteSmsStatus, setInviteSmsStatus] = useState<{
      type: 'success' | 'error';
      message: string;
    } | null>(null);
    const [contentFilter, setContentFilter] = useState<
      'featured' | 'notices' | 'listings'
    >('featured');
    const [themeDraft, setThemeDraft] = useState<ThemeDraft>({
      presetId: 'lalela-light',
      mode: 'light',
      name: '',
      primaryColor: '',
      secondaryColor: '',
      backgroundColor: '',
      surfaceColor: '',
      textPrimary: '',
      textSecondary: '',
      borderRadius: '',
      fontFamily: '',
      iconUrl: '',
    });
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const [themeSaveStatus, setThemeSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [themeNameOptions, setThemeNameOptions] = useState<string[]>([LALELA_LIGHT_THEME.name]);
    const [showThemeNameMenu, setShowThemeNameMenu] = useState(false);
    const [showCreateThemeNameModal, setShowCreateThemeNameModal] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [activeColorField, setActiveColorField] = useState<ThemeColorField | null>(null);
    const [pickerColorValue, setPickerColorValue] = useState('');
    const [urgencyChangePost, setUrgencyChangePost] = useState<any>(null);
    const [pendingRemoveMember, setPendingRemoveMember] = useState<{ id: string; name: string } | null>(null);
    const [pendingDeleteMember, setPendingDeleteMember] = useState<{ id: string; name: string } | null>(null);
    const [pendingDeletePost, setPendingDeletePost] = useState<{ id: string; title: string } | null>(null);
    const [pendingRemoveBusiness, setPendingRemoveBusiness] = useState<any>(null);
    const [reloadingBusinessId, setReloadingBusinessId] = useState<string | null>(null);
    const [bizFilter, setBizFilter] = useState<'user' | 'ai'>('user');
    const [pendingCancelInvitation, setPendingCancelInvitation] = useState<{ id: string; label: string } | null>(null);
    const [isProcessingDestructiveAction, setIsProcessingDestructiveAction] = useState(false);
    const [showImportTool, setShowImportTool] = useState(false);
    const [pendingRoleChange, setPendingRoleChange] = useState<{
      userId: string;
      userName: string;
      currentRole: UserRole;
      nextRole: UserRole;
    } | null>(null);

    const moderationLogsQuery = useModerationLogs(currentCommunity?.id, { limit: 50 });
    const memberInsightsQuery = useMemberInsights(
      currentCommunity?.id,
      memberSubView === 'details' ? selectedMember?.userId : null,
    );

    const logs = moderationLogsQuery.data ?? [];
    const selectedMemberProfile = memberInsightsQuery.data?.profile ?? null;
    const selectedMemberStats = memberInsightsQuery.data?.stats ?? null;
    const selectedMemberRoleHistory = memberInsightsQuery.data?.history ?? [];
    const isLoadingMemberInsights = memberInsightsQuery.isFetching;

    useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
      const normalizedThemeName = normalizeThemeNameValue(theme.name);
      setThemeDraft({
        presetId: (theme.presetId as FoundationThemePresetId) || 'lalela-light',
        mode: theme.mode === 'dark' ? 'dark' : 'light',
        name: normalizedThemeName,
        primaryColor: theme.primaryColor ?? '',
        secondaryColor: theme.secondaryColor ?? '',
        backgroundColor: theme.backgroundColor ?? '',
        surfaceColor: theme.surfaceColor ?? '',
        textPrimary: theme.textPrimary ?? '',
        textSecondary: theme.textSecondary ?? '',
        borderRadius: theme.borderRadius ?? '',
        fontFamily: theme.fontFamily ?? '',
        iconUrl: theme.iconUrl ?? '',
      });
      const nextOptions = [LALELA_LIGHT_THEME.name, normalizedThemeName]
        .map((v) => normalizeThemeNameValue(v))
        .filter(Boolean);
      setThemeNameOptions(Array.from(new Set(nextOptions)));
    }, [theme]);

    const applyFoundationPreset = () => {
      const preset = LALELA_LIGHT_THEME;
      setThemeSaveStatus(null);
      setThemeDraft((prev) => ({
        ...prev,
        presetId: preset.presetId,
        mode: preset.mode,
        name: preset.name,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        backgroundColor: preset.backgroundColor,
        surfaceColor: preset.surfaceColor,
        textPrimary: preset.textPrimary,
        textSecondary: preset.textSecondary,
        borderRadius: preset.borderRadius,
        fontFamily: preset.fontFamily,
        iconUrl: preset.iconUrl ?? '',
      }));
    };

    const handleSendInviteEmail = async (email: string, link: string) => {
      try {
        if (!currentCommunity?.id || currentCommunity.id === 'loading') {
          throw new Error('Community not ready');
        }
        await api.post(`/communities/${currentCommunity.id}/invitations/email`, {
          email,
          inviteUrl: link,
          senderName: currentUserProfile?.name ?? 'A Lalela community admin',
        });

        setInviteEmailStatus({
          type: 'success',
          message: `Invitation sent to ${email}`,
        });
      } catch (err: any) {
        setInviteEmailStatus({
          type: 'error',
          message: err.response?.data?.error || err.message || 'Failed to send invitation',
        });
        throw err;
      }
    };

    useEffect(() => {
      if (currentCommunity?.coverageArea) {
        setTempCoverage(currentCommunity.coverageArea);
      }
    }, [currentCommunity?.coverageArea]);

    const handleSaveCoverage = async () => {
      if (currentCommunity?.id) {
        await updateCommunityCoverage(currentCommunity.id, tempCoverage);
        Alert.alert('Saved', 'Coverage area updated successfully.');
      }
    };

    useImperativeHandle(ref, () => ({
      saveCurrentTab: async () => {
        if (activeTab === 'coverage') {
          await handleSaveCoverage();
        }
      },
    }));

    const handleSearch = async () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setIsSearching(false);
      }
    };

    const handleInviteMember = async (userId: string) => {
      try {
        await inviteMember(userId, 'MEMBER');
        setMemberSubView('list');
        setSearchQuery('');
        setSearchResults([]);
        Alert.alert('Success', 'Invitation sent successfully!');
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to send invitation.');
      }
    };

    const publicInviteUrl = activeCommunityLink
      ? `${INVITE_WEB_BASE_URL}/join?join=${activeCommunityLink.code}`
      : '';
    const nativeInviteUrl = activeCommunityLink
      ? `lalela://join?join=${activeCommunityLink.code}`
      : '';

    const handleRemoveMember = async (userId: string) => {
      try {
        await removeMember(userId);
        setMemberSubView('list');
      } catch (e) {
        console.error('Failed to remove member:', e);
      }
    };

    const handleDeleteMember = async (userId: string) => {
      try {
        await deleteMember(userId);
        setMemberSubView('list');
      } catch (e) {
        console.error('Failed to delete member:', e);
      }
    };

    const handleUpdateRole = async (userId: string, role: UserRole) => {
      try {
        await updateMemberRole(userId, role);
        if (currentCommunity?.id && currentUserProfile?.id) {
          const isPromotion = role === 'MODERATOR';
          api.post(`/communities/${currentCommunity.id}/moderation-logs`, {
            moderator_id: currentUserProfile.id,
            action: isPromotion ? 'promote' : 'demote',
            target_id: userId,
            target_type: 'user',
            reason: isPromotion ? 'Promoted to moderator' : 'Moderator privileges removed',
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['moderation-logs', currentCommunity.id] });
            queryClient.invalidateQueries({ queryKey: ['member-insights', currentCommunity.id] });
          }).catch(console.error);
        }
        if (selectedMember?.userId === userId) {
          setSelectedMember({ ...selectedMember, role });
        }
      } catch (e) {
        console.error('Failed to update role:', e);
      }
    };

    const handleDeletePost = async (postId?: string) => {
      if (!postId || postId === 'undefined') {
        Alert.alert('Delete failed', 'This post cannot be deleted because its ID is missing.');
        return;
      }
      const post = posts.find((p: any) => p.id === postId);
      try {
        await removePost(postId);
      } catch (e: any) {
        const status = e?.response?.status;
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          (status === 404
            ? 'Post not found or already deleted.'
            : status === 403
            ? 'You do not have permission to delete this post.'
            : 'Unable to delete post right now. Please try again.');
        Alert.alert('Delete failed', message);
        console.warn('Delete post request failed:', { status, postId });
        return;
      }

      if (!currentCommunity?.id) {
        return;
      }

      // Non-critical side effects should never report delete failure to users.
      try {
        await api.post(`/communities/${currentCommunity.id}/moderation-logs`, {
          communityId: currentCommunity.id,
          moderator_id: currentUserProfile?.id,
          action: 'delete',
          target_id: postId,
          target_type: 'post',
        });
        queryClient.invalidateQueries({ queryKey: ['moderation-logs', currentCommunity.id] });
      } catch (error: any) {
        const status = error?.response?.status;
        if (status !== 404) {
          console.warn('Post deleted but moderation log failed:', {
            status,
            postId,
          });
        }
      }

      if (post?.authorId && post.authorId !== currentUserProfile?.id) {
        try {
          await addNotification(post.authorId, {
            title: 'Post Removed',
            message: `Your post "${post.title}" has been removed by an admin.`,
            type: 'system',
            metadata: { action: 'post_deleted', postId, communityId: currentCommunity.id },
          });
        } catch (error: any) {
          console.warn('Post deleted but notification failed:', {
            status: error?.response?.status,
            postId,
            authorId: post.authorId,
          });
        }
      }
    };

    const handleTogglePin = async (post: any) => {
      try {
        const newStatus = post.status === 'Pinned' ? 'Active' : 'Pinned';
        await updatePost({ ...post, status: newStatus });
        if (newStatus === 'Pinned' && post.authorId && currentCommunity?.id) {
          await addNotification(post.authorId, {
            title: 'Post Featured',
            message: `Your post "${post.title}" has been featured by an admin.`,
            type: 'system',
            metadata: { action: 'post_pinned', postId: post.id, communityId: currentCommunity.id },
          });
        }
      } catch (e) {
        console.error('Failed to toggle pin:', e);
      }
    };

    const handleRemoveBusiness = async (business: any) => {
      try {
        if (business.source === 'IMPORT') {
          await deleteUserBusiness(business.id);
        } else {
          if (!currentCommunity?.id) return;
          await removeCommunityBusiness(currentCommunity.id, business.id);
        }
      } catch (e) { console.error('Failed to remove business:', e); }
    };

    const handleToggleBusinessPin = async (business: any) => {
      try {
        const currentStatus = String(business?.status || '').toUpperCase();
        const nextStatus = currentStatus === 'PINNED' ? 'ACTIVE' : 'PINNED';
        await updateUserBusiness({ ...business, status: nextStatus } as any);
      } catch (e) {
        console.error('Failed to toggle business pin:', e);
      }
    };

    const handleReloadBusinessImage = async (business: any) => {
      if (!business?.id) return;
      if (!business?.googlePlaceId) {
        Alert.alert('Reload unavailable', 'This business does not have a Google Place ID.');
        return;
      }

      setReloadingBusinessId(business.id);
      try {
        await api.post(`/businesses/${business.id}/reload-image`);
        if (currentCommunity?.id) {
          await queryClient.invalidateQueries({ queryKey: ['community-bundle', currentCommunity.id] });
        }
      } catch (error: any) {
        const message = error?.response?.data?.error || 'Unable to reload image right now.';
        Alert.alert('Reload failed', message);
      } finally {
        setReloadingBusinessId(null);
      }
    };

    const handleApprovePublicListing = async (post: any) => {
      try {
        await updatePost({ ...post, status: 'Active' });
      } catch (e) { console.error('Failed to approve listing:', e); }
    };

    const handleRejectPublicListing = (post: any) => {
      Alert.prompt('Reject Listing', 'Reason for rejection:', async (reason) => {
        if (!reason) return;
        try {
          await updatePost({ ...post, status: 'Rejected', rejectionReason: reason });
        } catch (e) { console.error('Failed to reject listing:', e); }
      });
    };

    const handleConfirmRemoveMember = async () => {
      if (!pendingRemoveMember || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try {
        await handleRemoveMember(pendingRemoveMember.id);
        if (currentCommunity?.id && currentUserProfile?.id) {
          await api.post(`/communities/${currentCommunity.id}/moderation-logs`, {
            communityId: currentCommunity.id,
            moderator_id: currentUserProfile.id,
            action: 'deactivate',
            target_id: pendingRemoveMember.id,
            target_type: 'user',
            reason: 'Member deactivated by admin',
          });
          queryClient.invalidateQueries({ queryKey: ['moderation-logs', currentCommunity.id] });
          queryClient.invalidateQueries({ queryKey: ['member-insights', currentCommunity.id] });
        }
        setPendingRemoveMember(null);
      }
      finally { setIsProcessingDestructiveAction(false); }
    };

    const handleConfirmDeleteMember = async () => {
      if (!pendingDeleteMember || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try {
        await handleDeleteMember(pendingDeleteMember.id);
        if (currentCommunity?.id && currentUserProfile?.id) {
          await api.post(`/communities/${currentCommunity.id}/moderation-logs`, {
            communityId: currentCommunity.id,
            moderator_id: currentUserProfile.id,
            action: 'remove',
            target_id: pendingDeleteMember.id,
            target_type: 'user',
            reason: 'Member deleted by admin',
          });
          queryClient.invalidateQueries({ queryKey: ['moderation-logs', currentCommunity.id] });
          queryClient.invalidateQueries({ queryKey: ['member-insights', currentCommunity.id] });
        }
        setPendingDeleteMember(null);
      }
      finally { setIsProcessingDestructiveAction(false); }
    };

    const handleConfirmRoleChange = async () => {
      if (!pendingRoleChange || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try {
        await handleUpdateRole(pendingRoleChange.userId, pendingRoleChange.nextRole);
        setPendingRoleChange(null);
      } finally {
        setIsProcessingDestructiveAction(false);
      }
    };

    const handleConfirmDeletePost = async () => {
      if (!pendingDeletePost || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try { await handleDeletePost(pendingDeletePost.id); setPendingDeletePost(null); }
      finally { setIsProcessingDestructiveAction(false); }
    };

    const handleConfirmRemoveBusiness = async () => {
      if (!pendingRemoveBusiness || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try { await handleRemoveBusiness(pendingRemoveBusiness); setPendingRemoveBusiness(null); }
      finally { setIsProcessingDestructiveAction(false); }
    };

    const handleConfirmCancelInvitation = async () => {
      if (!pendingCancelInvitation || isProcessingDestructiveAction) return;
      setIsProcessingDestructiveAction(true);
      try {
        await api.delete(`/communities/${currentCommunity?.id ?? ''}/invitations/${pendingCancelInvitation.id}`);
        setPendingCancelInvitation(null);
      } catch (e) { console.error('Failed to cancel invitation:', e); }
      finally { setIsProcessingDestructiveAction(false); }
    };

    const handleThemeDraftChange = (field: keyof ThemeDraft, value: string) => {
      setThemeSaveStatus(null);
      setThemeDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleCreateThemeName = () => {
      const nextName = newThemeName.trim();
      if (!nextName) {
        setThemeSaveStatus({ type: 'error', message: 'Please enter a theme name' });
        return;
      }

      setThemeNameOptions((prev) => Array.from(new Set([
        LALELA_LIGHT_THEME.name,
        ...prev,
        nextName,
      ].map((v) => normalizeThemeNameValue(v)).filter(Boolean))));
      handleThemeDraftChange('name', normalizeThemeNameValue(nextName));
      setShowCreateThemeNameModal(false);
      setShowThemeNameMenu(false);
      setNewThemeName('');
    };

    const normalizeHexColor = (value: string): string => {
      const raw = value.trim().replace(/^#/, '');
      if (raw.length === 3 || raw.length === 6 || raw.length === 8) {
        return `#${raw.toUpperCase()}`;
      }
      return value.trim();
    };

    const openColorPicker = (field: ThemeColorField) => {
      const current = normalizeHexColor((themeDraft[field] || '').trim());
      setActiveColorField(field);
      setPickerColorValue(current || THEME_COLORS.black);
      setShowColorPicker(true);
    };

    const applyPickerColor = () => {
      if (!activeColorField) return;
      const normalized = normalizeHexColor(pickerColorValue);
      handleThemeDraftChange(activeColorField, normalized);
      setShowColorPicker(false);
      setActiveColorField(null);
    };

    const renderThemeColorField = (label: string, field: ThemeColorField) => (
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.colorInputRow}>
          <TouchableOpacity
            onPress={() => openColorPicker(field)}
            style={[styles.colorSwatchBtn, {
              backgroundColor: normalizeHexColor(themeDraft[field] || THEME_COLORS.black) || THEME_COLORS.black,
            }]}
            activeOpacity={0.8}
          />
          <TextInput
            style={styles.colorHexInput}
            value={themeDraft[field]}
            onChangeText={(v) => handleThemeDraftChange(field, v)}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
    );

    const handleSaveTheme = async () => {
      const colorFields: Array<keyof ThemeDraft> = [
        'primaryColor',
        'secondaryColor',
        'backgroundColor',
        'surfaceColor',
        'textPrimary',
        'textSecondary',
      ];
      const colorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

      for (const field of colorFields) {
        if (!colorRegex.test((themeDraft[field] || '').trim())) {
          setThemeSaveStatus({ type: 'error', message: `Invalid color value for ${field}` });
          return;
        }
      }

      if (!themeDraft.borderRadius.trim()) {
        setThemeSaveStatus({ type: 'error', message: 'Border radius is required' });
        return;
      }

      if (!themeDraft.fontFamily.trim()) {
        setThemeSaveStatus({ type: 'error', message: 'Font family is required' });
        return;
      }

      setIsSavingTheme(true);
      try {
        const baselineName = LALELA_LIGHT_THEME.name.toLowerCase();
        const draftName = normalizeThemeNameValue(themeDraft.name);
        const hasCustomization =
          themeDraft.primaryColor.trim() !== LALELA_LIGHT_THEME.primaryColor ||
          themeDraft.secondaryColor.trim() !== LALELA_LIGHT_THEME.secondaryColor ||
          themeDraft.backgroundColor.trim() !== LALELA_LIGHT_THEME.backgroundColor ||
          themeDraft.surfaceColor.trim() !== LALELA_LIGHT_THEME.surfaceColor ||
          themeDraft.textPrimary.trim() !== LALELA_LIGHT_THEME.textPrimary ||
          themeDraft.textSecondary.trim() !== LALELA_LIGHT_THEME.textSecondary ||
          themeDraft.borderRadius.trim() !== LALELA_LIGHT_THEME.borderRadius ||
          themeDraft.fontFamily.trim() !== LALELA_LIGHT_THEME.fontFamily ||
          (themeDraft.iconUrl.trim() || '') !== (LALELA_LIGHT_THEME.iconUrl || '');

        const resolvedName =
          hasCustomization && (!draftName || draftName.toLowerCase() === baselineName)
            ? `${currentCommunity?.name || 'Community'} Theme`
            : normalizeThemeNameValue(draftName || LALELA_LIGHT_THEME.name);

        const savedTheme = await updateTheme({
          presetId: themeDraft.presetId,
          mode: themeDraft.mode,
          name: resolvedName,
          primaryColor: themeDraft.primaryColor.trim(),
          secondaryColor: themeDraft.secondaryColor.trim(),
          backgroundColor: themeDraft.backgroundColor.trim(),
          surfaceColor: themeDraft.surfaceColor.trim(),
          textPrimary: themeDraft.textPrimary.trim(),
          textSecondary: themeDraft.textSecondary.trim(),
          borderRadius: themeDraft.borderRadius.trim(),
          fontFamily: themeDraft.fontFamily.trim(),
          iconUrl: themeDraft.iconUrl.trim() || null,
        });

        setThemeDraft((prev) => ({
          ...prev,
          name: normalizeThemeNameValue(savedTheme.name || resolvedName),
        }));
        setThemeNameOptions((prev) => Array.from(new Set([
          LALELA_LIGHT_THEME.name,
          ...prev,
          savedTheme.name || resolvedName,
        ].map((v) => normalizeThemeNameValue(v)).filter(Boolean))));
        await refreshTheme();
        setThemeSaveStatus({ type: 'success', message: `Saved as community theme: ${savedTheme.name || resolvedName}. Applied immediately in this app.` });
      } catch (error: any) {
        setThemeSaveStatus({
          type: 'error',
          message: error?.response?.data?.error || error?.message || 'Failed to save theme',
        });
      } finally {
        setIsSavingTheme(false);
      }
    };

    const handleResetThemeToBaseline = async () => {
      const baseline = LALELA_LIGHT_THEME;
      setThemeSaveStatus(null);
      setIsSavingTheme(true);
      try {
        const resetPayload = {
          presetId: baseline.presetId,
          mode: baseline.mode,
          name: baseline.name,
          primaryColor: baseline.primaryColor,
          secondaryColor: baseline.secondaryColor,
          backgroundColor: baseline.backgroundColor,
          surfaceColor: baseline.surfaceColor,
          textPrimary: baseline.textPrimary,
          textSecondary: baseline.textSecondary,
          borderRadius: baseline.borderRadius,
          fontFamily: baseline.fontFamily,
          iconUrl: baseline.iconUrl ?? null,
        };

        await updateTheme(resetPayload);
        setThemeDraft({
          ...resetPayload,
          iconUrl: resetPayload.iconUrl ?? '',
        });
        setThemeNameOptions([LALELA_LIGHT_THEME.name]);
        await refreshTheme();
        setThemeSaveStatus({ type: 'success', message: 'Theme reset to Lalela baseline' });
      } catch (error: any) {
        setThemeSaveStatus({
          type: 'error',
          message: error?.response?.data?.error || error?.message || 'Failed to reset theme',
        });
      } finally {
        setIsSavingTheme(false);
      }
    };

    const tabs: { id: ModTab; label: string; icon: React.ReactNode }[] = [
      { id: 'members', label: 'Members', icon: <Users size={16} color={activeTab === 'members' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'content', label: 'Content', icon: <FileText size={16} color={activeTab === 'content' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'businesses', label: 'Businesses', icon: <Store size={16} color={activeTab === 'businesses' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'categories', label: 'Categories', icon: <Tag size={16} color={activeTab === 'categories' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'rules', label: 'Rules', icon: <Shield size={16} color={activeTab === 'rules' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'coverage', label: 'Coverage', icon: <Map size={16} color={activeTab === 'coverage' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'charity', label: 'Charity', icon: <Heart size={16} color={activeTab === 'charity' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
      { id: 'logs', label: 'Manage', icon: <Sparkles size={16} color={activeTab === 'logs' ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} /> },
    ];

    const renderTabBar = () => (
      <View style={styles.tabBar}>
        <View style={styles.tabBarContent}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id)}
            activeOpacity={0.7}
          >
            {t.icon}
          </TouchableOpacity>
        ))}
        </View>
      </View>
    );

    const renderCharityModeration = () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: SPACE.s40 }}
        keyboardShouldPersistTaps="handled"
      >
        <ManageCommunityCharity />
      </ScrollView>
    );

    const renderCoverage = () => (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={{ gap: SPACE.xl, paddingBottom: SPACE.s40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coverage Area</Text>
        </View>

        <View
          style={[
            styles.fieldGroup,
            {
              zIndex: LAYER_Z_INDEX.placesOverlay,
              elevation: LAYER_ELEVATION.placesOverlay,
              position: 'relative',
            },
          ]}
        >
          <Text style={styles.fieldLabel}>Location Name</Text>
          <GooglePlacesAutocomplete
            ref={coveragePlacesRef as any}
            placeholder={tempCoverage.locationName || 'e.g. Johannesburg Central'}
            fetchDetails
            // @ts-ignore
            scrollEnabled={false}
            onPress={(data, details) => {
              const name = data.description;
              const lat = details?.geometry?.location?.lat ?? tempCoverage.latitude;
              const lng = details?.geometry?.location?.lng ?? tempCoverage.longitude;
              setTempCoverage({ ...tempCoverage, locationName: name, latitude: lat, longitude: lng });
            }}
            query={{ key: GOOGLE_PLACES_API_KEY, language: 'en' }}
            textInputProps={{
              placeholderTextColor: THEME_COLORS.neutralTextMuted,
            }}
            styles={{
              textInput: { ...styles.input, marginBottom: SPACE.zero },
              listView: { 
                position: 'absolute', 
                width: '100%', 
                top: SPACE.s60,
                backgroundColor: THEME_COLORS.surface, 
                borderRadius: RADIUS.md, 
                marginTop: SPACE.xxs,
                ...createShadow(THEME_COLORS.black, 0, 0, 0.1, 6, 4),
                zIndex: 9999
              },
              row: { paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl },
              description: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextEmphasis },
            }}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.radiusRow}>
            <Text style={styles.fieldLabel}>Radius</Text>
            <Text style={styles.radiusValue}>{Math.round(tempCoverage.radius || 10)} km</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={200}
            step={1}
            value={tempCoverage.radius || 10}
            onValueChange={(val) => setTempCoverage({ ...tempCoverage, radius: val })}
            minimumTrackTintColor={PRIMARY}
            maximumTrackTintColor={THEME_COLORS.neutralBorderStrong}
            thumbTintColor={PRIMARY}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Set Center on Map</Text>
          <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextMuted, marginBottom: SPACE.xl }}>
            Tap the map to move the center point, or drag the pin to fine-tune.
          </Text>
          <View style={styles.mapContainer}>
            <MapView
              {...defaultMapViewProps}
              provider={Platform.OS === 'ios' ? undefined : 'google'}
              style={styles.map}
              region={{
                latitude: isNaN(tempCoverage.latitude) ? -26.2041 : tempCoverage.latitude,
                longitude: isNaN(tempCoverage.longitude) ? 28.0473 : tempCoverage.longitude,
                latitudeDelta: Math.max(0.02, (tempCoverage.radius || 10) / 111) * 2.5,
                longitudeDelta: Math.max(0.02, (tempCoverage.radius || 10) / 111) * 2.5,
              }}
              scrollEnabled
              zoomEnabled
              rotateEnabled={false}
              pitchEnabled={false}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setTempCoverage({ ...tempCoverage, latitude, longitude });
              }}
            >
              <Circle
                center={{
                  latitude: isNaN(tempCoverage.latitude) ? -26.2041 : tempCoverage.latitude,
                  longitude: isNaN(tempCoverage.longitude) ? 28.0473 : tempCoverage.longitude,
                }}
                radius={(tempCoverage.radius || 10) * 1000}
                fillColor={THEME_COLORS.primaryTintSoft}
                strokeColor={THEME_COLORS.primary}
                strokeWidth={2}
              />
              <Marker
                coordinate={{
                  latitude: isNaN(tempCoverage.latitude) ? -26.2041 : tempCoverage.latitude,
                  longitude: isNaN(tempCoverage.longitude) ? 28.0473 : tempCoverage.longitude,
                }}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setTempCoverage({ ...tempCoverage, latitude, longitude });
                }}
                pinColor={PRIMARY}
              />
            </MapView>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.lg }}>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle }}>
              Lat: {isNaN(tempCoverage.latitude) ? '-' : tempCoverage.latitude.toFixed(5)}
            </Text>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle }}>
              Lng: {isNaN(tempCoverage.longitude) ? '-' : tempCoverage.longitude.toFixed(5)}
            </Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
            <ShieldCheck size={24} color={PRIMARY} />
            <Text style={styles.infoBannerTitle}>Active Monitoring Zone</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCoverage} activeOpacity={0.8}>
            <Save size={16} color={THEME_COLORS.white} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );

    const renderMembers = () => {
      if (memberSubView === 'invite') return renderInviteMembers();
      if (memberSubView === 'details' && selectedMember) return renderMemberDetails();

      const pendingInvites = Array.isArray(communityInvitations)
        ? communityInvitations.filter((inv: any) => inv.status === 'pending')
        : [];

      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.s16, paddingBottom: SPACE.s40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Member Management</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setMemberSubView('invite')}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color={THEME_COLORS.white} />
              <Text style={styles.actionBtnText}>Add Members</Text>
            </TouchableOpacity>
          </View>

          {/* Pending invitations */}
          {pendingInvites.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>PENDING INVITATIONS ({pendingInvites.length})</Text>
              {pendingInvites.map((inv: any) => (
                <View key={inv.id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Mail size={20} color={THEME_COLORS.neutralTextMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>Invited User</Text>
                    <Text style={styles.memberSub}>{inv.invited_user_id?.slice(0, 20)}...</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: THEME_COLORS.neutralBg }]}>
                    <Text style={[styles.roleBadgeText, { color: THEME_COLORS.neutralTextSubtle }]}>{inv.role}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setPendingCancelInvitation({ id: inv.id, label: inv.invited_user_id || 'Pending invite' })}
                    style={styles.iconBtn}
                  >
                    <X size={18} color={ERROR} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Members list */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>MEMBERS ({members.length})</Text>
            {members.length > 0 ? (
              members.map((member: any) => (
                <TouchableOpacity
                  key={member.userId}
                  style={styles.memberRow}
                  onPress={() => { setSelectedMember(member); setMemberSubView('details'); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberImgWrap}>
                    <Image
                      source={{ uri: member.image || `https://picsum.photos/seed/${member.userId}/100/100` }}
                      style={styles.memberImg}
                    />
                    {!!member.isSecurityMember && (
                      <View style={styles.memberSecurityBadge}>
                        <Shield size={8} color={THEME_COLORS.white} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.name || 'Unknown'}</Text>
                    <View style={styles.memberStatusRow}>
                      <View style={[styles.statusDot, {
                        backgroundColor: member.status === 'ACTIVE' ? THEME_COLORS.secondaryContainer : member.status === 'READ-ONLY' ? THEME_COLORS.warningStrong : THEME_COLORS.neutralTextMuted
                      }]} />
                      <Text style={styles.memberSub}>{member.status}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.roleBadge,
                    { backgroundColor: member.role === 'ADMIN' ? PRIMARY : member.role === 'MODERATOR' ? SECONDARY : THEME_COLORS.neutralBgSoft }
                  ]}>
                    <Text style={[styles.roleBadgeText, { color: (member.role === 'ADMIN' || member.role === 'MODERATOR') ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle }]}>
                      {member.role}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={THEME_COLORS.neutralTextMuted} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Users size={32} color={THEME_COLORS.neutralBorderStrong} />
                <Text style={styles.emptyStateText}>No members yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      );
    };

    const renderInviteMembers = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.s16, paddingBottom: SPACE.s40 }}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setMemberSubView('list')} style={styles.backBtn}>
            <ArrowLeft size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Invite New Members</Text>
        </View>

        {/* Invite link */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SHARE INVITE LINK</Text>
          {activeCommunityLink ? (
            <>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {publicInviteUrl}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Join ${currentCommunity?.name || 'this community'} on Lalela:\n\nOpen in app: ${nativeInviteUrl}\nOpen in browser: ${publicInviteUrl}`,
                      });
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    } catch (e) { console.error(e); }
                  }}
                >
                  {linkCopied ? (
                    <CheckCircle2 size={18} color={THEME_COLORS.secondaryContainer} />
                  ) : (
                    <Copy size={18} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={[styles.buttonRow, { marginTop: SPACE.xxl }]}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: SPACE.zero }]}
                  value={inviteEmailRecipient}
                  onChangeText={setInviteEmailRecipient}
                  placeholder="Recipient email..."
                  placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.actionBtn, { marginLeft: SPACE.lg, paddingHorizontal: SPACE.s16 }]}
                  onPress={async () => {
                    if (!inviteEmailRecipient || !activeCommunityLink) return;
                    setIsSendingInviteEmail(true);
                    setInviteEmailStatus(null);
                    try {
                      await handleSendInviteEmail(inviteEmailRecipient, publicInviteUrl);
                      setInviteEmailRecipient('');
                    } catch (err: any) {
                      // Error handled in function
                    } finally {
                      setIsSendingInviteEmail(false);
                    }
                  }}
                  disabled={isSendingInviteEmail || !inviteEmailRecipient}
                >
                  {isSendingInviteEmail ? (
                    <ActivityIndicator size="small" color={THEME_COLORS.white} />
                  ) : (
                    <Mail size={16} color={THEME_COLORS.white} />
                  )}
                </TouchableOpacity>
              </View>
              {inviteEmailStatus && (
                <View style={[styles.statusBanner, {
                  backgroundColor: inviteEmailStatus.type === 'success' ? THEME_COLORS.successSurface : THEME_COLORS.errorSurface,
                  marginTop: SPACE.xxl,
                }]}>
                  <Text style={{ color: inviteEmailStatus.type === 'success' ? THEME_COLORS.primaryContainer : ERROR, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold }}>
                    {inviteEmailStatus.message}
                  </Text>
                </View>
              )}
              <View style={[styles.buttonRow, { marginTop: SPACE.xxl }]}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: SPACE.zero }]}
                  value={inviteSmsRecipient}
                  onChangeText={setInviteSmsRecipient}
                  placeholder="+27 phone in E.164…"
                  placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.actionBtn, { marginLeft: SPACE.lg, paddingHorizontal: SPACE.s16 }]}
                  onPress={async () => {
                    if (!inviteSmsRecipient || !currentCommunity?.id || currentCommunity.id === 'loading') return;
                    const phone = inviteSmsRecipient.trim();
                    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
                      setInviteSmsStatus({ type: 'error', message: 'Use international format, e.g. +27821234567' });
                      return;
                    }
                    setIsSendingInviteSms(true);
                    setInviteSmsStatus(null);
                    try {
                      await sendSmsInvite(phone, currentCommunity.id);
                      setInviteSmsStatus({ type: 'success', message: 'SMS invite sent.' });
                      setInviteSmsRecipient('');
                    } catch (err: any) {
                      const msg = err?.response?.data?.error ?? err.message ?? 'Failed to send SMS invite';
                      setInviteSmsStatus({ type: 'error', message: msg });
                    } finally {
                      setIsSendingInviteSms(false);
                    }
                  }}
                  disabled={isSendingInviteSms || !inviteSmsRecipient}
                >
                  {isSendingInviteSms ? (
                    <ActivityIndicator size="small" color={THEME_COLORS.white} />
                  ) : (
                    <MessageSquare size={16} color={THEME_COLORS.white} />
                  )}
                </TouchableOpacity>
              </View>
              {inviteSmsStatus && (
                <View style={[styles.statusBanner, {
                  backgroundColor: inviteSmsStatus.type === 'success' ? THEME_COLORS.successSurface : THEME_COLORS.errorSurface,
                  marginTop: SPACE.xxl,
                }]}>
                  <Text style={{ color: inviteSmsStatus.type === 'success' ? THEME_COLORS.primaryContainer : ERROR, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold }}>
                    {inviteSmsStatus.message}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyStateText}>No active invite link. Generate one below.</Text>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1 }]}
              onPress={async () => {
                setGeneratingLink(true);
                try { await generateInviteLink(); }
                catch (err: any) { Alert.alert('Error', err.message || 'Failed to generate invite link.'); }
                finally { setGeneratingLink(false); }
              }}
              disabled={generatingLink}
            >
              {generatingLink ? (
                <ActivityIndicator size="small" color={THEME_COLORS.white} />
              ) : (
                <RefreshCw size={16} color={THEME_COLORS.white} />
              )}
              <Text style={styles.actionBtnText}>
                {activeCommunityLink ? 'Regenerate' : 'Generate Link'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending invitations sidebar */}
        {Array.isArray(communityInvitations) && communityInvitations.filter((inv: any) => inv.status === 'pending').length > 0 && (
          <View style={[styles.card, { backgroundColor: SECONDARY }]}>
            <Text style={[styles.cardLabel, { color: THEME_COLORS.whiteOverlay70 }]}>
              PENDING INVITATIONS ({communityInvitations.filter((inv: any) => inv.status === 'pending').length})
            </Text>
            {communityInvitations.filter((inv: any) => inv.status === 'pending').map((inv: any) => (
              <View key={inv.id} style={[styles.memberRow, { borderBottomColor: THEME_COLORS.alias_rgba_255_255_255_0_1 }]}>
                <Mail size={16} color={THEME_COLORS.whiteOverlay80} />
                <Text style={[styles.memberName, { color: THEME_COLORS.white, flex: 1, marginLeft: SPACE.lg }]} numberOfLines={1}>
                  {inv.invited_user_id?.slice(0, 20)}...
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: THEME_COLORS.surface }]}>
                  <Text style={[styles.roleBadgeText, { color: THEME_COLORS.neutralTextStrong }]}>{inv.role}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );

    const renderMemberDetails = () => {
      const memberListings = posts
        .filter((post: any) => post.authorId === selectedMember.userId && post.status !== 'deleted')
        .slice(0, 5);
      const memberSuggestions = charitySuggestions
        .filter((suggestion: any) => suggestion.suggested_by_id === selectedMember.userId)
        .slice(0, 5);

      const fallbackInsights = {
        totalListings: posts.filter((post: any) => post.authorId === selectedMember.userId && post.type === 'listing').length,
        totalNotices: posts.filter((post: any) => post.authorId === selectedMember.userId && post.type === 'notice').length,
        totalSuggestions: charitySuggestions.filter((suggestion: any) => suggestion.suggested_by_id === selectedMember.userId).length,
        activeListings: posts.filter((post: any) => post.authorId === selectedMember.userId && post.type === 'listing' && post.status === 'Active').length,
      };

      const insights = {
        ...fallbackInsights,
        ...(selectedMemberStats || {}),
      };

      const joinedDate = selectedMember?.joinedAt
        ? new Date(selectedMember.joinedAt).toLocaleDateString()
        : 'Unknown';

      const formatTimestamp = (value: any) => {
        if (!value) return 'Recent';
        if (typeof value === 'string' || value instanceof Date) {
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? 'Recent' : parsed.toLocaleString();
        }
        return 'Recent';
      };

      return (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.s16, paddingBottom: SPACE.s40 }}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setMemberSubView('list')} style={styles.backBtn}>
            <ArrowLeft size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Member Profile</Text>
        </View>

        <View style={[styles.card, { alignItems: 'center' }]}>
          <View style={styles.profileImgWrap}>
            <Image
              source={{ uri: selectedMember.image || `https://picsum.photos/seed/${selectedMember.userId}/200/200` }}
              style={styles.profileImg}
            />
            {!!selectedMember.isSecurityMember && (
              <View style={styles.memberSecurityBadge}>
                <Shield size={8} color={THEME_COLORS.white} />
              </View>
            )}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: SPACE.xxl }]}>{selectedMember.name}</Text>
          <Text style={styles.memberSub}>{selectedMember.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: PRIMARY }]}>
              <Text style={[styles.roleBadgeText, { color: THEME_COLORS.white }]}>{selectedMember.role}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: THEME_COLORS.neutralBgSoft }]}>
              <Text style={[styles.roleBadgeText, { color: THEME_COLORS.neutralTextSubtle }]}>{selectedMember.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>AUTHORITY CONTROLS</Text>
          {currentCommunity?.userRole === 'ADMIN' &&
            selectedMember.userId !== currentUserProfile?.id &&
            selectedMember.role !== 'ADMIN' && (
              <TouchableOpacity
                style={[styles.controlBtn, { backgroundColor: selectedMember.role === 'MODERATOR' ? THEME_COLORS.brandPurpleSurface : THEME_COLORS.neutralBg }]}
                onPress={() =>
                  setPendingRoleChange({
                    userId: selectedMember.userId,
                    userName: selectedMember.name || 'Member',
                    currentRole: selectedMember.role,
                    nextRole: selectedMember.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR',
                  })
                }
              >
                <ShieldAlert size={16} color={selectedMember.role === 'MODERATOR' ? SECONDARY : THEME_COLORS.neutralTextSubtle} />
                <Text style={[styles.controlBtnText, { color: selectedMember.role === 'MODERATOR' ? SECONDARY : THEME_COLORS.neutralTextSubtle }]}>
                  {selectedMember.role === 'MODERATOR' ? 'Remove Moderator Privileges' : 'Promote to Moderator'}
                </Text>
              </TouchableOpacity>
            )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>PROFILE INFORMATION</Text>
          {isLoadingMemberInsights ? (
            <View style={styles.inlineLoader}>
              <Loader2 size={16} color={THEME_COLORS.neutralTextSubtle} />
              <Text style={styles.memberSub}>Loading profile insights...</Text>
            </View>
          ) : (
            <View style={{ gap: SPACE.lg }}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{selectedMemberProfile?.email || selectedMember.email || 'Not provided'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{selectedMemberProfile?.phone || selectedMemberProfile?.mobileNumber || 'Not provided'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{selectedMemberProfile?.address || 'Not provided'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Joined</Text><Text style={styles.infoValue}>{joinedDate}</Text></View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>RECENT LISTINGS AND NOTICES</Text>
            <Text style={styles.memberSub}>Latest {memberListings.length}</Text>
          </View>
          {memberListings.length === 0 ? (
            <Text style={styles.emptyStateText}>No recent posts from this member.</Text>
          ) : (
            memberListings.map((item: any) => (
              <View key={item.id} style={styles.activityRow}>
                <View style={[styles.activityBadge, { backgroundColor: item.type === 'listing' ? THEME_COLORS.warningSurfaceAlt : THEME_COLORS.infoSurface }]}>
                  <Text style={[styles.activityBadgeText, { color: item.type === 'listing' ? THEME_COLORS.warningText : THEME_COLORS.info }]}>{item.type === 'listing' ? 'LISTING' : 'NOTICE'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.memberSub}>{formatTimestamp(item.timestamp)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>CHARITY SUGGESTIONS</Text>
            <Text style={styles.memberSub}>Latest {memberSuggestions.length}</Text>
          </View>
          {memberSuggestions.length === 0 ? (
            <Text style={styles.emptyStateText}>No charity suggestions from this member.</Text>
          ) : (
            memberSuggestions.map((item: any) => (
              <View key={item.id} style={styles.activityRow}>
                <View style={[styles.activityBadge, { backgroundColor: THEME_COLORS.brandPurpleLight }]}>
                  <Text style={[styles.activityBadgeText, { color: THEME_COLORS.brandPurpleText }]}>{item.status?.toUpperCase() || 'PENDING'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.memberSub}>{formatTimestamp(item.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ENGAGEMENT INSIGHTS</Text>
          <View style={styles.insightGrid}>
            <View style={styles.insightItem}><Text style={styles.insightValue}>{insights.totalListings || 0}</Text><Text style={styles.insightLabel}>Total Listings</Text></View>
            <View style={styles.insightItem}><Text style={styles.insightValue}>{insights.totalNotices || 0}</Text><Text style={styles.insightLabel}>Total Notices</Text></View>
            <View style={styles.insightItem}><Text style={styles.insightValue}>{insights.totalSuggestions || 0}</Text><Text style={styles.insightLabel}>Suggestions</Text></View>
            <View style={styles.insightItem}><Text style={styles.insightValue}>{insights.activeListings || 0}</Text><Text style={styles.insightLabel}>Active Listings</Text></View>
          </View>
          {!!selectedMemberStats?.computedAt && (
            <Text style={styles.memberSub}>Snapshot updated: {formatTimestamp(selectedMemberStats.computedAt)}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ROLE CHANGE HISTORY</Text>
          {selectedMemberRoleHistory.length === 0 ? (
            <Text style={styles.emptyStateText}>No role changes logged yet.</Text>
          ) : (
            selectedMemberRoleHistory.map((log) => (
              <View key={log.id} style={styles.activityRow}>
                <View style={[styles.activityBadge, { backgroundColor: THEME_COLORS.infoSurfaceAlt }]}>
                  <Text style={[styles.activityBadgeText, { color: THEME_COLORS.infoText }]}>{log.action.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberSub}>{log.reason || 'Role update recorded'}</Text>
                  <Text style={styles.memberSub}>By {log.moderator_id?.slice(0, 8) || 'system'}... • {formatTimestamp(log.timestamp)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {selectedMember.userId !== currentUserProfile?.id && selectedMember.role !== 'ADMIN' && (
          <View style={[styles.card, { borderColor: THEME_COLORS.errorSurface, backgroundColor: THEME_COLORS.errorSurfaceStrong }]}>
            <View style={styles.dangerHeader}>
              <UserMinus size={20} color={ERROR} />
              <Text style={[styles.cardLabel, { color: ERROR, marginBottom: SPACE.zero }]}>REMOVE MEMBER</Text>
            </View>
            <Text style={styles.memberSub}>Revoke access to this community or permanently delete the member.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: THEME_COLORS.errorSurface }]}
                onPress={() => setPendingRemoveMember({ id: selectedMember.userId, name: selectedMember.name || 'Member' })}
              >
                <Text style={[styles.dangerBtnText, { color: ERROR }]}>Deactivate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: ERROR }]}
                onPress={() => setPendingDeleteMember({ id: selectedMember.userId, name: selectedMember.name || 'Member' })}
              >
                <Text style={[styles.dangerBtnText, { color: THEME_COLORS.white }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      );
    };

    const renderContentTab = () => {
      const allPosts = Array.isArray(posts) ? posts : [];
      const isDeleted = (p: any) => String(p?.status || '').toUpperCase() === 'DELETED';
      const isSold = (p: any) => String(p?.status || '').toUpperCase() === 'SOLD';
      const isPinned = (p: any) => String(p?.status || '').toUpperCase() === 'PINNED';
      const getPinnedNoticeChipColors = (post: any) => {
        const subtype = String(post?.postSubtype || '').toLowerCase();
        const urgencyLevel = String(post?.urgencyLevel || '').toLowerCase();
        const urgency = String(post?.urgency || '').toLowerCase();

        const isInfo = subtype === 'information' || urgencyLevel === 'info' || urgency === 'low';
        if (isInfo) {
          return {
            bg: THEME_COLORS.aliasHex_dbeafe,
            fg: THEME_COLORS.aliasHex_1e40af,
          };
        }

        const isGeneral = subtype === 'normal' || urgencyLevel === 'general' || urgency === 'normal';
        if (isGeneral) {
          return {
            bg: THEME_COLORS.aliasHex_d1fae5,
            fg: THEME_COLORS.aliasHex_065f46,
          };
        }

        return {
          bg: THEME_COLORS.warningSurfaceAlt,
          fg: THEME_COLORS.aliasHex_92400e,
        };
      };
      const activePosts = allPosts.filter((p: any) => !isDeleted(p));
      const featuredPosts = activePosts.filter((p: any) => isPinned(p));

      const filteredItems = (() => {
        switch (contentFilter) {
          case 'featured': return featuredPosts;
          case 'notices': return activePosts.filter((p: any) => p.type === 'notice');
          case 'listings': return activePosts.filter((p: any) => p.type === 'listing');
          default: return activePosts;
        }
      })();

      const listingsAll = activePosts.filter((p: any) => p.type === 'listing');
      const listingsSold = listingsAll.filter(isSold).length;

      const filterTabs = [
        { key: 'featured' as const, label: 'Featured', count: featuredPosts.length },
        { key: 'notices' as const, label: 'Notices', count: activePosts.filter((p: any) => p.type === 'notice').length },
        { key: 'listings' as const, label: 'Listings', count: listingsAll.length, sublabel: listingsSold > 0 ? `${listingsSold} sold` : undefined },
      ];

      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.xxl, paddingBottom: SPACE.s40 }}>
          <Text style={styles.sectionTitle}>Content & Notice Control</Text>

          {/* Filter tabs */}
          <View style={styles.contentFilterRow}>
            {filterTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, styles.contentFilterTab, contentFilter === tab.key && styles.filterTabActive]}
                onPress={() => setContentFilter(tab.key)}
              >
                <Text
                  style={[styles.contentFilterLabel, contentFilter === tab.key && styles.contentFilterLabelActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                <Text style={[styles.contentFilterCount, contentFilter === tab.key && styles.contentFilterCountActive]}>
                  {tab.count}
                </Text>
                {('sublabel' in tab) && tab.sublabel ? (
                  <Text style={[styles.contentFilterSub, contentFilter === tab.key && styles.contentFilterSubActive]} numberOfLines={1}>
                    {tab.sublabel}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {
            (
            filteredItems.map((notice: any, index: number) => {
              const rawStatus = String(notice?.status || '').toUpperCase();
              const isListing = notice?.type === 'listing';
              const isPinnedRow = rawStatus === 'PINNED';
              const pinnedNoticeChip = getPinnedNoticeChipColors(notice);
              const isPending = notice?.status === 'PendingPublic';
              const isSoldRow = rawStatus === 'SOLD';
              const initialQty = Math.max(1, Number(notice?.initialQuantity ?? 1) || 1);
              const soldQty = Math.max(0, Number(notice?.soldQuantity ?? 0) || 0);
              const remainingQty = Math.max(
                0,
                Number(notice?.remainingQuantity ?? (initialQty - soldQty)) || 0,
              );
              const qtyUnit = (typeof notice?.quantityType === 'string' && notice.quantityType.trim().length > 0)
                ? notice.quantityType.trim()
                : 'items';
              const priceValue = Number(notice?.communityPrice ?? notice?.publicPrice ?? notice?.price ?? 0);
              const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
              const priceLabel = hasPrice ? `R${priceValue.toLocaleString()}` : null;
              const statusLabel = isPending ? 'Pending'
                : isSoldRow ? 'Sold out'
                : rawStatus === 'PINNED' ? 'Featured'
                : isListing ? 'Active'
                : (notice?.urgencyLevel || notice?.urgency || 'Notice');
              const statusBg = isPending ? THEME_COLORS.warningSurface
                : isSoldRow ? THEME_COLORS.neutralBorderSoft
                : isListing ? THEME_COLORS.successSurface
                : THEME_COLORS.infoSurfaceSoft;
              const statusFg = isPending ? THEME_COLORS.warningText
                : isSoldRow ? THEME_COLORS.neutralTextStrong
                : isListing ? THEME_COLORS.primaryContainer
                : THEME_COLORS.brandBlueText;

              return (
              <View key={notice?.id || `content-${index}`} style={styles.contentItem}>
                <View style={[styles.contentIcon, {
                  backgroundColor: isPending ? THEME_COLORS.warningSurface
                    : isListing ? THEME_COLORS.brandPurpleSurface : THEME_COLORS.successSurface
                }]}>
                  {isPending ? (
                    <Globe size={18} color={THEME_COLORS.warningText} />
                  ) : isListing ? (
                    <Tag size={18} color={SECONDARY} />
                  ) : (
                    <AlertTriangle size={18} color={PRIMARY} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contentTitle} numberOfLines={1}>{notice?.title || 'Untitled'}</Text>
                  <Text style={styles.contentSub} numberOfLines={1}>
                    {notice?.authorName || 'Unknown'} • {notice?.type || 'notice'}{notice?.urgencyLevel ? ` • ${notice.urgencyLevel}` : ''}
                  </Text>
                  {isListing ? (
                    <View style={styles.contentMetaRow}>
                      <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusChipText, { color: statusFg }]}>{statusLabel}</Text>
                      </View>
                      {priceLabel ? (
                        <Text style={styles.contentMetaText}>{priceLabel}</Text>
                      ) : null}
                      <Text style={styles.contentMetaText}>
                        {`${soldQty}/${initialQty} ${qtyUnit} sold`}
                      </Text>
                      <Text style={styles.contentMetaText}>
                        {`${remainingQty} left`}
                      </Text>
                    </View>
                  ) : isPinnedRow ? (
                    <View style={styles.contentMetaRow}>
                      <View style={[styles.statusChip, { backgroundColor: pinnedNoticeChip.bg }]}> 
                        <Text style={[styles.statusChipText, { color: pinnedNoticeChip.fg }]}>Featured</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
                <View style={styles.contentActions}>
                  {isPending ? (
                    <>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleApprovePublicListing(notice)}>
                        <CheckCircle2 size={18} color={THEME_COLORS.secondaryContainer} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleRejectPublicListing(notice)}>
                        <XCircle size={18} color={ERROR} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleTogglePin(notice)}
                      >
                          <Bookmark size={18} color={isPinned(notice) ? PRIMARY : THEME_COLORS.neutralTextMuted} />
                      </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => {
                            if (!notice?.id) {
                              Alert.alert('Delete failed', 'This post is missing an ID and cannot be deleted.');
                              return;
                            }
                            setPendingDeletePost({ id: notice.id, title: notice?.title || 'Untitled' });
                          }}
                        >
                        <Trash2 size={16} color={ERROR} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
              );
            })
          )}

          {filteredItems.length === 0 && (
            <View style={styles.emptyState}>
              <FileText size={32} color={THEME_COLORS.neutralBorderStrong} />
              <Text style={styles.emptyStateText}>No content to display</Text>
            </View>
          )}
        </ScrollView>
      );
    };

    const renderBusinesses = () => {
      if (showImportTool) {
        return <BusinessImportTool onBack={() => setShowImportTool(false)} />;
      }

      const businesses = (() => {
        const fromBundle = Array.isArray(communityBusinesses) ? communityBusinesses : [];
        const fromCommunity = Array.isArray(currentCommunity?.businesses) ? currentCommunity.businesses : [];
        const merged = [...fromBundle, ...fromCommunity];
        const seen = new Set<string>();
        return merged.filter((biz: any) => {
          const id = String(biz?.id || '');
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      })();

      const userCommunityBizs = businesses.filter((b: any) => b.source !== 'IMPORT');
      const importedBizs = businesses.filter((b: any) => b.source === 'IMPORT');
      const activeBizs = bizFilter === 'user' ? userCommunityBizs : importedBizs;

      const renderBizCard = (biz: any, idx: number) => (
        <View key={biz.id || idx} style={styles.bizCard}>
          {(() => {
            const businessImage = resolveMediaUrl(biz.imageUrl || biz.image || '/defaults/business-placeholder.png')
              || '/defaults/business-placeholder.png';
            return (
          <Image
            source={{ uri: businessImage }}
            style={styles.bizImg}
          />
            );
          })()}
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName}>{biz.name}</Text>
            <Text style={styles.bizCategory}>{biz.category}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm }}>
              <View
                style={{
                  backgroundColor:
                    String(biz?.status || '').toUpperCase() === 'PINNED'
                      ? THEME_COLORS.warningSurface
                      : THEME_COLORS.successSurfaceStrong,
                  paddingHorizontal: SPACE.md,
                  paddingVertical: SPACE.xxs,
                  borderRadius: RADIUS.chip,
                }}
              >
                <Text
                  style={{
                    fontSize: TYPE_SCALE.sm,
                    color:
                      String(biz?.status || '').toUpperCase() === 'PINNED'
                        ? THEME_COLORS.warningText
                        : THEME_COLORS.successStrong,
                    fontWeight: FONT_WEIGHT.bold,
                  }}
                >
                  {String(biz?.status || '').toUpperCase() === 'PINNED' ? 'Pinned' : 'Live in Marketplace'}
                </Text>
              </View>
              <View style={{ backgroundColor: biz.source === 'IMPORT' ? THEME_COLORS.brandPurpleSurface : THEME_COLORS.infoSurfaceSoft, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs, borderRadius: RADIUS.chip }}>
                <Text style={{ fontSize: TYPE_SCALE.sm, color: biz.source === 'IMPORT' ? THEME_COLORS.brandPurple : THEME_COLORS.brandBlueText, fontWeight: FONT_WEIGHT.bold }}>
                  {biz.source === 'IMPORT' ? 'AI Imported' : 'User Business'}
                </Text>
              </View>
            </View>
            {biz.description ? (
              <Text style={styles.memberSub} numberOfLines={2}>{biz.description}</Text>
            ) : null}
            {biz.source === 'IMPORT' ? (
              <TouchableOpacity
                style={{ marginTop: SPACE.sm, alignSelf: 'flex-start' }}
                onPress={() => handleReloadBusinessImage(biz)}
                disabled={reloadingBusinessId === biz.id}
              >
                <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.brandBlueText }}>
                  {reloadingBusinessId === biz.id ? 'Reloading image...' : 'Delete and Reload Business Image'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.bizActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleBusinessPin(biz)}>
              <Bookmark
                size={18}
                color={String(biz?.status || '').toUpperCase() === 'PINNED' ? PRIMARY : THEME_COLORS.neutralTextMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => setPendingRemoveBusiness(biz)}
            >
              <Trash2 size={14} color={ERROR} />
            </TouchableOpacity>
          </View>
        </View>
      );

      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.s16, paddingBottom: SPACE.s40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Business Management</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: THEME_COLORS.primary, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.round }}
              onPress={() => setShowImportTool(true)}
              activeOpacity={0.8}
            >
              <Sparkles size={14} color={THEME_COLORS.white} />
              <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold }}>AI Import</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bizFilterRow}>
            <TouchableOpacity
              style={[styles.filterTab, styles.bizFilterTab, bizFilter === 'user' && styles.filterTabActive]}
              onPress={() => setBizFilter('user')}
            >
              <Text
                style={[styles.bizFilterLabel, bizFilter === 'user' && styles.bizFilterLabelActive]}
                numberOfLines={1}
              >
                User
              </Text>
              <Text style={[styles.bizFilterCount, bizFilter === 'user' && styles.bizFilterCountActive]}>
                {userCommunityBizs.length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, styles.bizFilterTab, bizFilter === 'ai' && styles.filterTabActive]}
              onPress={() => setBizFilter('ai')}
            >
              <Text
                style={[styles.bizFilterLabel, bizFilter === 'ai' && styles.bizFilterLabelActive]}
                numberOfLines={1}
              >
                Imported
              </Text>
              <Text style={[styles.bizFilterCount, bizFilter === 'ai' && styles.bizFilterCountActive]}>
                {importedBizs.length}
              </Text>
            </TouchableOpacity>
          </View>

          {activeBizs.length > 0
            ? activeBizs.map((biz, idx) => renderBizCard(biz, idx))
            : (
              <View style={styles.emptyState}>
                <Store size={32} color={THEME_COLORS.neutralBorderStrong} />
                <Text style={styles.emptyStateText}>
                  {bizFilter === 'user' ? 'No user businesses yet' : 'No imported businesses yet'}
                </Text>
              </View>
            )
          }
        </ScrollView>
      );
    };

    const renderCategories = () => {
      const enabledCategories = currentCommunity?.enabledCategories || BUSINESS_CATEGORIES.map((c) => c.id);
      const toggleCategory = async (id: string) => {
        if (!currentCommunity?.id) return;
        const newCats = enabledCategories.includes(id)
          ? enabledCategories.filter((c: string) => c !== id)
          : [...enabledCategories, id];
        await updateCommunityCategories(currentCommunity.id, newCats);
      };

      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.xxl, paddingBottom: SPACE.s40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category Management</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACE.lg }}>
            <TouchableOpacity
              style={[styles.filterTab, styles.filterTabActive]}
              onPress={() => currentCommunity?.id && updateCommunityCategories(currentCommunity.id, BUSINESS_CATEGORIES.map((c) => c.id))}
            >
              <Text style={styles.filterTabTextActive}>Enable All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterTab}
              onPress={() => currentCommunity?.id && updateCommunityCategories(currentCommunity.id, [])}
            >
              <Text style={styles.filterTabText}>Disable All</Text>
            </TouchableOpacity>
          </View>
          {BUSINESS_CATEGORIES.map((cat) => {
            const enabled = enabledCategories.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryItem, enabled && styles.categoryItemActive]}
                onPress={() => toggleCategory(cat.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIcon, { backgroundColor: enabled ? THEME_COLORS.white : THEME_COLORS.neutralBg }]}>
                  <Text style={{ fontSize: TYPE_SCALE.display }}>{cat.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryName, enabled && { color: PRIMARY }]}>{cat.label}</Text>
                  <Text style={styles.categoryTypes}>{cat.types.length} types</Text>
                </View>
                <View style={[styles.checkCircle, enabled && styles.checkCircleActive]}>
                  {enabled && <CheckCircle2 size={16} color={THEME_COLORS.white} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    };

    const renderRules = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.s16, paddingBottom: SPACE.s40 }}>
        <Text style={styles.sectionTitle}>Governance & Rules</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>POSTING LIMITS</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleText}>Max posts per user / day</Text>
            <TextInput style={styles.ruleInput} defaultValue="3" keyboardType="numeric" />
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleText}>Max listings per week</Text>
            <TextInput style={styles.ruleInput} defaultValue="5" keyboardType="numeric" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ACCESS CONTROL</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleText}>Allow unverified users to post</Text>
            <View style={[styles.toggle, { backgroundColor: THEME_COLORS.neutralBorder }]}>
              <View style={[styles.toggleThumb, { left: SPACE.xxs }]} />
            </View>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleText}>Require business verification</Text>
            <View style={[styles.toggle, { backgroundColor: THEME_COLORS.secondaryContainer }]}>
              <View style={[styles.toggleThumb, { right: SPACE.xxs }]} />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: THEME_COLORS.successSurface, borderColor: THEME_COLORS.tertiaryFixed }]}>
          <View style={{ flexDirection: 'row', gap: SPACE.xxl, alignItems: 'flex-start' }}>
            <View style={[styles.categoryIcon, { backgroundColor: PRIMARY }]}>
              <AlertTriangle size={20} color={THEME_COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: PRIMARY }]}>AUTO-MODERATION (AI LAYER)</Text>
              <Text style={styles.memberSub}>
                Configure automated filters for spam, hate speech, and misinformation.
              </Text>
              <TouchableOpacity style={[styles.actionBtn, { marginTop: SPACE.xxl, alignSelf: 'flex-start' }]}>
                <Text style={styles.actionBtnText}>Configure AI Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    );

    const renderLogs = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: SPACE.xxl, paddingBottom: SPACE.s40 }}>
        <Text style={styles.sectionTitle}>Management</Text>

        <View style={styles.logItem}>
          <View style={[styles.logIcon, { backgroundColor: THEME_COLORS.primaryTintSoft }]}> 
            <Sparkles size={16} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logAction}>Community Theme Management</Text>
            <Text style={styles.logMeta}>
              Source: {themeSource === 'community' ? 'Community theme' : 'Fallback default'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxl }]}
            onPress={refreshTheme}
            activeOpacity={0.8}
            disabled={isThemeLoading}
          >
            {isThemeLoading ? <Loader2 size={14} color={THEME_COLORS.white} /> : <RefreshCw size={14} color={THEME_COLORS.white} />}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Theme Name</Text>
          <View style={styles.themeNameSelectorRow}>
            <TouchableOpacity
              style={[styles.input, styles.themeNameSelectorBtn]}
              onPress={() => setShowThemeNameMenu(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.themeNameInput}>
                {normalizeThemeNameValue(themeDraft.name)}
              </Text>
              <ChevronDown size={16} color={THEME_COLORS.neutralTextSubtle} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.themeNameAddBtn}
              onPress={() => setShowCreateThemeNameModal(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            {renderThemeColorField('Primary', 'primaryColor')}
            {renderThemeColorField('Secondary', 'secondaryColor')}
          </View>

          <View style={styles.fieldRow}>
            {renderThemeColorField('Background', 'backgroundColor')}
            {renderThemeColorField('Surface', 'surfaceColor')}
          </View>

          <View style={styles.fieldRow}>
            {renderThemeColorField('Text Primary', 'textPrimary')}
            {renderThemeColorField('Text Secondary', 'textSecondary')}
          </View>

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Border Radius</Text>
              <TextInput style={styles.input} value={themeDraft.borderRadius} onChangeText={(v) => handleThemeDraftChange('borderRadius', v)} placeholder="16px" placeholderTextColor={THEME_COLORS.neutralTextMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Font Family</Text>
              <TextInput style={styles.input} value={themeDraft.fontFamily} onChangeText={(v) => handleThemeDraftChange('fontFamily', v)} placeholder="System" placeholderTextColor={THEME_COLORS.neutralTextMuted} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Icon URL (optional)</Text>
          <TextInput
            style={styles.input}
            value={themeDraft.iconUrl}
            onChangeText={(v) => handleThemeDraftChange('iconUrl', v)}
            autoCapitalize="none"
            placeholder="https://..."
            placeholderTextColor={THEME_COLORS.neutralTextMuted}
          />

          {themeSaveStatus && (
            <Text style={{ color: themeSaveStatus.type === 'success' ? THEME_COLORS.successText : ERROR, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.semibold }}>
              {themeSaveStatus.message}
            </Text>
          )}

          <Text style={styles.themeApplyHint}>
            Theme changes apply immediately in this app for this community. Other members may need to refresh to fetch the latest community theme.
          </Text>

          <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.lg }}>
            <TouchableOpacity
              style={[styles.secondaryActionBtn, { flex: 1 }]}
              onPress={handleResetThemeToBaseline}
              disabled={isSavingTheme}
            >
              <RefreshCw size={16} color={PRIMARY} />
              <Text style={styles.secondaryActionBtnText}>Reset Baseline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleSaveTheme} disabled={isSavingTheme}>
              {isSavingTheme ? <Loader2 size={16} color={THEME_COLORS.white} /> : <Save size={16} color={THEME_COLORS.white} />}
              <Text style={styles.actionBtnText}>{isSavingTheme ? 'Saving...' : 'Save Theme'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { fontSize: TYPE_SCALE.h1, marginTop: SPACE.lg }]}>Moderation Activity</Text>
        {logs.length > 0 ? logs.map((log) => {
          const actionColors: Record<string, string> = {
            approve: THEME_COLORS.secondaryContainer, reject: ERROR, delete: ERROR, warn: THEME_COLORS.warningStrong, ban: ERROR,
          };
          const color = actionColors[log.action] || THEME_COLORS.neutralTextMuted;
          return (
            <View key={log.id} style={styles.logItem}>
              <View style={[styles.logIcon, { backgroundColor: color + '20' }]}>
                <History size={16} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logAction}>
                  <Text style={{ textTransform: 'capitalize' }}>{log.action}</Text> on {log.target_type}
                </Text>
                <Text style={styles.logMeta}>
                  Mod: {log.moderator_id?.slice(0, 8)}... • Target: {log.target_id?.slice(0, 8)}...
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Clock size={10} color={THEME_COLORS.neutralTextMuted} />
                <Text style={styles.timeText}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                </Text>
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <History size={32} color={THEME_COLORS.neutralBorderStrong} />
            <Text style={styles.emptyStateText}>No moderation activity yet</Text>
          </View>
        )}

        <Modal visible={showThemeNameMenu} transparent animationType="fade" onRequestClose={() => setShowThemeNameMenu(false)}>
          <View style={styles.colorPickerOverlay}>
            <View style={styles.colorPickerCard}>
              <Text style={styles.fieldLabel}>Select Theme Name</Text>
              <View style={styles.themeNameMenuList}>
                {themeNameOptions.map((name) => {
                  const normalizedOption = normalizeThemeNameValue(name);
                  const selected = normalizeThemeNameValue(themeDraft.name).toLowerCase() === normalizedOption.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.themeNameMenuItem, selected && styles.themeNameMenuItemSelected]}
                      onPress={() => {
                        handleThemeDraftChange('name', normalizedOption);
                        setShowThemeNameMenu(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.themeNameMenuText, selected && styles.themeNameMenuTextSelected]}>
                        {normalizedOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => setShowThemeNameMenu(false)}>
                <X size={14} color={PRIMARY} />
                <Text style={styles.secondaryActionBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showCreateThemeNameModal} transparent animationType="fade" onRequestClose={() => setShowCreateThemeNameModal(false)}>
          <View style={styles.colorPickerOverlay}>
            <View style={styles.colorPickerCard}>
              <Text style={styles.fieldLabel}>Create New Theme Name</Text>
              <TextInput
                style={styles.input}
                value={newThemeName}
                onChangeText={setNewThemeName}
                placeholder="e.g. Sunset Garden"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
              />
              <View style={{ flexDirection: 'row', gap: SPACE.lg }}>
                <TouchableOpacity style={[styles.secondaryActionBtn, { flex: 1 }]} onPress={() => setShowCreateThemeNameModal(false)}>
                  <X size={14} color={PRIMARY} />
                  <Text style={styles.secondaryActionBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleCreateThemeName}>
                  <Plus size={14} color={THEME_COLORS.white} />
                  <Text style={styles.actionBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showColorPicker} transparent animationType="fade" onRequestClose={() => setShowColorPicker(false)}>
          <View style={styles.colorPickerOverlay}>
            <View style={styles.colorPickerCard}>
              <Text style={styles.fieldLabel}>Choose Color</Text>
              <TextInput
                style={styles.input}
                value={pickerColorValue}
                onChangeText={setPickerColorValue}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.colorPresetGrid}>
                {VALID_COLOR_SWATCH_PRESETS.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => setPickerColorValue(typeof hex === 'string' ? hex : THEME_COLORS.black)}
                    style={[styles.colorPresetSwatch, { backgroundColor: hex }]}
                    activeOpacity={0.85}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.lg }}>
                <TouchableOpacity style={[styles.secondaryActionBtn, { flex: 1 }]} onPress={() => setShowColorPicker(false)}>
                  <X size={14} color={PRIMARY} />
                  <Text style={styles.secondaryActionBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={applyPickerColor}>
                  <CheckCircle2 size={14} color={THEME_COLORS.white} />
                  <Text style={styles.actionBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );

    const renderActiveTab = () => {
      switch (activeTab) {
        case 'coverage': return renderCoverage();
        case 'charity': return renderCharityModeration();
        case 'members': return renderMembers();
        case 'content': return renderContentTab();
        case 'businesses': return renderBusinesses();
        case 'categories': return renderCategories();
        case 'rules': return renderRules();
        case 'logs': return renderLogs();
        default: return renderMembers();
      }
    };

    return (
      <View style={styles.container}>
        {!embedded && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Moderation Center</Text>
          </View>
        )}

        {renderTabBar()}
        {renderActiveTab()}

        {/* Confirmation modals */}
        <PostConfirmationModal
          isOpen={!!pendingRoleChange}
          ctaLabel={pendingRoleChange?.nextRole === 'MODERATOR' ? 'Promote Member' : 'Demote Moderator'}
          postType="Member"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingRoleChange?.userName || ''}
          themeColor="bg-warning"
          customTitle="Confirm Role Change"
          customMessage={pendingRoleChange?.nextRole === 'MODERATOR'
            ? 'This member will gain moderator privileges in this community.'
            : 'This moderator will be moved back to member privileges.'}
          cancelLabel="Cancel"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Confirm'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmRoleChange}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingRoleChange(null); }}
        />
        <PostConfirmationModal
          isOpen={!!pendingRemoveMember}
          ctaLabel="Deactivate Member"
          postType="Member"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingRemoveMember?.name || ''}
          themeColor="bg-error"
          customTitle="Confirm Member Deactivation"
          customMessage="This member will lose access to this community immediately."
          cancelLabel="Cancel"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Deactivate'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmRemoveMember}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingRemoveMember(null); }}
        />
        <PostConfirmationModal
          isOpen={!!pendingDeleteMember}
          ctaLabel="Delete Member"
          postType="Member"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingDeleteMember?.name || ''}
          themeColor="bg-error"
          customTitle="Confirm Permanent Member Deletion"
          customMessage="This action cannot be undone and permanently removes this member."
          cancelLabel="Cancel"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Delete'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmDeleteMember}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingDeleteMember(null); }}
        />
        <PostConfirmationModal
          isOpen={!!pendingDeletePost}
          ctaLabel="Delete Post"
          postType="Post"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingDeletePost?.title || ''}
          themeColor="bg-error"
          customTitle="Confirm Post Deletion"
          customMessage="This post will be removed from the community feed."
          cancelLabel="Cancel"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Delete'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmDeletePost}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingDeletePost(null); }}
        />
        <PostConfirmationModal
          isOpen={!!pendingRemoveBusiness}
          ctaLabel="Remove Business"
          postType="Business"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingRemoveBusiness?.name || ''}
          themeColor="bg-error"
          customTitle="Confirm Business Removal"
          customMessage="This business will be removed from the community directory."
          cancelLabel="Cancel"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Remove'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmRemoveBusiness}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingRemoveBusiness(null); }}
        />
        <PostConfirmationModal
          isOpen={!!pendingCancelInvitation}
          ctaLabel="Cancel Invitation"
          postType="Invitation"
          communityName={currentCommunity?.name || 'Your Community'}
          title={pendingCancelInvitation?.label || ''}
          themeColor="bg-error"
          customTitle="Confirm Invitation Cancellation"
          customMessage="This pending invitation will be cancelled."
          cancelLabel="Keep Invitation"
          confirmLabel={isProcessingDestructiveAction ? 'Processing...' : 'Cancel Invitation'}
          confirmDisabled={isProcessingDestructiveAction}
          onConfirm={handleConfirmCancelInvitation}
          onCancel={() => { if (!isProcessingDestructiveAction) setPendingCancelInvitation(null); }}
        />
      </View>
    );
  }
);

export default ModerationCenter;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_SHELL_COLORS.body },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxl,
    paddingHorizontal: SPACE.s16,
    paddingVertical: SPACE.xxxl,
    backgroundColor: APP_SHELL_COLORS.chrome,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBgSoft,
  },
  headerTitle: { fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  backBtn: { padding: SPACE.md },
  tabBar: { backgroundColor: APP_SHELL_COLORS.body, flexGrow: 0 },
  tabBarContent: {
    paddingHorizontal: SPACE.s16,
    paddingTop: SPACE.s16,
    paddingBottom: SPACE.xl,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.card,
    backgroundColor: getCardSurfaceColor('default'),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
  },
  tabBtnActive: { backgroundColor: PRIMARY },
  tabBtnText: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSubtle },
  tabBtnTextActive: { color: THEME_COLORS.white },
  tabContent: { flex: 1, paddingHorizontal: SPACE.s16, paddingTop: SPACE.xl },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xxl },
  sectionTitle: { fontSize: TYPE_SCALE.display, fontWeight: FONT_WEIGHT.black, color: PRIMARY, flex: 1, lineHeight: 30 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: PRIMARY,
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  saveBtnText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: PRIMARY,
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  actionBtnText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    backgroundColor: getCardSurfaceColor('default'),
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  secondaryActionBtnText: {
    color: PRIMARY,
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },

  fieldGroup: { gap: SPACE.md },
  fieldLabel: {
    fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase', letterSpacing: LETTER_SPACING.widest,
  },
  fieldRow: { flexDirection: 'row', gap: SPACE.xxl },
  input: {
    backgroundColor: THEME_COLORS.neutralBg,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.xl,
    fontSize: TYPE_SCALE.xxl,
    color: THEME_COLORS.neutralTextStrong,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radiusValue: { fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  radiusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  radiusBtn: {
    paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.pill,
    backgroundColor: THEME_COLORS.neutralBg, borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
  },
  radiusBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  radiusBtnText: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSubtle },
  radiusBtnTextActive: { color: THEME_COLORS.white },
  mapContainer: { borderRadius: RADIUS.round, overflow: 'hidden', height: 280, borderWidth: 1, borderColor: THEME_COLORS.neutralBorder },
  map: { width: '100%', height: '100%' },
  infoBanner: {
    flexDirection: 'row', backgroundColor: THEME_COLORS.successSurface,
    borderRadius: RADIUS.round, padding: SPACE.s16, borderWidth: 1, borderColor: THEME_COLORS.tertiaryFixed, alignItems: 'center', justifyContent: 'space-between',
  },
  infoBannerTitle: { fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  infoBannerDesc: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextDefault, lineHeight: LINE_HEIGHT.compact, flex: 1 },

  card: {
    backgroundColor: getCardSurfaceColor('muted'), borderRadius: RADIUS.card, padding: SPACE.s16, gap: SPACE.xxl,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
  },
  cardLabel: {
    fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase', letterSpacing: LETTER_SPACING.hero, marginBottom: SPACE.sm,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xl,
    paddingVertical: SPACE.lg, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.neutralBg,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: RADIUS.round, backgroundColor: THEME_COLORS.neutralBgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  memberImgWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.round,
    position: 'relative',
  },
  memberImg: { width: 40, height: 40, borderRadius: RADIUS.round },
  memberSecurityBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    padding: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: THEME_COLORS.surfaceContainerLow,
    backgroundColor: THEME_COLORS.brandBlueText,
  },
  memberName: { fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  memberSub: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxxs },
  memberStatusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xxs },
  statusDot: { width: 6, height: 6, borderRadius: RADIUS.sm },
  roleBadge: {
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill,
  },
  roleBadgeText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal },
  iconBtn: { padding: SPACE.md },

  searchRow: { flexDirection: 'row', gap: SPACE.lg, alignItems: 'center' },
  searchBtn: {
    backgroundColor: PRIMARY, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xl,
  },
  searchBtnText: { color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xl },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
    backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.lg, padding: SPACE.xl,
    borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
  },
  linkText: { flex: 1, fontSize: TYPE_SCALE.md, fontFamily: 'monospace', color: THEME_COLORS.neutralTextHeading },
  statusBanner: { padding: SPACE.xl, borderRadius: RADIUS.lg },
  buttonRow: { flexDirection: 'row', gap: SPACE.xl, marginTop: SPACE.sm },

  profileImgWrap: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.circle,
    marginTop: SPACE.lg,
    position: 'relative',
  },
  profileImg: { width: 80, height: 80, borderRadius: RADIUS.circle },
  badgeRow: { flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineLoader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.neutralBg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.sm,
    gap: SPACE.lg,
  },
  colorSwatchBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorder,
  },
  colorHexInput: {
    flex: 1,
    fontSize: TYPE_SCALE.xxl,
    color: THEME_COLORS.neutralTextStrong,
    paddingVertical: SPACE.sm,
  },
  colorPickerOverlay: {
    flex: 1,
    backgroundColor: THEME_COLORS.blackOverlay50,
    justifyContent: 'center',
    paddingHorizontal: SPACE.s16,
  },
  colorPickerCard: {
    backgroundColor: getCardSurfaceColor('default'),
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
    padding: SPACE.s16,
    gap: SPACE.xl,
    ...getCardShadow('hero'),
  },
  colorPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.lg,
  },
  colorPresetSwatch: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorder,
  },
  themeNameInput: {
    flex: 1,
    fontSize: TYPE_SCALE.h1,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
  },
  themeNameSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    marginTop: SPACE.sm,
  },
  themeNameSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeNameAddBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
    backgroundColor: getCardSurfaceColor('default'),
  },
  themeNameMenuList: {
    gap: SPACE.md,
  },
  themeNameMenuItem: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
    backgroundColor: getCardSurfaceColor('default'),
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.xl,
  },
  themeNameMenuItemSelected: {
    borderColor: PRIMARY,
    backgroundColor: THEME_COLORS.primaryTintSoft,
  },
  themeNameMenuText: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.neutralTextSubtle,
  },
  themeNameMenuTextSelected: {
    color: PRIMARY,
  },
  themeApplyHint: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.neutralTextSubtle,
    lineHeight: 18,
  },
  infoLabel: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal },
  infoValue: { flex: 1, textAlign: 'right', fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextStrong, fontWeight: FONT_WEIGHT.semibold },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xl,
    paddingVertical: SPACE.lg, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.neutralBg,
  },
  activityBadge: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
  activityBadgeText: { fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.black, letterSpacing: LETTER_SPACING.tight },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xl },
  insightItem: {
    width: '48%', backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.xl,
    paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl, borderWidth: 1, borderColor: THEME_COLORS.neutralBgSoft,
  },
  insightValue: { fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  insightLabel: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSubtle, textTransform: 'uppercase', marginTop: SPACE.xxs },

  controlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
    padding: SPACE.xxl, borderRadius: RADIUS.xl,
  },
  controlBtnText: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, flex: 1 },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  dangerBtn: {
    flex: 1, paddingVertical: SPACE.xl, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnText: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold },

  filterTab: {
    paddingHorizontal: SPACE.s16, paddingVertical: SPACE.xl, borderRadius: RADIUS.pill,
    backgroundColor: getCardSurfaceColor('default'),
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
  },
  filterTabActive: { backgroundColor: PRIMARY },
  filterTabText: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.medium, color: THEME_COLORS.neutralTextHeading },
  filterTabTextActive: { color: THEME_COLORS.white },
  contentFilterRow: {
    flexDirection: 'row',
    gap: SPACE.lg,
    marginBottom: SPACE.sm,
  },
  contentFilterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
    minHeight: 72,
  },
  contentFilterLabel: {
    fontSize: TYPE_SCALE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
    textAlign: 'center',
  },
  contentFilterLabelActive: {
    color: THEME_COLORS.white,
  },
  contentFilterCount: {
    marginTop: SPACE.xs,
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.neutralTextSubtle,
    textAlign: 'center',
  },
  contentFilterCountActive: {
    color: THEME_COLORS.whiteOverlay90,
  },
  bizFilterRow: {
    flexDirection: 'row',
    gap: SPACE.lg,
  },
  bizFilterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    minHeight: 56,
  },
  bizFilterLabel: {
    fontSize: TYPE_SCALE.h1,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.neutralTextHeading,
    textAlign: 'center',
  },
  bizFilterLabelActive: {
    color: THEME_COLORS.white,
  },
  bizFilterCount: {
    marginTop: SPACE.xxxs,
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.neutralTextSubtle,
    textAlign: 'center',
  },
  bizFilterCountActive: {
    color: THEME_COLORS.whiteOverlay90,
  },

  contentItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xxxl,
    backgroundColor: getCardSurfaceColor('default'), borderRadius: 28, paddingVertical: SPACE.s16, paddingHorizontal: SPACE.s16,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
  },
  contentIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  contentTitle: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  contentSub: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxs, lineHeight: LINE_HEIGHT.compact },
  contentMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs },
  contentMetaText: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle, fontWeight: FONT_WEIGHT.bold },
  contentFilterSub: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxs, fontWeight: FONT_WEIGHT.bold },
  contentFilterSubActive: { color: THEME_COLORS.white },
  contentActions: { alignItems: 'center', gap: SPACE.md },
  statusChip: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
  statusChipText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.black, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal },

  bizCard: {
    flexDirection: 'row', gap: SPACE.xxl, backgroundColor: getCardSurfaceColor('default'), borderRadius: RADIUS.round, padding: SPACE.xxxl,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...getCardShadow('soft'),
  },
  bizImg: { width: 64, height: 64, borderRadius: RADIUS.xxl },
  bizName: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  bizCategory: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextMuted, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, marginTop: SPACE.xxs },
  bizStatus: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACE.xxs },
  bizActions: { gap: SPACE.md, justifyContent: 'center' },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: THEME_COLORS.secondaryContainer, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
  },
  approveBtnText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold },
  featureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: THEME_COLORS.neutralBgSoft, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
  },
  featureBtnActive: { backgroundColor: THEME_COLORS.warningStrong },
  featureBtnText: { color: THEME_COLORS.neutralTextMuted, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold },
  removeBtn: {
    backgroundColor: THEME_COLORS.errorSurface, borderRadius: RADIUS.lg, padding: SPACE.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xxxl,
    backgroundColor: getCardSurfaceColor('muted'), borderRadius: RADIUS.round, padding: SPACE.xxxl,
    borderWidth: 2, borderColor: getCardBorderColor('default'), opacity: 0.7,
  },
  categoryItemActive: { backgroundColor: THEME_COLORS.successSurface, borderColor: PRIMARY, opacity: 1 },
  categoryIcon: { width: 48, height: 48, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontSize: TYPE_SCALE.h3, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  categoryTypes: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextMuted, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide, marginTop: SPACE.xxs },
  checkCircle: {
    width: 24, height: 24, borderRadius: RADIUS.xl, borderWidth: 2, borderColor: THEME_COLORS.neutralBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  ruleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACE.xl, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.neutralBg,
  },
  ruleText: { fontSize: TYPE_SCALE.xxl, color: THEME_COLORS.neutralTextHeading, fontWeight: FONT_WEIGHT.medium, flex: 1 },
  ruleInput: {
    width: 56, backgroundColor: getCardSurfaceColor('default'), borderRadius: RADIUS.md, textAlign: 'center',
    fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY,
    borderWidth: 1, borderColor: getCardBorderColor('default'), paddingVertical: SPACE.md,
  },
  toggle: { width: 40, height: 20, borderRadius: RADIUS.lg, position: 'relative', justifyContent: 'center' },
  toggleThumb: {
    position: 'absolute', width: SPACE.xxxl, height: SPACE.xxxl, borderRadius: RADIUS.dot, backgroundColor: THEME_COLORS.surface,
    ...createShadow(THEME_COLORS.black, 0, 1, 0.15, 2, 2),
  },

  logItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl,
    backgroundColor: getCardSurfaceColor('muted'), borderRadius: RADIUS.xxl, padding: SPACE.xxl,
    borderWidth: 1, borderColor: getCardBorderColor('default'),
    ...createShadow(THEME_COLORS.black, 0, 1, 0.03, 4, 1),
  },
  logIcon: { width: 40, height: 40, borderRadius: RADIUS.round, alignItems: 'center', justifyContent: 'center' },
  logAction: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  logMeta: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxs },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  timeText: { fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.s40, gap: SPACE.xl },
  emptyStateText: { fontSize: TYPE_SCALE.xxl, color: THEME_COLORS.neutralTextMuted, fontStyle: 'italic' },
});
