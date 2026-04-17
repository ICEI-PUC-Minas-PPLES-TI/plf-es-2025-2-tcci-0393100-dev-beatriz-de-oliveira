import type { DashboardSummary } from "../types/domain.js";

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
}

export interface DashboardRepository {
  getSummary(filters?: DashboardFilters): Promise<DashboardSummary>;
}
