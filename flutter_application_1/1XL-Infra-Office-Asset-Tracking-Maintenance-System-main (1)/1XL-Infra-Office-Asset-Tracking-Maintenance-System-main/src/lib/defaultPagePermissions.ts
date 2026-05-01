import { UserRole } from '../types';

/** Pages that only admin can ever access — not configurable */
export const ADMIN_ONLY_PAGES = ['locations', 'users', 'settings', 'api-keys'];

/** Pages that are always accessible to every role — cannot be removed */
export const ALWAYS_ACCESSIBLE_PAGES = ['dashboard', 'notifications'];

/** Default page access per role (matches the original hardcoded navItems) */
export const DEFAULT_PAGE_PERMISSIONS: Record<Exclude<UserRole, 'admin'>, string[]> = {
  manager: ['dashboard', 'assets', 'allocations', 'maintenance', 'repairs', 'consumables', 'asset-request', 'recovery', 'procurement', 'vendors', 'audits', 'reports', 'documents', 'access-control'],
  employee: ['dashboard', 'assets', 'allocations', 'consumables', 'asset-request'],
  staff: ['dashboard', 'assets', 'allocations', 'consumables', 'asset-request'],
  technician: ['dashboard', 'maintenance', 'repairs', 'asset-request', 'recovery'],
  vendor: ['dashboard', 'repairs', 'asset-request'],
  auditor: ['dashboard', 'assets', 'depreciation', 'audits', 'audit-logs', 'reports', 'asset-request'],
};

/** All page segments that can be toggled on/off per role in the Access Control UI */
export const CONFIGURABLE_PAGES = [
  { segment: 'assets', label: 'Assets' },
  { segment: 'allocations', label: 'Allocations' },
  { segment: 'maintenance', label: 'Maintenance' },
  { segment: 'repairs', label: 'Repairs' },
  { segment: 'consumables', label: 'Consumables' },
  { segment: 'asset-request', label: 'Asset Requests' },
  { segment: 'recovery', label: 'Recovery' },
  { segment: 'procurement', label: 'Procurement' },
  { segment: 'vendors', label: 'Vendors' },
  { segment: 'depreciation', label: 'Depreciation' },
  { segment: 'audits', label: 'Audits' },
  { segment: 'audit-logs', label: 'Activity Log' },
  { segment: 'reports', label: 'Reports' },
  { segment: 'documents', label: 'Documents' },
];

/** Roles that a manager can configure */
export const MANAGER_CONFIGURABLE_ROLES: Exclude<UserRole, 'admin'>[] = ['employee', 'staff', 'technician', 'vendor', 'auditor'];

/** Roles that an admin can configure */
export const ADMIN_CONFIGURABLE_ROLES: Exclude<UserRole, 'admin'>[] = ['manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'];
