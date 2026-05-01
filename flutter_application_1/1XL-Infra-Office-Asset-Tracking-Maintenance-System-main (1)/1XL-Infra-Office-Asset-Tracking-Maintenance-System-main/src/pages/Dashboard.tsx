import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgSlug } from '../hooks/useOrgSlug';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { checkAndSendSubscriptionReminder } from '../lib/subscriptionReminderService';
import { StatCard, StatusBadge, PageHeader } from '../components/ui';
import { formatCurrency, formatDate, isExpiringSoon, SUPPORTED_CURRENCIES } from '../utils/helpers';
import {
  Asset, Allocation, Maintenance, Repair, Consumable, Procurement,
  User, Department, Notification, Recovery
} from '../types';
import {
  Package, Users as UsersIcon, Wrench, AlertTriangle, TrendingDown, ShoppingCart,
  ArrowLeftRight, BoxesIcon, Bell, CheckCircle, Clock, XCircle, ArrowRight, Building2,
  DollarSign, Shield, TrendingUp, Activity, CircleDot, Gauge, AlertCircle,
  FileWarning, PackageCheck, BarChart3, Layers, Target, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#a3a3a3', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const { user, organization } = useAuth();
  const data = useData();
  const navigate = useNavigate();
  const orgSlug = useOrgSlug();
  const [displayCurrency, setDisplayCurrency] = useState(organization?.currency || 'USD');

  // Daily subscription expiry reminder — fires once per day at/after 09:00 for admins
  useEffect(() => {
    if (user?.role === 'admin' && organization?.id) {
      checkAndSendSubscriptionReminder({
        orgId:      organization.id,
        orgName:    organization.name,
        orgLogoUrl: organization.logoUrl,
      });
    }
  }, [user?.role, organization?.id]);

  // Use org-scoped data directly (already filtered by user's organization)
  const assets = data.assets.getAll();
  const allocations = data.allocations.getAll();
  const maintenance = data.maintenance.getAll();
  const repairs = data.repairs.getAll();
  const consumables = data.consumables.getAll();
  const procurements = data.procurements.getAll();
  const users = data.users.getAll();
  const departments = data.departments.getAll();
  const notifications = data.notifications.getAll().filter(n => n.userId === user?.id && !n.isRead);

  // ── Core Metrics ──
  const totalAssets = assets.length;
  const allocatedAssets = assets.filter(a => a.status === 'allocated').length;
  const availableAssets = assets.filter(a => a.status === 'available').length;
  const maintenanceAssets = assets.filter(a => a.status === 'under_maintenance').length;
  const retiredAssets = assets.filter(a => a.status === 'retired').length;
  const disposedAssets = assets.filter(a => a.status === 'disposed').length;
  const allocationRate = totalAssets > 0 ? Math.round((allocatedAssets / totalAssets) * 100) : 0;
  const utilizationRate = totalAssets > 0 ? Math.round(((allocatedAssets + maintenanceAssets) / totalAssets) * 100) : 0;

  // ── Financial Metrics ──
  const totalAssetValue = assets.reduce((sum, a) => sum + a.purchaseCost, 0);
  const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + m.cost, 0);
  const totalRepairCost = repairs.reduce((sum, r) => sum + r.cost, 0);
  const totalProcurementCost = procurements.filter(p => p.status === 'received' || p.status === 'ordered').reduce((sum, p) => sum + (p.actualCost || p.estimatedCost), 0);
  const avgAssetValue = totalAssets > 0 ? totalAssetValue / totalAssets : 0;
  const costOfOwnership = totalMaintenanceCost + totalRepairCost;

  // ── Maintenance Metrics ──
  const maintenanceScheduled = maintenance.filter(m => m.status === 'scheduled').length;
  const maintenanceOverdue = maintenance.filter(m => m.status === 'overdue').length;
  const maintenanceInProgress = maintenance.filter(m => m.status === 'in_progress').length;
  const maintenanceCompleted = maintenance.filter(m => m.status === 'completed').length;
  const maintenanceTotal = maintenance.length;
  const maintenanceComplianceRate = maintenanceTotal > 0 ? Math.round((maintenanceCompleted / maintenanceTotal) * 100) : 0;
  const preventiveMaintenance = maintenance.filter(m => m.type === 'preventive').length;
  const correctiveMaintenance = maintenance.filter(m => m.type === 'corrective').length;
  const preventiveRatio = maintenanceTotal > 0 ? Math.round((preventiveMaintenance / maintenanceTotal) * 100) : 0;

  // ── Repair Metrics ──
  const repairsPending = repairs.filter(r => r.status === 'pending').length;
  const repairsInProgress = repairs.filter(r => r.status === 'in_progress').length;
  const repairsCompleted = repairs.filter(r => r.status === 'completed').length;
  const highPriorityRepairs = repairs.filter(r => (r.priority === 'high' || r.priority === 'critical') && r.status !== 'completed' && r.status !== 'cancelled').length;

  // ── Consumables ──
  const lowStockItems = consumables.filter(c => c.stock <= c.threshold).length;
  const outOfStockItems = consumables.filter(c => c.stock === 0).length;
  const totalConsumableValue = consumables.reduce((sum, c) => sum + (c.stock * c.costPerUnit), 0);

  // ── Warranty & Alerts ──
  const warrantyExpiring30 = assets.filter(a => isExpiringSoon(a.warrantyEnd, 30)).length;
  const warrantyExpiring90 = assets.filter(a => isExpiringSoon(a.warrantyEnd, 90)).length;
  const warrantyExpired = assets.filter(a => a.warrantyEnd && new Date(a.warrantyEnd) < new Date()).length;

  // ── Approvals ──
  const pendingAllocations = allocations.filter(a => a.status === 'pending').length;
  const pendingProcurements = procurements.filter(p => p.status === 'requested').length;
  const totalPendingApprovals = pendingAllocations + pendingProcurements;

  // ── Users ──
  const activeUsers = users.filter(u => u.isActive).length;
  const usersByRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // ── Chart Data ──
  const assetsByStatus = [
    { name: 'Allocated', value: allocatedAssets, color: '#10b981' },
    { name: 'Available', value: availableAssets, color: '#0ea5e9' },
    { name: 'Maintenance', value: maintenanceAssets, color: '#f59e0b' },
    { name: 'Retired', value: retiredAssets, color: '#a3a3a3' },
    { name: 'Disposed', value: disposedAssets, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const assetsByType = Object.entries(
    assets.reduce<Record<string, number>>((acc, a) => {
      const type = a.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const assetsByDept = departments.map(d => ({
    name: d.name.length > 12 ? d.name.substring(0, 12) + '..' : d.name,
    assets: assets.filter(a => a.departmentId === d.id).length,
    value: assets.filter(a => a.departmentId === d.id).reduce((s, a) => s + a.purchaseCost, 0),
  })).filter(d => d.assets > 0).sort((a, b) => b.assets - a.assets);

  const monthlyMaintenance = (() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months.map((month, idx) => {
      const mCost = maintenance
        .filter(m => { const d = new Date(m.completedDate || m.scheduledDate); return d.getMonth() === idx; })
        .reduce((s, m) => s + m.cost, 0);
      const rCost = repairs
        .filter(r => { const d = new Date(r.completionDate || r.createdAt); return d.getMonth() === idx; })
        .reduce((s, r) => s + r.cost, 0);
      return { month, maintenance: mCost, repairs: rCost, total: mCost + rCost };
    });
  })();

  const maintenanceByType = [
    { name: 'Preventive', value: preventiveMaintenance, color: '#10b981' },
    { name: 'Corrective', value: correctiveMaintenance, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // ── Attention Items (things needing action) ──
  const attentionItems = [
    maintenanceOverdue > 0 && { label: `${maintenanceOverdue} overdue maintenance`, severity: 'critical' as const, path: 'maintenance' },
    highPriorityRepairs > 0 && { label: `${highPriorityRepairs} high-priority repairs`, severity: 'high' as const, path: 'repairs' },
    outOfStockItems > 0 && { label: `${outOfStockItems} items out of stock`, severity: 'high' as const, path: 'consumables' },
    warrantyExpiring30 > 0 && { label: `${warrantyExpiring30} warranties expiring in 30 days`, severity: 'medium' as const, path: 'assets' },
    totalPendingApprovals > 0 && { label: `${totalPendingApprovals} pending approvals`, severity: 'low' as const, path: 'allocations' },
    lowStockItems > 0 && { label: `${lowStockItems} items below stock threshold`, severity: 'medium' as const, path: 'consumables' },
  ].filter(Boolean) as { label: string; severity: 'critical' | 'high' | 'medium' | 'low'; path: string }[];

  const severityColor = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-500',
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Here's your asset operations overview</p>
        </div>
        {/* Org name badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
          <Building2 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{organization?.name || 'Your Organization'}</span>
        </div>
      </div>

      {/* Attention Required Banner */}
      {attentionItems.length > 0 && (
        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Needs Your Attention</h3>
            <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500">{attentionItems.length} items</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attentionItems.map((item, i) => (
              <button
                key={i}
                onClick={() => navigate(`/${orgSlug}/${item.path}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                <div className={`w-2 h-2 rounded-full ${severityColor[item.severity]}`} />
                {item.label}
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAssets}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Assets</p>
        </div>

        <div className="card card-gradient p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <select
              value={displayCurrency}
              onChange={e => setDisplayCurrency(e.target.value)}
              className="px-1.5 py-0.5 text-[10px] font-medium border border-gray-200 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAssetValue, displayCurrency)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Value</p>
        </div>

        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{utilizationRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Utilization Rate</p>
        </div>

        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{maintenanceComplianceRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maintenance Compliance</p>
        </div>

        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{repairsPending + repairsInProgress}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Repairs</p>
        </div>

        <div className="card card-gradient p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <UsersIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Users</p>
        </div>
      </div>

      {/* Financial Overview + Asset Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Summary */}
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Financial Summary
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Asset Portfolio</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(totalAssetValue, displayCurrency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Avg. Asset Value</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(avgAssetValue, displayCurrency)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-700/50 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Maintenance Costs</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalMaintenanceCost, displayCurrency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Repair Costs</span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalRepairCost, displayCurrency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Procurement Spend</span>
              <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(totalProcurementCost, displayCurrency)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-700/50 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost of Ownership</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(costOfOwnership, displayCurrency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Consumable Inventory</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(totalConsumableValue, displayCurrency)}</span>
            </div>
          </div>
        </div>

        {/* Asset Distribution Donut */}
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-500" />
            Asset Distribution
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={assetsByStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {assetsByStatus.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{allocationRate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Allocation Rate</p>
          </div>
        </div>

        {/* Operational Health */}
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" />
            Operational Health
          </h3>
          <div className="space-y-4">
            {/* Maintenance Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Maintenance Compliance</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{maintenanceComplianceRate}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-700 rounded-full h-2">
                <div className={`rounded-full h-2 transition-all ${maintenanceComplianceRate >= 80 ? 'bg-emerald-500' : maintenanceComplianceRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${maintenanceComplianceRate}%` }} />
              </div>
            </div>
            {/* Preventive Ratio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Preventive vs Corrective</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{preventiveRatio}% preventive</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-emerald-500 rounded-full h-2 transition-all" style={{ width: `${preventiveRatio}%` }} />
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-700/50 my-2" />
            {/* Quick stat rows */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{maintenanceScheduled}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Scheduled</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{maintenanceOverdue}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Overdue</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{maintenanceInProgress}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">In Progress</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{maintenanceCompleted}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Completed</p>
              </div>
            </div>
            {/* Warranty health */}
            <div className="border-t border-gray-100 dark:border-zinc-700/50 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Warranty Expiring (30d)</span>
              <span className={`text-xs font-semibold ${warrantyExpiring30 > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{warrantyExpiring30}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Warranty Expired</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{warrantyExpired}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-gradient p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            <BoxesIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{lowStockItems}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Low Stock Items</p>
          </div>
        </div>
        <div className="card card-gradient p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalPendingApprovals}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending Approvals</p>
          </div>
        </div>
        <div className="card card-gradient p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{warrantyExpiring90}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Warranty Expiring</p>
          </div>
        </div>
        <div className="card card-gradient p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{pendingProcurements}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Open Procurements</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Cost Trend + Assets by Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Maintenance & Repair Cost Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyMaintenance}>
                <defs>
                  <linearGradient id="gradMaint" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRepair" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any, name?: string) => [`$${value}`, name === 'maintenance' ? 'Maintenance' : 'Repairs']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="maintenance" stroke="#10b981" strokeWidth={2} fill="url(#gradMaint)" />
                <Area type="monotone" dataKey="repairs" stroke="#ef4444" strokeWidth={2} fill="url(#gradRepair)" />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-500" />
            Assets by Department
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetsByDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" strokeOpacity={0.5} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="assets" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Assets by Type + Maintenance by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-violet-500" />
            Asset Portfolio by Type
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={assetsByType} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false} strokeWidth={0}>
                  {assetsByType.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-500" />
            Repair Pipeline
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{repairsPending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending</p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{repairsInProgress}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In Progress</p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{repairsCompleted}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed</p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{highPriorityRepairs}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">High Priority</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Total Repair Cost</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRepairCost, displayCurrency)}</p>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Allocations + Notifications + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Allocations */}
        <div className="card card-gradient">
          <div className="px-6 py-4 border-b border-gray-100/60 dark:border-zinc-700/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-500" />
              Recent Allocations
            </h3>
            <button onClick={() => navigate(`/${orgSlug}/allocations`)} className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-700/30">
            {allocations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No allocations yet</div>
            ) : (
              allocations.slice(-5).reverse().map(a => {
                const asset = assets.find((x: Asset) => x.id === a.assetId);
                const emp = users.find((x: User) => x.id === a.employeeId);
                return (
                  <div key={a.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{asset?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{emp?.name || 'Unknown'} &middot; {formatDate(a.createdAt)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Unread Notifications */}
        <div className="card card-gradient">
          <div className="px-6 py-4 border-b border-gray-100/60 dark:border-zinc-700/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Notifications
              {notifications.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{notifications.length}</span>
              )}
            </h3>
            <button onClick={() => navigate(`/${orgSlug}/notifications`)} className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-700/30">
            {notifications.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">All caught up!</div>
            ) : (
              notifications.slice(0, 5).map(n => (
                <div key={n.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.priority === 'critical' ? 'bg-red-500' : n.priority === 'high' ? 'bg-orange-500' : n.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team & Inventory Summary */}
        <div className="card card-gradient p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-pink-500" />
            Team Overview
          </h3>
          <div className="space-y-3">
            {Object.entries(usersByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{role}s</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-zinc-700/50 my-4" />
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Inventory Snapshot</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Consumable Types</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{consumables.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Out of Stock</span>
              <span className={`text-sm font-semibold ${outOfStockItems > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{outOfStockItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Below Threshold</span>
              <span className={`text-sm font-semibold ${lowStockItems > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{lowStockItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Inventory Value</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(totalConsumableValue, displayCurrency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
