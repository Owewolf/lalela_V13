import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';
import CreateBusinessForm from '../src/components/settings/CreateBusinessForm';

export default function CreateBusinessScreen() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const router = useRouter();
  const { userBusinesses, communities, currentCommunity } = useCommunity();

  const businessToEdit = businessId ? userBusinesses.find((business) => business.id === businessId) : null;

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/security?tab=businesses' as any);
  };

  return (
    <CreateBusinessForm
      business={businessToEdit}
      communities={communities}
      currentCommunity={currentCommunity}
      onClose={handleClose}
    />
  );
}
