/**
 * Thin client for the mobile-API admin endpoints (server/src/routes/adminApiKeys.ts).
 * The web app uses the logged-in user's UUID as a poor-man's auth token —
 * matches the existing convention used by the monthly-asset-report Edge Function.
 */

const BASE = (import.meta.env.VITE_MOBILE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  isActive: boolean;
  revokedAt: string | null;
}

export interface ApiKeyListResponse {
  items: ApiKey[];
  availableScopes: string[];
  defaultScopes: string[];
}

export interface ApiKeyCreateResponse {
  apiKey: ApiKey;
  secret: string;          // shown once
}

export interface ApiKeyUsageRow {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ip: string | null;
  userId: string | null;
  requestId: string | null;
  errorCode: string | null;
  timestamp: string;
}

export interface ApiKeyUsageResponse {
  windowHours: number;
  summary: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseMs: number;
    topEndpoints: { key: string; count: number }[];
    topErrors:    { key: string; count: number }[];
  };
  recent: ApiKeyUsageRow[];
}

async function request<T>(path: string, init: RequestInit, adminUserId: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-user-id': adminUserId,
      ...(init.headers ?? {}),
    },
  });
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (typeof body === 'object' && body && 'error' in body && (body as any).error?.message)
      ? (body as any).error.message
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export const apiKeysClient = {
  baseUrl: BASE,

  list: (adminUserId: string) =>
    request<ApiKeyListResponse>('/api/v1/admin/api-keys', { method: 'GET' }, adminUserId),

  create: (adminUserId: string, body: {
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    expiresAt: string | null;
  }) =>
    request<ApiKeyCreateResponse>('/api/v1/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    }, adminUserId),

  patch: (adminUserId: string, id: string, body: Partial<{
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    expiresAt: string | null;
    isActive: boolean;
  }>) =>
    request<{ ok: true }>(`/api/v1/admin/api-keys/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, adminUserId),

  revoke: (adminUserId: string, id: string) =>
    request<{ ok: true }>(`/api/v1/admin/api-keys/${id}`, { method: 'DELETE' }, adminUserId),

  usage: (adminUserId: string, id: string, windowHours = 24) =>
    request<ApiKeyUsageResponse>(`/api/v1/admin/api-keys/${id}/usage?windowHours=${windowHours}`, {
      method: 'GET',
    }, adminUserId),
};
