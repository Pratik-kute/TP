import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable } from '../components/ui';
import { formatCurrency, formatDate, calculateStraightLineDepreciation, exportToCSV } from '../utils/helpers';
import { Download, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Depreciation() {
  const { organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [selectedAsset, setSelectedAsset] = useState<string>('');

  const assets = data.assets.getAll();

  const assetDepreciationData = useMemo(() => {
    return assets.map(asset => {
      const records = calculateStraightLineDepreciation(asset);
      const currentYear = new Date().getFullYear();
      const currentRecord = records.find(r => r.year === currentYear) || records[records.length - 1];
      return {
        asset,
        records,
        currentBookValue: currentRecord?.bookValue ?? asset.purchaseCost,
        totalDepreciation: currentRecord?.accumulatedDepreciation ?? 0,
      };
    });
  }, [assets]);

  const totalOriginalValue = assets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalCurrentValue = assetDepreciationData.reduce((s, d) => s + d.currentBookValue, 0);
  const totalDepreciation = assetDepreciationData.reduce((s, d) => s + d.totalDepreciation, 0);

  const selectedData = selectedAsset ? assetDepreciationData.find(d => d.asset.id === selectedAsset) : null;

  const summaryByType = useMemo(() => {
    const grouped: Record<string, { type: string; original: number; current: number; depreciation: number }> = {};
    assetDepreciationData.forEach(d => {
      const type = d.asset.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (!grouped[type]) grouped[type] = { type, original: 0, current: 0, depreciation: 0 };
      grouped[type].original += d.asset.purchaseCost;
      grouped[type].current += d.currentBookValue;
      grouped[type].depreciation += d.totalDepreciation;
    });
    return Object.values(grouped);
  }, [assetDepreciationData]);

  const columns = [
    { key: 'id', label: 'Asset Tag', render: (d: any) => <span className="font-medium">{d.asset.assetTag}</span> },
    { key: 'name', label: 'Name', render: (d: any) => d.asset.name },
    { key: 'type', label: 'Type', render: (d: any) => d.asset.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) },
    { key: 'purchaseCost', label: 'Original Cost', render: (d: any) => formatCurrency(d.asset.purchaseCost, orgCurrency) },
    { key: 'usefulLife', label: 'Useful Life', render: (d: any) => `${d.asset.usefulLifeYears} years` },
    { key: 'salvageValue', label: 'Salvage Value', render: (d: any) => formatCurrency(d.asset.salvageValue, orgCurrency) },
    { key: 'totalDepreciation', label: 'Accum. Depreciation', render: (d: any) => formatCurrency(d.totalDepreciation, orgCurrency) },
    { key: 'currentBookValue', label: 'Book Value', render: (d: any) => <span className="font-medium">{formatCurrency(d.currentBookValue, orgCurrency)}</span> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Depreciation & Financial Tracking" subtitle="Track asset value and depreciation over time"
        action={
          <button onClick={() => exportToCSV(assetDepreciationData.map(d => ({
            AssetTag: d.asset.assetTag, Name: d.asset.name, Type: d.asset.type, OriginalCost: d.asset.purchaseCost,
            UsefulLife: d.asset.usefulLifeYears, SalvageValue: d.asset.salvageValue,
            AccumulatedDepreciation: d.totalDepreciation, BookValue: d.currentBookValue,
          })), 'depreciation-report')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card card-gradient p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Original Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalOriginalValue, orgCurrency)}</p>
        </div>
        <div className="card card-gradient p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Current Book Value</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalCurrentValue, orgCurrency)}</p>
        </div>
        <div className="card card-gradient p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Accumulated Depreciation</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalDepreciation, orgCurrency)}</p>
        </div>
      </div>

      {/* Chart: Value by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Asset Value vs Depreciation by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summaryByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: any) => formatCurrency(value, orgCurrency)} />
              <Bar dataKey="current" name="Current Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depreciation" name="Depreciation" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Individual Asset Depreciation Schedule */}
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Asset Depreciation Schedule</h3>
          <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
            <option value="">Select an asset</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} - {a.name}</option>)}
          </select>
          {selectedData ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={selectedData.records}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => formatCurrency(value, orgCurrency)} />
                <Line type="monotone" dataKey="bookValue" name="Book Value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="accumulatedDepreciation" name="Accum. Depreciation" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-400 dark:text-gray-500 text-sm">Select an asset to view schedule</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card card-gradient p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">All Assets Depreciation</h3>
        <DataTable columns={columns} data={assetDepreciationData} onRowClick={(d: any) => setSelectedAsset(d.asset.id)} />
      </div>
    </div>
  );
}
