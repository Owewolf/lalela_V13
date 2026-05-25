import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { useCommunity } from '../../src/context/CommunityContext';

const PRIMARY = '#0d3d47';
const ERROR = '#dc2626';
const WARNING = '#d97706';

type IncidentType = 'emergency' | 'warning';

function isEmergencyPost(post: any): boolean {
  return post?.urgencyLevel === 'emergency' || post?.urgency === 'emergency';
}

function isWarningPost(post: any): boolean {
  return !isEmergencyPost(post) && (post?.urgencyLevel === 'warning' || post?.urgency === 'high');
}

function byNewest(a: any, b: any): number {
  const aTime = new Date(a?.createdAt || 0).getTime();
  const bTime = new Date(b?.createdAt || 0).getTime();
  return bTime - aTime;
}

function formatIncidentTime(value?: string): string {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmergencyIndexScreen() {
  const router = useRouter();
  const { posts } = useCommunity();

  const activeEmergencies = useMemo(
    () => (posts || []).filter(isEmergencyPost).slice().sort(byNewest),
    [posts]
  );
  const activeWarnings = useMemo(
    () => (posts || []).filter(isWarningPost).slice().sort(byNewest),
    [posts]
  );

  const activeIncidents = useMemo(
    () => [
      ...activeEmergencies.map((p: any) => ({ ...p, incidentType: 'emergency' as IncidentType })),
      ...activeWarnings.map((p: any) => ({ ...p, incidentType: 'warning' as IncidentType })),
    ],
    [activeEmergencies, activeWarnings]
  );

  const hasEmergencies = activeEmergencies.length > 0;
  const hasWarnings = activeWarnings.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/' as any);
          }}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Active Security Incidents</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, hasEmergencies && styles.summaryEmergency]}>
          <Text style={styles.summaryLabel}>Emergencies</Text>
          <Text style={[styles.summaryValue, hasEmergencies && { color: ERROR }]}>{activeEmergencies.length}</Text>
        </View>
        <View style={[styles.summaryCard, !hasEmergencies && hasWarnings && styles.summaryWarning]}>
          <Text style={styles.summaryLabel}>Warnings</Text>
          <Text style={[styles.summaryValue, hasWarnings && { color: WARNING }]}>{activeWarnings.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeIncidents.length === 0 ? (
          <View style={styles.emptyState}>
            <TriangleAlert size={24} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No active incidents</Text>
            <Text style={styles.emptyCopy}>Warnings and emergencies will appear here.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {activeIncidents.map((incident: any) => {
              const isEmergency = incident.incidentType === 'emergency';
              const accent = isEmergency ? ERROR : WARNING;
              return (
                <TouchableOpacity
                  key={incident.id}
                  style={[styles.row, isEmergency ? styles.rowEmergency : styles.rowWarning]}
                  onPress={() => router.push(`/emergency/${incident.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.iconWrap, { backgroundColor: isEmergency ? '#fef2f2' : '#fffbeb' }]}>
                    <AlertTriangle size={16} color={accent} />
                  </View>
                  <View style={styles.rowMain}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{incident.title || (isEmergency ? 'Emergency alert' : 'Warning notice')}</Text>
                    <Text numberOfLines={1} style={styles.rowMeta}>{incident.locationName || 'Unknown location'}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <View style={[styles.badge, { backgroundColor: isEmergency ? '#fef2f2' : '#fffbeb' }]}>
                      <Text style={[styles.badgeText, { color: accent }]}>{isEmergency ? 'EMERGENCY' : 'WARNING'}</Text>
                    </View>
                    <Text style={[styles.rowTime, { color: accent }]}>{formatIncidentTime(incident.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '900', color: PRIMARY },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryEmergency: { borderColor: '#fecaca' },
  summaryWarning: { borderColor: '#fde68a' },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '900',
    color: PRIMARY,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  listWrap: { gap: 10 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowEmergency: { borderColor: '#fecaca' },
  rowWarning: { borderColor: '#fde68a' },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rowMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowTime: { fontSize: 10, fontWeight: '700' },
  emptyState: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptyCopy: { fontSize: 13, color: '#64748b' },
});
