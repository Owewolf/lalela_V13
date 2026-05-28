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
import { useCharityTotals } from '../../hooks/queries/useCharityTotals';
import type { Charity, CharitySuggestion, CatHubSummary } from '../../types';
import { resolveActiveCharity, isCatCharity as isCatCharityShared } from '../../lib/activeCharity';
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
  percentage: '15',
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
    typeof charity?.percentage === 'number' ? String(charity.percentage) : '15',
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
  const { data: charityTotals = [] } = useCharityTotals(currentCommunity?.id);

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

  const isCatCharity = (charity: any) => isCatCharityShared(charity);

  const resolution = useMemo(
    () => resolveActiveCharity(availableCharities, currentCommunity ?? null),
    [availableCharities, currentCommunity?.catCycleActive, currentCommunity?.catFeaturedCharityId]
  );

  const catCharity = resolution.cat;
  const featuredCharity = resolution.featured;
  const effectiveFeaturedCharity = resolution.active;

  const pendingSuggestions = useMemo(
    () => charitySuggestions.filter((suggestion) => suggestion.status === 'pending'),
    [charitySuggestions]
  );

  const charityTotalsMap = useMemo(
    () => new Map(charityTotals.map((item) => [item.charityId, item])),
    [charityTotals]
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
    if (!hasCommunity) {
      setCatHubSummary(null);
      return;
    }
    setCatHubLoading(true);
    getCatHub()
      .then((data) => setCatHubSummary(data))
      .catch(() => setCatHubSummary(null))
      .finally(() => setCatHubLoading(false));
  }, [hasCommunity, getCatHub]);

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
              : '15',
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

    const isCat = Boolean(selectedCharity?.isCATCharity);
    const parsedFundraisingGoal = charityForm.fundraisingGoal.trim()
      ? Number(charityForm.fundraisingGoal)
      : undefined;
    if (!isCat && (!Number.isFinite(parsedFundraisingGoal) || Number(parsedFundraisingGoal) <= 0)) {
      Alert.alert(
        'Fundraising goal required',
        'Enter a fundraising goal greater than R0 for this charity.'
      );
      return;
    }

    setSavingCharity(true);
    try {
      const coverage = currentCommunity?.coverageArea;
      const fundraisingGoal = isCat ? parsedFundraisingGoal : Number(parsedFundraisingGoal);

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
          : 'Public listing CAT earnings now route to CAT baseline charity when sold.'
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

        {canManageCharity ? (
          <View style={{ gap: SPACE.xl }}>
            <View style={styles.catCycleCard}>
              <View style={{ flex: 1, gap: SPACE.xs }}>
                <Text style={styles.listItemTitle}>CAT Charity Cycle</Text>
                <Text style={styles.listItemMeta}>
                  {currentCommunity?.catCycleActive
                    ? `Active${effectiveFeaturedCharity?.name ? ` • Pooling to ${effectiveFeaturedCharity.name}` : ''}`
                    : 'Switch off • CAT is the default community charity'}
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
                    Active charity: {effectiveFeaturedCharity?.name || 'CAT (default)'}
                  </Text>
                  {(() => {
                    const activeIsCat = !effectiveFeaturedCharity || isCatCharity(effectiveFeaturedCharity);
                    if (activeIsCat) {
                      return (
                        <View style={styles.progressBlock}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, styles.progressFillFull]} />
                          </View>
                          <Text style={styles.progressLabel}>
                            Total raised: R{Number(catHubSummary?.totalRaisedForCharity ?? 0).toLocaleString()}
                          </Text>
                        </View>
                      );
                    }

                    const activeTotals = effectiveFeaturedCharity?.id
                      ? charityTotalsMap.get(effectiveFeaturedCharity.id)
                      : null;
                    const raisedAmount = Number(
                      activeTotals?.raisedEarnings ?? effectiveFeaturedCharity?.raisedAmount ?? 0
                    );
                    const goal = Number(
                      activeTotals?.goalAmount ?? effectiveFeaturedCharity?.fundraisingGoal ?? 0
                    );
                    if (!Number.isFinite(goal) || goal <= 0) {
                      return (
                        <View style={styles.progressBlock}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: '0%' }]} />
                          </View>
                          <Text style={styles.progressLabelMuted}>
                            Set a fundraising goal to track progress.
                          </Text>
                        </View>
                      );
                    }

                    const pct = Math.max(0, Math.min(100, Math.round((raisedAmount / goal) * 100)));
                    return (
                      <View style={styles.progressBlock}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.progressLabel}>
                          R{raisedAmount.toLocaleString()} / R{goal.toLocaleString()} ({pct}%)
                        </Text>
                      </View>
                    );
                  })()}
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

            {availableCharities.length === 0 && pendingSuggestions.length === 0 ? (
              <View style={styles.listItem}>
                <View style={{ flex: 1, gap: SPACE.xs }}>
                  <View style={styles.inlineRow}>
                    <Text style={styles.listItemTitle}>CAT Charity Cycle</Text>
                    <View style={styles.badge}>
                      <Sparkles size={11} color={THEME_COLORS.primary} />
                      <Text style={styles.badgeText}>Default</Text>
                    </View>
                  </View>
                  <Text style={styles.listItemMeta}>
                    CAT remains active by default. Add charities to route CAT funds to a featured cause.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {[...availableCharities]
                  .sort((a, b) => {
                    const aCat = isCatCharity(a) ? 0 : 1;
                    const bCat = isCatCharity(b) ? 0 : 1;
                    if (aCat !== bCat) return aCat - bCat;
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .map((charity) => {
                    const isActive = charity.id === effectiveFeaturedCharity?.id;
                    const isFeaturedCandidate = Boolean(charity.isFeatured) && !isCatCharity(charity);
                    const rowTotals = charityTotalsMap.get(charity.id);
                    const raisedAmount = Number(rowTotals?.raisedEarnings ?? charity.raisedAmount ?? 0);
                    return (
                      <View
                        key={charity.id}
                        style={[styles.listItem, isActive && styles.listItemFeatured]}
                      >
                        <View style={{ flex: 1, gap: SPACE.xs }}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.listItemTitle}>{charity.name}</Text>
                            {isCatCharity(charity) && (
                              <View style={styles.badge}>
                                <CheckCircle2 size={11} color={THEME_COLORS.primary} />
                                <Text style={styles.badgeText}>CAT</Text>
                              </View>
                            )}
                            {isFeaturedCandidate && (
                              <View style={styles.badge}>
                                <ShieldCheck size={11} color={THEME_COLORS.primary} />
                                <Text style={styles.badgeText}>Featured</Text>
                              </View>
                            )}
                            {isActive && (
                              <View style={styles.badge}>
                                <Sparkles size={11} color={THEME_COLORS.primary} />
                                <Text style={styles.badgeText}>Active</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.listItemMeta}>
                            {charity.percentage}% impact
                            {` • R${raisedAmount.toLocaleString()} raised`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => openAdminForm(charity, null)}
                          style={styles.inlineButton}
                        >
                          <Text style={styles.inlineButtonText}>Edit</Text>
                        </TouchableOpacity>
                        {!isCatCharity(charity) && (
                          <TouchableOpacity
                            onPress={() => handleArchiveCharity(charity)}
                            style={styles.iconButton}
                          >
                            <Trash2 size={15} color={THEME_COLORS.errorStrong} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                {pendingSuggestions.map((suggestion) => (
                  <View key={`suggestion-${suggestion.id}`} style={styles.listItem}>
                    <View style={{ flex: 1, gap: SPACE.xs }}>
                      <View style={styles.inlineRow}>
                        <Text style={styles.listItemTitle}>{suggestion.name}</Text>
                        <View style={styles.badge}>
                          <Sparkles size={11} color={THEME_COLORS.primary} />
                          <Text style={styles.badgeText}>Suggested</Text>
                        </View>
                      </View>
                      <Text style={styles.listItemMeta}>
                        Suggested by {suggestion.suggestedByName} at{' '}
                        {suggestion.suggestedDonationAmount ?? 0}%
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openAdminForm(null, suggestion)}
                      style={styles.inlineButton}
                    >
                      <Text style={styles.inlineButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRejectSuggestion(suggestion)}
                      style={styles.iconButton}
                    >
                      <Trash2 size={15} color={THEME_COLORS.errorStrong} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.overviewStack}>
              <View style={styles.catOverviewCard}>
                <View style={styles.cardIconWrap}>
                  <Sparkles size={20} color={THEME_COLORS.primary} />
                </View>
                <View style={{ flex: 1, gap: SPACE.s3 }}>
                  <Text style={styles.cardTitle}>CAT Charity Cycle</Text>
                  <Text style={styles.cardDescription}>
                    {currentCommunity?.catCycleActive
                      ? `Active${effectiveFeaturedCharity?.name ? ` • Pooling to ${effectiveFeaturedCharity.name}` : ''}`
                      : 'Switch off • CAT is the default community charity'}
                  </Text>
                  {catHubLoading ? (
                    <Text style={styles.cardDescription}>Loading CAT totals...</Text>
                  ) : (
                    <Text style={styles.cardDescription}>
                      Total CAT: R{Number(catHubSummary?.totalCATGenerated ?? 0).toLocaleString()} • Raised: R{Number(catHubSummary?.totalRaisedForCharity ?? 0).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.featuredOverviewCard,
                  effectiveFeaturedCharity ? styles.featuredOverviewCardActive : styles.featuredOverviewCardDefault,
                ]}
              >
                <View style={styles.cardIconWrap}>
                  <HeartHandshake size={20} color={THEME_COLORS.primary} />
                </View>
                <View style={{ flex: 1, gap: SPACE.s3 }}>
                  <Text style={styles.cardTitle}>
                    {effectiveFeaturedCharity?.name || 'CAT (Default Charity)'}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {effectiveFeaturedCharity
                      ? `${effectiveFeaturedCharity.percentage}% impact • R${Number(
                          charityTotalsMap.get(effectiveFeaturedCharity.id)?.raisedEarnings
                          ?? effectiveFeaturedCharity.raisedAmount
                          ?? 0
                        ).toLocaleString()} raised`
                      : 'No featured charity selected yet. CAT is shown by default.'}
                  </Text>
                </View>
                {effectiveFeaturedCharity ? (
                  <View style={styles.badge}>
                    <ShieldCheck size={11} color={THEME_COLORS.primary} />
                    <Text style={styles.badgeText}>Featured</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.overviewActionRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={() => setShowSuggestModal(true)}
              >
                <Text style={styles.primaryButtonText}>Suggest Charity</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Modal visible={showManager && adminView === 'form'} animationType="slide" transparent onRequestClose={closeManager}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedSuggestion
                    ? `Approve ${selectedSuggestion.name}`
                    : selectedCharity
                    ? 'Edit Charity'
                    : 'Add Charity'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedSuggestion
                    ? 'Review the suggestion and approve it as a community charity.'
                    : 'Update charity details and featured selection.'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeManager} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: SPACE.xl, paddingBottom: SPACE.s20 }}>
              {adminView === 'form' && (
                <View style={{ gap: SPACE.xl }}>
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
                    placeholder="Donation percentage (default 15%)"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.fundraisingGoal}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, fundraisingGoal: value }))
                    }
                    placeholder="Fundraising goal (R)"
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
                    placeholder="Tags (comma separated)"
                    placeholderTextColor={THEME_COLORS.neutralTextMuted}
                  />
                  <View style={styles.featuredCard}>
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featuredCardTitle}>Featured charity</Text>
                        <Text style={styles.listItemMeta}>
                          Marks this charity as the candidate. It only becomes the community's
                          active charity once the CAT Charity Cycle switch is turned on.
                        </Text>
                      </View>
                      <Switch
                        value={charityForm.isFeatured}
                        onValueChange={(value) =>
                          setCharityForm((current) => ({ ...current, isFeatured: value }))
                        }
                        trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                        thumbColor={THEME_COLORS.white}
                      />
                    </View>
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
                      onPress={closeManager}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
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
  overviewStack: {
    gap: SPACE.md,
  },
  overviewActionRow: {
    flexDirection: 'row',
    gap: SPACE.md,
  },
  catOverviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxl,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    padding: SPACE.s16,
  },
  featuredOverviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACE.s16,
  },
  featuredOverviewCardActive: {
    backgroundColor: THEME_COLORS.successSurface,
    borderColor: THEME_COLORS.tertiaryFixed,
  },
  featuredOverviewCardDefault: {
    backgroundColor: THEME_COLORS.neutralBg,
    borderColor: THEME_COLORS.overlayBorderSoft,
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
  listItemFeatured: {
    backgroundColor: THEME_COLORS.successSurface,
    borderColor: THEME_COLORS.tertiaryFixed,
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
  progressBlock: {
    gap: SPACE.xs,
    marginTop: SPACE.xs,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: THEME_COLORS.neutralBorderMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: THEME_COLORS.primary,
  },
  progressFillFull: {
    width: '100%',
  },
  progressLabel: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.neutralTextStrong,
    fontWeight: FONT_WEIGHT.semibold,
  },
  progressLabelMuted: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.neutralTextSubtle,
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
    gap: SPACE.xl,
  },
  switchLabel: { fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextEmphasis },
  featuredCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: THEME_COLORS.primary,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.xl,
    backgroundColor: THEME_COLORS.successSurface,
  },
  featuredCardTitle: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.extrabold,
    color: THEME_COLORS.primary,
    marginBottom: SPACE.xs,
  },
});