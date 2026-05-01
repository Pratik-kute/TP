import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, DataTable, Modal, ConfirmDialog } from '../components/ui';
import { formatDate, exportToCSV } from '../utils/helpers';
import { Document } from '../types';
import { uploadDocument, deleteDocument } from '../lib/storage';
import {
  Plus, Download, FileText, Trash2, File, FileImage, FileSpreadsheet,
  Upload, ExternalLink, Paperclip,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function Documents() {
  const { user, organization } = useAuth();
  const data = useData();
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'other' as Document['type'],
    description: '',
    assetId: '',
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const documents = data.documents.getAll();
  const assets = data.assets.getAll();
  const users = data.users.getAll();

  const filtered = typeFilter === 'all' ? documents : documents.filter(d => d.type === typeFilter);

  const getAssetName = (id: string) => {
    if (!id) return '';
    const a = assets.find(a => a.id === id);
    return a ? `${a.assetTag} - ${a.name}` : '';
  };
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    // Auto-fill name from filename if empty
    if (!form.name) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setForm(f => ({ ...f, name: nameWithoutExt }));
    }
  };

  const handleCreate = async () => {
    if (!form.name || !pendingFile) return;
    setSaving(true);
    try {
      let fileUrl = '';
      const fileSize = formatFileSize(pendingFile.size);

      if (organization) {
        fileUrl = await uploadDocument(organization.id, pendingFile);
      }

      await data.documents.create({
        assetId: form.assetId || null as any,
        name: form.name,
        type: form.type,
        description: form.description,
        fileSize,
        fileUrl,
        fileName: pendingFile.name,
        uploadedBy: user!.id,
        createdAt: new Date().toISOString(),
      });

      await data.addAuditLog(
        user!.id, user!.name, 'CREATE', 'Documents', '',
        'Document', `Uploaded document: ${form.name} (${fileSize})`
      );

      setShowAdd(false);
      setForm({ name: '', type: 'other', description: '', assetId: '' });
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setRefresh(r => r + 1);
    } catch (err: any) {
      console.error('Document upload failed:', err);
      alert('Upload failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      // Delete the file from storage if URL exists
      if (deleteTarget.fileUrl) {
        await deleteDocument(deleteTarget.fileUrl);
      }
      await data.documents.remove(deleteTarget.id);
      await data.addAuditLog(
        user!.id, user!.name, 'DELETE', 'Documents', deleteTarget.id,
        'Document', `Deleted document: ${deleteTarget.name}`
      );
      setDeleteTarget(null);
      setRefresh(r => r + 1);
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warranty': return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'invoice': return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'manual': return <File className="w-4 h-4 text-purple-500" />;
      case 'service_report': return <FileImage className="w-4 h-4 text-orange-500" />;
      case 'purchase_order': return <FileText className="w-4 h-4 text-blue-500" />;
      default: return <File className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const columns = [
    { key: 'name', label: 'Document', render: (d: any) => (
      <div className="flex items-center gap-2">
        {getTypeIcon(d.type)}
        <div className="min-w-0">
          <span className="font-medium block truncate">{d.name}</span>
          {d.fileName && <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">{d.fileName}</span>}
        </div>
      </div>
    )},
    { key: 'type', label: 'Type', render: (d: any) => (
      <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 rounded text-xs capitalize">{d.type.replace(/_/g, ' ')}</span>
    )},
    { key: 'assetId', label: 'Linked Asset', render: (d: any) => {
      const name = getAssetName(d.assetId);
      return name ? <span className="text-sm text-gray-600 dark:text-gray-400">{name}</span> : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
    }},
    { key: 'description', label: 'Description', render: (d: any) => <span className="truncate max-w-[200px] block text-gray-500 dark:text-gray-400">{d.description || '—'}</span> },
    { key: 'fileSize', label: 'Size', render: (d: any) => <span className="text-xs text-gray-500 dark:text-gray-400">{d.fileSize || '—'}</span> },
    { key: 'uploadedBy', label: 'Uploaded By', render: (d: any) => getUserName(d.uploadedBy) },
    { key: 'createdAt', label: 'Date', render: (d: any) => formatDate(d.createdAt) },
    { key: 'actions', label: '', render: (d: any) => (
      <div className="flex items-center gap-1">
        {d.fileUrl && (
          <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors" title="View / Download">
            <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </a>
        )}
        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); }}
          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    )},
  ];

  const typeFilters = ['all', 'warranty', 'invoice', 'manual', 'service_report', 'purchase_order', 'other'];

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Documents" subtitle={`${documents.length} document${documents.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(documents.map(d => ({
              Name: d.name,
              Type: d.type.replace(/_/g, ' '),
              'Linked Asset': getAssetName(d.assetId) || 'None',
              Description: d.description,
              Size: d.fileSize,
              'Uploaded By': getUserName(d.uploadedBy),
              Date: d.createdAt,
            })), 'documents')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Upload Document
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {typeFilters.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg capitalize ${
              typeFilter === t
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5'
            }`}>
            {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="card card-gradient p-5">
        <DataTable columns={columns} data={filtered} emptyMessage="No documents uploaded yet. Click 'Upload Document' to add one." />
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setPendingFile(null); setForm({ name: '', type: 'other', description: '', assetId: '' }); }} title="Upload Document" size="lg">
        <div className="space-y-4">
          {/* File Drop Zone */}
          <div>
            <label className={labelCls}>File *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                pendingFile
                  ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10 dark:border-emerald-600'
                  : 'border-gray-300 dark:border-zinc-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-900/5'
              }`}
            >
              {pendingFile ? (
                <>
                  <Paperclip className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{pendingFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatFileSize(pendingFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline mt-1"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Click to select a file</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">PDF, Word, Excel, Image, or any file type</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Document Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g., Employee Handbook" />
            </div>
            <div>
              <label className={labelCls}>Document Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Document['type'] })} className={inputCls}>
                <option value="warranty">Warranty</option>
                <option value="invoice">Invoice</option>
                <option value="manual">Manual</option>
                <option value="service_report">Service Report</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Link to Asset <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <select value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} className={inputCls}>
              <option value="">No asset linked</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.assetTag} - {a.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls}
              placeholder="Brief description of this document..." />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setShowAdd(false); setPendingFile(null); setForm({ name: '', type: 'other', description: '', assetId: '' }); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving || !pendingFile || !form.name}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Document" message={`Delete "${deleteTarget?.name}"? The file will be permanently removed. This cannot be undone.`} />
    </div>
  );
}
