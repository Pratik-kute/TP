import React, { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Search, AlertTriangle, ArrowRight, Info, ArrowUp, ArrowDown } from 'lucide-react';

// ====== DEPENDENCY NOTICE ======
export function DependencyNotice({ missing }: {
  missing: { label: string; path: string; pageName: string }[];
}) {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  if (missing.length === 0) return null;
  return (
    <div className="card card-gradient mb-5 p-4 bg-amber-50/80 dark:bg-amber-900/10">
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Setup required</p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            The following must be created first:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map(d => (
              <button
                key={d.path + d.label}
                type="button"
                onClick={() => navigate(orgSlug ? `/${orgSlug}${d.path}` : d.path)}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              >
                {d.label} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== STAT CARD ======
export function StatCard({ title, value, icon, iconBg, subtitle }: {
  title: string; value: string | number; icon: ReactNode; iconBg: string; subtitle?: string;
}) {
  return (
    <div className="card card-gradient p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ====== STATUS BADGE ======
export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    allocated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    under_maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    retired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    disposed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dead: 'bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    returned: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    requested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ordered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm ${colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

// ====== MODAL ======
export function Modal({ isOpen, onClose, title, children, size = 'md' }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleKey);
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handleKey); };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white dark:bg-zinc-800 rounded-2xl w-full ${sizeMap[size]} max-h-[90vh] overflow-y-auto animate-scaleIn`}
        style={{ boxShadow: 'var(--shadow-float)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-700/50 sticky top-0 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ====== DATA TABLE ======
export function DataTable<T extends Record<string, unknown>>({ columns, data, onRowClick, emptyMessage = 'No data found', defaultSortKey, defaultSortDir = 'asc', pageSizeOptions = [10, 25, 50, 100, 500], showRowNumbers = true, searchPlaceholder = 'Search...' }: {
  columns: { key: string; label: string; sortable?: boolean; render?: (item: T) => React.ReactNode }[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  pageSizeOptions?: number[];
  showRowNumbers?: boolean;
  searchPlaceholder?: string;
}) {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const filtered = data.filter(item =>
    columns.some(col => {
      const val = item[col.key];
      return val && String(val).toLowerCase().includes(searchTerm.toLowerCase());
    })
  );

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        let cmp: number;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const colCount = columns.length + (showRowNumbers ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card card-gradient overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
              <tr>
                {showRowNumbers && (
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                )}
                {columns.map(col => {
                  const isSortable = col.sortable !== false;
                  return (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap ${isSortable ? 'cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors' : ''}`}
                      onClick={isSortable ? () => handleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {isSortable && sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : isSortable ? (
                          <span className="w-3.5 h-3.5" />
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-12 text-gray-400 dark:text-gray-500">{emptyMessage}</td></tr>
              ) : (
                paged.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {showRowNumbers && (
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{String(page * pageSize + idx + 1).padStart(3, '0')}</td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {col.render ? col.render(item) : String(item[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer — pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {sorted.length === 0
                ? 'No results'
                : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)} of ${sorted.length}`}
            </p>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {pageSizeOptions.map(n => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = page < 3 ? i : page - 2 + i;
                if (pageNum >= totalPages) return null;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === page ? 'bg-emerald-600 text-white' : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'}`}>
                    {pageNum + 1}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ====== PAGE HEADER ======
export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-400 dark:text-gray-500 mt-1.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ====== EMPTY STATE ======
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 mb-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <Icon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">{title}</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-5">{description}</p>
      {action}
    </div>
  );
}

// ====== CONFIRM DIALOG ======
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
}) {
  useEffect(() => {
    if (isOpen) {
      const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl max-w-md w-full p-6 animate-scaleIn" style={{ boxShadow: 'var(--shadow-float)' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{message}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-md shadow-red-500/20">Confirm</button>
        </div>
      </div>
    </div>
  );
}
