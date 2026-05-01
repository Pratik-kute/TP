import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { DEFAULT_PAGE_PERMISSIONS, ADMIN_ONLY_PAGES, ALWAYS_ACCESSIBLE_PAGES } from '../lib/defaultPagePermissions';

export function usePageAccess() {
  const { user, organization } = useAuth();

  /** Get the list of accessible page segments for a given role */
  const getAccessiblePages = useCallback((role: UserRole): string[] => {
    if (role === 'admin') {
      // Admin always has access to everything
      return ['dashboard', 'assets', 'allocations', 'maintenance', 'repairs', 'consumables',
        'procurement', 'vendors', 'depreciation', 'audits', 'audit-logs', 'reports',
        'documents', 'locations', 'users', 'settings', 'access-control', 'notifications'];
    }
    const orgPerms = organization?.pagePermissions;
    if (orgPerms && orgPerms[role]) {
      const pages = orgPerms[role]!;
      // Always ensure dashboard is included
      return pages.includes('dashboard') ? pages : ['dashboard', ...pages];
    }
    // Fall back to defaults
    return DEFAULT_PAGE_PERMISSIONS[role] || ['dashboard'];
  }, [organization]);

  /** Check if the current user can access a specific page segment */
  const canAccess = useCallback((segment: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (ALWAYS_ACCESSIBLE_PAGES.includes(segment)) return true;
    if (ADMIN_ONLY_PAGES.includes(segment)) return false;
    return getAccessiblePages(user.role).includes(segment);
  }, [user, getAccessiblePages]);

  return { canAccess, getAccessiblePages };
}
