import type { IncomingChatbotMessage } from "../../modules/chatbot/types.js";

export type TelegramWebhookPayload = {
  update_id?: number;
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      date?: number;
      chat?: {
        id?: number | string;
        type?: string;
      };
    };
  };
  edited_message?: Record<string, unknown>;
  message?: {
    message_id: number;
    date?: number;
    text?: string;
    photo?: unknown[];
    sticker?: Record<string, unknown>;
    chat?: {
      id?: number | string;
      type?: string;
    };
    from?: {
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

export type TelegramParseResult =
  | { kind: "message"; message: IncomingChatbotMessage; callbackQueryId?: string }
  | { kind: "ignored"; reason: string }
  | { kind: "invalid"; reason: string };

function getUpdateKind(payload: TelegramWebhookPayload): string {
  if (payload.edited_message) return "edited_message";
  if (payload.callback_query) return "callback_query";
  if (payload.message?.photo?.length) return "photo";
  if (payload.message?.sticker) return "sticker";
  if (payload.message) return "message";
  return "unsupported_update";
}

function buildProfileName(from?: { first_name?: string; last_name?: string; username?: string }): string | undefined {
  if (!from) {
    return undefined;
  }

  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  return from.username?.trim() || undefined;
}

function mapCallbackDataToText(data?: string): string | null {
  const trimmed = data?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();

  if (normalized === "menu:products" || normalized === "menu:produtos") return "produtos";
  if (normalized === "menu:promotions" || normalized === "menu:promocoes") return "promocoes";
  if (normalized === "menu:human_handoff" || normalized === "menu:vendedor") return "falar com vendedor";
  if (normalized === "handoff:yes" || normalized === "handoff:sim") return "sim";
  if (normalized === "handoff:no" || normalized === "handoff:nao") return "nao";

  const separatorIndex = trimmed.indexOf(":");
  const action = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).trim().toLowerCase() : "";
  const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1).trim() : "";

  if (["category", "categoria", "products_category", "product_category"].includes(action) && value) {
    return `categoria ${value}`;
  }

  if (action === "category_refine" && value) {
    const [categoryName, term] = value.split(":");
    return `categoria ${categoryName?.trim() ?? ""} busca ${term?.trim() ?? ""}`.trim();
  }

  if (action === "category_general" && value) {
    return `categoria ${value} geral`;
  }

  if (action === "category_more" && value) {
    const [categoryName, offset] = value.split(":");
    return `categoria ${categoryName?.trim() ?? ""} pagina ${offset?.trim() ?? ""}`.trim();
  }

  if (action === "search_refine" && value) {
    const [baseTerm, refinement] = value.split(":");
    return `quero ${baseTerm?.trim() ?? ""} ${refinement?.trim() ?? ""}`.trim();
  }

  if (action === "search_general" && value) {
    return `quero ${value} opcoes gerais`;
  }

  if (normalized.startsWith("product:more:")) {
    return `ver mais ${trimmed.slice("PRODUCT:MORE:".length).trim()}`;
  }

  if (normalized.startsWith("product:photos:")) {
    return `ver mais fotos ${trimmed.slice("PRODUCT:PHOTOS:".length).trim()}`;
  }

  if (normalized.startsWith("product:interest:")) {
    return `tenho interesse em ${trimmed.slice("PRODUCT:INTEREST:".length).trim()}`;
  }

  if (normalized.startsWith("product:seller:")) {
    return `quero falar com vendedor sobre ${trimmed.slice("PRODUCT:SELLER:".length).trim()}`;
  }

  return trimmed;
}

export function parseTelegramUpdate(payload: TelegramWebhookPayload): TelegramParseResult {
  const updateKind = getUpdateKind(payload);

  if (payload.edited_message) {
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "edited_message",
    });
    return { kind: "ignored", reason: "edited_message" };
  }

  if (payload.callback_query) {
    const chatId = payload.callback_query.message?.chat?.id;
    const messageId = payload.callback_query.message?.message_id;
    const text = mapCallbackDataToText(payload.callback_query.data);

    console.info("[TelegramCallback] recebido", {
      callbackId: payload.callback_query.id,
      chatId: chatId ? String(chatId) : null,
      messageId: messageId ?? null,
    });
    console.info("[TelegramCallback] data", {
      callbackId: payload.callback_query.id,
      data: payload.callback_query.data ?? null,
    });

    if (!chatId || !messageId) {
      return { kind: "invalid", reason: "missing_callback_chat_or_message_id" };
    }

    if (!text) {
      return { kind: "ignored", reason: "empty_callback_data" };
    }

    console.info("[TelegramCallback] convertido_para_texto", {
      callbackId: payload.callback_query.id,
      text,
    });

    return {
      kind: "message",
      callbackQueryId: payload.callback_query.id,
      message: {
        from: String(chatId),
        channel: "telegram",
        messageId: `${String(chatId)}:callback:${String(messageId)}:${payload.callback_query.id}`,
        hasStableMessageId: true,
        timestamp: payload.callback_query.message?.date
          ? new Date(payload.callback_query.message.date * 1000).toISOString()
          : undefined,
        text,
        profileName: buildProfileName(payload.callback_query.from),
        raw: payload as Record<string, unknown>,
      },
    };
  }

  if (!payload.message) {
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "unsupported_update",
    });
    return { kind: "ignored", reason: "unsupported_update" };
  }

  if (!payload.message.chat?.id) {
    console.warn("[TelegramParser] invalid", {
      updateKind,
      reason: "missing_chat_id",
      messageId: payload.message.message_id,
    });
    return { kind: "invalid", reason: "missing_chat_id" };
  }

  if (payload.message.sticker) {
    return { kind: "ignored", reason: "sticker" };
  }

  if (payload.message.photo?.length) {
    return { kind: "ignored", reason: "photo" };
  }

  const text = payload.message.text?.trim();
  if (!text) {
    return { kind: "ignored", reason: "no_text" };
  }

  const chatId = String(payload.message.chat.id);
  const telegramMessageId = String(payload.message.message_id);
  const dedupKey = `${chatId}:${telegramMessageId}`;

  return {
    kind: "message",
    message: {
      from: chatId,
      channel: "telegram",
      messageId: dedupKey,
      hasStableMessageId: true,
      timestamp: payload.message.date ? new Date(payload.message.date * 1000).toISOString() : undefined,
      text,
      profileName: buildProfileName(payload.message.from),
      raw: payload as Record<string, unknown>,
    },
  };
}
