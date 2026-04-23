import { ChatbotCoreService } from "../modules/chatbot/chatbot-core.service.js";
import { parseTelegramUpdate } from "../services/telegram/telegram-update-parser.js";
import { LeadsService } from "../services/leads.service.js";
import { ProductsService } from "../services/products.service.js";
import { PromotionsService } from "../services/promotions.service.js";

class ValidationProductsRepository {
  constructor(private readonly items: Array<Record<string, unknown>>) {}

  async findAll() {
    return this.items as never[];
  }

  async findById(id: number) {
    return (this.items.find((item) => item.id === id) ?? null) as never;
  }

  async searchByName(input: { extractedTerm: string; requiredTokens: string[] }) {
    const normalizedTerm = input.extractedTerm.toLowerCase();
    return this.items.filter((item) => {
      const normalizedName = String(item.nome).toLowerCase();
      return normalizedName.includes(normalizedTerm) || input.requiredTokens.some((token) => normalizedName.includes(token));
    }) as never[];
  }

  async create(data: Record<string, unknown>) {
    return { id: this.items.length + 1, ...data } as never;
  }

  async update(id: number, data: Record<string, unknown>) {
    const current = this.items.find((item) => item.id === id);
    return (current ? { ...current, ...data } : null) as never;
  }

  async delete() {
    return true;
  }
}

class ValidationPromotionsRepository {
  async findAll() {
    return [
      {
        id: 1,
        produto: "Smart TV 50",
        produto_id: 1,
        tipo: "PROMOCAO",
        ativa: true,
        inicio_em: "2026-04-01",
        fim_em: "2026-05-01",
        imagem: "",
      },
    ] as never[];
  }
}

class ValidationLeadsRepository {
  async findAll() {
    return [];
  }

  async findById() {
    return null;
  }

  async create(data: Record<string, unknown>) {
    return {
      id: 1,
      nome: data.name ?? "Cliente",
      telefone: data.phone,
      email: "",
      interesse: data.interest,
      status: data.status,
      data_criacao: new Date().toISOString(),
    } as never;
  }

  async update() {
    return null;
  }

  async updateStatus() {
    return null;
  }

  async upsertByPhone(input: Record<string, unknown>) {
    return {
      id: 1,
      nome: input.name ?? "Cliente",
      telefone: input.phone,
      email: "",
      interesse: input.interest,
      status: input.status,
      data_criacao: new Date().toISOString(),
    } as never;
  }
}

const chatbot = new ChatbotCoreService({
  productsService: new ProductsService(
    new ValidationProductsRepository([
      { id: 1, nome: "Smart TV 50", categoria: "TVs", descricao: "Tela 4K com HDR", preco: "2999.00", disponivel: true, imagem: "" },
      { id: 2, nome: "Smart TV 55", categoria: "TVs", descricao: "Modelo premium", preco: "3499.00", disponivel: true, imagem: "" },
      { id: 3, nome: "Galaxy A55", categoria: "Celulares", descricao: "128GB", preco: "1999.00", disponivel: true, imagem: "" },
      { id: 4, nome: "Fone Bluetooth", categoria: "Eletrônicos", descricao: "Som limpo", preco: "299.00", disponivel: true, imagem: "" },
    ]),
  ),
  promotionsService: new PromotionsService(new ValidationPromotionsRepository()),
  leadsService: new LeadsService(new ValidationLeadsRepository()),
});

let callbackSequence = 0;

async function sendText(text: string, from = "123") {
  const result = await chatbot.processIncomingMessages(
    [
      {
        from,
        messageId: `${from}:${Date.now()}:${Math.random()}`,
        hasStableMessageId: true,
        text,
        profileName: "Cliente Teste",
        raw: {},
      },
    ],
    {},
  );

  return result.responses[0];
}

async function sendCallback(data: string, from = "123") {
  callbackSequence += 1;
  const parsed = parseTelegramUpdate({
    update_id: 1,
    callback_query: {
      id: `cb-${callbackSequence}`,
      data,
      from: { first_name: "Cliente", last_name: "Teste" },
      message: {
        message_id: 10,
        chat: { id: from },
        date: Math.floor(Date.now() / 1000),
      },
    },
  });

  if (parsed.kind !== "message") {
    throw new Error(`Falha ao processar callback: ${parsed.reason}`);
  }

  const result = await chatbot.processIncomingMessages([parsed.message], {});
  return result.responses[0];
}

async function run() {
  const cases = [
    ["1. menu inicial", await sendText("oi")],
    ["2. clique em Produtos", await sendCallback("MENU:PRODUCTS")],
    ["3. clique em categoria", await sendCallback("CATEGORY:TVs")],
    ["4. digitar categoria", await sendText("televisão", "456")],
    ["5. digitar produto no fluxo", await sendText("Smart TV 50", "888")],
    ["6. digitar produto fora do fluxo", await sendText("TV Samsung", "999")],
    ["7. fluxo até vendedor - menu", await sendCallback("MENU:PRODUCTS", "789")],
    ["7. fluxo até vendedor - categoria", await sendCallback("CATEGORY:TVs", "789")],
    ["7. fluxo até vendedor - interesse", await sendCallback("PRODUCT:INTEREST:Smart TV 50", "789")],
    ["7. fluxo até vendedor - handoff", await sendCallback("HANDOFF:YES", "789")],
  ] as const;

  for (const [label, response] of cases) {
    console.log("----");
    console.log(label);
    console.log("intent:", response?.intent);
    console.log("handler:", response?.handler);
    console.log("reply:", response?.replyText);
    console.log("replyMessages:", JSON.stringify(response?.replyMessages ?? []));
    console.log("buttons:", JSON.stringify(response?.telegram?.inlineKeyboard ?? []));
  }
}

run().catch((error) => {
  console.error("[chatbot-validation] failed", error);
  process.exit(1);
});
