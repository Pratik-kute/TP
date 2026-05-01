import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import type { AuthedRequest } from './types.js';
import { log } from '../lib/log.js';

/**
 * Section 6.4 — Idempotency-Key support for unsafe verbs.
 *
 * Behaviour:
 *  - GET / DELETE → ignored
 *  - No header   → ignored (handler runs normally)
 *  - Header set, key NOT in DB → handler runs; on response we cache the
 *    JSON body for IDEMPOTENCY_TTL_HOURS keyed by (key, endpoint, body-hash)
 *  - Header set, key IN DB     → if request hash matches, replay cached
 *    response; if it differs, return 409 CONFLICT (key reuse with new body)
 */

const VALID_KEY = /^[A-Za-z0-9_\-]{16,128}$/;

function hashBody(method: string, url: string, body: unknown): string {
  const h = crypto.createHash('sha256');
  h.update(method); h.update(url);
  h.update(typeof body === 'string' ? body : JSON.stringify(body ?? null));
  return h.digest('hex');
}

export const idempotency: RequestHandler = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'DELETE') return next();

  const key = req.header('idempotency-key');
  if (!key) return next();
  if (!VALID_KEY.test(key)) {
    return next(new Error('Invalid Idempotency-Key format (16-128 chars, A-Z a-z 0-9 _ -)'));
  }

  const ar = req as AuthedRequest;
  const ownerScope = ar.user?.id ?? ar.apiKey?.id ?? 'anon';
  const compoundKey = `${ownerScope}:${key}`;
  const reqHash = hashBody(req.method, req.originalUrl, req.body);

  const { data, error } = await db
    .from('idempotency_keys')
    .select('*')
    .eq('key', compoundKey)
    .maybeSingle();

  if (error) {
    log.warn({ err: error }, 'idempotency lookup failed; proceeding without dedupe');
    return next();
  }

  if (data) {
    if (new Date(data.expires_at) < new Date()) {
      // expired — drop and proceed
      db.from('idempotency_keys').delete().eq('key', compoundKey).then(() => undefined);
    } else if (data.request_hash !== reqHash) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Idempotency-Key reused with a different request body',
          requestId: ar.requestId,
        },
      });
      return;
    } else {
      res.status(data.status_code).json(data.response_body);
      return;
    }
  }

  // Capture the response for caching.
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Only cache successful + safe-to-replay responses (2xx).
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const expiresAt = new Date(Date.now() + config.IDEMPOTENCY_TTL_HOURS * 3600 * 1000).toISOString();
      db.from('idempotency_keys').insert({
        key: compoundKey,
        api_key_id: ar.apiKey?.id ?? null,
        user_id: ar.user?.id ?? null,
        endpoint: req.originalUrl.split('?')[0],
        method: req.method,
        request_hash: reqHash,
        status_code: res.statusCode,
        response_body: body,
        expires_at: expiresAt,
      }).then(({ error: insErr }) => {
        if (insErr) log.warn({ err: insErr }, 'idempotency cache insert failed');
      });
    }
    return originalJson(body);
  };

  next();
};
