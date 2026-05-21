export const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;

type CallbackDataOptions = {
  action: string;
  candidate: string;
  fallback: string;
  metadata?: Record<string, unknown>;
};

export function getTelegramCallbackDataByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function isTelegramCallbackDataWithinLimit(value: string): boolean {
  return getTelegramCallbackDataByteLength(value) <= TELEGRAM_CALLBACK_DATA_MAX_BYTES;
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildShortCallbackSlug(value: string, maxBytes = 32): string {
  const slug = normalizeSlug(value) || "item";
  if (getTelegramCallbackDataByteLength(slug) <= maxBytes) {
    return slug;
  }

  return slug.slice(0, maxBytes).replace(/-+$/g, "") || "item";
}

export function buildTelegramCallbackData(options: CallbackDataOptions): string {
  const candidateBytes = getTelegramCallbackDataByteLength(options.candidate);
  if (candidateBytes <= TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    return options.candidate;
  }

  const fallbackBytes = getTelegramCallbackDataByteLength(options.fallback);
  if (fallbackBytes > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    throw new Error(
      `Telegram callback_data fallback exceeds ${TELEGRAM_CALLBACK_DATA_MAX_BYTES} bytes for ${options.action}`,
    );
  }

  console.warn("[TelegramCallbackData] fallback_applied", {
    action: options.action,
    candidateBytes,
    fallbackBytes,
    limitBytes: TELEGRAM_CALLBACK_DATA_MAX_BYTES,
    fallback: options.fallback,
    ...options.metadata,
  });

  return options.fallback;
}

export function assertTelegramCallbackDataWithinLimit(value: string, metadata?: Record<string, unknown>): void {
  const bytes = getTelegramCallbackDataByteLength(value);
  if (bytes <= TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    return;
  }

  console.error("[TelegramCallbackData] invalid_callback_data", {
    bytes,
    limitBytes: TELEGRAM_CALLBACK_DATA_MAX_BYTES,
    callbackData: value,
    ...metadata,
  });

  throw new Error(`Telegram callback_data exceeds ${TELEGRAM_CALLBACK_DATA_MAX_BYTES} bytes`);
}
