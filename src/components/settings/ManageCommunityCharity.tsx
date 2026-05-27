import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import type { Charity, CharitySuggestion, CatHubSummary } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

type CharityEntryMode = 'manage' | 'suggest' | null;
type CharityAdminView = 'list' | 'form' | 'suggestions';

interface ManageCommunityCharityProps {
  initialMode?: CharityEntryMode;
  clearInitialMode?: () => void;
}

interface CharityFormState {
  name: string;
  description: string;
  percentage: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  logo: string;
  coverImage: string;
  tags: string;
  fundraisingGoal: string;
  isFeatured: boolean;
}

interface SuggestionFormState {
  name: string;
  description: string;
  reason: string;
  amount: string;
  website: string;
}

const EMPTY_CHARITY_FORM: CharityFormState = {
  name: '',
  description: '',
  percentage: '5',
  website: '',
  contactEmail: '',
  contactPhone: '',
  logo: '',
  coverImage: '',
  tags: 'Verified, Community Support',
  fundraisingGoal: '',
  isFeatured: false,
};

const EMPTY_SUGGESTION_FORM: SuggestionFormState = {
  name: '',
  description: '',
  reason: '',
  amount: '',
  website: '',
};
const TYPE_SCALE = {
  sm: 10,
  md: 11,
  base: 12,
  body: 13,
  lg: 14,
  xl: 16,
  title: 20,
};
const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 2,
  s3: 3,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s28: 28,
  s34: 34,
  s40: 40,
  s11: 11,
  s7: 7,
};
const RADIUS = {
  s17: 17,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 20,
  full: 999,
};
const LETTER_SPACING = {
  md: 1,
  lg: 2,
};
const LINE_HEIGHT = {
  md: 16,
  lg: 18,
};

const toCharityForm = (
  charity?: Partial<Charity> | null,
  fallbackFeatured = false
): CharityFormState => ({
  name: charity?.name ?? '',
  description: charity?.description ?? '',
  percentage:
    typeof charity?.percentage === 'number' ? String(charity.percentage) : '5',
  website: charity?.website ?? '',
  contactEmail: charity?.contactEmail ?? '',
  contactPhone: charity?.contactPhone ?? '',
  logo: charity?.logo ?? '',
  coverImage: charity?.coverImage ?? '',
  tags: charity?.tags?.join(', ') ?? 'Verified, Community Support',
  fundraisingGoal:
    typeof charity?.fundraisingGoal === 'number'
      ? String(charity.fundraisingGoal)
      : '',
  isFeatured: charity?.isFeatured ?? fallbackFeatured,
});

