import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Asset, AssetType, AssetStatus, AssetUse, AuditLog } from '../types';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { PageHeader, Modal, StatusBadge, ConfirmDialog, DependencyNotice } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime, exportToCSV } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useOrgSlug } from '../hooks/useOrgSlug';
import { generateAssetTag as genTag, isTagAvailable } from '../utils/assetTagHelper';
import { computeAssetDiff } from '../utils/auditDiff';
import { uploadInvoice, uploadAssetImage, deleteStorageFile } from '../lib/storage';
import { sendNotificationEmailToMany } from '../lib/notificationEmailService';
import * as ET from '../lib/emailTemplates';
import AssetAuditTimeline from '../components/AssetAuditTimeline';
import ActivityLogModal from '../components/ActivityLogModal';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import {
  Plus, Download, Edit, Trash2, Upload, FileDown, CheckCircle, XCircle, PlusCircle,
  QrCode, FileText, ExternalLink, ScrollText, AlertTriangle, ChevronDown, ArrowRight, Eye, UserPlus, ImageIcon, Pencil, X, Printer,
  Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown
} from 'lucide-react';

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'it_equipment', label: 'IT Equipment' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'hvac', label: 'HVAC / Climate' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
];

const ASSET_STATUSES: { value: AssetStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'in_use', label: 'In Use (Shared)' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'dead', label: 'Dead' },
];

const USEFUL_LIFE_DEFAULTS: Record<AssetType, number> = {
  it_equipment: 3,
  furniture: 10,
  vehicle: 5,
  electronics: 5,
  office_equipment: 5,
  hvac: 10,
  infrastructure: 15,
  other: 5,
};

// Salvage value as % of purchase cost (industry standard defaults)
const SALVAGE_PERCENT: Record<AssetType, number> = {
  it_equipment: 10,
  furniture: 5,
  vehicle: 15,
  electronics: 10,
  office_equipment: 10,
  hvac: 5,
  infrastructure: 5,
  other: 10,
};

const TYPE_CATEGORIES: Record<AssetType, string[]> = {
  it_equipment: [
    'Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse',
    'Mouse Pad', 'Printer', 'Scanner', 'Projector', 'Router / Switch',
    'Firewall', 'UPS', 'Tablet', 'Phone / Mobile', 'Webcam',
    'Headphone', 'Speaker', 'External Drive', 'Docking Station',
    'Cable / Accessory', 'Other',
  ],
  furniture: [
    'Chair', 'Desk', 'Table', 'Conference Table', 'Cabinet',
    'Bookshelf', 'Sofa', 'Locker', 'Whiteboard', 'Other',
  ],
  vehicle: ['Car', 'Van', 'Truck', 'Motorcycle', 'Bus', 'Other'],
  electronics: [
    'TV / Display', 'Camera', 'Video Conferencing System',
    'Air Purifier', 'Water Dispenser', 'Microwave', 'Refrigerator', 'Other',
  ],
  office_equipment: [
    'Printer', 'Copier', 'Shredder', 'Fax Machine', 'Telephone',
    'Binding Machine', 'Laminator', 'Other',
  ],
  hvac: [
    'Air Conditioner', 'Heater', 'Ceiling Fan', 'Exhaust Fan',
    'Air Cooler', 'Ventilation System', 'Other',
  ],
  infrastructure: [
    'CCTV Camera', 'Fire Extinguisher', 'Access Control System',
    'Elevator', 'Generator', 'UPS / Battery Backup',
    'Network Infrastructure', 'Other',
  ],
  other: ['General', 'Other'],
};

interface AssetFieldConfig {
  showBrand: boolean;
  showModel: boolean;
  showSerialNumber: boolean;
  showWarranty: boolean;
  showDepreciation: boolean;
  showDescription: boolean;
  showITSpecs: boolean;
  showScreenSize: boolean;
  showConfiguration: boolean;
  configLabel: string;
  serialLabel: string;
}

function getFieldConfig(type: AssetType, category: string): AssetFieldConfig {
  const defaults: AssetFieldConfig = {
    showBrand: true,
    showModel: true,
    showSerialNumber: true,
    showWarranty: true,
    showDepreciation: true,
    showDescription: true,
    showITSpecs: false,
    showScreenSize: false,
    showConfiguration: false,
    configLabel: 'Specifications / Notes',
    serialLabel: 'Serial Number',
  };
  switch (type) {
    case 'it_equipment': {
      const itSpec = new Set(['Laptop', 'Desktop', 'Server', 'Tablet', 'Phone / Mobile']);
      const screen = new Set(['Laptop', 'Tablet', 'Monitor', 'Phone / Mobile']);
      const config = new Set(['Router / Switch', 'Firewall', 'Server', 'UPS']);
      return {
        ...defaults,
        showITSpecs: itSpec.has(category),
        showScreenSize: screen.has(category),
        showConfiguration: config.has(category),
        configLabel: 'Network Config / Specs',
      };
    }
    case 'furniture':
      return { ...defaults, showModel: false, showSerialNumber: false, showWarranty: false };
    case 'vehicle':
      return {
        ...defaults,
        showConfiguration: true,
        configLabel: 'Registration / Notes',
        serialLabel: 'Registration / VIN',
      };
    case 'electronics': {
      const screen = new Set(['TV / Display']);
      return { ...defaults, showScreenSize: screen.has(category) };
    }
    case 'hvac':
      return { ...defaults, showConfiguration: true, configLabel: 'Capacity / Specifications' };
    case 'infrastructure':
      return { ...defaults, showConfiguration: true, configLabel: 'Specifications' };
    case 'office_equipment':
    case 'other':
    default:
      return defaults;
  }
}

interface AssetFormData {
  name: string;
  type: AssetType;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  locationId: string;
  departmentId: string;
  purchaseDate: string;
  purchaseCost: number;
  currency: string;
  warrantyStart: string;
  warrantyEnd: string;
  status: AssetStatus;
  assetUse: AssetUse | '';
  vendorId: string;
  description: string;
  usefulLifeYears: number;
  salvageValue: number;
  processor: string;
  ram: string;
  storage: string;
  graphicsCard: string;
  screenSize: string;
  deviceName: string;
  configuration: string;
}

const emptyForm: AssetFormData = {
  name: '',
  type: 'it_equipment',
  category: '',
  brand: '',
  model: '',
  serialNumber: '',
  locationId: '',
  departmentId: '',
  purchaseDate: '',
  purchaseCost: 0,
  currency: 'USD',
  warrantyStart: '',
  warrantyEnd: '',
  status: 'available',
  assetUse: '',
  vendorId: '',
  description: '',
  usefulLifeYears: 5,
  salvageValue: 0,
  processor: '',
  ram: '',
  storage: '',
  graphicsCard: '',
  screenSize: '',
  deviceName: '',
  configuration: '',
};

