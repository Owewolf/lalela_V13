import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  Plus,
  Sparkles,
  CheckCircle2,
  Star,
  Globe,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { useCommunity } from '../../context/CommunityContext';
import { BUSINESS_CATEGORIES as CATEGORIES } from '../../constants';
import { Business } from '../../types';
import { cn } from '../../lib/utils';
import api from '../../lib/api';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';
import { getCardBorderColor, getCardSurfaceColor } from '../../theme/cardStyles';

const PRIMARY = THEME_COLORS.primary;
const SECONDARY = THEME_COLORS.secondaryContainer;
const SURFACE = THEME_COLORS.surface;
const SURFACE_LOW = THEME_COLORS.surfaceContainerLow;
const TYPE_SCALE = {
  sm: 9,
  md: 10,
  base: 11,
  body: 12,
  lg: 13,
  xl: 14,
  xxl: 15,
  title: 16,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  zero: 0,
  xxs: 2,
  xs: 4,
  s5: 5,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  s11: 11,
  s16: 16,
  s24: 24,
  s40: 40,
  s46: 46,
  s72: 72,
  s140: 140,
  s100: 100,
};
const RADIUS = {
  sm: 6,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 20,
  capsule: 24,
  full: 100,
};

interface BusinessImportToolProps {
  onBack: () => void;
}

