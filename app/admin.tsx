import { useRouter } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';
import { useAuth } from '../src/context/AuthContext';

export default function AdminScreen() {
  const router = useRouter();
  const { currentCommunity } = useCommunity();
  const { userProfile } = useAuth();
  const AdminDashboard = require('../src/components/admin/AdminDashboard').default;

  const isOwner = currentCommunity?.ownerId === userProfile?.id;
  const canAccess =
    isOwner ||
    currentCommunity?.userRole === 'ADMIN' ||
    currentCommunity?.userRole === 'MODERATOR';

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

