import type { ConversationsRepository } from "../repositories/conversations.repository.js";
import type { TelegramService } from "./telegram.service.js";
import type { WhatsAppService } from "./whatsapp.service.js";
import { AppError } from "../utils/app-error.js";

export class ConversationsService {
  constructor(
    private readonly repository: ConversationsRepository,
    private readonly whatsappService: WhatsAppService,
    private readonly telegramService: TelegramService,
  ) {}

  listConversations(channel?: string) {
    return this.repository.listConversations(channel);
  }

  listMessages(conversationId: number) {
    return this.repository.listMessages(conversationId);
  }

  async listPreviousConversations(conversationId: number) {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
    }

    return this.repository.listPreviousConversations(conversationId);
  }

  async sendMessage(conversationId: number, content: string) {
    try {
      console.info("[ConversationsManualSend] inicio", {
        conversationId,
        preview: content.slice(0, 80),
      });

      const conversation = await this.repository.findConversationById(conversationId);
      if (!conversation) {
        throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
      }

      console.info("[ConversationsManualSend] atendimento encontrado", {
        conversationId,
        status: conversation.status,
        contactId: conversation.contactId ?? null,
        phone: conversation.telefone ?? null,
      });

      const channel = conversation.channel === "telegram" ? "telegram" : "whatsapp";
      console.info("[ConversationsManualSend] canal", {
        conversationId,
        channel,
      });

      const data =
        channel === "telegram"
          ? await this.telegramService.sendManualMessage({
              atendimentoId: conversationId,
              chatId: conversation.contactId ?? conversation.telefone,
              texto: content,
            })
          : await this.whatsappService.sendManualMessage({
              atendimentoId: conversationId,
              telefone: conversation.telefone,
              texto: content,
            });

      console.info("[ConversationsManualSend] envio OK", {
        conversationId,
        channel,
        messageId: data.id,
      });
      console.info("[ConversationsManualSend] persistência OK", {
        conversationId,
        channel,
        messageId: data.id,
        sender: data.remetente ?? null,
      });
      console.info("[ConversationsManualSend] status OK", {
        conversationId,
        channel,
        ultimaInteracaoEm: new Date().toISOString(),
      });
      console.info("[ConversationsManualSend] response OK", {
        conversationId,
        channel,
        messageId: data.id,
      });

      return data;
    } catch (error) {
      console.error("[ConversationsManualSend] erro completo", {
        conversationId,
        error: error instanceof Error ? error.message : "unknown_error",
        stack: error instanceof Error ? error.stack : undefined,
        code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined,
      });
      throw error;
    }
  }

  async updateStatus(conversationId: number, status: "ATIVO" | "PENDENTE" | "ENCERRADO") {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
    }

    if (conversation.channel === "telegram") {
      return this.telegramService.updateConversationStatus(conversationId, status);
    }

    return this.whatsappService.updateConversationStatus(conversationId, status);
  }
}
