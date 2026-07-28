import type { UserAccount } from './types';

export const API_TOKEN_KEY = 'ldb_api_token';

export const isCentralApiAvailable = (): boolean =>
  typeof window !== 'undefined' && window.location.protocol !== 'file:';

export const getApiToken = (): string =>
  typeof window === 'undefined' ? '' : window.localStorage.getItem(API_TOKEN_KEY) || '';

export const setApiToken = (token: string): void => {
  window.localStorage.setItem(API_TOKEN_KEY, token);
};

export const clearApiToken = (): void => {
  window.localStorage.removeItem(API_TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  const token = getApiToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) clearApiToken();
    const body = await response.json().catch(() => null) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      response.status,
      body?.error?.code || 'API_ERROR',
      body?.error?.message || `API request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const loginCentral = async (
  username: string,
  password: string,
  branch: string,
): Promise<{ token: string; expiresAt: string; user: UserAccount }> => {
  const result = await apiRequest<{
    token: string;
    expiresAt: string;
    user: UserAccount;
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, branch }),
  });
  setApiToken(result.token);
  return result;
};

export const logoutCentral = async (): Promise<void> => {
  try {
    if (getApiToken()) {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    }
  } finally {
    clearApiToken();
  }
};
