import { env } from "../config/env.js";
import type { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { ChatbotProcessResult, ChatbotProcessedMessage, WhatsAppIncomingMessage } from "../modules/chatbot/types.js";
import type { Mensagem } from "../types/domain.js";
import type { WhatsAppRepository } from "../repositories/whatsapp.repository.js";
import type { LeadStatusService } from "./lead-status.service.js";
import { AppError } from "../utils/app-error.js";

export interface WhatsAppWebhookEvent extends Record<string, unknown> {}

interface SendManualMessageInput {
  atendimentoId?: number;
  telefone?: string;
  texto: string;
}

type ExtractedWebhookMessage = {
  from: string;
  text: string;
  messageId: string;
  hasStableMessageId: boolean;
  timestamp?: string;
  profileName?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getTextContent(message: Record<string, unknown>): string | null {
  const type = typeof message.type === "string" ? message.type : "";
  const textNode = asRecord(message.text);
  if (type === "text" && textNode && typeof textNode.body === "string") {
    return textNode.body;
  }

  const buttonNode = asRecord(message.button);
  if (buttonNode && typeof buttonNode.text === "string") {
    return buttonNode.text;
  }

  const interactiveNode = asRecord(message.interactive);
  if (interactiveNode) {
    const buttonReply = asRecord(interactiveNode.button_reply);
    if (buttonReply && typeof buttonReply.title === "string") {
      return buttonReply.title;
    }
    const listReply = asRecord(interactiveNode.list_reply);
    if (listReply && typeof listReply.title === "string") {
      return listReply.title;
    }
  }

  return null;
}

function extractIncomingMessages(payload: Record<string, unknown>): ExtractedWebhookMessage[] {
  const entries = asArray(payload.entry);
  const result: ExtractedWebhookMessage[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) continue;

    for (const change of asArray(entryRecord.changes)) {
      const changeRecord = asRecord(change);
      const valueRecord = asRecord(changeRecord?.value);
      if (!valueRecord) continue;

      const contacts = asArray(valueRecord.contacts);
      const namesByPhone = new Map<string, string>();
      for (const contact of contacts) {
        const contactRecord = asRecord(contact);
        if (!contactRecord || typeof contactRecord.wa_id !== "string") continue;
        const profile = asRecord(contactRecord.profile);
        if (profile && typeof profile.name === "string") {
          namesByPhone.set(contactRecord.wa_id, profile.name);
        }
      }

      for (const message of asArray(valueRecord.messages)) {
        const messageRecord = asRecord(message);
        if (!messageRecord || typeof messageRecord.from !== "string") continue;
        const text = getTextContent(messageRecord);
        if (!text || !text.trim()) continue;

        const stableId = typeof messageRecord.id === "string" && messageRecord.id.trim().length > 0;
        result.push({
          from: messageRecord.from,
          text,
          messageId: stableId
            ? (messageRecord.id as string)
            : `${messageRecord.from}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          hasStableMessageId: stableId,
          timestamp: typeof messageRecord.timestamp === "string" ? messageRecord.timestamp : undefined,
          profileName: namesByPhone.get(messageRecord.from),
        });
      }
    }
  }

  return result;
}

function toIncomingChatbotMessage(
  message: ExtractedWebhookMessage,
  currentCustomerName?: string,
): WhatsAppIncomingMessage {
  return {
    from: message.from,
    messageId: message.messageId,
    hasStableMessageId: message.hasStableMessageId,
    timestamp: message.timestamp,
    text: message.text,
    profileName: message.profileName,
    currentCustomerName,
    raw: {
      from: message.from,
      id: message.messageId,
      timestamp: message.timestamp,
      text: { body: message.text },
    },
  };
}

export class WhatsAppService {
  constructor(
    private readonly chatbotCore: ChatbotCoreService,
    private readonly repository: WhatsAppRepository,
    private readonly leadStatusService: LeadStatusService,
  ) {}

  async processWebhookEvent(payload: WhatsAppWebhookEvent): Promise<ChatbotProcessResult> {
    const incomingMessages = extractIncomingMessages(payload);
    const processableMessages: WhatsAppIncomingMessage[] = [];
    const suppressedByMessageId = new Map<string, ChatbotProcessedMessage>();

    for (const message of incomingMessages) {
      const runtimeState = await this.repository.getConversationAutomationStateByPhone(message.from);
      const isHumanHandoffActive = Boolean(
        runtimeState &&
          runtimeState.status !== "ENCERRADO" &&
          (runtimeState.handoffRequested || runtimeState.stage === "ENCAMINHADO_HUMANO"),
      );

      if (isHumanHandoffActive) {
        this.chatbotCore.pauseConversation(message.from);
        const savedConversation = await this.repository.saveIncomingMessage({
          phone: message.from,
          customerName: message.profileName,
          text: message.text,
          messageId: message.messageId,
          timestamp: message.timestamp,
          status: runtimeState?.status ?? "PENDENTE",
          handoffRequested: true,
          intent: runtimeState?.intent ?? "human_handoff",
          stage: runtimeState?.stage ?? "ENCAMINHADO_HUMANO",
        });
        await this.leadStatusService.updateLeadStatusFromConversation(savedConversation.atendimentoId);

        suppressedByMessageId.set(message.messageId, {
          phone: message.from,
          messageId: message.messageId,
          originalText: message.text,
          profileName: message.profileName,
          status: "suppressed",
        });

        console.info("[WhatsAppService] message_suppressed_human_handoff", {
          phone: message.from,
          messageId: message.messageId,
          atendimentoId: runtimeState?.atendimentoId,
        });
        continue;
      }

      if (runtimeState && (runtimeState.status === "ENCERRADO" || runtimeState.handoffRequested)) {
        this.chatbotCore.resumeConversation(message.from);
      }

      const savedConversation = await this.repository.saveIncomingMessage({
        phone: message.from,
        customerName: message.profileName,
        text: message.text,
        messageId: message.messageId,
        timestamp: message.timestamp,
        status: "ATIVO",
        handoffRequested: false,
        intent: runtimeState?.intent ?? undefined,
        stage: runtimeState?.status === "ENCERRADO" ? "IDLE" : undefined,
      });
      await this.leadStatusService.updateLeadStatusFromConversation(savedConversation.atendimentoId);

      const latestState = await this.repository.getConversationAutomationStateByPhone(message.from);
      processableMessages.push(toIncomingChatbotMessage(message, latestState?.customerName ?? undefined));
    }

    const processedResult = await this.chatbotCore.processIncomingMessages(processableMessages, payload);

    for (const messageResult of processedResult.messageResults ?? []) {
      if (messageResult.status !== "processed" || !messageResult.response) {
        continue;
      }

      const handoffRequested = messageResult.response.handoffRequested;
      const stage = messageResult.response.stateTransition?.stage;

      if (messageResult.response.capturedCustomerName) {
        await this.repository.updateCustomerNameByPhone(messageResult.phone, messageResult.response.capturedCustomerName);
      }

      try {
        const outboundMessages = messageResult.response.replyMessages?.filter((message) => message.trim()) ?? [messageResult.response.replyText];

        for (const outboundText of outboundMessages) {
          const delivery = await this.sendMessage(messageResult.phone, outboundText, {
            throwOnMissingConfig: false,
          });

          const savedMessage = await this.repository.saveOutgoingMessage({
            phone: messageResult.phone,
            text: outboundText,
            messageId: delivery.messageId,
            statusEntrega: delivery.status,
            handoffRequested,
            intent: messageResult.response.intent,
            stage,
          });
          const conversationId =
            savedMessage.conversationId
            ?? (await this.repository.getConversationAutomationStateByPhone(messageResult.phone))?.atendimentoId;
          if (conversationId) {
            await this.leadStatusService.updateLeadStatusFromConversation(conversationId);
          }
        }
      } catch (error) {
        console.warn("[WhatsAppService] outbound_send_failed", {
          phone: messageResult.phone,
          error: error instanceof Error ? error.message : "unknown_error",
        });

        const failedText = messageResult.response.replyMessages?.join("\n\n") ?? messageResult.response.replyText;
        const savedMessage = await this.repository.saveOutgoingMessage({
          phone: messageResult.phone,
          text: failedText,
          statusEntrega: "FALHA",
          handoffRequested,
          intent: messageResult.response.intent,
          stage,
        });
        const conversationId =
          savedMessage.conversationId
          ?? (await this.repository.getConversationAutomationStateByPhone(messageResult.phone))?.atendimentoId;
        if (conversationId) {
          await this.leadStatusService.updateLeadStatusFromConversation(conversationId);
        }
      }
    }

    const mergedMessageResults = incomingMessages.map((message) => {
      const suppressed = suppressedByMessageId.get(message.messageId);
      if (suppressed) {
        return suppressed;
      }

      return (
        processedResult.messageResults?.find((item) => item.messageId === message.messageId) ?? {
          phone: message.from,
          messageId: message.messageId,
          originalText: message.text,
          profileName: message.profileName,
          status: "error" as const,
        }
      );
    });

    return {
      consumed: incomingMessages.length > 0,
      extractedMessages: incomingMessages.length,
      responses: processedResult.responses,
      messageResults: mergedMessageResults,
      ignoredDuplicates: processedResult.ignoredDuplicates,
      failedMessages: processedResult.failedMessages,
      reason: processedResult.reason,
    };
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

    await this.leadStatusService.updateLeadStatusFromConversation(updated.id);

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

    const savedMessage = await this.repository.saveOutgoingMessage({
      atendimentoId: input.atendimentoId,
      phone,
      text: input.texto,
      messageId: delivery.messageId,
      statusEntrega: delivery.status,
      remetente: "ATENDENTE",
    });

    if (savedMessage.conversationId) {
      await this.leadStatusService.updateLeadStatusFromConversation(savedMessage.conversationId);
    }

    return savedMessage;
  }

  async sendMessage(
    phone: string,
    text: string,
    options?: { throwOnMissingConfig?: boolean },
  ): Promise<{ messageId?: string; status: string }> {
    const token = env.WHATSAPP_META_TOKEN?.trim();
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    if (!token || !phoneNumberId) {
      if (options?.throwOnMissingConfig) {
        throw new AppError("WhatsApp outbound is not configured", 503, "WHATSAPP_OUTBOUND_NOT_CONFIGURED");
      }

      return { status: "SKIPPED_NOT_CONFIGURED" };
    }

    const response = await fetch(
      `${env.WHATSAPP_GRAPH_BASE_URL}/${env.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: text },
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message = payload?.error?.message ?? `WhatsApp API returned ${response.status}`;
      throw new AppError(message, 502, "WHATSAPP_SEND_FAILED");
    }

    return {
      messageId: payload?.messages?.[0]?.id,
      status: "ENVIADA",
    };
  }
}

