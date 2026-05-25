import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, Building2, ShieldCheck, Store } from 'lucide-react-native';

const PRIMARY = '#0d3d47';
const WARNING = '#d97706';

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
          <View style={[styles.iconWrap, { backgroundColor: '#0284c7' + '15' }]}>
            <Store size={18} color="#0284c7" />
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
          <View style={[styles.iconWrap, { backgroundColor: '#16a34a' + '15' }]}>
            <Building2 size={18} color="#16a34a" />
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
  container: { gap: 10 },
  heading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  listWrap: {
    gap: 6,
  },
  rowItem: {
    gap: 2,
  },
  tapRow: {
    borderRadius: 10,
    paddingVertical: 2,
  },
  listPrimary: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
  },
  listMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillEmergency: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  pillWarning: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
  },
});

export default CommunityInsightPanels;
