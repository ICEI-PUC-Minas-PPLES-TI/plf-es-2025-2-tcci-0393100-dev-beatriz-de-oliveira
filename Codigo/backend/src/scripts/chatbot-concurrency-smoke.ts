import { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import type { LeadUpsertByPhoneInput } from "../repositories/leads.repository.js";
import type { Lead, Produto } from "../types/domain.js";

class FakeProductsService {
  private readonly items: Produto[];
  private shouldFailNextProductsRequest = false;

  constructor(items: Produto[]) {
    this.items = items;
  }

  failNextProductsRequest() {
    this.shouldFailNextProductsRequest = true;
  }

  async list(): Promise<Produto[]> {
    if (this.shouldFailNextProductsRequest) {
      this.shouldFailNextProductsRequest = false;
      throw new Error("simulated_products_failure");
    }
    return this.items;
  }
}

class FakeLeadsService {
  private readonly byPhone = new Map<string, Lead>();
  private sequence = 1;

  async upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead> {
    const existing = this.byPhone.get(input.phone);
    if (existing) {
      const updated: Lead = { ...existing, interesse: input.interest, status: input.status, nome: input.name || existing.nome };
      this.byPhone.set(input.phone, updated);
      return updated;
    }
    const created: Lead = {
      id: this.sequence++,
      nome: input.name || "Contato",
      telefone: input.phone,
      email: `lead.${input.phone}@local.test`,
      interesse: input.interest,
      status: input.status,
      data_criacao: new Date().toISOString(),
    };
    this.byPhone.set(input.phone, created);
    return created;
  }
}

function webhookPayload(params: { from: string; messageId: string; text: string; profileName?: string }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: params.profileName ?? "Cliente" }, wa_id: params.from }],
              messages: [
                {
                  from: params.from,
                  id: params.messageId,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: "text",
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>;
}

async function main() {
  const productsService = new FakeProductsService([
    {
      id: 1,
      nome: "Ventilador Turbo 40cm",
      categoria: "Climatizacao",
      descricao: "Ventilador potente",
      preco: "299.90",
      disponivel: true,
      imagem: "https://example.com/ventilador.png",
    },
    {
      id: 2,
      nome: "Liquidificador 900W",
      categoria: "Eletrodomesticos",
      descricao: "Liquidificador resistente",
      preco: "199.90",
      disponivel: true,
      imagem: "https://example.com/liquidificador.png",
    },
  ]);
  const leadsService = new FakeLeadsService();
  const core = new ChatbotCoreService({
    productsService: productsService as any,
    leadsService: leadsService as any,
  });

  // 1) Duplicidade: mesma mensagem duas vezes
  const duplicatePayload = webhookPayload({ from: "5511000000001", messageId: "wamid-dup-1", text: "oi" });
  const [dupA, dupB] = await Promise.all([core.processEvent(duplicatePayload), core.processEvent(duplicatePayload)]);
  console.log("duplicate_test", {
    firstResponses: dupA.responses.length,
    secondResponses: dupB.responses.length,
    secondIgnoredDuplicates: dupB.ignoredDuplicates,
  });

  // 2) Mesmo telefone em sequencia rapida: manter ordem logica
  const samePhoneA = webhookPayload({ from: "5511000000002", messageId: "wamid-same-1", text: "quero ver produtos" });
  const samePhoneB = webhookPayload({ from: "5511000000002", messageId: "wamid-same-2", text: "quero o primeiro" });
  const [sameA, sameB] = await Promise.all([core.processEvent(samePhoneA), core.processEvent(samePhoneB)]);
  console.log("same_phone_order_test", {
    firstIntent: sameA.responses[0]?.intent,
    secondIntent: sameB.responses[0]?.intent,
  });

  // 3) Telefones diferentes: podem processar em paralelo
  const parallelA = webhookPayload({ from: "5511000000003", messageId: "wamid-par-1", text: "menu" });
  const parallelB = webhookPayload({ from: "5511000000004", messageId: "wamid-par-2", text: "menu" });
  const [parA, parB] = await Promise.all([core.processEvent(parallelA), core.processEvent(parallelB)]);
  console.log("parallel_phone_test", {
    aIntent: parA.responses[0]?.intent,
    bIntent: parB.responses[0]?.intent,
  });

  // 4) Erro nao bloqueia fila do telefone
  productsService.failNextProductsRequest();
  const errorA = webhookPayload({ from: "5511000000005", messageId: "wamid-err-1", text: "quero ver produtos" });
  const afterError = webhookPayload({ from: "5511000000005", messageId: "wamid-err-2", text: "menu" });
  const [errResult, afterResult] = await Promise.all([core.processEvent(errorA), core.processEvent(afterError)]);
  console.log("error_release_test", {
    firstFailedMessages: errResult.failedMessages,
    secondIntent: afterResult.responses[0]?.intent,
  });
}

main().catch((error) => {
  console.error("[chatbot-concurrency-smoke] failed", error);
  process.exit(1);
});
