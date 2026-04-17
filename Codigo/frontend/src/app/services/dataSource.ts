export type DataSourceMode = "mock" | "api";

const dataSourceMode = (import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined) ?? "api";
const normalizedDataSourceMode: DataSourceMode = dataSourceMode === "mock" ? "mock" : "api";

export const isMockDataSource = normalizedDataSourceMode === "mock";
