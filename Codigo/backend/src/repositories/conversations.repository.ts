import type { Atendimento, Mensagem } from "../types/domain.js";

export interface ConversationsRepository {
  listConversations(channel?: string): Promise<Atendimento[]>;
  listMessages(conversationId: number): Promise<Mensagem[]>;
}
