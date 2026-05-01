import type { Request } from 'express';
import { Errors } from './errors.js';
import type { AuthedRequest, AuthedUser } from '../middleware/types.js';

/**
 * Either-or actor context. Every protected request has one — either a real
 * user (JWT) or an API-key integration. Routes that need a person to attach
 * to audit logs can call `actor.userIdOrNull` and `actor.displayName`.
 *
 * For permission decisions that mirror the web's role matrix (e.g. computing
 * `permittedActions`), `actor.asUser()` returns a User-shaped object —
 * synthesizing a virtual "integration" user when only an API key is present.
 * Integrations are treated as admin-equivalent because their authority comes
 * from their explicit scope grants, not from a role.
 */
export interface Actor {
  organizationId: string;
  userId:         string | null;       // null when authenticated via API key only
  displayName:    string;              // user's name OR "API key: <name>"
  isApiKey:       boolean;
  asUser():       AuthedUser;          // real user OR virtual actor for permission funcs
}

export function getActor(req: Request): Actor {
  const ar = req as AuthedRequest;

  if (ar.user) {
    const orgId = ar.user.organizationId;
    if (!orgId) throw Errors.forbidden('User has no organization');
    return {
      organizationId: orgId,
      userId:         ar.user.id,
      displayName:    ar.user.name,
      isApiKey:       false,
      asUser:         () => ar.user!,
    };
  }
  if (ar.apiKey) {
    const orgId = ar.apiKey.organizationId;
    return {
      organizationId: orgId,
      userId:         null,
      displayName:    `API key: ${ar.apiKey.name}`,
      isApiKey:       true,
      asUser: () => ({
        id:             '00000000-0000-0000-0000-000000000000',
        email:          'integration@api',
        name:           `API key: ${ar.apiKey!.name}`,
        role:           'admin',         // integration scope-bearing — treat as admin for action matrix
        organizationId: orgId,
        isGlobalAdmin:  false,
      }),
    };
  }
  throw Errors.unauthenticated('No actor on request');
}
