import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge } from '../components/ui';
import { formatDate, formatCurrency, exportToCSV } from '../utils/helpers';
import { Recovery as RecoveryType, RecoveryIncidentType, RecoveryStatus, Priority } from '../types';
import { Plus, Download, ShieldAlert, Search, AlertTriangle, CheckCircle, XCircle, DollarSign, TrendingUp } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

const inputCls = 'w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const INCIDENT_TYPES: { value: RecoveryIncidentType; label: string; color: string }[] = [
  { value: 'lost', label: 'Lost', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'damaged', label: 'Damaged', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'stolen', label: 'Stolen', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'insurance_claim', label: 'Insurance Claim', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'write_off', label: 'Write Off', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
];

const SEVERITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_OPTIONS: { value: RecoveryStatus; label: string }[] = [
  { value: 'reported', label: 'Reported' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'partially_recovered', label: 'Partially Recovered' },
  { value: 'closed', label: 'Closed' },
  { value: 'written_off', label: 'Written Off' },
];

export default function Recovery() {
  const { user, hasRole, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<RecoveryType | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  // Detail modal edit state
  const [updateStatus, setUpdateStatus] = useState<RecoveryStatus>('reported');
  const [updateRecoveredAmt, setUpdateRecoveredAmt] = useState(0);
  const [updateResolution, setUpdateResolution] = useState('');

  const canManage = hasRole(['admin', 'manager']);

  const defaultForm = {
    assetId: '', incidentType: 'damaged' as RecoveryIncidentType, severity: 'medium' as Priority,
    description: '', estimatedLoss: 0, incidentDate: new Date().toISOString().split('T')[0],
  };
  const [form, setForm] = useState(defaultForm);

  const recoveries = data.recoveries.getAll();
  const assets = data.assets.getAll();
  const users = data.users.getAll();

  const getAssetName = (id: string) => { const a = assets.find(a => a.id === id); return a ? `${a.name} (${a.assetTag})` : 'Unknown'; };
  const getAssetTag = (id: string) => assets.find(a => a.id === id)?.assetTag || '';
  const getUserName = (id: string | null) => id ? users.find(u => u.id === id)?.name || 'Unknown' : 'N/A';

  const filtered = filter === 'all' ? recoveries : recoveries.filter(r => r.status === filter);

  const counts = useMemo(() => {
    const c = { all: recoveries.length, reported: 0, investigating: 0, recovered: 0, partially_recovered: 0, closed: 0, written_off: 0 };
    recoveries.forEach(r => { if (c[r.status as keyof typeof c] !== undefined) (c as any)[r.status]++; });
    return c;
  }, [recoveries]);

  const totalLoss = useMemo(() => recoveries.reduce((s, r) => s + (r.estimatedLoss || 0), 0), [recoveries]);
  const totalRecovered = useMemo(() => recoveries.reduce((s, r) => s + (r.recoveredAmount || 0), 0), [recoveries]);
  const openCases = counts.reported + counts.investigating;

  // ---- CRUD ----
  const handleCreate = async () => {
    if (!form.assetId || !form.description.trim()) return;
    setSaving(true);
    try {
      await data.recoveries.create({
        assetId: form.assetId, reportedBy: user!.id, incidentType: form.incidentType,
        status: 'reported', severity: form.severity, description: form.description.trim(),
        resolution: '', estimatedLoss: form.estimatedLoss, recoveredAmount: 0,
        incidentDate: form.incidentDate, resolvedDate: null, resolvedBy: null,
        createdAt: new Date().toISOString(),
      });
      const assetName = getAssetName(form.assetId);
      await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Recovery', form.assetId, 'Recovery', `Reported ${form.incidentType} incident for ${assetName}`);
      data.notifyByRole(['admin', 'manager'], 'recovery', 'Incident Reported', `${user!.name} reported a ${form.incidentType} incident for ${assetName}. Estimated loss: ${formatCurrency(form.estimatedLoss, orgCurrency)}.`, form.severity === 'critical' ? 'high' : 'medium', user!.id).catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'recovery', 'Incident Reported', `You reported a ${form.incidentType} incident for ${assetName}. Estimated loss: ${formatCurrency(form.estimatedLoss, orgCurrency)}.`, 'low').catch(e => console.error('[Notify]', e));
      const recTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(recTargets.map(u => ({email:u.email,name:u.name})), 'recovery_reported',
        `Incident Reported: ${assetName}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Incident Reported',body:ET.recoveryReportedBody(assetName,getAssetTag(form.assetId)||'',form.incidentType,user!.name,form.description||'')},
        organization?.id||'');
      setShowAdd(false);
      setForm(defaultForm);
      setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (rec: RecoveryType) => {
    setSaving(true);
    try {
      const isResolved = ['recovered', 'partially_recovered', 'closed', 'written_off'].includes(updateStatus);
      await data.recoveries.update(rec.id, {
        status: updateStatus,
        recoveredAmount: updateRecoveredAmt,
        resolution: updateResolution.trim(),
        ...(isResolved ? { resolvedDate: new Date().toISOString(), resolvedBy: user!.id } : {}),
      });
      const assetName = getAssetName(rec.assetId);
      await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Recovery', rec.id, 'Recovery', `Updated ${assetName} incident to ${updateStatus}. Recovered: ${formatCurrency(updateRecoveredAmt, orgCurrency)}`);
      data.addNotification(rec.reportedBy, 'recovery', 'Incident Updated', `Your ${rec.incidentType} report for ${assetName} has been updated to: ${updateStatus.replace(/_/g, ' ')}.${updateRecoveredAmt > 0 ? ` Recovered: ${formatCurrency(updateRecoveredAmt, orgCurrency)}` : ''}`, 'medium').catch(e => console.error('[Notify]', e));
      data.addNotification(user!.id, 'recovery', 'Incident Updated', `You updated the ${rec.incidentType} incident for ${assetName} to ${updateStatus.replace(/_/g, ' ')}.`, 'low').catch(e => console.error('[Notify]', e));
      const reporter = data.users.getById(rec.reportedBy);
      if (reporter) sendNotificationEmail('recovery_updated', reporter.email, reporter.name,
        `Incident Updated: ${assetName}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Recovery Incident Updated',body:ET.recoveryUpdatedBody(assetName,getAssetTag(rec.assetId)||'',updateStatus,user!.name)},
        organization?.id||'');
      setShowDetail(null);
      setRefresh(r => r + 1);
    } finally { setSaving(false); }
  };

  const getIncidentBadge = (type: RecoveryIncidentType) => {
    const t = INCIDENT_TYPES.find(i => i.value === type);
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${t?.color || ''}`}>{t?.label || type}</span>;
  };

  // ---- Table ----
  const columns = [
    { key: 'assetId', label: 'Asset', render: (r: any) => <span className="font-medium text-gray-900 dark:text-white">{getAssetName(r.assetId)}</span> },
    { key: 'incidentType', label: 'Type', render: (r: any) => getIncidentBadge(r.incidentType) },
    { key: 'severity', label: 'Severity', render: (r: any) => <StatusBadge status={r.severity} /> },
    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'estimatedLoss', label: 'Est. Loss', render: (r: any) => <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(r.estimatedLoss, orgCurrency)}</span> },
    { key: 'recoveredAmount', label: 'Recovered', render: (r: any) => <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(r.recoveredAmount, orgCurrency)}</span> },
    { key: 'reportedBy', label: 'Reported By', render: (r: any) => getUserName(r.reportedBy) },
    { key: 'incidentDate', label: 'Date', render: (r: any) => formatDate(r.incidentDate) },
  ];

  const filterTabs = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'reported', label: 'Reported', count: counts.reported },
    { key: 'investigating', label: 'Investigating', count: counts.investigating },
    { key: 'recovered', label: 'Recovered', count: counts.recovered },
    { key: 'partially_recovered', label: 'Partial', count: counts.partially_recovered },
    { key: 'closed', label: 'Closed', count: counts.closed },
    { key: 'written_off', label: 'Written Off', count: counts.written_off },
  ];

  const openDetailModal = (rec: RecoveryType) => {
    setShowDetail(rec);
    setUpdateStatus(rec.status);
    setUpdateRecoveredAmt(rec.recoveredAmount || 0);
    setUpdateResolution(rec.resolution || '');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Asset Recovery" subtitle="Track incidents, losses, and fund recoveries"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(filtered.map(r => ({ Asset: getAssetName(r.assetId), Tag: getAssetTag(r.assetId), Type: r.incidentType, Severity: r.severity, Status: r.status, EstLoss: r.estimatedLoss, Recovered: r.recoveredAmount, ReportedBy: getUserName(r.reportedBy), Date: r.incidentDate, Resolution: r.resolution })), 'recovery')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> Report Incident</button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Incidents', count: counts.all, icon: ShieldAlert, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Open Cases', count: openCases, icon: Search, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Recovered', count: counts.recovered + counts.partially_recovered, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Est. Total Loss', count: formatCurrency(totalLoss, orgCurrency), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', isText: true },
          { label: 'Total Recovered', count: formatCurrency(totalRecovered, orgCurrency), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', isText: true },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 flex items-center gap-3`}>
            <c.icon className={`w-5 h-5 ${c.color}`} />
            <div>
              <p className={`${(c as any).isText ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>{c.count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5'}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card card-gradient p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShieldAlert className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No recovery incidents found.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} onRowClick={(r: any) => openDetailModal(r)} />
        )}
      </div>

      {/* ---- New Incident Modal ---- */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Report Incident" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Asset *</label>
              <select value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} className={inputCls}>
                <option value="">Select asset</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Incident Type</label>
              <select value={form.incidentType} onChange={e => setForm({ ...form, incidentType: e.target.value as RecoveryIncidentType })} className={inputCls}>
                {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Severity</label>
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as Priority })} className={inputCls}>
                {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estimated Loss ($)</label>
              <input type="number" min={0} step="0.01" value={form.estimatedLoss} onChange={e => setForm({ ...form, estimatedLoss: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Incident Date</label>
            <input type="date" value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} placeholder="Describe what happened..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-700">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.assetId || !form.description.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Submitting...' : 'Report Incident'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---- Detail Modal ---- */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Incident Details" size="lg">
        {showDetail && (
          <div className="space-y-5">
            {/* Status Banner */}
            <div className={`rounded-lg p-3 flex items-center gap-3 ${
              showDetail.status === 'reported' ? 'bg-amber-50 dark:bg-amber-900/20' :
              showDetail.status === 'investigating' ? 'bg-blue-50 dark:bg-blue-900/20' :
              showDetail.status === 'recovered' ? 'bg-green-50 dark:bg-green-900/20' :
              showDetail.status === 'partially_recovered' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
              showDetail.status === 'written_off' ? 'bg-red-50 dark:bg-red-900/20' :
              'bg-gray-50 dark:bg-zinc-700/50'
            }`}>
              <StatusBadge status={showDetail.status} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{getAssetName(showDetail.assetId)}</p>
                {showDetail.resolvedDate && <p className="text-xs text-gray-500">Resolved {formatDate(showDetail.resolvedDate)} by {getUserName(showDetail.resolvedBy)}</p>}
              </div>
              {getIncidentBadge(showDetail.incidentType)}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Severity</p><StatusBadge status={showDetail.severity} /></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Reported By</p><p className="text-sm font-medium text-gray-900 dark:text-white">{getUserName(showDetail.reportedBy)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Incident Date</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(showDetail.incidentDate)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Reported On</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(showDetail.createdAt)}</p></div>
            </div>

            {/* Financial */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-zinc-700/30 rounded-lg">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Estimated Loss</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(showDetail.estimatedLoss, orgCurrency)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Recovered Amount</p><p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(showDetail.recoveredAmount, orgCurrency)}</p></div>
            </div>

            {/* Description */}
            <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{showDetail.description}</p>
            </div>

            {showDetail.resolution && (
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resolution</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{showDetail.resolution}</p>
              </div>
            )}

            {/* Admin/Manager Actions */}
            {canManage && !['closed', 'written_off'].includes(showDetail.status) && (
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Update Incident</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <select value={updateStatus} onChange={e => setUpdateStatus(e.target.value as RecoveryStatus)} className={inputCls}>
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recovered Amount ($)</label>
                    <input type="number" min={0} step="0.01" value={updateRecoveredAmt} onChange={e => setUpdateRecoveredAmt(parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resolution Notes</label>
                  <textarea value={updateResolution} onChange={e => setUpdateResolution(e.target.value)} rows={2} className={inputCls} placeholder="How was this resolved..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleUpdateStatus(showDetail)} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {saving ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
