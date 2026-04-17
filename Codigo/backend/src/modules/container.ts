import { ChatbotCoreService } from "./chatbot/chatbot-core.service.js";
import { env } from "../config/env.js";
import { DailyBillingJob } from "../jobs/daily-billing.job.js";
import { PostgresAuthRepository } from "../repositories/postgres/auth.repository.js";
import { PostgresBillingRepository } from "../repositories/postgres/billing.repository.js";
import { PostgresDashboardRepository } from "../repositories/postgres/dashboard.repository.js";
import { PostgresLeadsRepository } from "../repositories/postgres/leads.repository.js";
import { PostgresMetricsRepository } from "../repositories/postgres/metrics.repository.js";
import { PostgresProductsRepository } from "../repositories/postgres/products.repository.js";
import { PostgresPromotionsRepository } from "../repositories/postgres/promotions.repository.js";
import { PostgresWhatsAppRepository } from "../repositories/postgres/whatsapp.repository.js";
import { AuthService } from "../services/auth.service.js";
import { BillingService } from "../services/billing.service.js";
import { DashboardService } from "../services/dashboard.service.js";
import { LeadsService } from "../services/leads.service.js";
import { MetricsService } from "../services/metrics.service.js";
import { ProductsService } from "../services/products.service.js";
import { PromotionsService } from "../services/promotions.service.js";
import { TelegramService } from "../services/telegram.service.js";
import { WhatsAppService } from "../services/whatsapp.service.js";
import { MetaWhatsAppProvider } from "../services/whatsapp/providers/meta-whatsapp.provider.js";
import { WebApiWhatsAppProvider } from "../services/whatsapp/providers/web-api-whatsapp.provider.js";
import type { WhatsAppProvider } from "../services/whatsapp/providers/whatsapp-provider.js";

const authRepository = new PostgresAuthRepository();
const productsRepository = new PostgresProductsRepository();
const promotionsRepository = new PostgresPromotionsRepository();
const leadsRepository = new PostgresLeadsRepository();
const metricsRepository = new PostgresMetricsRepository();
const billingRepository = new PostgresBillingRepository();
const dashboardRepository = new PostgresDashboardRepository();
const whatsappRepository = new PostgresWhatsAppRepository();
const whatsappProvider: WhatsAppProvider =
  env.WHATSAPP_PROVIDER === "web_api" ? new WebApiWhatsAppProvider() : new MetaWhatsAppProvider();

console.info("[Container] whatsapp_provider_selected", {
  provider: env.WHATSAPP_PROVIDER,
});
console.info("[Container] telegram_webhook_config", {
  enabled: Boolean(env.TELEGRAM_BOT_TOKEN?.trim()),
  webhookPath: env.TELEGRAM_WEBHOOK_PATH,
  hasSecret: Boolean(env.TELEGRAM_WEBHOOK_SECRET?.trim()),
});

const productsService = new ProductsService(productsRepository);
const promotionsService = new PromotionsService(promotionsRepository);
const leadsService = new LeadsService(leadsRepository);
const billingService = new BillingService(billingRepository);
const chatbotCoreService = new ChatbotCoreService({
  productsService,
  promotionsService,
  leadsService,
});

export const container = {
  authService: new AuthService(authRepository),
  productsService,
  promotionsService,
  leadsService,
  dashboardService: new DashboardService(dashboardRepository),
  metricsService: new MetricsService(metricsRepository),
  billingService,
  dailyBillingJob: new DailyBillingJob(billingService),
  chatbotCoreService,
  telegramService: new TelegramService(chatbotCoreService, productsService),
  whatsappService: new WhatsAppService(chatbotCoreService, whatsappRepository, whatsappProvider),
};
