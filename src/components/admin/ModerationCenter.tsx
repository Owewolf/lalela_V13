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
} from 'lucide-react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useCommunity } from '../../context/CommunityContext';
import { BUSINESS_CATEGORIES, GOOGLE_PLACES_API_KEY, POST_SUBTYPE_CONFIG } from '../../constants';
import { PostConfirmationModal } from '../shared/PostConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { Share } from 'react-native';
import type { UserRole, UserProfile } from '../../types';
import { BusinessImportTool } from './BusinessImportTool';
import ManageCommunityCharity from '../settings/ManageCommunityCharity';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import Slider from '@react-native-community/slider';
import { defaultMapViewProps } from '../../lib/mapViewProps';

const PRIMARY = '#0d3d47';
const SECONDARY = '#7c3aed';
const ERROR = '#dc2626';
const INVITE_WEB_BASE_URL = 'https://lalela.net';

export interface ModerationCenterHandle {
  saveCurrentTab: () => Promise<void>;
}

type ModTab = 'members' | 'content' | 'businesses' | 'rules' | 'logs' | 'categories' | 'coverage' | 'charity';
type MemberSubView = 'list' | 'invite' | 'details';

type MemberInsightsSnapshot = {
  totalListings?: number;
  totalNotices?: number;
  totalSuggestions?: number;
  activeListings?: number;
  last30dListings?: number;
  last30dSuggestions?: number;
  topCategories?: string[];
  computedAt?: any;
};

