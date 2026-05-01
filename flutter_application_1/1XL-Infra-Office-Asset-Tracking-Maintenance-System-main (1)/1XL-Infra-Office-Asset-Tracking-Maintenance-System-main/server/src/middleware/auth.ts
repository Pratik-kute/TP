import type { RequestHandler } from 'express';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { verifyApiKey, looksLikeApiKey, prefixFromRawKey } from '../lib/apiKey.js';
import { hasScope, type Scope } from '../lib/scopes.js';
import { objectToCamel } from '../lib/caseMapper.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { AuthedRequest, AuthedUser, AuthedApiKey } from './types.js';
import { log } from '../lib/log.js';
import { apiKeyRateLimit } from './rateLimit.js';

/**
 * Single-header auth using the standard `Authorization: Bearer <token>` scheme.
 *
 *   - Token shaped like `<orgslug>_<live|test>_<24chars>` → API key
 *   - Anything else                                       → user JWT
 *
 * Endpoints declare what they require:
 *
 *   /auth/login, /auth/refresh, /auth/logout
 *      Accept ONLY an API key (no user yet).
 *
 *   Everything else
 *      Accepts EITHER:
 *        - A user JWT alone (the JWT was issued by /auth/login, which already
 *          required a valid API key — server-side context is preserved on the
 *          JWT, so we don't re-check the API key on every call), OR
 *        - An API key alone (server-to-server / integration callers without a
 *          user context).
 *
 * Either form satisfies authentication; per-route scope checks then decide
 * what's allowed.
 */

function readBearer(req: import('express').Request): string | null {
  const h = req.header('authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Resolve the bearer token to an API key row. */
async function resolveApiKey(raw: string): Promise<AuthedApiKey> {
  const prefix = prefixFromRawKey(raw);
  if (!prefix) throw Errors.invalidApiKey('Malformed API key');

  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('key_prefix', prefix)
    .eq('is_active', true)
    .limit(5);
  if (error) {
    log.error({ err: error }, 'api_keys lookup failed');
    throw Errors.internal('API key lookup failed');
  }
  if (!data || data.length === 0) throw Errors.invalidApiKey();

  let matched: any = null;
  for (const row of data) {
    if (await verifyApiKey(raw, row.key_hash)) { matched = row; break; }
  }
  if (!matched) throw Errors.invalidApiKey();
  if (matched.expires_at && new Date(matched.expires_at) < new Date()) {
    throw Errors.invalidApiKey('API key expired');
  }
  if (matched.revoked_at) throw Errors.invalidApiKey('API key revoked');

  return {
    id:                  matched.id,
    organizationId:      matched.organization_id,
    name:                matched.name,
    scopes:              matched.scopes ?? [],
    rateLimitPerMinute:  matched.rate_limit_per_minute ?? 120,
  };
}

/** Resolve the bearer token to a user via JWT. */
async function resolveUser(raw: string): Promise<AuthedUser> {
  const payload = verifyAccessToken(raw);
  const { data, error } = await db
    .from('users')
    .select('id, email, name, role, organization_id, is_active, is_global_admin')
    .eq('id', payload.sub)
    .maybeSingle();
  if (error) {
    log.error({ err: error }, 'user lookup failed');
    throw Errors.internal('User lookup failed');
  }
  if (!data) throw Errors.unauthenticated('User no longer exists');
  if (!data.is_active) throw Errors.unauthenticated('User account is disabled');

  return {
    id:             data.id,
    email:          data.email,
    name:           data.name,
    role:           data.role,
    organizationId: data.organization_id,
    isGlobalAdmin:  !!data.is_global_admin,
  };
}

// ─── Middleware: API key only (login, refresh, logout) ─────────────────────
export const requireApiKey: RequestHandler = asyncHandler(async (req, _res, next) => {
  const ar = req as AuthedRequest;
  if (ar.apiKey) return next(); // idempotent

  const token = readBearer(req);
  if (!token) throw Errors.unauthenticated('Missing Authorization: Bearer header');
  if (!looksLikeApiKey(token)) {
    throw Errors.invalidApiKey('This endpoint requires an API key, not a user token');
  }

  ar.apiKey = await resolveApiKey(token);
  next();
});

// ─── Middleware: JWT or API key (everything else) ──────────────────────────
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const ar = req as AuthedRequest;
  // Idempotent — already authenticated by some prior chain.
  if (ar.user || ar.apiKey) return next();

  const token = readBearer(req);
  if (!token) throw Errors.unauthenticated('Missing Authorization: Bearer header');

  if (looksLikeApiKey(token)) {
    ar.apiKey = await resolveApiKey(token);
  } else {
    ar.user = await resolveUser(token);
  }
  next();
});

// ─── Scope check ───────────────────────────────────────────────────────────
export function requireScope(scope: Scope): RequestHandler {
  return (req, _res, next) => {
    const ar = req as AuthedRequest;

    // API-key callers: enforce scopes from the key.
    if (ar.apiKey) {
      if (!hasScope(ar.apiKey.scopes, scope)) return next(Errors.insufficientScope(scope));
      return next();
    }
    // JWT-only callers (mobile users): scopes are role-based, not key-based.
    // The route's higher-level role/permissions check handles it.
    if (ar.user) return next();
    return next(Errors.unauthenticated('No credentials presented'));
  };
}

// ─── Rate-limit chain — single bearer + rate limit ─────────────────────────
/** Bearer auth + rate limiting. Use as `router.use(...mobileAuth)`. */
export const mobileAuth: RequestHandler[] = [requireAuth, apiKeyRateLimit];

/** API-key-only chain (login/refresh/logout). */
export const apiKeyAuth: RequestHandler[] = [requireApiKey, apiKeyRateLimit];

/** Convenience: API-key-only + scope. */
export const publicScoped = (scope: Scope): RequestHandler[] => [
  requireApiKey, apiKeyRateLimit, requireScope(scope),
];

/** Convenience: any auth + scope. */
export const protect = (scope: Scope): RequestHandler[] => [
  requireAuth, apiKeyRateLimit, requireScope(scope),
];

export function unwrap(req: import('express').Request) {
  const r = req as AuthedRequest;
  return { user: r.user, apiKey: r.apiKey, requestId: r.requestId };
}

/** Resolve the effective organization for the request. JWT user OR API key. */
export function resolveOrgId(req: import('express').Request): string | null {
  const r = req as AuthedRequest;
  return r.user?.organizationId ?? r.apiKey?.organizationId ?? null;
}

/** Map a snake_case Supabase users row to camelCase response shape. */
export function publicUser(u: any) {
  return objectToCamel({
    id: u.id, name: u.name, email: u.email, role: u.role,
    department_id: u.department_id, phone: u.phone,
    is_active: u.is_active, organization_id: u.organization_id,
    avatar: u.avatar ?? null,
    created_at: u.created_at, updated_at: u.updated_at,
  });
}
