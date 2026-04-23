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

  async sendMessage(conversationId: number, content: string) {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
    }

    if (conversation.channel === "telegram") {
      return this.telegramService.sendManualMessage({
        atendimentoId: conversationId,
        chatId: conversation.contactId ?? conversation.telefone,
        texto: content,
      });
    }

    return this.whatsappService.sendManualMessage({
      atendimentoId: conversationId,
      telefone: conversation.telefone,
      texto: content,
    });
  }
}
