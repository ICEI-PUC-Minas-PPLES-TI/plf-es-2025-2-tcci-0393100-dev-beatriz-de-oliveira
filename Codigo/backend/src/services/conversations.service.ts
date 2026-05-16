import type { ConversationsRepository } from "../repositories/conversations.repository.js";
import type { TelegramService } from "./telegram.service.js";
import { AppError } from "../utils/app-error.js";

export class ConversationsService {
  constructor(
    private readonly repository: ConversationsRepository,
    private readonly telegramService: TelegramService,
  ) {}

  listConversations(channel?: string) {
    return this.repository.listConversations("telegram");
  }

  listMessages(conversationId: number) {
    return this.repository.listMessages(conversationId);
  }

  async listFullHistory(conversationId: number) {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
    }

    return this.repository.listFullHistory(conversationId);
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

      if (conversation.channel !== "telegram") {
        throw new AppError("Conversation channel unavailable", 400, "CONVERSATION_CHANNEL_UNAVAILABLE");
      }

      const channel = "telegram";
      console.info("[ConversationsManualSend] canal", {
        conversationId,
        channel,
      });

      const data = await this.telegramService.sendManualMessage({
        atendimentoId: conversationId,
        chatId: conversation.contactId ?? conversation.telefone,
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

    if (conversation.channel !== "telegram") {
      throw new AppError("Conversation channel unavailable", 400, "CONVERSATION_CHANNEL_UNAVAILABLE");
    }

    return this.telegramService.updateConversationStatus(conversationId, status);
  }
}
