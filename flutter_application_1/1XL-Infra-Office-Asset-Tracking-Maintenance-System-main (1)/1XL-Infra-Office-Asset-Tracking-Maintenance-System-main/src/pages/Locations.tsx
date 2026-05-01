import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, ConfirmDialog } from '../components/ui';
import { Location, Department } from '../types';
import { Plus, Edit, Trash2, Building2, MapPin } from 'lucide-react';

export default function Locations() {
  const { user } = useAuth();
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState<'locations' | 'departments'>('locations');

  // Location state
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [deleteLoc, setDeleteLoc] = useState<Location | null>(null);
  const emptyLocForm = { name: '', address: '', city: '', state: '', country: 'USA', floorNo: '' };
  const [locForm, setLocForm] = useState(emptyLocForm);

  // Department state
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const emptyDeptForm = { name: '', managerId: '', locationId: '', description: '', floorNo: '' };
  const [deptForm, setDeptForm] = useState(emptyDeptForm);

  const locations = data.locations.getAll();
  const departments = data.departments.getAll();
  const users = data.users.getAll();
  const assets = data.assets.getAll();
  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'N/A';
  const getLocName = (id: string) => locations.find(l => l.id === id)?.name || 'N/A';

  // Location handlers
  const handleSaveLoc = async () => {
    if (!locForm.name) return;
    setSaving(true); setFormError('');
    try {
      const locData = { ...locForm, isActive: true, createdAt: editingLoc?.createdAt || new Date().toISOString().split('T')[0] };
      if (editingLoc) {
        await data.locations.update(editingLoc.id, locData);
        await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Locations', editingLoc.id, 'Location', `Updated location: ${locForm.name}`);
      } else {
        const created = await data.locations.create(locData);
        await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Locations', created?.id || 'new', 'Location', `Created location: ${locForm.name}`);
      }
      setShowLocForm(false); setEditingLoc(null); setLocForm(emptyLocForm); setRefresh(r => r + 1);
    } catch (err: any) {
      console.error('Failed to save location:', err);
      setFormError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLoc = async () => {
    if (!deleteLoc) return;
    setSaving(true);
    try {
      await data.locations.remove(deleteLoc.id);
      await data.addAuditLog(user!.id, user!.name, 'DELETE', 'Locations', deleteLoc.id, 'Location', `Deleted location: ${deleteLoc.name}`);
      setDeleteLoc(null); setRefresh(r => r + 1);
    } catch (err) {
      console.error('Failed to delete location:', err);
    } finally {
      setSaving(false);
    }
  };

  // Department handlers
  const handleSaveDept = async () => {
    if (!deptForm.name) return;
    setSaving(true); setFormError('');
    try {
      const deptData = { ...deptForm, createdAt: editingDept?.createdAt || new Date().toISOString().split('T')[0] };
      if (editingDept) {
        await data.departments.update(editingDept.id, deptData);
        await data.addAuditLog(user!.id, user!.name, 'UPDATE', 'Departments', editingDept.id, 'Department', `Updated department: ${deptForm.name}`);
      } else {
        const created = await data.departments.create(deptData);
        await data.addAuditLog(user!.id, user!.name, 'CREATE', 'Departments', created?.id || 'new', 'Department', `Created department: ${deptForm.name}`);
      }
      setShowDeptForm(false); setEditingDept(null); setDeptForm(emptyDeptForm); setRefresh(r => r + 1);
    } catch (err: any) {
      console.error('Failed to save department:', err);
      setFormError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deleteDept) return;
    setSaving(true);
    try {
      await data.departments.remove(deleteDept.id);
      await data.addAuditLog(user!.id, user!.name, 'DELETE', 'Departments', deleteDept.id, 'Department', `Deleted department: ${deleteDept.name}`);
      setDeleteDept(null); setRefresh(r => r + 1);
    } catch (err) {
      console.error('Failed to delete department:', err);
    } finally {
      setSaving(false);
    }
  };

  const locColumns = [
    { key: 'name', label: 'Name', render: (l: any) => <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /><span className="font-medium">{l.name}</span></div> },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'country', label: 'Country' },
    { key: 'floorNo', label: 'Floor No.', render: (l: any) => l.floorNo || <span className="text-gray-400 dark:text-gray-600">—</span> },
    { key: 'assets', label: 'Assets', render: (l: any) => assets.filter(a => a.locationId === l.id).length },
    { key: 'depts', label: 'Departments', render: (l: any) => departments.filter(d => d.locationId === l.id).length },
    { key: 'actions', label: '', render: (l: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); setEditingLoc(l); setLocForm({ name: l.name, address: l.address, city: l.city, state: l.state, country: l.country, floorNo: l.floorNo || '' }); setShowLocForm(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"><Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        <button onClick={(e) => { e.stopPropagation(); setDeleteLoc(l); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  const deptColumns = [
    { key: 'name', label: 'Name', render: (d: any) => <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-500" /><span className="font-medium">{d.name}</span></div> },
    { key: 'managerId', label: 'Manager', render: (d: any) => getUserName(d.managerId) },
    { key: 'locationId', label: 'Location', render: (d: any) => getLocName(d.locationId) },
    { key: 'floorNo', label: 'Floor No.', render: (d: any) => d.floorNo || <span className="text-gray-400 dark:text-gray-600">—</span> },
    { key: 'description', label: 'Description', render: (d: any) => <span className="truncate max-w-[200px] block text-gray-500 dark:text-gray-400">{d.description}</span> },
    { key: 'assets', label: 'Assets', render: (d: any) => assets.filter(a => a.departmentId === d.id).length },
    { key: 'employees', label: 'Employees', render: (d: any) => users.filter(u => u.departmentId === d.id).length },
    { key: 'actions', label: '', render: (d: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); setEditingDept(d); setDeptForm({ name: d.name, managerId: d.managerId, locationId: d.locationId, description: d.description, floorNo: d.floorNo || '' }); setShowDeptForm(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"><Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        <button onClick={(e) => { e.stopPropagation(); setDeleteDept(d); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Locations & Departments" subtitle="Manage office locations and departmental structure"
        action={
          <button onClick={() => activeTab === 'locations' ? (setEditingLoc(null), setLocForm(emptyLocForm), setShowLocForm(true)) : (setEditingDept(null), setDeptForm(emptyDeptForm), setShowDeptForm(true))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Add {activeTab === 'locations' ? 'Location' : 'Department'}
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('locations')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'locations' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}>
          Locations ({locations.length})
        </button>
        <button onClick={() => setActiveTab('departments')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'departments' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700'}`}>
          Departments ({departments.length})
        </button>
      </div>

      <div className="card card-gradient p-5">
        {activeTab === 'locations' ? <DataTable columns={locColumns} data={locations} /> : <DataTable columns={deptColumns} data={departments} />}
      </div>

      {/* Location Modal */}
      <Modal isOpen={showLocForm} onClose={() => { setShowLocForm(false); setEditingLoc(null); setFormError(''); }} title={editingLoc ? 'Edit Location' : 'Add Location'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input type="text" value={locForm.address} onChange={e => setLocForm({...locForm, address: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          <div className="grid grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
              <input type="text" value={locForm.city} onChange={e => setLocForm({...locForm, city: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
              <input type="text" value={locForm.state} onChange={e => setLocForm({...locForm, state: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
              <input type="text" value={locForm.country} onChange={e => setLocForm({...locForm, country: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor No.</label>
              <input type="text" placeholder="e.g. G, 1, 2" value={locForm.floorNo} onChange={e => setLocForm({...locForm, floorNo: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowLocForm(false); setEditingLoc(null); setFormError(''); }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">Cancel</button>
            <button onClick={handleSaveLoc} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Saving...' : (editingLoc ? 'Save' : 'Add')}</button>
          </div>
        </div>
      </Modal>

      {/* Department Modal */}
      <Modal isOpen={showDeptForm} onClose={() => { setShowDeptForm(false); setEditingDept(null); setFormError(''); }} title={editingDept ? 'Edit Department' : 'Add Department'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager</label>
            <select value={deptForm.managerId} onChange={e => setDeptForm({...deptForm, managerId: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
              <option value="">Select manager</option>{managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <select value={deptForm.locationId} onChange={e => setDeptForm({...deptForm, locationId: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                <option value="">Select location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor No.</label>
              <input type="text" placeholder="e.g. G, 1, 2" value={deptForm.floorNo} onChange={e => setDeptForm({...deptForm, floorNo: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" /></div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowDeptForm(false); setEditingDept(null); setFormError(''); }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">Cancel</button>
            <button onClick={handleSaveDept} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{saving ? 'Saving...' : (editingDept ? 'Save' : 'Add')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteLoc} onClose={() => setDeleteLoc(null)} onConfirm={handleDeleteLoc} title="Delete Location" message={`Delete "${deleteLoc?.name}"? Associated assets and departments may be affected.`} />
      <ConfirmDialog isOpen={!!deleteDept} onClose={() => setDeleteDept(null)} onConfirm={handleDeleteDept} title="Delete Department" message={`Delete "${deleteDept?.name}"? Associated users and assets may be affected.`} />
    </div>
  );
}
