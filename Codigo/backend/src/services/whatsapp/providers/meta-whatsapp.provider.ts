import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/app-error.js";
import type {
  WhatsAppConnectionStatus,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppSendTextInput,
} from "./whatsapp-provider.js";

export class MetaWhatsAppProvider implements WhatsAppProvider {
  async sendTextMessage(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    const token = env.WHATSAPP_META_TOKEN?.trim();
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    if (!token || !phoneNumberId) {
      throw new AppError("WhatsApp outbound is not configured", 503, "WHATSAPP_OUTBOUND_NOT_CONFIGURED");
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
          to: input.phone,
          type: "text",
          text: { body: input.text },
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message = payload?.error?.message ?? `WhatsApp API returned ${response.status}`;
      console.warn("[MetaWhatsAppProvider] send_text_failed", {
        provider: "meta",
        phone: input.phone,
        statusCode: response.status,
      });
      throw new AppError(message, 502, "WHATSAPP_SEND_FAILED");
    }

    return {
      messageId: payload?.messages?.[0]?.id,
      status: "ENVIADA",
    };
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    const configured = Boolean(env.WHATSAPP_META_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim());

    return {
      provider: "meta",
      status: configured ? "CONFIGURED" : "NOT_CONFIGURED",
      connected: configured,
      info: configured
        ? {
            number: env.WHATSAPP_PHONE_NUMBER_ID,
            platform: "meta-cloud-api",
          }
        : null,
      qr: null,
      capabilities: {
        inboundWebhook: true,
        sessionControl: false,
      },
    };
  }

  async reconnect(): Promise<{ status: string; message: string }> {
    console.info("[MetaWhatsAppProvider] reconnect_not_supported", { provider: "meta" });
    return {
      status: "NOT_SUPPORTED",
      message: "Reconnect is not supported for Meta Cloud API provider.",
    };
  }

  async logout(): Promise<{ status: string; message: string }> {
    console.info("[MetaWhatsAppProvider] logout_not_supported", { provider: "meta" });
    return {
      status: "NOT_SUPPORTED",
      message: "Logout is not supported for Meta Cloud API provider.",
    };
  }
}
