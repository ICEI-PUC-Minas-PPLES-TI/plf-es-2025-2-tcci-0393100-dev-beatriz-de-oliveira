import { env } from "../config/env.js";
import type { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { TelegramRepository } from "../repositories/telegram.repository.js";
import type { ChatbotProcessResult, ChatbotResponse } from "../modules/chatbot/types.js";
import type { Mensagem, Produto } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import type { ProductsService } from "./products.service.js";
import type { LeadStatusService } from "./lead-status.service.js";
import { buildTelegramPhotoCaption, buildTelegramPreparedResponse, buildTelegramTextCard } from "./telegram/telegram-product-response.js";
import { parseTelegramUpdate, type TelegramWebhookPayload } from "./telegram/telegram-update-parser.js";

type TelegramApiErrorPayload = {
  description?: string;
};

function formatErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: "code" in error ? String((error as { code?: unknown }).code) : undefined,
      detail: "detail" in error ? String((error as { detail?: unknown }).detail) : undefined,
      constraint: "constraint" in error ? String((error as { constraint?: unknown }).constraint) : undefined,
    };
  }

  return {
    message: String(error),
    stack: undefined,
    code: undefined,
    detail: undefined,
    constraint: undefined,
  };
}

export class TelegramService {
  constructor(
    private readonly chatbotCore: ChatbotCoreService,
    private readonly productsService: ProductsService,
    private readonly repository: TelegramRepository,
    private readonly leadStatusService: LeadStatusService,
  ) {}

  async processWebhookEvent(payload: TelegramWebhookPayload): Promise<ChatbotProcessResult> {
    console.info("[TelegramService] process_webhook_event_start", {
      hasMessage: Boolean(payload.message),
      hasEditedMessage: Boolean(payload.edited_message),
      hasCallbackQuery: Boolean(payload.callback_query),
    });

    const parsed = parseTelegramUpdate(payload);

    if (parsed.kind === "invalid") {
      console.warn("[Telegram] Payload inválido", {
        reason: parsed.reason,
      });
      return {
        consumed: false,
        extractedMessages: 0,
        responses: [],
        messageResults: [],
        reason: parsed.reason,
      };
    }

    if (parsed.kind === "ignored") {
      console.info("[Telegram] Mensagem ignorada (sem texto)", {
        reason: parsed.reason,
      });
      return {
        consumed: false,
        extractedMessages: 0,
        responses: [],
        messageResults: [],
        reason: parsed.reason,
      };
    }

    const message = parsed.message;
    if (parsed.callbackQueryId) {
      await this.answerCallbackQuery(parsed.callbackQueryId);
    }
    console.info("[TelegramService] normalized_payload", {
      chatId: message.from,
      dedupKey: message.messageId,
      hasStableMessageId: message.hasStableMessageId,
      timestamp: message.timestamp,
      profileName: message.profileName,
      preview: message.text.slice(0, 80),
    });

    console.info("[TelegramService] inbound_message", {
      chatId: message.from,
      dedupKey: message.messageId,
      timestamp: message.timestamp,
      preview: message.text.slice(0, 80),
    });

    let savedConversation;
    try {
      console.info("[TelegramService] inbound_persist_start", {
        chatId: message.from,
        dedupKey: message.messageId,
        customerName: message.profileName,
      });
      savedConversation = await this.repository.saveIncomingMessage({
        chatId: message.from,
        customerName: message.profileName,
        text: message.text,
        messageId: message.messageId,
        timestamp: message.timestamp,
      });
    } catch (error) {
      console.error("[TelegramService] inbound_persist_failed", {
        chatId: message.from,
        dedupKey: message.messageId,
        ...formatErrorDetails(error),
      });
      throw error;
    }

    console.info("[TelegramService] inbound_persisted", {
      chatId: message.from,
      atendimentoId: savedConversation.atendimentoId,
      contactId: savedConversation.contactId,
      channel: "TELEGRAM",
    });

    await this.leadStatusService.updateLeadStatusFromConversation(savedConversation.atendimentoId);

    console.info("[Telegram] Webhook recebido", {
      chatId: message.from,
      messageId: message.messageId,
    });

    let result: ChatbotProcessResult;
    try {
      result = await this.chatbotCore.processIncomingMessages([message], payload as Record<string, unknown>);
    } catch (error) {
      console.error("[Telegram] Erro ao processar mensagem", {
        chatId: message.from,
        messageId: message.messageId,
        ...formatErrorDetails(error),
      });
      return {
        consumed: false,
        extractedMessages: 1,
        responses: [],
        messageResults: [],
        reason: "chatbot_processing_failed",
      };
    }

    for (const item of result.messageResults ?? []) {
      console.info("[TelegramService] chatbot_result", {
        chatId: item.phone,
        dedupKey: item.messageId,
        status: item.status,
        intent: item.response?.intent,
      });
    }

    for (const messageResult of result.messageResults ?? []) {
      if (messageResult.status !== "processed" || !messageResult.response) {
        continue;
      }

      if (messageResult.response.capturedCustomerName) {
        await this.repository.updateCustomerNameByChatId(messageResult.phone, messageResult.response.capturedCustomerName);
      }

      try {
        await this.sendChatbotResponse(messageResult.phone, messageResult.response);
        console.info("[Telegram] Mensagem processada", {
          chatId: messageResult.phone,
          messageId: messageResult.messageId,
          intent: messageResult.response.intent,
        });
      } catch (error) {
        console.error("[Telegram] Erro ao enviar mensagem", {
          chatId: messageResult.phone,
          messageId: messageResult.messageId,
          ...formatErrorDetails(error),
        });
      }
    }

    return result;
  }

