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

const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

type TelegramDeliveryOptions = {
  atendimentoId?: number;
  sender?: "CHATBOT" | "ATENDENTE";
  status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
  handoffRequested?: boolean;
  intent?: string;
  stage?: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDataUrl(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

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
      console.info("[TelegramCallback] answer_callback_query_ok", {
        callbackId: parsed.callbackQueryId,
      });
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

    const runtimeState = await this.repository.getConversationAutomationStateByChatId(message.from);
    this.chatbotCore.hydrateConversationState(message.from, runtimeState);
    const isHumanHandoffActive = Boolean(
      runtimeState &&
        runtimeState.status !== "ENCERRADO" &&
        (runtimeState.handoffRequested || runtimeState.stage === "ENCAMINHADO_HUMANO"),
    );

    if (isHumanHandoffActive) {
      this.chatbotCore.pauseConversation(message.from);
      const savedConversation = await this.repository.saveIncomingMessage({
        chatId: message.from,
        customerName: message.profileName,
        text: message.text,
        messageId: message.messageId,
        timestamp: message.timestamp,
        status: "PENDENTE",
        handoffRequested: true,
        intent: runtimeState?.intent ?? "human_handoff",
        stage: runtimeState?.stage ?? "ENCAMINHADO_HUMANO",
      });

      try {
        await this.leadStatusService.updateLeadStatusFromConversation(savedConversation.atendimentoId);
      } catch (error) {
        console.error("[TelegramService] lead_status_sync_failed", {
          chatId: message.from,
          atendimentoId: savedConversation.atendimentoId,
          ...formatErrorDetails(error),
        });
      }

      console.info("[TelegramService] inbound_suppressed_handoff", {
        chatId: message.from,
        atendimentoId: savedConversation.atendimentoId,
        messageId: message.messageId,
      });

      return {
        consumed: true,
        extractedMessages: 1,
        responses: [],
        messageResults: [
          {
            phone: message.from,
            messageId: message.messageId,
            originalText: message.text,
            profileName: message.profileName,
            status: "suppressed",
          },
        ],
      };
    }

    if (runtimeState && (runtimeState.status === "ENCERRADO" || runtimeState.handoffRequested)) {
      this.chatbotCore.resumeConversation(message.from);
    }

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
        status: "ATIVO",
        handoffRequested: false,
        intent: runtimeState?.intent ?? undefined,
        stage: runtimeState?.status === "ENCERRADO" ? "IDLE" : undefined,
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

    try {
      await this.leadStatusService.updateLeadStatusFromConversation(savedConversation.atendimentoId);
    } catch (error) {
      console.error("[TelegramService] lead_status_sync_failed", {
        chatId: message.from,
        atendimentoId: savedConversation.atendimentoId,
        ...formatErrorDetails(error),
      });
    }

    console.info("[Telegram] Webhook recebido", {
      chatId: message.from,
      messageId: message.messageId,
    });

    let result: ChatbotProcessResult;
    try {
      result = await this.chatbotCore.processIncomingMessages([message], payload as Record<string, unknown>);
    } catch (error) {
      if (parsed.callbackQueryId) {
        console.error("[TelegramCallback] erro completo", {
          callbackId: parsed.callbackQueryId,
          chatId: message.from,
          messageId: message.messageId,
          ...formatErrorDetails(error),
        });
      }
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
        if (parsed.callbackQueryId) {
          console.info("[TelegramCallback] resposta_enviada", {
            callbackId: parsed.callbackQueryId,
            chatId: messageResult.phone,
            intent: messageResult.response.intent,
            handler: messageResult.response.handler,
          });
        }
        console.info("[Telegram] Mensagem processada", {
          chatId: messageResult.phone,
          messageId: messageResult.messageId,
          intent: messageResult.response.intent,
        });
      } catch (error) {
        if (parsed.callbackQueryId) {
          console.error("[TelegramCallback] erro completo", {
            callbackId: parsed.callbackQueryId,
            chatId: messageResult.phone,
            messageId: messageResult.messageId,
            ...formatErrorDetails(error),
          });
        }
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
    console.info("[TelegramManualSend] start", {
      atendimentoId: input.atendimentoId ?? null,
      chatId: input.chatId ?? null,
      preview: input.texto.slice(0, 80),
    });

    let chatId = input.chatId?.trim();

    if (!chatId && input.atendimentoId !== undefined) {
      const conversation = await this.repository.findConversationById(input.atendimentoId);
      if (!conversation) {
        throw new AppError("Conversation not found", 404, "TELEGRAM_CONVERSATION_NOT_FOUND");
      }
      chatId = conversation.chatId;
      console.info("[TelegramManualSend] conversation_found", {
        atendimentoId: conversation.atendimentoId,
        chatId: conversation.chatId,
      });
    }

    if (!chatId) {
      throw new AppError("Telegram chat id is required", 400, "TELEGRAM_CHAT_ID_REQUIRED");
    }

    try {
      const savedMessage = await this.sendTextMessage(chatId, input.texto, undefined, {
        atendimentoId: input.atendimentoId,
        sender: "ATENDENTE",
        status: "PENDENTE",
        handoffRequested: true,
        intent: "human_handoff",
        stage: "ENCAMINHADO_HUMANO",
      });

      console.info("[TelegramManualSend] completed", {
        atendimentoId: savedMessage.conversationId ?? input.atendimentoId ?? null,
        chatId,
        messageId: savedMessage.id,
      });

      return savedMessage;
    } catch (error) {
      console.error("[TelegramManualSend] failed", {
        atendimentoId: input.atendimentoId ?? null,
        chatId,
        error: formatErrorDetails(error),
      });
      throw error;
    }
  }

  async updateConversationStatus(conversationId: number, status: "ATIVO" | "PENDENTE" | "ENCERRADO") {
    const conversation = await this.repository.findConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "TELEGRAM_CONVERSATION_NOT_FOUND");
    }

    const updated = await this.repository.updateConversationStatus(conversationId, status);
    if (!updated) {
      throw new AppError("Conversation not found", 404, "TELEGRAM_CONVERSATION_NOT_FOUND");
    }

    if (status === "ATIVO") {
      this.chatbotCore.resumeConversation(conversation.chatId);
    } else {
      this.chatbotCore.pauseConversation(conversation.chatId);
    }

    return updated;
  }

  private buildDeliveryState(response: ChatbotResponse) {
    return {
      sender: "CHATBOT" as const,
      status: response.handoffRequested ? "PENDENTE" as const : "ATIVO" as const,
      handoffRequested: response.handoffRequested,
      intent: response.intent,
      stage: response.stateTransition?.stage,
    };
  }

  private async sendChatbotResponse(chatId: string, response: ChatbotResponse): Promise<void> {
    const deliveryState = this.buildDeliveryState(response);

    if (!response.replyText?.trim()) {
      console.warn("[Telegram] Resposta vazia do chatbot", {
        chatId,
        intent: response.intent,
      });
      return;
    }

    const replyMessages = response.replyMessages?.filter((message) => message.trim()) ?? [];
    const shouldRenderProductCards =
      response.intent === "products"
      && response.actions.some((action) => ["product_details", "product_gallery"].includes(action));

    if (replyMessages.length > 0 && !shouldRenderProductCards) {
      for (let index = 0; index < replyMessages.length; index += 1) {
        const isLastMessage = index === replyMessages.length - 1;
        await this.sendTextMessage(
          chatId,
          replyMessages[index]!,
          isLastMessage ? response.telegram?.inlineKeyboard : undefined,
          deliveryState,
        );
      }
      return;
    }

    const products = await this.findProductsForResponse(response);
    const prepared = buildTelegramPreparedResponse(response, products);
    const inlineKeyboard = response.telegram?.inlineKeyboard;

    if (prepared.productCards.length === 0) {
      await this.sendTextMessage(chatId, prepared.fallbackText ?? response.replyText, inlineKeyboard, deliveryState);
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        intent: response.intent,
      });
      return;
    }

    const introText =
      prepared.introText
      && !response.actions.includes("product_gallery")
      && !(shouldRenderProductCards && prepared.productCards.length === 1)
        ? prepared.introText
        : undefined;

    if (introText) {
      await this.sendTextMessage(chatId, introText, undefined, deliveryState);
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        intent: response.intent,
        kind: "intro",
      });
    }

    if (response.actions.includes("product_gallery")) {
      const card = prepared.productCards[0];
      const galleryImages = card?.images.filter((image) => image !== card.imageUrl).slice(0, 3) ?? [];

      if (card && galleryImages.length > 0) {
        try {
          await this.sendMediaGroup(chatId, galleryImages, deliveryState);
          console.info("[Telegram] Galeria enviada", {
            chatId,
            product: card.name,
            images: galleryImages.length,
          });
        } catch (error) {
          console.warn("[Telegram] Erro ao enviar galeria", {
            chatId,
            product: card.name,
            error: formatErrorDetails(error),
          });
          await this.sendTextMessage(chatId, buildTelegramTextCard(card), undefined, deliveryState);
        }
      } else {
        await this.sendTextMessage(chatId, "Esse produto nao tem fotos extras cadastradas.", undefined, deliveryState);
      }

      if (inlineKeyboard?.length) {
        await this.sendTextMessage(chatId, response.telegram?.keyboardPrompt ?? "Escolha uma opcao para continuar.", inlineKeyboard, deliveryState);
      }
      return;
    }

    for (const card of prepared.productCards) {
      if (card.imageUrl) {
        try {
          await this.sendPhoto(chatId, card.imageUrl, buildTelegramPhotoCaption(card), inlineKeyboard, deliveryState);
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

      await this.sendTextMessage(chatId, buildTelegramTextCard(card), inlineKeyboard, deliveryState);
      console.info("[Telegram] Resposta enviada em texto", {
        chatId,
        product: card.name,
        kind: "product_fallback",
      });
    }

    if (inlineKeyboard?.length && prepared.productCards.length > 1) {
      await this.sendTextMessage(chatId, response.telegram?.keyboardPrompt ?? "Escolha uma opção para continuar.", inlineKeyboard, deliveryState);
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
    options?: {
      atendimentoId?: number;
      sender?: "CHATBOT" | "ATENDENTE";
      status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
      handoffRequested?: boolean;
      intent?: string;
      stage?: string;
    },
  ): Promise<Mensagem> {
    try {
      console.info("[TelegramOutbound] send_text_start", {
        chatId,
        sender: options?.sender ?? "CHATBOT",
        status: options?.status ?? null,
        handoffRequested: options?.handoffRequested ?? false,
        stage: options?.stage ?? null,
        preview: text.slice(0, 80),
      });
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

      console.info("[TelegramOutbound] send_text_success", {
        chatId,
        sender: options?.sender ?? "CHATBOT",
      });

      const savedMessage = await this.repository.saveOutgoingMessage({
        atendimentoId: options?.atendimentoId,
        chatId,
        text,
        type: "text",
        statusEntrega: "ENVIADA",
        sender: options?.sender ?? "CHATBOT",
        status: options?.status,
        handoffRequested: options?.handoffRequested,
        intent: options?.intent,
        stage: options?.stage,
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
      console.info("[TelegramOutbound] response_ready", {
        chatId,
        conversationId: savedMessage.conversationId ?? null,
        messageId: savedMessage.id,
      });
      return savedMessage;
    } catch (error) {
      const failedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text,
        type: "text",
        statusEntrega: "FALHA",
        sender: options?.sender ?? "CHATBOT",
        status: options?.status,
        handoffRequested: options?.handoffRequested,
        intent: options?.intent,
        stage: options?.stage,
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
      console.error("[TelegramOutbound] send_text_failed", {
        chatId,
        sender: options?.sender ?? "CHATBOT",
        error: formatErrorDetails(error),
      });
      throw error;
    }
  }

  async sendPhoto(
    chatId: string,
    photoUrl: string,
    caption: string,
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>,
    options?: TelegramDeliveryOptions,
  ): Promise<void> {
    try {
      const token = this.getBotToken();
      const safeCaption = caption.slice(0, TELEGRAM_CAPTION_LIMIT);
      const response = await this.postTelegramPhoto(token, chatId, photoUrl, safeCaption, inlineKeyboard);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
        throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_PHOTO_FAILED");
      }

      const savedMessage = await this.repository.saveOutgoingMessage({
        atendimentoId: options?.atendimentoId,
        chatId,
        text: safeCaption,
        type: "image",
        statusEntrega: "ENVIADA",
        sender: options?.sender ?? "CHATBOT",
        status: options?.status,
        handoffRequested: options?.handoffRequested,
        intent: options?.intent,
        stage: options?.stage,
      });
      console.info("[TelegramService] outbound_persisted", {
        chatId,
        conversationId: savedMessage.conversationId,
        type: "image",
        deliveryStatus: "ENVIADA",
        preview: safeCaption.slice(0, 80),
      });
      if (savedMessage.conversationId) {
        await this.leadStatusService.updateLeadStatusFromConversation(savedMessage.conversationId);
      }
    } catch (error) {
      const failedMessage = await this.repository.saveOutgoingMessage({
        chatId,
        text: caption.slice(0, TELEGRAM_CAPTION_LIMIT),
        type: "image",
        statusEntrega: "FALHA",
        sender: options?.sender ?? "CHATBOT",
        status: options?.status,
        handoffRequested: options?.handoffRequested,
        intent: options?.intent,
        stage: options?.stage,
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

  async sendMediaGroup(chatId: string, imageUrls: string[], options?: TelegramDeliveryOptions): Promise<void> {
    const limitedImages = imageUrls.filter((imageUrl) => imageUrl.trim()).slice(0, 3);
    if (limitedImages.length === 0) {
      throw new AppError("Media group requires at least one image", 400, "TELEGRAM_MEDIA_GROUP_EMPTY");
    }

    const token = this.getBotToken();
    const formData = new FormData();
    formData.set("chat_id", chatId);

    const media = limitedImages.map((imageUrl, index) => {
      const dataUrl = parseDataUrl(imageUrl);
      if (dataUrl) {
        const attachmentName = `photo_${index}`;
        formData.set(attachmentName, new Blob([toArrayBuffer(dataUrl.bytes)], { type: dataUrl.mimeType }), `${attachmentName}.jpg`);
        return { type: "photo", media: `attach://${attachmentName}` };
      }

      if (!isHttpUrl(imageUrl)) {
        throw new AppError("Invalid Telegram media URL", 400, "TELEGRAM_INVALID_MEDIA_URL");
      }

      return { type: "photo", media: imageUrl };
    });

    formData.set("media", JSON.stringify(media));

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as TelegramApiErrorPayload | null;
      throw new AppError(payload?.description ?? `Telegram API returned ${response.status}`, 502, "TELEGRAM_SEND_MEDIA_GROUP_FAILED");
    }

    const savedMessage = await this.repository.saveOutgoingMessage({
      atendimentoId: options?.atendimentoId,
      chatId,
      text: `Galeria de produto (${limitedImages.length} foto${limitedImages.length === 1 ? "" : "s"})`,
      type: "image",
      statusEntrega: "ENVIADA",
      sender: options?.sender ?? "CHATBOT",
      status: options?.status,
      handoffRequested: options?.handoffRequested,
      intent: options?.intent,
      stage: options?.stage,
    });

    if (savedMessage.conversationId) {
      await this.leadStatusService.updateLeadStatusFromConversation(savedMessage.conversationId);
    }
  }

  private async postTelegramPhoto(
    token: string,
    chatId: string,
    photoUrl: string,
    caption: string,
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>,
  ): Promise<Response> {
    const dataUrl = parseDataUrl(photoUrl);
    if (dataUrl) {
      const formData = new FormData();
      formData.set("chat_id", chatId);
      formData.set("photo", new Blob([toArrayBuffer(dataUrl.bytes)], { type: dataUrl.mimeType }), "product.jpg");
      formData.set("caption", caption);
      const replyMarkup = this.buildReplyMarkup(inlineKeyboard);
      if (replyMarkup) {
        formData.set("reply_markup", JSON.stringify(replyMarkup));
      }

      return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
      });
    }

    if (!isHttpUrl(photoUrl)) {
      throw new AppError("Invalid Telegram photo URL", 400, "TELEGRAM_INVALID_PHOTO_URL");
    }

    return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
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
      signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
    });
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
