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
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

const PRIMARY = THEME_COLORS.primary;
const SECONDARY = THEME_COLORS.brandPurple;
const ERROR = THEME_COLORS.error;
const TYPE_SCALE = {
  sm: 9,
  md: 10,
  base: 12,
  body: 13,
  lg: 14,
  xl: 15,
  xxl: 16,
  title: 18,
  h2: 22,
  h1: 24,
  jumbo: 28,
  hero: 32,
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
  s1: 1,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  s16: 16,
  s17: 17,
  s20: 20,
  s24: 24,
  s28: 28,
  s32: 32,
  s40: 40,
  s48: 48,
};
const RADIUS = {
  dot: 2,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
const LINE_HEIGHT = {
  body: 20,
  compact: 17,
  dense: 18,
  subtitle: 22,
  hero: 40,
};
const LETTER_SPACING = {
  normal: 1,
};

interface BenefitsPricingPageProps {
  onBack?: () => void;
  onUpgrade?: () => void;
}

const BenefitsPricingPage: React.FC<BenefitsPricingPageProps> = ({ onBack, onUpgrade }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) onBack();
    else { if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/admin'); else router.replace('/admin'); }
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
        '1-year free trial included on signup',
        'Full platform functionality during trial',
        'Continue for R99/year after trial ends',
      ],
    },
    {
      icon: Users,
      title: 'Community Leadership',
      items: [
        'Start a community for R999 once-off',
        '30-day free trial before payment is required',
        'Community stays live permanently once activated',
      ],
    },
    {
      icon: BarChart3,
      title: 'Advanced Insights',
      items: [
        'Track engagement and community growth',
        'Monitor notices and platform activity',
        'Understand your community dynamics',
      ],
    },
    {
      icon: Star,
      title: 'Simple, Transparent Pricing',
      items: [
        'Community: R999 once-off, permanent activation',
        'Membership: R99/year after 1-year free trial',
        'No hidden fees, no complex tiers',
      ],
    },
    {
      icon: Store,
      title: 'Business Advantage',
      items: [
        'Enhanced marketplace visibility',
        'Full listing control and management',
        'Stronger local ecosystem influence',
      ],
    },
  ];

  const membershipFeatures = [
    '1-year free trial — no payment required upfront',
    'Continue access for R99/year after trial',
    'Join, engage, and participate in communities',
    'Simple annual renewal — no lock-in',
  ];

  const communityFeatures = [
    '30-day free trial to set up your community',
    'Activate permanently with R999 once-off payment',
    'Creator receives a 1-year platform membership trial',
    'Invite unlimited members',
  ];

  const comparison = [
    { feature: 'Join Communities', free: true, licensed: true },
    { feature: 'Membership Access', free: '1-year trial', licensed: 'R99/year' },
    { feature: 'Create Community', free: '30-day trial', licensed: 'R999 once-off' },
    { feature: 'Community Status', free: 'Trial only', licensed: 'Permanently active' },
    { feature: 'Post & Interact', free: 'During trial', licensed: 'Active subscription' },
    { feature: 'Extra Communities', free: false, licensed: 'R999 each' },
    { feature: 'Recurring Fees (Membership)', free: 'None (trial)', licensed: 'R99/year' },
  ];

  const renderCheckOrX = (val: boolean | string, isLicensed: boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <Check size={16} color={THEME_COLORS.secondaryContainer} />
      ) : (
        <X size={16} color={ERROR} />
      );
    }
    return (
      <Text style={[styles.tableValue, isLicensed && { color: THEME_COLORS.secondaryContainer }]}>
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
            Free for 1 Year.{' \n'}
            <Text style={{ color: SECONDARY }}>Then R99/year.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Start with a free 1-year trial. After that, stay connected for just R99/year.{' '}
            Launching a community? R999 once-off — yours permanently.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.primaryCta} onPress={handleUpgrade} activeOpacity={0.85}>
              <Text style={styles.primaryCtaText}>Subscribe — R99/year</Text>
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
              <Crown size={28} color={THEME_COLORS.secondaryContainer} />
            </View>
            <View style={styles.pricingInfo}>
              <Text style={styles.pricingTierTitle}>Platform Membership</Text>
              <Text style={styles.pricingTierSub}>FREE FOR 1 YEAR → ANNUAL SUBSCRIPTION</Text>
            </View>
            <Text style={styles.pricingAmount}>R99/yr</Text>
          </View>

          {membershipFeatures.map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <Check size={14} color={THEME_COLORS.secondaryContainer} />
              </View>
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Community tier */}
          <View style={styles.pricingRow}>
            <View style={styles.pricingInfo}>
              <Text style={styles.pricingTierTitle}>Community Creation (30-day trial included)</Text>
            </View>
            <Text style={styles.pricingAmount}>R999</Text>
          </View>

          {communityFeatures.map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <Check size={14} color={THEME_COLORS.secondaryContainer} />
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
            <Text style={styles.ruleCardTitle}>Platform Membership — free for 1 year, then R99/year</Text>
            <Text style={styles.ruleCardBullet}>• 1-year free trial starts automatically on signup</Text>
            <Text style={styles.ruleCardBullet}>• After trial: subscribe for R99/year to keep access</Text>
            <Text style={styles.ruleCardBullet}>• Expired membership = restricted access until renewed</Text>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleCardTitle}>Community creation — R999 once-off, permanent</Text>
            <Text style={styles.ruleCardDesc}>
              Your community is free for 30 days. Pay R999 to activate it permanently — no annual
              community fees.
            </Text>
          </View>

          <View style={styles.ruleGridRow}>
            <View style={styles.ruleGridCard}>
              <Text style={styles.ruleGridLabel}>MEMBERSHIP</Text>
              <Text style={styles.ruleGridValue}>1-year free trial → R99/year subscription</Text>
            </View>
            <View style={styles.ruleGridCard}>
              <Text style={styles.ruleGridLabel}>COMMUNITY</Text>
              <Text style={styles.ruleGridValue}>30-day trial → R999 once-off permanent activation</Text>
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
          <Text style={styles.tableSectionTitle}>Trial vs Active</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>FEATURE</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>TRIAL</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>ACTIVE</Text>
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
          <Text style={styles.finalCtaTitle}>Simple, Transparent Pricing.</Text>
          <Text style={styles.finalCtaSubtitle}>
            Membership is free for 1 year, then R99/year. Launch a community for R999 once-off —
            permanent, no annual community fees.
          </Text>
          <TouchableOpacity style={styles.finalCtaBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Text style={styles.finalCtaBtnText}>Subscribe — R99/year</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

export default BenefitsPricingPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME_COLORS.surfaceContainerLow },
  stickyHeader: {
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.overlayBorderSoft,
    paddingHorizontal: SPACE.s16,
    paddingVertical: SPACE.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  backBtnText: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: PRIMARY,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACE.s20, paddingTop: SPACE.md, gap: SPACE.s32 },

  // Hero
  heroSection: { alignItems: 'center', gap: SPACE.s16, paddingTop: SPACE.s16 },
  heroTitle: {
    fontSize: TYPE_SCALE.hero,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.hero,
  },
  heroSubtitle: {
    fontSize: TYPE_SCALE.xl,
    color: THEME_COLORS.neutralTextSubtle,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.subtitle,
  },
  heroButtons: { alignSelf: 'stretch', gap: SPACE.xl, marginTop: SPACE.md },
  primaryCta: {
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.s16,
    alignItems: 'center',
    ...createShadow(PRIMARY, SPACE.zero, SPACE.xs, 0.3, 12, 6),
  },
  primaryCtaText: {
    color: THEME_COLORS.white,
    fontWeight: FONT_WEIGHT.black,
    fontSize: TYPE_SCALE.xl,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  secondaryCta: {
    backgroundColor: THEME_COLORS.successSurface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.s16,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: PRIMARY,
    fontWeight: FONT_WEIGHT.black,
    fontSize: TYPE_SCALE.xl,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },

  // Pricing card
  pricingCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.alias_rgba_34_197_94_0_3,
    padding: SPACE.s24,
    backgroundColor: THEME_COLORS.neutralBg,
    gap: SPACE.xl,
    ...createShadow(THEME_COLORS.secondaryContainer, SPACE.zero, SPACE.xs, 0.1, 16, 4),
  },
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xl },
  pricingIconWrap: {
    width: SPACE.s48,
    height: SPACE.s48,
    borderRadius: RADIUS.md,
    backgroundColor: THEME_COLORS.alias_rgba_34_197_94_0_1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingInfo: { flex: 1 },
  pricingTierTitle: { fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  pricingTierSub: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.secondaryContainer,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
    marginTop: SPACE.xxs,
  },
  pricingAmount: { fontSize: TYPE_SCALE.jumbo, fontWeight: FONT_WEIGHT.black, color: PRIMARY },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.lg },
  featureCheck: {
    width: SPACE.s20,
    height: SPACE.s20,
    borderRadius: RADIUS.sm,
    backgroundColor: THEME_COLORS.alias_rgba_34_197_94_0_1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.s1,
    flexShrink: 0,
  },
  featureText: { flex: 1, fontSize: TYPE_SCALE.body, color: THEME_COLORS.neutralTextDefault, fontWeight: FONT_WEIGHT.medium, lineHeight: LINE_HEIGHT.body },
  divider: { height: 1, backgroundColor: THEME_COLORS.overlayBorderSoft, marginVertical: SPACE.md },

  // Rules
  rulesSection: {
    backgroundColor: THEME_COLORS.neutralBg,
    borderRadius: RADIUS.lg,
    padding: SPACE.s24,
    gap: SPACE.s16,
  },
  rulesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xl },
  rulesSectionTitle: { fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  ruleCard: {
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderRadius: RADIUS.md,
    padding: SPACE.s16,
    gap: SPACE.sm,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
  },
  ruleCardTitle: { fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  ruleCardBullet: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextDefault, fontWeight: FONT_WEIGHT.medium, lineHeight: LINE_HEIGHT.dense },
  ruleCardDesc: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextDefault, fontWeight: FONT_WEIGHT.medium, lineHeight: LINE_HEIGHT.dense },
  ruleGridRow: { flexDirection: 'row', gap: SPACE.xl },
  ruleGridCard: {
    flex: 1,
    backgroundColor: THEME_COLORS.surfaceContainerLow,
    borderRadius: RADIUS.md,
    padding: SPACE.s16,
    gap: SPACE.sm,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
  },
  ruleGridLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  ruleGridValue: { fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong, lineHeight: LINE_HEIGHT.compact },

  // Benefits
  benefitsSection: { gap: SPACE.s16 },
  benefitsSectionTitle: {
    fontSize: TYPE_SCALE.h2,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
    textAlign: 'center',
  },
  benefitCard: {
    flexDirection: 'row',
    gap: SPACE.s20,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.s20,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    ...createShadow(THEME_COLORS.black, SPACE.zero, SPACE.xxs, 0.04, 8, 2),
  },
  benefitIcon: {
    width: SPACE.s48,
    height: SPACE.s48,
    borderRadius: RADIUS.md,
    backgroundColor: THEME_COLORS.successTintSofter,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitContent: { flex: 1, gap: SPACE.md },
  benefitTitle: { fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  benefitBullet: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  benefitDot: { width: SPACE.xs, height: SPACE.xs, borderRadius: RADIUS.dot, backgroundColor: THEME_COLORS.alias_rgba_22_163_74_0_3 },
  benefitBulletText: { fontSize: TYPE_SCALE.base, color: THEME_COLORS.neutralTextDefault, fontWeight: FONT_WEIGHT.medium, flex: 1, lineHeight: LINE_HEIGHT.dense },

  // Table
  tableSection: { gap: SPACE.s16 },
  tableSectionTitle: { fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.black, color: PRIMARY, textAlign: 'center' },
  table: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
    overflow: 'hidden',
    backgroundColor: THEME_COLORS.surface,
    ...createShadow(THEME_COLORS.black, SPACE.zero, SPACE.xxs, 0.04, 8, 2),
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: THEME_COLORS.neutralBg,
    paddingHorizontal: SPACE.s16,
    paddingVertical: SPACE.xl,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.overlayBorderSoft,
  },
  tableHeaderCell: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.s16,
    paddingVertical: SPACE.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBg,
  },
  tableRowAlt: { backgroundColor: THEME_COLORS.aliasHex_fafafa },
  tableCell: { fontSize: TYPE_SCALE.base, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong },
  tableCellCenter: { alignItems: 'center', justifyContent: 'center' },
  tableValue: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Final CTA
  finalCta: {
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.xl,
    padding: SPACE.s32,
    alignItems: 'center',
    gap: SPACE.s16,
    ...createShadow(PRIMARY, SPACE.zero, SPACE.md, 0.3, 24, 8),
  },
  finalCtaTitle: { fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.black, color: THEME_COLORS.white, textAlign: 'center' },
  finalCtaSubtitle: {
    fontSize: TYPE_SCALE.body,
    color: THEME_COLORS.whiteOverlay80,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.body,
  },
  finalCtaBtn: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.s16,
    paddingHorizontal: SPACE.s28,
    ...createShadow(THEME_COLORS.black, SPACE.zero, SPACE.xs, 0.1, 12, 4),
  },
  finalCtaBtnText: {
    color: PRIMARY,
    fontWeight: FONT_WEIGHT.black,
    fontSize: TYPE_SCALE.lg,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
});
