import type { Metricas } from "../types/domain.js";

export interface MetricsRepository {
  get(): Promise<Metricas>;
}
