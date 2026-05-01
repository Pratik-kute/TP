import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { objectToSnake } from '../lib/caseMapper';
import { PageHeader } from '../components/ui';
import { UserRole, PagePermissions } from '../types';
import {
  DEFAULT_PAGE_PERMISSIONS,
  CONFIGURABLE_PAGES,
  ADMIN_CONFIGURABLE_ROLES,
  MANAGER_CONFIGURABLE_ROLES,
} from '../lib/defaultPagePermissions';
import { Shield, Save, RotateCcw, Check, Lock, Info } from 'lucide-react';

const ROLE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  manager: { label: 'Manager', description: 'Department heads with broad oversight', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  employee: { label: 'Employee', description: 'Standard staff members', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  staff: { label: 'Staff', description: 'General staff with basic access', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  technician: { label: 'Technician', description: 'Maintenance and repair specialists', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  vendor: { label: 'Vendor', description: 'External service providers', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  auditor: { label: 'Auditor', description: 'Compliance and audit personnel', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export default function AccessControl() {
  const { user, organization, updateOrganization } = useAuth();
  const isAdmin = user?.role === 'admin';
  const configurableRoles = isAdmin ? ADMIN_CONFIGURABLE_ROLES : MANAGER_CONFIGURABLE_ROLES;

  const [selectedRole, setSelectedRole] = useState<Exclude<UserRole, 'admin'>>(configurableRoles[0]);
  const [permissions, setPermissions] = useState<PagePermissions>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize permissions from org or defaults
  useEffect(() => {
    const orgPerms = organization?.pagePermissions;
    const merged: PagePermissions = {};
    for (const role of ADMIN_CONFIGURABLE_ROLES) {
      merged[role] = orgPerms?.[role] ?? [...DEFAULT_PAGE_PERMISSIONS[role]];
    }
    setPermissions(merged);
    setHasChanges(false);
  }, [organization]);

  const currentPages = permissions[selectedRole] || DEFAULT_PAGE_PERMISSIONS[selectedRole] || [];

  const togglePage = (segment: string) => {
    if (segment === 'dashboard') return; // Can't remove dashboard
    const current = [...(permissions[selectedRole] || [])];
    const idx = current.indexOf(segment);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(segment);
    }
    setPermissions({ ...permissions, [selectedRole]: current });
    setHasChanges(true);
    setSaved(false);
  };

  const resetToDefaults = () => {
    const merged: PagePermissions = {};
    for (const role of ADMIN_CONFIGURABLE_ROLES) {
      merged[role] = [...DEFAULT_PAGE_PERMISSIONS[role]];
    }
    setPermissions(merged);
    setHasChanges(true);
    setSaved(false);
  };

  const resetRoleToDefault = () => {
    setPermissions({ ...permissions, [selectedRole]: [...DEFAULT_PAGE_PERMISSIONS[selectedRole]] });
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      // Ensure dashboard is always included for every role
      const sanitized: PagePermissions = {};
      for (const [role, pages] of Object.entries(permissions)) {
        const list = pages as string[];
        sanitized[role as Exclude<UserRole, 'admin'>] = list.includes('dashboard') ? list : ['dashboard', ...list];
      }
      const { error } = await supabase
        .from('organizations')
        .update({ page_permissions: sanitized })
        .eq('id', organization.id);
      if (error) throw error;
      updateOrganization({ pagePermissions: sanitized });
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = currentPages.filter(p => p !== 'dashboard').length;
  const totalConfigurable = CONFIGURABLE_PAGES.length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Access Control"
        subtitle="Configure which pages each role can access in your organization"
        action={
          <div className="flex gap-2">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5"
            >
              <RotateCcw className="w-4 h-4" /> Reset All
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">How access control works</p>
          <p className="text-xs mt-0.5 opacity-80">
            {isAdmin
              ? 'As an admin, you have full access to all pages and can configure access for every role. Admin access cannot be restricted.'
              : 'As a manager, you can configure access for employees, technicians, vendors, and auditors. Admin and manager access is managed by admins only.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Tabs (left panel) */}
        <div className="lg:col-span-1">
          <div className="card card-gradient overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100/60 dark:border-zinc-700/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roles</p>
            </div>
            <div className="p-2 space-y-1">
              {/* Admin row (read-only) */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-700/30 opacity-60">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin</p>
                  <p className="text-[10px] text-gray-400">Full access (not configurable)</p>
                </div>
              </div>
              {configurableRoles.map(role => {
                const rc = ROLE_LABELS[role];
                const rolePages = permissions[role] || DEFAULT_PAGE_PERMISSIONS[role] || [];
                const roleEnabled = rolePages.filter(p => p !== 'dashboard').length;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedRole === role
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                        : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${rc.color}`}>
                      {rc.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${selectedRole === role ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{rc.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{roleEnabled} of {totalConfigurable} pages</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Page Access Grid (right panel) */}
        <div className="lg:col-span-3">
          <div className="card card-gradient">
            <div className="px-5 py-4 border-b border-gray-100/60 dark:border-zinc-700/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_LABELS[selectedRole].color}`}>
                  {ROLE_LABELS[selectedRole].label}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Page Access</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{ROLE_LABELS[selectedRole].description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{enabledCount}/{totalConfigurable} enabled</span>
                <button onClick={resetRoleToDefault} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Reset role</button>
              </div>
            </div>

            <div className="p-5">
              {/* Dashboard (always on) */}
              <div className="flex items-center justify-between px-4 py-3 mb-3 bg-gray-50 dark:bg-zinc-700/30 rounded-lg border border-gray-100 dark:border-zinc-600">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dashboard</p>
                    <p className="text-[10px] text-gray-400">Always accessible for all roles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">Always On</span>
                  <div className="w-10 h-5 bg-emerald-600 rounded-full relative opacity-50 cursor-not-allowed">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>

              {/* Configurable pages */}
              <div className="space-y-1">
                {CONFIGURABLE_PAGES.map(page => {
                  const isEnabled = currentPages.includes(page.segment);
                  const isDefault = (DEFAULT_PAGE_PERMISSIONS[selectedRole] || []).includes(page.segment);
                  return (
                    <div
                      key={page.segment}
                      onClick={() => togglePage(page.segment)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                        isEnabled
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div>
                          <p className={`text-sm font-medium ${isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{page.label}</p>
                          {!isDefault && isEnabled && <p className="text-[10px] text-amber-500 font-medium">Custom (not in default)</p>}
                          {isDefault && !isEnabled && <p className="text-[10px] text-red-400 font-medium">Removed from default</p>}
                        </div>
                      </div>
                      <div
                        className={`w-10 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
