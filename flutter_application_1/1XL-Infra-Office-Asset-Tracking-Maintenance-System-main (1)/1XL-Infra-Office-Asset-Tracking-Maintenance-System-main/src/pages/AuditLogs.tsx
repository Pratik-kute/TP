import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui';
import { formatDateTime, exportToCSV } from '../utils/helpers';
import { AuditLog, Asset } from '../types';
import { Download, ChevronDown, ChevronRight, ArrowRight, Search, Filter, User, Clock, Activity, QrCode, MapPin, Smartphone, Navigation, ExternalLink } from 'lucide-react';
import ActivityLogModal from '../components/ActivityLogModal';

const ACTION_STYLES: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Created: { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-400' },
  CREATE: { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-400' },
  Updated: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
  UPDATE: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
  Deleted: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
  APPROVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
  Approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
  REJECT: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
  Rejected: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
  ALLOCATE: { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400' },
  'QR Scanned': { bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
};

const fallbackStyle = { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-zinc-700', darkText: 'dark:text-gray-300' };

function ActionBadge({ action }: { action: string }) {
  // Match style by checking if any key is contained in the action string
  const key = Object.keys(ACTION_STYLES).find(k => action.toUpperCase().includes(k.toUpperCase()));
  const s = key ? ACTION_STYLES[key] : fallbackStyle;
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold leading-tight text-center ${s.bg} ${s.text} ${s.darkBg} ${s.darkText}`}>{action}</span>;
}

function ModuleBadge({ module }: { module: string }) {
  return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400">{module}</span>;
}

function ChangeDetail({ changes }: { changes: AuditLog['changes'] }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {changes.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-3 py-1.5">
          <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">{c.fieldLabel}</span>
          <span className="text-red-500 dark:text-red-400 line-through max-w-[200px] truncate">{String(c.oldValue ?? 'None')}</span>
          <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-green-600 dark:text-green-400 font-medium max-w-[200px] truncate">{String(c.newValue ?? 'None')}</span>
        </div>
      ))}
    </div>
  );
}

/** Parse scan details string into structured data */
function parseScanDetails(details: string): { assetName: string; assetTag: string; lat: string; lng: string; accuracy: string; device: string; platform: string; hasLocation: boolean } {
  const parts = details.split(' | ');
  let assetName = '', assetTag = '', lat = '', lng = '', accuracy = '', device = '', platform = '', hasLocation = false;

  // Parse: QR scanned for "Name" (TAG) | Location: ... | Device: ... | Platform: ...
  const nameMatch = parts[0]?.match(/QR scanned for "(.+?)" \((.+?)\)/);
  if (nameMatch) { assetName = nameMatch[1]; assetTag = nameMatch[2]; }

  const locPart = parts.find(p => p.trim().startsWith('Location:'));
  if (locPart) {
    const coordMatch = locPart.match(/([-\d.]+),\s*([-\d.]+)\s*\(±(\d+)m\)/);
    if (coordMatch) {
      lat = coordMatch[1]; lng = coordMatch[2]; accuracy = coordMatch[3]; hasLocation = true;
    }
  }

  const devPart = parts.find(p => p.trim().startsWith('Device:'));
  if (devPart) device = devPart.replace('Device:', '').trim();

  const platPart = parts.find(p => p.trim().startsWith('Platform:'));
  if (platPart) platform = platPart.replace('Platform:', '').trim();

  return { assetName, assetTag, lat, lng, accuracy, device, platform, hasLocation };
}

export default function AuditLogs() {
  const data = useData();
  const { organization } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'qr-scans'>('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [assetLogTarget, setAssetLogTarget] = useState<Asset | null>(null);

  const logs = data.auditLogs.getAll().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const qrScanLogs = useMemo(() => logs.filter(l => l.action === 'QR Scanned'), [logs]);

  const modules = useMemo(() => [...new Set(logs.map(l => l.module))].sort(), [logs]);
  const actions = useMemo(() => [...new Set(logs.map(l => l.action))].sort(), [logs]);

  const [qrSearchQuery, setQrSearchQuery] = useState('');

  const filtered = useMemo(() => logs.filter(l =>
    (moduleFilter === 'all' || l.module === moduleFilter) &&
    (actionFilter === 'all' || l.action === actionFilter) &&
    (searchQuery === '' || l.details.toLowerCase().includes(searchQuery.toLowerCase()) || l.userName.toLowerCase().includes(searchQuery.toLowerCase()) || l.entityType.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [logs, moduleFilter, actionFilter, searchQuery]);

  const qrScanFiltered = useMemo(() => qrScanLogs.filter(l =>
    qrSearchQuery === '' || l.details.toLowerCase().includes(qrSearchQuery.toLowerCase())
  ), [qrScanLogs, qrSearchQuery]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Stats
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return logs.filter(l => l.timestamp.startsWith(today)).length;
  }, [logs]);

  const selectCls = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Activity Log" subtitle="Complete audit trail of all system changes"
        action={
          <button onClick={() => {
            const exportData = activeTab === 'qr-scans'
              ? qrScanFiltered.map(l => {
                  const p = parseScanDetails(l.details);
                  return { Timestamp: l.timestamp, Asset: p.assetName, Tag: p.assetTag, Latitude: p.lat, Longitude: p.lng, Accuracy: p.accuracy ? `±${p.accuracy}m` : '', Device: p.device, Platform: p.platform };
                })
              : filtered.map(l => ({
                  Timestamp: l.timestamp, User: l.userName, Action: l.action, Module: l.module,
                  EntityType: l.entityType, EntityId: l.entityId, Details: l.details,
                  Changes: l.changes?.map(c => `${c.fieldLabel}: ${c.oldValue} → ${c.newValue}`).join('; ') || '',
                }));
            exportToCSV(exportData, activeTab === 'qr-scans' ? 'qr-scan-logs' : 'activity-log');
          }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-xl w-fit">
        <button onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-white dark:bg-zinc-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <Activity className="w-4 h-4" /> All Activity
        </button>
        <button onClick={() => setActiveTab('qr-scans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'qr-scans' ? 'bg-white dark:bg-zinc-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <QrCode className="w-4 h-4" /> QR Scans
          {qrScanLogs.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{qrScanLogs.length}</span>}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {activeTab === 'all' ? (
          <>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><Activity className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{logs.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Entries</p></div>
            </div>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center"><Clock className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{todayCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Today</p></div>
            </div>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><User className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{new Set(logs.map(l => l.userId)).size}</p><p className="text-xs text-gray-500 dark:text-gray-400">Active Users</p></div>
            </div>
          </>
        ) : (
          <>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><QrCode className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{qrScanLogs.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Scans</p></div>
            </div>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{qrScanLogs.filter(l => !l.details.includes('Location denied') && !l.details.includes('Location unavailable')).length}</p><p className="text-xs text-gray-500 dark:text-gray-400">With Location</p></div>
            </div>
            <div className="card card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{new Set(qrScanLogs.map(l => { const p = parseScanDetails(l.details); return p.platform; })).size}</p><p className="text-xs text-gray-500 dark:text-gray-400">Platforms</p></div>
            </div>
          </>
        )}
      </div>

      {activeTab === 'all' ? (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search logs..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className={selectCls}>
                <option value="all">All Modules</option>
                {modules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={selectCls}>
              <option value="all">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{filtered.length} entries</span>
          </div>

          {/* Log List */}
          <div className="card card-gradient overflow-hidden">
            {/* Column Headers */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-200 dark:border-zinc-600 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="w-[40px] flex-shrink-0 text-center">#</span>
              <div className="w-5 flex-shrink-0" />
              <span className="w-[140px] flex-shrink-0">Timestamp</span>
              <span className="w-[130px] flex-shrink-0">User</span>
              <span className="w-[120px] flex-shrink-0">Action</span>
              <span className="w-[100px] flex-shrink-0">Module</span>
              <span className="flex-1">Details</span>
              <span className="w-[70px] flex-shrink-0 text-right">Changes</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-zinc-700/30 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No activity logs found.</p>
              </div>
            ) : (
              filtered.map((log, idx) => {
                const hasChanges = log.changes && log.changes.length > 0;
                const isExpanded = expandedRows.has(log.id);
                const rowAsset = log.entityType === 'Asset' ? data.assets.getById(log.entityId) : null;
                return (
                  <div key={log.id} className="group">
                    <div
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5`}
                      onClick={() => {
                        if (hasChanges) toggleRow(log.id);
                        else if (rowAsset) setAssetLogTarget(rowAsset);
                      }}
                    >
                      {/* Row number */}
                      <span className="w-[40px] flex-shrink-0 text-center text-xs text-gray-400 dark:text-gray-500 font-mono">{String(idx + 1).padStart(3, '0')}</span>

                      {/* Expand chevron */}
                      <div className="w-5 flex-shrink-0">
                        {hasChanges ? (
                          isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : <div className="w-4" />}
                      </div>

                      {/* Timestamp */}
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-[140px] flex-shrink-0 font-mono">{formatDateTime(log.timestamp)}</span>

                      {/* User */}
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-[130px] flex-shrink-0 truncate">{log.userName}</span>

                      {/* Action */}
                      <div className="w-[120px] flex-shrink-0"><ActionBadge action={log.action} /></div>

                      {/* Module */}
                      <div className="w-[100px] flex-shrink-0">
                        <ModuleBadge module={log.module} />
                      </div>

                      {/* Details */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {log.entityType === 'Asset' && (() => {
                          const asset = data.assets.getById(log.entityId);
                          if (!asset) return null;
                          return (
                            <button
                              onClick={e => { e.stopPropagation(); setAssetLogTarget(asset); }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex-shrink-0 border border-emerald-200 dark:border-emerald-800"
                              title="View activity log for this asset"
                            >
                              {asset.name}
                            </button>
                          );
                        })()}
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{log.details}</span>
                      </div>

                      {/* Change count badge */}
                      <div className="w-[70px] flex-shrink-0 text-right">
                        {hasChanges && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{log.changes!.length}</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded change details */}
                    {isExpanded && hasChanges && (
                      <div className="px-5 pb-4 pl-14">
                        <ChangeDetail changes={log.changes} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* QR Scan Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={qrSearchQuery} onChange={e => setQrSearchQuery(e.target.value)} placeholder="Search by asset name, tag, device..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{qrScanFiltered.length} scans</span>
          </div>

          {/* QR Scan Table */}
          <div className="card card-gradient overflow-hidden">
            {/* Column Headers */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-200 dark:border-zinc-600 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="w-[40px] flex-shrink-0 text-center">#</span>
              <span className="w-[140px] flex-shrink-0">Timestamp</span>
              <span className="w-[120px] flex-shrink-0">Asset Tag</span>
              <span className="w-[140px] flex-shrink-0">Asset Name</span>
              <span className="w-[90px] flex-shrink-0">Platform</span>
              <span className="flex-1">Device</span>
              <span className="w-[160px] flex-shrink-0">Location</span>
              <span className="w-[40px] flex-shrink-0 text-center">Map</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-zinc-700/30 max-h-[600px] overflow-y-auto">
              {qrScanFiltered.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No QR scan logs found.</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Scans will appear here when someone scans an asset QR code.</p>
                </div>
              ) : (
                qrScanFiltered.map((log, idx) => {
                  const scan = parseScanDetails(log.details);
                  const asset = data.assets.getById(log.entityId);
                  return (
                    <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors cursor-pointer" onClick={() => asset && setAssetLogTarget(asset)}>
                      {/* Row number */}
                      <span className="w-[40px] flex-shrink-0 text-center text-xs text-gray-400 dark:text-gray-500 font-mono">{String(idx + 1).padStart(3, '0')}</span>

                      {/* Timestamp */}
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-[140px] flex-shrink-0 font-mono">{formatDateTime(log.timestamp)}</span>

                      {/* Asset Tag */}
                      <div className="w-[120px] flex-shrink-0">
                        {asset ? (
                          <button
                            onClick={() => setAssetLogTarget(asset)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors border border-emerald-200 dark:border-emerald-800"
                            title="View activity log for this asset"
                          >
                            {scan.assetTag}
                          </button>
                        ) : (
                          <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{scan.assetTag}</span>
                        )}
                      </div>

                      {/* Asset Name */}
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-[140px] flex-shrink-0 truncate">{scan.assetName || '—'}</span>

                      {/* Platform */}
                      <div className="w-[90px] flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold leading-tight ${
                          scan.platform === 'iOS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          scan.platform === 'Android' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          scan.platform === 'Windows' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' :
                          scan.platform === 'macOS' ? 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300' :
                          'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
                        }`}>{scan.platform || 'Unknown'}</span>
                      </div>

                      {/* Device */}
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{scan.device || '—'}</span>

                      {/* Location */}
                      <div className="w-[160px] flex-shrink-0">
                        {scan.hasLocation ? (
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate block" title={`${scan.lat}, ${scan.lng} (±${scan.accuracy}m)`}>
                            {scan.lat}, {scan.lng}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600 italic">Denied / N/A</span>
                        )}
                      </div>

                      {/* Map link */}
                      <div className="w-[40px] flex-shrink-0 text-center">
                        {scan.hasLocation ? (
                          <a
                            href={`https://www.google.com/maps?q=${scan.lat},${scan.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                            title="View on Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </a>
                        ) : (
                          <span className="text-gray-200 dark:text-gray-700">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Asset Activity Log popup */}
      {assetLogTarget && (
        <ActivityLogModal
          asset={assetLogTarget}
          organization={organization}
          onClose={() => setAssetLogTarget(null)}
          onAssetSwitch={(asset) => setAssetLogTarget(asset)}
        />
      )}
    </div>
  );
}
