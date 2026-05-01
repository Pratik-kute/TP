import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, DependencyNotice } from '../components/ui';
import { formatCurrency, exportToCSV } from '../utils/helpers';
import { Consumable } from '../types';
import { Plus, Download, AlertTriangle, Edit, Trash2, Package } from 'lucide-react';
import { sendNotificationEmail, sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';

export default function Consumables() {
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Consumable | null>(null);
  const [showAllocate, setShowAllocate] = useState<Consumable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Consumable | null>(null);

  const emptyForm = { name: '', category: '', stock: 0, threshold: 10, unit: 'pieces', costPerUnit: 0, departmentId: '', locationId: '' };
  const [form, setForm] = useState(emptyForm);
  const [allocForm, setAllocForm] = useState({ employeeId: '', departmentId: '', quantity: 1 });
  const [saving, setSaving] = useState(false);

  const consumables = data.consumables.getAll();
  const departments = data.departments.getAll();
  const locations = data.locations.getAll();
  const users = data.users.getAll();
  const employees = users.filter(u => u.role === 'employee' || u.role === 'manager');

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';
  const getLocName = (id: string) => locations.find(l => l.id === id)?.name || 'N/A';

  const openEdit = (c: Consumable) => {
    setEditing(c);
    setForm({ name: c.name, category: c.category, stock: c.stock, threshold: c.threshold, unit: c.unit, costPerUnit: c.costPerUnit, departmentId: c.departmentId, locationId: c.locationId });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const saveData = { ...form, lastRestocked: new Date().toISOString().split('T')[0], createdAt: editing?.createdAt || new Date().toISOString().split('T')[0] };
      if (editing) {
        await data.consumables.update(editing.id, saveData);
        await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Consumables', editing.id, 'Consumable', `Updated consumable: ${form.name}`);
      } else {
        const created = await data.consumables.create(saveData);
        await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Consumables', created?.id || 'new', 'Consumable', `Created consumable: ${form.name}`);
      }
      setShowForm(false); setEditing(null); setForm(emptyForm); setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleAllocate = async () => {
    if (!showAllocate || !allocForm.employeeId || allocForm.quantity <= 0) return;
    if (allocForm.quantity > showAllocate.stock) return;
    setSaving(true);
    try {
      await data.consumableAllocations.create({
        consumableId: showAllocate.id, employeeId: allocForm.employeeId,
        departmentId: allocForm.departmentId, quantity: allocForm.quantity,
        date: new Date().toISOString().split('T')[0],
      });
      const newStock = showAllocate.stock - allocForm.quantity;
      await data.consumables.update(showAllocate.id, { stock: newStock });
      await data.addAuditLog(user!.id, user!.name, 'ALLOCATE', 'Consumables', showAllocate.id, 'Consumable', `Allocated ${allocForm.quantity} ${showAllocate.unit} of ${showAllocate.name}`);
      const allocEmployee = users.find(u => u.id === allocForm.employeeId);
      const allocEmployeeName = allocEmployee?.name || 'Unknown';
      data.addNotification(user!.id, 'stock', 'Consumable Allocated', `You allocated ${allocForm.quantity}x ${showAllocate.name} to ${allocEmployeeName}.`, 'low').catch(e => console.error('[Notify]', e));
      data.addNotification(allocForm.employeeId, 'stock', 'Consumable Received', `You received ${allocForm.quantity}x ${showAllocate.name} from ${user!.name}.`, 'low').catch(e => console.error('[Notify]', e));
      setShowAllocate(null);
      if (newStock <= showAllocate.threshold) {
        data.notifyByRole(['admin', 'manager'], 'stock', 'Low Stock Alert', `${showAllocate.name} stock (${newStock}) is at or below threshold (${showAllocate.threshold}).`, 'high').catch(e => console.error('[Notify]', e));
        const stockTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
        sendNotificationEmailToMany(stockTargets.map(u => ({email:u.email,name:u.name})), 'low_stock_alert',
          `Low Stock Alert: ${showAllocate.name}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Low Stock Alert',body:ET.lowStockBody(showAllocate.name,newStock,showAllocate.threshold)},
          organization?.id||'');
      } setAllocForm({ employeeId: '', departmentId: '', quantity: 1 }); setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await data.consumables.remove(deleteTarget.id);
      await data.addAuditLog(user!.id, user!.name, 'DELETE', 'Consumables', deleteTarget.id, 'Consumable', `Deleted consumable: ${deleteTarget.name}`);
      setDeleteTarget(null); setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (c: any) => <span className="font-medium">{c.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'stock', label: 'Stock', render: (c: any) => (
      <div className="flex items-center gap-2">
        <span className={c.stock <= c.threshold ? 'text-red-600 font-medium' : ''}>{c.stock} {c.unit}</span>
        {c.stock <= c.threshold && <AlertTriangle className="w-4 h-4 text-red-500" />}
      </div>
    )},
    { key: 'threshold', label: 'Threshold', render: (c: any) => `${c.threshold} ${c.unit}` },
    { key: 'costPerUnit', label: 'Cost/Unit', render: (c: any) => formatCurrency(c.costPerUnit, orgCurrency) },
    { key: 'departmentId', label: 'Department', render: (c: any) => getDeptName(c.departmentId) },
    { key: 'locationId', label: 'Location', render: (c: any) => getLocName(c.locationId) },
    { key: 'actions', label: 'Actions', render: (c: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); setShowAllocate(c); }} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100" title="Allocate">Allocate</button>
        <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"><Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  const lowStockCount = consumables.filter(c => c.stock <= c.threshold).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Consumable Inventory" subtitle={`${consumables.length} items tracked${lowStockCount > 0 ? ` | ${lowStockCount} low stock` : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(consumables.map(c => ({ Name: c.name, Category: c.category, Stock: c.stock, Threshold: c.threshold, Unit: c.unit, CostPerUnit: c.costPerUnit, Department: getDeptName(c.departmentId), Location: getLocName(c.locationId) })), 'consumables')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Consumable
            </button>
          </div>
        }
      />

      <div className="card card-gradient p-6">
        <DataTable columns={columns} data={consumables} />
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Consumable' : 'Add Consumable'} size="lg">
        <div className="space-y-4">
          <DependencyNotice missing={[
            ...(departments.length === 0 ? [{ label: 'Create Departments', path: '/locations', pageName: 'Locations & Departments' }] : []),
            ...(locations.length === 0 ? [{ label: 'Create Locations', path: '/locations', pageName: 'Locations & Departments' }] : []),
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g., Stationery, IT Supplies"
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
              <input type="number" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder Threshold</label>
              <input type="number" value={form.threshold} onChange={e => setForm({...form, threshold: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="e.g., pieces, reams, boxes"
                className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Per Unit ($)</label>
              <input type="number" step="0.01" value={form.costPerUnit} onChange={e => setForm({...form, costPerUnit: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <select value={form.locationId} onChange={e => setForm({...form, locationId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                <option value="">Select location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Saving...' : (editing ? 'Save' : 'Add')}</button>
          </div>
        </div>
      </Modal>

      {/* Allocate Modal */}
      <Modal isOpen={!!showAllocate} onClose={() => setShowAllocate(null)} title={`Allocate: ${showAllocate?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Available: {showAllocate?.stock} {showAllocate?.unit}</p>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
            <select value={allocForm.employeeId} onChange={e => setAllocForm({...allocForm, employeeId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
              <option value="">Select employee</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <select value={allocForm.departmentId} onChange={e => setAllocForm({...allocForm, departmentId: e.target.value})} className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
              <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
            <input type="number" min={1} max={showAllocate?.stock} value={allocForm.quantity} onChange={e => setAllocForm({...allocForm, quantity: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 input-soft rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAllocate(null)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleAllocate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Allocating...' : 'Allocate'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Consumable" message={`Are you sure you want to delete "${deleteTarget?.name}"?`} />
    </div>
  );
}
