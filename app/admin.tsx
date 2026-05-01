import { useRouter } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';
import { useAuth } from '../src/context/AuthContext';

export default function AdminScreen() {
  const router = useRouter();
  const { currentCommunity } = useCommunity();
  const { userProfile } = useAuth();
  const AdminDashboard = require('../src/components/admin/AdminDashboard').default;

  const isOwner = currentCommunity?.owner_id === userProfile?.id;
  const canAccess =
    isOwner ||
    currentCommunity?.userRole === 'Admin' ||
    currentCommunity?.userRole === 'Moderator';

  return (
    <AdminDashboard
      guidedSetup={false}
      readOnly={!canAccess}
      onSetupComplete={() => router.replace('/(tabs)')}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }}
    />
  );
}

