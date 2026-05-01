import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge } from '../components/ui';
import { formatDate, formatDateTime, exportToCSV } from '../utils/helpers';
import { AssetRequest as AssetRequestType, Priority } from '../types';
import { Plus, Download, CheckCircle, XCircle, Clock, Package, MessageSquare, AlertTriangle } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const URGENCY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-500' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
];

const ASSET_TYPES = ['furniture', 'it_equipment', 'vehicle', 'electronics', 'office_equipment', 'hvac', 'infrastructure', 'other'] as const;

export default function AssetRequest() {
  const { user, hasRole, organization } = useAuth();
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<AssetRequestType | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const canApprove = hasRole(['admin', 'manager']);

  const defaultForm = {
    assetName: '', assetType: 'it_equipment' as any, category: '', customCategory: '',
    quantity: 1, urgency: 'medium' as Priority, reason: '', forwardTo: '',
  };
  const [form, setForm] = useState(defaultForm);

  const requests = data.assetRequests.getAll();
  const users = data.users.getAll();
  const assets = data.assets.getAll();

  // Derive categories from existing assets
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    assets.forEach(a => { if (a.category) cats.add(a.category); });
    return Array.from(cats).sort();
  }, [assets]);

  // Non-approvers only see their own requests
  const visibleRequests = canApprove
    ? requests
    : requests.filter(r => r.requesterId === user?.id);

  const filtered = filter === 'all' ? visibleRequests : visibleRequests.filter(r => r.status === filter);

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  const counts = useMemo(() => {
    const c = { all: visibleRequests.length, pending: 0, approved: 0, rejected: 0, fulfilled: 0, cancelled: 0 };
    visibleRequests.forEach(r => { if (c[r.status as keyof typeof c] !== undefined) (c as any)[r.status]++; });
    return c;
  }, [visibleRequests]);

  // ---- CRUD ----
  const handleCreate = async () => {
    if (!form.assetName.trim() || !form.reason.trim()) return;
    setSaving(true);
    try {
      const category = form.category === '__custom__' ? form.customCategory.trim() : form.category;
      const createdReq = await data.assetRequests.create({
        requesterId: user!.id,
        assetName: form.assetName.trim(),
        assetType: form.assetType,
        category: category || '',
        quantity: form.quantity,
        urgency: form.urgency,
        reason: form.reason.trim(),
        status: 'pending',
        reviewedBy: null,
        reviewDate: null,
        reviewNote: '',
        fulfilledAssetId: null,
        createdAt: new Date().toISOString(),
      });
      await data.addAuditLog(user!.id, user!.name, 'CREATE', 'AssetRequest', createdReq?.id || 'new', 'AssetRequest', `Requested: ${form.quantity}x ${form.assetName}${form.forwardTo ? ` (forwarded to ${getUserName(form.forwardTo)})` : ''}`);
      data.notifyByRole(['admin', 'manager'], 'asset_request', 'New Asset Request', `${user!.name} requested ${form.quantity}x ${form.assetName} (${form.urgency} urgency).`, form.urgency === 'critical' ? 'high' : 'medium', user!.id).catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'asset_request', 'Request Submitted', `You submitted a request for ${form.quantity}x ${form.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      // If forwarded to a specific person, send them a direct notification
      if (form.forwardTo) {
        const forwardee = data.users.getById(form.forwardTo);
        if (forwardee) {
          data.addNotification(form.forwardTo, 'asset_request', 'Asset Request Forwarded to You', `${user!.name} forwarded an asset request for ${form.quantity}x ${form.assetName} to you for review.`, 'high').catch(e => console.error('[Notify]', e));
          sendNotificationEmail('asset_request_created', forwardee.email, forwardee.name,
            'Asset Request Forwarded to You',
            {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Request Forwarded to You',body:ET.assetRequestCreatedBody(form.assetType,form.reason.trim(),user!.name)},
            organization?.id||'');
        }
      }
      const reqTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(reqTargets.map(u => ({email:u.email,name:u.name})), 'asset_request_created',
        'New Asset Request',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'New Asset Request',body:ET.assetRequestCreatedBody(form.assetType,form.reason.trim(),user!.name)},
        organization?.id||'');
      setShowAdd(false);
      setForm(defaultForm);
      setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleApprove = async (req: AssetRequestType) => {
    setSaving(true);
    try {
      await data.assetRequests.update(req.id, { status: 'approved', reviewedBy: user!.id, reviewDate: new Date().toISOString(), reviewNote: reviewNote.trim() });
      await data.addAuditLog(user!.id, user!.name, 'APPROVE', 'AssetRequest', req.id, 'AssetRequest', `Approved request: ${req.assetName}`);
      data.addNotification(req.requesterId, 'asset_request', 'Request Approved', `Your request for ${req.quantity}x ${req.assetName} has been approved${reviewNote.trim() ? `: ${reviewNote.trim()}` : ''}.`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'asset_request', 'Request Approved', `You approved ${getUserName(req.requesterId)}'s request for ${req.quantity}x ${req.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const approvedRequester = data.users.getById(req.requesterId);
      if (approvedRequester) sendNotificationEmail('asset_request_approved', approvedRequester.email, approvedRequester.name,
        'Your Asset Request Has Been Approved',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Request Approved',body:ET.assetRequestApprovedBody(req.assetType,user!.name)},
        organization?.id||'');
      setShowDetail(null); setReviewNote(''); setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleReject = async (req: AssetRequestType) => {
    setSaving(true);
    try {
      await data.assetRequests.update(req.id, { status: 'rejected', reviewedBy: user!.id, reviewDate: new Date().toISOString(), reviewNote: reviewNote.trim() });
      await data.addAuditLog(user!.id, user!.name, 'REJECT', 'AssetRequest', req.id, 'AssetRequest', `Rejected request: ${req.assetName}`);
      data.addNotification(req.requesterId, 'asset_request', 'Request Rejected', `Your request for ${req.quantity}x ${req.assetName} has been rejected${reviewNote.trim() ? `: ${reviewNote.trim()}` : ''}.`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'asset_request', 'Request Rejected', `You rejected the request for ${req.quantity}x ${req.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const rejectedRequester = data.users.getById(req.requesterId);
      if (rejectedRequester) sendNotificationEmail('asset_request_rejected', rejectedRequester.email, rejectedRequester.name,
        'Your Asset Request Has Been Rejected',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Request Rejected',body:ET.assetRequestRejectedBody(req.assetType,user!.name,reviewNote.trim()||'')},
        organization?.id||'');
      setShowDetail(null); setReviewNote(''); setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleFulfill = async (req: AssetRequestType) => {
    setSaving(true);
    try {
      await data.assetRequests.update(req.id, { status: 'fulfilled', reviewedBy: user!.id, reviewDate: new Date().toISOString(), reviewNote: reviewNote.trim() });
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'AssetRequest', req.id, 'AssetRequest', `Fulfilled request: ${req.assetName}`);
      data.addNotification(req.requesterId, 'asset_request', 'Request Fulfilled', `Your request for ${req.quantity}x ${req.assetName} has been fulfilled and is ready for allocation.`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'asset_request', 'Request Fulfilled', `You fulfilled the request for ${req.quantity}x ${req.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const fulfilledRequester = data.users.getById(req.requesterId);
      if (fulfilledRequester) sendNotificationEmail('asset_request_fulfilled', fulfilledRequester.email, fulfilledRequester.name,
        'Your Asset Request Has Been Fulfilled',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Request Fulfilled',body:ET.assetRequestFulfilledBody(req.assetType,user!.name)},
        organization?.id||'');
      setShowDetail(null); setReviewNote(''); setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleCancel = async (req: AssetRequestType) => {
    setSaving(true);
    try {
      await data.assetRequests.update(req.id, { status: 'cancelled', reviewNote: reviewNote.trim() });
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'AssetRequest', req.id, 'AssetRequest', `Cancelled request: ${req.assetName}`);
      data.addNotification(user!.id, 'asset_request', 'Request Cancelled', `You cancelled the request for ${req.quantity}x ${req.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      if (canApprove && req.requesterId !== user!.id) {
        data.addNotification(req.requesterId, 'asset_request', 'Request Cancelled', `Your request for ${req.quantity}x ${req.assetName} has been cancelled.`, 'medium').catch(e => console.error('[Notify]', e));
        const cancelledRequester = data.users.getById(req.requesterId);
        if (cancelledRequester) sendNotificationEmail('asset_request_cancelled', cancelledRequester.email, cancelledRequester.name,
          'Your Asset Request Has Been Cancelled',
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Request Cancelled',body:ET.assetRequestCancelledBody(req.assetType,user!.name)},
          organization?.id||'');
      }
      setShowDetail(null); setReviewNote(''); setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  // ---- Table ----
  const columns = [
    { key: 'assetName', label: 'Asset', render: (r: any) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-white">{r.assetName}</span>
        {r.category && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-400">{r.category}</span>}
      </div>
    )},
    { key: 'quantity', label: 'Qty', render: (r: any) => <span className="font-medium">{r.quantity}</span> },
    { key: 'requesterId', label: 'Requested By', render: (r: any) => getUserName(r.requesterId) },
    { key: 'urgency', label: 'Urgency', render: (r: any) => {
      const u = URGENCY_OPTIONS.find(o => o.value === r.urgency);
      return <span className={`text-sm font-medium ${u?.color || ''}`}>{u?.label || r.urgency}</span>;
    }},
    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Date', render: (r: any) => formatDateTime(r.createdAt) },
    ...(canApprove ? [{ key: 'reviewedBy', label: 'Reviewed By', render: (r: any) => r.reviewedBy ? getUserName(r.reviewedBy) : <span className="text-gray-400">Pending</span> }] : []),
  ];

  const filterTabs = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'fulfilled', label: 'Fulfilled', count: counts.fulfilled },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  const detail = showDetail;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Asset Requests" subtitle="Request assets and track approval status"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(filtered.map(r => ({ Asset: r.assetName, Category: r.category, Qty: r.quantity, Urgency: r.urgency, RequestedBy: getUserName(r.requesterId), Status: r.status, Date: r.createdAt, ReviewedBy: r.reviewedBy ? getUserName(r.reviewedBy) : '' })), 'asset-requests')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> New Request</button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Pending', count: counts.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Approved', count: counts.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Fulfilled', count: counts.fulfilled, icon: Package, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Rejected', count: counts.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Total', count: counts.all, icon: MessageSquare, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-zinc-800' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 flex items-center gap-3`}>
            <c.icon className={`w-5 h-5 ${c.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300'}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card card-gradient p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No asset requests found.</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-emerald-700 dark:text-emerald-400 hover:underline">Submit your first request</button>
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} onRowClick={(r: any) => { setShowDetail(r); setReviewNote(r.reviewNote || ''); }} />
        )}
      </div>

      {/* ---- New Request Modal ---- */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Asset Request" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Asset Name *</label>
              <input type="text" value={form.assetName} onChange={e => setForm({ ...form, assetName: e.target.value })} className={inputCls} placeholder="e.g., MacBook Pro 16-inch" />
            </div>
            <div>
              <label className={labelCls}>Asset Type</label>
              <select value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })} className={inputCls}>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, customCategory: '' })} className={inputCls}>
                <option value="">Select category</option>
                {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Custom category</option>
              </select>
              {form.category === '__custom__' && (
                <input type="text" value={form.customCategory} onChange={e => setForm({ ...form, customCategory: e.target.value })} className={`${inputCls} mt-2`} placeholder="Enter custom category" />
              )}
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Urgency</label>
            <div className="flex gap-2 mt-1">
              {URGENCY_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => setForm({ ...form, urgency: o.value })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${form.urgency === o.value
                    ? o.value === 'critical' ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                    : o.value === 'high' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400'
                    : o.value === 'medium' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    : 'border-gray-200 dark:border-zinc-600 text-gray-500 dark:text-gray-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Reason / Justification *</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} className={inputCls} placeholder="Explain why you need this asset..." />
          </div>
          <div>
            <label className={labelCls}>Forward Request To (optional)</label>
            <select value={form.forwardTo} onChange={e => setForm({ ...form, forwardTo: e.target.value })} className={inputCls}>
              <option value="">All admins & managers</option>
              {users.filter(u => u.isActive && ['admin', 'manager'].includes(u.role) && u.id !== user?.id).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Select a specific person to review your request, or leave as default to notify all.</p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-zinc-700">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.assetName.trim() || !form.reason.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---- Detail / Review Modal ---- */}
      <Modal isOpen={!!detail} onClose={() => { setShowDetail(null); setReviewNote(''); }} title="Asset Request Details" size="lg">
        {detail && (
          <div className="space-y-5">
            {/* Status Banner */}
            <div className={`rounded-lg p-3 flex items-center gap-3 ${
              detail.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20' :
              detail.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' :
              detail.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20' :
              detail.status === 'fulfilled' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
              'bg-gray-50 dark:bg-zinc-700/50'
            }`}>
              {detail.status === 'pending' && <Clock className="w-5 h-5 text-amber-600" />}
              {detail.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {detail.status === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
              {detail.status === 'fulfilled' && <Package className="w-5 h-5 text-emerald-700" />}
              {detail.status === 'cancelled' && <AlertTriangle className="w-5 h-5 text-gray-500" />}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{detail.status}</p>
                {detail.reviewDate && <p className="text-xs text-gray-500">Reviewed {formatDateTime(detail.reviewDate)} by {detail.reviewedBy ? getUserName(detail.reviewedBy) : 'Unknown'}</p>}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Asset Name</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detail.assetName}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Asset Type</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detail.assetType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p></div>
              {detail.category && <div><p className="text-xs text-gray-500 dark:text-gray-400">Category</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detail.category}</p></div>}
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detail.quantity}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Requested By</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getUserName(detail.requesterId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Urgency</p>
                <span className={`text-sm font-medium ${URGENCY_OPTIONS.find(o => o.value === detail.urgency)?.color || ''}`}>
                  {URGENCY_OPTIONS.find(o => o.value === detail.urgency)?.label || detail.urgency}
                </span>
              </div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Submitted</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(detail.createdAt)}</p></div>
            </div>

            {/* Reason */}
            <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reason / Justification</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{detail.reason}</p>
            </div>

            {/* Review Note (if exists and reviewed) */}
            {detail.reviewNote && detail.status !== 'pending' && (
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Review Note</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{detail.reviewNote}</p>
              </div>
            )}

            {/* Action Area (admin/manager only, and only for actionable statuses) */}
            {canApprove && ['pending', 'approved'].includes(detail.status) && (
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Review Note (optional)</label>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} className={inputCls} placeholder="Add a note about your decision..." />
                </div>
                <div className="flex gap-3 flex-wrap">
                  {detail.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(detail)} disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {saving ? 'Processing...' : 'Approve'}
                      </button>
                      <button onClick={() => handleReject(detail)} disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed">
                        <XCircle className="w-4 h-4" /> {saving ? 'Processing...' : 'Reject'}
                      </button>
                    </>
                  )}
                  {detail.status === 'approved' && (
                    <button onClick={() => handleFulfill(detail)} disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Package className="w-4 h-4" />}
                      {saving ? 'Processing...' : 'Mark Fulfilled'}
                    </button>
                  )}
                  <button onClick={() => handleCancel(detail)} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel Request
                  </button>
                </div>
              </div>
            )}

            {/* Requester can cancel their own pending request */}
            {!canApprove && detail.status === 'pending' && detail.requesterId === user?.id && (
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                <button onClick={() => handleCancel(detail)} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  Cancel My Request
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
