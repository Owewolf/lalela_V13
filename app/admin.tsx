import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';

export default function AdminScreen() {
  const { guided } = useLocalSearchParams<{ guided?: string }>();
  const router = useRouter();
  const { currentCommunity } = useCommunity();
  const AdminDashboard = require('../src/components/admin/AdminDashboard').default;
  const canAccessModerationCenter =
    currentCommunity?.userRole === 'Admin' ||
    currentCommunity?.userRole === 'Moderator';

  return (
    <AdminDashboard
      guidedSetup={guided === 'true' && canAccessModerationCenter}
      readOnly={!canAccessModerationCenter}
      onSetupComplete={() => router.replace('/(tabs)')}
      onBack={() => router.back()}
    />
  );
}
