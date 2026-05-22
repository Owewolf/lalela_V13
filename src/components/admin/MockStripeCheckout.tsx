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

const PRIMARY = '#0d3d47';

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
            <CheckCircle2 size={40} color="#fff" />
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
              <ArrowLeft size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={styles.headerIcon}>
              <CreditCard size={32} color="#fff" />
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
                  <ActivityIndicator size="small" color="#fff" />
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
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardHeader: {
    backgroundColor: PRIMARY,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 20,
    padding: 4,
  },
  headerIcon: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  cardBody: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  productDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: PRIMARY,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  payBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 8,
  },
  payBtnDisabled: {
    opacity: 0.5,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  disclaimer: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successInner: {
    alignItems: 'center',
    gap: 16,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fc7127',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: PRIMARY,
  },
  successMsg: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
});
