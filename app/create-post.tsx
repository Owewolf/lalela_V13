import { useLocalSearchParams } from 'expo-router';

export default function CreatePostScreen() {
  const { type, urgency } = useLocalSearchParams<{ type?: string; urgency?: string }>();
  const CreatePostPage = require('../src/components/posts/CreatePostPage').default;

  return (
    <CreatePostPage
      initialType={(type as 'listing' | 'notice') ?? 'listing'}
      initialUrgency={(urgency as 'emergency' | 'warning' | 'info' | 'general') ?? undefined}
    />
  );
}
