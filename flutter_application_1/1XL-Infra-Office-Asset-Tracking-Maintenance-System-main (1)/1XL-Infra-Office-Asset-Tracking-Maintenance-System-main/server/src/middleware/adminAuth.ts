import type { RequestHandler } from 'express';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { AuthedRequest } from './types.js';

/**
 * Admin auth for the React management UI.
 *
 * The web app posts:
 *   X-Admin-User-Id: <uuid of the logged-in admin>
 *
 * We trust this header because the web is on the same origin/subdomain and
 * the user id is an unguessable UUID — same trust model as the existing
 * `monthly-asset-report` Edge Function. The server then verifies that the
 * user actually has `role = 'admin'` and is active.
 *
 * If you later move the web to JWTs as well, replace this with `requireUserJwt`.
 */
export const requireAdminUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const adminUserId = req.header('x-admin-user-id');
  if (!adminUserId) throw Errors.unauthenticated('Missing X-Admin-User-Id header');

  const { data: user, error } = await db
    .from('users')
    .select('id, name, email, role, organization_id, is_active, is_global_admin')
    .eq('id', adminUserId)
    .maybeSingle();

  if (error || !user) throw Errors.unauthenticated('Admin user not found');
  if (!user.is_active) throw Errors.forbidden('Admin user disabled');
  if (user.role !== 'admin' && !user.is_global_admin) {
    throw Errors.forbidden('Only admins may manage API keys');
  }

  (req as AuthedRequest).user = {
    id: user.id, email: user.email, name: user.name, role: user.role,
    organizationId: user.organization_id, isGlobalAdmin: !!user.is_global_admin,
  };
  next();
});
