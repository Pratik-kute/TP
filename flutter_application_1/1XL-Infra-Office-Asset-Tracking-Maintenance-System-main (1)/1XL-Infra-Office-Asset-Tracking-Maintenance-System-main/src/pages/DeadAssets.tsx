import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Asset } from '../types';
import { PageHeader, StatusBadge, ConfirmDialog } from '../components/ui';
import ActivityLogModal from '../components/ActivityLogModal';
import { formatCurrency, formatDate, exportToCSV } from '../utils/helpers';
import {
  Skull, Search, Download, DollarSign, Layers,
  Tag, MapPin, Building2, Calendar, ChevronRight, RotateCcw, Eye, Trash2,
} from 'lucide-react';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'د.إ',
};

function formatAssetCost(asset: Asset): string {
  const symbol = asset.currency ? (CURRENCY_SYMBOLS[asset.currency] || asset.currency + ' ') : '$';
  return `${symbol}${asset.purchaseCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DeadAssets() {
  const data = useData();
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<Asset | null>(null);
  const [restoring, setRestoring] = useState(false);

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
      await data.assets.bulkRemove(idsToDelete);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleting(false);
    }
  }

  const locations = data.locations.getAll();
  const departments = data.departments.getAll();

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || '—';
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || '—';

  const deadAssets = data.assets.getAll().filter(a => a.status === 'dead' || a.status === 'retired' || a.status === 'disposed');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(deadAssets.map(a => a.category).filter(Boolean))).sort()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deadAssets.length, deadAssets.map(a => a.category).join(',')]
  );

  const filtered = useMemo(() => deadAssets.filter(a => {
    const matchesSearch = searchQuery === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.serialNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.brand || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [deadAssets.length, searchQuery, categoryFilter]);

  // Stats
  const totalValue = deadAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    deadAssets.forEach(a => { map[a.category || 'Unknown'] = (map[a.category || 'Unknown'] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadAssets.length]);

  async function handleRestore(asset: Asset, newStatus: 'available' | 'retired' | 'disposed') {
    setRestoring(true);
    try {
      await data.assets.update(asset.id, { status: newStatus, updatedAt: new Date().toISOString() });
      await data.addAuditLog(
        user?.id || '',
        user?.name || '',
        'Updated',
        'Assets',
        asset.id,
        'Asset',
        `Status changed from Dead to ${newStatus.replace(/_/g, ' ')} for "${asset.name}"`
      );
      setRestoreConfirm(null);
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setRestoring(false);
    }
  }

  const selectCls = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Dead Assets"
        subtitle="Assets marked as dead: completely non-functional or written off"
        action={
          <button
            onClick={() => exportToCSV(filtered.map(a => ({
              'Asset Tag': a.assetTag,
              Name: a.name,
              Category: a.category,
              Brand: a.brand,
              Model: a.model,
              'Serial Number': a.serialNumber,
              Location: getLocationName(a.locationId),
              Department: getDepartmentName(a.departmentId),
              'Purchase Date': a.purchaseDate,
              'Purchase Cost': a.purchaseCost,
              Currency: a.currency || 'USD',
              Status: a.status,
            })), 'dead-assets')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-rose-50/40 dark:hover:bg-rose-500/5 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-gradient p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
            <Skull className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{deadAssets.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dead Assets</p>
          </div>
        </div>

        <div className="card card-gradient p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalValue, orgCurrency)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Written-off Value</p>
          </div>
        </div>

        <div className="card card-gradient p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{categories.length - 1}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Categories Affected</p>
          </div>
        </div>
      </div>

      {/* Category breakdown mini-bar */}
      {categoryBreakdown.length > 0 && (
        <div className="card card-gradient p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Breakdown by Category</p>
          <div className="flex flex-wrap gap-3">
            {categoryBreakdown.map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  categoryFilter === cat
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                    : 'bg-gray-50 dark:bg-zinc-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  categoryFilter === cat
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900'
                    : 'bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300'
                }`}>{count}</span>
              </button>
            ))}
            {categoryFilter !== 'all' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline self-center"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, tag, serial, brand…"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectCls}>
          <option value="all">All Categories</option>
          {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{filtered.length} asset{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="card card-gradient">
          <div className="py-16 text-center">
            <Skull className="w-14 h-14 text-gray-200 dark:text-zinc-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {deadAssets.length === 0
                ? 'No dead assets. All assets are operational.'
                : 'No assets match your search.'}
            </p>
            {deadAssets.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Mark an asset as "Dead" from the Assets page to see it here.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="card card-gradient overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))}
                      onChange={() => toggleSelectAll(filtered.map(r => r.id))}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Asset</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Location</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Department</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap text-right">Cost</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => (
                  <tr
                    key={asset.id}
                    className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Skull className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{asset.name}</span>
                        <StatusBadge status={asset.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Tag className="w-3 h-3" />{asset.assetTag}
                        </span>
                        {asset.brand && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{asset.brand}{asset.model ? ` · ${asset.model}` : ''}</span>
                        )}
                        {asset.purchaseDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Calendar className="w-3 h-3" />{formatDate(asset.purchaseDate)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{asset.category || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <MapPin className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        {getLocationName(asset.locationId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <Building2 className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        {getDepartmentName(asset.departmentId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatAssetCost(asset)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View activity log"
                          onClick={() => { setSelectedAsset(asset); setShowLogModal(true); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Restore / change status"
                          onClick={() => setRestoreConfirm(asset)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-800 rounded-2xl px-6 py-3 flex items-center gap-4 animate-scaleIn border border-gray-200 dark:border-zinc-700"
             style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} asset{selectedIds.size > 1 ? 's' : ''} selected
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
        title="Delete Selected Dead Assets"
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected dead asset${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
      />

      {/* Activity Log Modal */}
      {showLogModal && selectedAsset && (
        <ActivityLogModal
          asset={selectedAsset}
          organization={organization}
          onClose={() => { setShowLogModal(false); setSelectedAsset(null); }}
          onAssetSwitch={(asset) => setSelectedAsset(asset)}
        />
      )}

      {/* Restore Confirm Dialog */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !restoring && setRestoreConfirm(null)} />
          <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Restore Asset</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{restoreConfirm.name} ({restoreConfirm.assetTag})</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Select the new status to restore this asset to:</p>
            <div className="space-y-2 mb-5">
              {(['available', 'retired', 'disposed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleRestore(restoreConfirm, s)}
                  disabled={restoring}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-colors text-sm text-gray-800 dark:text-gray-200 disabled:opacity-50"
                >
                  <span className="capitalize font-medium">{s.replace(/_/g, ' ')}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setRestoreConfirm(null)}
              disabled={restoring}
              className="w-full px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            {restoring && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
