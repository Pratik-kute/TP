import type { RequestHandler } from 'express';
import { Errors } from '../lib/errors.js';
import { config } from '../config.js';
import type { AuthedRequest } from './types.js';

/**
 * In-memory token bucket. Adequate for a single-instance deployment; swap
 * for Redis if you scale horizontally. Keys:
 *   - per API key (matches the rate_limit_per_minute on the key)
 *   - per IP for /auth/login (matches LOGIN_RATE_LIMIT_PER_15MIN)
 */

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref();

function take(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

function getIp(req: import('express').Request): string {
  // honour X-Forwarded-For when behind a proxy you trust (set `app.set('trust proxy', 1)`)
  const fwd = req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** Per-API-key bucket. Apply AFTER requireApiKey so we know the key + its limit. */
export const apiKeyRateLimit: RequestHandler = (req, res, next) => {
  const apiKey = (req as AuthedRequest).apiKey;
  if (!apiKey) return next(); // no key, no per-key limit
  const limit = apiKey.rateLimitPerMinute || config.DEFAULT_RATE_LIMIT_PER_MINUTE;
  const r = take(`apikey:${apiKey.id}`, limit, 60_000);
  res.setHeader('x-ratelimit-limit', String(limit));
  res.setHeader('x-ratelimit-remaining', String(Math.max(r.remaining, 0)));
  res.setHeader('x-ratelimit-reset', String(Math.floor(r.resetAt / 1000)));
  if (!r.ok) {
    res.setHeader('retry-after', String(Math.ceil((r.resetAt - Date.now()) / 1000)));
    return next(Errors.rateLimited(`Rate limit exceeded (${limit}/min)`));
  }
  next();
};

/** Stricter per-IP bucket for login. Apply on /auth/login only. */
export const loginRateLimit: RequestHandler = (req, res, next) => {
  const limit = config.LOGIN_RATE_LIMIT_PER_15MIN;
  const window = 15 * 60_000;
  const r = take(`login:${getIp(req)}`, limit, window);
  res.setHeader('x-ratelimit-limit', String(limit));
  res.setHeader('x-ratelimit-remaining', String(Math.max(r.remaining, 0)));
  if (!r.ok) {
    res.setHeader('retry-after', String(Math.ceil((r.resetAt - Date.now()) / 1000)));
    return next(Errors.rateLimited('Too many login attempts. Try again in 15 minutes.'));
  }
  next();
};
