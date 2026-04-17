import type { ChatbotCoreService } from "../../../modules/chatbot/chatbot-core.service.js";
import type { ChatbotProcessResult, ChatbotProcessedMessage, WhatsAppIncomingMessage } from "../../../modules/chatbot/types.js";
import type { WhatsAppRepository } from "../../../repositories/whatsapp.repository.js";
import type { NormalizedInboundMessage } from "./whatsapp-inbound-parser.js";
import { toIncomingChatbotMessage } from "./whatsapp-inbound-parser.js";

export class WhatsAppInboundBridgeService {
  constructor(
    private readonly chatbotCore: ChatbotCoreService,
    private readonly repository: WhatsAppRepository,
  ) {}

  async processMessages(
    incomingMessages: NormalizedInboundMessage[],
    payload: Record<string, unknown>,
  ): Promise<ChatbotProcessResult> {
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
        await this.repository.saveIncomingMessage({
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

        suppressedByMessageId.set(message.messageId, {
          phone: message.from,
          messageId: message.messageId,
          originalText: message.text,
          profileName: message.profileName,
          status: "suppressed",
        });

        console.info("[WhatsAppInboundBridgeService] message_suppressed_human_handoff", {
          phone: message.from,
          messageId: message.messageId,
          atendimentoId: runtimeState?.atendimentoId,
        });
        continue;
      }

      if (runtimeState && (runtimeState.status === "ENCERRADO" || runtimeState.handoffRequested)) {
        this.chatbotCore.resumeConversation(message.from);
      }

      await this.repository.saveIncomingMessage({
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

      const latestState = await this.repository.getConversationAutomationStateByPhone(message.from);
      processableMessages.push(toIncomingChatbotMessage(message, latestState?.customerName ?? undefined));
    }

    const processedResult = await this.chatbotCore.processIncomingMessages(processableMessages, payload);

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
}
