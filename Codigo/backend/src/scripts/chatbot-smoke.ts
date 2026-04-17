import { container } from "../modules/container.js";

function buildWebhookPayload(text: string, from = "5511999999999", profileName = "Cliente Teste") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [
                {
                  profile: { name: profileName },
                  wa_id: from,
                },
              ],
              messages: [
                {
                  from,
                  id: `wamid-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  } as const;
}

async function run() {
  const samples = [
    "oi",
    "menu",
    "quero ver produtos",
    "quero o primeiro",
    "tem promocao?",
    "quero falar com vendedor",
    "tenho interesse nesse produto",
    "blablabla sem sentido",
  ];

  for (const sample of samples) {
    const payload = buildWebhookPayload(sample);
    const result = await container.chatbotCoreService.processEvent(payload);
    const first = result.responses[0];
    console.log("----");
    console.log(`input: ${sample}`);
    console.log(`consumed: ${result.consumed}`);
    console.log(`intent: ${first?.intent ?? "none"}`);
    console.log(`handler: ${first?.handler ?? "none"}`);
    console.log(`reply: ${first?.replyText ?? "none"}`);
    console.log(`actions: ${first?.actions.join(", ") ?? "none"}`);
  }
}

run().catch((error) => {
  console.error("[chatbot-smoke] failed", error);
  process.exit(1);
});
