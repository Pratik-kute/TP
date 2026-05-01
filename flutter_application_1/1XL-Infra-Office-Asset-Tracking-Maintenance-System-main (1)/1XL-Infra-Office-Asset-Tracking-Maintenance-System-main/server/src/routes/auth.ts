import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/jwt.js';
import { hashPassword, plaintextEquals, verifyPassword } from '../lib/password.js';
import { config } from '../config.js';
import { validate } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { publicScoped, requireApiKey, mobileAuth, publicUser, requireScope } from '../middleware/auth.js';
import { apiKeyRateLimit } from '../middleware/rateLimit.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { SCOPES } from '../lib/scopes.js';
import type { AuthedRequest } from '../middleware/types.js';

const router = Router();

// ─── POST /auth/login ───────────────────────────────────────────────────────
const LoginBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
  deviceId: z.string().min(1).max(128).optional(),
});

router.post(
  '/login',
  loginRateLimit,
  ...publicScoped(SCOPES.AUTH_LOGIN),
  asyncHandler(async (req, res) => {
    const body = validate(LoginBody, req.body);
    const ip = (req.header('x-forwarded-for')?.split(',')[0].trim()) || req.ip || null;
    const ua = req.header('user-agent') || null;

    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('email', body.email)
      .maybeSingle();

    // Same response on user-not-found vs wrong-password to prevent enumeration.
    if (error || !user) throw Errors.unauthenticated('Invalid email or password');
    if (!user.is_active) throw Errors.unauthenticated('Account disabled');

    let valid = false;
    if (user.password_hash) {
      valid = await verifyPassword(body.password, user.password_hash);
    } else if (user.password) {
      // Legacy plaintext path — verify, then upgrade to bcrypt.
      valid = plaintextEquals(body.password, user.password);
      if (valid) {
        const newHash = await hashPassword(body.password);
        await db.from('users').update({ password_hash: newHash }).eq('id', user.id);
      }
    }
    if (!valid) throw Errors.unauthenticated('Invalid email or password');

    // Cross-org guard: API key org must match user org (super admin exempt).
    const apiKey = (req as AuthedRequest).apiKey!;
    if (!user.is_global_admin && user.organization_id !== apiKey.organizationId) {
      throw Errors.forbidden('User does not belong to this API key organization');
    }

    const access = signAccessToken({
      sub: user.id,
      org: user.organization_id,
      role: user.role,
    });
    const refresh = generateRefreshToken();
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL_SECONDS * 1000).toISOString();

    await db.from('refresh_tokens').insert({
      user_id: user.id,
      token_hash: refresh.hash,
      device_id: body.deviceId ?? null,
      user_agent: ua,
      ip,
      expires_at: expiresAt,
    });

    res.json({
      accessToken: access,
      accessTokenExpiresIn: config.JWT_ACCESS_TTL_SECONDS,
      refreshToken: refresh.raw,
      refreshTokenExpiresIn: config.JWT_REFRESH_TTL_SECONDS,
      user: publicUser(user),
    });
  }),
);

// ─── POST /auth/refresh ─────────────────────────────────────────────────────
const RefreshBody = z.object({
  refreshToken: z.string().min(20),
  deviceId: z.string().min(1).max(128).optional(),
});

router.post(
  '/refresh',
  ...publicScoped(SCOPES.AUTH_REFRESH),
  asyncHandler(async (req, res) => {
    const body = validate(RefreshBody, req.body);
    const ip = (req.header('x-forwarded-for')?.split(',')[0].trim()) || req.ip || null;
    const ua = req.header('user-agent') || null;
    const tokenHash = hashRefreshToken(body.refreshToken);

    const { data: row } = await db
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row) throw Errors.unauthenticated('Refresh token not recognised');
    if (row.revoked_at) {
      // Reuse-after-revoke: revoke ALL of this user's active refresh tokens.
      await db.from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .is('revoked_at', null);
      throw Errors.unauthenticated('Refresh token reuse detected — all sessions invalidated');
    }
    if (new Date(row.expires_at) < new Date()) {
      throw Errors.tokenExpired('Refresh token expired');
    }

    const { data: user } = await db
      .from('users').select('*').eq('id', row.user_id).maybeSingle();
    if (!user || !user.is_active) throw Errors.unauthenticated('User not available');

    // Rotate: revoke old, issue new.
    const newRefresh = generateRefreshToken();
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL_SECONDS * 1000).toISOString();
    const { data: inserted } = await db.from('refresh_tokens').insert({
      user_id: user.id,
      token_hash: newRefresh.hash,
      device_id: body.deviceId ?? row.device_id ?? null,
      user_agent: ua,
      ip,
      expires_at: expiresAt,
    }).select('id').single();

    await db.from('refresh_tokens')
      .update({
        revoked_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        replaced_by: inserted?.id ?? null,
      })
      .eq('id', row.id);

    const access = signAccessToken({
      sub: user.id, org: user.organization_id, role: user.role,
    });

    res.json({
      accessToken: access,
      accessTokenExpiresIn: config.JWT_ACCESS_TTL_SECONDS,
      refreshToken: newRefresh.raw,
      refreshTokenExpiresIn: config.JWT_REFRESH_TTL_SECONDS,
    });
  }),
);

// ─── POST /auth/logout ──────────────────────────────────────────────────────
const LogoutBody = z.object({
  refreshToken: z.string().min(20),
  /** When true, revoke every active refresh token for this user. */
  allDevices: z.boolean().optional(),
});

router.post(
  '/logout',
  requireApiKey,
  apiKeyRateLimit,
  // user JWT optional — logout works even with an expired access token
  asyncHandler(async (req, res) => {
    const body = validate(LogoutBody, req.body);
    const tokenHash = hashRefreshToken(body.refreshToken);

    const { data: row } = await db
      .from('refresh_tokens')
      .select('id, user_id, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row) {
      res.json({ ok: true }); // idempotent
      return;
    }

    if (body.allDevices) {
      await db.from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .is('revoked_at', null);
    } else if (!row.revoked_at) {
      await db.from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    res.json({ ok: true });
  }),
);

// ─── GET /auth/me ───────────────────────────────────────────────────────────
router.get(
  '/me',
  ...mobileAuth,
  requireScope(SCOPES.AUTH_READ),
  asyncHandler(async (req, res) => {
    const ar = req as AuthedRequest;
    const user = ar.user;
    if (!user) throw Errors.forbidden('/auth/me requires a user JWT, not an API key');

    let organization: any = null;
    if (user.organizationId) {
      const { data } = await db
        .from('organizations')
        .select('id, name, short_name, logo_url, currency, country, contact_email, contact_phone, industry')
        .eq('id', user.organizationId)
        .maybeSingle();
      organization = data ? {
        id: data.id, name: data.name, shortName: data.short_name,
        logoUrl: data.logo_url, currency: data.currency, country: data.country,
        contactEmail: data.contact_email, contactPhone: data.contact_phone, industry: data.industry,
      } : null;
    }

    res.json({ user, organization });
  }),
);

export default router;
