import type { Request } from 'express';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  isGlobalAdmin: boolean;
}

export interface AuthedApiKey {
  id: string;
  organizationId: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
}

export interface AuthedRequest extends Request {
  requestId: string;
  user?: AuthedUser;
  apiKey?: AuthedApiKey;
  /** Set by idempotency middleware so the response writer can capture the body. */
  idempotencyKey?: string;
}
