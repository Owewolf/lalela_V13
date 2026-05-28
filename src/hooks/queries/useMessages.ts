import { useConversationMessages } from './useConversationMessages';

export function useMessagesQuery(conversationId?: string | null) {
  return useConversationMessages(conversationId);
}
