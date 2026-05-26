import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CreditCard, CheckCircle2, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { accountService } from '../../services/accountService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

const PRIMARY = THEME_COLORS.primary;
const TYPE_SCALE = {
  xs: 10,
  sm: 11,
  md: 14,
  lg: 15,
  xl: 16,
  xxl: 18,
  title: 20,
  hero: 24,
  price: 40,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const LINE_HEIGHT = {
  body: 20,
} as const;
const LETTER_SPACING = {
  normal: 1,
  wide: 1.5,
  ultra: 2,
} as const;
const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};
const RADIUS = {
  lg: 16,
  xl: 24,
  full: 40,
};

interface MockStripeCheckoutProps {
  type?: 'membership' | 'community';
  targetId?: string;
  returnTo?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MockStripeCheckout: React.FC<MockStripeCheckoutProps> = ({
  type = 'membership',
  targetId,
  returnTo,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { licenseCommunity } = useCommunity();
  const { updateUserProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isMembership = type === 'membership';
  const price = isMembership ? 'R99.00/year' : 'R999.00';
  const payLabel = isMembership ? 'R99.00' : 'R999.00';
  const title = isMembership ? 'Annual Membership Subscription' : 'Community Activation';
  const description = isMembership
    ? 'Annual subscription (R99/year) for continued access to the Lalela platform after your free trial.'
    : 'Once-off payment (R999) to permanently activate your community. No recurring community fees.';;

  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/admin'); else router.replace('/admin');
    }
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else if (returnTo) {
      router.push(returnTo as any);
    } else {
      router.push('/');
    }
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      if (type === 'community' && targetId) {
        // Server updates DB: community.isPaid=true, type='ACTIVE', activatedAt=now
        await licenseCommunity(targetId);
      } else if (type === 'membership') {
        // Server updates DB: user.licenseStatus='ACTIVE', subscriptionActive=true, renewalDate=now+1yr
        await accountService.simulateSuccessfulPayment('membership');
        // Refresh local profile from server so new licenseStatus is reflected immediately
        const { data: freshUser } = await api.get('/users/me');
        await updateUserProfile(freshUser);
      }
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        handleSuccess();
      }, 2000);
    } catch (error) {
      console.error('Payment simulation failed:', error);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top }]}>
        <View style={styles.successInner}>
          <View style={styles.successIconCircle}>
            <CheckCircle2 size={40} color={THEME_COLORS.white} />
          </View>
          <Text style={styles.successTitle}>Payment Successful</Text>
          <Text style={styles.successMsg}>Redirecting back to Lalela...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              disabled={loading}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={THEME_COLORS.whiteOverlay80} />
            </TouchableOpacity>
            <View style={styles.headerIcon}>
              <CreditCard size={32} color={THEME_COLORS.white} />
            </View>
            <Text style={styles.headerTitle}>Lalela Checkout (Mock)</Text>
            <Text style={styles.headerSub}>TEST ENVIRONMENT</Text>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <Text style={styles.productTitle}>{title}</Text>
            <Text style={styles.productDesc}>{description}</Text>

            <View style={styles.priceDivider} />
            <Text style={styles.priceAmount}>{price}</Text>
            <Text style={styles.priceLabel}>
              {isMembership ? 'ANNUAL SUBSCRIPTION' : 'ONCE-OFF PAYMENT'}
            </Text>
            <View style={styles.priceDivider} />

            <TouchableOpacity
              style={[styles.payBtn, loading && styles.payBtnDisabled]}
              onPress={handlePay}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color={THEME_COLORS.white} />
                  <Text style={styles.payBtnText}>Processing...</Text>
                </>
              ) : (
                <Text style={styles.payBtnText}>Pay {payLabel}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              This is a mock Stripe checkout for demonstration purposes. No real money will be charged.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default MockStripeCheckout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.neutralBg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACE.xl,
  },
  card: {
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...createShadow(THEME_COLORS.black, 0, 8, 0.12, 24, 8),
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
  },
  cardHeader: {
    backgroundColor: PRIMARY,
    padding: SPACE.xl,
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: SPACE.lg,
    top: SPACE.lg,
    padding: SPACE.xxs,
  },
  headerIcon: {
    width: 64,
    height: 64,
    backgroundColor: THEME_COLORS.alias_rgba_255_255_255_0_15,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  headerTitle: {
    fontSize: TYPE_SCALE.title,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.white,
  },
  headerSub: {
    fontSize: TYPE_SCALE.xs,
    color: THEME_COLORS.whiteOverlay70,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: LETTER_SPACING.ultra,
    marginTop: SPACE.xxs,
  },
  cardBody: {
    padding: SPACE.xxl,
    alignItems: 'center',
    gap: SPACE.sm,
  },
  productTitle: {
    fontSize: TYPE_SCALE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextStrong,
    textAlign: 'center',
  },
  productDesc: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.neutralTextSubtle,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.body,
  },
  priceDivider: {
    height: 1,
    backgroundColor: THEME_COLORS.neutralBgSoft,
    alignSelf: 'stretch',
    marginVertical: SPACE.xxs,
  },
  priceAmount: {
    fontSize: TYPE_SCALE.price,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
  },
  priceLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextMuted,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
  payBtn: {
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACE.xs,
    ...createShadow(PRIMARY, 0, 4, 0.3, 12, 6),
    marginTop: SPACE.xs,
  },
  payBtnDisabled: {
    opacity: 0.5,
  },
  payBtnText: {
    color: THEME_COLORS.white,
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  disclaimer: {
    fontSize: TYPE_SCALE.xs,
    color: THEME_COLORS.neutralTextMuted,
    textAlign: 'center',
    lineHeight: TYPE_SCALE.xl,
    marginTop: SPACE.xxs,
  },
  successContainer: {
    flex: 1,
    backgroundColor: THEME_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
  successInner: {
    alignItems: 'center',
    gap: SPACE.md,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: THEME_COLORS.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: TYPE_SCALE.hero,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
  },
  successMsg: {
    fontSize: TYPE_SCALE.lg,
    color: THEME_COLORS.neutralTextSubtle,
    fontWeight: FONT_WEIGHT.medium,
  },
});
