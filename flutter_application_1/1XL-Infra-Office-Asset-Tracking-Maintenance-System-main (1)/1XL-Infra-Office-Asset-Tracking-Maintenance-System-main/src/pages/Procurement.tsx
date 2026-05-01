import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge, DependencyNotice } from '../components/ui';
import { formatDate, formatCurrency, exportToCSV } from '../utils/helpers';
import { Procurement as ProcurementType } from '../types';
import { Plus, Download, CheckCircle, XCircle } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

export default function Procurement() {
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<ProcurementType | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assetName: '', assetType: 'it_equipment' as any, category: 'laptop' as any, vendorId: '',
    quantity: 1, estimatedCost: 0, expectedDelivery: '', notes: '', departmentId: '',
  });

  const procurements = data.procurements.getAll();
  const vendors = data.vendors.getAll();
  const users = data.users.getAll();
  const departments = data.departments.getAll();

  const filtered = filter === 'all' ? procurements : procurements.filter(p => p.status === filter);

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || 'N/A';
  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';

  const handleCreate = async () => {
    if (!form.assetName || !form.departmentId) return;
    setSaving(true);
    try {
      const createdProc = await data.procurements.create({
        assetName: form.assetName, assetType: form.assetType, category: form.category,
        requestedBy: user!.id, departmentId: form.departmentId, vendorId: form.vendorId,
        quantity: form.quantity, estimatedCost: form.estimatedCost, actualCost: null,
        status: 'requested', approvedBy: null, approvalDate: null,
        expectedDelivery: form.expectedDelivery, receivedDate: null, notes: form.notes,
        createdAt: new Date().toISOString().split('T')[0],
      });
      await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Procurement', createdProc?.id || 'new', 'Procurement', `Requested procurement: ${form.quantity}x ${form.assetName}`);
      setShowAdd(false);
      data.notifyByRole(['admin', 'manager'], 'procurement', 'New Procurement Request', `${user!.name} requested ${form.quantity}x ${form.assetName}.`, 'medium', user!.id).catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'procurement', 'Procurement Requested', `You submitted a procurement request for ${form.quantity}x ${form.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const pTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(pTargets.map(u => ({email:u.email,name:u.name})), 'procurement_requested',
        'New Procurement Request',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'New Procurement Request',body:ET.procurementRequestedBody(form.assetName,form.quantity,user!.name,String(form.estimatedCost)||'')},
        organization?.id||'');
      setForm({ assetName: '', assetType: 'it_equipment', category: 'laptop', vendorId: '', quantity: 1, estimatedCost: 0, expectedDelivery: '', notes: '', departmentId: '' });
      setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleApprove = async (p: ProcurementType) => {
    setSaving(true);
    try {
      await data.procurements.update(p.id, { status: 'approved', approvedBy: user!.id, approvalDate: new Date().toISOString().split('T')[0] });
      await data.addAuditLog(user!.id, user!.name, 'APPROVE', 'Procurement', p.id, 'Procurement', `Approved procurement: ${p.assetName}`);
      setShowDetail(null); setRefresh(r => r + 1);
      data.addNotification(p.requestedBy, 'procurement', 'Procurement Approved', `Your request for ${p.assetName} has been approved`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'procurement', 'Procurement Approved', `You approved the procurement request for ${p.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const pRequester = data.users.getById(p.requestedBy);
      if (pRequester) sendNotificationEmail('procurement_approved', pRequester.email, pRequester.name,
        'Procurement Request Approved',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Procurement Approved',body:ET.procurementApprovedBody(p.assetName,p.quantity,user!.name)},
        organization?.id||'');
    } finally { setSaving(false); }
  };

  const handleReject = async (p: ProcurementType) => {
    setSaving(true);
    try {
      await data.procurements.update(p.id, { status: 'rejected', approvedBy: user!.id, approvalDate: new Date().toISOString().split('T')[0] });
      await data.addAuditLog(user!.id, user!.name, 'REJECT', 'Procurement', p.id, 'Procurement', `Rejected procurement: ${p.assetName}`);
      setShowDetail(null); setRefresh(r => r + 1);
      data.addNotification(p.requestedBy, 'procurement', 'Procurement Rejected', `Your request for ${p.assetName} has been rejected`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'procurement', 'Procurement Rejected', `You rejected the procurement request for ${p.assetName}.`, 'low').catch(e => console.error('[Notify]', e));
      const pRejRequester = data.users.getById(p.requestedBy);
      if (pRejRequester) sendNotificationEmail('procurement_rejected', pRejRequester.email, pRejRequester.name,
        'Procurement Request Rejected',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Procurement Rejected',body:ET.procurementRejectedBody(p.assetName,user!.name,'')},
        organization?.id||'');
    } finally { setSaving(false); }
  };

  const handleMarkOrdered = async (p: ProcurementType) => {
    setSaving(true);
    try {
      await data.procurements.update(p.id, { status: 'ordered' });
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Procurement', p.id, 'Procurement', `Marked as ordered: ${p.assetName}`);
      setShowDetail(null); setRefresh(r => r + 1);
      data.addNotification(p.requestedBy, 'procurement', 'Procurement Ordered', `Your request for ${p.assetName} has been ordered.`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'procurement', 'Procurement Ordered', `You marked ${p.assetName} (${p.quantity}x) as ordered.`, 'low').catch(e => console.error('[Notify]', e));
      const pOrdRequester = data.users.getById(p.requestedBy);
      if (pOrdRequester) sendNotificationEmail('procurement_ordered', pOrdRequester.email, pOrdRequester.name,
        'Procurement Order Placed',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Order Placed',body:ET.procurementOrderedBody(p.assetName,p.quantity,user!.name)},
        organization?.id||'');
      data.notifyByRole(['admin', 'manager'], 'procurement', 'Procurement Ordered', `${p.assetName} (${p.quantity}x) has been ordered by ${user!.name}.`, 'low', user!.id).catch(e => console.error('[Notify]', e));
      const pOrdTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role) && u.id !== user!.id);
      sendNotificationEmailToMany(pOrdTargets.map(u => ({email:u.email,name:u.name})), 'procurement_ordered',
        `Procurement Ordered: ${p.assetName}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Procurement Ordered',body:ET.procurementOrderedBody(p.assetName,p.quantity,user!.name)},
        organization?.id||'');
    } finally { setSaving(false); }
  };

  const handleMarkReceived = async (p: ProcurementType, actualCost: number) => {
    setSaving(true);
    try {
      await data.procurements.update(p.id, { status: 'received', actualCost, receivedDate: new Date().toISOString().split('T')[0] });
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Procurement', p.id, 'Procurement', `Received procurement: ${p.assetName}`);
      setShowDetail(null); setRefresh(r => r + 1);
      data.addNotification(p.requestedBy, 'procurement', 'Procurement Received', `Your request for ${p.assetName} has been received.`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'procurement', 'Procurement Received', `You marked ${p.assetName} (${p.quantity}x) as received.`, 'low').catch(e => console.error('[Notify]', e));
      const pRecRequester = data.users.getById(p.requestedBy);
      if (pRecRequester) sendNotificationEmail('procurement_received', pRecRequester.email, pRecRequester.name,
        'Procurement Items Received',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Items Received',body:ET.procurementReceivedBody(p.assetName,p.quantity,user!.name)},
        organization?.id||'');
      data.notifyByRole(['admin', 'manager', 'employee'], 'procurement', 'Procurement Received', `${p.assetName} (${p.quantity}x) has been received and added to inventory.`, 'low').catch(e => console.error('[Notify]', e));
      const pRecTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager','employee'].includes(u.role));
      sendNotificationEmailToMany(pRecTargets.map(u => ({email:u.email,name:u.name})), 'procurement_received',
        `Items Received: ${p.assetName}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Procurement Received',body:ET.procurementReceivedBody(p.assetName,p.quantity,user!.name)},
        organization?.id||'');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'assetName', label: 'Asset', render: (p: any) => <span className="font-medium">{p.assetName}</span> },
    { key: 'quantity', label: 'Qty' },
    { key: 'requestedBy', label: 'Requested By', render: (p: any) => getUserName(p.requestedBy) },
    { key: 'departmentId', label: 'Department', render: (p: any) => getDeptName(p.departmentId) },
    { key: 'vendorId', label: 'Vendor', render: (p: any) => getVendorName(p.vendorId) },
    { key: 'estimatedCost', label: 'Est. Cost', render: (p: any) => formatCurrency(p.estimatedCost, orgCurrency) },
    { key: 'status', label: 'Status', render: (p: any) => <StatusBadge status={p.status} /> },
    { key: 'expectedDelivery', label: 'Expected', render: (p: any) => formatDate(p.expectedDelivery) },
  ];

  const filterTabs = [
    { key: 'all', label: 'All' }, { key: 'requested', label: 'Requested' }, { key: 'approved', label: 'Approved' },
    { key: 'ordered', label: 'Ordered' }, { key: 'received', label: 'Received' }, { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Asset Procurement" subtitle="Manage purchase requests and delivery"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(filtered.map(p => ({ Asset: p.assetName, Qty: p.quantity, RequestedBy: getUserName(p.requestedBy), Department: getDeptName(p.departmentId), Vendor: getVendorName(p.vendorId), EstCost: p.estimatedCost, ActualCost: p.actualCost || '', Status: p.status, Expected: p.expectedDelivery })), 'procurement')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> New Request</button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300'}`}>{t.label}</button>
        ))}
      </div>

      <div className="card card-gradient p-6">
        <DataTable columns={columns} data={filtered} onRowClick={(p: any) => setShowDetail(p)} />
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Procurement Request" size="lg">
        <div className="space-y-4">
          <DependencyNotice missing={[
            ...(departments.length === 0 ? [{ label: 'Create Departments', path: '/locations', pageName: 'Locations & Departments' }] : []),
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name *</label>
              <input type="text" value={form.assetName} onChange={e => setForm({...form, assetName: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department *</label>
              <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Type</label>
              <select value={form.assetType} onChange={e => setForm({...form, assetType: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                {['furniture','it_equipment','vehicle','electronics','office_equipment','hvac','infrastructure','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <select value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="">Select vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Cost ($)</label>
              <input type="number" step="0.01" value={form.estimatedCost} onChange={e => setForm({...form, estimatedCost: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Delivery</label>
            <input type="date" value={form.expectedDelivery} onChange={e => setForm({...form, expectedDelivery: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAdd(false)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Procurement Details" size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Asset</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.assetName}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.quantity}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Requested By</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getUserName(showDetail.requestedBy)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Department</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getDeptName(showDetail.departmentId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Vendor</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getVendorName(showDetail.vendorId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><StatusBadge status={showDetail.status} /></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Estimated Cost</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(showDetail.estimatedCost, orgCurrency)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Actual Cost</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.actualCost ? formatCurrency(showDetail.actualCost, orgCurrency) : 'N/A'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Expected Delivery</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(showDetail.expectedDelivery)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Received Date</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.receivedDate ? formatDate(showDetail.receivedDate) : 'Pending'}</p></div>
            </div>
            {showDetail.notes && <div><p className="text-xs text-gray-500 dark:text-gray-400">Notes</p><p className="text-sm text-gray-900 dark:text-white">{showDetail.notes}</p></div>}

            {user?.role === 'admin' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700 flex-wrap">
                {showDetail.status === 'requested' && (
                  <>
                    <button onClick={() => handleApprove(showDetail)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saving ? 'Approving...' : 'Approve'}</button>
                    <button onClick={() => handleReject(showDetail)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"><XCircle className="w-4 h-4" /> {saving ? 'Rejecting...' : 'Reject'}</button>
                  </>
                )}
                {showDetail.status === 'approved' && (
                  <button onClick={() => handleMarkOrdered(showDetail)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Updating...' : 'Mark as Ordered'}</button>
                )}
                {showDetail.status === 'ordered' && (
                  <ReceivedForm onReceived={(cost) => handleMarkReceived(showDetail, cost)} estimated={showDetail.estimatedCost} />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ReceivedForm({ onReceived, estimated }: { onReceived: (cost: number) => void; estimated: number }) {
  const [cost, setCost] = useState(String(estimated));
  return (
    <div className="flex items-end gap-3">
      <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Actual Cost ($)</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className="w-32 px-2 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-sm dark:bg-zinc-700 dark:text-white" /></div>
      <button onClick={() => onReceived(parseFloat(cost) || 0)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">Mark Received</button>
    </div>
  );
}
