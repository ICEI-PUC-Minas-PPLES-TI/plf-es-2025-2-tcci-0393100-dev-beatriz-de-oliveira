import { ChatbotCoreService } from "./chatbot/chatbot-core.service.js";
import {
  InMemoryBillingRepository,
  InMemoryLeadsRepository,
  InMemoryMetricsRepository,
  InMemoryProductsRepository,
} from "../repositories/in-memory.repositories.js";
import { AuthService } from "../services/auth.service.js";
import { BillingService } from "../services/billing.service.js";
import { LeadsService } from "../services/leads.service.js";
import { MetricsService } from "../services/metrics.service.js";
import { ProductsService } from "../services/products.service.js";
import { WhatsAppService } from "../services/whatsapp.service.js";

const productsRepository = new InMemoryProductsRepository();
const leadsRepository = new InMemoryLeadsRepository();
const metricsRepository = new InMemoryMetricsRepository();
const billingRepository = new InMemoryBillingRepository();

const productsService = new ProductsService(productsRepository);
const leadsService = new LeadsService(leadsRepository);
const chatbotCoreService = new ChatbotCoreService({
  productsService,
  leadsService,
});

export const container = {
  authService: new AuthService(),
  productsService,
  leadsService,
  metricsService: new MetricsService(metricsRepository),
  billingService: new BillingService(billingRepository),
  chatbotCoreService,
  whatsappService: new WhatsAppService(chatbotCoreService),
};