export default function ManageCommunityCharity({
  initialMode = null,
  clearInitialMode,
}: ManageCommunityCharityProps) {
  const { userProfile } = useAuth();
  const {
    currentCommunity,
    charities,
    charitySuggestions,
    addCharity,
    updateCharity,
    removeCharity,
    addCharitySuggestion,
    approveCharitySuggestion,
    rejectCharitySuggestion,
    setCatCycle,
    getCatHub,
  } = useCommunity();

  const canManageCharity =
    currentCommunity?.userRole === 'OWNER' ||
    currentCommunity?.userRole === 'ADMIN' ||
    currentCommunity?.userRole === 'MODERATOR';
  const hasCommunity = !!currentCommunity?.id;

  const [showManager, setShowManager] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [adminView, setAdminView] = useState<CharityAdminView>('list');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<CharitySuggestion | null>(null);
  const [charityForm, setCharityForm] =
    useState<CharityFormState>(EMPTY_CHARITY_FORM);
  const [suggestionForm, setSuggestionForm] =
    useState<SuggestionFormState>(EMPTY_SUGGESTION_FORM);
  const [suggestionFeedbacks, setSuggestionFeedbacks] = useState<Record<string, string>>(
    {}
  );
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [savingCharity, setSavingCharity] = useState(false);
  const [savingSuggestion, setSavingSuggestion] = useState(false);
  const [updatingCatCycle, setUpdatingCatCycle] = useState(false);
  const [catHubLoading, setCatHubLoading] = useState(false);
  const [catHubSummary, setCatHubSummary] = useState<CatHubSummary | null>(null);

  const availableCharities = useMemo(
    () => charities.filter((charity) => charity.status !== 'Archived'),
    [charities]
  );

  const featuredCharity = useMemo(
    () =>
      availableCharities.find((charity) => charity.isFeatured) ??
      (availableCharities.length === 1 ? availableCharities[0] : null),
    [availableCharities]
  );

  const pendingSuggestions = useMemo(
    () => charitySuggestions.filter((suggestion) => suggestion.status === 'pending'),
    [charitySuggestions]
  );

  useEffect(() => {
    if (initialMode === 'manage' && canManageCharity) {
      setShowManager(true);
      setAdminView('list');
    } else if (initialMode === 'suggest') {
      setShowSuggestModal(true);
    }
  }, [initialMode, canManageCharity]);

  useEffect(() => {
    if (!showManager || !canManageCharity || !hasCommunity) return;
    setCatHubLoading(true);
    getCatHub()
      .then((data) => setCatHubSummary(data))
      .catch(() => setCatHubSummary(null))
      .finally(() => setCatHubLoading(false));
  }, [showManager, canManageCharity, hasCommunity, getCatHub]);

  const closeManager = () => {
    setShowManager(false);
    setAdminView('list');
    setSelectedCharity(null);
    setSelectedSuggestion(null);
    setCharityForm(EMPTY_CHARITY_FORM);
    setReviewFeedback('');
    clearInitialMode?.();
  };

  const closeSuggestModal = () => {
    setShowSuggestModal(false);
    setSuggestionForm(EMPTY_SUGGESTION_FORM);
    clearInitialMode?.();
  };

  const openAdminForm = (charity?: Charity | null, suggestion?: CharitySuggestion | null) => {
    const fallbackFeatured = !featuredCharity && !charity;
    const prefilledFromSuggestion = suggestion
      ? {
          name: suggestion.name,
          description: suggestion.description,
          percentage:
            typeof suggestion.suggestedDonationAmount === 'number'
              ? String(suggestion.suggestedDonationAmount)
              : '5',
          website: suggestion.website ?? '',
          tags: 'Verified, Member Suggested',
          isFeatured: fallbackFeatured,
        }
      : null;

    setSelectedCharity(charity ?? null);
    setSelectedSuggestion(suggestion ?? null);
    setReviewFeedback(
      suggestion ? suggestionFeedbacks[suggestion.id] ?? '' : ''
    );
    setCharityForm(
      prefilledFromSuggestion
        ? { ...EMPTY_CHARITY_FORM, ...prefilledFromSuggestion }
        : toCharityForm(charity, fallbackFeatured)
    );
    setAdminView('form');
    setShowManager(true);
  };

  const handleSaveCharity = async () => {
    if (!hasCommunity) {
      Alert.alert('No community selected', 'Select a community before managing charities.');
      return;
    }
    if (!charityForm.name.trim() || !charityForm.description.trim()) {
      Alert.alert('Missing details', 'Name and description are required.');
      return;
    }

    const percentage = Number(charityForm.percentage);
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
      Alert.alert('Invalid percentage', 'Enter a donation percentage between 1 and 100.');
      return;
    }

    setSavingCharity(true);
    try {
      const coverage = currentCommunity?.coverageArea;
      const fundraisingGoal = charityForm.fundraisingGoal.trim()
        ? Number(charityForm.fundraisingGoal)
        : undefined;

      const basePayload: Omit<Charity, 'id' | 'createdAt'> = {
        communityId: currentCommunity!.id,
        name: charityForm.name.trim(),
        description: charityForm.description.trim(),
        category: selectedCharity?.category ?? 'Community Support',
        percentage,
        latitude: selectedCharity?.latitude ?? coverage?.latitude ?? -26.2041,
        longitude: selectedCharity?.longitude ?? coverage?.longitude ?? 28.0473,
        locationName:
          selectedCharity?.locationName ??
          coverage?.locationName ??
          currentCommunity?.name ??
          'Community Coverage Area',
        contactPhone: charityForm.contactPhone.trim(),
        contactEmail: charityForm.contactEmail.trim(),
        website: charityForm.website.trim(),
        logo: charityForm.logo.trim(),
        coverImage: charityForm.coverImage.trim(),
        tags: charityForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        isVerified: selectedSuggestion ? true : selectedCharity?.isVerified ?? false,
        isFeatured: charityForm.isFeatured,
        urgency: selectedCharity?.urgency ?? 'Normal',
        status: 'Active',
        linkedBusinessIds: selectedCharity?.linkedBusinessIds ?? [],
        raisedAmount: selectedCharity?.raisedAmount ?? 0,
        fundraisingGoal,
        campaignCompleted: selectedCharity?.campaignCompleted ?? false,
      };

      if (selectedSuggestion) {
        await approveCharitySuggestion(
          selectedSuggestion.id,
          reviewFeedback.trim(),
          basePayload
        );
        setSuggestionFeedbacks((current) => ({
          ...current,
          [selectedSuggestion.id]: reviewFeedback.trim(),
        }));
      } else if (selectedCharity) {
        await updateCharity({
          ...selectedCharity,
          ...basePayload,
        });
      } else {
        await addCharity(basePayload);
      }

      setAdminView('list');
      setSelectedCharity(null);
      setSelectedSuggestion(null);
      setCharityForm(EMPTY_CHARITY_FORM);
      setReviewFeedback('');
    } catch (error) {
      Alert.alert(
        'Unable to save charity',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSavingCharity(false);
    }
  };

  const handleArchiveCharity = (charity: Charity) => {
    Alert.alert(
      'Archive charity',
      `Archive ${charity.name}? You can keep its history without deleting it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCharity(charity.id);
            } catch (error) {
              Alert.alert(
                'Unable to archive charity',
                error instanceof Error ? error.message : 'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleSubmitSuggestion = async () => {
    if (!hasCommunity || !userProfile) {
      Alert.alert('No community selected', 'Join or select a community before suggesting a charity.');
      return;
    }
    if (
      !suggestionForm.name.trim() ||
      !suggestionForm.description.trim() ||
      !suggestionForm.reason.trim()
    ) {
      Alert.alert('Missing details', 'Name, description, and reason are required.');
      return;
    }

    const amount = Number(suggestionForm.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      Alert.alert('Invalid percentage', 'Enter a whole number between 1 and 100.');
      return;
    }

    setSavingSuggestion(true);
    try {
      await addCharitySuggestion({
        communityId: currentCommunity!.id,
        suggestedById: userProfile!.id,
        suggestedByName: userProfile?.name || 'Community Member',
        name: suggestionForm.name.trim(),
        description: suggestionForm.description.trim(),
        reason: suggestionForm.reason.trim(),
        website: suggestionForm.website.trim(),
        suggestedDonationAmount: amount,
      });
      closeSuggestModal();
      Alert.alert(
        'Suggestion sent',
        'Your charity suggestion is now waiting for moderator or admin review.'
      );
    } catch (error) {
      Alert.alert(
        'Unable to submit suggestion',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSavingSuggestion(false);
    }
  };

  const handleRejectSuggestion = async (suggestion: CharitySuggestion) => {
    const feedback = suggestionFeedbacks[suggestion.id]?.trim() ?? '';
    try {
      await rejectCharitySuggestion(suggestion.id, feedback);
    } catch (error) {
      Alert.alert(
        'Unable to reject suggestion',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleToggleCatCycle = async (nextActive: boolean) => {
    if (!hasCommunity || updatingCatCycle) return;
    if (nextActive && !featuredCharity?.id) {
      Alert.alert('Featured charity required', 'Select a featured charity before activating the CAT cycle.');
      return;
    }
    setUpdatingCatCycle(true);
    try {
      await setCatCycle(nextActive, featuredCharity?.id);
      const latest = await getCatHub();
      setCatHubSummary(latest);
      Alert.alert(
        nextActive ? 'Charity cycle activated' : 'Charity cycle paused',
        nextActive
          ? 'Public listing CAT earnings now pool into the featured charity when sold.'
          : 'Public listing CAT earnings now remain seller earnings when sold.'
      );
    } catch (error) {
      Alert.alert(
        'Unable to update CAT cycle',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setUpdatingCatCycle(false);
    }
  };

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Community Charity</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.card}
          onPress={() => {
            if (canManageCharity) {
              setShowManager(true);
              setAdminView('list');
            } else {
              setShowSuggestModal(true);
            }
          }}
        >
          <View style={styles.cardIconWrap}>
            <HeartHandshake size={20} color={THEME_COLORS.primary} />
          </View>
          <View style={{ flex: 1, gap: SPACE.s3 }}>
            <Text style={styles.cardTitle}>
              {featuredCharity?.name || 'Support a local cause'}
            </Text>
            <Text style={styles.cardDescription}>
              {canManageCharity
                ? `${pendingSuggestions.length} pending suggestions and ${availableCharities.length} active charities.`
                : 'Suggest a charity for your community to support.'}
            </Text>
          </View>
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>
              {canManageCharity ? 'Manage' : 'Suggest'}
            </Text>
            <ChevronRight size={16} color={THEME_COLORS.neutralTextMuted} />
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={showManager} animationType="slide" transparent onRequestClose={closeManager}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Charity Management</Text>
                <Text style={styles.modalSubtitle}>
                  Manage featured causes and review community suggestions.
                </Text>
              </View>
              <TouchableOpacity onPress={closeManager} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabButton, adminView === 'list' && styles.tabButtonActive]}
                onPress={() => setAdminView('list')}
              >
                <Text style={[styles.tabButtonText, adminView === 'list' && styles.tabButtonTextActive]}>
                  Charities
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  adminView === 'suggestions' && styles.tabButtonActive,
                ]}
                onPress={() => setAdminView('suggestions')}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    adminView === 'suggestions' && styles.tabButtonTextActive,
                  ]}
                >
                  Suggestions ({pendingSuggestions.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: SPACE.xl, paddingBottom: SPACE.s20 }}>
              {adminView === 'list' && (
                <>
                  <View style={styles.catCycleCard}>
                    <View style={{ flex: 1, gap: SPACE.xs }}>
                      <Text style={styles.listItemTitle}>CAT Charity Cycle</Text>
                      <Text style={styles.listItemMeta}>
                        {currentCommunity?.catCycleActive
                          ? `Active${featuredCharity?.name ? ` • Pooling to ${featuredCharity.name}` : ''}`
                          : 'Inactive • Public CAT remains seller earnings'}
                      </Text>
                    </View>
                    <Switch
                      value={Boolean(currentCommunity?.catCycleActive)}
                      disabled={updatingCatCycle}
                      onValueChange={handleToggleCatCycle}
                      trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                      thumbColor={THEME_COLORS.white}
                    />
                  </View>

                  <View style={styles.catHubCard}>
                    <Text style={styles.catHubTitle}>Charity Hub</Text>
                    {catHubLoading ? (
                      <ActivityIndicator color={THEME_COLORS.primary} />
                    ) : (
                      <>
                        <Text style={styles.catHubMetric}>
                          Total CAT Generated: R{Number(catHubSummary?.totalCATGenerated ?? 0).toLocaleString()}
                        </Text>
                        <Text style={styles.catHubMetric}>
                          Total Raised For Charity: R{Number(catHubSummary?.totalRaisedForCharity ?? 0).toLocaleString()}
                        </Text>
                        <Text style={styles.listItemMeta}>
                          Recent transactions: {catHubSummary?.recentTransactions?.length ?? 0}
                        </Text>
                      </>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => openAdminForm(null, null)}
                    activeOpacity={0.85}
                  >
                    <Plus size={16} color={THEME_COLORS.white} />
                    <Text style={styles.primaryButtonText}>Add Charity</Text>
                  </TouchableOpacity>

                  {availableCharities.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Sparkles size={18} color={THEME_COLORS.neutralTextMuted} />
                      <Text style={styles.emptyStateTitle}>No charities yet</Text>
                      <Text style={styles.emptyStateBody}>
                        Create the first charity for this community or approve a member suggestion.
                      </Text>
                    </View>
                  ) : (
                    availableCharities.map((charity) => (
                      <View key={charity.id} style={styles.listItem}>
                        <View style={{ flex: 1, gap: SPACE.xs }}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.listItemTitle}>{charity.name}</Text>
                            {charity.isCATCharity && (
                              <View style={styles.badge}>
                                <CheckCircle2 size={11} color={THEME_COLORS.primary} />
                                <Text style={styles.badgeText}>CAT</Text>
                              </View>
                            )}
                            {charity.isFeatured && (
                              <View style={styles.badge}>
                                <ShieldCheck size={11} color={THEME_COLORS.primary} />
                                <Text style={styles.badgeText}>Featured</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.listItemMeta}>
                            {charity.percentage}% impact
                            {typeof charity.raisedAmount === 'number'
                              ? ` • R${charity.raisedAmount.toLocaleString()} raised`
                              : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => openAdminForm(charity, null)}
                          style={styles.inlineButton}
                        >
                          <Text style={styles.inlineButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleArchiveCharity(charity)}
                          style={styles.iconButton}
                        >
                          <Trash2 size={15} color={THEME_COLORS.errorStrong} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </>
              )}

              {adminView === 'suggestions' && (
                <>
                  {pendingSuggestions.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Sparkles size={18} color={THEME_COLORS.neutralTextMuted} />
                      <Text style={styles.emptyStateTitle}>No pending suggestions</Text>
                      <Text style={styles.emptyStateBody}>
                        Member charity suggestions will appear here for moderator or admin review.
                      </Text>
                    </View>
                  ) : (
                    pendingSuggestions.map((suggestion) => (
                      <View key={suggestion.id} style={styles.suggestionItem}>
                        <Text style={styles.listItemTitle}>{suggestion.name}</Text>
                        <Text style={styles.listItemMeta}>
                          Suggested by {suggestion.suggestedByName} at{' '}
                          {suggestion.suggestedDonationAmount ?? 0}%
                        </Text>
                        <Text style={styles.suggestionBody}>{suggestion.description}</Text>
                        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                        <TextInput
                          style={[styles.input, styles.textarea]}
                          value={suggestionFeedbacks[suggestion.id] ?? ''}
                          onChangeText={(value) =>
                            setSuggestionFeedbacks((current) => ({
                              ...current,
                              [suggestion.id]: value,
                            }))
                          }
                          placeholder="Optional feedback for the member"
                          placeholderTextColor={THEME_COLORS.neutralTextMuted}
                          multiline
                        />
                        <View style={styles.inlineRow}>
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => openAdminForm(null, suggestion)}
                          >
                            <Text style={styles.secondaryButtonText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.destructiveButton}
                            onPress={() => handleRejectSuggestion(suggestion)}
                          >
                            <Text style={styles.destructiveButtonText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}

              {adminView === 'form' && (
                <View style={{ gap: SPACE.xl }}>
                  <Text style={styles.formTitle}>
                    {selectedSuggestion
                      ? `Approve ${selectedSuggestion.name}`
                      : selectedCharity
                      ? 'Edit Charity'
                      : 'Add Charity'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={charityForm.name}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Charity name"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    editable={!selectedCharity?.isCATCharity}
                  />
                  {selectedCharity?.isCATCharity ? (
                    <Text style={styles.listItemMeta}>CAT charity name is fixed and cannot be renamed.</Text>
                  ) : null}
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={charityForm.description}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, description: value }))
                    }
                    placeholder="Charity description"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    multiline
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.percentage}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, percentage: value }))
                    }
                    placeholder="Donation percentage"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.fundraisingGoal}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, fundraisingGoal: value }))
                    }
                    placeholder="Fundraising goal (optional)"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.website}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, website: value }))
                    }
                    placeholder="Website"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.contactEmail}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, contactEmail: value }))
                    }
                    placeholder="Contact email"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.contactPhone}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, contactPhone: value }))
                    }
                    placeholder="Contact phone"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.logo}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, logo: value }))
                    }
                    placeholder="Logo URL"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.coverImage}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, coverImage: value }))
                    }
                    placeholder="Cover image URL"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.tags}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, tags: value }))
                    }
                    placeholder="Tags separated by commas"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Featured charity</Text>
                    <Switch
                      value={charityForm.isFeatured}
                      onValueChange={(value) =>
                        setCharityForm((current) => ({ ...current, isFeatured: value }))
                      }
                      trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                      thumbColor={THEME_COLORS.white}
                    />
                  </View>
                  {selectedSuggestion && (
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      value={reviewFeedback}
                      onChangeText={setReviewFeedback}
                      placeholder="Optional approval feedback"
                      placeholderTextColor={THEME_COLORS.neutralTextMuted}
                      multiline
                    />
                  )}
                  <View style={styles.inlineRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setAdminView(selectedSuggestion ? 'suggestions' : 'list');
                        setSelectedCharity(null);
                        setSelectedSuggestion(null);
                        setCharityForm(EMPTY_CHARITY_FORM);
                        setReviewFeedback('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleSaveCharity}
                      disabled={savingCharity}
                    >
                      {savingCharity ? (
                        <ActivityIndicator color={THEME_COLORS.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          {selectedSuggestion
                            ? 'Approve Suggestion'
                            : selectedCharity
                            ? 'Save Charity'
                            : 'Create Charity'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuggestModal} animationType="slide" transparent onRequestClose={closeSuggestModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Suggest a Charity</Text>
                <Text style={styles.modalSubtitle}>
                  Recommend a cause for your community to support.
                </Text>
              </View>
              <TouchableOpacity onPress={closeSuggestModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: SPACE.xl, paddingBottom: SPACE.s20 }}>
              <TextInput
                style={styles.input}
                value={suggestionForm.name}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, name: value }))
                }
                placeholder="Charity name"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={suggestionForm.description}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, description: value }))
                }
                placeholder="What is their mission?"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
                multiline
              />
              <TextInput
                style={styles.input}
                value={suggestionForm.amount}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, amount: value }))
                }
                placeholder="Suggested percentage"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                value={suggestionForm.website}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, website: value }))
                }
                placeholder="Website"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={suggestionForm.reason}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, reason: value }))
                }
                placeholder="Why should the community support them?"
                placeholderTextColor={THEME_COLORS.neutralTextMuted}
                multiline
              />

              <View style={styles.inlineRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeSuggestModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSubmitSuggestion}
                  disabled={savingSuggestion}
                >
                  {savingSuggestion ? (
                    <ActivityIndicator color={THEME_COLORS.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit Suggestion</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm },
  sectionLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextSoft,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.lg,
    paddingHorizontal: SPACE.xs,
    paddingBottom: SPACE.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxl,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.s16,
  },
  cardIconWrap: {
    width: SPACE.s40,
    height: SPACE.s40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.successSurface,
  },
  cardTitle: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface },
  cardDescription: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.md },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  cardActionText: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.extrabold,
    color: THEME_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: THEME_COLORS.alias_rgba_15_23_42_0_45,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACE.s18,
    paddingTop: SPACE.s18,
    paddingBottom: SPACE.s28,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACE.xl,
    marginBottom: SPACE.xxl,
  },
  modalTitle: { fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary },
  modalSubtitle: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs },
  closeButton: {
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.full,
    backgroundColor: THEME_COLORS.neutralBgSofter,
  },
  closeButtonText: { fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextEmphasis },
  tabRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginBottom: SPACE.xxl,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.md,
    backgroundColor: THEME_COLORS.neutralBgSofter,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: THEME_COLORS.primary },
  tabButtonText: { fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextDefault },
  tabButtonTextActive: { color: THEME_COLORS.white },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    backgroundColor: THEME_COLORS.primary,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.s16,
    borderRadius: RADIUS.lg,
    flex: 1,
  },
  primaryButtonText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.extrabold },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.s11,
    backgroundColor: THEME_COLORS.infoSurface,
  },
  secondaryButtonText: { color: THEME_COLORS.infoText, fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.extrabold },
  destructiveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.s11,
    backgroundColor: THEME_COLORS.errorBorder,
  },
  destructiveButtonText: { color: THEME_COLORS.error, fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.extrabold },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.s11,
    backgroundColor: THEME_COLORS.neutralBgSofter,
  },
  cancelButtonText: { color: THEME_COLORS.neutralTextEmphasis, fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.extrabold },
  emptyState: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.s18,
    gap: SPACE.sm,
    backgroundColor: THEME_COLORS.neutralBg,
  },
  emptyStateTitle: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.aliasHex_1f2937 },
  emptyStateBody: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.lg },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.xxl,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
  },
  catCycleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.xxl,
    backgroundColor: THEME_COLORS.neutralBg,
  },
  catHubCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.xxl,
    gap: SPACE.sm,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
  },
  catHubTitle: {
    fontSize: TYPE_SCALE.body,
    fontWeight: FONT_WEIGHT.extrabold,
    color: THEME_COLORS.primary,
  },
  catHubMetric: {
    fontSize: TYPE_SCALE.base,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextStrong,
  },
  listItemTitle: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  listItemMeta: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  inlineButton: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.s7,
    borderRadius: RADIUS.full,
    backgroundColor: THEME_COLORS.infoSurfaceSoft,
  },
  inlineButtonText: { color: THEME_COLORS.brandBlueText, fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold },
  iconButton: {
    width: SPACE.s34,
    height: SPACE.s34,
    borderRadius: RADIUS.s17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME_COLORS.errorBorder,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    backgroundColor: THEME_COLORS.successSurface,
  },
  badgeText: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary },
  suggestionItem: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.xxl,
    gap: SPACE.md,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
  },
  suggestionBody: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextDefault, lineHeight: LINE_HEIGHT.lg },
  suggestionReason: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.primary, fontWeight: FONT_WEIGHT.semibold },
  formTitle: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextStrong },
  input: {
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorderMuted,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.xl,
    fontSize: TYPE_SCALE.body,
    color: THEME_COLORS.neutralTextStrong,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.xxs,
  },
  switchLabel: { fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextEmphasis },
});