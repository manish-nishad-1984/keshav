import type { ApiError, ApiSuccess, Paginated } from '@ckfast/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const buildUrl = (path: string, params?: Record<string, unknown>) => {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

let refreshPromise: Promise<boolean> | null = null;

const refreshAccessToken = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json()) as ApiSuccess<{ accessToken: string }>;
        setAccessToken(body.data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, unknown>;
  retry?: boolean;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, params, retry = true } = options;
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, { ...options, retry: false });
    }
    setAccessToken(null);
    onUnauthorized?.();
    throw new ApiRequestError('Session expired', 401);
  }

  const json = (await res.json()) as ApiSuccess<T> | ApiError;

  if (!json.success) {
    throw new ApiRequestError(json.error.message, res.status, json.error.code, json.error.details);
  }

  return json.data;
};

export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  list: <T>(path: string, params?: Record<string, unknown>) => request<Paginated<T>>(path, { method: 'GET', params }),
};

export { ApiRequestError };
