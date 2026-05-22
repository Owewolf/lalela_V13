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
import type { Charity, CharitySuggestion } from '../../types';

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
  } = useCommunity();

  const canManageCharity =
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
            <HeartHandshake size={20} color="#0d3d47" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
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
            <ChevronRight size={16} color="#94a3b8" />
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

            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              {adminView === 'list' && (
                <>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => openAdminForm(null, null)}
                    activeOpacity={0.85}
                  >
                    <Plus size={16} color="#fff" />
                    <Text style={styles.primaryButtonText}>Add Charity</Text>
                  </TouchableOpacity>

                  {availableCharities.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Sparkles size={18} color="#94a3b8" />
                      <Text style={styles.emptyStateTitle}>No charities yet</Text>
                      <Text style={styles.emptyStateBody}>
                        Create the first charity for this community or approve a member suggestion.
                      </Text>
                    </View>
                  ) : (
                    availableCharities.map((charity) => (
                      <View key={charity.id} style={styles.listItem}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={styles.inlineRow}>
                            <Text style={styles.listItemTitle}>{charity.name}</Text>
                            {charity.isFeatured && (
                              <View style={styles.badge}>
                                <ShieldCheck size={11} color="#0d3d47" />
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
                          <Trash2 size={15} color="#dc2626" />
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
                      <Sparkles size={18} color="#94a3b8" />
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
                          placeholderTextColor="#94a3b8"
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
                <View style={{ gap: 12 }}>
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
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={charityForm.description}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, description: value }))
                    }
                    placeholder="Charity description"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.percentage}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, percentage: value }))
                    }
                    placeholder="Donation percentage"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.fundraisingGoal}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, fundraisingGoal: value }))
                    }
                    placeholder="Fundraising goal (optional)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.website}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, website: value }))
                    }
                    placeholder="Website"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.contactEmail}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, contactEmail: value }))
                    }
                    placeholder="Contact email"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.contactPhone}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, contactPhone: value }))
                    }
                    placeholder="Contact phone"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.logo}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, logo: value }))
                    }
                    placeholder="Logo URL"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.coverImage}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, coverImage: value }))
                    }
                    placeholder="Cover image URL"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    value={charityForm.tags}
                    onChangeText={(value) =>
                      setCharityForm((current) => ({ ...current, tags: value }))
                    }
                    placeholder="Tags separated by commas"
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Featured charity</Text>
                    <Switch
                      value={charityForm.isFeatured}
                      onValueChange={(value) =>
                        setCharityForm((current) => ({ ...current, isFeatured: value }))
                      }
                      trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                  {selectedSuggestion && (
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      value={reviewFeedback}
                      onChangeText={setReviewFeedback}
                      placeholder="Optional approval feedback"
                      placeholderTextColor="#94a3b8"
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
                        <ActivityIndicator color="#fff" />
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

            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <TextInput
                style={styles.input}
                value={suggestionForm.name}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, name: value }))
                }
                placeholder="Charity name"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={suggestionForm.description}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, description: value }))
                }
                placeholder="What is their mission?"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={styles.input}
                value={suggestionForm.amount}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, amount: value }))
                }
                placeholder="Suggested percentage"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                value={suggestionForm.website}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, website: value }))
                }
                placeholder="Website"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={suggestionForm.reason}
                onChangeText={(value) =>
                  setSuggestionForm((current) => ({ ...current, reason: value }))
                }
                placeholder="Why should the community support them?"
                placeholderTextColor="#94a3b8"
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
                    <ActivityIndicator color="#fff" />
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
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cardDescription: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d3d47',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0d3d47' },
  modalSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  closeButtonText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: '#0d3d47' },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  tabButtonTextActive: { color: '#fff' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d3d47',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
  },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: '#e0f2fe',
  },
  secondaryButtonText: { color: '#0369a1', fontSize: 12, fontWeight: '800' },
  destructiveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: '#fee2e2',
  },
  destructiveButtonText: { color: '#dc2626', fontSize: 12, fontWeight: '800' },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: { color: '#374151', fontSize: 12, fontWeight: '800' },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 18,
    gap: 6,
    backgroundColor: '#f9fafb',
  },
  emptyStateTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  emptyStateBody: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    backgroundColor: '#fff',
  },
  listItemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  listItemMeta: { fontSize: 11, color: '#6b7280' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
  },
  inlineButtonText: { color: '#2563eb', fontSize: 11, fontWeight: '800' },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ecfdf5',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#0d3d47' },
  suggestionItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    gap: 8,
    backgroundColor: '#fff',
  },
  suggestionBody: { fontSize: 12, color: '#4b5563', lineHeight: 18 },
  suggestionReason: { fontSize: 12, color: '#0d3d47', fontWeight: '600' },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  switchLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
});