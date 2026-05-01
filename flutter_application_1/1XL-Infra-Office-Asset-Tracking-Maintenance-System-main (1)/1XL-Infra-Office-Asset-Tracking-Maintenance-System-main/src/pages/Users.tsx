import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog } from '../components/ui';
import { exportToCSV } from '../utils/helpers';
import { User, UserRole } from '../types';
import { Plus, Download, Edit, UserX, UserCheck, Shield, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

export default function Users() {
  const { user: currentUser, organization } = useAuth();
  const data = useData();
  const { plan, isWithinLimit } = useSubscription();
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');

  const emptyForm = { name: '', email: '', password: '', role: 'employee' as UserRole, departmentId: '', phone: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const users = data.users.getAll();
  const departments = data.departments.getAll();
  const activeUserCount = users.filter(u => u.isActive).length;
  const maxUsers = plan?.maxUsers ?? 5;
  const canAddMore = isWithinLimit('users', activeUserCount);

  const filtered = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';

  const isSelf = (u: User) => u.id === currentUser?.id;

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, departmentId: u.departmentId, phone: u.phone });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;

    // Enforce maxUsers on new user creation
    if (!editing && !canAddMore) {
      alert(`Your plan allows a maximum of ${maxUsers === -1 ? 'unlimited' : maxUsers} users. You have ${activeUserCount} active users. Please upgrade your plan or deactivate existing users.`);
      return;
    }

    setSaving(true);
    try {
      const editedUser = editing;
      const savedRole = form.role;
      const savedName = form.name;
      const savedEmail = form.email;
      const savedPhone = form.phone;
      const savedPassword = form.password;
      const savedDeptId = form.departmentId;
      if (editing) {
        const updates: Partial<User> = {
          name: form.name, email: form.email, role: form.role,
          departmentId: form.departmentId, phone: form.phone,
          updatedAt: new Date().toISOString().split('T')[0],
        };
        if (form.password) updates.password = form.password;
        await data.users.update(editing.id, updates);
        await data.addAuditLog(currentUser!.id, currentUser!.name, 'UPDATE', 'Users', editing.id, 'User', `Updated user: ${form.name}`);
      } else {
        const newUser = await data.users.create({
          name: form.name, email: form.email, password: form.password || 'password',
          role: form.role, departmentId: form.departmentId, phone: form.phone,
          isActive: true, isGlobalAdmin: false,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
        });
        await data.addAuditLog(currentUser!.id, currentUser!.name, 'CREATE', 'Users', newUser.id, 'User', `Created user: ${form.name}`);
      }
      // Close modal immediately after primary operation succeeds
      setShowForm(false); setEditing(null); setForm(emptyForm); setShowPassword(false); setRefresh(r => r + 1);
      // Fire-and-forget notifications (don't block UI)
      if (editedUser) {
        if (editedUser.role !== savedRole) {
          data.addNotification(currentUser!.id, 'user', 'Role Updated', `You changed ${editedUser.name}'s role from ${editedUser.role} to ${savedRole}.`, 'low').catch(e => console.error('[Notify]', e));
          data.addNotification(editedUser.id, 'user', 'Role Changed', `Your role has been changed from ${editedUser.role} to ${savedRole} by ${currentUser!.name}.`, 'high').catch(e => console.error('[Notify]', e));
          sendNotificationEmail('role_changed', editedUser.email, editedUser.name, 'Your Role Has Been Updated',
            { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'Role Updated', body: ET.roleChangedBody(currentUser!.name, editedUser.role, savedRole) },
            organization?.id || '');
          data.notifyByRole(['admin'], 'user', 'User Role Updated', `${savedName}'s role was changed from ${editedUser.role} to ${savedRole} by ${currentUser!.name}.`, 'medium', currentUser!.id).catch(e => console.error('[Notify]', e));
          const adminTargets = data.users.getAll().filter(u => u.isActive && u.role === 'admin' && u.id !== currentUser!.id);
          sendNotificationEmailToMany(adminTargets.map(u => ({ email: u.email, name: u.name })), 'user_role_updated',
            `User Role Updated: ${editedUser.name}`,
            { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'User Role Updated', body: ET.roleChangedBody(currentUser!.name, editedUser.role, savedRole) },
            organization?.id || '');
        } else {
          data.addNotification(currentUser!.id, 'user', 'Profile Updated', `You updated ${editedUser.name}'s profile.`, 'low').catch(e => console.error('[Notify]', e));
          data.addNotification(editedUser.id, 'user', 'Profile Updated', `Your profile has been updated by ${currentUser!.name}.`, 'low').catch(e => console.error('[Notify]', e));
          sendNotificationEmail('profile_updated', editedUser.email, editedUser.name, 'Your Profile Has Been Updated',
            { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'Profile Updated', body: ET.profileUpdatedBody(currentUser!.name, 'Your profile details have been updated.') },
            organization?.id || '');
        }
      } else {
        data.addNotification(currentUser!.id, 'user', 'User Created', `You created a new user: ${savedName} (${savedRole}).`, 'low').catch(e => console.error('[Notify]', e));
        data.notifyByRole(['admin', 'manager'], 'user', 'New User Created', `${savedName} (${savedRole}) has been added to the organization by ${currentUser!.name}.`, 'medium', currentUser!.id).catch(e => console.error('[Notify]', e));
        // Fire-and-forget: send notification emails for new user
        const dept = departments.find(d => d.id === savedDeptId);
        sendNotificationEmail('new_user_created', savedEmail, savedName, `Welcome to ${organization?.name || 'the platform'}`,
          { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'Welcome!', body: ET.newUserCreatedBody(savedName, savedEmail, savedRole, dept?.name || '', savedPassword || 'password', currentUser!.name) },
          organization?.id || '');
        const mgrTargets = data.users.getAll().filter(u => u.isActive && ['admin', 'manager'].includes(u.role) && u.id !== currentUser!.id);
        sendNotificationEmailToMany(mgrTargets.map(u => ({ email: u.email, name: u.name })), 'new_user_created_admin',
          `New User Added: ${savedName}`,
          { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'New User Added', body: ET.newUserCreatedAdminBody(savedName, savedEmail, savedRole, dept?.name || '', currentUser!.name) },
          organization?.id || '');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    // Prevent self-deactivation
    if (isSelf(u)) return;
    // If reactivating, check limit
    if (!u.isActive && !isWithinLimit('users', activeUserCount)) {
      alert(`Cannot reactivate: your plan allows ${maxUsers === -1 ? 'unlimited' : maxUsers} active users and you already have ${activeUserCount}.`);
      return;
    }
    setSaving(true);
    try {
      const wasActive = u.isActive;
      await data.users.update(u.id, { isActive: !u.isActive });
      await data.addAuditLog(currentUser!.id, currentUser!.name, 'UPDATE', 'Users', u.id, 'User', `${wasActive ? 'Deactivated' : 'Activated'} user: ${u.name}`);
      setRefresh(r => r + 1);
      // Fire-and-forget notifications
      data.addNotification(u.id, 'user', wasActive ? 'Account Deactivated' : 'Account Reactivated', wasActive ? `Your account has been deactivated by ${currentUser!.name}. Contact your admin for assistance.` : `Your account has been reactivated by ${currentUser!.name}. You can now log in again.`, 'high').catch(e => console.error('[Notify]', e));
      if (wasActive) {
        sendNotificationEmail('user_deactivated', u.email, u.name, 'Your Account Has Been Deactivated',
          { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'Account Deactivated', body: ET.userDeactivatedBody() },
          organization?.id || '');
      } else {
        sendNotificationEmail('user_reactivated', u.email, u.name, 'Your Account Has Been Reactivated',
          { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'Account Reactivated', body: ET.userReactivatedBody() },
          organization?.id || '');
      }
      data.addNotification(currentUser!.id, 'user', wasActive ? 'User Deactivated' : 'User Reactivated', `You ${wasActive ? "deactivated" : "reactivated"} ${u.name}.`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin'], 'user', `User ${wasActive ? 'Deactivated' : 'Reactivated'}`, `${u.name} (${u.role}) was ${wasActive ? 'deactivated' : 'reactivated'} by ${currentUser!.name}.`, 'medium', currentUser!.id).catch(e => console.error('[Notify]', e));
      const adminTargets2 = data.users.getAll().filter(au => au.isActive && au.role === 'admin' && au.id !== currentUser!.id);
      sendNotificationEmailToMany(adminTargets2.map(au => ({ email: au.email, name: au.name })), 'user_status_changed',
        `User ${wasActive ? 'Deactivated' : 'Reactivated'}: ${u.name}`,
        { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: `User ${wasActive ? 'Deactivated' : 'Reactivated'}`, body: ET.profileUpdatedBody(currentUser!.name, `${u.name} (${u.role}) has been ${wasActive ? 'deactivated' : 'reactivated'}.`) },
        organization?.id || '');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isSelf(deleteTarget)) return;
    setSaving(true);
    try {
      await data.users.remove(deleteTarget.id);
      await data.addAuditLog(currentUser!.id, currentUser!.name, 'DELETE', 'Users', deleteTarget.id, 'User', `Deleted user: ${deleteTarget.name} (${deleteTarget.role})`);
      data.addNotification(currentUser!.id, 'user', 'User Deleted', `You permanently deleted ${deleteTarget.name} (${deleteTarget.role}).`, 'medium').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin'], 'user', 'User Deleted', `${deleteTarget.name} (${deleteTarget.role}) was permanently deleted by ${currentUser!.name}.`, 'high', currentUser!.id).catch(e => console.error('[Notify]', e));
      const adminTargets3 = data.users.getAll().filter(au => au.isActive && au.role === 'admin' && au.id !== currentUser!.id);
      sendNotificationEmailToMany(adminTargets3.map(au => ({ email: au.email, name: au.name })), 'user_deleted',
        `User Deleted: ${deleteTarget.name}`,
        { orgName: organization?.name || '', orgLogoUrl: organization?.logoUrl, headline: 'User Deleted', body: ET.userDeletedAdminBody(deleteTarget.name, deleteTarget.email, currentUser!.name) },
        organization?.id || '');
      setDeleteTarget(null);
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      employee: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      staff: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
      technician: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      vendor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      auditor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
    return colors[role] || 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300';
  };

  const columns = [
    { key: 'name', label: 'Name', render: (u: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{u.name.charAt(0)}</div>
        <div>
          <p className="font-medium">
            {u.name}
            {isSelf(u) && <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">(You)</span>}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
        </div>
      </div>
    )},
    { key: 'role', label: 'Role', render: (u: any) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleColor(u.role)}`}>
        {u.role}
      </span>
    )},
    { key: 'departmentId', label: 'Department', render: (u: any) => getDeptName(u.departmentId) },
    { key: 'phone', label: 'Phone' },
    { key: 'isActive', label: 'Status', render: (u: any) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
        {u.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'actions', label: 'Actions', render: (u: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="Edit"><Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        {!isSelf(u) && (
          <>
            <button onClick={(e) => { e.stopPropagation(); toggleActive(u); }} className={`p-1.5 rounded ${u.isActive ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={u.isActive ? 'Deactivate' : 'Activate'}>
              {u.isActive ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete user">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </>
        )}
      </div>
    )},
  ];

  const roles = ['all', 'admin', 'manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'];

  // When editing self, prevent role change
  const isEditingSelf = editing && isSelf(editing);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="User Management" subtitle={`${users.length} users (${activeUserCount} active)${maxUsers !== -1 ? ` \u00B7 Plan limit: ${maxUsers}` : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(users.map(u => ({ Name: u.name, Email: u.email, Role: u.role, Department: getDeptName(u.departmentId), Phone: u.phone, Status: u.isActive ? 'Active' : 'Inactive' })), 'users')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
              disabled={!canAddMore}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
        }
      />

      {!canAddMore && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>You have reached the maximum of <strong>{maxUsers}</strong> active users for your plan. Upgrade to add more users or deactivate existing ones.</span>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {roles.map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg capitalize ${roleFilter === r ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'}`}>
            {r === 'all' ? 'All' : r}
          </button>
        ))}
      </div>

      <div className="card card-gradient p-5">
        <DataTable columns={columns} data={filtered} />
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit User' : 'Add User'} size="lg">
        <div className="space-y-4">
          {isEditingSelf && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span>You are editing your own account. Role cannot be changed.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="user@example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{editing ? 'New Password (leave blank to keep)' : 'Password'} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editing ? 'Leave blank to keep current' : 'Leave blank for default'}
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})} disabled={!!isEditingSelf}
                className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white ${isEditingSelf ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {['admin','manager','employee','staff','technician','vendor','auditor'].map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          </div>
          {organization && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Organization: <strong>{organization.name}</strong></span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create User')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to permanently delete ${deleteTarget?.name}? This action cannot be undone. All their data, allocations, and history will be removed.`}
      />
    </div>
  );
}
