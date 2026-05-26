import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { useCommunity } from '../../src/context/CommunityContext';
import { THEME_COLORS } from '../../src/theme/colors';

const PRIMARY = THEME_COLORS.primary;
const ERROR = THEME_COLORS.error;
const WARNING = THEME_COLORS.warning;
const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 13,
  xl: 14,
  h1: 16,
  h2: 18,
  hero: 24,
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
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  xxxl: 16,
  s24: 24,
  s32: 32,
  s36: 36,
  s40: 40,
};
const RADIUS = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 99,
};
const LETTER_SPACING = {
  compact: 0.8,
};

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
            <TriangleAlert size={24} color={THEME_COLORS.neutralTextMuted} />
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
                  <View style={[styles.iconWrap, { backgroundColor: isEmergency ? THEME_COLORS.errorSurface : THEME_COLORS.warningSurface }]}>
                    <AlertTriangle size={16} color={accent} />
                  </View>
                  <View style={styles.rowMain}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{incident.title || (isEmergency ? 'Emergency alert' : 'Warning notice')}</Text>
                    <Text numberOfLines={1} style={styles.rowMeta}>{incident.locationName || 'Unknown location'}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <View style={[styles.badge, { backgroundColor: isEmergency ? THEME_COLORS.errorSurface : THEME_COLORS.warningSurface }]}>
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
  container: { flex: 1, backgroundColor: THEME_COLORS.neutralBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xxxl,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.lg,
    backgroundColor: THEME_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBorder,
  },
  backBtn: {
    width: SPACE.s36,
    height: SPACE.s36,
    borderRadius: RADIUS.md,
    backgroundColor: THEME_COLORS.neutralBgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xxxl,
    paddingTop: SPACE.xxl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.xxl,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorder,
  },
  summaryEmergency: { borderColor: THEME_COLORS.errorBorder },
  summaryWarning: { borderColor: THEME_COLORS.warningBorder },
  summaryLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.compact,
  },
  summaryValue: {
    marginTop: SPACE.xxs,
    fontSize: TYPE_SCALE.hero,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
  },
  content: {
    padding: SPACE.xxxl,
    paddingBottom: SPACE.s40,
  },
  listWrap: { gap: SPACE.xl },
  row: {
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACE.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
  },
  rowEmergency: { borderColor: THEME_COLORS.errorBorder },
  rowWarning: { borderColor: THEME_COLORS.warningBorder },
  iconWrap: {
    width: SPACE.s32,
    height: SPACE.s32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  rowMeta: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xxs },
  rowRight: { alignItems: 'flex-end', gap: SPACE.sm },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs },
  badgeText: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    letterSpacing: LETTER_SPACING.compact,
    textTransform: 'uppercase',
  },
  rowTime: { fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold },
  emptyState: {
    marginTop: SPACE.s24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.s36,
    borderRadius: RADIUS.xl,
    backgroundColor: THEME_COLORS.white,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorder,
    gap: SPACE.md,
  },
  emptyTitle: { fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextHeading },
  emptyCopy: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle },
});