export const BusinessImportTool: React.FC<BusinessImportToolProps> = ({ onBack }) => {
  const { currentCommunity, bulkAddCommunityBusinesses } = useCommunity() as any;
  const [categorySearch, setCategorySearch] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<Business[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const coverageArea = currentCommunity?.coverageArea;

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return CATEGORIES;
    const q = categorySearch.toLowerCase();
    return CATEGORIES.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.types.some((t: string) => t.toLowerCase().includes(q))
    );
  }, [categorySearch]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addCustomCategory = () => {
    const cat = customCategory.trim();
    if (!cat) return;
    if (!selectedCategories.includes(cat)) setSelectedCategories(prev => [...prev, cat]);
    setCustomCategory('');
  };

  const handleSearch = async () => {
    if (!coverageArea) {
      setError('Community coverage area not set.');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Please select at least one category.');
      return;
    }

    setIsSearching(true);
    setError(null);

    const selectedTypes = selectedCategories.flatMap(id => {
      const cat = CATEGORIES.find((c: any) => c.id === id);
      return cat ? cat.types : [id];
    });

    try {
      const { data } = await api.post('/places-search', {
        categoryTypes: selectedTypes,
        lat: coverageArea.latitude,
        lng: coverageArea.longitude,
        radius: coverageArea.radius,
      });

      const businesses: Business[] = (data as any[]).map(b => ({
        id: `google_${Math.random().toString(36).substr(2, 9)}`,
        name: b.name,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        rating: b.rating,
        category: b.category || selectedCategories[0],
        description: undefined,
        phone: b.phone,
        website: b.website,
        status: 'Open' as const,
        isExternal: true,
        image: `https://picsum.photos/seed/${encodeURIComponent(b.name)}/400/300`,
      }));
      setResults(businesses);
    } catch (err: any) {
      setError(err?.message || 'Search failed. Check your server connection and API key.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setIsImporting(true);
    try {
      const toImport = results
        .filter(r => selectedIds.has(r.id))
        .map(r => ({
          name: r.name,
          category: r.category,
          description: r.description ?? undefined,
          address: r.address ?? undefined,
          latitude: r.latitude ?? undefined,
          longitude: r.longitude ?? undefined,
          phone: (r as any).phone ?? undefined,
          website: (r as any).website ?? undefined,
          image_url: r.image ?? undefined,
        }));

      await bulkAddCommunityBusinesses(currentCommunity.id, toImport);
      Alert.alert('Imported!', `${toImport.length} business(es) added to ${currentCommunity.name} and made visible in Marketplace.`);
      onBack();
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'An error occurred.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: SURFACE }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Smart Business Import</Text>
          <Text style={styles.headerSub}>AI-powered discovery via Gemini</Text>
        </View>
        {coverageArea && (
          <View style={styles.coveragePill}>
            <Text style={styles.coverageText} numberOfLines={1}>
              📍 {coverageArea.location_name} ({coverageArea.radius}km)
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.s16, gap: SPACE.s16, paddingBottom: SPACE.s100 }}>

        {/* Category search */}
        <View style={styles.searchRow}>
          <Search size={16} color={THEME_COLORS.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter categories..."
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            value={categorySearch}
            onChangeText={setCategorySearch}
          />
          {categorySearch ? (
            <TouchableOpacity onPress={() => setCategorySearch('')}>
              <X size={16} color={THEME_COLORS.outline} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Selected chips */}
        {selectedCategories.length > 0 && (
          <View style={styles.chipRow}>
            {selectedCategories.map(id => {
              const cat = CATEGORIES.find((c: any) => c.id === id);
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.chip}
                  onPress={() => toggleCategory(id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{cat ? `${cat.icon} ${cat.label}` : id}</Text>
                  <X size={10} color={THEME_COLORS.white} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setSelectedCategories([])}>
              <Text style={styles.clearAll}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category grid */}
        <View style={styles.grid}>
          {filteredCategories.map((cat: any) => {
            const active = selectedCategories.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catBtn, active && styles.catBtnActive]}
                onPress={() => toggleCategory(cat.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom category */}
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Add custom place type (e.g. 'park')..."
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            value={customCategory}
            onChangeText={setCustomCategory}
            onSubmitEditing={addCustomCategory}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !customCategory.trim() && { opacity: 0.4 }]}
            onPress={addCustomCategory}
            disabled={!customCategory.trim()}
            activeOpacity={0.8}
          >
            <Plus size={18} color={THEME_COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Scan button */}
        <TouchableOpacity
          style={[styles.scanBtn, (isSearching || selectedCategories.length === 0) && { opacity: 0.5 }]}
          onPress={handleSearch}
          disabled={isSearching || selectedCategories.length === 0}
          activeOpacity={0.85}
        >
          {isSearching ? (
            <ActivityIndicator color={THEME_COLORS.white} size="small" />
          ) : (
            <Sparkles size={20} color={THEME_COLORS.white} />
          )}
          <Text style={styles.scanBtnText}>
            {isSearching ? 'Scanning...' : 'Scan & Discover Businesses'}
          </Text>
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <AlertCircle size={14} color={THEME_COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {results.length > 0 && (
          <View style={{ gap: SPACE.xl }}>
            <Text style={styles.sectionTitle}>
              Select Businesses to Import ({selectedIds.size} selected)
            </Text>
            {results.map(biz => {
              const selected = selectedIds.has(biz.id);
              return (
                <TouchableOpacity
                  key={biz.id}
                  style={[styles.bizCard, selected && styles.bizCardActive]}
                  onPress={() => toggleSelection(biz.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.bizImgWrap}>
                    <Image
                      source={{ uri: biz.image }}
                      style={styles.bizImg}
                      resizeMode="cover"
                    />
                    {selected && (
                      <View style={styles.bizImgOverlay}>
                        <CheckCircle2 size={28} color={THEME_COLORS.white} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: SPACE.xxs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={styles.bizName} numberOfLines={1}>{biz.name}</Text>
                      {biz.rating ? (
                        <View style={styles.ratingBadge}>
                          <Star size={10} color={THEME_COLORS.warningText} fill={THEME_COLORS.warningText} />
                          <Text style={styles.ratingText}>{biz.rating}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.bizCat}>{biz.category}</Text>
                    <Text style={styles.bizAddr} numberOfLines={2}>{biz.address}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {results.length === 0 && !isSearching && (
          <View style={styles.emptyState}>
            <Globe size={40} color={THEME_COLORS.outlineVariant} />
            <Text style={styles.emptyTitle}>No scan results</Text>
            <Text style={styles.emptyBody}>Select categories and scan your coverage area.</Text>
          </View>
        )}
      </ScrollView>

      {/* Import FAB */}
      {selectedIds.size > 0 && (
        <View style={styles.fabWrap}>
          <TouchableOpacity
            style={[styles.fab, isImporting && { opacity: 0.6 }]}
            onPress={handleImport}
            disabled={isImporting}
            activeOpacity={0.85}
          >
            {isImporting ? (
              <ActivityIndicator color={THEME_COLORS.white} size="small" />
            ) : (
              <Plus size={20} color={THEME_COLORS.white} />
            )}
            <Text style={styles.fabText}>
              Import {selectedIds.size} into "{currentCommunity?.name}"
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACE.s16,
    gap: SPACE.xl,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBorderSoft,
  },
  backBtn: { padding: SPACE.md, borderRadius: RADIUS.pill, backgroundColor: THEME_COLORS.surfaceContainerLow },
  headerTitle: { fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  headerSub: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.outline },
  coveragePill: {
    backgroundColor: THEME_COLORS.surface,
    borderWidth: 1,
    borderColor: THEME_COLORS.tertiaryFixed,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    maxWidth: SPACE.s140,
  },
  coverageText: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    gap: SPACE.md,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorderSoft,
  },
  searchInput: { flex: 1, fontSize: TYPE_SCALE.lg, color: THEME_COLORS.onSurface, padding: SPACE.zero },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: PRIMARY,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.s5,
    borderRadius: RADIUS.pill,
  },
  chipText: { color: THEME_COLORS.white, fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold },
  clearAll: { color: THEME_COLORS.outline, fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold, marginLeft: SPACE.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  catBtn: {
    width: '30%',
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: SURFACE_LOW,
    alignItems: 'center',
    gap: SPACE.xs,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorderSoft,
  },
  catBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  catIcon: { fontSize: RADIUS.pill },
  catLabel: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.outline, textAlign: 'center', textTransform: 'uppercase' },
  catLabelActive: { color: THEME_COLORS.white },
  customRow: { flexDirection: 'row', gap: SPACE.md },
  customInput: {
    flex: 1,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.s11,
    fontSize: TYPE_SCALE.lg,
    color: THEME_COLORS.onSurface,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorderSoft,
  },
  addBtn: {
    width: SPACE.s46,
    height: SPACE.s46,
    borderRadius: RADIUS.md,
    backgroundColor: SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
    backgroundColor: PRIMARY,
    paddingVertical: SPACE.s16,
    borderRadius: RADIUS.capsule,
    marginTop: SPACE.xs,
  },
  scanBtnText: { color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xxl },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: THEME_COLORS.errorSurfaceStrong,
    borderWidth: 1,
    borderColor: THEME_COLORS.errorBorder,
    borderRadius: RADIUS.md,
    padding: SPACE.xl,
  },
  errorText: { color: THEME_COLORS.error, fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.semibold, flex: 1 },
  sectionTitle: { fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  bizCard: {
    flexDirection: 'row',
    gap: SPACE.xl,
    backgroundColor: getCardSurfaceColor('default'),
    borderRadius: RADIUS.pill,
    padding: SPACE.xl,
    borderWidth: 1,
    borderColor: getCardBorderColor('default'),
  },
  bizCardActive: { borderColor: PRIMARY, borderWidth: 2 },
  bizImgWrap: { width: SPACE.s72, height: SPACE.s72, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: SURFACE_LOW },
  bizImg: { width: '100%', height: '100%' },
  bizImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME_COLORS.alias_rgba_13_61_71_0_5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bizName: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: PRIMARY, flex: 1 },
  bizCat: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.outline, textTransform: 'uppercase' },
  bizAddr: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextSoft },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    backgroundColor: THEME_COLORS.warningSurfaceAlt,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: RADIUS.sm,
  },
  ratingText: { fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.warningText },
  emptyState: { alignItems: 'center', paddingVertical: SPACE.s40, gap: SPACE.md },
  emptyTitle: { fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: PRIMARY, opacity: 0.5 },
  emptyBody: { fontSize: TYPE_SCALE.body, color: THEME_COLORS.neutralTextSoft, textAlign: 'center' },
  fabWrap: {
    position: 'absolute',
    bottom: SPACE.s24,
    left: SPACE.s16,
    right: SPACE.s16,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
    backgroundColor: SECONDARY,
    paddingVertical: SPACE.s16,
    borderRadius: RADIUS.full,
    ...createShadow(SECONDARY, SPACE.zero, SPACE.xs, 0.4, 12, 8),
  },
  fabText: { color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.bold, fontSize: TYPE_SCALE.xl },
});
