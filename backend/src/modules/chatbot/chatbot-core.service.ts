import type { LeadsService } from "../../services/leads.service.js";
import type { ProductsService } from "../../services/products.service.js";
import { ConversationStateStore } from "./conversation-state.store.js";
import { parseProductChoice } from "./intent-detector.js";
import { MessageDedupStore } from "./message-dedup.store.js";
import { MessageProcessingQueue } from "./message-processing.queue.js";
import { normalizeIncomingMessage } from "./message-normalizer.js";
import { MessageRouter } from "./message-router.js";
import { GreetingHandler } from "./handlers/greeting.handler.js";
import { HumanHandoffHandler } from "./handlers/human-handoff.handler.js";
import { LeadHandler } from "./handlers/lead.handler.js";
import { MenuHandler } from "./handlers/menu.handler.js";
import { ProductsHandler } from "./handlers/products.handler.js";
import { PromotionsHandler } from "./handlers/promotions.handler.js";
import { UnknownHandler } from "./handlers/unknown.handler.js";
import type {
  ChatbotContext,
  ChatbotProcessResult,
  ChatbotResponse,
  WhatsAppIncomingMessage,
} from "./types.js";

interface LoggerLike {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
}

type ProcessedMessageResult =
  | { kind: "processed"; response: ChatbotResponse }
  | { kind: "duplicate" }
  | { kind: "error" };

function createDefaultLogger(): LoggerLike {
  return {
    info(payload, message) {
      console.log(message ?? "[ChatbotCore]", payload);
    },
    warn(payload, message) {
      console.warn(message ?? "[ChatbotCore]", payload);
    },
  };
}

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

