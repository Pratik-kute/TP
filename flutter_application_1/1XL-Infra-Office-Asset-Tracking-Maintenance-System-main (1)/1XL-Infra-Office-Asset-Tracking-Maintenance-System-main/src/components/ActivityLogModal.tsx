import { Printer } from 'lucide-react';
import { Asset, Organization } from '../types';
import { useData } from '../contexts/DataContext';
import AssetAuditTimeline, { useAssetLogs, formatDateTime } from './AssetAuditTimeline';
import { Modal } from './ui';

interface Props {
  asset: Asset;
  organization: Organization | null | undefined;
  onClose: () => void;
  onAssetSwitch?: (asset: Asset) => void;
}

function ActivityLogBody({ asset, organization, onClose, onAssetSwitch }: Props) {
  const data = useData();
  const { logs, assetName } = useAssetLogs(asset.id);

  function handlePrint() {
    const actionBadgeColor = (action: string) =>
      action === 'Created' ? '#16a34a' : action === 'Deleted' ? '#dc2626' : '#2563eb';
    const typeColor: Record<string, string> = {
      Asset: '#10b981', Allocation: '#6366f1', Maintenance: '#f59e0b', Repair: '#ef4444', Depreciation: '#8b5cf6',
    };

    const rows = logs.map(log => {
      const changes = Array.isArray(log.changes) ? log.changes : [];
      const changesHtml = changes.length > 0
        ? `<div style="margin-top:6px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
            ${changes.map((c: any) => `
              <div style="font-size:11px;margin-bottom:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="color:#475569;font-weight:600;">${c.fieldLabel}:</span>
                <span style="color:#ef4444;text-decoration:line-through;">${c.oldValue ?? 'empty'}</span>
                <span style="color:#94a3b8;">→</span>
                <span style="color:#16a34a;font-weight:600;">${c.newValue ?? 'empty'}</span>
              </div>`).join('')}
           </div>`
        : '';
      const ac = actionBadgeColor(log.action);
      const tc = typeColor[log.entityType] || '#64748b';
      return `
        <div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div style="width:12px;flex-shrink:0;padding-top:4px;">
            <div style="width:11px;height:11px;border-radius:50%;background:#10b981;"></div>
          </div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="font-size:11px;color:#94a3b8;">${formatDateTime(log.timestamp)}</span>
              <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;background:${ac}18;color:${ac};text-transform:uppercase;">${log.action}</span>
              <span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:999px;background:${tc}18;color:${tc};text-transform:uppercase;">${log.entityType}</span>
            </div>
            <p style="font-size:13px;color:#1f2937;margin:0 0 2px;"><strong style="color:#065f46;">${assetName}</strong> · <strong>${log.userName}</strong></p>
            <p style="font-size:12px;color:#6b7280;margin:0;">${log.details}</p>
            ${changesHtml}
          </div>
        </div>`;
    }).join('');

    const logoHtml = organization?.logoUrl
      ? `<img src="${organization.logoUrl}" alt="${organization.name}" style="height:48px;object-fit:contain;margin-bottom:8px;" />`
      : '';
    const printedOn = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Activity Log | ${assetName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; padding: 36px 40px; color: #1f2937; font-size: 13px; }
        .org-header { display:flex; align-items:center; gap:16px; padding-bottom:16px; border-bottom:2px solid #10b981; margin-bottom:20px; }
        .org-name { font-size:18px; font-weight:700; color:#065f46; }
        .org-meta { font-size:11px; color:#6b7280; margin-top:2px; }
        .asset-card { padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; margin-bottom:18px; }
        .asset-card .tag { font-family:monospace; font-size:12px; color:#059669; font-weight:600; }
        .asset-card .name { font-size:15px; font-weight:700; color:#1f2937; margin-bottom:2px; }
        .asset-card .meta { font-size:11px; color:#6b7280; }
        .report-title { font-size:16px; font-weight:700; margin-bottom:2px; }
        .report-sub { font-size:11px; color:#94a3b8; margin-bottom:16px; }
        @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
      </style></head>
      <body>
        <div class="org-header">
          ${logoHtml}
          <div>
            <div class="org-name">${organization?.name || ''}</div>
            <div class="org-meta">Asset Activity Report &nbsp;·&nbsp; Generated ${printedOn}</div>
          </div>
        </div>
        <div class="asset-card">
          <div class="name">${assetName}</div>
          <div class="tag">${asset.assetTag}</div>
          <div class="meta">${[asset.category, asset.brand, asset.model].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="report-title">Activity Log</div>
        <div class="report-sub">${logs.length} event${logs.length !== 1 ? 's' : ''} across all activity types</div>
        <div>${rows || '<p style="color:#9ca3af;padding:16px 0;">No activity recorded.</p>'}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 p-3 bg-gray-50 dark:bg-zinc-700/30 rounded-xl gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{assetName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{asset.assetTag}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {[asset.category, asset.brand, asset.model].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            {logs.length} event{logs.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex-shrink-0"
        >
          <Printer className="w-4 h-4" />
          Print Log
        </button>
      </div>
      <AssetAuditTimeline
        assetId={asset.id}
        onAssetClick={(id) => {
          const a = data.assets.getById(id);
          if (a && onAssetSwitch) onAssetSwitch(a);
        }}
      />
    </div>
  );
}

/** Self-contained modal — pass asset + org, handles open/close internally via onClose */
export default function ActivityLogModal({ asset, organization, onClose, onAssetSwitch }: Props) {
  return (
    <Modal
      isOpen={!!asset}
      onClose={onClose}
      title={`Activity Log | ${asset.name}`}
      size="lg"
    >
      <ActivityLogBody
        asset={asset}
        organization={organization}
        onClose={onClose}
        onAssetSwitch={onAssetSwitch}
      />
    </Modal>
  );
}
