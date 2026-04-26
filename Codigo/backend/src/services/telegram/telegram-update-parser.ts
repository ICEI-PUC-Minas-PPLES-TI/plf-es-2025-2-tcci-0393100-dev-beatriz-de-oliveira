import type { WhatsAppIncomingMessage } from "../../modules/chatbot/types.js";

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
  | { kind: "message"; message: WhatsAppIncomingMessage; callbackQueryId?: string }
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
  if (!data?.trim()) {
    return null;
  }

  if (data === "MENU:PRODUCTS") return "produtos";
  if (data === "MENU:PROMOTIONS") return "promocoes";
  if (data === "MENU:HUMAN_HANDOFF") return "falar com vendedor";
  if (data === "HANDOFF:YES") return "sim";
  if (data === "HANDOFF:NO") return "nao";

  if (data.startsWith("CATEGORY:")) {
    return `categoria ${data.slice("CATEGORY:".length).trim()}`;
  }

  if (data.startsWith("PRODUCT:MORE:")) {
    return `ver mais ${data.slice("PRODUCT:MORE:".length).trim()}`;
  }

  if (data.startsWith("PRODUCT:INTEREST:")) {
    return `tenho interesse em ${data.slice("PRODUCT:INTEREST:".length).trim()}`;
  }

  if (data.startsWith("PRODUCT:SELLER:")) {
    return `quero falar com vendedor sobre ${data.slice("PRODUCT:SELLER:".length).trim()}`;
  }

  return data;
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

    if (!chatId || !messageId) {
      return { kind: "invalid", reason: "missing_callback_chat_or_message_id" };
    }

    if (!text) {
      return { kind: "ignored", reason: "empty_callback_data" };
    }

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
