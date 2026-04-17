import type { DashboardFilters, DashboardRepository } from "../repositories/dashboard.repository.js";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  getSummary(filters?: DashboardFilters) {
    return this.repository.getSummary(filters);
  }
}
