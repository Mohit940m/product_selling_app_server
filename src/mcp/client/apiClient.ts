import { API_BASE_URL } from '../config.js';

/**
 * Thin HTTP client for the product_selling_app_server REST API.
 *
 * Adds the base URL and a Bearer token, forwards optional query params and a
 * JSON body, and maps non-2xx responses into a typed ApiError so tools can
 * surface a clean message instead of crashing.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  // Bearer token to send. If falsy, the request is rejected up front.
  token?: string;
  // Query string params (undefined/null values are skipped).
  query?: Record<string, string | number | boolean | undefined | null>;
  // JSON body for write requests.
  body?: unknown;
  // Extra headers (e.g. the `variant-id` header used by get-product).
  headers?: Record<string, string>;
  // Allow calling public endpoints (optionalAuthUser) without a token.
  allowAnonymous?: boolean;
}

/**
 * Perform a request against the REST API and return the parsed JSON payload.
 * Throws ApiError on transport failure, missing token, or a non-2xx status.
 */
export async function apiRequest<T = unknown>(
  options: ApiRequestOptions,
): Promise<T> {
  const { method = 'GET', path, token, query, body, headers, allowAnonymous } =
    options;

  if (!token && !allowAnonymous) {
    throw new ApiError(
      401,
      'No authentication token configured. Set MCP_API_TOKEN (buyer) or MCP_SELLER_API_TOKEN (seller) in the environment.',
      null,
    );
  }

  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const requestHeaders: Record<string, string> = { ...(headers || {}) };
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers: requestHeaders };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: any) {
    throw new ApiError(
      0,
      `Failed to reach API at ${API_BASE_URL}: ${err?.message || err}. Is the server running (npm run dev)?`,
      null,
    );
  }

  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave parsed as raw text
    }
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as any).message)
        : response.statusText) || 'Request failed';
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}
