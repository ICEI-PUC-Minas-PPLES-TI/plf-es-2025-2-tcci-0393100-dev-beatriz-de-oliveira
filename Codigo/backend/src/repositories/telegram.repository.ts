import type { Mensagem } from "../types/domain.js";

export interface TelegramConversationRecord {
  atendimentoId: number;
  chatId: string;
  cliente: string;
  contactId?: string;
}

export interface SaveTelegramIncomingMessageInput {
  chatId: string;
  customerName?: string;
  text: string;
  messageId: string;
  timestamp?: string;
}

export interface SaveTelegramOutgoingMessageInput {
  chatId: string;
  text: string;
  type: "text" | "image";
  statusEntrega: string;
  sender?: "CHATBOT" | "ATENDENTE";
}

export interface TelegramRepository {
  saveIncomingMessage(input: SaveTelegramIncomingMessageInput): Promise<TelegramConversationRecord>;
  saveOutgoingMessage(input: SaveTelegramOutgoingMessageInput): Promise<Mensagem>;
  updateCustomerNameByChatId(chatId: string, name: string): Promise<void>;
  findConversationById(conversationId: number): Promise<TelegramConversationRecord | null>;
}
