import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';
import { useAuth } from '../src/context/AuthContext';

type AdminView = 'dashboard' | 'moderation' | 'members';
type ModerationTab = 'members' | 'content' | 'businesses' | 'rules' | 'logs' | 'categories' | 'coverage' | 'charity';

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string | string[]; tab?: string | string[] }>();
  const { currentCommunity } = useCommunity();
  const { userProfile } = useAuth();
  const AdminDashboard = require('../src/components/admin/AdminDashboard').default;

  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const allowedViews: AdminView[] = ['dashboard', 'moderation', 'members'];
  const allowedTabs: ModerationTab[] = ['members', 'content', 'businesses', 'rules', 'logs', 'categories', 'coverage', 'charity'];
  const initialView: AdminView = rawView && allowedViews.includes(rawView as AdminView) ? (rawView as AdminView) : 'dashboard';
  const initialModerationTab: ModerationTab = rawTab && allowedTabs.includes(rawTab as ModerationTab)
    ? (rawTab as ModerationTab)
    : 'members';

  const isOwner = currentCommunity?.ownerId === userProfile?.id;
  const canAccess =
    isOwner ||
    currentCommunity?.userRole === 'ADMIN' ||
    currentCommunity?.userRole === 'MODERATOR';

  return (
    <AdminDashboard
      initialView={initialView}
      initialModerationTab={initialModerationTab}
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

