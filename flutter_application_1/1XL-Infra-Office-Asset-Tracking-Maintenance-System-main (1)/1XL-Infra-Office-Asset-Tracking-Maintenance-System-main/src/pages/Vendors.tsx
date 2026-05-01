import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, ConfirmDialog } from '../components/ui';
import { exportToCSV } from '../utils/helpers';
import { Vendor } from '../types';
import { Plus, Download, Star, Trash2, Edit } from 'lucide-react';

export default function Vendors() {
  const { user } = useAuth();
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const emptyForm = { name: '', contactPerson: '', email: '', phone: '', address: '', services: '', warrantyCovered: false, rating: 4 };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const vendors = data.vendors.getAll();

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({ name: v.name, contactPerson: v.contactPerson, email: v.email, phone: v.phone, address: v.address, services: v.services.join(', '), warrantyCovered: v.warrantyCovered, rating: v.rating });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const saveData = {
        name: form.name, contactPerson: form.contactPerson, email: form.email, phone: form.phone,
        address: form.address, services: form.services.split(',').map(s => s.trim()).filter(Boolean),
        warrantyCovered: form.warrantyCovered, rating: form.rating, isActive: true,
        createdAt: editing?.createdAt || new Date().toISOString().split('T')[0],
      };
      if (editing) {
        await data.vendors.update(editing.id, saveData);
        await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Vendors', editing.id, 'Vendor', `Updated vendor: ${form.name}`);
      } else {
        const created = await data.vendors.create(saveData);
        await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Vendors', created?.id || 'new', 'Vendor', `Created vendor: ${form.name}`);
      }
      setShowForm(false); setEditing(null); setForm(emptyForm); setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await data.vendors.remove(deleteTarget.id);
      await data.addAuditLog(user!.id, user!.name, 'DELETE', 'Vendors', deleteTarget.id, 'Vendor', `Deleted vendor: ${deleteTarget.name}`);
      setDeleteTarget(null); setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (v: any) => <span className="font-medium">{v.name}</span> },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'services', label: 'Services', render: (v: any) => (
      <div className="flex gap-1 flex-wrap">{v.services.slice(0, 2).map((s: string, i: number) => (
        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 rounded text-xs">{s}</span>
      ))}{v.services.length > 2 && <span className="text-xs text-gray-400 dark:text-gray-500">+{v.services.length - 2}</span>}</div>
    )},
    { key: 'rating', label: 'Rating', render: (v: any) => (
      <div className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /><span className="text-sm">{v.rating}</span></div>
    )},
    { key: 'warrantyCovered', label: 'Warranty', render: (v: any) => v.warrantyCovered ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-gray-400 dark:text-gray-500 text-xs">No</span> },
    { key: 'actions', label: 'Actions', render: (v: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"><Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(v); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Vendor Management" subtitle="Manage vendors and service providers"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(vendors.map(v => ({ Name: v.name, Contact: v.contactPerson, Email: v.email, Phone: v.phone, Services: v.services.join('; '), Rating: v.rating, Warranty: v.warrantyCovered ? 'Yes' : 'No' })), 'vendors')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
        }
      />

      <div className="card card-gradient p-6">
        <DataTable columns={columns} data={vendors} />
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Vendor' : 'Add Vendor'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Person</label>
              <input type="text" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Services (comma-separated)</label>
            <input type="text" value={form.services} onChange={e => setForm({...form, services: e.target.value})} placeholder="IT Equipment, Networking, Repairs"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating (1-5)</label>
              <input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm({...form, rating: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" /></div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.warrantyCovered} onChange={e => setForm({...form, warrantyCovered: e.target.checked})} className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Warranty Covered</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Add Vendor')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Vendor" message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`} />
    </div>
  );
}
