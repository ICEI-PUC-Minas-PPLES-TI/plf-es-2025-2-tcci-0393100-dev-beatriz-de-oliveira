import type { Mensagem } from "../types/domain.js";

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
  messageId?: string;
  timestamp?: string;
  type?: string;
  statusEntrega?: string;
}

export interface TelegramConversationRecord {
  atendimentoId: number;
  contactId: string;
  cliente: string;
}

export interface TelegramRepository {
  saveIncomingMessage(input: SaveTelegramIncomingMessageInput): Promise<TelegramConversationRecord>;
  saveOutgoingMessage(input: SaveTelegramOutgoingMessageInput): Promise<Mensagem>;
  updateCustomerNameByChatId(chatId: string, name: string): Promise<void>;
}
