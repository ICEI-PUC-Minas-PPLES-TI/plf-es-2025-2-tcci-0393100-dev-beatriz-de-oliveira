import { env } from "../config/env.js";
import type { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { ChatbotProcessResult, ChatbotResponse } from "../modules/chatbot/types.js";
import type { Produto } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import type { ProductsService } from "./products.service.js";
import { buildTelegramPhotoCaption, buildTelegramPreparedResponse, buildTelegramTextCard } from "./telegram/telegram-product-response.js";
import { parseTelegramUpdate, type TelegramWebhookPayload } from "./telegram/telegram-update-parser.js";

type TelegramApiErrorPayload = {
  description?: string;
};

export class TelegramService {
  constructor(
    private readonly chatbotCore: ChatbotCoreService,
    private readonly productsService: ProductsService,
  ) {}

  async processWebhookEvent(payload: TelegramWebhookPayload): Promise<ChatbotProcessResult> {
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
    console.info("[Telegram] Webhook recebido", {
      chatId: message.from,
      messageId: message.messageId,
    });

    let result: ChatbotProcessResult;
    try {
      result = await this.chatbotCore.processIncomingMessages([message], payload as Record<string, unknown>);
    } catch (error) {
      console.warn("[Telegram] Erro ao processar mensagem", {
        chatId: message.from,
        messageId: message.messageId,
        error: error instanceof Error ? error.message : "unknown_error",
      });
      return {
        consumed: false,
        extractedMessages: 1,
        responses: [],
        messageResults: [],
        reason: "chatbot_processing_failed",
      };
    }

    for (const messageResult of result.messageResults ?? []) {
      if (messageResult.status !== "processed" || !messageResult.response) {
        continue;
      }

      try {
        await this.sendChatbotResponse(messageResult.phone, messageResult.response);
        console.info("[Telegram] Mensagem processada", {
          chatId: messageResult.phone,
          messageId: messageResult.messageId,
          intent: messageResult.response.intent,
        });
      } catch (error) {
        console.warn("[Telegram] Erro ao enviar mensagem", {
          chatId: messageResult.phone,
          messageId: messageResult.messageId,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    return result;
  }

  private async sendChatbotResponse(chatId: string, response: ChatbotResponse): Promise<void> {
    if (!response.replyText?.trim()) {
      console.warn("[Telegram] Resposta vazia do chatbot", {
        chatId,
        intent: response.intent,
      });
      return;
    }

    const products = await this.findProductsForResponse(response);
    const prepared = buildTelegramPreparedResponse(response, products);

    if (prepared.productCards.length === 0) {
      await this.sendTextMessage(chatId, prepared.fallbackText ?? response.replyText);
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

  private async sendTextMessage(chatId: string, text: string): Promise<void> {
    const token = this.getBotToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
      throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_FAILED");
    }
  }

  private async sendPhotoMessage(chatId: string, photoUrl: string, caption: string): Promise<void> {
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
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
      throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_PHOTO_FAILED");
    }
  }

  private getBotToken(): string {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      throw new AppError("Telegram bot token is not configured", 503, "TELEGRAM_BOT_NOT_CONFIGURED");
    }
    return token;
  }
}
