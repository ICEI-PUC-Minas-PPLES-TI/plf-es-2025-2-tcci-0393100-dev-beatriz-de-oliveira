import type { WhatsAppIncomingMessage } from "../../modules/chatbot/types.js";

export type TelegramWebhookPayload = {
  update_id?: number;
  callback_query?: Record<string, unknown>;
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
  | { kind: "message"; message: WhatsAppIncomingMessage }
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

function buildProfileName(payload: TelegramWebhookPayload): string | undefined {
  const from = payload.message?.from;
  if (!from) {
    return undefined;
  }

  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  return from.username?.trim() || undefined;
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
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "callback_query",
    });
    return { kind: "ignored", reason: "callback_query" };
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
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "sticker",
      chatId: String(payload.message.chat.id),
      messageId: String(payload.message.message_id),
    });
    return { kind: "ignored", reason: "sticker" };
  }

  if (payload.message.photo?.length) {
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "photo",
      chatId: String(payload.message.chat.id),
      messageId: String(payload.message.message_id),
    });
    return { kind: "ignored", reason: "photo" };
  }

  const text = payload.message.text?.trim();
  if (!text) {
    console.info("[TelegramParser] ignored", {
      updateKind,
      reason: "no_text",
      chatId: String(payload.message.chat.id),
      messageId: String(payload.message.message_id),
    });
    return { kind: "ignored", reason: "no_text" };
  }

  const chatId = String(payload.message.chat.id);
  const telegramMessageId = String(payload.message.message_id);

  const dedupKey = `${chatId}:${telegramMessageId}`;
  console.info("[TelegramParser] accepted", {
    updateKind,
    chatId,
    messageId: telegramMessageId,
    dedupKey,
    hasText: true,
  });

  return {
    kind: "message",
    message: {
      from: chatId,
      // Telegram `message_id` is only unique inside each chat.
      // We namespace it with `chatId` because the chatbot dedup store is global.
      messageId: dedupKey,
      hasStableMessageId: true,
      timestamp: payload.message.date ? new Date(payload.message.date * 1000).toISOString() : undefined,
      text,
      profileName: buildProfileName(payload),
      raw: payload as Record<string, unknown>,
    },
  };
}
