/**
 * API-key scope catalogue. Admins toggle these per key in the React page.
 * Mobile must be issued a key with at least the scopes it needs — failing
 * a scope check returns INSUFFICIENT_SCOPE (403).
 *
 * Naming: `<resource>:<action>`. Wildcard `<resource>:*` grants all actions.
 * `*` alone grants every scope (god-mode key — use sparingly).
 */

export const SCOPES = {
  AUTH_LOGIN:        'auth:login',         // POST /auth/login
  AUTH_REFRESH:      'auth:refresh',       // POST /auth/refresh
  AUTH_READ:         'auth:read',          // GET  /auth/me

  ASSETS_READ:       'assets:read',        // GET  /assets/*  + lookup-by-qr
  ASSETS_WRITE:      'assets:write',       // mutations on assets

  PHOTOS_WRITE:      'photos:write',       // upload-url + finalize

  MAINT_READ:        'maintenance:read',
  MAINT_WRITE:       'maintenance:write',

  REPAIRS_READ:      'repairs:read',
  REPAIRS_WRITE:     'repairs:write',

  RECOVERY_WRITE:    'recovery:write',

  AUDIT_WRITE:       'audit:write',        // verify + flag
  AUDIT_READ:        'audit:read',

  REFERENCE_READ:    'reference:read',     // /reference/users + /reference/locations
} as const;

export type Scope = typeof SCOPES[keyof typeof SCOPES];

export const ALL_SCOPES = Object.values(SCOPES) as Scope[];

/**
 * Default scope bundle for a typical integration — covers every action the
 * standard asset-tracker workflows need. Used as the pre-checked set in the
 * admin "Create key" UI; pare down for read-only or single-purpose keys.
 */
export const DEFAULT_INTEGRATION_SCOPES: Scope[] = [
  SCOPES.AUTH_LOGIN,
  SCOPES.AUTH_REFRESH,
  SCOPES.AUTH_READ,
  SCOPES.ASSETS_READ,
  SCOPES.PHOTOS_WRITE,
  SCOPES.MAINT_READ,
  SCOPES.MAINT_WRITE,
  SCOPES.REPAIRS_READ,
  SCOPES.REPAIRS_WRITE,
  SCOPES.RECOVERY_WRITE,
  SCOPES.AUDIT_READ,
  SCOPES.AUDIT_WRITE,
  SCOPES.REFERENCE_READ,
];

export function hasScope(granted: string[] | null | undefined, required: Scope): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  const resource = required.split(':')[0];
  return granted.includes(`${resource}:*`);
}
