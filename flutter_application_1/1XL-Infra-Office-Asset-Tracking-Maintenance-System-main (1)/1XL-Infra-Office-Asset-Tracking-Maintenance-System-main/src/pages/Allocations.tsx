import React, { useState, useMemo } from 'react';
import { Allocation, AllocationStatus, AllocationType } from '../types';
import { useData } from '../contexts/DataContext';
import { PageHeader, Modal, StatusBadge, ConfirmDialog, DependencyNotice } from '../components/ui';
import { formatDate, formatDateTime, exportToCSV } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Download, CheckCircle, XCircle, RotateCcw, UserPlus, PlusCircle, RefreshCw,
  Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Pencil, Trash2,
} from 'lucide-react';
import { sendAssignmentEmail } from '../lib/assetAssignmentWebhook';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

const ALLOCATION_TYPE_OPTIONS: { value: AllocationType; label: string; description: string; icon: typeof UserPlus }[] = [
  { value: 'new_employee', label: 'New Employee', description: 'First asset for a new or unassigned employee', icon: UserPlus },
  { value: 'add_on', label: 'Add-on Request', description: 'Additional asset for an employee who already has one', icon: PlusCircle },
  { value: 'replacement', label: 'Replacement', description: 'Replace an existing allocated asset with a new one', icon: RefreshCw },
];

type FilterTab = 'all' | 'pending' | 'active' | 'returned';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'returned', label: 'Returned' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';

