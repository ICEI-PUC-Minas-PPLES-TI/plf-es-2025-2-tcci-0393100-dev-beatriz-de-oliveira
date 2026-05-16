import { ChatbotCoreService } from "./chatbot/chatbot-core.service.js";
import { DailyBillingJob } from "../jobs/daily-billing.job.js";
import { PostgresAuthRepository } from "../repositories/postgres/auth.repository.js";
import { PostgresBillingRepository } from "../repositories/postgres/billing.repository.js";
import { PostgresDashboardRepository } from "../repositories/postgres/dashboard.repository.js";
import { PostgresLeadsRepository } from "../repositories/postgres/leads.repository.js";
import { PostgresMetricsRepository } from "../repositories/postgres/metrics.repository.js";
import { PostgresConversationsRepository } from "../repositories/postgres/conversations.repository.js";
import { PostgresProductsRepository } from "../repositories/postgres/products.repository.js";
import { PostgresPromotionsRepository } from "../repositories/postgres/promotions.repository.js";
import { PostgresTelegramRepository } from "../repositories/postgres/telegram.repository.js";
import { AuthService } from "../services/auth.service.js";
import { BillingService } from "../services/billing.service.js";
import { ConversationsService } from "../services/conversations.service.js";
import { DashboardService } from "../services/dashboard.service.js";
import { LeadsService } from "../services/leads.service.js";
import { LeadStatusService } from "../services/lead-status.service.js";
import { MetricsService } from "../services/metrics.service.js";
import { ProductsService } from "../services/products.service.js";
import { PromotionsService } from "../services/promotions.service.js";
import { TelegramService } from "../services/telegram.service.js";

const authRepository = new PostgresAuthRepository();
const productsRepository = new PostgresProductsRepository();
const promotionsRepository = new PostgresPromotionsRepository();
const leadsRepository = new PostgresLeadsRepository();
const metricsRepository = new PostgresMetricsRepository();
const billingRepository = new PostgresBillingRepository();
const dashboardRepository = new PostgresDashboardRepository();
const telegramRepository = new PostgresTelegramRepository();
const conversationsRepository = new PostgresConversationsRepository();

const productsService = new ProductsService(productsRepository);
const promotionsService = new PromotionsService(promotionsRepository);
const leadsService = new LeadsService(leadsRepository);
const leadStatusService = new LeadStatusService();
const chatbotCoreService = new ChatbotCoreService({
  productsService,
  promotionsService,
  leadsService,
});
const telegramService = new TelegramService(chatbotCoreService, productsService, telegramRepository, leadStatusService);
const conversationsService = new ConversationsService(conversationsRepository, telegramService);
const billingService = new BillingService(billingRepository, telegramService);

export const container = {
  authService: new AuthService(authRepository),
  productsService,
  promotionsService,
  leadsService,
  conversationsService,
  dashboardService: new DashboardService(dashboardRepository),
  metricsService: new MetricsService(metricsRepository),
  billingService,
  leadStatusService,
  dailyBillingJob: new DailyBillingJob(billingService),
  chatbotCoreService,
  telegramService,
};
