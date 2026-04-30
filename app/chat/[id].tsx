import { useLocalSearchParams } from 'expo-router';

export default function ChatDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ChatDetailPage = require('../../src/components/chat/ChatDetailPage').ChatDetailPage;
  return <ChatDetailPage conversationId={id ?? ''} />;
}
