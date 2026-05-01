import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdminUser } from '../middleware/adminAuth.js';
import { generateApiKey } from '../lib/apiKey.js';
import { ALL_SCOPES, DEFAULT_INTEGRATION_SCOPES } from '../lib/scopes.js';
import type { AuthedRequest } from '../middleware/types.js';

const router = Router();
router.use(requireAdminUser);

const ScopeArr = z.array(z.string().min(1).max(64)).max(64);

function assertOrg(req: import('express').Request) {
  const orgId = (req as AuthedRequest).user!.organizationId;
  if (!orgId) throw Errors.forbidden('Admin user has no organization');
  return orgId;
}

// ── GET /admin/api-keys ────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = assertOrg(req);
    const { data, error } = await db
      .from('api_keys')
      .select('id, name, key_prefix, scopes, rate_limit_per_minute, created_by, created_at, expires_at, last_used_at, last_used_ip, is_active, revoked_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw Errors.internal('Could not list API keys');

    res.json({
      items: (data ?? []).map(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key_prefix,
        scopes: k.scopes ?? [],
        rateLimitPerMinute: k.rate_limit_per_minute,
        createdBy: k.created_by,
        createdAt: k.created_at,
        expiresAt: k.expires_at,
        lastUsedAt: k.last_used_at,
        lastUsedIp: k.last_used_ip,
        isActive: k.is_active,
        revokedAt: k.revoked_at,
      })),
      availableScopes: ALL_SCOPES,
      defaultScopes: DEFAULT_INTEGRATION_SCOPES,
    });
  }),
);

// ── POST /admin/api-keys ───────────────────────────────────────────────────
const CreateBody = z.object({
  name:                z.string().min(2).max(80),
  scopes:              ScopeArr.default([...DEFAULT_INTEGRATION_SCOPES]),
  rateLimitPerMinute:  z.number().int().min(1).max(10_000).default(120),
  expiresAt:           z.string().datetime().nullable().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = assertOrg(req);
    const adminId = (req as AuthedRequest).user!.id;
    const body = validate(CreateBody, req.body);

    // Reject scopes that don't exist.
    const known = new Set<string>([...ALL_SCOPES, '*']);
    for (const s of body.scopes) {
      if (!known.has(s) && !known.has(s.replace(/:.+$/, ':*'))) {
        // allow `<resource>:*` form
        const root = s.split(':')[0];
        const wild = `${root}:*`;
        if (s !== wild && !known.has(s)) {
          throw Errors.validation(`Unknown scope: ${s}`);
        }
      }
    }

    // Resolve the org's short name to use as the API-key prefix.
    const { data: org, error: orgErr } = await db
      .from('organizations')
      .select('short_name')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr || !org) throw Errors.internal('Could not resolve organization');

    const generated = await generateApiKey(org.short_name ?? 'org');
    const { data: row, error: insErr } = await db
      .from('api_keys')
      .insert({
        organization_id:        orgId,
        name:                   body.name,
        key_prefix:             generated.prefix,
        key_hash:               generated.hash,
        scopes:                 body.scopes,
        rate_limit_per_minute:  body.rateLimitPerMinute,
        created_by:             adminId,
        expires_at:             body.expiresAt ?? null,
      })
      .select().single();
    if (insErr) throw Errors.internal('Could not create API key');

    res.status(201).json({
      apiKey: {
        id:                  row.id,
        name:                row.name,
        keyPrefix:           row.key_prefix,
        scopes:              row.scopes,
        rateLimitPerMinute:  row.rate_limit_per_minute,
        createdAt:           row.created_at,
        expiresAt:           row.expires_at,
        isActive:            row.is_active,
      },
      // Returned ONLY here. Will never be retrievable again.
      secret: generated.fullKey,
    });
  }),
);