export default function Allocations() {
  const { user, hasRole } = useAuth();
  const data = useData();
  const isManagerOrAdmin = hasRole(['admin', 'manager']);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Return asset flow
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAllocation, setReturnAllocation] = useState<Allocation | null>(null);
  const [returnCondition, setReturnCondition] = useState('');

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; allocation: Allocation } | null>(null);
  const [saving, setSaving] = useState(false);

  // New request form state
  const [formData, setFormData] = useState({
    allocationType: '' as AllocationType | '',
    assetId: '',
    employeeId: '',
    departmentId: '',
    notes: '',
    workMode: '' as string,
    replacesAllocationId: '' as string,
  });

  // ---- Table state ----
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('startDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Inline editing
  const [inlineEditCell, setInlineEditCell] = useState<{ allocId: string; field: string } | null>(null);
  const [inlineEditSaving, setInlineEditSaving] = useState<string | null>(null);

  // ---- Multi-select state ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (pageIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;
    setBulkDeleting(true);
    try {
      await data.allocations.bulkRemove(idsToDelete);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleting(false);
    }
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const refresh = () => setRefreshCounter(c => c + 1);

  const { organization } = useAuth();
  const allocations = useMemo(() => data.allocations.getAll(), [refreshCounter]);
  const assets = useMemo(() => data.assets.getAll(), [refreshCounter]);
  const users = useMemo(() => data.users.getAll(), [refreshCounter]);
  const departments = useMemo(() => data.departments.getAll(), [refreshCounter]);
  const locations = useMemo(() => data.locations.getAll(), [refreshCounter]);

  const availableAssets = useMemo(
    () => assets.filter(a => a.status === 'available'),
    [assets]
  );

  const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || 'Unknown';
  const getUserName = (id: string | null) => {
    if (!id) return 'N/A';
    return users.find(u => u.id === id)?.name || 'Unknown';
  };
  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || 'Unknown';

  const filteredAllocations = useMemo(() => {
    let rows: Allocation[];
    if (activeTab === 'all') rows = allocations;
    else if (activeTab === 'pending') rows = allocations.filter(a => a.status === 'pending');
    else if (activeTab === 'active') rows = allocations.filter(a => a.status === 'approved' || a.status === 'active');
    else if (activeTab === 'returned') rows = allocations.filter(a => a.status === 'returned');
    else rows = allocations;

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(a =>
        getAssetName(a.assetId).toLowerCase().includes(term) ||
        getUserName(a.employeeId).toLowerCase().includes(term) ||
        getDeptName(a.departmentId).toLowerCase().includes(term) ||
        a.status.toLowerCase().includes(term) ||
        (a.notes || '').toLowerCase().includes(term)
      );
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      let aVal: unknown = (a as any)[sortKey];
      let bVal: unknown = (b as any)[sortKey];
      // Resolve display values for sorting
      if (sortKey === 'assetId') { aVal = getAssetName(a.assetId); bVal = getAssetName(b.assetId); }
      if (sortKey === 'employeeId') { aVal = getUserName(a.employeeId); bVal = getUserName(b.employeeId); }
      if (sortKey === 'departmentId') { aVal = getDeptName(a.departmentId); bVal = getDeptName(b.departmentId); }
      if (sortKey === 'approvedBy') { aVal = getUserName(a.approvedBy); bVal = getUserName(b.approvedBy); }
      const cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [allocations, activeTab, searchTerm, sortKey, sortDir, assets, users, departments]);

  const getAllocationTypeLabel = (type?: string) => {
    if (!type) return '';
    const labels: Record<string, { text: string; cls: string }> = {
      new_employee: { text: 'New Employee', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      add_on: { text: 'Add-on', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
      replacement: { text: 'Replacement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    };
    const l = labels[type];
    if (!l) return '';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.cls}`}>{l.text}</span>;
  };

  // Action columns that skip inline editing
  const ACTION_COLUMNS = new Set<string>();

  const columns = [
    { key: 'assetId', label: 'Asset', render: (item: Allocation) => getAssetName(item.assetId) },
    { key: 'employeeId', label: 'Employee', render: (item: Allocation) => getUserName(item.employeeId) },
    { key: 'allocationType', label: 'Type', render: (item: Allocation) => getAllocationTypeLabel(item.allocationType) || <span className="text-gray-300 dark:text-gray-600">-</span> },
    { key: 'departmentId', label: 'Department', render: (item: Allocation) => getDeptName(item.departmentId) },
    { key: 'startDate', label: 'Start Date', render: (item: Allocation) => formatDateTime(item.startDate) },
    { key: 'endDate', label: 'End Date', render: (item: Allocation) => item.endDate ? formatDateTime(item.endDate) : 'Ongoing' },
    { key: 'status', label: 'Status', render: (item: Allocation) => <StatusBadge status={item.status} /> },
    { key: 'workMode', label: 'Work Mode', render: (item: Allocation) => {
      const wm = (item as any).workMode as string | null;
      if (!wm) return '-';
      return wm === 'wfo'
        ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">WFO</span>
        : <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">WFH</span>;
    }},
    { key: 'approvedBy', label: 'Approved By', render: (item: Allocation) => getUserName(item.approvedBy) },
  ];

  const inlineSelectCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[130px]';

  const handleInlineFieldSave = async (allocId: string, field: string, value: string) => {
    setInlineEditSaving(allocId);
    setInlineEditCell(null);
    try {
      if (field === 'assetId') await data.allocations.update(allocId, { assetId: value });
      else if (field === 'employeeId') await data.allocations.update(allocId, { employeeId: value });
      else if (field === 'departmentId') await data.allocations.update(allocId, { departmentId: value });
      else if (field === 'status') await data.allocations.update(allocId, { status: value as AllocationStatus });
      else if (field === 'startDate') await data.allocations.update(allocId, { startDate: value });
      else if (field === 'endDate') await data.allocations.update(allocId, { endDate: value || null });
      else if (field === 'notes') await data.allocations.update(allocId, { notes: value });
      else if (field === 'allocationType') await data.allocations.update(allocId, { allocationType: value as AllocationType });
      else if (field === 'workMode') await data.allocations.update(allocId, ({ workMode: value || null } as any));
      else if (field === 'approvedBy') await data.allocations.update(allocId, { approvedBy: value || null });

      await data.addAuditLog(user!.id, user!.name, `Quick updated ${field}`, 'allocations', allocId, 'allocation', `Updated ${field}`);
      refresh();
    } catch (err) {
      console.error('Inline field save failed:', err);
    } finally {
      setInlineEditSaving(null);
    }
  };

  const renderInlineEdit = (field: string, item: Allocation) => {
    if (field === 'status') {
      return (
        <select autoFocus value={item.status} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'status', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          {['pending','approved','active','rejected','returned'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      );
    }
    if (field === 'assetId') {
      return (
        <select autoFocus value={item.assetId} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'assetId', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>)}
        </select>
      );
    }
    if (field === 'employeeId') {
      return (
        <select autoFocus value={item.employeeId} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'employeeId', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          {users.filter(u => u.isActive).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    }
    if (field === 'departmentId') {
      return (
        <select autoFocus value={item.departmentId} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'departmentId', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">No department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      );
    }
    if (field === 'allocationType') {
      return (
        <select autoFocus value={item.allocationType || ''} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'allocationType', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">-</option>
          {ALLOCATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (field === 'startDate' || field === 'endDate') {
      const current = String((item as any)[field] ?? '').split('T')[0];
      return (
        <input autoFocus type="date" defaultValue={current}
          className="px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          onChange={e => handleInlineFieldSave(item.id, field, e.target.value)}
          onBlur={() => setInlineEditCell(null)} />
      );
    }
    if (field === 'workMode') {
      const current = String((item as any).workMode ?? '');
      return (
        <select autoFocus value={current} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'workMode', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">-</option>
          <option value="wfo">WFO</option>
          <option value="wfh">WFH</option>
        </select>
      );
    }
    if (field === 'approvedBy') {
      return (
        <select autoFocus value={item.approvedBy || ''} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(item.id, 'approvedBy', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">-</option>
          {users.filter(u => u.isActive && ['admin','manager','super_admin'].includes(u.role)).map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      );
    }
    return null;
  };

  // ---- Handlers (unchanged business logic) ----
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.assetId || !formData.employeeId || !formData.departmentId || !formData.allocationType) return;

      const now = new Date().toISOString();
      const typeLabel = ALLOCATION_TYPE_OPTIONS.find(o => o.value === formData.allocationType)?.label || formData.allocationType;
      await data.allocations.create({
        assetId: formData.assetId,
        employeeId: formData.employeeId,
        departmentId: formData.departmentId,
        startDate: now,
        endDate: null,
        status: 'pending' as AllocationStatus,
        allocationType: formData.allocationType as AllocationType,
        replacesAllocationId: formData.allocationType === 'replacement' && formData.replacesAllocationId ? formData.replacesAllocationId : null,
        approvedBy: null,
        approvalDate: null,
        returnDate: null,
        returnCondition: null,
        notes: formData.notes,
        createdAt: now,
      });

      await data.addAuditLog(
        user!.id, user!.name, 'Created allocation request', 'allocations',
        formData.assetId, 'allocation',
        `${typeLabel} allocation request for asset ${getAssetName(formData.assetId)} to ${getUserName(formData.employeeId)}${formData.replacesAllocationId ? ` (replacing ${getAssetName(allocations.find(a => a.id === formData.replacesAllocationId)?.assetId || '')})` : ''}`
      );
      setFormData({ allocationType: '', assetId: '', employeeId: '', departmentId: '', notes: '', workMode: '', replacesAllocationId: '' });
      setShowNewModal(false);
      data.addNotification(user!.id, 'allocation', 'Allocation Requested', `You requested "${getAssetName(formData.assetId)}" for ${getUserName(formData.employeeId)}.`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'allocation', 'New Allocation Request', `${user!.name} requested "${getAssetName(formData.assetId)}" for ${getUserName(formData.employeeId)}.`, 'medium', user!.id).catch(e => console.error('[Notify]', e));
      const allocTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(allocTargets.map(u => ({email:u.email,name:u.name})), 'allocation_requested',
        'New Asset Allocation Request',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'New Allocation Request',body:ET.allocationRequestedBody(getAssetName(formData.assetId),getUserName(formData.employeeId),user!.name)},
        organization?.id||'');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (allocation: Allocation) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await data.allocations.update(allocation.id, { status: 'approved' as AllocationStatus, approvedBy: user!.id, approvalDate: now });
      await data.assets.update(allocation.assetId, { status: 'allocated' });

      if (allocation.allocationType === 'replacement' && allocation.replacesAllocationId) {
        const oldAlloc = allocations.find(a => a.id === allocation.replacesAllocationId);
        if (oldAlloc && (oldAlloc.status === 'approved' || oldAlloc.status === 'active')) {
          await data.allocations.update(oldAlloc.id, { returnDate: now, status: 'returned' as AllocationStatus, returnCondition: 'Replaced by new allocation' });
          await data.assets.update(oldAlloc.assetId, { status: 'available' });
          await data.addAuditLog(user!.id, user!.name, 'Auto-returned (replacement)', 'allocations', oldAlloc.id, 'allocation', `Auto-returned "${getAssetName(oldAlloc.assetId)}" — replaced by "${getAssetName(allocation.assetId)}"`);
        }
      }
      await data.addAuditLog(user!.id, user!.name, 'Approved allocation', 'allocations', allocation.id, 'allocation', `Approved allocation of ${getAssetName(allocation.assetId)} to ${getUserName(allocation.employeeId)}`);
      setSelectedAllocation(null);
      data.addNotification(user!.id, 'allocation', 'Allocation Approved', `You approved ${getUserName(allocation.employeeId)}'s request for "${getAssetName(allocation.assetId)}".`, 'low').catch(e => console.error('[Notify]', e));
      data.addNotification(allocation.employeeId, 'allocation', 'Allocation Approved', `Your request for ${getAssetName(allocation.assetId)} has been approved by ${user!.name}.`, 'medium').catch(e => console.error('[Notify]', e));
      const approvedEmployee = data.users.getById(allocation.employeeId);
      if (approvedEmployee) sendNotificationEmail('allocation_approved', approvedEmployee.email, approvedEmployee.name,
        'Your Allocation Has Been Approved',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Allocation Approved',body:ET.allocationApprovedBody(getAssetName(allocation.assetId),assets.find(a => a.id === allocation.assetId)?.assetTag||'',user!.name)},
        organization?.id||'');
      const asset = assets.find(a => a.id === allocation.assetId);
      const employee = users.find(u => u.id === allocation.employeeId);
      if (asset && employee) {
        sendAssignmentEmail({
          employeeName: employee.name, employeeEmail: employee.email, employeePhone: employee.phone || '',
          employeeRole: employee.role, department: departments.find(d => d.id === allocation.departmentId)?.name || '',
          assetName: asset.name, assetTag: asset.assetTag, assetType: asset.type, assetCategory: asset.category || '',
          serialNumber: asset.serialNumber || '', brand: asset.brand || '', model: asset.model || '',
          location: locations.find(l => l.id === asset.locationId)?.name || '',
          assignedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          assignedBy: user!.name, notes: allocation.notes || '', orgName: organization?.name || '',
        }).catch(e => console.error('[Notify]', e));
      }
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (allocation: Allocation) => {
    setSaving(true);
    try {
      await data.allocations.update(allocation.id, { status: 'rejected' as AllocationStatus, approvedBy: user!.id });
      await data.addAuditLog(user!.id, user!.name, 'Rejected allocation', 'allocations', allocation.id, 'allocation', `Rejected allocation of ${getAssetName(allocation.assetId)} to ${getUserName(allocation.employeeId)}`);
      setSelectedAllocation(null);
      data.addNotification(user!.id, 'allocation', 'Allocation Rejected', `You rejected ${getUserName(allocation.employeeId)}'s request for "${getAssetName(allocation.assetId)}".`, 'low').catch(e => console.error('[Notify]', e));
      data.addNotification(allocation.employeeId, 'allocation', 'Allocation Rejected', `Your request for ${getAssetName(allocation.assetId)} has been rejected by ${user!.name}.`, 'medium').catch(e => console.error('[Notify]', e));
      const rejectedEmployee = data.users.getById(allocation.employeeId);
      if (rejectedEmployee) sendNotificationEmail('allocation_rejected', rejectedEmployee.email, rejectedEmployee.name,
        'Your Allocation Has Been Rejected',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Allocation Rejected',body:ET.allocationRejectedBody(getAssetName(allocation.assetId),user!.name,allocation.notes||'')},
        organization?.id||'');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!returnAllocation) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await data.allocations.update(returnAllocation.id, { returnDate: now, status: 'returned' as AllocationStatus, returnCondition: returnCondition || null });
      await data.assets.update(returnAllocation.assetId, { status: 'available' });
      await data.addAuditLog(user!.id, user!.name, 'Returned asset', 'allocations', returnAllocation.id, 'allocation', `Returned asset ${getAssetName(returnAllocation.assetId)}. Condition: ${returnCondition || 'Not specified'}`);
      setReturnCondition('');
      setReturnAllocation(null);
      setShowReturnModal(false);
      setSelectedAllocation(null);
      refresh();
      data.addNotification(user!.id, 'allocation', 'Asset Return Processed', `You processed the return of "${getAssetName(returnAllocation.assetId)}".`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'allocation', 'Asset Returned', `"${getAssetName(returnAllocation.assetId)}" has been returned. Condition: ${returnCondition || 'Not specified'}.`, 'low').catch(e => console.error('[Notify]', e));
      const returnTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(returnTargets.map(u => ({email:u.email,name:u.name})), 'asset_returned',
        `Asset Returned: ${getAssetName(returnAllocation.assetId)}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Returned',body:ET.assetReturnedBody(getAssetName(returnAllocation.assetId),assets.find(a => a.id === returnAllocation.assetId)?.assetTag||'',user!.name)},
        organization?.id||'');
      data.addNotification(returnAllocation.employeeId, 'allocation', 'Asset Returned', `"${getAssetName(returnAllocation.assetId)}" has been marked as returned.`, 'low').catch(e => console.error('[Notify]', e));
      const returnedEmployee = data.users.getById(returnAllocation.employeeId);
      if (returnedEmployee) sendNotificationEmail('asset_returned_employee', returnedEmployee.email, returnedEmployee.name,
        'Your Asset Has Been Returned',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Returned',body:ET.assetReturnedEmployeeBody(getAssetName(returnAllocation.assetId),assets.find(a => a.id === returnAllocation.assetId)?.assetTag||'')},
        organization?.id||'');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredAllocations.map(a => ({
      Asset: getAssetName(a.assetId), Employee: getUserName(a.employeeId), Department: getDeptName(a.departmentId),
      'Start Date': formatDate(a.startDate), 'End Date': a.endDate ? formatDate(a.endDate) : 'Ongoing',
      Status: a.status, 'Approved By': getUserName(a.approvedBy),
      'Return Date': a.returnDate ? formatDate(a.returnDate) : '', 'Return Condition': a.returnCondition || '', Notes: a.notes,
    }));
    exportToCSV(rows, 'asset-allocations');
  };

  const openReturnFlow = (alloc: Allocation) => {
    setReturnAllocation(alloc);
    setReturnCondition('');
    setShowReturnModal(true);
  };

  const tabCounts: Record<FilterTab, number> = {
    all: allocations.length,
    pending: allocations.filter(a => a.status === 'pending').length,
    active: allocations.filter(a => a.status === 'approved' || a.status === 'active').length,
    returned: allocations.filter(a => a.status === 'returned').length,
  };

  // Pagination
  const totalPages = Math.ceil(filteredAllocations.length / pageSize);
  const pagedRows = filteredAllocations.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6 animate-fadeIn relative">
      <PageHeader
        title="Asset Allocations"
        subtitle={`${allocations.length} total allocation${allocations.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> New Request
            </button>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
            }`}>
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">({tabCounts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Data Table */}
      <div className="card card-gradient overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12 text-center">
                  <input
                    type="checkbox"
                    checked={pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id))}
                    onChange={() => toggleSelectAll(pagedRows.map(r => r.id))}
                  />
                </th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((alloc) => {
                const isSavingRow = inlineEditSaving === alloc.id;
                return (
                  <tr
                    key={alloc.id}
                    className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
                  >
                    <td
                      className="px-4 py-3 text-center"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(alloc.id)}
                        onChange={() => toggleSelect(alloc.id)}
                      />
                    </td>
                    {columns.map(col => {
                      const isActive = inlineEditCell?.allocId === alloc.id && inlineEditCell?.field === col.key;
                      const canEdit = !ACTION_COLUMNS.has(col.key);

                      if (!canEdit) {
                        return (
                          <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {col.render(alloc)}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.key}
                          className="px-4 py-3 whitespace-nowrap"
                          onClick={e => { e.stopPropagation(); if (!isSavingRow) setInlineEditCell({ allocId: alloc.id, field: col.key }); }}
                        >
                          {isActive ? (
                            <div onClick={e => e.stopPropagation()}>{renderInlineEdit(col.key, alloc)}</div>
                          ) : (
                            <span className="group inline-flex items-center gap-1 cursor-pointer">
                              <span className="text-gray-700 dark:text-gray-300">
                                {col.render(alloc)}
                              </span>
                              {isSavingRow ? (
                                <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                              ) : (
                                <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Empty placeholder rows (small page sizes only) */}
              {pageSize <= 10 && Array.from({ length: Math.max(0, pageSize - pagedRows.length) }, (_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-100/60 dark:border-zinc-700/30">
                  <td className="px-4 py-3">&nbsp;</td>
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || pageSize !== 10) && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredAllocations.length)} of {filteredAllocations.length}
              </p>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {[10, 50, 100, 200, 500, 1000].map(n => (
                  <option key={n} value={n}>{n} rows</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = page < 3 ? i : page - 2 + i;
                if (pageNum >= totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      <Modal isOpen={showNewModal} onClose={() => { setShowNewModal(false); setFormData({ allocationType: '', assetId: '', employeeId: '', departmentId: '', notes: '', workMode: '', replacesAllocationId: '' }); }} title="New Allocation Request" size="md">
        <DependencyNotice missing={[
          ...(assets.filter(a => a.status === 'available').length === 0 ? [{ label: 'Create Assets', path: '/assets', pageName: 'Assets' }] : []),
          ...(departments.length === 0 ? [{ label: 'Create Departments', path: '/locations', pageName: 'Locations & Departments' }] : []),
        ]} />

        {/* Step 1: Choose allocation type */}
        {!formData.allocationType ? (
          <div className="space-y-3 py-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the type of allocation request:</p>
            {ALLOCATION_TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button key={opt.value} type="button"
                  onClick={() => setFormData(f => ({ ...f, allocationType: opt.value }))}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-all text-left group">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                    <Icon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Step 2: Fill in the form */
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFormData(f => ({ ...f, allocationType: '', assetId: '', replacesAllocationId: '' }))}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">&larr; Back</button>
              {(() => {
                const opt = ALLOCATION_TYPE_OPTIONS.find(o => o.value === formData.allocationType);
                const cls = { new_employee: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', add_on: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', replacement: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }[formData.allocationType] || '';
                return opt ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{opt.label}</span> : null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
              <select value={formData.employeeId} onChange={e => setFormData(f => ({ ...f, employeeId: e.target.value, replacesAllocationId: '' }))} required className={inputCls}>
                <option value="">Select an employee</option>
                {users.filter(u => u.isActive).map(u => (<option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>))}
              </select>
            </div>

            {formData.allocationType === 'replacement' && formData.employeeId && (() => {
              const empAllocations = allocations.filter(a => a.employeeId === formData.employeeId && (a.status === 'approved' || a.status === 'active'));
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Being Replaced</label>
                  {empAllocations.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">This employee has no active allocations to replace.</p>
                  ) : (
                    <select value={formData.replacesAllocationId} onChange={e => setFormData(f => ({ ...f, replacesAllocationId: e.target.value }))} className={inputCls}>
                      <option value="">Select asset to replace</option>
                      {empAllocations.map(a => (<option key={a.id} value={a.id}>{getAssetName(a.assetId)}</option>))}
                    </select>
                  )}
                </div>
              );
            })()}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Asset</label>
              <select value={formData.assetId} onChange={e => setFormData(f => ({ ...f, assetId: e.target.value }))} required className={inputCls}>
                <option value="">Select an available asset</option>
                {availableAssets.map(a => (<option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select value={formData.departmentId} onChange={e => setFormData(f => ({ ...f, departmentId: e.target.value }))} required className={inputCls}>
                <option value="">Select a department</option>
                {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Mode</label>
              <select value={formData.workMode} onChange={e => setFormData(f => ({ ...f, workMode: e.target.value }))} className={inputCls}>
                <option value="">Select work mode</option>
                <option value="wfo">Work from Office</option>
                <option value="wfh">Work from Home</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={3}
                className={inputCls} placeholder="Optional notes about this allocation..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowNewModal(false); setFormData({ allocationType: '', assetId: '', employeeId: '', departmentId: '', notes: '', workMode: '', replacesAllocationId: '' }); }}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedAllocation} onClose={() => setSelectedAllocation(null)} title="Allocation Details" size="lg">
        {selectedAllocation && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Asset</p><p className="text-sm text-gray-900 dark:text-white font-semibold mt-0.5">{getAssetName(selectedAllocation.assetId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Employee</p><p className="text-sm text-gray-900 dark:text-white font-semibold mt-0.5">{getUserName(selectedAllocation.employeeId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Request Type</p><div className="mt-0.5">{getAllocationTypeLabel(selectedAllocation.allocationType) || <span className="text-sm text-gray-400">-</span>}</div></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</p><div className="mt-0.5"><StatusBadge status={selectedAllocation.status} /></div></div>
              {selectedAllocation.allocationType === 'replacement' && selectedAllocation.replacesAllocationId && (
                <div className="sm:col-span-2"><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Replaces</p><p className="text-sm text-amber-700 dark:text-amber-400 font-medium mt-0.5">{getAssetName(allocations.find(a => a.id === selectedAllocation.replacesAllocationId)?.assetId || '')}</p></div>
              )}
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Department</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{getDeptName(selectedAllocation.departmentId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Start Date</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{formatDateTime(selectedAllocation.startDate)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">End Date</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{selectedAllocation.endDate ? formatDateTime(selectedAllocation.endDate) : 'Ongoing'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Approved By</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{getUserName(selectedAllocation.approvedBy)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Approval Date</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{selectedAllocation.approvalDate ? formatDateTime(selectedAllocation.approvalDate) : 'N/A'}</p></div>
              {selectedAllocation.returnDate && (<div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Return Date</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{formatDateTime(selectedAllocation.returnDate)}</p></div>)}
              {selectedAllocation.returnCondition && (<div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Return Condition</p><p className="text-sm text-gray-900 dark:text-white mt-0.5">{selectedAllocation.returnCondition}</p></div>)}
            </div>
            {selectedAllocation.notes && (
              <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Notes</p><p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-3">{selectedAllocation.notes}</p></div>
            )}
            <div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Created At</p><p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{formatDateTime(selectedAllocation.createdAt)}</p></div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-zinc-700">
              {isManagerOrAdmin && selectedAllocation.status === 'pending' && (
                <>
                  <button onClick={() => setConfirmAction({ type: 'reject', allocation: selectedAllocation })} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => setConfirmAction({ type: 'approve', allocation: selectedAllocation })} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saving ? 'Approving...' : 'Approve'}
                  </button>
                </>
              )}
              {(selectedAllocation.status === 'approved' || selectedAllocation.status === 'active') && (
                <button onClick={() => openReturnFlow(selectedAllocation)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                  <RotateCcw className="w-4 h-4" /> Return Asset
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Return Asset Modal */}
      <Modal isOpen={showReturnModal} onClose={() => { setShowReturnModal(false); setReturnAllocation(null); setReturnCondition(''); }} title="Return Asset" size="sm">
        {returnAllocation && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Returning <span className="font-semibold">{getAssetName(returnAllocation.assetId)}</span> allocated to{' '}
              <span className="font-semibold">{getUserName(returnAllocation.employeeId)}</span>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Return Condition</label>
              <textarea value={returnCondition} onChange={e => setReturnCondition(e.target.value)} rows={3}
                className={inputCls} placeholder="Describe the condition of the asset upon return..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowReturnModal(false); setReturnAllocation(null); setReturnCondition(''); }}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5">Cancel</button>
              <button onClick={handleReturn} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />} {saving ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={confirmAction?.type === 'approve'} onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction?.allocation) handleApprove(confirmAction.allocation); setConfirmAction(null); }}
        title="Approve Allocation"
        message={`Are you sure you want to approve the allocation of ${confirmAction ? getAssetName(confirmAction.allocation.assetId) : ''} to ${confirmAction ? getUserName(confirmAction.allocation.employeeId) : ''}?`} />

      <ConfirmDialog isOpen={confirmAction?.type === 'reject'} onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction?.allocation) handleReject(confirmAction.allocation); setConfirmAction(null); }}
        title="Reject Allocation"
        message={`Are you sure you want to reject the allocation of ${confirmAction ? getAssetName(confirmAction.allocation.assetId) : ''} to ${confirmAction ? getUserName(confirmAction.allocation.employeeId) : ''}?`} />

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-800 rounded-2xl px-6 py-3 flex items-center gap-4 animate-scaleIn border border-gray-200 dark:border-zinc-700"
             style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} allocation{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button onClick={clearSelection}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            Clear
          </button>
          <button
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-md shadow-red-500/20 disabled:opacity-50"
          >
            {bulkDeleting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Allocations"
        message={`Are you sure you want to delete ${selectedIds.size} selected allocation${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
      />
    </div>
  );
}
