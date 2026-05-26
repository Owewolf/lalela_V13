import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, Building2, ShieldCheck, Store } from 'lucide-react-native';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

const PRIMARY = THEME_COLORS.primary;
const WARNING = THEME_COLORS.warning;
const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  body: 13,
  lg: 14,
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
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 14,
  s32: 32,
};
const RADIUS = {
  sm: 10,
  md: 16,
  full: 999,
};
const LETTER_SPACING = {
  compact: 0.6,
  normal: 1,
  wide: 1.2,
};

type InsightResponder = {
  id: string;
  name: string;
};

type InsightIncident = {
  id: string;
  title: string;
  location: string;
  kind: 'emergency' | 'warning';
  time: string;
};

type InsightListing = {
  id: string;
  title: string;
  meta: string;
};

type InsightBusiness = {
  id: string;
  name: string;
  meta: string;
};

interface Props {
  responders: InsightResponder[];
  incidents: InsightIncident[];
  listings: InsightListing[];
  businesses: InsightBusiness[];
  onResponderPress?: (responderId: string) => void;
  onIncidentPress?: (incidentId: string) => void;
  onListingPress?: (listingId: string) => void;
  onBusinessPress?: (businessId: string) => void;
}

export const CommunityInsightPanels: React.FC<Props> = ({
  responders,
  incidents,
  listings,
  businesses,
  onResponderPress,
  onIncidentPress,
  onListingPress,
  onBusinessPress,
}) => {
  const visibleResponders = responders.slice(0, 3);
  const responderOverflow = Math.max(0, responders.length - visibleResponders.length);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Community Insights</Text>
      <View style={styles.grid}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <ShieldCheck size={18} color={PRIMARY} />
          </View>
          <Text style={styles.label}>Security Responders</Text>
          {visibleResponders.length === 0 ? (
            <Text style={styles.emptyText}>No responders yet</Text>
          ) : (
            <View style={styles.listWrap}>
              {visibleResponders.map((responder) => (
                <TouchableOpacity
                  key={responder.id}
                  activeOpacity={0.75}
                  style={styles.tapRow}
                  onPress={() => onResponderPress?.(responder.id)}
                  disabled={!onResponderPress}
                >
                  <Text style={styles.listPrimary} numberOfLines={1}>
                    {responder.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {responderOverflow > 0 && (
                <Text style={styles.listMeta}>+{responderOverflow} more</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: WARNING + '15' }]}>
            <AlertTriangle size={18} color={WARNING} />
          </View>
          <Text style={styles.label}>Last 3 Emergencies & Warnings</Text>
          {incidents.length === 0 ? (
            <Text style={styles.emptyText}>No incidents yet</Text>
          ) : (
            <View style={styles.listWrap}>
              {incidents.map((incident) => (
                <TouchableOpacity
                  key={incident.id}
                  style={[styles.rowItem, styles.tapRow]}
                  activeOpacity={0.75}
                  onPress={() => onIncidentPress?.(incident.id)}
                  disabled={!onIncidentPress}
                >
                  <Text style={styles.listPrimary} numberOfLines={1}>
                    {incident.title}
                  </Text>
                  <Text
                    style={[
                      styles.pill,
                      incident.kind === 'emergency' ? styles.pillEmergency : styles.pillWarning,
                    ]}
                  >
                    {incident.kind === 'emergency' ? 'Emergency' : 'Warning'}
                  </Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {incident.location} • {incident.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: THEME_COLORS.aliasHex_0284c7 + '15' }]}>
            <Store size={18} color={THEME_COLORS.aliasHex_0284c7} />
          </View>
          <Text style={styles.label}>Last 3 Listings Made</Text>
          {listings.length === 0 ? (
            <Text style={styles.emptyText}>No listings yet</Text>
          ) : (
            <View style={styles.listWrap}>
              {listings.map((listing) => (
                <TouchableOpacity
                  key={listing.id}
                  style={[styles.rowItem, styles.tapRow]}
                  activeOpacity={0.75}
                  onPress={() => onListingPress?.(listing.id)}
                  disabled={!onListingPress}
                >
                  <Text style={styles.listPrimary} numberOfLines={1}>
                    {listing.title}
                  </Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {listing.meta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: THEME_COLORS.successStrong + '15' }]}>
            <Building2 size={18} color={THEME_COLORS.successStrong} />
          </View>
          <Text style={styles.label}>Last 3 Businesses Listed</Text>
          {businesses.length === 0 ? (
            <Text style={styles.emptyText}>No member businesses yet</Text>
          ) : (
            <View style={styles.listWrap}>
              {businesses.map((business) => (
                <TouchableOpacity
                  key={business.id}
                  style={[styles.rowItem, styles.tapRow]}
                  activeOpacity={0.75}
                  onPress={() => onBusinessPress?.(business.id)}
                  disabled={!onBusinessPress}
                >
                  <Text style={styles.listPrimary} numberOfLines={1}>
                    {business.name}
                  </Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {business.meta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: SPACE.xl },
  heading: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
    paddingHorizontal: SPACE.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.xl,
  },
  card: {
    width: '48.5%',
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACE.xxl,
    gap: SPACE.md,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
    ...createShadow(THEME_COLORS.black, SPACE.zero, 1, 0.04, 4, 1),
  },
  iconWrap: {
    width: SPACE.s32,
    height: SPACE.s32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
    marginTop: SPACE.sm,
  },
  listWrap: {
    gap: SPACE.md,
  },
  rowItem: {
    gap: SPACE.xxs,
  },
  tapRow: {
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.xxs,
  },
  listPrimary: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.extrabold,
    color: PRIMARY,
  },
  listMeta: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextSubtle,
  },
  emptyText: {
    fontSize: TYPE_SCALE.body,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextMuted,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.full,
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.compact,
  },
  pillEmergency: {
    backgroundColor: THEME_COLORS.aliasHex_fee2e2,
    color: THEME_COLORS.errorStrong,
  },
  pillWarning: {
    backgroundColor: THEME_COLORS.warningSurfaceAlt,
    color: THEME_COLORS.warning,
  },
});

export default CommunityInsightPanels;
