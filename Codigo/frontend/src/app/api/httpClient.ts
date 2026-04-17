import type { ApiErrorResponse } from "../types/api";
import { authStorage } from "../lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";

export class HttpError extends Error {
  status: number;
  payload?: ApiErrorResponse;

  constructor(status: number, message: string, payload?: ApiErrorResponse) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorResponse | undefined> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined) as Promise<ApiErrorResponse | undefined>;
  }
  return undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const message = errorPayload?.message ?? `HTTP ${response.status}`;
    if (response.status === 401) {
      authStorage.clearToken();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    throw new HttpError(response.status, message, errorPayload);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as Promise<T>;
}

export const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
