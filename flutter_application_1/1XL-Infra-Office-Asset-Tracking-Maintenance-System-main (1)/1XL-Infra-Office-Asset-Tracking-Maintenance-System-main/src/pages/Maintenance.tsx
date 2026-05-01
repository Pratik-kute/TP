import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge, DependencyNotice } from '../components/ui';
import { formatDate, formatCurrency, exportToCSV } from '../utils/helpers';
import { Maintenance as MaintenanceType } from '../types';
import { Plus, Download, Wrench, CheckCircle } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

export default function Maintenance() {
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<MaintenanceType | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assetId: '', scheduledDate: '', technicianId: '', type: 'preventive' as 'preventive' | 'corrective',
    notes: '', checklist: '',
  });

  const maintenanceList = data.maintenance.getAll();
  const assets = data.assets.getAll();
  const users = data.users.getAll();
  const technicians = users.filter(u => u.role === 'technician');

  const filtered = filter === 'all' ? maintenanceList : maintenanceList.filter(m => m.status === filter);

  const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || 'Unknown';
  const getAssetTag = (id: string) => assets.find(a => a.id === id)?.assetTag || '';
  const getTechName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  const handleCreate = async () => {
    if (!form.assetId || !form.scheduledDate) return;
    setSaving(true);
    try {
      await data.maintenance.create({
        assetId: form.assetId,
        scheduledDate: form.scheduledDate,
        completedDate: null,
        technicianId: form.technicianId,
        status: 'scheduled',
        type: form.type,
        cost: 0,
        notes: form.notes,
        checklist: form.checklist.split('\n').filter(Boolean),
        createdAt: new Date().toISOString().split('T')[0],
      });
      await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Maintenance', form.assetId, 'Maintenance', `Scheduled ${form.type} maintenance for ${getAssetName(form.assetId)}`);
      data.addNotification(user!.id, 'maintenance', 'Maintenance Scheduled', `You scheduled ${form.type} maintenance for ${getAssetName(form.assetId)}.`, 'low').catch(e => console.error('[Notify]', e));
      setShowAdd(false);
      if (form.technicianId) {
        data.addNotification(form.technicianId, 'maintenance', 'Maintenance Assigned', `You have been assigned ${form.type} maintenance for ${getAssetName(form.assetId)}`, 'medium').catch(e => console.error('[Notify]', e));
        const tech = data.users.getById(form.technicianId);
        if (tech) sendNotificationEmail('maintenance_assigned', tech.email, tech.name,
          'Maintenance Task Assigned',
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Maintenance Assigned',body:ET.maintenanceScheduledBody(getAssetName(form.assetId),getAssetTag(form.assetId)||'',form.scheduledDate||'',user!.name,form.notes||'')},
          organization?.id||'');
      }
      setForm({ assetId: '', scheduledDate: '', technicianId: '', type: 'preventive', notes: '', checklist: '' });
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (m: MaintenanceType, cost: number) => {
    setSaving(true);
    try {
      await data.maintenance.update(m.id, {
        status: 'completed',
        completedDate: new Date().toISOString().split('T')[0],
        cost,
      });
      const asset = data.assets.getById(m.assetId);
      if (asset && asset.status === 'under_maintenance') {
        await data.assets.update(m.assetId, { status: 'available' });
      }
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Maintenance', m.id, 'Maintenance', `Completed maintenance for ${getAssetName(m.assetId)}`);
      setShowDetail(null);
      data.addNotification(user!.id, 'maintenance', 'Maintenance Completed', `You marked ${m.type} maintenance for "${getAssetName(m.assetId)}" as completed.`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'maintenance', 'Maintenance Completed', `${m.type} maintenance for "${getAssetName(m.assetId)}" has been completed by ${user!.name}.`, 'low').catch(e => console.error('[Notify]', e));
      const mCompleteTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(mCompleteTargets.map(u => ({email:u.email,name:u.name})), 'maintenance_completed',
        `Maintenance Completed: ${getAssetName(m.assetId)}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Maintenance Completed',body:ET.maintenanceCompletedBody(getAssetName(m.assetId),getAssetTag(m.assetId)||'',getTechName(m.technicianId)||user!.name,String(cost)||'')},
        organization?.id||'');
      if (m.technicianId && m.technicianId !== user!.id) data.addNotification(m.technicianId, 'maintenance', 'Maintenance Completed', `${m.type} maintenance for "${getAssetName(m.assetId)}" has been marked as completed.`, 'low').catch(e => console.error('[Notify]', e));
      if (m.technicianId && m.technicianId !== user!.id) {
        const mTech = data.users.getById(m.technicianId);
        if (mTech) sendNotificationEmail('maintenance_completed', mTech.email, mTech.name,
          'Maintenance Task Completed',
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Maintenance Completed',body:ET.maintenanceCompletedBody(getAssetName(m.assetId),getAssetTag(m.assetId)||'',user!.name,String(cost)||'')},
          organization?.id||'');
      }
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleStartProgress = async (m: MaintenanceType) => {
    setSaving(true);
    try {
      await data.maintenance.update(m.id, { status: 'in_progress' });
      await data.assets.update(m.assetId, { status: 'under_maintenance' });
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Maintenance', m.id, 'Maintenance', `Started maintenance for ${getAssetName(m.assetId)}`);
      setShowDetail(null);
      data.addNotification(user!.id, 'maintenance', 'Maintenance Started', `You started ${m.type} maintenance for "${getAssetName(m.assetId)}".`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'maintenance', 'Maintenance In Progress', `${m.type} maintenance for "${getAssetName(m.assetId)}" has been started by ${user!.name}.`, 'low').catch(e => console.error('[Notify]', e));
      const mProgressTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(mProgressTargets.map(u => ({email:u.email,name:u.name})), 'maintenance_in_progress',
        `Maintenance In Progress: ${getAssetName(m.assetId)}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Maintenance In Progress',body:ET.maintenanceInProgressBody(getAssetName(m.assetId),getAssetTag(m.assetId)||'',getTechName(m.technicianId)||user!.name)},
        organization?.id||'');
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'assetId', label: 'Asset', render: (m: any) => (
      <div><p className="font-medium">{getAssetName(m.assetId)}</p><p className="text-xs text-gray-400 dark:text-gray-500">{getAssetTag(m.assetId)}</p></div>
    )},
    { key: 'type', label: 'Type', render: (m: any) => <span className="capitalize">{m.type}</span> },
    { key: 'scheduledDate', label: 'Scheduled', render: (m: any) => formatDate(m.scheduledDate) },
    { key: 'technicianId', label: 'Technician', render: (m: any) => getTechName(m.technicianId) },
    { key: 'status', label: 'Status', render: (m: any) => <StatusBadge status={m.status} /> },
    { key: 'cost', label: 'Cost', render: (m: any) => formatCurrency(m.cost, orgCurrency) },
  ];

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const handleExport = () => {
    exportToCSV(filtered.map(m => ({
      Asset: getAssetName(m.assetId), AssetTag: getAssetTag(m.assetId), Type: m.type,
      ScheduledDate: m.scheduledDate, CompletedDate: m.completedDate || '',
      Technician: getTechName(m.technicianId), Status: m.status, Cost: m.cost, Notes: m.notes,
    })), 'maintenance-report');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Preventive Maintenance" subtitle="Schedule and track asset maintenance"
        action={
          <div className="flex gap-2">
            <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            {user?.role !== 'employee' && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Schedule Maintenance
              </button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300 dark:hover:border-zinc-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-gradient p-6">
        <DataTable columns={columns} data={filtered} onRowClick={(m: any) => setShowDetail(m)} />
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Schedule Maintenance" size="lg">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scheduled Date *</label>
              <input type="date" value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})}
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Technician</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checklist (one item per line)</label>
            <textarea value={form.checklist} onChange={e => setForm({...form, checklist: e.target.value})} rows={3}
              placeholder="Check fans&#10;Update OS&#10;Run diagnostics"
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAdd(false)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Maintenance Details" size="lg">
        {showDetail && (() => {
          const asset = data.assets.getById(showDetail.assetId);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Asset</p><p className="text-sm font-medium text-gray-900 dark:text-white">{asset?.assetTag} - {asset?.name}</p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Type</p><p className="text-sm font-medium capitalize text-gray-900 dark:text-white">{showDetail.type}</p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Scheduled Date</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(showDetail.scheduledDate)}</p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Completed Date</p><p className="text-sm font-medium text-gray-900 dark:text-white">{showDetail.completedDate ? formatDate(showDetail.completedDate) : 'Pending'}</p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Technician</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getTechName(showDetail.technicianId)}</p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><StatusBadge status={showDetail.status} /></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Cost</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(showDetail.cost, orgCurrency)}</p></div>
              </div>
              {showDetail.notes && (
                <div><p className="text-xs text-gray-500 dark:text-gray-400">Notes</p><p className="text-sm text-gray-900 dark:text-white">{showDetail.notes}</p></div>
              )}
              {showDetail.checklist.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Checklist</p>
                  <div className="space-y-1">
                    {showDetail.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                        <CheckCircle className={`w-4 h-4 ${showDetail.status === 'completed' ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(showDetail.status === 'scheduled' || showDetail.status === 'overdue') && (user?.role === 'admin' || user?.role === 'technician') && (
                <div className="flex gap-3 pt-4 border-t dark:border-zinc-700">
                  <button onClick={() => handleStartProgress(showDetail)} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Starting...' : 'Start Work'}
                  </button>
                </div>
              )}
              {showDetail.status === 'in_progress' && (user?.role === 'admin' || user?.role === 'technician') && (
                <div className="pt-4 border-t dark:border-zinc-700">
                  <CompletionForm onComplete={(cost) => handleComplete(showDetail, cost)} />
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function CompletionForm({ onComplete }: { onComplete: (cost: number) => void }) {
  const [cost, setCost] = useState('');
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Final Cost ($)</label>
        <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00"
          className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
      </div>
      <button onClick={() => onComplete(parseFloat(cost) || 0)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
        <CheckCircle className="w-4 h-4" /> Mark Complete
      </button>
    </div>
  );
}
