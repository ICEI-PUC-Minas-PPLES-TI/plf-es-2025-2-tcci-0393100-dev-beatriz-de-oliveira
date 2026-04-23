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
    console.info("[ConversationsManualSend] start", {
      conversationId,
      preview: content.slice(0, 80),
    });

    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
    }

    console.info("[ConversationsManualSend] conversation_found", {
      conversationId,
      channel: conversation.channel,
      status: conversation.status,
      contactId: conversation.contactId ?? null,
    });

    if (conversation.channel === "telegram") {
      const data = await this.telegramService.sendManualMessage({
        atendimentoId: conversationId,
        chatId: conversation.contactId ?? conversation.telefone,
        texto: content,
      });
      console.info("[ConversationsManualSend] response_returned", {
        conversationId,
        channel: "telegram",
        messageId: data.id,
      });
      return data;
    }

    const data = await this.whatsappService.sendManualMessage({
      atendimentoId: conversationId,
      telefone: conversation.telefone,
      texto: content,
    });
    console.info("[ConversationsManualSend] response_returned", {
      conversationId,
      channel: "whatsapp",
      messageId: data.id,
    });
    return data;
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
