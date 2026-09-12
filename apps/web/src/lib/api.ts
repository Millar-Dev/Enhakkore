/**
 * Single entry point for talking to the Enhakkore API.
 *
 * Public marketplace pages render on the server and call `apiGet` directly.
 * Signed-in areas run in the browser and call `apiFetch`, which attaches the
 * stored bearer token. Nothing else in the app constructs a URL or reads the
 * token — swapping to cookie sessions later is a change in this file alone.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'enhakkore.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages from the API's validation errors. */
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, code = 'error', fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — the session simply won't persist */
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Override the Next.js fetch cache for server-side calls. */
  revalidate?: number | false;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, revalidate, token: explicitToken, headers, ...rest } = options;
  const token = explicitToken !== undefined ? explicitToken : getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(revalidate !== undefined ? { next: { revalidate: revalidate === false ? 0 : revalidate } } : {}),
  });

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; fields?: Record<string, string> } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.message ?? 'Something went wrong. Please try again.',
      error?.code ?? 'error',
      error?.fields ?? {},
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Server-side read used by public pages.
 *
 * Returns `null` rather than throwing when the API is unreachable, so a page
 * can render its own "we could not load this" state instead of a 500. Every
 * caller is expected to handle null — that is the point.
 */
export async function apiGet<T>(path: string, revalidate: number | false = 60): Promise<T | null> {
  try {
    return await request<T>(path, { method: 'GET', revalidate, token: null });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    console.error(`[web] API read failed: ${path}`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Builds a querystring, dropping empty values so URLs stay clean. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}
