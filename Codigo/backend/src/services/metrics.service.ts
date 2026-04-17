import type { MetricsFilters, MetricsRepository } from "../repositories/metrics.repository.js";

export class MetricsService {
  constructor(private readonly repository: MetricsRepository) {}

  get(filters?: MetricsFilters) {
    return this.repository.get(filters);
  }
}