  async sendManualMessage(input: { atendimentoId?: number; chatId?: string; texto: string }) {
    let chatId = input.chatId?.trim();

    if (!chatId && input.atendimentoId !== undefined) {
      const conversation = await this.repository.findConversationById(input.atendimentoId);
      if (!conversation) {
        throw new AppError("Conversation not found", 404, "TELEGRAM_CONVERSATION_NOT_FOUND");
      }
      chatId = conversation.chatId;
    }

    if (!chatId) {
      throw new AppError("Telegram chat id is required", 400, "TELEGRAM_CHAT_ID_REQUIRED");
    }

    return this.sendTextMessage(chatId, input.texto, undefined, "ATENDENTE");
  }

  private async sendChatbotResponse(chatId: string, response: ChatbotResponse): Promise<void> {
    if (!response.replyText?.trim()) {
      console.warn("[Telegram] Resposta vazia do chatbot", {
        chatId,
        intent: response.intent,
      });
      return;
    }

    const replyMessages = response.replyMessages?.filter((message) => message.trim()) ?? [];
    if (replyMessages.length > 0) {
      for (let index = 0; index < replyMessages.length; index += 1) {
        const isLastMessage = index === replyMessages.length - 1;
        await this.sendTextMessage(
          chatId,
          replyMessages[index]!,
          isLastMessage ? response.telegram?.inlineKeyboard : undefined,
        );
      }
      return;
    }

    const products = await this.findProductsForResponse(response);
    const prepared = buildTelegramPreparedResponse(response, products);
    const inlineKeyboard = response.telegram?.inlineKeyboard;

    if (prepared.productCards.length === 0) {
      await this.sendTextMessage(chatId, prepared.fallbackText ?? response.replyText, inlineKeyboard);
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        intent: response.intent,
      });
      return;
    }

    if (prepared.introText) {
      await this.sendTextMessage(chatId, prepared.introText);
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        intent: response.intent,
        kind: "intro",
      });
    }

    for (const card of prepared.productCards) {
      if (card.imageUrl) {
        try {
          await this.sendPhotoMessage(chatId, card.imageUrl, buildTelegramPhotoCaption(card));
          console.info("[Telegram] Resposta enviada com imagem", {
            chatId,
            product: card.name,
          });
          continue;
        } catch (error) {
          console.warn("[Telegram] Erro ao enviar imagem", {
            chatId,
            product: card.name,
            error: error instanceof Error ? error.message : "unknown_error",
          });
        }
      }

      await this.sendTextMessage(chatId, buildTelegramTextCard(card));
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        product: card.name,
        kind: "product_fallback",
      });
    }

    if (inlineKeyboard?.length) {
      await this.sendTextMessage(chatId, response.telegram?.keyboardPrompt ?? "Escolha uma opção para continuar.", inlineKeyboard);
    }
  }

  private async findProductsForResponse(response: ChatbotResponse): Promise<Produto[]> {
    const productNames = response.stateTransition?.lastShownProducts ?? [];
    if (productNames.length === 0 || response.intent !== "products") {
      return [];
    }

    const allProducts = await this.productsService.list();
    const byName = new Map(allProducts.map((product) => [product.nome, product]));
    return productNames.map((name) => byName.get(name)).filter((product): product is Produto => Boolean(product));
  }

  private async sendTextMessage(
    chatId: string,
    text: string,
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>,
    sender: "CHATBOT" | "ATENDENTE" = "CHATBOT",
  ): Promise<Mensagem> {
    try {
      const token = this.getBotToken();
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: this.buildReplyMarkup(inlineKeyboard),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
        throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_FAILED");
      }

      const savedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text,
        type: "text",
        statusEntrega: "ENVIADA",
        sender,
      });
      console.info("[TelegramService] outbound_persisted", {
        chatId,
        conversationId: savedMessage.conversationId,
        type: "text",
        deliveryStatus: "ENVIADA",
        preview: text.slice(0, 80),
      });
      if (savedMessage.conversationId) {
        await this.leadStatusService.updateLeadStatusFromConversation(savedMessage.conversationId);
      }
      return savedMessage;
    } catch (error) {
      const failedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text,
        type: "text",
        statusEntrega: "FALHA",
        sender,
      });
      console.error("[TelegramService] outbound_persist_failed_send", {
        chatId,
        conversationId: failedMessage.conversationId,
        type: "text",
        deliveryStatus: "FALHA",
        ...formatErrorDetails(error),
      });
      if (failedMessage.conversationId) {
        await this.leadStatusService.updateLeadStatusFromConversation(failedMessage.conversationId);
      }
      throw error;
    }
  }

  private async sendPhotoMessage(
    chatId: string,
    photoUrl: string,
    caption: string,
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>,
  ): Promise<void> {
    try {
      const token = this.getBotToken();
      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          reply_markup: this.buildReplyMarkup(inlineKeyboard),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
        throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_PHOTO_FAILED");
      }

      const savedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text: caption,
        type: "image",
        statusEntrega: "ENVIADA",
      });
      console.info("[TelegramService] outbound_persisted", {
        chatId,
        conversationId: savedMessage.conversationId,
        type: "image",
        deliveryStatus: "ENVIADA",
        preview: caption.slice(0, 80),
      });
      if (savedMessage.conversationId) {
        await this.leadStatusService.updateLeadStatusFromConversation(savedMessage.conversationId);
      }
    } catch (error) {
      const failedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text: caption,
        type: "image",
        statusEntrega: "FALHA",
      });
      console.error("[TelegramService] outbound_persist_failed_send", {
        chatId,
        conversationId: failedMessage.conversationId,
        type: "image",
        deliveryStatus: "FALHA",
        ...formatErrorDetails(error),
      });
      if (failedMessage.conversationId) {
        await this.leadStatusService.updateLeadStatusFromConversation(failedMessage.conversationId);
      }
      throw error;
    }
  }

  private getBotToken(): string {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      throw new AppError("Telegram bot token is not configured", 503, "TELEGRAM_BOT_NOT_CONFIGURED");
    }
    return token;
  }

  private buildReplyMarkup(inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>) {
    if (!inlineKeyboard?.length) {
      return undefined;
    }

    return {
      inline_keyboard: inlineKeyboard.map((row) =>
        row.map((button) => ({
          text: button.text,
          callback_data: button.callbackData,
        })),
      ),
    };
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    try {
      const token = this.getBotToken();
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
        }),
      });
    } catch (error) {
      console.warn("[Telegram] Falha ao responder callback_query", {
        callbackQueryId,
        ...formatErrorDetails(error),
      });
    }
  }
}
