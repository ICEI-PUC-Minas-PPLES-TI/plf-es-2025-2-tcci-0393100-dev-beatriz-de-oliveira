import type { LeadsService } from "../../services/leads.service.js";
import type { ProductsService } from "../../services/products.service.js";
import type { PromotionsService } from "../../services/promotions.service.js";
import { ConversationStateStore } from "./conversation-state.store.js";
import { detectIntent, parseProductChoice } from "./intent-detector.js";
import { MessageDedupStore } from "./message-dedup.store.js";
import { MessageProcessingQueue } from "./message-processing.queue.js";
import { normalizeIncomingMessage, normalizeMessageText } from "./message-normalizer.js";
import { findMatchingProducts } from "./product-resolver.js";
import { MessageRouter } from "./message-router.js";
import { GreetingHandler } from "./handlers/greeting.handler.js";
import {
  buildCommercialHandoffText,
  buildHandoffKeyboard,
  buildProductActionsKeyboard,
  buildProductListKeyboard,
} from "./handlers/shared.js";
import { HumanHandoffHandler } from "./handlers/human-handoff.handler.js";
import { LeadHandler } from "./handlers/lead.handler.js";
import { MenuHandler } from "./handlers/menu.handler.js";
import { ProductsHandler } from "./handlers/products.handler.js";
import { PromotionsHandler } from "./handlers/promotions.handler.js";
import { UnknownHandler } from "./handlers/unknown.handler.js";
import type {
  ChatbotContext,
  ChatbotConversationState,
  ChatbotIntent,
  ChatbotProcessResult,
  ChatbotProcessedMessage,
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
  | { kind: "suppressed" }
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

function buildInterestSummary(messageText: string): string {
  return messageText.slice(0, 140) || "Interesse informado no WhatsApp";
}

function resolveProductNameFromText(normalizedText: string, productNames: string[]): string | undefined {
  return productNames.find((productName) => normalizedText.includes(normalizeMessageText(productName)));
}

function toCurrency(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hasMeaningfulCustomerName(name?: string | null): boolean {
  if (!name) {
    return false;
  }

  const normalized = normalizeMessageText(name).trim();
  if (!normalized) {
    return false;
  }

  return !["cliente whatsapp", "cliente sem nome", "contato whatsapp", "contato sem nome"].includes(normalized);
}

function formatCustomerName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractCustomerNameCandidate(originalText: string): string | null {
  const cleaned = originalText
    .trim()
    .replace(/^meu nome e\s+/i, "")
    .replace(/^meu nome eh\s+/i, "")
    .replace(/^sou a\s+/i, "")
    .replace(/^sou o\s+/i, "")
    .replace(/^sou\s+/i, "")
    .replace(/^pode me chamar de\s+/i, "")
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const normalized = normalizeMessageText(cleaned);
  if (["sim", "nao", "quero", "vendedor", "menu", "produto", "promocao"].includes(normalized)) {
    return null;
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) {
    return null;
  }

  const candidate = words.slice(0, 2).join(" ");
  if (candidate.length < 2) {
    return null;
  }

  return formatCustomerName(candidate);
}

export class ChatbotCoreService {
  private readonly router: MessageRouter;
  private readonly stateStore = new ConversationStateStore();
  private readonly dedupStore = new MessageDedupStore();
  private readonly processingQueue = new MessageProcessingQueue();

  constructor(
    dependencies: {
      productsService: ProductsService;
      promotionsService: PromotionsService;
      leadsService: LeadsService;
      logger?: LoggerLike;
    },
  ) {
    this.productsService = dependencies.productsService;
    this.leadsService = dependencies.leadsService;
    this.logger = dependencies.logger ?? createDefaultLogger();
    this.router = new MessageRouter([
      new GreetingHandler(),
      new MenuHandler(),
      new ProductsHandler(dependencies.productsService),
      new PromotionsHandler(dependencies.promotionsService),
      new LeadHandler(dependencies.leadsService),
      new HumanHandoffHandler(dependencies.leadsService),
      new UnknownHandler(),
    ]);
  }

  private readonly logger: LoggerLike;
  private readonly leadsService: LeadsService;
  private readonly productsService: ProductsService;

  pauseConversation(phoneNumber: string): void {
    this.stateStore.pauseForHuman(phoneNumber);
  }

  resumeConversation(phoneNumber: string): void {
    this.stateStore.resumeBot(phoneNumber);
  }

  private resolveSelectedProductName(normalizedText: string, productNames: string[]): string | undefined {
    if (productNames.length === 0) {
      return undefined;
    }
    const choiceIndex = parseProductChoice(normalizedText, productNames.length);
    if (choiceIndex === null) {
      return resolveProductNameFromText(normalizedText, productNames);
    }
    return productNames[choiceIndex];
  }

  private async requestCustomerNameIfNeeded(
    context: ChatbotContext,
    detectedIntent: ChatbotIntent,
  ): Promise<ChatbotResponse | null> {
    const hasKnownName = hasMeaningfulCustomerName(context.message.currentCustomerName) || hasMeaningfulCustomerName(context.message.profileName);
    if (hasKnownName) {
      return null;
    }

    if (detectedIntent !== "lead_interest" && detectedIntent !== "human_handoff") {
      return null;
    }

    const pendingInterestSummary =
      detectedIntent === "lead_interest"
        ? context.selectedProductName
          ? `Interesse no produto: ${context.selectedProductName}`
          : buildInterestSummary(context.message.originalText)
        : context.selectedProductName
          ? `Interesse no produto: ${context.selectedProductName}`
          : undefined;

    return {
      intent: detectedIntent,
      handler: "CustomerNameCapturePrompt",
      replyText: "Antes de continuar, me diga seu primeiro nome.\nIsso ajuda a agilizar o atendimento.",
      replyMessages: ["Antes de continuar, me diga seu primeiro nome.\nIsso ajuda a agilizar o atendimento."],
      actions: ["ask_customer_name"],
      handoffRequested: false,
      stateTransition: {
        stage: "AGUARDANDO_NOME_CLIENTE",
        pendingIntentAfterName: detectedIntent,
        pendingInterestSummary,
        selectedProductName: context.selectedProductName,
      },
    };
  }

  private async continueAfterCustomerName(
    context: ChatbotContext,
    state: ChatbotConversationState,
    nowIso: string,
  ): Promise<ChatbotResponse> {
    const capturedName = extractCustomerNameCandidate(context.message.originalText);

    if (!capturedName) {
      return {
        intent: state.pendingIntentAfterName ?? "lead_interest",
        handler: "CustomerNameCaptureValidation",
        replyText: "Não consegui identificar seu nome.\nMe envie só o primeiro nome para continuar.",
        replyMessages: ["Não consegui identificar seu nome.\nMe envie só o primeiro nome para continuar."],
        actions: ["retry_customer_name"],
        handoffRequested: false,
        stateTransition: {
          stage: "AGUARDANDO_NOME_CLIENTE",
          pendingIntentAfterName: state.pendingIntentAfterName,
          pendingInterestSummary: state.pendingInterestSummary,
          selectedProductName: state.selectedProductName,
        },
      };
    }

    if (state.pendingIntentAfterName === "human_handoff") {
      await this.leadsService.upsertByPhone({
        phone: context.message.from,
        name: capturedName,
        interest:
          state.pendingInterestSummary ??
          (state.selectedProductName ? `Interesse no produto: ${state.selectedProductName}` : undefined),
        status: "ENCAMINHADO_HUMANO",
        channel: context.message.channel,
      });

      return {
        intent: "human_handoff",
        handler: "CustomerNameCaptureResumeHumanHandoff",
        replyText: `${capturedName}, tudo certo.\nVou te encaminhar para um vendedor agora.`,
        replyMessages: [`${capturedName}, tudo certo.\nVou te encaminhar para um vendedor agora.`],
        actions: ["customer_name_captured", "lead_upserted", "human_handoff_requested", "pause_chatbot"],
        handoffRequested: true,
        capturedCustomerName: capturedName,
        stateTransition: {
          stage: "ENCAMINHADO_HUMANO",
          handoffRequested: true,
          awaitingHumanHandoffDecision: false,
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: [],
          selectedCategoryName: undefined,
          pendingIntentAfterName: undefined,
          pendingInterestSummary: undefined,
        },
      };
    }

    await this.leadsService.upsertByPhone({
      phone: context.message.from,
      name: capturedName,
      interest:
        state.pendingInterestSummary ??
        (state.selectedProductName ? `Interesse no produto: ${state.selectedProductName}` : buildInterestSummary(context.message.originalText)),
      status: "EM_CONTATO",
      channel: context.message.channel,
    });

    return {
      intent: "lead_interest",
      handler: "CustomerNameCaptureResumeLeadInterest",
      replyText: `${capturedName}, interesse registrado.\n${buildCommercialHandoffText()}`,
      replyMessages: [`${capturedName}, interesse registrado.`, buildCommercialHandoffText()],
      actions: ["customer_name_captured", "lead_upserted", "ask_human_handoff_confirmation"],
      handoffRequested: false,
      capturedCustomerName: capturedName,
      telegram: {
        inlineKeyboard: [
          [
            { text: "Sim", callbackData: "HANDOFF:YES" },
            { text: "Não", callbackData: "HANDOFF:NO" },
          ],
        ],
      },
      stateTransition: {
        stage: "CONSULTANDO_PRODUTOS",
        awaitingHumanHandoffDecision: true,
        awaitingProductSelectionForInterest: false,
        selectedProductName: state.selectedProductName,
        selectedCategoryName: state.selectedCategoryName,
        pendingIntentAfterName: undefined,
        pendingInterestSummary: undefined,
      },
    };
  }

  private buildProductOverrideResponse(
    products: Array<{ nome: string; preco: string; descricao: string }>,
  ): ChatbotResponse {
    if (products.length === 1) {
      const product = products[0]!;
      const replyText = [
        "Encontrei este produto.",
        `${product.nome}\n${toCurrency(product.preco)}\n${product.descricao.trim().slice(0, 120) || "Sem descricao no momento."}`,
        buildCommercialHandoffText(),
      ].join("\n\n");
      return {
        intent: "products",
        handler: "ProductSearchOverrideHandler",
        replyText,
        replyMessages: [replyText],
        actions: ["product_search_override", "product_found", "ask_human_handoff_confirmation"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildHandoffKeyboard(),
        },
        stateTransition: {
          stage: "CONSULTANDO_PRODUTOS",
          awaitingHumanHandoffDecision: true,
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [product.nome],
          selectedProductName: product.nome,
        },
      };
    }

    const listedProducts = products.slice(0, 3);
    const replyText = [
      "Encontrei algumas opcoes.",
      listedProducts
        .map((product, index) => `${index + 1}) ${product.nome}\n${toCurrency(product.preco)}`)
        .join("\n\n"),
    ].join("\n\n");

    return {
      intent: "products",
      handler: "ProductSearchOverrideHandler",
      replyText,
      replyMessages: [replyText],
      actions: ["product_search_override", "product_list_found", "await_product_choice"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: buildProductListKeyboard(listedProducts.map((product) => product.nome)),
        keyboardPrompt: "Escolha uma ação para continuar.",
      },
      stateTransition: {
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        awaitingHumanHandoffDecision: false,
        awaitingProductSelectionForInterest: false,
        lastShownProducts: listedProducts.map((product) => product.nome),
        selectedProductName: undefined,
      },
    };
  }

  private async tryProductSearchOverride(context: ChatbotContext): Promise<ChatbotResponse | null> {
    const productSearch = await findMatchingProducts(
      context.message.originalText,
      (input) => this.productsService.searchByName(input),
      () => this.productsService.list(),
    );
    this.logger.info(
      {
        event: "product_search_attempt",
        phone: context.message.from,
        originalText: productSearch.searchedProduct,
        extractedTerm: productSearch.extractedTerm,
        tokensUsed: productSearch.requiredTokens,
        resultsFound: productSearch.products.length,
        scoredProducts: productSearch.matchedProducts,
        discardedProducts: productSearch.discardedProducts.slice(0, 10),
      },
      "[ChatbotProduct]",
    );

    if (productSearch.products.length === 0) {
      return null;
    }

    this.logger.info(
      {
        event: "product_search_override",
        phone: context.message.from,
        originalText: productSearch.searchedProduct,
        extractedTerm: productSearch.extractedTerm,
        tokensUsed: productSearch.requiredTokens,
        resultsFound: productSearch.matchedProducts,
        previousStage: context.state.stage,
      },
      "[ChatbotProduct]",
    );

    return this.buildProductOverrideResponse(productSearch.products);
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

      this.logger.info(
        {
          event: "estado_atual",
          phone: normalized.from,
          stage: state.stage,
          lastIntent: state.lastIntent,
          awaitingHumanHandoffDecision: state.awaitingHumanHandoffDecision,
          awaitingProductSelectionForInterest: state.awaitingProductSelectionForInterest,
          lastSuggestedCategories: state.lastSuggestedCategories,
          lastShownProducts: state.lastShownProducts,
          incomingText: normalized.originalText,
        },
        "[ChatbotCore] estado_atual",
      );

      if (state.stage === "ENCAMINHADO_HUMANO" || state.handoffRequested) {
        this.logger.info(
          {
            event: "message_suppressed_human_handoff",
            phone: normalized.from,
            messageId: normalized.messageId,
          },
          "[ChatbotCore]",
        );

        if (message.hasStableMessageId) {
          this.dedupStore.markDone(message.messageId);
        }

        return { kind: "suppressed" };
      }

      const selectedProductName = this.resolveSelectedProductName(normalized.normalizedText, state.lastShownProducts);
      const nowIso = new Date().toISOString();

      const context: ChatbotContext = {
        message: normalized,
        state,
        nowIso,
        rawEvent: payload,
        selectedProductName,
      };

      let response: ChatbotResponse;
      const detectedIntent = detectIntent(normalized.normalizedText, state);
      const canOverrideWithProduct =
        detectedIntent !== "lead_interest"
        && detectedIntent !== "human_handoff"
        && detectedIntent !== "promotions"
        && detectedIntent !== "menu"
        && detectedIntent !== "greeting";

      if (canOverrideWithProduct) {
        const overrideResponse = await this.tryProductSearchOverride(context);
        if (overrideResponse) {
          response = overrideResponse;
        } else {
          if (state.stage === "AGUARDANDO_NOME_CLIENTE") {
            response = await this.continueAfterCustomerName(context, state, nowIso);
          } else {
            const namePrompt = await this.requestCustomerNameIfNeeded(context, detectedIntent);
            response = namePrompt ?? (await this.router.route(context));
          }
        }
      } else if (state.stage === "AGUARDANDO_NOME_CLIENTE") {
        response = await this.continueAfterCustomerName(context, state, nowIso);
      } else {
        const namePrompt = await this.requestCustomerNameIfNeeded(context, detectedIntent);
        response = namePrompt ?? (await this.router.route(context));
      }

      const stateTransition = response.stateTransition ?? {};
      const mergedPatch = {
        ...stateTransition,
        selectedProductName:
          "selectedProductName" in stateTransition
            ? stateTransition.selectedProductName
            : selectedProductName ?? state.selectedProductName,
        selectedCategoryName:
          "selectedCategoryName" in stateTransition ? stateTransition.selectedCategoryName : state.selectedCategoryName,
        awaitingProductSelectionForInterest:
          stateTransition.awaitingProductSelectionForInterest ?? state.awaitingProductSelectionForInterest,
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
          responsePreview: response.replyText.slice(0, 140),
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

  async processIncomingMessages(messages: WhatsAppIncomingMessage[], payload: Record<string, unknown>): Promise<ChatbotProcessResult> {
    if (messages.length === 0) {
      return {
        consumed: false,
        extractedMessages: 0,
        responses: [],
        messageResults: [],
        reason: "no_messages_to_process",
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
    const messageResults: ChatbotProcessedMessage[] = messages.map((message, index) => ({
      phone: message.from,
      messageId: message.messageId,
      originalText: message.text,
      profileName: message.profileName,
      status: processed[index]?.kind ?? "error",
      response: processed[index]?.kind === "processed" ? processed[index].response : undefined,
    }));

    const responses = messageResults
      .filter((item): item is ChatbotProcessedMessage & { response: ChatbotResponse } => item.status === "processed" && !!item.response)
      .map((item) => item.response);
    const ignoredDuplicates = processed.filter((result) => result.kind === "duplicate").length;
    const failedMessages = processed.filter((result) => result.kind === "error").length;

    return {
      consumed: true,
      extractedMessages: messages.length,
      responses,
      messageResults,
      ignoredDuplicates,
      failedMessages,
    };
  }

  async processEvent(payload: Record<string, unknown>): Promise<ChatbotProcessResult> {
    const messages = extractIncomingMessages(payload);

    if (messages.length === 0) {
      this.logger.info({ event: "ignored_event", reason: "no_supported_messages" }, "[ChatbotCore]");
      return {
        consumed: false,
        extractedMessages: 0,
        responses: [],
        messageResults: [],
        reason: "no_supported_messages",
      };
    }

    return this.processIncomingMessages(messages, payload);
  }
}
