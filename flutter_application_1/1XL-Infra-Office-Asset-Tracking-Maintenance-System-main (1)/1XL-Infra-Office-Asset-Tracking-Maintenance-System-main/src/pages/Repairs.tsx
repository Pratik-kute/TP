import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge, DependencyNotice } from '../components/ui';
import { formatDate, formatCurrency, exportToCSV } from '../utils/helpers';
import { Repair } from '../types';
import { Plus, Download, Wrench } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

export default function Repairs() {
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<Repair | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assetId: '', vendorId: '', technicianId: '', issue: '', priority: 'medium' as Repair['priority'], notes: '',
  });

  const repairs = data.repairs.getAll();
  const assets = data.assets.getAll();
  const users = data.users.getAll();
  const vendors = data.vendors.getAll();
  const technicians = users.filter(u => u.role === 'technician');

  const filtered = filter === 'all' ? repairs : repairs.filter(r => r.status === filter);

  const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || 'Unknown';
  const getAssetTag = (id: string) => assets.find(a => a.id === id)?.assetTag || '';
  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || 'N/A';
  const getTechName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  const handleCreate = async () => {
    if (!form.assetId || !form.issue) return;
    setSaving(true);
    try {
      await data.repairs.create({
        assetId: form.assetId, vendorId: form.vendorId, technicianId: form.technicianId,
        issue: form.issue, status: 'pending', priority: form.priority, cost: 0,
        partsUsed: '', laborHours: 0, completionDate: null, notes: form.notes,
        createdAt: new Date().toISOString().split('T')[0],
      });
      await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Repairs', form.assetId, 'Repair', `Created repair request for ${getAssetName(form.assetId)}: ${form.issue}`);
      data.addNotification(user!.id, 'repair', 'Repair Created', `You created a repair request for ${getAssetName(form.assetId)}: ${form.issue}.`, 'low').catch(e => console.error('[Notify]', e));
      setShowAdd(false);
      if (form.technicianId) {
        data.addNotification(form.technicianId, 'repair', 'Repair Assigned', `Repair for ${getAssetName(form.assetId)}: ${form.issue}`, 'high').catch(e => console.error('[Notify]', e));
        const rTech = data.users.getById(form.technicianId);
        if (rTech) sendNotificationEmail('repair_assigned', rTech.email, rTech.name,
          'Repair Task Assigned',
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Repair Assigned',body:ET.repairCreatedBody(getAssetName(form.assetId),getAssetTag(form.assetId)||'',form.issue||'',form.priority||'medium',user!.name)},
          organization?.id||'');
      }
      setForm({ assetId: '', vendorId: '', technicianId: '', issue: '', priority: 'medium', notes: '' });
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (repair: Repair, status: Repair['status'], updates: Partial<Repair> = {}) => {
    setSaving(true);
    try {
      await data.repairs.update(repair.id, { status, ...updates });
      if (status === 'completed') {
        await data.assets.update(repair.assetId, { status: 'available' });
      } else if (status === 'in_progress') {
        await data.assets.update(repair.assetId, { status: 'under_maintenance' });
      }
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Repairs', repair.id, 'Repair', `Updated repair status to ${status}`);
      setShowDetail(null);
      const statusLabel = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : status === 'cancelled' ? 'Cancelled' : status;
      data.addNotification(user!.id, 'repair', 'Repair Updated', `You updated repair for "${getAssetName(repair.assetId)}" to ${statusLabel.toLowerCase()}.`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'repair', `Repair ${statusLabel}`, `Repair for "${getAssetName(repair.assetId)}" has been marked as ${statusLabel.toLowerCase()} by ${user!.name}.`, status === 'completed' ? 'low' : 'medium').catch(e => console.error('[Notify]', e));
      const rTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(rTargets.map(u => ({email:u.email,name:u.name})), 'repair_status_updated',
        `Repair ${statusLabel}: ${getAssetName(repair.assetId)}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:`Repair ${statusLabel}`,body:ET.repairStatusUpdatedBody(getAssetName(repair.assetId),getAssetTag(repair.assetId)||'',repair.status||'',status,user!.name)},
        organization?.id||'');
      if (repair.technicianId && repair.technicianId !== user!.id) {
        data.addNotification(repair.technicianId, 'repair', `Repair ${statusLabel}`, `Repair for "${getAssetName(repair.assetId)}" status updated to ${statusLabel.toLowerCase()}.`, 'medium').catch(e => console.error('[Notify]', e));
        const rTech2 = data.users.getById(repair.technicianId);
        if (rTech2) sendNotificationEmail('repair_status_updated', rTech2.email, rTech2.name,
          `Repair ${statusLabel}: ${getAssetName(repair.assetId)}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:`Repair ${statusLabel}`,body:ET.repairStatusUpdatedBody(getAssetName(repair.assetId),getAssetTag(repair.assetId)||'',repair.status||'',status,user!.name)},
          organization?.id||'');
      }
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'assetId', label: 'Asset', render: (r: any) => (
      <div><p className="font-medium">{getAssetName(r.assetId)}</p><p className="text-xs text-gray-400 dark:text-gray-500">{getAssetTag(r.assetId)}</p></div>
    )},
    { key: 'issue', label: 'Issue', render: (r: any) => <span className="truncate max-w-[200px] block">{r.issue}</span> },
    { key: 'priority', label: 'Priority', render: (r: any) => <StatusBadge status={r.priority} /> },
    { key: 'vendorId', label: 'Vendor', render: (r: any) => getVendorName(r.vendorId) },
    { key: 'technicianId', label: 'Technician', render: (r: any) => getTechName(r.technicianId) },
    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'cost', label: 'Cost', render: (r: any) => formatCurrency(r.cost, orgCurrency) },
  ];

  const filterTabs = [
    { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'assigned', label: 'Assigned' },
    { key: 'in_progress', label: 'In Progress' }, { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Repair Management" subtitle="Track and manage asset repairs"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(filtered.map(r => ({
              Asset: getAssetName(r.assetId), Issue: r.issue, Priority: r.priority, Vendor: getVendorName(r.vendorId),
              Technician: getTechName(r.technicianId), Status: r.status, Cost: r.cost, PartsUsed: r.partsUsed,
              LaborHours: r.laborHours, CompletionDate: r.completionDate || '',
            })), 'repairs-report')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> New Repair Request
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-gradient p-6">
        <DataTable columns={columns} data={filtered} onRowClick={(r: any) => setShowDetail(r)} />
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Repair Request" size="lg">
        <div className="space-y-4">
          <DependencyNotice missing={[
            ...(assets.length === 0 ? [{ label: 'Create Assets', path: '/assets', pageName: 'Assets' }] : []),
          ]} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset *</label>
            <select value={form.assetId} onChange={e => setForm({...form, assetId: e.target.value})}
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
              <option value="">Select asset</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} - {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Description *</label>
            <textarea value={form.issue} onChange={e => setForm({...form, issue: e.target.value})} rows={3}
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})}
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <select value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})}
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Technician</label>
            <select value={form.technicianId} onChange={e => setForm({...form, technicianId: e.target.value})}
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
              <option value="">Select technician</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAdd(false)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Submitting...' : 'Submit'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Repair Details" size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Asset</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getAssetTag(showDetail.assetId)} - {getAssetName(showDetail.assetId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Priority</p><StatusBadge status={showDetail.priority} /></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Vendor</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getVendorName(showDetail.vendorId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Technician</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getTechName(showDetail.technicianId)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><StatusBadge status={showDetail.status} /></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Cost</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(showDetail.cost, orgCurrency)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Labor Hours</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.laborHours}h</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Completion Date</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.completionDate ? formatDate(showDetail.completionDate) : 'Pending'}</p></div>
            </div>
            <div><p className="text-xs text-gray-500 dark:text-gray-400">Issue</p><p className="text-sm text-gray-900 dark:text-white">{showDetail.issue}</p></div>
            {showDetail.partsUsed && <div><p className="text-xs text-gray-500 dark:text-gray-400">Parts Used</p><p className="text-sm text-gray-900 dark:text-white">{showDetail.partsUsed}</p></div>}
            {showDetail.notes && <div><p className="text-xs text-gray-500 dark:text-gray-400">Notes</p><p className="text-sm text-gray-900 dark:text-white">{showDetail.notes}</p></div>}

            {(user?.role === 'admin' || user?.role === 'technician') && showDetail.status !== 'completed' && showDetail.status !== 'cancelled' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700">
                {showDetail.status === 'pending' && (
                  <button onClick={() => handleUpdateStatus(showDetail, 'in_progress')} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Starting...' : 'Start Repair'}</button>
                )}
                {showDetail.status === 'in_progress' && (
                  <RepairCompletionForm onComplete={(cost, parts, hours) => handleUpdateStatus(showDetail, 'completed', {
                    cost, partsUsed: parts, laborHours: hours, completionDate: new Date().toISOString().split('T')[0]
                  })} />
                )}
                <button onClick={() => handleUpdateStatus(showDetail, 'cancelled')} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Cancelling...' : 'Cancel Repair'}</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function RepairCompletionForm({ onComplete }: { onComplete: (cost: number, parts: string, hours: number) => void }) {
  const [cost, setCost] = useState('');
  const [parts, setParts] = useState('');
  const [hours, setHours] = useState('');
  return (
    <div className="flex-1 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cost ($)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-sm dark:bg-zinc-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Parts Used</label>
          <input type="text" value={parts} onChange={e => setParts(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-sm dark:bg-zinc-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Labor Hours</label>
          <input type="number" value={hours} onChange={e => setHours(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-zinc-600 rounded text-sm dark:bg-zinc-700 dark:text-white" />
        </div>
      </div>
      <button onClick={() => onComplete(parseFloat(cost) || 0, parts, parseFloat(hours) || 0)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">Complete Repair</button>
    </div>
  );
}
