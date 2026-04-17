import type { Atendimento, AtendimentoStatus, Mensagem } from "../types/domain.js";

export interface WhatsAppConversationRecord {
  atendimentoId: number;
  telefone: string;
  cliente: string;
}

export interface ConversationAutomationState {
  atendimentoId: number;
  telefone: string;
  status: AtendimentoStatus;
  handoffRequested: boolean;
  customerName?: string | null;
  stage?: string | null;
  intent?: string | null;
}

export interface SaveIncomingMessageInput {
  phone: string;
  customerName?: string;
  text: string;
  messageId: string;
  timestamp?: string;
  status?: AtendimentoStatus;
  handoffRequested?: boolean;
  intent?: string;
  stage?: string;
}

export interface SaveOutgoingMessageInput {
  atendimentoId?: number;
  phone: string;
  text: string;
  messageId?: string;
  timestamp?: string;
  statusEntrega?: string;
  remetente?: string;
  handoffRequested?: boolean;
  intent?: string;
  stage?: string;
}

export interface WhatsAppRepository {
  saveIncomingMessage(input: SaveIncomingMessageInput): Promise<WhatsAppConversationRecord>;
  saveOutgoingMessage(input: SaveOutgoingMessageInput): Promise<Mensagem>;
  listConversations(): Promise<Atendimento[]>;
  listMessages(atendimentoId: number): Promise<Mensagem[]>;
  findConversationById(atendimentoId: number): Promise<WhatsAppConversationRecord | null>;
  getConversationAutomationStateByPhone(phone: string): Promise<ConversationAutomationState | null>;
  updateConversationStatus(atendimentoId: number, status: AtendimentoStatus): Promise<Atendimento | null>;
  updateCustomerNameByPhone(phone: string, name: string): Promise<void>;
}
