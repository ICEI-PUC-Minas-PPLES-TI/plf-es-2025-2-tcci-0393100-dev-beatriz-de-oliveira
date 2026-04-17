export interface WhatsAppSendTextInput {
  phone: string;
  text: string;
}

export interface WhatsAppSendImageInput {
  phone: string;
  imageUrl?: string;
  imageBase64?: string;
  caption?: string;
}

export interface WhatsAppSendDocumentInput {
  phone: string;
  documentUrl: string;
  filename?: string;
}

export interface WhatsAppSendResult {
  messageId?: string;
  status: string;
}

export interface WhatsAppConnectionInfo {
  name?: string | null;
  number?: string | null;
  platform?: string | null;
}

export interface WhatsAppConnectionStatus {
  provider: string;
  status: string;
  connected: boolean;
  info?: WhatsAppConnectionInfo | null;
  qr?: string | null;
  capabilities: {
    inboundWebhook: boolean;
    sessionControl: boolean;
  };
}

export interface WhatsAppProvider {
  // Infrastructure contract shared by Meta Cloud API and the local Web API gateway.
  // Outbound transport details must stay encapsulated inside provider implementations.
  sendTextMessage(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult>;
  getConnectionStatus(): Promise<WhatsAppConnectionStatus>;
  reconnect(): Promise<{ status: string; message: string }>;
  logout(): Promise<{ status: string; message: string }>;
  sendImageMessage?(input: WhatsAppSendImageInput): Promise<WhatsAppSendResult>;
  sendDocumentMessage?(input: WhatsAppSendDocumentInput): Promise<WhatsAppSendResult>;
}