// ---- Main Assets page ----
export default function Assets() {
  const { user, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const orgSlug = useOrgSlug();
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AssetFormData>(emptyForm);
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickEditAssetId, setQuickEditAssetId] = useState<string | null>(null);
  const [quickEditSaving, setQuickEditSaving] = useState<string | null>(null);

  // ---- Table state (sorting, search, pagination, inline editing) ----
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [inlineEditCell, setInlineEditCell] = useState<{ assetId: string; field: string } | null>(null);
  const [inlineEditSaving, setInlineEditSaving] = useState<string | null>(null);

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
      if (allSelected) {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      }
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  // Columns that handle their own rendering (action buttons or built-in edit UI)
  const ACTION_COLUMNS = new Set(['invoiceUrl', 'qr', 'audit', 'assetUse']);

  const handleInlineFieldSave = async (assetId: string, field: string, value: string) => {
    setInlineEditSaving(assetId);
    setInlineEditCell(null);
    try {
      if (field === 'name') await data.assets.update(assetId, { name: value });
      else if (field === 'assetTag') await data.assets.update(assetId, { assetTag: value });
      else if (field === 'type') await data.assets.update(assetId, { type: value as any });
      else if (field === 'category') await data.assets.update(assetId, { category: value });
      else if (field === 'brand') await data.assets.update(assetId, { brand: value });
      else if (field === 'status') await data.assets.update(assetId, { status: value as any });
      else if (field === 'locationId') await data.assets.update(assetId, { locationId: value || undefined });
      else if (field === 'assetUse') await data.assets.update(assetId, { assetUse: (value as AssetUse) || null });
      else if (field === 'purchaseCost') await data.assets.update(assetId, { purchaseCost: parseFloat(value) || 0 });
      else if (field === 'createdAt') { /* createdAt is read-only */ }

      await data.addAuditLog(user!.id, user!.name, `Quick updated ${field}`, 'Assets', assetId, 'Asset',
        `Updated ${field} for asset ${assetId}`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Inline field save failed:', err);
    } finally {
      setInlineEditSaving(null);
    }
  };

  const inlineSelectCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[130px]';
  const inlineInputCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[120px]';

  const renderInlineEdit = (field: string, item: Record<string, unknown>) => {
    const assetId = String(item.id);
    if (field === 'status') {
      return (
        <select autoFocus value={String(item.status || '')} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(assetId, 'status', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          {['available','allocated','in_use','under_maintenance','retired','disposed','dead'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
    if (field === 'type') {
      return (
        <select autoFocus value={String(item.type || '')} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(assetId, 'type', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      );
    }
    if (field === 'locationId') {
      return (
        <select autoFocus value={String(item.locationId || '')} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(assetId, 'locationId', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">No location</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      );
    }
    if (field === 'assetUse') {
      return (
        <select autoFocus value={String(item.assetUse || '')} className={inlineSelectCls}
          onChange={e => handleInlineFieldSave(assetId, 'assetUse', e.target.value)}
          onBlur={() => setInlineEditCell(null)}>
          <option value="">Not specified</option>
          <option value="personal">Personal Use</option>
          <option value="common">Common Use</option>
        </select>
      );
    }
    if (field === 'purchaseCost') {
      return (
        <input autoFocus type="number" step="0.01" defaultValue={Number(item.purchaseCost) || 0}
          className={`${inlineInputCls} w-[100px]`}
          onKeyDown={e => {
            if (e.key === 'Enter') handleInlineFieldSave(assetId, field, (e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setInlineEditCell(null);
          }}
          onBlur={e => handleInlineFieldSave(assetId, field, e.target.value)}
        />
      );
    }
    if (field === 'createdAt') {
      return (
        <input autoFocus type="date" defaultValue={String(item.createdAt ?? '').split('T')[0]}
          className={inlineInputCls} disabled
          onBlur={() => setInlineEditCell(null)}
        />
      );
    }
    // Text fields: name, assetTag, category, brand
    return (
      <input autoFocus type="text" defaultValue={String(item[field] ?? '')}
        className={inlineInputCls}
        onKeyDown={e => {
          if (e.key === 'Enter') handleInlineFieldSave(assetId, field, (e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setInlineEditCell(null);
        }}
        onBlur={e => handleInlineFieldSave(assetId, field, e.target.value)}
      />
    );
  };

  // Bulk import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsed, setBulkParsed] = useState<Record<string, string>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccess, setBulkSuccess] = useState(0);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New: sheet & header mapping state
  const [bulkStep, setBulkStep] = useState<'upload' | 'sheet' | 'mapping' | 'preview' | 'importing'>('upload');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  // Custom columns: file headers the user wants to import as custom_fields JSONB
  const [customColumns, setCustomColumns] = useState<Set<string>>(new Set());

  // QR code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrAsset, setQRAsset] = useState<Asset | null>(null);

  // Audit modal state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditAsset, setAuditAsset] = useState<Asset | null>(null);

  // Invoice upload state
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const formInvoiceInputRef = useRef<HTMLInputElement>(null);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);

  // Image upload state
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [pendingImagePreviews, setPendingImagePreviews] = useState<string[]>([]);
  const [pendingInvoiceFiles, setPendingInvoiceFiles] = useState<File[]>([]);

  const locations = useMemo(() => data.locations.getAll(), [refreshKey]);
  const departments = useMemo(() => data.departments.getAll(), [refreshKey]);
  const vendors = useMemo(() => data.vendors.getAll(), [refreshKey]);

  const assets = useMemo(() => {
    const all = data.assets.getAll();
    if (statusFilter === 'all') return all;
    return all.filter(a => a.status === statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, refreshKey]);

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'N/A';
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || 'N/A';
  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || 'N/A';

  // Smart asset tag generation
  const generateSmartTag = useCallback((category: string): string => {
    const existingTags = data.assets.getAll().map(a => a.assetTag);
    const deletedTags = data.deletedAssetTags.getAll().map(t => t.assetTag);
    return genTag(category, organization?.shortName || 'ORG', existingTags, deletedTags);
  }, [data, organization]);

  // Invoice upload handler (used from table column to add a single invoice)
  const handleInvoiceUpload = useCallback(async (assetId: string, file: File) => {
    if (!organization) return;
    setUploadingInvoiceId(assetId);
    try {
      const url = await uploadInvoice(organization.id, assetId, file);
      const asset = data.assets.getById(assetId);
      const existing = asset?.invoiceUrls?.length ? asset.invoiceUrls
        : asset?.invoiceUrl ? [asset.invoiceUrl] : [];
      await data.assets.update(assetId, { invoiceUrls: [...existing, url] } as Partial<Asset>);
      await data.addAuditLog(
        user?.id || '', user?.name || '', 'Updated', 'Assets', assetId, 'Asset',
        `Uploaded invoice for asset`
      );
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error('Invoice upload failed:', err);
    } finally {
      setUploadingInvoiceId(null);
    }
  }, [organization, data, user]);

  // Image upload handler (used from detail modal to add images to an existing asset)
  const handleImageUpload = useCallback(async (assetId: string, files: File[]) => {
    if (!organization || !files.length) return;
    setUploadingImageId(assetId);
    try {
      const asset = data.assets.getById(assetId);
      const existing = asset?.imageUrls?.length ? asset.imageUrls
        : asset?.imageUrl ? [asset.imageUrl] : [];
      const newUrls: string[] = [];
      for (const file of files) {
        const url = await uploadAssetImage(organization.id, assetId, file);
        newUrls.push(url);
      }
      const allUrls = [...existing, ...newUrls];
      const updated = await data.assets.update(assetId, { imageUrls: allUrls } as Partial<Asset>);
      if (updated) setSelectedAsset(updated);
      await data.addAuditLog(user?.id || '', user?.name || '', 'Updated', 'Assets', assetId, 'Asset', `Added ${newUrls.length} image(s)`);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error('Image upload failed:', err);
    } finally {
      setUploadingImageId(null);
    }
  }, [organization, data, user]);

  // Upload pending images/invoices after asset creation (fire-and-forget)
  const uploadPendingFiles = useCallback(async (assetId: string) => {
    if (!organization) return;
    // Images
    if (pendingImageFiles.length) {
      const urls: string[] = [];
      for (const file of pendingImageFiles) {
        try { urls.push(await uploadAssetImage(organization.id, assetId, file)); }
        catch (err) { console.error('Image upload failed:', err); }
      }
      if (urls.length) await data.assets.update(assetId, { imageUrls: urls } as Partial<Asset>);
      setPendingImageFiles([]);
      setPendingImagePreviews([]);
    }
    // Invoices
    if (pendingInvoiceFiles.length) {
      const urls: string[] = [];
      for (const file of pendingInvoiceFiles) {
        try { urls.push(await uploadInvoice(organization.id, assetId, file)); }
        catch (err) { console.error('Invoice upload failed:', err); }
      }
      if (urls.length) await data.assets.update(assetId, { invoiceUrls: urls } as Partial<Asset>);
      setPendingInvoiceFiles([]);
    }
  }, [pendingImageFiles, pendingInvoiceFiles, organization, data]);

  // QR code download
  const downloadQR = useCallback((asset: Asset) => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `QR-${asset.assetTag}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  const columns = [
    { key: 'assetTag', label: 'Asset Tag' },
    { key: 'name', label: 'Name' },
    {
      key: 'createdAt',
      label: 'Date Added',
      render: (item: Record<string, unknown>) => item.createdAt ? formatDateTime(String(item.createdAt)) : '-',
    },
    {
      key: 'type',
      label: 'Type',
      render: (item: Record<string, unknown>) =>
        String(item.type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item: Record<string, unknown>) =>
        String(item.category || '').replace(/\b\w/g, c => c.toUpperCase()),
    },
    { key: 'brand', label: 'Brand' },
    {
      key: 'locationId',
      label: 'Location',
      render: (item: Record<string, unknown>) => getLocationName(String(item.locationId)),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: Record<string, unknown>) => <StatusBadge status={String(item.status)} />,
    },
    {
      key: 'assetUse',
      label: 'Asset Use',
      render: (item: Record<string, unknown>) => {
        const assetId = String(item.id);
        const use = item.assetUse as string | null | undefined;
        const isActive = quickEditAssetId === assetId;
        const isSaving = quickEditSaving === assetId;

        const badge = !use
          ? <span className="text-gray-400 dark:text-gray-600">—</span>
          : use === 'personal'
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Personal</span>
          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Common</span>;

        if (isActive) {
          return (
            <div onClick={e => e.stopPropagation()}>
              <select
                autoFocus
                value={use || ''}
                className="px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[130px]"
                onChange={async e => {
                  const val = e.target.value as AssetUse | '';
                  setQuickEditAssetId(null);
                  setQuickEditSaving(assetId);
                  try {
                    await data.assets.update(assetId, { assetUse: (val as AssetUse) || null });
                    await data.addAuditLog(user!.id, user!.name, 'Updated', 'Assets', assetId, 'Asset', `Changed asset use to "${val || 'not set'}" on "${String(item.name)}"`);
                    setRefreshKey(k => k + 1);
                  } catch (err) { console.error(err); }
                  finally { setQuickEditSaving(null); }
                }}
                onBlur={() => setQuickEditAssetId(null)}
              >
                <option value="">Not specified</option>
                <option value="personal">Personal Use</option>
                <option value="common">Common Use</option>
              </select>
            </div>
          );
        }

        return (
          <div
            className="group inline-flex items-center gap-1 cursor-pointer"
            onClick={e => { e.stopPropagation(); if (!isSaving) setQuickEditAssetId(assetId); }}
          >
            {badge}
            {isSaving
              ? <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
              : <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        );
      },
    },
    {
      key: 'invoiceUrl',
      label: 'Invoice',
      sortable: false,
      render: (item: Record<string, unknown>) => {
        const invoiceUrls = ((item.invoiceUrls as string[] | undefined)?.filter(Boolean) ||
          (item.invoiceUrl ? [item.invoiceUrl as string] : []));
        const assetId = String(item.id);
        if (uploadingInvoiceId === assetId) {
          return <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />;
        }
        return (
          <div className="flex items-center gap-1">
            {invoiceUrls.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); window.open(invoiceUrls[0], '_blank'); }}
                className="relative p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                title={`View invoice (${invoiceUrls.length} file${invoiceUrls.length > 1 ? 's' : ''})`}
              >
                <FileText className="w-4 h-4 text-green-600" />
                {invoiceUrls.length > 1 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
                    {invoiceUrls.length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.jpg,.jpeg,.png';
                input.onchange = (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (file) handleInvoiceUpload(assetId, file);
                };
                input.click();
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
              title="Upload Invoice"
            >
              <Upload className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        );
      },
    },
    {
      key: 'qr',
      label: 'QR',
      sortable: false,
      render: (item: Record<string, unknown>) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const asset = data.assets.getById(String(item.id));
            if (asset) { setQRAsset(asset); setShowQRModal(true); }
          }}
          className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
          title="Show QR Code"
        >
          <QrCode className="w-4 h-4 text-emerald-600" />
        </button>
      ),
    },
    {
      key: 'audit',
      label: 'Audit',
      sortable: false,
      render: (item: Record<string, unknown>) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const asset = data.assets.getById(String(item.id));
            if (asset) { setAuditAsset(asset); setShowAuditModal(true); }
          }}
          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
          title="View Audit History"
        >
          <ScrollText className="w-4 h-4 text-amber-500" />
        </button>
      ),
    },
    {
      key: 'purchaseCost',
      label: 'Purchase Cost',
      render: (item: Record<string, unknown>) => formatCurrency(Number(item.purchaseCost), orgCurrency),
    },
  ];

  function openCreateModal() {
    const defaultCurrency = data.systemConfig.get()?.currency || 'USD';
    setFormData({ ...emptyForm, currency: defaultCurrency });
    setSelectedAsset(null);
    setIsEditing(false);
    setPendingImageFiles([]);
    setPendingImagePreviews([]);
    setPendingInvoiceFiles([]);
    setShowCreateModal(true);
  }

  function openDetailModal(item: Record<string, unknown>) {
    const asset = data.assets.getById(String(item.id));
    if (!asset) return;
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      type: asset.type,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serialNumber,
      locationId: asset.locationId,
      departmentId: asset.departmentId,
      purchaseDate: asset.purchaseDate,
      purchaseCost: asset.purchaseCost,
      currency: asset.currency || data.systemConfig.get()?.currency || 'USD',
      warrantyStart: asset.warrantyStart,
      warrantyEnd: asset.warrantyEnd,
      status: asset.status,
      assetUse: asset.assetUse || '',
      vendorId: asset.vendorId,
      description: asset.description,
      usefulLifeYears: asset.usefulLifeYears,
      salvageValue: asset.salvageValue,
      processor: asset.processor || '',
      ram: asset.ram || '',
      storage: asset.storage || '',
      graphicsCard: asset.graphicsCard || '',
      screenSize: asset.screenSize || '',
      deviceName: asset.deviceName || '',
      configuration: asset.configuration || '',
    });
    setIsEditing(false);
    setShowDetailModal(true);
  }

  const isFormValid = formData.name && formData.locationId && formData.departmentId && formData.purchaseDate;

  async function handleCreate() {
    if (!isFormValid) return;
    setCreateError('');
    setSaving(true);
    try {
      const assetTag = generateSmartTag(formData.category);
      const now = new Date().toISOString();
      const newAsset = await data.assets.create({
        assetTag,
        ...formData,
        assetUse: (formData.assetUse as AssetUse) || null,
        createdAt: now,
        updatedAt: now,
      });
      await data.addAuditLog(
        user?.id || '',
        user?.name || '',
        'Created',
        'Assets',
        newAsset.id,
        'Asset',
        `Created asset "${formData.name}" with tag ${assetTag}`
      );
      // Upload any pending images / invoices
      if (pendingImageFiles.length || pendingInvoiceFiles.length) {
        uploadPendingFiles(newAsset.id).catch(e => console.error('[Upload]', e));
      }
      setShowCreateModal(false);
      data.addNotification(user!.id, 'asset', 'Asset Created', `You added "${formData.name}" (${assetTag}) to the inventory.`, 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'asset', 'New Asset Added', `"${formData.name}" (${assetTag}) has been added to the inventory.`, 'low', user?.id).catch(e => console.error('[Notify]', e));
      const emailTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role) && u.id !== user!.id);
      sendNotificationEmailToMany(emailTargets.map(u => ({email:u.email,name:u.name})), 'asset_created',
        `New Asset Added: ${formData.name}`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'New Asset Registered',body:ET.assetCreatedBody(formData.name,assetTag,formData.category,getLocationName(formData.locationId),user!.name)},
        organization?.id||'');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create asset. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedAsset) return;
    setCreateError('');
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Upload pending images
      let imageUrls = selectedAsset.imageUrls?.length ? [...selectedAsset.imageUrls]
        : selectedAsset.imageUrl ? [selectedAsset.imageUrl] : [];
      if (pendingImageFiles.length && organization) {
        for (const file of pendingImageFiles) {
          try { imageUrls.push(await uploadAssetImage(organization.id, selectedAsset.id, file)); }
          catch (err) { console.error('Image upload failed:', err); }
        }
        setPendingImageFiles([]);
        setPendingImagePreviews([]);
      }

      // Upload pending invoices
      let invoiceUrls = selectedAsset.invoiceUrls?.length ? [...selectedAsset.invoiceUrls]
        : selectedAsset.invoiceUrl ? [selectedAsset.invoiceUrl] : [];
      if (pendingInvoiceFiles.length && organization) {
        for (const file of pendingInvoiceFiles) {
          try { invoiceUrls.push(await uploadInvoice(organization.id, selectedAsset.id, file)); }
          catch (err) { console.error('Invoice upload failed:', err); }
        }
        setPendingInvoiceFiles([]);
      }

      // Compute field-level diffs for audit trail
      const changes = computeAssetDiff(selectedAsset, { ...formData, assetUse: (formData.assetUse as AssetUse) || null }, {
        locationName: (id: string) => locations.find(l => l.id === id)?.name || id || 'None',
        departmentName: (id: string) => departments.find(d => d.id === id)?.name || id || 'None',
        vendorName: (id: string) => vendors.find(v => v.id === id)?.name || id || 'None',
      });

      await data.assets.update(selectedAsset.id, {
        ...formData,
        assetUse: (formData.assetUse as AssetUse) || null,
        imageUrls,
        invoiceUrls,
        updatedAt: now,
      });

      const changedFields = changes.length > 0
        ? changes.map(c => c.fieldLabel).join(', ')
        : 'No field changes';

      await data.addAuditLog(
        user?.id || '',
        user?.name || '',
        'Updated',
        'Assets',
        selectedAsset.id,
        'Asset',
        `Updated ${changedFields} on "${formData.name}" (${selectedAsset.assetTag})`,
        changes
      );
      setShowDetailModal(false);
      setIsEditing(false);
      // Actor notification for update
      const tag = selectedAsset.assetTag;
      data.addNotification(user!.id, 'asset', 'Asset Updated', `You updated "${formData.name}" (${tag}).`, 'low').catch(e => console.error('[Notify]', e));
      // Fire-and-forget notifications for key changes
      if (selectedAsset.status !== formData.status) {
        data.notifyByRole(['admin', 'manager', 'employee'], 'asset', 'Asset Status Changed', `"${formData.name}" (${tag}) status changed from ${selectedAsset.status} to ${formData.status}.`, 'medium').catch(e => console.error('[Notify]', e));
        const statusTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager','employee'].includes(u.role));
        sendNotificationEmailToMany(statusTargets.map(u => ({email:u.email,name:u.name})), 'asset_status_changed',
          `Asset Status Changed: ${formData.name}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Status Updated',body:ET.assetStatusChangedBody(formData.name,tag,selectedAsset.status,formData.status,user!.name)},
          organization?.id||'');
      }
      // Check if assignedEmployee changed (via changes diff)
      const ownerChange = changes.find(c => c.field === 'assignedEmployee');
      if (ownerChange) {
        data.notifyByRole(['admin', 'manager'], 'asset', 'Asset Owner Changed', `"${formData.name}" (${tag}) reassigned from ${ownerChange.oldValue || 'Unassigned'} to ${ownerChange.newValue || 'Unassigned'}.`, 'medium', user?.id).catch(e => console.error('[Notify]', e));
        const ownerTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
        sendNotificationEmailToMany(ownerTargets.map(u => ({email:u.email,name:u.name})), 'asset_owner_changed',
          `Asset Owner Changed: ${formData.name}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Ownership Updated',body:ET.assetOwnerChangedBody(formData.name,tag,String(ownerChange.newValue || 'Unassigned'),user!.name)},
          organization?.id||'');
      }
      if (selectedAsset.locationId !== formData.locationId) {
        const prev = locations.find(l => l.id === selectedAsset.locationId)?.name || 'None';
        const next = locations.find(l => l.id === formData.locationId)?.name || 'None';
        data.notifyByRole(['admin', 'manager'], 'asset', 'Asset Location Changed', `"${formData.name}" (${tag}) moved from ${prev} to ${next}.`, 'low', user?.id).catch(e => console.error('[Notify]', e));
        const locTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
        sendNotificationEmailToMany(locTargets.map(u => ({email:u.email,name:u.name})), 'asset_location_changed',
          `Asset Location Changed: ${formData.name}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Relocated',body:ET.assetLocationChangedBody(formData.name,tag,prev,next,user!.name)},
          organization?.id||'');
      }
      if (selectedAsset.departmentId !== formData.departmentId) {
        const prev = departments.find(d => d.id === selectedAsset.departmentId)?.name || 'None';
        const next = departments.find(d => d.id === formData.departmentId)?.name || 'None';
        data.notifyByRole(['admin', 'manager'], 'asset', 'Asset Department Changed', `"${formData.name}" (${tag}) transferred from ${prev} to ${next}.`, 'low', user?.id).catch(e => console.error('[Notify]', e));
        const deptTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
        sendNotificationEmailToMany(deptTargets.map(u => ({email:u.email,name:u.name})), 'asset_location_changed',
          `Asset Department Changed: ${formData.name}`,
          {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Department Changed',body:ET.assetLocationChangedBody(formData.name,tag,prev,next,user!.name)},
          organization?.id||'');
      }
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to update asset. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedAsset) return;
    setSaving(true);
    // Track the deleted tag before removing
    try {
      await data.deletedAssetTags.create({
        assetTag: selectedAsset.assetTag,
        originalAssetName: selectedAsset.name,
        deletedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to track deleted tag:', err);
    }
    await data.assets.remove(selectedAsset.id);
    await data.addAuditLog(
      user?.id || '',
      user?.name || '',
      'Deleted',
      'Assets',
      selectedAsset.id,
      'Asset',
      `Deleted asset "${selectedAsset.name}" (${selectedAsset.assetTag})`
    );
    data.addNotification(user!.id, 'asset', 'Asset Deleted', `You removed "${selectedAsset.name}" (${selectedAsset.assetTag}) from the inventory.`, 'low').catch(e => console.error('[Notify]', e));
    data.notifyByRole(['admin', 'manager'], 'asset', 'Asset Removed', `"${selectedAsset.name}" (${selectedAsset.assetTag}) has been removed from the inventory by ${user?.name || 'an admin'}.`, 'medium', user?.id).catch(e => console.error('[Notify]', e));
    const delTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role) && u.id !== user!.id);
    sendNotificationEmailToMany(delTargets.map(u => ({email:u.email,name:u.name})), 'asset_deleted',
      `Asset Removed: ${selectedAsset.name}`,
      {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Asset Removed',body:ET.assetDeletedBody(selectedAsset.name,selectedAsset.assetTag,user!.name)},
      organization?.id||'');
    setShowDetailModal(false);
    setSelectedAsset(null);
    setRefreshKey(k => k + 1);
    setSaving(false);
  }

  async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedIds);
    const assetsToDelete = idsToDelete
      .map(id => data.assets.getById(id))
      .filter(Boolean) as Asset[];
    if (assetsToDelete.length === 0) return;
    setBulkDeleting(true);
    try {
      const nowIso = new Date().toISOString();
      // Track all deleted tags in a single INSERT.
      try {
        await data.deletedAssetTags.bulkCreate(
          assetsToDelete.map(asset => ({
            assetTag: asset.assetTag,
            originalAssetName: asset.name,
            deletedAt: nowIso,
          }))
        );
      } catch (err) {
        console.error('Failed to track deleted tags:', err);
      }
      // Bulk remove all assets in one DB call
      await data.assets.bulkRemove(idsToDelete);
      // Bulk-insert audit logs in a single INSERT (one row per deleted asset).
      try {
        await data.auditLogs.bulkCreate(
          assetsToDelete.map(asset => ({
            userId: user?.id || '',
            userName: user?.name || '',
            action: 'Deleted',
            module: 'Assets',
            entityId: asset.id,
            entityType: 'Asset',
            details: `Deleted asset "${asset.name}" (${asset.assetTag}) [bulk delete]`,
            changes: [],
            timestamp: nowIso,
          })) as Omit<AuditLog, 'id' | 'organizationId'>[]
        );
      } catch (err) {
        console.error('Failed to write bulk-delete audit logs:', err);
      }
      // Single summary notification
      const summary = assetsToDelete.length <= 3
        ? assetsToDelete.map(a => `"${a.name}" (${a.assetTag})`).join(', ')
        : `${assetsToDelete.length} assets`;
      data.addNotification(user!.id, 'asset', 'Bulk Delete',
        `You removed ${summary} from the inventory.`, 'low')
        .catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager'], 'asset', 'Bulk Asset Removal',
        `${assetsToDelete.length} assets were removed by ${user?.name || 'an admin'}.`,
        'medium', user?.id)
        .catch(e => console.error('[Notify]', e));
      // Send single summary email
      const delTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role) && u.id !== user!.id);
      sendNotificationEmailToMany(delTargets.map(u => ({email:u.email,name:u.name})), 'asset_deleted',
        `Bulk Delete: ${assetsToDelete.length} Assets Removed`,
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Bulk Asset Removal',body:`${user?.name} removed ${assetsToDelete.length} assets from inventory.`},
        organization?.id||'');
      clearSelection();
      setRefreshKey(k => k + 1);
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleExport() {
    const exportData = assets.map(a => {
      const row: Record<string, unknown> = {
        'Asset Tag': a.assetTag,
        Name: a.name,
        Type: a.type.replace(/_/g, ' '),
        Category: a.category,
        Brand: a.brand,
        Model: a.model,
        'Serial Number': a.serialNumber,
        Location: getLocationName(a.locationId),
        Department: getDepartmentName(a.departmentId),
        Status: a.status.replace(/_/g, ' '),
        'Purchase Date': a.purchaseDate,
        'Purchase Cost': a.purchaseCost,
      };
      // Include extended fields only if any asset has them
      if (a.processor) row['Processor'] = a.processor;
      if (a.ram) row['RAM'] = a.ram;
      if (a.storage) row['Storage'] = a.storage;
      if (a.graphicsCard) row['Graphics Card'] = a.graphicsCard;
      if (a.screenSize) row['Screen Size'] = a.screenSize;
      if (a.deviceName) row['Device Name'] = a.deviceName;
      if (a.assignedEmployee) row['Assigned Employee'] = a.assignedEmployee;
      row['Warranty Start'] = a.warrantyStart;
      row['Warranty End'] = a.warrantyEnd;
      row['Vendor'] = getVendorName(a.vendorId);
      row['Useful Life (Years)'] = a.usefulLifeYears;
      row['Salvage Value'] = a.salvageValue;
      row['Description'] = a.description;
      return row;
    });
    exportToCSV(exportData, 'assets-export');
  }

  function updateField<K extends keyof AssetFormData>(key: K, value: AssetFormData[K]) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // ---- Bulk Import ----
  // All known header patterns the system can detect from Excel files like asset audit spreadsheets.
  // These cover multiple asset types per row (laptop, charger, monitor, mouse, keyboard, headphone, mouse pad, etc.)
  const KNOWN_HEADERS: { key: string; label: string; dbField: string; aliases: string[] }[] = [
    { key: 'Sr. No.', label: '#', dbField: '', aliases: ['sr no', 'sno', 'serial no', 'row', '#', 'number'] },
    { key: 'Employee Name', label: 'Employee Name', dbField: 'assignedEmployee', aliases: ['employee name', 'employee', 'emp name', 'staff name', 'assigned to', 'user'] },
    { key: 'Designation', label: 'Designation', dbField: 'designation', aliases: ['designation', 'role', 'position', 'title'] },
    { key: 'Location', label: 'Location', dbField: 'location', aliases: ['location', 'site', 'office', 'branch'] },
    { key: 'Asset Tag', label: 'Asset Tag', dbField: 'assetTag', aliases: ['asset tag', 'tag', 'asset code', 'asset tags', 'cpu asset tags', 'chair asset tag', 'table asset tag', 'ac asset tag', 'mouse asset tag', 'keyboard asset tag'] },
    { key: 'Asset Name', label: 'Asset Name', dbField: 'name', aliases: ['asset name', 'name', 'item', 'asset', 'laptop', 'laptop / pc', 'asset categorylaptop/pc', 'head phone', 'headphone', 'mouse pad', 'mousepad', 'mouse', 'keyboard', 'mouse keyboard', 'keyboard & mouse', 'mouse keyboard & mouse', 'ceiling fan', 'ceiling lights', 'extra assets', 'other assets', 'biometric machine'] },
    { key: 'Serial Number', label: 'Serial Number', dbField: 'serialNumber', aliases: ['serial number', 'serial no', 'serial', 'sn', 'serialnumber', 'serial number(dp/n)', 'serial no(dp/n)', 'serial number (mouse)', 'serial number (keyboard)', 'adaptor serial no', 'monitor serial number', 'monitor seial number'] },
    { key: 'Model', label: 'Model', dbField: 'model', aliases: ['model', 'model name', 'laptop charger(model)', 'laptop charger model', 'charger model', 'monitor (model)', 'monitor model', 'keyboard & mouse (model)', 'model keyboard & mouse', 'keyboard mouse model'] },
    { key: 'Brand', label: 'Brand', dbField: 'brand', aliases: ['brand', 'make', 'manufacturer'] },
    { key: 'Processor', label: 'Processor', dbField: 'processor', aliases: ['processor', 'cpu', 'chip', 'proc'] },
    { key: 'RAM', label: 'RAM', dbField: 'ram', aliases: ['ram', 'memory'] },
    { key: 'Storage', label: 'Storage', dbField: 'storage', aliases: ['ssd/hdd', 'ssd hdd', 'storage', 'hdd', 'ssd', 'disk', 'hard drive'] },
    { key: 'Graphics Card', label: 'Graphics Card', dbField: 'graphicsCard', aliases: ['graphics card', 'gpu', 'graphics', 'video card', 'graphic card'] },
    { key: 'Screen Size', label: 'Screen Size', dbField: 'screenSize', aliases: ['size in inch', 'screen size', 'display size', 'monitor size', 'size'] },
    { key: 'Configuration', label: 'Configuration', dbField: 'configuration', aliases: ['configuration', 'config', 'spec', 'specs'] },
    { key: 'Device Name', label: 'Device Name', dbField: 'deviceName', aliases: ['device name', 'hostname', 'computer name', 'pc name'] },
    { key: 'Mfg Date', label: 'Mfg Date', dbField: 'mfgDate', aliases: ['mfg date', 'manufacturing date', 'manufacture date', 'date of mfg'] },
    { key: 'Physically Verified', label: 'Physically Verified', dbField: 'physicallyVerified', aliases: ['physically verified', 'verified', 'physical verification', 'audit verified'] },
    { key: 'Category', label: 'Category', dbField: 'category', aliases: ['category', 'type', 'asset type', 'asset category'] },
    { key: 'Status', label: 'Status', dbField: 'status', aliases: ['status'] },
    { key: 'Department', label: 'Department', dbField: 'department', aliases: ['department', 'dept', 'team'] },
    { key: 'Purchase Date', label: 'Purchase Date', dbField: 'purchaseDate', aliases: ['purchase date', 'purchased', 'buy date'] },
    { key: 'Purchase Cost', label: 'Purchase Cost', dbField: 'purchaseCost', aliases: ['purchase cost', 'cost', 'price', 'amount'] },
    { key: 'Warranty Start', label: 'Warranty Start', dbField: 'warrantyStart', aliases: ['warranty start', 'warranty from'] },
    { key: 'Warranty End', label: 'Warranty End', dbField: 'warrantyEnd', aliases: ['warranty end', 'warranty until', 'warranty to', 'warranty expiry'] },
    { key: 'Vendor', label: 'Vendor', dbField: 'vendor', aliases: ['vendor', 'supplier'] },
    { key: 'Description', label: 'Description', dbField: 'description', aliases: ['description', 'notes', 'remarks', 'comment'] },
  ];

  // Detect which KNOWN_HEADERS match the file's actual headers (fuzzy match)
  function detectHeaders(fileHeaders: string[]): { detected: typeof KNOWN_HEADERS; mapping: Record<string, number> } {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const detected: typeof KNOWN_HEADERS = [];
    const mapping: Record<string, number> = {};

    for (const known of KNOWN_HEADERS) {
      for (let i = 0; i < fileHeaders.length; i++) {
        const nh = normalize(fileHeaders[i]);
        if (!nh) continue;
        const isMatch = known.aliases.some(alias => {
          const na = normalize(alias);
          return nh === na || nh.includes(na) || na.includes(nh);
        });
        if (isMatch && !Object.values(mapping).includes(i)) {
          detected.push(known);
          mapping[known.key] = i;
          break;
        }
      }
    }
    return { detected, mapping };
  }

  // Detect multi-asset column groups (e.g., Laptop + Asset Tag, Monitor + Asset Tag.2, etc.)
  // Each group represents a separate asset type with its own asset tag column
  function detectAssetGroups(fileHeaders: string[]): { groupName: string; assetTagCol: number; nameCol: number; relatedCols: { header: string; colIdx: number; knownKey: string }[] }[] {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, '');

    // Find all asset tag columns: "Asset Tag", "Asset Tag.1", "Asset Tag.2", etc.
    const assetTagCols: { idx: number; suffix: string }[] = [];
    fileHeaders.forEach((h, i) => {
      const n = normalize(h);
      if (n.match(/^assettag\d*\.?\d*$/) || n === 'assettag' || n.match(/^cpuassettags$/)) {
        assetTagCols.push({ idx: i, suffix: h.replace(/asset\s*tag/i, '').replace(/\./g, '').trim() });
      }
    });

    if (assetTagCols.length <= 1) return []; // Single or no asset tag column - use standard flat import

    // For each asset tag column, find its associated "name" column (the category/type column just before it)
    const groups: { groupName: string; assetTagCol: number; nameCol: number; relatedCols: { header: string; colIdx: number; knownKey: string }[] }[] = [];
    const categoryKeywords = ['laptop', 'monitor', 'mouse', 'keyboard', 'head phone', 'headphone', 'mouse pad', 'mousepad', 'charger', 'chair', 'table', 'fan', 'light', 'ac', 'biometric', 'extra', 'other', 'pc', 'cpu'];

    for (const atc of assetTagCols) {
      // Look backwards from asset tag col for a name/category column
      let nameCol = -1;
      let groupName = '';
      for (let j = atc.idx - 1; j >= 0 && j >= atc.idx - 3; j--) {
        const h = fileHeaders[j].toLowerCase().trim();
        if (categoryKeywords.some(kw => h.includes(kw)) || h.includes('asset name') || h.includes('asset category')) {
          nameCol = j;
          groupName = fileHeaders[j].trim();
          break;
        }
      }
      if (nameCol === -1) {
        // If no name column found, use the asset tag column header as group name
        nameCol = atc.idx;
        groupName = fileHeaders[atc.idx].trim();
      }

      // Collect related columns between this group and the next asset tag column
      const nextAtcIdx = assetTagCols.find(a => a.idx > atc.idx)?.idx ?? fileHeaders.length;
      const relatedCols: { header: string; colIdx: number; knownKey: string }[] = [];

      for (let k = Math.max(0, nameCol); k < nextAtcIdx; k++) {
        if (k === atc.idx || k === nameCol) continue;
        const h = fileHeaders[k];
        if (!h || h.toLowerCase().includes('photo') || h.toLowerCase().includes('unnamed')) continue;

        // Try to match to a known header
        const nk = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        let matchedKey = '';
        for (const known of KNOWN_HEADERS) {
          if (known.key === 'Asset Tag' || known.key === 'Asset Name' || known.key === 'Sr. No.') continue;
          if (known.aliases.some(a => {
            const na = a.toLowerCase().replace(/[^a-z0-9]/g, '');
            return nk === na || nk.includes(na) || na.includes(nk);
          })) {
            matchedKey = known.key;
            break;
          }
        }
        relatedCols.push({ header: h, colIdx: k, knownKey: matchedKey });
      }

      groups.push({ groupName, assetTagCol: atc.idx, nameCol, relatedCols });
    }

    return groups;
  }

  // State for detected columns to show in preview
  const [detectedHeaders, setDetectedHeaders] = useState<typeof KNOWN_HEADERS>([]);
  const [colMapping, setColMapping] = useState<Record<string, number>>({});
  const [assetGroups, setAssetGroups] = useState<ReturnType<typeof detectAssetGroups>>([]);
  const [isMultiAssetMode, setIsMultiAssetMode] = useState(false);

  function downloadSampleCSV() {
    const headers = ['Asset Tag', 'Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Processor', 'RAM', 'Storage', 'Graphics Card', 'Screen Size', 'Device Name', 'Location', 'Department', 'Employee Name', 'Status', 'Purchase Date', 'Purchase Cost', 'Warranty Start', 'Warranty End', 'Vendor', 'Description'];
    const sampleRows = [
      headers.join(','),
      '"LPT-19-031","Dell Latitude 5540","Laptop","Dell","Latitude 5540","5CG6262C39","i7-1365U","16 GB","512 SSD","Intel UHD","","DESKTOP-ABC","Main Office","Engineering","John Smith","available","2025-01-15","1200","2025-01-15","2028-01-15","Dell Inc","Employee laptop"',
      '"MON-22-001","LG UltraWide","Monitor","LG","34WN80C","312NTPC8Z648","","","","","34 inch","","Main Office","Engineering","John Smith","available","2025-01-15","450","","","LG Corp","Ultrawide monitor"',
      '"KBM-18-001","Dell KB/Mouse Combo","Keyboard & Mouse","Dell","KM636","CN-0GXCWV","","","","","","","Main Office","Engineering","Jane Doe","available","2025-02-01","50","","","Dell Inc",""',
    ].join('\n');
    const blob = new Blob([sampleRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'assets-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function processFile(file: File) {
    setBulkFile(file);
    setBulkErrors([]);
    setBulkParsed([]);
    setBulkDone(false);
    setBulkSuccess(0);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setRawHeaders([]);
    setRawData([]);
    setHeaderMapping({});
    setDetectedHeaders([]);
    setColMapping({});
    setAssetGroups([]);
    setIsMultiAssetMode(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        setWorkbook(wb);
        const names = wb.SheetNames;
        setSheetNames(names);
        setShowBulkModal(true);

        if (names.length === 1) {
          setSelectedSheet(names[0]);
          processSheet(wb, names[0]);
        } else {
          setBulkStep('sheet');
        }
      } catch {
        setBulkErrors(['Could not parse the file. Please upload a valid CSV or Excel file.']);
        setShowBulkModal(true);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  // Drag and drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      resetBulkModal();
      processFile(file);
    }
  }

  function processSheet(wb: XLSX.WorkBook, sheetName: string) {
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
    if (jsonData.length < 2) {
      setBulkErrors(['Sheet is empty or has no data rows.']);
      setBulkStep('upload');
      return;
    }

    // Find the actual header row (sometimes row 0 has title, row 3 has sub-headers)
    // Look for the row with the most non-empty, non-numeric cells
    let headerRowIdx = 0;
    let maxHeaderScore = 0;
    for (let r = 0; r < Math.min(5, jsonData.length); r++) {
      const row = jsonData[r] as string[];
      const score = row.filter(c => {
        const s = String(c).trim();
        return s && isNaN(Number(s)) && s.length > 1;
      }).length;
      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        headerRowIdx = r;
      }
    }

    const headers = (jsonData[headerRowIdx] as string[]).map(h => String(h).trim());
    const rows = jsonData.slice(headerRowIdx + 1).filter((row: string[]) => row.some(cell => String(cell).trim()));
    setRawHeaders(headers);
    setRawData(rows.map((r: string[]) => r.map(c => String(c))));

    // Detect multi-asset groups
    const groups = detectAssetGroups(headers);
    setAssetGroups(groups);

    if (groups.length > 1) {
      // Multi-asset-per-row mode
      setIsMultiAssetMode(true);
      // Detect shared columns (employee name, location, etc.)
      const { detected, mapping } = detectHeaders(headers);
      setDetectedHeaders(detected);
      setColMapping(mapping);
      // Auto-extract and go straight to preview
      extractMultiAssetRows(headers, rows.map((r: string[]) => r.map(c => String(c))), groups, mapping);
    } else {
      // Standard single-asset-per-row mode
      setIsMultiAssetMode(false);
      const { detected, mapping } = detectHeaders(headers);
      setDetectedHeaders(detected);
      setColMapping(mapping);

      // Auto-map using old system for backward compat
      const oldMapping: Record<string, string> = {};
      for (const h of detected) {
        if (mapping[h.key] !== undefined) {
          oldMapping[h.key] = headers[mapping[h.key]];
        }
      }
      setHeaderMapping(oldMapping);
      setBulkStep('mapping');
    }
  }

  function extractMultiAssetRows(headers: string[], rows: string[][], groups: ReturnType<typeof detectAssetGroups>, sharedMapping: Record<string, number>) {
    const allAssets: Record<string, string>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Get shared fields
      const employeeName = sharedMapping['Employee Name'] !== undefined ? String(row[sharedMapping['Employee Name']] || '').trim() : '';
      const location = sharedMapping['Location'] !== undefined ? String(row[sharedMapping['Location']] || '').trim() : '';
      const designation = sharedMapping['Designation'] !== undefined ? String(row[sharedMapping['Designation']] || '').trim() : '';

      for (const group of groups) {
        const tag = String(row[group.assetTagCol] || '').trim();
        const nameVal = String(row[group.nameCol] || '').trim();

        // Skip if both tag and name are empty or just dashes
        if ((!tag || tag === '-') && (!nameVal || nameVal === '-')) continue;

        const asset: Record<string, string> = {
          'Asset Tag': tag && tag !== '-' ? tag : '',
          'Asset Name': nameVal && nameVal !== '-' ? nameVal : group.groupName,
          'Category': group.groupName.replace(/\s*[-–(].*$/, '').trim(),
          'Employee Name': employeeName,
          'Location': location,
          'Designation': designation,
        };

        // Add related columns
        for (const rel of group.relatedCols) {
          const val = String(row[rel.colIdx] || '').trim();
          if (val && val !== '-') {
            const key = rel.knownKey || rel.header;
            asset[key] = val;
          }
        }

        allAssets.push(asset);
      }
    }

    setBulkParsed(allAssets);
    setBulkErrors([]);
    setBulkStep('preview');
  }

  function handleSheetSelect(name: string) {
    setSelectedSheet(name);
    if (workbook) processSheet(workbook, name);
  }

  function getMatchStatus(expectedKey: string): 'matched' | 'unmatched' | 'optional-unmatched' {
    if (headerMapping[expectedKey]) return 'matched';
    return 'optional-unmatched';
  }

  // Determine which columns are actually present in the parsed data
  function getActivePreviewColumns(): string[] {
    if (bulkParsed.length === 0) return [];
    const allKeys = new Set<string>();
    for (const row of bulkParsed) {
      for (const key of Object.keys(row)) {
        if (row[key] && row[key] !== '-') allKeys.add(key);
      }
    }
    return Array.from(allKeys);
  }

  function proceedToPreview() {
    setBulkErrors([]);
    const mappedRows: Record<string, string>[] = rawData.map(row => {
      const mapped: Record<string, string> = {};
      for (const h of detectedHeaders) {
        const fileColIdx = colMapping[h.key];
        if (fileColIdx !== undefined) {
          mapped[h.key] = String(row[fileColIdx] || '').trim();
        }
      }
      // Also include any manually mapped old-style headers
      for (const [expectedKey, fileHeader] of Object.entries(headerMapping)) {
        if (!mapped[expectedKey]) {
          const colIdx = rawHeaders.indexOf(fileHeader);
          if (colIdx >= 0) mapped[expectedKey] = String(row[colIdx] || '').trim();
        }
      }
      // Include custom columns
      for (const cc of customColumns) {
        const colIdx = rawHeaders.indexOf(cc);
        if (colIdx >= 0) mapped[`__custom__${cc}`] = String(row[colIdx] || '').trim();
      }
      return mapped;
    }).filter(row => Object.values(row).some(v => v && v !== '-'));

    setBulkParsed(mappedRows);
    setBulkStep('preview');
  }

  async function handleBulkImport() {
    if (bulkParsed.length === 0) return;
    setBulkImporting(true);
    setBulkStep('importing');
    setBulkSuccess(0);
    const errors: string[] = [];

    // Pre-validate every row and build the full payload before touching the DB.
    // This collapses N inserts into a single batched INSERT.
    const existingTags = data.assets.getAll().map(a => a.assetTag);
    // deleted_asset_tags is only used to bump auto-generated sequence numbers
    // past previously-used ones — it must NOT block a user from importing a
    // tag they explicitly chose. Keep the list for genTag, no validation.
    const deletedTags = data.deletedAssetTags.getAll().map(t => t.assetTag);
    const existingSet = new Set(existingTags.map(t => t.toUpperCase()));
    const seenInBatch = new Set<string>();
    const generatedThisBatch: string[] = [];
    const orgShort = organization?.shortName || 'ORG';
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const payload: Omit<Asset, 'id' | 'organizationId'>[] = [];
    const reusedDeletedTags: string[] = [];

    for (let i = 0; i < bulkParsed.length; i++) {
      const row = bulkParsed[i];
      const category = row['Category'] || row['Asset Name'] || 'Other';
      let tag: string;
      if (row['Asset Tag'] && row['Asset Tag'].trim() && row['Asset Tag'].trim() !== '-') {
        tag = row['Asset Tag'].trim();
      } else {
        // Feed the generator the tags we've already minted in this batch so
        // multiple rows in the same category don't all get the same sequence.
        tag = genTag(category, orgShort, [...existingTags, ...generatedThisBatch], deletedTags);
        generatedThisBatch.push(tag);
      }

      const upperTag = tag.toUpperCase();
      if (seenInBatch.has(upperTag)) {
        errors.push(`Row ${i + 1} (${tag}): duplicate tag within this import.`);
        continue;
      }
      if (existingSet.has(upperTag)) {
        errors.push(`Row ${i + 1} (${tag}): tag already exists in your organization.`);
        continue;
      }
      seenInBatch.add(upperTag);
      if (deletedTags.some(t => t.toUpperCase() === upperTag)) {
        // Re-importing a previously deleted tag — allowed. We'll clear the
        // stale row from deleted_asset_tags after the import succeeds so the
        // tag generator's sequence bookkeeping stays consistent.
        reusedDeletedTags.push(tag);
      }

      // Resolve location/department/vendor by name
      const locName = row['Location'] || '';
      const deptName = row['Department'] || '';
      const loc = locName ? locations.find(l => l.name.toLowerCase() === locName.toLowerCase()) : locations[0];
      const dept = deptName ? departments.find(d => d.name.toLowerCase() === deptName.toLowerCase()) : departments[0];
      const vendName = row['Vendor'] || '';
      const vend = vendName ? vendors.find(v => v.name.toLowerCase() === vendName.toLowerCase()) : null;

      payload.push({
        assetTag: tag,
        name: row['Asset Name'] || row['Name'] || category,
        type: (row['Type'] as AssetType) || 'it_equipment',
        category: category,
        brand: row['Brand'] || row['Model'] || '',
        model: row['Model'] || '',
        serialNumber: row['Serial Number'] || '',
        locationId: loc?.id || '',
        departmentId: dept?.id || '',
        purchaseDate: row['Purchase Date'] || today,
        purchaseCost: parseFloat(row['Purchase Cost']) || 0,
        warrantyStart: row['Warranty Start'] || '',
        warrantyEnd: row['Warranty End'] || '',
        status: (row['Status'] as AssetStatus) || 'available',
        vendorId: vend?.id || '',
        description: row['Description'] || '',
        usefulLifeYears: parseInt(row['Useful Life (Years)']) || 5,
        salvageValue: parseFloat(row['Salvage Value']) || 0,
        processor: row['Processor'] || '',
        ram: row['RAM'] || '',
        storage: row['Storage'] || '',
        graphicsCard: row['Graphics Card'] || '',
        screenSize: row['Screen Size'] || '',
        configuration: row['Configuration'] || '',
        deviceName: row['Device Name'] || '',
        assignedEmployee: row['Employee Name'] || '',
        designation: row['Designation'] || '',
        physicallyVerified: row['Physically Verified']?.toLowerCase() === 'yes',
        mfgDate: row['Mfg Date'] || '',
        customFields: (() => {
          const cf: Record<string, string> = {};
          for (const key of Object.keys(row)) {
            if (key.startsWith('__custom__')) {
              const label = key.replace('__custom__', '');
              const val = row[key]?.trim();
              if (val) cf[label] = val;
            }
          }
          return Object.keys(cf).length > 0 ? cf : null;
        })(),
        createdAt: now,
        updatedAt: now,
      } as Omit<Asset, 'id' | 'organizationId'>);
    }

    let successCount = 0;
    if (payload.length > 0) {
      try {
        const created = await data.assets.bulkCreate(payload);
        successCount = created.length;
        setBulkSuccess(successCount);
        // Clean up stale rows in deleted_asset_tags for any tag we just
        // resurrected — single query, scoped to this org.
        if (reusedDeletedTags.length > 0 && organization?.id) {
          try {
            await supabase
              .from('deleted_asset_tags')
              .delete()
              .eq('organization_id', organization.id)
              .in('asset_tag', reusedDeletedTags);
            await data.refresh();
          } catch (cleanupErr) {
            console.warn('[BulkImport] deleted_asset_tags cleanup failed:', cleanupErr);
          }
        }
      } catch (err: any) {
        errors.push(`Bulk insert failed: ${err?.message || 'unknown error'}. No assets were imported.`);
      }
    }

    setBulkErrors(errors);
    setBulkImporting(false);
    setBulkDone(true);
    if (successCount > 0) {
      setRefreshKey(k => k + 1);
      const msg = errors.length > 0
        ? `Bulk import completed: ${successCount} of ${bulkParsed.length} assets imported successfully. ${errors.length} failed.`
        : `Bulk import completed: all ${successCount} assets imported successfully.`;
      data.addNotification(user!.id, 'asset', 'Bulk Import Complete', msg, errors.length > 0 ? 'high' : 'low').catch(e => console.error('[Notify]', e));
      data.notifyByRole(['admin', 'manager', 'employee'], 'asset', 'Bulk Import Complete', msg, errors.length > 0 ? 'high' : 'medium').catch(e => console.error('[Notify]', e));
      const importTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager','employee'].includes(u.role));
      sendNotificationEmailToMany(importTargets.map(u => ({email:u.email,name:u.name})), 'bulk_import',
        'Bulk Asset Import Complete',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Bulk Import Complete',body:ET.bulkImportBody(successCount,user!.name)},
        organization?.id||'');
    } else {
      data.notifyByRole(['admin', 'manager'], 'asset', 'Bulk Import Failed', `Bulk import failed: none of the ${bulkParsed.length} assets could be imported.`, 'critical').catch(e => console.error('[Notify]', e));
      const failTargets = data.users.getAll().filter(u => u.isActive && ['admin','manager'].includes(u.role));
      sendNotificationEmailToMany(failTargets.map(u => ({email:u.email,name:u.name})), 'bulk_import_failed',
        'Bulk Asset Import Failed',
        {orgName:organization?.name||'',orgLogoUrl:organization?.logoUrl,headline:'Bulk Import Failed',body:ET.bulkImportBody(bulkParsed.length,user!.name)},
        organization?.id||'');
    }
  }

  function resetBulkModal() {
    setBulkFile(null);
    setBulkParsed([]);
    setBulkErrors([]);
    setBulkSuccess(0);
    setBulkImporting(false);
    setBulkDone(false);
    setBulkStep('upload');
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setRawHeaders([]);
    setRawData([]);
    setHeaderMapping({});
    setDetectedHeaders([]);
    setColMapping({});
    setAssetGroups([]);
    setIsMultiAssetMode(false);
    setCustomColumns(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Derive unique categories from existing assets for dropdown
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    data.assets.getAll().forEach(a => { if (a.category) cats.add(a.category); });
    return Array.from(cats).sort();
  }, [data.assets]);

  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white';
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5';

  // Shared form JSX
  function renderForm() {
    const cfg = getFieldConfig(formData.type, formData.category);
    const typeCategories = TYPE_CATEGORIES[formData.type] || [];
    const categoryInList = !formData.category || typeCategories.includes(formData.category);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">

        {/* ── Row 1: Name + Type ── */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Name *</label>
          <input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)} className={inputCls} placeholder="Asset name" required />
        </div>
        <div>
          <label className={labelCls}>Type *</label>
          <select value={formData.type} onChange={e => {
            const t = e.target.value as AssetType;
            setFormData(prev => ({
              ...prev, type: t, category: '',
              processor: '', ram: '', storage: '', graphicsCard: '',
              screenSize: '', deviceName: '', configuration: '',
              usefulLifeYears: USEFUL_LIFE_DEFAULTS[t],
              salvageValue: Math.round(prev.purchaseCost * SALVAGE_PERCENT[t] / 100 * 100) / 100,
            }));
            setShowCustomCategory(false);
          }} className={inputCls}>
            {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* ── Category ── */}
        <div>
          <label className={labelCls}>Category *</label>
          {!showCustomCategory ? (
            <select value={formData.category} onChange={e => {
              if (e.target.value === '__custom__') { setShowCustomCategory(true); updateField('category', ''); }
              else updateField('category', e.target.value);
            }} className={inputCls}>
              <option value="">Select category</option>
              {typeCategories.map(c => <option key={c} value={c}>{c}</option>)}
              {formData.category && !categoryInList && <option value={formData.category}>{formData.category}</option>}
              <option value="__custom__">+ Add custom</option>
            </select>
          ) : (
            <div className="flex gap-1">
              <input type="text" value={formData.category} onChange={e => updateField('category', e.target.value)} className={inputCls} placeholder="Custom category" autoFocus />
              <button type="button" onClick={() => { setShowCustomCategory(false); if (!formData.category) updateField('category', ''); }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 flex-shrink-0">List</button>
            </div>
          )}
        </div>

        {/* ── Identification: Brand / Model / Serial ── */}
        {cfg.showBrand && (
          <div>
            <label className={labelCls}>Brand</label>
            <input type="text" value={formData.brand} onChange={e => updateField('brand', e.target.value)} className={inputCls} placeholder="Brand name" />
          </div>
        )}
        {cfg.showModel && (
          <div>
            <label className={labelCls}>Model</label>
            <input type="text" value={formData.model} onChange={e => updateField('model', e.target.value)} className={inputCls} placeholder="Model number" />
          </div>
        )}
        {cfg.showSerialNumber && (
          <div>
            <label className={labelCls}>{cfg.serialLabel}</label>
            <input type="text" value={formData.serialNumber} onChange={e => updateField('serialNumber', e.target.value)} className={inputCls} placeholder={cfg.serialLabel} />
          </div>
        )}

        {/* ── IT Specs: Processor / RAM / Storage / GPU / Device Name ── */}
        {cfg.showITSpecs && (
          <>
            <div>
              <label className={labelCls}>Processor</label>
              <input type="text" value={formData.processor} onChange={e => updateField('processor', e.target.value)} className={inputCls} placeholder="e.g. Intel Core i7-13700H" />
            </div>
            <div>
              <label className={labelCls}>RAM</label>
              <input type="text" value={formData.ram} onChange={e => updateField('ram', e.target.value)} className={inputCls} placeholder="e.g. 16GB DDR5" />
            </div>
            <div>
              <label className={labelCls}>Storage</label>
              <input type="text" value={formData.storage} onChange={e => updateField('storage', e.target.value)} className={inputCls} placeholder="e.g. 512GB SSD" />
            </div>
            <div>
              <label className={labelCls}>Graphics Card</label>
              <input type="text" value={formData.graphicsCard} onChange={e => updateField('graphicsCard', e.target.value)} className={inputCls} placeholder="e.g. NVIDIA RTX 4060" />
            </div>
            <div>
              <label className={labelCls}>Device Name</label>
              <input type="text" value={formData.deviceName} onChange={e => updateField('deviceName', e.target.value)} className={inputCls} placeholder="e.g. DESKTOP-AB123" />
            </div>
          </>
        )}

        {/* ── Screen Size (standalone, not part of full IT specs) ── */}
        {cfg.showScreenSize && (
          <div>
            <label className={labelCls}>Screen Size</label>
            <input type="text" value={formData.screenSize} onChange={e => updateField('screenSize', e.target.value)} className={inputCls} placeholder='e.g. 15.6"' />
          </div>
        )}

        {/* ── Configuration / Specs (vehicle, HVAC, infrastructure, server/router) ── */}
        {cfg.showConfiguration && (
          <div className="sm:col-span-3">
            <label className={labelCls}>{cfg.configLabel}</label>
            <textarea value={formData.configuration} onChange={e => updateField('configuration', e.target.value)} className={inputCls} rows={2}
              placeholder={
                formData.type === 'vehicle' ? 'Registration number, VIN, insurance details...' :
                formData.type === 'hvac' ? 'Capacity (e.g. 1.5 Ton), BTU rating, zone...' :
                'Specifications, config details...'
              }
            />
          </div>
        )}

        {/* ── Status / Asset Use ── */}
        <div>
          <label className={labelCls}>Status</label>
          <select value={formData.status} onChange={e => updateField('status', e.target.value as AssetStatus)} className={inputCls}>
            <option value="available">Available</option>
            <option value="allocated">Allocated</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="retired">Retired</option>
            <option value="disposed">Disposed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Asset Use</label>
          <select value={formData.assetUse} onChange={e => updateField('assetUse', e.target.value as AssetUse | '')} className={inputCls}>
            <option value="">Not specified</option>
            <option value="personal">Personal Use</option>
            <option value="common">Common Use</option>
          </select>
        </div>

        {/* ── Location / Department ── */}
        <div>
          <label className={labelCls}>Location *</label>
          <select value={formData.locationId} onChange={e => updateField('locationId', e.target.value)} className={inputCls}>
            <option value="">Select location</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Department *</label>
          <select value={formData.departmentId} onChange={e => updateField('departmentId', e.target.value)} className={inputCls}>
            <option value="">Select department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* ── Acquisition ── */}
        <div>
          <label className={labelCls}>Purchase Date *</label>
          <input type="date" value={formData.purchaseDate} onChange={e => updateField('purchaseDate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Purchase Cost</label>
          <div className="flex gap-2">
            <select
              value={formData.currency}
              onChange={e => updateField('currency', e.target.value)}
              className="px-2 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-zinc-700 dark:text-white text-gray-700 w-[80px] flex-shrink-0"
            >
              <option value="USD">USD $</option>
              <option value="EUR">EUR €</option>
              <option value="GBP">GBP £</option>
              <option value="INR">INR ₹</option>
              <option value="AED">AED د.إ</option>
            </select>
            <input type="number" value={formData.purchaseCost} onChange={e => {
              const cost = parseFloat(e.target.value) || 0;
              const pct = SALVAGE_PERCENT[formData.type];
              setFormData(prev => ({
                ...prev,
                purchaseCost: cost,
                salvageValue: Math.round(cost * pct / 100 * 100) / 100,
              }));
            }} className={`${inputCls} flex-1`} min="0" step="0.01" />
          </div>
        </div>

        {/* ── Warranty ── */}
        {cfg.showWarranty && (
          <>
            <div>
              <label className={labelCls}>Warranty Start</label>
              <input type="date" value={formData.warrantyStart} onChange={e => updateField('warrantyStart', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Warranty End</label>
              <input type="date" value={formData.warrantyEnd} onChange={e => updateField('warrantyEnd', e.target.value)} className={inputCls} />
            </div>
          </>
        )}

        {/* ── Depreciation ── */}
        {cfg.showDepreciation && (
          <>
            <div>
              <label className={labelCls}>Useful Life (Years)</label>
              <input type="number" value={formData.usefulLifeYears} onChange={e => updateField('usefulLifeYears', parseInt(e.target.value) || 1)} className={inputCls} min="1" />
            </div>
            <div>
              <label className={labelCls}>
                Salvage Value
                <span className="ml-1 text-gray-400 font-normal">({SALVAGE_PERCENT[formData.type]}% auto)</span>
              </label>
              <input type="number" value={formData.salvageValue} onChange={e => updateField('salvageValue', parseFloat(e.target.value) || 0)} className={inputCls} min="0" step="0.01" />
            </div>
            <div>
              <label className={labelCls}>Annual Depreciation <span className="text-emerald-600 font-normal">(calculated)</span></label>
              <div className={`${inputCls} bg-emerald-50/60 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 font-medium cursor-default select-none`}>
                {formData.usefulLifeYears > 0
                  ? `${formData.currency} ${((formData.purchaseCost - formData.salvageValue) / formData.usefulLifeYears).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`
                  : '—'}
              </div>
            </div>
          </>
        )}

        {/* ── Description ── */}
        {cfg.showDescription && (
          <div className="sm:col-span-3">
            <label className={labelCls}>Description</label>
            <textarea value={formData.description} onChange={e => updateField('description', e.target.value)} className={inputCls} rows={2} placeholder="Additional details about the asset" />
          </div>
        )}

        {/* ── Asset Images ── */}
        <div className="sm:col-span-3">
          <label className={labelCls}>Asset Images</label>
          <div className="flex flex-wrap items-start gap-2 mb-2">
            {/* Existing images when editing */}
            {isEditing && selectedAsset && (
              (selectedAsset.imageUrls?.length ? selectedAsset.imageUrls
                : selectedAsset.imageUrl ? [selectedAsset.imageUrl] : [])
              .map((src, i) => (
                <div key={`ex-img-${i}`} className="relative w-20 h-20 rounded-lg border border-gray-200 dark:border-zinc-600 overflow-hidden flex-shrink-0 group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button"
                    onClick={async () => {
                      const all = selectedAsset.imageUrls?.length ? selectedAsset.imageUrls : selectedAsset.imageUrl ? [selectedAsset.imageUrl] : [];
                      const newUrls = all.filter((_, j) => j !== i);
                      const updated = await data.assets.update(selectedAsset.id, { imageUrls: newUrls } as Partial<Asset>);
                      if (updated) setSelectedAsset(updated);
                      deleteStorageFile('asset-images', src).catch(() => {});
                    }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))
            )}
            {/* Pending new images */}
            {pendingImagePreviews.map((src, i) => (
              <div key={`pend-img-${i}`} className="relative w-20 h-20 rounded-lg border border-emerald-300 dark:border-emerald-600 overflow-hidden flex-shrink-0 group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button"
                  onClick={() => {
                    setPendingImageFiles(prev => prev.filter((_, j) => j !== i));
                    setPendingImagePreviews(prev => prev.filter((_, j) => j !== i));
                  }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
            {/* Add button */}
            <div>
              <input type="file" accept="image/*" multiple ref={imageInputRef} className="hidden"
                onChange={e => {
                  Array.from(e.target.files || []).forEach(file => {
                    setPendingImageFiles(prev => [...prev, file]);
                    setPendingImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
                  });
                  e.target.value = '';
                }}
              />
              <button type="button" onClick={() => imageInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors flex-shrink-0">
                <Plus className="w-5 h-5" />
                <span className="text-xs">Add</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, or WebP. Max 5MB each.</p>
        </div>

        {/* ── Invoices / Documents ── */}
        <div className="sm:col-span-3">
          <label className={labelCls}>Invoices / Documents</label>
          <div className="space-y-1.5 mb-2">
            {/* Existing invoices when editing */}
            {isEditing && selectedAsset && (
              (selectedAsset.invoiceUrls?.length ? selectedAsset.invoiceUrls
                : selectedAsset.invoiceUrl ? [selectedAsset.invoiceUrl] : [])
              .map((url, i) => (
                <div key={`ex-inv-${i}`} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
                  <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline flex-1 truncate">
                    Invoice {i + 1}
                  </a>
                  <button type="button"
                    onClick={async () => {
                      const all = selectedAsset.invoiceUrls?.length ? selectedAsset.invoiceUrls : selectedAsset.invoiceUrl ? [selectedAsset.invoiceUrl] : [];
                      const newUrls = all.filter((_, j) => j !== i);
                      const updated = await data.assets.update(selectedAsset.id, { invoiceUrls: newUrls } as Partial<Asset>);
                      if (updated) setSelectedAsset(updated);
                      deleteStorageFile('invoices', url).catch(() => {});
                    }}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
            {/* Pending invoice files */}
            {pendingInvoiceFiles.map((file, i) => (
              <div key={`pend-inv-${i}`} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{file.name}</span>
                <button type="button"
                  onClick={() => setPendingInvoiceFiles(prev => prev.filter((_, j) => j !== i))}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple ref={formInvoiceInputRef} className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                setPendingInvoiceFiles(prev => [...prev, ...files]);
                e.target.value = '';
              }}
            />
            <button type="button" onClick={() => formInvoiceInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
              <Plus className="w-4 h-4" />
              Add Invoice
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div
      className="space-y-6 animate-fadeIn relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Full-page drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-emerald-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border-2 border-dashed border-emerald-500 p-12 text-center">
            <Upload className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <p className="text-xl font-bold text-gray-900 dark:text-white">Drop Excel/CSV file to import</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Supports .csv, .xlsx, .xls files</p>
          </div>
        </div>
      )}

      <PageHeader
        title="Asset Management"
        subtitle={`${data.assets.getAll().length} total asset${data.assets.getAll().length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => { resetBulkModal(); setShowBulkModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </button>
          </div>
        }
      />

      {/* Assign Note */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
        <UserPlus className="w-4 h-4 flex-shrink-0" />
        <span>To assign assets to users, go to the</span>
        <a
          href={`#/${orgSlug}/audits`}
          className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          Audits page
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ASSET_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => { setStatusFilter(s.value); clearSelection(); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s.value
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(0); clearSelection(); }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Data Table */}
      {(() => {
        // Filter + sort + paginate
        let rows = assets as unknown as Record<string, unknown>[];
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          rows = rows.filter(item =>
            columns.some(col => {
              const val = item[col.key];
              return val && String(val).toLowerCase().includes(term);
            })
          );
        }
        const sorted = [...rows].sort((a, b) => {
          const aVal = a[sortKey] ?? '';
          const bVal = b[sortKey] ?? '';
          let cmp: number;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            cmp = aVal - bVal;
          } else {
            cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
          }
          return sortDir === 'asc' ? cmp : -cmp;
        });
        const totalPages = Math.ceil(sorted.length / pageSize);
        const pagedRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

        return (
          <div className="card card-gradient overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(String(r.id)))}
                        onChange={() => toggleSelectAll(pagedRows.map(r => String(r.id)))}
                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    {columns.map(col => {
                      const isSortable = (col as any).sortable !== false;
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
                  {pagedRows.map((item, idx) => {
                    const assetId = String(item.id);
                    const isSavingRow = inlineEditSaving === assetId;
                    return (
                    <tr
                      key={assetId || idx}
                      className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
                    >
                      <td
                        className="px-4 py-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(assetId)}
                          onChange={() => toggleSelect(assetId)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      {columns.map(col => {
                        const isAction = ACTION_COLUMNS.has(col.key);
                        const isActive = inlineEditCell?.assetId === assetId && inlineEditCell?.field === col.key;

                        if (isAction) {
                          return (
                            <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col.key}
                            className="px-4 py-3 whitespace-nowrap"
                            onClick={e => { e.stopPropagation(); if (!isSavingRow) setInlineEditCell({ assetId, field: col.key }); }}
                          >
                            {isActive ? (
                              <div onClick={e => e.stopPropagation()}>{renderInlineEdit(col.key, item)}</div>
                            ) : (
                              <span className="group inline-flex items-center gap-1 cursor-pointer">
                                <span className="text-gray-700 dark:text-gray-300">
                                  {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                                </span>
                                {isSavingRow ? (
                                  <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  {/* Empty placeholder rows (only for small page sizes) */}
                  {pageSize <= 10 && Array.from({ length: Math.max(0, pageSize - pagedRows.length) }, (_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-gray-100/60 dark:border-zinc-700/30">
                      <td className="px-4 py-3">&nbsp;</td>
                      {columns.map(col => (
                        <td key={col.key} className="px-4 py-3">&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(totalPages > 1 || pageSize !== 10) && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
                  </p>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {[10, 50, 100, 200, 500, 1000].map(n => (
                      <option key={n} value={n}>{n} rows</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = page < 3 ? i : page - 2 + i;
                    if (pageNum >= totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-emerald-600 text-white'
                            : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Create Asset Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Asset"
        size="full"
      >
        <DependencyNotice missing={[
          ...(departments.length === 0 ? [{ label: 'Create Departments', path: '/locations', pageName: 'Locations & Departments' }] : []),
          ...(locations.length === 0 ? [{ label: 'Create Locations', path: '/locations', pageName: 'Locations & Departments' }] : []),
        ]} />
        {createError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {createError}
          </div>
        )}
        {renderForm()}
        <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-zinc-700">
          <button onClick={() => { setShowCreateModal(false); setCreateError(''); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={!isFormValid || saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? 'Creating...' : 'Create Asset'}
          </button>
        </div>
      </Modal>

      {/* Detail / Edit Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setIsEditing(false); }}
        title={isEditing ? 'Edit Asset' : 'Asset Details'}
        size="xl"
      >
        {selectedAsset && !isEditing ? (
          /* Detail View */
          <div>
            {/* Edit button top-right */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="flex items-start gap-4">
                {/* Asset Images Gallery */}
                <div className="flex gap-2 flex-wrap items-start">
                  {(() => {
                    const imgUrls = selectedAsset.imageUrls?.length ? selectedAsset.imageUrls
                      : selectedAsset.imageUrl ? [selectedAsset.imageUrl] : [];
                    return (
                      <>
                        {imgUrls.map((url, i) => (
                          <div key={i} className="relative group/img w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-600 flex-shrink-0">
                            <img src={url} alt={selectedAsset.name} className="w-full h-full object-cover cursor-pointer"
                              onClick={() => window.open(url, '_blank')} />
                            <button
                              onClick={async () => {
                                const newUrls = imgUrls.filter((_, j) => j !== i);
                                const updated = await data.assets.update(selectedAsset.id, { imageUrls: newUrls } as Partial<Asset>);
                                if (updated) setSelectedAsset(updated);
                                deleteStorageFile('asset-images', url).catch(() => {});
                              }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                        {imgUrls.length === 0 && (
                          <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center border border-gray-200 dark:border-zinc-600 flex-shrink-0">
                            <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        {/* Add image button */}
                        <div className="flex-shrink-0">
                          <input type="file" accept="image/*" multiple className="hidden" ref={imageInputRef}
                            onChange={e => {
                              const files = Array.from(e.target.files || []);
                              if (files.length && selectedAsset) handleImageUpload(selectedAsset.id, files);
                              e.target.value = '';
                            }} />
                          <button onClick={() => imageInputRef.current?.click()}
                            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors">
                            {uploadingImageId === selectedAsset.id
                              ? <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              : <><Plus className="w-5 h-5" /><span className="text-xs">Add</span></>}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Asset Tag</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedAsset.assetTag}</p>
                </div>
              </div>
              <StatusBadge status={selectedAsset.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Name</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Type</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Category</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.category || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Brand</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.brand || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Model</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.model || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Serial Number</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.serialNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Asset Use</p>
                {selectedAsset.assetUse === 'personal'
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Personal</span>
                  : selectedAsset.assetUse === 'common'
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Common</span>
                  : <span className="text-sm text-gray-400 dark:text-gray-500">Not specified</span>}
              </div>
              {selectedAsset.processor && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Processor</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.processor}</p>
                </div>
              )}
              {selectedAsset.ram && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">RAM</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.ram}</p>
                </div>
              )}
              {selectedAsset.storage && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Storage</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.storage}</p>
                </div>
              )}
              {selectedAsset.graphicsCard && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Graphics Card</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.graphicsCard}</p>
                </div>
              )}
              {selectedAsset.screenSize && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Screen Size</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.screenSize}</p>
                </div>
              )}
              {selectedAsset.deviceName && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Device Name</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.deviceName}</p>
                </div>
              )}
              {selectedAsset.assignedEmployee && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Assigned Employee</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.assignedEmployee}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Location</p>
                <p className="text-sm text-gray-900 dark:text-white">{getLocationName(selectedAsset.locationId)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Department</p>
                <p className="text-sm text-gray-900 dark:text-white">{getDepartmentName(selectedAsset.departmentId)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Vendor</p>
                <p className="text-sm text-gray-900 dark:text-white">{getVendorName(selectedAsset.vendorId)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Purchase Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAsset.purchaseDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Purchase Cost</p>
                <p className="text-sm text-gray-900 dark:text-white font-semibold">
                  {selectedAsset.currency && selectedAsset.currency !== 'USD' && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">{selectedAsset.currency}</span>
                  )}
                  {formatCurrency(selectedAsset.purchaseCost, orgCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Warranty Start</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAsset.warrantyStart)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Warranty End</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedAsset.warrantyEnd)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Useful Life</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.usefulLifeYears} years</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Salvage Value</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(selectedAsset.salvageValue, orgCurrency)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Invoices / Documents</p>
                {(() => {
                  const invUrls = selectedAsset.invoiceUrls?.length ? selectedAsset.invoiceUrls
                    : selectedAsset.invoiceUrl ? [selectedAsset.invoiceUrl] : [];
                  return (
                    <div className="space-y-1.5">
                      {invUrls.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-zinc-700/40 rounded-lg">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline flex-1 truncate inline-flex items-center gap-1">
                            Invoice {i + 1} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                          <button
                            onClick={async () => {
                              const newUrls = invUrls.filter((_, j) => j !== i);
                              const updated = await data.assets.update(selectedAsset.id, { invoiceUrls: newUrls } as Partial<Asset>);
                              if (updated) setSelectedAsset(updated);
                              deleteStorageFile('invoices', url).catch(() => {});
                            }}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {invUrls.length === 0 && <p className="text-sm text-gray-400">No invoices uploaded</p>}
                      <div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple ref={invoiceInputRef} className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files || []);
                            files.forEach(f => handleInvoiceUpload(selectedAsset.id, f));
                            e.target.value = '';
                          }} />
                        <button
                          onClick={() => invoiceInputRef.current?.click()}
                          className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
                          <Upload className="w-3 h-3" /> Add Invoice
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Description</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedAsset.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(selectedAsset.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Last Updated</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(selectedAsset.updatedAt)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          /* Edit View */
          <div>
            {renderForm()}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={!formData.name || saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Asset"
        message={`Are you sure you want to delete "${selectedAsset?.name}" (${selectedAsset?.assetTag})? This action cannot be undone. The asset tag will be retired and cannot be reused.`}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Assets"
        message={`Are you sure you want to delete ${selectedIds.size} selected asset${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone. All asset tags will be retired and cannot be reused.`}
      />

      {/* QR Code Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => { setShowQRModal(false); setQRAsset(null); }}
        title="Asset QR Code"
        size="sm"
      >
        {qrAsset && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div>
              <p className="text-center text-lg font-bold text-gray-900 dark:text-white">{qrAsset.assetTag}</p>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">{qrAsset.name}</p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <QRCode
                id="qr-code-svg"
                value={[
                  organization?.name ? `Org: ${organization.name}` : '',
                  `Tag: ${qrAsset.assetTag}`,
                  `Name: ${qrAsset.name}`,
                  qrAsset.category ? `Category: ${qrAsset.category}` : '',
                  qrAsset.brand ? `Brand: ${qrAsset.brand}` : '',
                  qrAsset.model ? `Model: ${qrAsset.model}` : '',
                  qrAsset.serialNumber ? `S/N: ${qrAsset.serialNumber}` : '',
                  `Status: ${qrAsset.status.replace(/_/g, ' ')}`,
                  qrAsset.locationId ? `Location: ${getLocationName(qrAsset.locationId)}` : '',
                  qrAsset.departmentId ? `Dept: ${getDepartmentName(qrAsset.departmentId)}` : '',
                ].filter(Boolean).join('\n')}
                size={256}
                level="H"
              />
            </div>
            <button
              onClick={() => downloadQR(qrAsset)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download QR Code
            </button>
          </div>
        )}
      </Modal>

      {/* Activity Log Modal */}
      {auditAsset && (
        <ActivityLogModal
          asset={auditAsset}
          organization={organization}
          onClose={() => { setShowAuditModal(false); setAuditAsset(null); }}
          onAssetSwitch={(asset) => setAuditAsset(asset)}
        />
      )}

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title={
          bulkStep === 'upload' ? 'Bulk Import Assets' :
          bulkStep === 'sheet' ? 'Select Sheet' :
          bulkStep === 'mapping' ? 'Map Columns' :
          bulkStep === 'preview' ? 'Preview & Import' :
          'Importing...'
        }
        size="xl"
      >
        <div className="space-y-5">
          {/* Step indicator */}
          {!bulkDone && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {(['upload', 'sheet', 'mapping', 'preview'] as const).map((step, idx) => {
                const labels = ['Upload File', 'Select Sheet', 'Map Columns', 'Preview & Import'];
                const stepOrder = ['upload', 'sheet', 'mapping', 'preview'];
                const currentIdx = stepOrder.indexOf(bulkStep);
                const isActive = bulkStep === step;
                const isDone = idx < currentIdx;
                const isSkipped = step === 'sheet' && sheetNames.length <= 1;
                if (isSkipped) return null;
                return (
                  <React.Fragment key={step}>
                    {idx > 0 && !isSkipped && <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-600" />}
                    <button
                      type="button"
                      disabled={!isDone}
                      onClick={() => {
                        if (isDone) {
                          setBulkStep(step);
                          if (step === 'upload') { setBulkFile(null); setWorkbook(null); setSheetNames([]); setSelectedSheet(''); setRawHeaders([]); setRawData([]); setBulkParsed([]); setBulkErrors([]); if (fileInputRef.current) fileInputRef.current.value = ''; }
                          if (step === 'sheet') { setRawHeaders([]); setRawData([]); setBulkParsed([]); setBulkErrors([]); setSelectedSheet(''); }
                          if (step === 'mapping') { setBulkParsed([]); setBulkErrors([]); }
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                        isActive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                        isDone ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50' :
                        'bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-default'
                      }`}
                    >
                      {labels[idx]}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* STEP: Upload */}
          {bulkStep === 'upload' && (
            <>
              {/* Download template */}
              <div className="p-4 bg-gray-50 dark:bg-zinc-700/30 rounded-xl border border-gray-200 dark:border-zinc-600">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Download the CSV template</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use this template to format your data, or upload your own CSV / Excel file and map columns in the next step.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={downloadSampleCSV} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                      <FileDown className="w-4 h-4" /> CSV
                    </button>
                    <a href="/sample-asset-import.xlsx" download className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                      <FileDown className="w-4 h-4" /> Excel
                    </a>
                  </div>
                </div>
              </div>

              {/* Upload area with drag-and-drop */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    processFile(file);
                  }
                }}
                className="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl p-8 text-center hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors cursor-pointer"
              >
                <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                {bulkFile ? (
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{bulkFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Supports .csv, .xlsx, .xls files. Auto-detects columns.</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {bulkErrors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  {bulkErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP: Sheet Selection */}
          {bulkStep === 'sheet' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This file contains <span className="font-semibold text-gray-900 dark:text-white">{sheetNames.length} sheets</span>. Select the one that contains your asset data:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {sheetNames.map(name => {
                  const ws = workbook?.Sheets[name];
                  const rowCount = ws ? Math.max(0, (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]).filter(
                    (r, i) => i > 0 && r.some(c => String(c).trim() !== '')
                  ).length) : 0;
                  return (
                    <button
                      key={name}
                      onClick={() => handleSheetSelect(name)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedSheet === name
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-zinc-600 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rowCount} data row{rowCount !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP: Header Mapping */}
          {bulkStep === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Auto-detected columns from your file.
                    {selectedSheet && <span className="font-medium text-gray-900 dark:text-white"> Sheet: {selectedSheet}</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Only matched columns will be imported. Adjust mappings if needed.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Auto-matched</span>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-zinc-600 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-zinc-700/20 px-4 py-2.5 border-b border-gray-200 dark:border-zinc-600">
                  <span>System Field</span>
                  <span className="px-4"></span>
                  <span>Your File Column</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-700/50 max-h-[400px] overflow-y-auto">
                  {KNOWN_HEADERS.filter(h => h.key !== 'Sr. No.').map(expected => {
                    const status = getMatchStatus(expected.key);
                    return (
                      <div key={expected.key} className={`grid grid-cols-[1fr_auto_1fr] gap-0 items-center px-4 py-2.5 hover:bg-gray-50/50 dark:hover:bg-zinc-700/20 transition-colors ${status === 'matched' ? '' : 'opacity-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white">{expected.label}</span>
                        </div>
                        <div className="px-4">
                          {status === 'matched' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-zinc-600" />
                          )}
                        </div>
                        <select
                          value={headerMapping[expected.key] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHeaderMapping(prev => {
                              const next = { ...prev };
                              if (val) { next[expected.key] = val; } else { delete next[expected.key]; }
                              return next;
                            });
                          }}
                          className="w-full text-sm rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        >
                          <option value="">— Skip —</option>
                          {rawHeaders.filter(Boolean).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unmapped file columns — allow adding as custom fields */}
              {(() => {
                const mappedFileHeaders = new Set(Object.values(headerMapping).filter(Boolean));
                const unmapped = rawHeaders.filter(h => h && !mappedFileHeaders.has(h));
                if (unmapped.length === 0) return null;
                return (
                  <div className="border border-amber-200 dark:border-amber-700/50 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50">
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        Unmapped File Columns ({unmapped.length})
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Add as custom fields to include in import
                      </span>
                    </div>
                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30 max-h-[200px] overflow-y-auto">
                      {unmapped.map(header => {
                        const isAdded = customColumns.has(header);
                        return (
                          <div key={header} className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{header}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomColumns(prev => {
                                  const next = new Set(prev);
                                  if (isAdded) next.delete(header);
                                  else next.add(header);
                                  return next;
                                });
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                isAdded
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700'
                              }`}
                            >
                              {isAdded ? <CheckCircle className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                              {isAdded ? 'Added' : 'Add as custom field'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Quick summary */}
              {(() => {
                const matched = Object.keys(headerMapping).length;
                const total = KNOWN_HEADERS.length - 1; // exclude Sr. No.
                return (
                  <div className="p-3 rounded-xl text-sm flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {matched}/{total} columns auto-matched{customColumns.size > 0 ? ` + ${customColumns.size} custom field${customColumns.size !== 1 ? 's' : ''}` : ''}. Unmapped columns will be skipped.
                    </span>
                  </div>
                );
              })()}

              {bulkErrors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  {bulkErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP: Preview */}
          {bulkStep === 'preview' && !bulkDone && (() => {
            const activeCols = getActivePreviewColumns();
            const previewRows = bulkParsed.slice(0, 10);
            return (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{bulkParsed.length}</span> asset{bulkParsed.length !== 1 ? 's' : ''} detected
                    {isMultiAssetMode && <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">Multi-asset mode</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{activeCols.length} columns detected, showing first {previewRows.length} rows</p>
                </div>
                {isMultiAssetMode && assetGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {assetGroups.map((g, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{g.groupName}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Data preview table - only shows detected columns */}
              <div className="border border-gray-200 dark:border-zinc-600 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-200 dark:border-zinc-600">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">#</th>
                        {activeCols.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap uppercase text-[10px] tracking-wider">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-700/20">
                          <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono">{idx + 1}</td>
                          {activeCols.map(col => (
                            <td key={col} className="px-3 py-2 text-gray-900 dark:text-gray-200 whitespace-nowrap max-w-[200px] truncate">{row[col] || <span className="text-gray-300 dark:text-gray-600 italic text-[11px]">empty</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation */}
              {bulkErrors.length > 0 ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Validation errors found ({bulkErrors.length})</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {bulkErrors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700/50 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">All {bulkParsed.length} assets validated successfully. Ready to import.</p>
                </div>
              )}
            </div>
            );
          })()}

          {/* STEP: Importing / Done */}
          {(bulkStep === 'importing' || bulkDone) && (
            <div className="space-y-3">
              {bulkImporting && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700/50">
                  <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Importing assets... {bulkSuccess}/{bulkParsed.length}</p>
                    <div className="mt-2 h-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${(bulkSuccess / bulkParsed.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {bulkDone && bulkSuccess > 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700/50 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Successfully imported {bulkSuccess} asset{bulkSuccess !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}
              {bulkDone && bulkErrors.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 max-h-32 overflow-y-auto">
                  {bulkErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700">
            <div>
              {(bulkStep === 'sheet' || bulkStep === 'mapping' || bulkStep === 'preview') && !bulkDone && (
                <button
                  onClick={() => {
                    if (bulkStep === 'preview') { setBulkStep('mapping'); setBulkErrors([]); setBulkParsed([]); }
                    else if (bulkStep === 'mapping') { setBulkStep(sheetNames.length > 1 ? 'sheet' : 'upload'); }
                    else if (bulkStep === 'sheet') { setBulkStep('upload'); setBulkFile(null); setWorkbook(null); setSheetNames([]); setSelectedSheet(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors"
              >
                {bulkDone ? 'Close' : 'Cancel'}
              </button>
              {bulkStep === 'mapping' && (
                <button
                  onClick={proceedToPreview}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Eye className="w-4 h-4" /> Preview Data
                </button>
              )}
              {bulkStep === 'preview' && !bulkDone && (
                <button
                  onClick={handleBulkImport}
                  disabled={bulkParsed.length === 0 || bulkImporting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl btn-primary text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  Import {bulkParsed.length} Asset{bulkParsed.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
