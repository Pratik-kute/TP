import { useData } from '../contexts/DataContext';
import { AuditFieldChange, AuditLog } from '../types';

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    Created:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    Updated:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    Deleted:  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  };
  const cls = colors[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {action}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    Asset:       'Asset',
    Allocation:  'Allocation',
    Maintenance: 'Maintenance',
    Repair:      'Repair',
    Depreciation:'Depreciation',
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-gray-400 uppercase tracking-wide">
      {labels[type] || type}
    </span>
  );
}

interface Props {
  assetId: string;
  onAssetClick?: (assetId: string, assetName: string) => void;
}

/** Exported so the print handler in Assets.tsx can reuse the same log-gathering logic */
export function useAssetLogs(assetId: string): { logs: AuditLog[]; assetName: string } {
  const data = useData();

  const asset = data.assets.getById(assetId);
  const assetName = asset?.name || 'Unknown Asset';

  // Collect all entity IDs related to this asset
  const relatedIds = new Set<string>([assetId]);
  data.allocations.getAll().filter(a => a.assetId === assetId).forEach(a => relatedIds.add(a.id));
  data.maintenance.getAll().filter(m => m.assetId === assetId).forEach(m => relatedIds.add(m.id));
  data.repairs.getAll().filter(r => r.assetId === assetId).forEach(r => relatedIds.add(r.id));

  const logs = data.auditLogs.getAll()
    .filter(l => relatedIds.has(l.entityId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { logs, assetName };
}

export default function AssetAuditTimeline({ assetId, onAssetClick }: Props) {
  const data = useData();
  const { logs, assetName } = useAssetLogs(assetId);

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded for this asset.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 max-h-[60vh] overflow-y-auto pr-2">
      {logs.map((log, idx) => {
        const changes: AuditFieldChange[] = Array.isArray(log.changes) ? log.changes : [];
        return (
          <div key={log.id} className="relative pl-7 pb-6">
            {/* Timeline line */}
            {idx < logs.length - 1 && (
              <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-700" />
            )}
            {/* Timeline dot */}
            <div className="absolute left-0 top-1 w-[22px] h-[22px] rounded-full bg-emerald-500 border-[3px] border-white dark:border-zinc-800 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>

            <div>
              {/* Meta row: time + action badge + entity type badge */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(log.timestamp)}</span>
                <ActionBadge action={log.action} />
                <EntityTypeBadge type={log.entityType} />
              </div>

              {/* Asset name + user */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-0.5">
                <button
                  type="button"
                  onClick={() => onAssetClick?.(assetId, assetName)}
                  className={`font-semibold text-emerald-700 dark:text-emerald-400 ${onAssetClick ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                >
                  {assetName}
                </button>
                {' '}·{' '}
                <span className="font-medium text-gray-900 dark:text-white">{log.userName}</span>
              </p>

              {/* Details */}
              <p className="text-sm text-gray-500 dark:text-gray-400">{log.details}</p>

              {/* Field-level changes */}
              {changes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {changes.map((change, i) => (
                    <div key={i} className="text-xs bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2 flex items-start gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">{change.fieldLabel}:</span>
                      <span className="text-red-500 line-through">{String(change.oldValue ?? 'empty')}</span>
                      <span className="text-gray-400 mx-0.5">&rarr;</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">{String(change.newValue ?? 'empty')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
