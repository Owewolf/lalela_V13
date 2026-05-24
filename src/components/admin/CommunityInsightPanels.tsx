import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MapPin, Tag, Users as UsersIcon, TrendingUp } from 'lucide-react-native';
import type { LiveInsightsData } from '../../hooks/useLiveInsights';

const PRIMARY = '#0d3d47';
const ACCENT = '#fc7127';
const SECONDARY = '#7c3aed';

type InsightCard = {
  key: string;
  label: string;
  value: string;
  Icon: React.ComponentType<any>;
  color: string;
};

interface Props {
  insights: LiveInsightsData['insights'] | null;
}

const ROTATE_MS = 6_000;

export const CommunityInsightPanels: React.FC<Props> = ({ insights }) => {
  const cards = useMemo<InsightCard[]>(() => {
    const list: InsightCard[] = [];
    if (insights?.mostActiveArea) {
      list.push({
        key: 'area',
        label: 'Most active area',
        value: insights.mostActiveArea,
        Icon: MapPin,
        color: PRIMARY,
      });
    }
    if (insights?.topCategory) {
      list.push({
        key: 'category',
        label: 'Top category',
        value: insights.topCategory,
        Icon: Tag,
        color: SECONDARY,
      });
    }
    list.push({
      key: 'volunteers',
      label: 'Active volunteers',
      value: String(insights?.activeVolunteers ?? 0),
      Icon: UsersIcon,
      color: ACCENT,
    });
    list.push({
      key: 'engagement',
      label: 'Engagement score',
      value: `${insights?.engagementScore ?? 0}/100`,
      Icon: TrendingUp,
      color: PRIMARY,
    });
    return list;
  }, [insights]);

  const [pairIndex, setPairIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cards.length <= 2) return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        setPairIndex((i) => (i + 2) % cards.length);
      }, 300);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [cards.length, fade]);

  if (cards.length === 0) return null;

  const visible = [cards[pairIndex % cards.length], cards[(pairIndex + 1) % cards.length]].filter(Boolean);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Community Insights</Text>
      <Animated.View style={[styles.row, { opacity: fade }]}>
        {visible.map((c) => (
          <View key={c.key} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: c.color + '15' }]}>
              <c.Icon size={18} color={c.color} />
            </View>
            <Text style={styles.label}>{c.label}</Text>
            <Text style={styles.value} numberOfLines={2}>{c.value}</Text>
          </View>
        ))}
      </Animated.View>
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
  row: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
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
  value: {
    fontSize: 15,
    fontWeight: '900',
    color: PRIMARY,
  },
});

export default CommunityInsightPanels;
