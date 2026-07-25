const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthHandlers {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: () => void;
}

let authHandlers: AuthHandlers | null = null;

export function setAuthHandlers(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

export function clearAuthHandlers(): void {
  authHandlers = null;
}

export interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

async function doFetch(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, body, message);
  }
  return body as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated, ...init } = options;
  const token = authenticated && authHandlers ? authHandlers.getAccessToken() : null;
  let res = await doFetch(path, init, token);

  if (authenticated && res.status === 401 && authHandlers) {
    const newToken = await authHandlers.refreshAccessToken();
    if (newToken) {
      res = await doFetch(path, init, newToken);
    }
    if (res.status === 401) {
      authHandlers.onAuthFailure();
    }
  }

  return parseResponse<T>(res);
}
