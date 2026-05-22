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

const PRIMARY = '#0d3d47';
const SECONDARY = '#fc7127';
const SURFACE = '#fff8f0';
const SURFACE_LOW = '#f4f3f1';

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>

        {/* Category search */}
        <View style={styles.searchRow}>
          <Search size={16} color="#737971" />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter categories..."
            placeholderTextColor="#9ca3af"
            value={categorySearch}
            onChangeText={setCategorySearch}
          />
          {categorySearch ? (
            <TouchableOpacity onPress={() => setCategorySearch('')}>
              <X size={16} color="#737971" />
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
                  <X size={10} color="#fff" />
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
            placeholderTextColor="#9ca3af"
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
            <Plus size={18} color="#fff" />
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
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Sparkles size={20} color="#fff" />
          )}
          <Text style={styles.scanBtnText}>
            {isSearching ? 'Scanning...' : 'Scan & Discover Businesses'}
          </Text>
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <AlertCircle size={14} color="#ba1a1a" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {results.length > 0 && (
          <View style={{ gap: 12 }}>
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
                        <CheckCircle2 size={28} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={styles.bizName} numberOfLines={1}>{biz.name}</Text>
                      {biz.rating ? (
                        <View style={styles.ratingBadge}>
                          <Star size={10} color="#b45309" fill="#b45309" />
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
            <Globe size={40} color="#c2c8bf" />
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
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Plus size={20} color="#fff" />
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
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, borderRadius: 20, backgroundColor: '#f4f3f1' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  headerSub: { fontSize: 11, color: '#737971' },
  coveragePill: {
    backgroundColor: '#fff8f0',
    borderWidth: 1,
    borderColor: '#ffddb9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    maxWidth: 140,
  },
  coverageText: { fontSize: 10, fontWeight: '700', color: PRIMARY },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1c1a', padding: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  clearAll: { color: '#737971', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: SURFACE_LOW,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  catBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  catIcon: { fontSize: 20 },
  catLabel: { fontSize: 9, fontWeight: '700', color: '#737971', textAlign: 'center', textTransform: 'uppercase' },
  catLabelActive: { color: '#fff' },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: '#1a1c1a',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 4,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: '#ba1a1a', fontSize: 12, fontWeight: '600', flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  bizCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bizCardActive: { borderColor: PRIMARY, borderWidth: 2 },
  bizImgWrap: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: SURFACE_LOW },
  bizImg: { width: '100%', height: '100%' },
  bizImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,61,71,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bizName: { fontSize: 13, fontWeight: '700', color: PRIMARY, flex: 1 },
  bizCat: { fontSize: 10, fontWeight: '700', color: '#737971', textTransform: 'uppercase' },
  bizAddr: { fontSize: 11, color: '#9ca3af' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 10, fontWeight: '900', color: '#b45309' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY, opacity: 0.5 },
  emptyBody: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  fabWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SECONDARY,
    paddingVertical: 16,
    borderRadius: 100,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
