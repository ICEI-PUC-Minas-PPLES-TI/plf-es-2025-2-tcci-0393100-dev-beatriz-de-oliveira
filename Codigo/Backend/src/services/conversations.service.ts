import type { ConversationChannel } from "../repositories/conversations.repository.js";
import type { ConversationsRepository } from "../repositories/conversations.repository.js";

export class ConversationsService {
  constructor(private readonly repository: ConversationsRepository) {}

  listConversations(channel?: ConversationChannel) {
    return this.repository.listConversations(channel);
  }

  listMessages(conversationId: number) {
    return this.repository.listMessages(conversationId);
  }
}
