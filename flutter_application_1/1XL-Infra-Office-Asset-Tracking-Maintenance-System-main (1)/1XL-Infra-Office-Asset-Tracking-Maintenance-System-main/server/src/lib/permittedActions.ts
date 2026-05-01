/**
 * Section 3.2 — compute the action tiles that mobile should show for a
 * given (user, asset) pair. Pure function, no DB access.
 *
 * The catalogue must stay in lock-step with the mobile app's tile set.
 */

export type PermittedAction =
  | 'add_photo'
  | 'log_maintenance'
  | 'raise_repair'
  | 'update_repair'
  | 'mark_recovery'
  | 'verify_audit';

interface UserCtx {
  role: string;
  isGlobalAdmin: boolean;
}

interface AssetCtx {
  status: string;
  organizationId: string;
}

const ROLE_MATRIX: Record<string, PermittedAction[]> = {
  admin:      ['add_photo', 'log_maintenance', 'raise_repair', 'update_repair', 'mark_recovery', 'verify_audit'],
  manager:    ['add_photo', 'log_maintenance', 'raise_repair', 'update_repair', 'mark_recovery', 'verify_audit'],
  technician: ['add_photo', 'log_maintenance', 'raise_repair', 'update_repair'],
  vendor:     ['update_repair'],
  auditor:    ['add_photo', 'verify_audit'],
  employee:   ['add_photo', 'raise_repair'],
  staff:      ['add_photo', 'raise_repair'],
};

const TERMINAL = new Set(['retired', 'disposed', 'dead']);

export function computePermittedActions(user: UserCtx, asset: AssetCtx): PermittedAction[] {
  const base = user.isGlobalAdmin
    ? (['add_photo', 'log_maintenance', 'raise_repair', 'update_repair', 'mark_recovery', 'verify_audit'] as PermittedAction[])
    : (ROLE_MATRIX[user.role] ?? []);

  if (TERMINAL.has(asset.status)) return base.filter(a => a === 'add_photo');
  return base;
}
