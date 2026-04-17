export interface ApiListResponse<T> {
  data: T[];
}

export interface ApiItemResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
}
