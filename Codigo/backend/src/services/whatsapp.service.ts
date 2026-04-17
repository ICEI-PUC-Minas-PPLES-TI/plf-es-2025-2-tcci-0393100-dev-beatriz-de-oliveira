import type { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { ChatbotProcessResult } from "../modules/chatbot/types.js";
import type { WhatsAppRepository } from "../repositories/whatsapp.repository.js";
import type { Mensagem } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import { WhatsAppInboundBridgeService } from "./whatsapp/inbound/whatsapp-inbound-bridge.service.js";
import {
  extractMetaIncomingMessages,
  extractNormalizedIncomingMessages,
  type NormalizedInboundPayload,
  type WhatsAppWebhookEvent,
} from "./whatsapp/inbound/whatsapp-inbound-parser.js";
import type { WhatsAppConnectionStatus, WhatsAppProvider } from "./whatsapp/providers/whatsapp-provider.js";

interface SendManualMessageInput {
  atendimentoId?: number;
  telefone?: string;
  texto: string;
}

export class WhatsAppService {
  private readonly inboundBridge: WhatsAppInboundBridgeService;

  constructor(
    private readonly chatbotCore: ChatbotCoreService,
    private readonly repository: WhatsAppRepository,
    private readonly provider: WhatsAppProvider,
  ) {
    this.inboundBridge = new WhatsAppInboundBridgeService(chatbotCore, repository);
  }

  async processWebhookEvent(payload: WhatsAppWebhookEvent): Promise<ChatbotProcessResult> {
    // Meta mode: inbound arrives through Cloud API webhooks.
    const incomingMessages = extractMetaIncomingMessages(payload);
    return this.processInboundMessages(incomingMessages, payload, "meta_webhook");
  }

  async processNormalizedInbound(payload: NormalizedInboundPayload): Promise<ChatbotProcessResult> {
    // Web API mode: an external whatsapp-web.js gateway can POST here using the normalized payload contract.
    const incomingMessages = extractNormalizedIncomingMessages(payload);
    return this.processInboundMessages(incomingMessages, payload as unknown as Record<string, unknown>, "normalized_bridge");
  }

  listConversations() {
    return this.repository.listConversations();
  }

  listMessages(atendimentoId: number) {
    return this.repository.listMessages(atendimentoId);
  }

  async updateConversationStatus(atendimentoId: number, status: "ATIVO" | "PENDENTE" | "ENCERRADO") {
    const updated = await this.repository.updateConversationStatus(atendimentoId, status);

    if (!updated) {
      throw new AppError("Conversation not found", 404, "WHATSAPP_CONVERSATION_NOT_FOUND");
    }

    if (status === "PENDENTE") {
      this.chatbotCore.pauseConversation(updated.telefone);
    } else {
      this.chatbotCore.resumeConversation(updated.telefone);
    }

    return updated;
  }

  async sendManualMessage(input: SendManualMessageInput): Promise<Mensagem> {
    let phone = input.telefone;

    if (!phone && input.atendimentoId !== undefined) {
      const conversation = await this.repository.findConversationById(input.atendimentoId);
      if (!conversation) {
        throw new AppError("Conversation not found", 404, "WHATSAPP_CONVERSATION_NOT_FOUND");
      }
      phone = conversation.telefone;
    }

    if (!phone) {
      throw new AppError("Phone is required to send a WhatsApp message", 400, "WHATSAPP_PHONE_REQUIRED");
    }

    const delivery = await this.sendMessage(phone, input.texto, { throwOnMissingConfig: true });

    return this.repository.saveOutgoingMessage({
      atendimentoId: input.atendimentoId,
      phone,
      text: input.texto,
      messageId: delivery.messageId,
      statusEntrega: delivery.status,
      remetente: "atendente",
    });
  }

  getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    return this.provider.getConnectionStatus();
  }

  async reconnectProvider(): Promise<{ status: string; message: string }> {
    console.info("[WhatsAppService] provider_reconnect_requested", {
      provider: await this.resolveProviderName(),
    });
    return this.provider.reconnect();
  }

  async logoutProvider(): Promise<{ status: string; message: string }> {
    console.info("[WhatsAppService] provider_logout_requested", {
      provider: await this.resolveProviderName(),
    });
    return this.provider.logout();
  }

  async sendMessage(
    phone: string,
    text: string,
    options?: { throwOnMissingConfig?: boolean },
  ): Promise<{ messageId?: string; status: string }> {
    try {
      return await this.provider.sendTextMessage({ phone, text });
    } catch (error) {
      if (options?.throwOnMissingConfig) {
        throw error;
      }

      const isConfigError =
        error instanceof AppError &&
        ["WHATSAPP_OUTBOUND_NOT_CONFIGURED", "WHATSAPP_WEB_API_NOT_CONFIGURED"].includes(error.code ?? "");

      if (isConfigError) {
        return { status: "SKIPPED_NOT_CONFIGURED" };
      }

      throw error;
    }
  }

  private async processInboundMessages(
    incomingMessages: ReturnType<typeof extractMetaIncomingMessages>,
    payload: Record<string, unknown>,
    source: "meta_webhook" | "normalized_bridge",
  ): Promise<ChatbotProcessResult> {
    console.info("[WhatsAppService] inbound_received", {
      source,
      provider: source === "meta_webhook" ? "meta" : "web_api",
      messageCount: incomingMessages.length,
      phones: incomingMessages.slice(0, 5).map((message) => message.from),
    });

    const result = await this.inboundBridge.processMessages(incomingMessages, payload);

    for (const messageResult of result.messageResults ?? []) {
      if (messageResult.status !== "processed" || !messageResult.response) {
        continue;
      }

      const handoffRequested = messageResult.response.handoffRequested;
      const stage = messageResult.response.stateTransition?.stage;

      if (messageResult.response.capturedCustomerName) {
        await this.repository.updateCustomerNameByPhone(messageResult.phone, messageResult.response.capturedCustomerName);
      }

      try {
        const delivery = await this.sendMessage(messageResult.phone, messageResult.response.replyText, {
          throwOnMissingConfig: false,
        });

        await this.repository.saveOutgoingMessage({
          phone: messageResult.phone,
          text: messageResult.response.replyText,
          messageId: delivery.messageId,
          statusEntrega: delivery.status,
          handoffRequested,
          intent: messageResult.response.intent,
          stage,
        });
      } catch (error) {
        console.warn("[WhatsAppService] outbound_send_failed", {
          phone: messageResult.phone,
          intent: messageResult.response.intent,
          source,
          error: error instanceof Error ? error.message : "unknown_error",
        });

        await this.repository.saveOutgoingMessage({
          phone: messageResult.phone,
          text: messageResult.response.replyText,
          statusEntrega: "FALHA",
          handoffRequested,
          intent: messageResult.response.intent,
          stage,
        });
      }
    }

    return result;
  }

  private async resolveProviderName(): Promise<string> {
    try {
      const status = await this.provider.getConnectionStatus();
      return status.provider;
    } catch {
      return "unknown";
    }
  }
}
