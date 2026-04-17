import type { Atendimento, Mensagem } from "../types/domain.js";

export type ConversationChannel = "whatsapp" | "telegram";

export interface ConversationsRepository {
  listConversations(channel?: ConversationChannel): Promise<Atendimento[]>;
  listMessages(conversationId: number): Promise<Mensagem[]>;
}