// ── PATCH /admin/api-keys/:id ──────────────────────────────────────────────
const PatchBody = z.object({
  name:                z.string().min(2).max(80).optional(),
  scopes:              ScopeArr.optional(),
  rateLimitPerMinute:  z.number().int().min(1).max(10_000).optional(),
  expiresAt:           z.string().datetime().nullable().optional(),
  isActive:            z.boolean().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const orgId = assertOrg(req);
    const id = z.string().uuid().parse(req.params.id);
    const body = validate(PatchBody, req.body);

    const { data: existing } = await db
      .from('api_keys').select('organization_id').eq('id', id).maybeSingle();
    if (!existing) throw Errors.notFound('API key');
    if (existing.organization_id !== orgId) throw Errors.forbidden('Cross-org access');

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined)               patch.name = body.name;
    if (body.scopes !== undefined)             patch.scopes = body.scopes;
    if (body.rateLimitPerMinute !== undefined) patch.rate_limit_per_minute = body.rateLimitPerMinute;
    if (body.expiresAt !== undefined)          patch.expires_at = body.expiresAt;
    if (body.isActive !== undefined)           patch.is_active = body.isActive;

    if (Object.keys(patch).length === 0) {
      res.json({ ok: true });
      return;
    }
    const { error } = await db.from('api_keys').update(patch).eq('id', id);
    if (error) throw Errors.internal('Could not update API key');
    res.json({ ok: true });
  }),
);

// ── DELETE /admin/api-keys/:id  (revoke, never hard-delete) ────────────────
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const orgId = assertOrg(req);
    const adminId = (req as AuthedRequest).user!.id;
    const id = z.string().uuid().parse(req.params.id);

    const { data: existing } = await db
      .from('api_keys').select('organization_id').eq('id', id).maybeSingle();
    if (!existing) throw Errors.notFound('API key');
    if (existing.organization_id !== orgId) throw Errors.forbidden('Cross-org access');

    const { error } = await db
      .from('api_keys')
      .update({
        is_active:   false,
        revoked_at:  new Date().toISOString(),
        revoked_by:  adminId,
      })
      .eq('id', id);
    if (error) throw Errors.internal('Could not revoke API key');
    res.json({ ok: true });
  }),
);

// ── GET /admin/api-keys/:id/usage ──────────────────────────────────────────
const UsageQuery = z.object({
  windowHours: z.coerce.number().int().min(1).max(720).default(24),
  limit:       z.coerce.number().int().min(1).max(500).default(100),
});

router.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    const orgId = assertOrg(req);
    const id = z.string().uuid().parse(req.params.id);
    const q = validate(UsageQuery, req.query);

    const { data: existing } = await db
      .from('api_keys').select('organization_id').eq('id', id).maybeSingle();
    if (!existing) throw Errors.notFound('API key');
    if (existing.organization_id !== orgId) throw Errors.forbidden('Cross-org access');

    const sinceIso = new Date(Date.now() - q.windowHours * 3600 * 1000).toISOString();
    const { data: rows, error } = await db
      .from('api_key_usage_log')
      .select('endpoint, method, status_code, response_time_ms, ip, user_id, request_id, error_code, timestamp')
      .eq('api_key_id', id)
      .gte('timestamp', sinceIso)
      .order('timestamp', { ascending: false })
      .limit(q.limit);
    if (error) throw Errors.internal('Usage lookup failed');

    // Cheap aggregate.
    const summary = {
      totalRequests: rows?.length ?? 0,
      successCount: rows?.filter(r => r.status_code < 400).length ?? 0,
      errorCount:   rows?.filter(r => r.status_code >= 400).length ?? 0,
      avgResponseMs: rows?.length
        ? Math.round(rows.reduce((s, r) => s + (r.response_time_ms ?? 0), 0) / rows.length)
        : 0,
      topEndpoints: aggregate(rows ?? [], r => `${r.method} ${r.endpoint}`).slice(0, 10),
      topErrors:    aggregate((rows ?? []).filter(r => r.status_code >= 400), r => r.error_code ?? `HTTP_${r.status_code}`).slice(0, 10),
    };

    res.json({
      windowHours: q.windowHours,
      summary,
      recent: (rows ?? []).map(r => ({
        endpoint: r.endpoint, method: r.method, statusCode: r.status_code,
        responseTimeMs: r.response_time_ms, ip: r.ip, userId: r.user_id,
        requestId: r.request_id, errorCode: r.error_code, timestamp: r.timestamp,
      })),
    });
  }),
);

function aggregate<T>(rows: T[], pick: (r: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export default router;
