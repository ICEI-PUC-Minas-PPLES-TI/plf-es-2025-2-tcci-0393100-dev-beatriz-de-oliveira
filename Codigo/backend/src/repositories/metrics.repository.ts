import type { Metricas } from "../types/domain.js";

export interface MetricsFilters {
  startDate?: string;
  endDate?: string;
}

export interface MetricsRepository {
  get(filters?: MetricsFilters): Promise<Metricas>;
}
