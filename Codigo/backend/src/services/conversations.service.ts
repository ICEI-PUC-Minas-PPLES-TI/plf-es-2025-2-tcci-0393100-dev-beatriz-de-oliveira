import type { ConversationsRepository } from "../repositories/conversations.repository.js";

export class ConversationsService {
  constructor(private readonly repository: ConversationsRepository) {}

  listConversations(channel?: string) {
    return this.repository.listConversations(channel);
  }

  listMessages(conversationId: number) {
    return this.repository.listMessages(conversationId);
  }
}
