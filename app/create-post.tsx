import { useLocalSearchParams } from 'expo-router';
import { useCommunity } from '../src/context/CommunityContext';

export default function CreatePostScreen() {
  const { type, urgency, postId } = useLocalSearchParams<{ type?: string; urgency?: string; postId?: string }>();
  const { posts } = useCommunity();
  const CreatePostPage = require('../src/components/posts/CreatePostPage').default;

  const postToEdit = postId ? posts.find((p) => p.id === postId) : undefined;

  return (
    <CreatePostPage
      postToEdit={postToEdit}
      initialType={postToEdit ? (postToEdit.type as 'listing' | 'notice') : ((type as 'listing' | 'notice') ?? 'listing')}
      initialUrgency={postToEdit ? undefined : ((urgency as 'emergency' | 'warning' | 'info' | 'general') ?? undefined)}
    />
  );
}
