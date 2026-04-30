import { useLocalSearchParams } from 'expo-router';

export default function CheckoutScreen() {
  const { type, targetId, returnTo } = useLocalSearchParams<{ type?: 'membership' | 'community'; targetId?: string; returnTo?: string }>();
  const MockStripeCheckout = require('../src/components/admin/MockStripeCheckout').default;
  return <MockStripeCheckout type={type as any} targetId={targetId} returnTo={returnTo} />;
}