function extractIncomingMessages(payload: Record<string, unknown>): WhatsAppIncomingMessage[] {
  const entries = asArray(payload.entry);
  const result: WhatsAppIncomingMessage[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) {
      continue;
    }

    const changes = asArray(entryRecord.changes);
    for (const change of changes) {
      const changeRecord = asRecord(change);
      const valueRecord = asRecord(changeRecord?.value);
      if (!valueRecord) {
        continue;
      }

      const contacts = asArray(valueRecord.contacts);
      const profileNameByPhone = new Map<string, string>();
      for (const contact of contacts) {
        const contactRecord = asRecord(contact);
        if (!contactRecord || typeof contactRecord.wa_id !== "string") {
          continue;
        }
        const profile = asRecord(contactRecord.profile);
        if (profile && typeof profile.name === "string") {
          profileNameByPhone.set(contactRecord.wa_id, profile.name);
        }
      }

      const messages = asArray(valueRecord.messages);
      for (const message of messages) {
        const messageRecord = asRecord(message);
        if (!messageRecord || typeof messageRecord.from !== "string") {
          continue;
        }

        const text = getTextContent(messageRecord);
        if (!text || !text.trim()) {
          continue;
        }

        const messageId =
          typeof messageRecord.id === "string" && messageRecord.id.trim().length > 0
            ? messageRecord.id
            : `${messageRecord.from}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const hasStableMessageId = typeof messageRecord.id === "string" && messageRecord.id.trim().length > 0;
        const timestamp = typeof messageRecord.timestamp === "string" ? messageRecord.timestamp : undefined;
        const profileName = profileNameByPhone.get(messageRecord.from);

        result.push({
          from: messageRecord.from,
          messageId,
          hasStableMessageId,
          timestamp,
          text,
          profileName,
          raw: messageRecord,
        });
      }
    }
  }

  return result;
}

export class ChatbotCoreService {
  private readonly router: MessageRouter;
  private readonly stateStore = new ConversationStateStore();
  private readonly dedupStore = new MessageDedupStore();
  private readonly processingQueue = new MessageProcessingQueue();

  constructor(
    dependencies: {
      productsService: ProductsService;
      leadsService: LeadsService;
      logger?: LoggerLike;
    },
  ) {
    this.logger = dependencies.logger ?? createDefaultLogger();
    this.router = new MessageRouter([
      new GreetingHandler(),
      new MenuHandler(),
      new ProductsHandler(dependencies.productsService),
      new PromotionsHandler(),
      new LeadHandler(dependencies.leadsService),
      new HumanHandoffHandler(dependencies.leadsService),
      new UnknownHandler(),
    ]);
  }

  private readonly logger: LoggerLike;

  private resolveSelectedProductName(normalizedText: string, productNames: string[]): string | undefined {
    if (productNames.length === 0) {
      return undefined;
    }
    const choiceIndex = parseProductChoice(normalizedText, productNames.length);
    if (choiceIndex === null) {
      return undefined;
    }
    return productNames[choiceIndex];
  }

  private async processSingleMessage(
    message: WhatsAppIncomingMessage,
    payload: Record<string, unknown>,
  ): Promise<ProcessedMessageResult> {
    this.logger.info(
      {
        event: "message_received",
        phone: message.from,
        messageId: message.messageId,
      },
      "[ChatbotCore]",
    );

    if (message.hasStableMessageId) {
      const shouldProcess = this.dedupStore.tryBegin(message.messageId);
      if (!shouldProcess) {
        this.logger.info(
          {
            event: "duplicate_ignored",
            phone: message.from,
            messageId: message.messageId,
          },
        "[ChatbotCore]",
      );
        return { kind: "duplicate" };
      }
    } else {
      this.logger.warn(
        {
          event: "message_without_stable_id",
          phone: message.from,
          messageId: message.messageId,
        },
        "[ChatbotCore]",
      );
    }

    this.logger.info(
      {
        event: "processing_started",
        phone: message.from,
        messageId: message.messageId,
      },
      "[ChatbotCore]",
    );

    try {
      const normalized = normalizeIncomingMessage(message);
      const state = this.stateStore.getOrCreate(normalized.from);
      const selectedProductName = this.resolveSelectedProductName(normalized.normalizedText, state.lastShownProducts);
      const nowIso = new Date().toISOString();

      const context: ChatbotContext = {
        message: normalized,
        state,
        nowIso,
        rawEvent: payload,
        selectedProductName,
      };

      const response = await this.router.route(context);

      const mergedPatch = {
        ...response.stateTransition,
        selectedProductName: response.stateTransition?.selectedProductName ?? selectedProductName ?? state.selectedProductName,
      };
      const nextState = this.stateStore.update(normalized.from, {
        intent: response.intent,
        now: nowIso,
        patch: mergedPatch,
      });

      this.logger.info(
        {
          event: "message_processed",
          phone: normalized.from,
          messageId: normalized.messageId,
          currentStage: state.stage,
          nextStage: nextState.stage,
          intent: response.intent,
          handler: response.handler,
          actions: response.actions,
          handoffRequested: response.handoffRequested,
          responsePreview: response.replyText.slice(0, 100),
        },
        "[ChatbotCore]",
      );

      if (message.hasStableMessageId) {
        this.dedupStore.markDone(message.messageId);
      }

      this.logger.info(
        {
          event: "processing_finished",
          phone: message.from,
          messageId: message.messageId,
        },
        "[ChatbotCore]",
      );

      return { kind: "processed", response };
    } catch (error) {
      if (message.hasStableMessageId) {
        this.dedupStore.markFailed(message.messageId);
      }
      this.logger.warn(
        {
          event: "processing_failed",
          phone: message.from,
          messageId: message.messageId,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "[ChatbotCore]",
      );
      return { kind: "error" };
    }
  }

  async processEvent(payload: Record<string, unknown>): Promise<ChatbotProcessResult> {
    const messages = extractIncomingMessages(payload);

    if (messages.length === 0) {
      this.logger.info({ event: "ignored_event", reason: "no_supported_messages" }, "[ChatbotCore]");
      return {
        consumed: false,
        extractedMessages: 0,
        responses: [],
        reason: "no_supported_messages",
      };
    }

    this.logger.info({ event: "messages_received", count: messages.length }, "[ChatbotCore]");

    const tasks = messages.map((message) => {
      this.logger.info(
        {
          event: "message_enqueued",
          phone: message.from,
          messageId: message.messageId,
        },
        "[ChatbotCore]",
      );
      return this.processingQueue.enqueue(message.from, () => this.processSingleMessage(message, payload));
    });

    const processed = await Promise.all(tasks);
    const responses = processed
      .filter((result): result is { kind: "processed"; response: ChatbotResponse } => result.kind === "processed")
      .map((result) => result.response);
    const ignoredDuplicates = processed.filter((result) => result.kind === "duplicate").length;
    const failedMessages = processed.filter((result) => result.kind === "error").length;

    return {
      consumed: true,
      extractedMessages: messages.length,
      responses,
      ignoredDuplicates,
      failedMessages,
    };
  }
}
