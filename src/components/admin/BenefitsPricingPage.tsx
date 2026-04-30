import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  X,
  Star,
  Shield,
  Zap,
  BarChart3,
  Users,
  Store,
  Crown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#0d3d47';
const SECONDARY = '#7c3aed';
const ERROR = '#dc2626';

interface BenefitsPricingPageProps {
  onBack?: () => void;
  onUpgrade?: () => void;
}

const BenefitsPricingPage: React.FC<BenefitsPricingPageProps> = ({ onBack, onUpgrade }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const handleUpgrade = () => {
    if (onUpgrade) onUpgrade();
    else router.push('/checkout');
  };

  const benefits = [
    {
      icon: Zap,
      title: 'Platform Power',
      items: [
        'Lifetime, uninterrupted access',
        'No read-only restrictions',
        'Full platform functionality unlocked',
      ],
    },
    {
      icon: Users,
      title: 'Community Leadership',
      items: [
        'Create a community for R999 once-off',
        'Each community gets a full 30-day trial first',
        'Lead members, roles, content, and growth',
      ],
    },
    {
      icon: BarChart3,
      title: 'Advanced Insights',
      items: [
        'Track engagement and growth',
        'Monitor notices and activity',
        'Understand your community dynamics',
      ],
    },
    {
      icon: Star,
      title: 'Fair, Simple Pricing',
      items: [
        'Pay once, belong for life',
        'No subscriptions and no renewals',
        'Trials only delay payment, never change pricing',
      ],
    },
    {
      icon: Store,
      title: 'Business Advantage',
      items: [
        'Better visibility for businesses',
        'Enhanced listing control',
        'Stronger local ecosystem influence',
      ],
    },
  ];

  const membershipFeatures = [
    'Includes lifetime platform membership after payment',
    '1-year membership trial remains active before payment is required',
    'Join, engage, and participate in communities',
    'No recurring fees',
  ];

  const communityFeatures = [
    'Create a new community with full ownership and controls',
    'Automatically includes lifetime membership',
    'Each community has its own 30-day trial before payment is enforced',
    'Every additional community is R999 once-off',
  ];

  const comparison = [
    { feature: 'Join Communities', free: true, licensed: true },
    { feature: 'Membership Access', free: '1-year trial', licensed: 'R149 once-off' },
    { feature: 'Create Community', free: '30-day trial', licensed: 'R999 once-off' },
    { feature: 'Community Ownership', free: false, licensed: true },
    { feature: 'Access Duration', free: 'Trial-limited', licensed: 'Pay once, lifetime' },
    { feature: 'Extra Communities', free: false, licensed: 'R999 each' },
    { feature: 'Recurring Fees', free: 'None', licensed: 'None' },
  ];

  const renderCheckOrX = (val: boolean | string, isLicensed: boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <Check size={16} color="#fc7127" />
      ) : (
        <X size={16} color={ERROR} />
      );
    }
    return (
      <Text style={[styles.tableValue, isLicensed && { color: '#fc7127' }]}>
        {val}
      </Text>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky header */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={PRIMARY} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Own Your Community.{'\n'}
            <Text style={{ color: SECONDARY }}>Stay Connected for Life.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Start with free trials, then pay once for lifetime access: R149 for membership or R999
            to create and lead a community.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.primaryCta} onPress={handleUpgrade} activeOpacity={0.85}>
              <Text style={styles.primaryCtaText}>Get Membership for R149</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryCta} onPress={handleBack} activeOpacity={0.85}>
              <Text style={styles.secondaryCtaText}>Join a Community</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          {/* Membership tier */}
          <View style={styles.pricingRow}>
            <View style={styles.pricingIconWrap}>
              <Crown size={28} color="#fc7127" />
            </View>
            <View style={styles.pricingInfo}>
              <Text style={styles.pricingTierTitle}>Membership Only</Text>
              <Text style={styles.pricingTierSub}>ONCE-OFF PAYMENT</Text>
            </View>
            <Text style={styles.pricingAmount}>R149</Text>
          </View>

          {membershipFeatures.map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <Check size={14} color="#fc7127" />
              </View>
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Community tier */}
          <View style={styles.pricingRow}>
            <View style={styles.pricingInfo}>
              <Text style={styles.pricingTierTitle}>Community Creation (Includes Membership)</Text>
            </View>
            <Text style={styles.pricingAmount}>R999</Text>
          </View>

          {communityFeatures.map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <Check size={14} color="#fc7127" />
              </View>
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Rules */}
        <View style={styles.rulesSection}>
          <View style={styles.rulesSectionHeader}>
            <Shield size={24} color={PRIMARY} />
            <Text style={styles.rulesSectionTitle}>Key Licensing Rules</Text>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleCardTitle}>Membership (R149 once-off) gives you:</Text>
            <Text style={styles.ruleCardBullet}>• Lifetime platform access after payment</Text>
            <Text style={styles.ruleCardBullet}>• A separate 1-year trial before payment is enforced</Text>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleCardTitle}>Community creation is R999 once-off</Text>
            <Text style={styles.ruleCardDesc}>
              Creating a community includes membership, and each community keeps its own 30-day
              trial.
            </Text>
          </View>

          <View style={styles.ruleGridRow}>
            <View style={styles.ruleGridCard}>
              <Text style={styles.ruleGridLabel}>MEMBERSHIP</Text>
              <Text style={styles.ruleGridValue}>1-year trial, then R149 once-off for lifetime access</Text>
            </View>
            <View style={styles.ruleGridCard}>
              <Text style={styles.ruleGridLabel}>OWNERSHIP</Text>
              <Text style={styles.ruleGridValue}>30-day trial per community, then R999 once-off each</Text>
            </View>
          </View>
        </View>

        {/* Benefits Grid */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsSectionTitle}>Benefits of Membership and Leadership</Text>
          {benefits.map((benefit, i) => (
            <View key={i} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <benefit.icon size={24} color={PRIMARY} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                {benefit.items.map((item, j) => (
                  <View key={j} style={styles.benefitBullet}>
                    <View style={styles.benefitDot} />
                    <Text style={styles.benefitBulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Comparison Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableSectionTitle}>Free vs Licensed</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>FEATURE</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>FREE</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>LICENSED</Text>
            </View>
            {comparison.map((row, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{row.feature}</Text>
                <View style={[styles.tableCellCenter, { flex: 1 }]}>
                  {renderCheckOrX(row.free, false)}
                </View>
                <View style={[styles.tableCellCenter, { flex: 1 }]}>
                  {renderCheckOrX(row.licensed, true)}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Final CTA */}
        <View style={styles.finalCta}>
          <Text style={styles.finalCtaTitle}>Pay Once. Belong for Life.</Text>
          <Text style={styles.finalCtaSubtitle}>
            Keep it simple: R149 once-off for membership, or R999 once-off to create and lead a
            community. No subscriptions, no renewals.
          </Text>
          <TouchableOpacity style={styles.finalCtaBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Text style={styles.finalCtaBtnText}>Start with Membership - R149</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

export default BenefitsPricingPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  stickyHeader: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 32 },

  // Hero
  heroSection: { alignItems: 'center', gap: 16, paddingTop: 16 },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: PRIMARY,
    textAlign: 'center',
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  heroButtons: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
  primaryCta: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryCtaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryCta: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: PRIMARY,
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Pricing card
  pricingCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.3)',
    padding: 24,
    backgroundColor: '#f8fafc',
    gap: 12,
    shadowColor: '#fc7127',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pricingIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingInfo: { flex: 1 },
  pricingTierTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  pricingTierSub: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fc7127',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  pricingAmount: { fontSize: 28, fontWeight: '900', color: PRIMARY },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  featureText: { flex: 1, fontSize: 13, color: '#475569', fontWeight: '500', lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 8 },

  // Rules
  rulesSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  rulesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rulesSectionTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  ruleCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  ruleCardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  ruleCardBullet: { fontSize: 12, color: '#475569', fontWeight: '500', lineHeight: 18 },
  ruleCardDesc: { fontSize: 12, color: '#475569', fontWeight: '500', lineHeight: 18 },
  ruleGridRow: { flexDirection: 'row', gap: 12 },
  ruleGridCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  ruleGridLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ruleGridValue: { fontSize: 12, fontWeight: '700', color: '#0f172a', lineHeight: 17 },

  // Benefits
  benefitsSection: { gap: 16 },
  benefitsSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: PRIMARY,
    textAlign: 'center',
  },
  benefitCard: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(22,163,74,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitContent: { flex: 1, gap: 8 },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  benefitBullet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(22,163,74,0.3)' },
  benefitBulletText: { fontSize: 12, color: '#475569', fontWeight: '500', flex: 1, lineHeight: 18 },

  // Table
  tableSection: { gap: 16 },
  tableSectionTitle: { fontSize: 22, fontWeight: '900', color: PRIMARY, textAlign: 'center' },
  table: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  tableRowAlt: { backgroundColor: '#fafafa' },
  tableCell: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  tableCellCenter: { alignItems: 'center', justifyContent: 'center' },
  tableValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Final CTA
  finalCta: {
    backgroundColor: PRIMARY,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  finalCtaTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center' },
  finalCtaSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  finalCtaBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  finalCtaBtnText: {
    color: PRIMARY,
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
