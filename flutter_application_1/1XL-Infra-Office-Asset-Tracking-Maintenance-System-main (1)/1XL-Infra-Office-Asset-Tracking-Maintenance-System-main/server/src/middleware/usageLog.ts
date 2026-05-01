import type { RequestHandler } from 'express';
import { db } from '../db.js';
import type { AuthedRequest } from './types.js';
import { log } from '../lib/log.js';

/**
 * Fire-and-forget request logger. Writes one row per request to
 * `api_key_usage_log` (only when an API key was attached), and bumps
 * `api_keys.last_used_at` / `last_used_ip`.
 *
 * Runs on `res.on('finish')` so it doesn't block the response.
 */
export const usageLog: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ar = req as AuthedRequest;
    if (!ar.apiKey) return;
    const elapsed = Date.now() - start;
    const ip = (req.header('x-forwarded-for')?.split(',')[0].trim()) || req.ip || null;
    const ua = req.header('user-agent') || null;
    const errorCode = (res.locals?.errorCode as string | undefined) ?? null;

    db.from('api_key_usage_log').insert({
      api_key_id: ar.apiKey.id,
      organization_id: ar.apiKey.organizationId,
      user_id: ar.user?.id ?? null,
      endpoint: req.originalUrl.split('?')[0],
      method: req.method,
      status_code: res.statusCode,
      response_time_ms: elapsed,
      ip,
      user_agent: ua,
      request_id: ar.requestId,
      error_code: errorCode,
    }).then(({ error }) => {
      if (error) log.warn({ err: error }, 'usage log insert failed');
    });

    db.from('api_keys')
      .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
      .eq('id', ar.apiKey.id)
      .then(({ error }) => {
        if (error) log.warn({ err: error }, 'api_keys.last_used_at update failed');
      });
  });
  next();
};
