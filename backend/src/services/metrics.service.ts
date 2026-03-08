import type { MetricsRepository } from "../repositories/metrics.repository.js";

export class MetricsService {
  constructor(private readonly repository: MetricsRepository) {}

  get() {
    return this.repository.get();
  }
}