type MemberRoleHistoryEntry = {
  id: string;
  action: string;
  reason?: string;
  timestamp?: any;
  moderator_id?: string;
};

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
      'all' | 'notices' | 'listings' | 'businesses' | 'public_queue'
    >('all');
    const [logs, setLogs] = useState<any[]>([]);
    const [urgencyChangePost, setUrgencyChangePost] = useState<any>(null);
    const [pendingRemoveMember, setPendingRemoveMember] = useState<{ id: string; name: string } | null>(null);
    const [pendingDeleteMember, setPendingDeleteMember] = useState<{ id: string; name: string } | null>(null);
    const [pendingDeletePost, setPendingDeletePost] = useState<{ id: string; title: string } | null>(null);
    const [pendingRemoveBusiness, setPendingRemoveBusiness] = useState<any>(null);
    const [bizFilter, setBizFilter] = useState<'user' | 'ai'>('user');
    const [pendingCancelInvitation, setPendingCancelInvitation] = useState<{ id: string; label: string } | null>(null);
    const [isProcessingDestructiveAction, setIsProcessingDestructiveAction] = useState(false);
    const [showImportTool, setShowImportTool] = useState(false);
    const [selectedMemberProfile, setSelectedMemberProfile] = useState<Partial<UserProfile> | null>(null);
    const [selectedMemberStats, setSelectedMemberStats] = useState<MemberInsightsSnapshot | null>(null);
    const [selectedMemberRoleHistory, setSelectedMemberRoleHistory] = useState<MemberRoleHistoryEntry[]>([]);
    const [isLoadingMemberInsights, setIsLoadingMemberInsights] = useState(false);
    const [pendingRoleChange, setPendingRoleChange] = useState<{
      userId: string;
      userName: string;
      currentRole: UserRole;
      nextRole: UserRole;
    } | null>(null);

    useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

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

    useEffect(() => {
      if (!currentCommunity?.id || currentCommunity.id === 'loading') return;
      api.get(`/communities/${currentCommunity.id}/moderation-logs?limit=50`)
        .then(({ data }) => setLogs(data))
        .catch(console.error);
    }, [currentCommunity?.id]);

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
          }).catch(console.error);
        }
        if (selectedMember?.userId === userId) {
          setSelectedMember({ ...selectedMember, role });
        }
      } catch (e) {
        console.error('Failed to update role:', e);
      }
    };

    useEffect(() => {
      const loadMemberInsights = async () => {
        if (!currentCommunity?.id || !selectedMember?.userId || memberSubView !== 'details') {
          return;
        }

        setIsLoadingMemberInsights(true);
        try {
          // Load member profile and stats via REST
          const [profileRes, statsRes, historyRes] = await Promise.all([
            api.get(`/users/${selectedMember.userId}/profile`).catch(() => ({ data: null })),
            api.get(`/communities/${currentCommunity.id}/members/${selectedMember.userId}/stats`).catch(() => ({ data: null })),
            api.get(`/communities/${currentCommunity.id}/moderation-logs?target_type=user&target_id=${selectedMember.userId}&limit=5`).catch(() => ({ data: [] })),
          ]);

          setSelectedMemberProfile(profileRes.data ?? null);
          setSelectedMemberStats(statsRes.data ?? null);
          setSelectedMemberRoleHistory(
            (historyRes.data ?? []).map((entry: any) => ({ id: entry.id, ...entry }))
          );
        } catch (err) {
          console.error('Failed to load member insights:', err);
          setSelectedMemberProfile(null);
          setSelectedMemberStats(null);
          setSelectedMemberRoleHistory([]);
        } finally {
          setIsLoadingMemberInsights(false);
        }
      };

      loadMemberInsights();
    }, [currentCommunity?.id, memberSubView, selectedMember?.userId]);

    const handleDeletePost = async (postId: string) => {
      try {
        const post = posts.find((p: any) => p.id === postId);
        await removePost(postId);
        if (currentCommunity?.id) {
          await api.post(`/communities/${currentCommunity.id}/moderation-logs`, {
            communityId: currentCommunity.id,
            moderator_id: currentUserProfile?.id,
            action: 'delete',
            target_id: postId,
            target_type: 'post',
          }).catch(() => {});
          if (post?.authorId && post.authorId !== currentUserProfile?.id) {
            await addNotification(post.authorId, {
              title: 'Post Removed',
              message: `Your post "${post.title}" has been removed by an admin.`,
              type: 'system',
              metadata: { action: 'post_deleted', postId, communityId: currentCommunity.id },
            });
          }
        }
      } catch (e) {
        console.error('Failed to delete post:', e);
      }
    };

    const handleTogglePin = async (post: any) => {
      try {
        const newStatus = post.status === 'Pinned' ? 'Active' : 'Pinned';
        await updatePost({ ...post, status: newStatus });
        if (newStatus === 'Pinned' && post.authorId && currentCommunity?.id) {
          await addNotification(post.authorId, {
            title: 'Post Pinned',
            message: `Your post "${post.title}" has been pinned by an admin.`,
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
          }).catch(() => {});
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
          }).catch(() => {});
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

    const tabs: { id: ModTab; label: string; icon: React.ReactNode }[] = [
      { id: 'members', label: 'Members', icon: <Users size={20} color={activeTab === 'members' ? '#fff' : '#64748b'} /> },
      { id: 'content', label: 'Content', icon: <FileText size={20} color={activeTab === 'content' ? '#fff' : '#64748b'} /> },
      { id: 'businesses', label: 'Businesses', icon: <Store size={20} color={activeTab === 'businesses' ? '#fff' : '#64748b'} /> },
      { id: 'categories', label: 'Categories', icon: <Tag size={20} color={activeTab === 'categories' ? '#fff' : '#64748b'} /> },
      { id: 'rules', label: 'Rules', icon: <Shield size={20} color={activeTab === 'rules' ? '#fff' : '#64748b'} /> },
      { id: 'coverage', label: 'Coverage', icon: <Map size={20} color={activeTab === 'coverage' ? '#fff' : '#64748b'} /> },
      { id: 'charity', label: 'Charity', icon: <Heart size={20} color={activeTab === 'charity' ? '#fff' : '#64748b'} /> },
      { id: 'logs', label: 'Audit', icon: <History size={20} color={activeTab === 'logs' ? '#fff' : '#64748b'} /> },
    ];

    const renderTabBar = () => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
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
      </ScrollView>
    );

    const renderCharityModeration = () => (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <ManageCommunityCharity initialMode="manage" clearInitialMode={() => {}} />
      </ScrollView>
    );

    const renderCoverage = () => (
      <ScrollView 
        style={styles.tabContent} 
        contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coverage Area</Text>
        </View>

        <View style={[styles.fieldGroup, { zIndex: 9999, elevation: 999, position: 'relative' }]}>
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
              placeholderTextColor: '#94a3b8',
            }}
            styles={{
              textInput: { ...styles.input, marginBottom: 0 },
              listView: { 
                position: 'absolute', 
                width: '100%', 
                top: 60,
                backgroundColor: '#fff', 
                borderRadius: 8, 
                marginTop: 2, 
                elevation: 4, 
                shadowColor: '#000', 
                shadowOpacity: 0.1, 
                shadowRadius: 6,
                zIndex: 9999
              },
              row: { paddingVertical: 10, paddingHorizontal: 12 },
              description: { fontSize: 13, color: '#374151' },
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
            maximumTrackTintColor="#CBD5E1"
            thumbTintColor={PRIMARY}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Set Center on Map</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
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
                fillColor="rgba(13,61,71,0.08)"
                strokeColor="#0d3d47"
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              Lat: {isNaN(tempCoverage.latitude) ? '-' : tempCoverage.latitude.toFixed(5)}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              Lng: {isNaN(tempCoverage.longitude) ? '-' : tempCoverage.longitude.toFixed(5)}
            </Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={24} color={PRIMARY} />
            <Text style={styles.infoBannerTitle}>Active Monitoring Zone</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCoverage} activeOpacity={0.8}>
            <Save size={16} color="#fff" />
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
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Member Management</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setMemberSubView('invite')}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color="#fff" />
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
                    <Mail size={20} color="#94a3b8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>Invited User</Text>
                    <Text style={styles.memberSub}>{inv.invited_user_id?.slice(0, 20)}...</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: '#f8fafc' }]}>
                    <Text style={[styles.roleBadgeText, { color: '#64748b' }]}>{inv.role}</Text>
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
                  <Image
                    source={{ uri: member.image || `https://picsum.photos/seed/${member.userId}/100/100` }}
                    style={styles.memberImg}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.name || 'Unknown'}</Text>
                    <View style={styles.memberStatusRow}>
                      <View style={[styles.statusDot, {
                        backgroundColor: member.status === 'ACTIVE' ? '#fc7127' : member.status === 'READ-ONLY' ? '#f59e0b' : '#94a3b8'
                      }]} />
                      <Text style={styles.memberSub}>{member.status}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.roleBadge,
                    { backgroundColor: member.role === 'ADMIN' ? PRIMARY : member.role === 'MODERATOR' ? SECONDARY : '#f1f5f9' }
                  ]}>
                    <Text style={[styles.roleBadgeText, { color: (member.role === 'ADMIN' || member.role === 'MODERATOR') ? '#fff' : '#64748b' }]}>
                      {member.role}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Users size={32} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No members yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      );
    };

    const renderInviteMembers = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setMemberSubView('list')} style={styles.backBtn}>
            <ArrowLeft size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Invite New Members</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>SEARCH BY EMAIL</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              placeholder="Enter user email..."
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {searchResults.map((u) => (
            <View key={u.id} style={styles.memberRow}>
              <View style={[styles.memberAvatar, { backgroundColor: '#f0fdf4' }]}>
                <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 16 }}>
                  {u.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{u.name}</Text>
                <Text style={styles.memberSub}>{u.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleInviteMember(u.id)}
              >
                <Text style={styles.actionBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>
          ))}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <Text style={styles.emptyStateText}>No users found.</Text>
          )}
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
                    <CheckCircle2 size={18} color="#fc7127" />
                  ) : (
                    <Copy size={18} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={[styles.buttonRow, { marginTop: 12 }]}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={inviteEmailRecipient}
                  onChangeText={setInviteEmailRecipient}
                  placeholder="Recipient email..."
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.actionBtn, { marginLeft: 8, paddingHorizontal: 16 }]}
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Mail size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              {inviteEmailStatus && (
                <View style={[styles.statusBanner, {
                  backgroundColor: inviteEmailStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  marginTop: 12
                }]}>
                  <Text style={{ color: inviteEmailStatus.type === 'success' ? '#1e5667' : ERROR, fontSize: 12, fontWeight: '700' }}>
                    {inviteEmailStatus.message}
                  </Text>
                </View>
              )}
              <View style={[styles.buttonRow, { marginTop: 12 }]}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={inviteSmsRecipient}
                  onChangeText={setInviteSmsRecipient}
                  placeholder="+27 phone in E.164…"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.actionBtn, { marginLeft: 8, paddingHorizontal: 16 }]}
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MessageSquare size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              {inviteSmsStatus && (
                <View style={[styles.statusBanner, {
                  backgroundColor: inviteSmsStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  marginTop: 12
                }]}>
                  <Text style={{ color: inviteSmsStatus.type === 'success' ? '#1e5667' : ERROR, fontSize: 12, fontWeight: '700' }}>
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <RefreshCw size={16} color="#fff" />
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
            <Text style={[styles.cardLabel, { color: 'rgba(255,255,255,0.7)' }]}>
              PENDING INVITATIONS ({communityInvitations.filter((inv: any) => inv.status === 'pending').length})
            </Text>
            {communityInvitations.filter((inv: any) => inv.status === 'pending').map((inv: any) => (
              <View key={inv.id} style={[styles.memberRow, { borderBottomColor: 'rgba(255,255,255,0.1)' }]}>
                <Mail size={16} color="rgba(255,255,255,0.8)" />
                <Text style={[styles.memberName, { color: '#fff', flex: 1, marginLeft: 8 }]} numberOfLines={1}>
                  {inv.invited_user_id?.slice(0, 20)}...
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#fff' }]}>{inv.role}</Text>
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
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setMemberSubView('list')} style={styles.backBtn}>
            <ArrowLeft size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Member Profile</Text>
        </View>

        <View style={[styles.card, { alignItems: 'center' }]}>
          <Image
            source={{ uri: selectedMember.image || `https://picsum.photos/seed/${selectedMember.userId}/200/200` }}
            style={styles.profileImg}
          />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{selectedMember.name}</Text>
          <Text style={styles.memberSub}>{selectedMember.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: PRIMARY }]}>
              <Text style={[styles.roleBadgeText, { color: '#fff' }]}>{selectedMember.role}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: '#f1f5f9' }]}>
              <Text style={[styles.roleBadgeText, { color: '#64748b' }]}>{selectedMember.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>AUTHORITY CONTROLS</Text>
          {currentCommunity?.userRole === 'ADMIN' &&
            selectedMember.userId !== currentUserProfile?.id &&
            selectedMember.role !== 'ADMIN' && (
              <TouchableOpacity
                style={[styles.controlBtn, { backgroundColor: selectedMember.role === 'MODERATOR' ? '#f5f3ff' : '#f8fafc' }]}
                onPress={() =>
                  setPendingRoleChange({
                    userId: selectedMember.userId,
                    userName: selectedMember.name || 'Member',
                    currentRole: selectedMember.role,
                    nextRole: selectedMember.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR',
                  })
                }
              >
                <ShieldAlert size={16} color={selectedMember.role === 'MODERATOR' ? SECONDARY : '#64748b'} />
                <Text style={[styles.controlBtnText, { color: selectedMember.role === 'MODERATOR' ? SECONDARY : '#64748b' }]}>
                  {selectedMember.role === 'MODERATOR' ? 'Remove Moderator Privileges' : 'Promote to Moderator'}
                </Text>
              </TouchableOpacity>
            )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>PROFILE INFORMATION</Text>
          {isLoadingMemberInsights ? (
            <View style={styles.inlineLoader}>
              <Loader2 size={16} color="#64748b" />
              <Text style={styles.memberSub}>Loading profile insights...</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
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
                <View style={[styles.activityBadge, { backgroundColor: item.type === 'listing' ? '#fef3c7' : '#e0f2fe' }]}>
                  <Text style={[styles.activityBadgeText, { color: item.type === 'listing' ? '#b45309' : '#075985' }]}>{item.type === 'listing' ? 'LISTING' : 'NOTICE'}</Text>
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
                <View style={[styles.activityBadge, { backgroundColor: '#f3e8ff' }]}>
                  <Text style={[styles.activityBadgeText, { color: '#6d28d9' }]}>{item.status?.toUpperCase() || 'PENDING'}</Text>
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
                <View style={[styles.activityBadge, { backgroundColor: '#ecfeff' }]}>
                  <Text style={[styles.activityBadgeText, { color: '#155e75' }]}>{log.action.toUpperCase()}</Text>
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
          <View style={[styles.card, { borderColor: '#fef2f2', backgroundColor: '#fff5f5' }]}>
            <View style={styles.dangerHeader}>
              <UserMinus size={20} color={ERROR} />
              <Text style={[styles.cardLabel, { color: ERROR, marginBottom: 0 }]}>REMOVE MEMBER</Text>
            </View>
            <Text style={styles.memberSub}>Revoke access to this community or permanently delete the member.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: '#fef2f2' }]}
                onPress={() => setPendingRemoveMember({ id: selectedMember.userId, name: selectedMember.name || 'Member' })}
              >
                <Text style={[styles.dangerBtnText, { color: ERROR }]}>Deactivate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: ERROR }]}
                onPress={() => setPendingDeleteMember({ id: selectedMember.userId, name: selectedMember.name || 'Member' })}
              >
                <Text style={[styles.dangerBtnText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      );
    };

    const renderContent = () => {
      const activePosts = posts.filter((p: any) => p.status !== 'deleted');
      const pendingPublic = posts.filter((p: any) => p.status === 'PendingPublic');
      const businesses = currentCommunity?.businesses || [];

      const filteredItems = (() => {
        switch (contentFilter) {
          case 'notices': return activePosts.filter((p: any) => p.type === 'notice');
          case 'listings': return activePosts.filter((p: any) => p.type === 'listing');
          case 'businesses': return [];
          case 'public_queue': return pendingPublic;
          default: return activePosts;
        }
      })();

      const filterTabs = [
        { key: 'all' as const, label: 'All', count: activePosts.length },
        { key: 'notices' as const, label: 'Notices', count: activePosts.filter((p: any) => p.type === 'notice').length },
        { key: 'listings' as const, label: 'Listings', count: activePosts.filter((p: any) => p.type === 'listing').length },
        { key: 'businesses' as const, label: 'Businesses', count: businesses.length },
        { key: 'public_queue' as const, label: 'Queue', count: pendingPublic.length },
      ];

      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
          <Text style={styles.sectionTitle}>Content & Notice Control</Text>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              {filterTabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, contentFilter === tab.key && styles.filterTabActive]}
                  onPress={() => setContentFilter(tab.key)}
                >
                  <Text style={[styles.filterTabText, contentFilter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                    {tab.count > 0 ? ` (${tab.count})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {contentFilter === 'businesses' ? (
            businesses.map((biz: any) => (
              <View key={biz.id} style={styles.contentItem}>
                <View style={[styles.contentIcon, { backgroundColor: '#f5f3ff' }]}>
                  <Store size={18} color={SECONDARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contentTitle}>{biz.name}</Text>
                  <Text style={styles.contentSub}>{biz.category} • Live in Marketplace</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.statusChipText, { color: '#1e5667' }] }>
                    Live
                  </Text>
                </View>
              </View>
            ))
          ) : (
            filteredItems.map((notice: any) => (
              <View key={notice.id} style={styles.contentItem}>
                <View style={[styles.contentIcon, {
                  backgroundColor: notice.status === 'PendingPublic' ? '#fffbeb'
                    : notice.type === 'listing' ? '#f5f3ff' : '#f0fdf4'
                }]}>
                  {notice.status === 'PendingPublic' ? (
                    <Globe size={18} color="#b45309" />
                  ) : notice.type === 'listing' ? (
                    <Tag size={18} color={SECONDARY} />
                  ) : (
                    <Pin size={18} color={PRIMARY} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contentTitle} numberOfLines={1}>{notice.title}</Text>
                  <Text style={styles.contentSub}>
                    {notice.authorName} • {notice.type} • {notice.urgencyLevel || ''}
                  </Text>
                </View>
                <View style={styles.contentActions}>
                  {notice.status === 'PendingPublic' ? (
                    <>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleApprovePublicListing(notice)}>
                        <CheckCircle2 size={18} color="#fc7127" />
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
                        <Pin size={16} color={notice.status === 'Pinned' ? PRIMARY : '#94a3b8'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => setPendingDeletePost({ id: notice.id, title: notice.title || 'Untitled' })}
                      >
                        <Trash2 size={16} color={ERROR} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          )}

          {filteredItems.length === 0 && contentFilter !== 'businesses' && (
            <View style={styles.emptyState}>
              <FileText size={32} color="#cbd5e1" />
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

      const userCommunityBizs = (communityBusinesses || []).filter(b => b.source !== 'IMPORT');
      const importedBizs = (communityBusinesses || []).filter(b => b.source === 'IMPORT');
      const activeBizs = bizFilter === 'user' ? userCommunityBizs : importedBizs;

      const renderBizCard = (biz: any, idx: number) => (
        <View key={biz.id || idx} style={styles.bizCard}>
          <Image
            source={{ uri: biz.image || `https://picsum.photos/seed/${biz.name}/400/400` }}
            style={styles.bizImg}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName}>{biz.name}</Text>
            <Text style={styles.bizCategory}>{biz.category}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700' }}>Live in Marketplace</Text>
              </View>
              <View style={{ backgroundColor: biz.source === 'IMPORT' ? '#f5f3ff' : '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, color: biz.source === 'IMPORT' ? '#7c3aed' : '#1d4ed8', fontWeight: '700' }}>
                  {biz.source === 'IMPORT' ? 'AI Imported' : 'User Business'}
                </Text>
              </View>
            </View>
            {biz.description ? (
              <Text style={styles.memberSub} numberOfLines={2}>{biz.description}</Text>
            ) : null}
          </View>
          <View style={styles.bizActions}>
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
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Business Management</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0d3d47', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
              onPress={() => setShowImportTool(true)}
              activeOpacity={0.8}
            >
              <Sparkles size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>AI Import</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.filterTab, bizFilter === 'user' && styles.filterTabActive]}
              onPress={() => setBizFilter('user')}
            >
              <Text style={bizFilter === 'user' ? styles.filterTabTextActive : styles.filterTabText}>
                User Businesses ({userCommunityBizs.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, bizFilter === 'ai' && styles.filterTabActive]}
              onPress={() => setBizFilter('ai')}
            >
              <Text style={bizFilter === 'ai' ? styles.filterTabTextActive : styles.filterTabText}>
                AI Imported Businesses ({importedBizs.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeBizs.length > 0
            ? activeBizs.map((biz, idx) => renderBizCard(biz, idx))
            : (
              <View style={styles.emptyState}>
                <Store size={32} color="#cbd5e1" />
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
        <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category Management</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
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
                <View style={[styles.categoryIcon, { backgroundColor: enabled ? '#fff' : '#f8fafc' }]}>
                  <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryName, enabled && { color: PRIMARY }]}>{cat.label}</Text>
                  <Text style={styles.categoryTypes}>{cat.types.length} types</Text>
                </View>
                <View style={[styles.checkCircle, enabled && styles.checkCircleActive]}>
                  {enabled && <CheckCircle2 size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    };

    const renderRules = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
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
            <View style={[styles.toggle, { backgroundColor: '#e2e8f0' }]}>
              <View style={[styles.toggleThumb, { left: 2 }]} />
            </View>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleText}>Require business verification</Text>
            <View style={[styles.toggle, { backgroundColor: '#fc7127' }]}>
              <View style={[styles.toggleThumb, { right: 2 }]} />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#ffddb9' }]}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={[styles.categoryIcon, { backgroundColor: PRIMARY }]}>
              <AlertTriangle size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: PRIMARY }]}>AUTO-MODERATION (AI LAYER)</Text>
              <Text style={styles.memberSub}>
                Configure automated filters for spam, hate speech, and misinformation.
              </Text>
              <TouchableOpacity style={[styles.actionBtn, { marginTop: 12, alignSelf: 'flex-start' }]}>
                <Text style={styles.actionBtnText}>Configure AI Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    );

    const renderLogs = () => (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Audit & Logs</Text>
        {logs.length > 0 ? logs.map((log) => {
          const actionColors: Record<string, string> = {
            approve: '#fc7127', reject: ERROR, delete: ERROR, warn: '#f59e0b', ban: ERROR,
          };
          const color = actionColors[log.action] || '#94a3b8';
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
                <Clock size={10} color="#94a3b8" />
                <Text style={styles.timeText}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                </Text>
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <History size={32} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No audit logs yet</Text>
          </View>
        )}
      </ScrollView>
    );

    const renderActiveTab = () => {
      switch (activeTab) {
        case 'coverage': return renderCoverage();
        case 'charity': return renderCharityModeration();
        case 'members': return renderMembers();
        case 'content': return renderContent();
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: PRIMARY },
  backBtn: { padding: 6 },
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexGrow: 0, minHeight: 50 },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  tabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tabBtnActive: { backgroundColor: PRIMARY },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },
  tabContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: PRIMARY, flex: 1 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 10, fontWeight: '900', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  fieldRow: { flexDirection: 'row', gap: 12 },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radiusValue: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  radiusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9',
  },
  radiusBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  radiusBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  radiusBtnTextActive: { color: '#fff' },
  mapContainer: { borderRadius: 20, overflow: 'hidden', height: 280, borderWidth: 1, borderColor: '#e2e8f0' },
  map: { width: '100%', height: '100%' },
  infoBanner: {
    flexDirection: 'row', backgroundColor: '#f0fdf4',
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#ffddb9', alignItems: 'center', justifyContent: 'space-between',
  },
  infoBannerTitle: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  infoBannerDesc: { fontSize: 12, color: '#475569', lineHeight: 18, flex: 1 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLabel: {
    fontSize: 9, fontWeight: '900', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  memberImg: { width: 40, height: 40, borderRadius: 20 },
  memberName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  memberSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  memberStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  roleBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn: { padding: 6 },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn: {
    backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  linkText: { flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#334155' },
  statusBanner: { padding: 10, borderRadius: 10 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },

  profileImg: { width: 80, height: 80, borderRadius: 40, marginTop: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineLoader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  infoLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 13, color: '#0f172a', fontWeight: '600' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  activityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  activityBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightItem: {
    width: '48%', backgroundColor: '#f8fafc', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#f1f5f9',
  },
  insightValue: { fontSize: 18, fontWeight: '900', color: PRIMARY },
  insightLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: 2 },

  controlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12,
  },
  controlBtnText: { fontSize: 13, fontWeight: '700', flex: 1 },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnText: { fontSize: 13, fontWeight: '700' },

  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99,
    backgroundColor: '#f8fafc',
  },
  filterTabActive: { backgroundColor: PRIMARY },
  filterTabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },

  contentItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  contentIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contentTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  contentSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  contentActions: { flexDirection: 'row', gap: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  statusChipText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  bizCard: {
    flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  bizImg: { width: 64, height: 64, borderRadius: 14 },
  bizName: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  bizCategory: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  bizStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  bizActions: { gap: 6, justifyContent: 'center' },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fc7127', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  approveBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  featureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  featureBtnActive: { backgroundColor: '#f59e0b' },
  featureBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  removeBtn: {
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    borderWidth: 2, borderColor: '#f1f5f9', opacity: 0.7,
  },
  categoryItemActive: { backgroundColor: '#f0fdf4', borderColor: PRIMARY, opacity: 1 },
  categoryIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  categoryTypes: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  ruleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  ruleText: { fontSize: 14, color: '#334155', fontWeight: '500', flex: 1 },
  ruleInput: {
    width: 56, backgroundColor: '#fff', borderRadius: 8, textAlign: 'center',
    fontSize: 14, fontWeight: '700', color: PRIMARY,
    borderWidth: 1, borderColor: '#f1f5f9', paddingVertical: 6,
  },
  toggle: { width: 40, height: 20, borderRadius: 10, position: 'relative', justifyContent: 'center' },
  toggleThumb: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },

  logItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  logIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logAction: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  logMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeText: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyStateText: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },
});
