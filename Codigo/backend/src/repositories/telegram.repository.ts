import type { Atendimento, AtendimentoStatus } from "../types/domain.js";
import type { Mensagem } from "../types/domain.js";

export interface TelegramConversationRecord {
  atendimentoId: number;
  chatId: string;
  cliente: string;
  contactId?: string;
}

export interface TelegramConversationAutomationState {
  atendimentoId: number;
  chatId: string;
  status: AtendimentoStatus;
  handoffRequested: boolean;
  stage?: string | null;
  intent?: string | null;
}

export interface SaveTelegramIncomingMessageInput {
  chatId: string;
  customerName?: string;
  text: string;
  messageId: string;
  timestamp?: string;
  status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
  handoffRequested?: boolean;
  intent?: string;
  stage?: string;
}

export interface SaveTelegramOutgoingMessageInput {
  atendimentoId?: number;
  chatId: string;
  text: string;
  type: "text" | "image";
  statusEntrega: string;
  sender?: "CHATBOT" | "ATENDENTE";
  status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
  handoffRequested?: boolean;
  intent?: string;
  stage?: string;
}

export interface TelegramRepository {
  saveIncomingMessage(input: SaveTelegramIncomingMessageInput): Promise<TelegramConversationRecord>;
  saveOutgoingMessage(input: SaveTelegramOutgoingMessageInput): Promise<Mensagem>;
  updateCustomerNameByChatId(chatId: string, name: string): Promise<void>;
  findConversationById(conversationId: number): Promise<TelegramConversationRecord | null>;
  getConversationAutomationStateByChatId(chatId: string): Promise<TelegramConversationAutomationState | null>;
  updateConversationStatus(conversationId: number, status: AtendimentoStatus): Promise<Atendimento | null>;
}
