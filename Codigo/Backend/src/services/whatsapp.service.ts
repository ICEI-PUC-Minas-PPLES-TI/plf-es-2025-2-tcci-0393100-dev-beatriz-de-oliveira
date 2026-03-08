import type { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { ChatbotProcessResult } from "../modules/chatbot/types.js";

export interface WhatsAppWebhookEvent extends Record<string, unknown> {}

export class WhatsAppService {
  constructor(private readonly chatbotCore: ChatbotCoreService) {}

  async processWebhookEvent(payload: WhatsAppWebhookEvent): Promise<ChatbotProcessResult> {
    const result = await this.chatbotCore.processEvent(payload);

    for (const response of result.responses) {
      console.log("[WhatsAppService] outbound_message_prepared", {
        to: response.leadUpdate?.phone ?? "unknown",
        intent: response.intent,
        text: response.replyText,
        handoffRequested: response.handoffRequested,
        actions: response.actions,
      });
    }

    return result;
  }
}

