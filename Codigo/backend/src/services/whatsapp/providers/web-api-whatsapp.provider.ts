import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/app-error.js";
import type {
  WhatsAppConnectionStatus,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppSendTextInput,
} from "./whatsapp-provider.js";

type WebApiStatusPayload = {
  status?: string;
  info?: {
    name?: string | null;
    number?: string | null;
    platform?: string | null;
  } | null;
  qr?: string | null;
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = env.WHATSAPP_WEB_API_TOKEN?.trim();
  if (token) {
    const headerName = env.WHATSAPP_WEB_API_AUTH_HEADER.trim();
    headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${token}` : token;
  }

  return headers;
}

function getBaseUrl(): string {
  const baseUrl = env.WHATSAPP_WEB_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new AppError("WhatsApp Web API base URL is not configured", 503, "WHATSAPP_WEB_API_NOT_CONFIGURED");
  }

  return baseUrl.replace(/\/+$/, "");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(),
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(env.WHATSAPP_WEB_API_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("[WebApiWhatsAppProvider] request_failed", {
      provider: "web_api",
      path,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new AppError("Failed to connect to WhatsApp Web API", 502, "WHATSAPP_WEB_API_CONNECTION_FAILED");
  }

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string; message?: string } & Partial<T>)
    | null;

  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? `WhatsApp Web API returned ${response.status}`;
    console.warn("[WebApiWhatsAppProvider] request_unexpected_status", {
      provider: "web_api",
      path,
      statusCode: response.status,
    });
    throw new AppError(message, 502, "WHATSAPP_WEB_API_REQUEST_FAILED");
  }

  return (payload ?? {}) as T;
}

export class WebApiWhatsAppProvider implements WhatsAppProvider {
  async sendTextMessage(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    const payload = await requestJson<{ success?: boolean; messageId?: string }>("/api/send/text", {
      method: "POST",
      body: JSON.stringify({
        to: input.phone,
        message: input.text,
      }),
    });

    return {
      messageId: payload.messageId,
      status: payload.success ? "ENVIADA" : "UNKNOWN",
    };
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    const payload = await requestJson<WebApiStatusPayload>("/api/status", {
      method: "GET",
      headers: {},
    });

    return {
      provider: "web_api",
      status: payload.status ?? "UNKNOWN",
      connected: payload.status === "READY",
      info: payload.info ?? null,
      qr: payload.qr ?? null,
      capabilities: {
        inboundWebhook: false,
        sessionControl: true,
      },
    };
  }

  async reconnect(): Promise<{ status: string; message: string }> {
    console.info("[WebApiWhatsAppProvider] reconnect_requested", { provider: "web_api" });
    const payload = await requestJson<{ message?: string }>("/api/reconnect", {
      method: "POST",
      body: JSON.stringify({}),
    });

    return {
      status: "RECONNECTING",
      message: payload.message ?? "Reconectando...",
    };
  }

  async logout(): Promise<{ status: string; message: string }> {
    console.info("[WebApiWhatsAppProvider] logout_requested", { provider: "web_api" });
    const payload = await requestJson<{ message?: string }>("/api/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });

    return {
      status: "DISCONNECTED",
      message: payload.message ?? "Desconectado com sucesso",
    };
  }
}
