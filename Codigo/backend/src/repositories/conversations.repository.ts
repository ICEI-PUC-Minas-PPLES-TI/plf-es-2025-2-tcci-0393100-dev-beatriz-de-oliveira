import type { Atendimento, AtendimentoHistorico, Mensagem } from "../types/domain.js";

export interface ConversationsRepository {
  listConversations(channel?: string): Promise<Atendimento[]>;
  listMessages(conversationId: number): Promise<Mensagem[]>;
  listFullHistory(conversationId: number): Promise<Mensagem[]>;
  findConversationById(conversationId: number): Promise<Atendimento | null>;
  listPreviousConversations(conversationId: number): Promise<AtendimentoHistorico[]>;
}
