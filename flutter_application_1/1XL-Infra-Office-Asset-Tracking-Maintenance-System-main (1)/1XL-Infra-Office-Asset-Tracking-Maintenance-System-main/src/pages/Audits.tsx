import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useOrgSlug } from '../hooks/useOrgSlug';
import { Modal } from '../components/ui';
import { AuditRow, AllocationStatus, WorkMode } from '../types';
import { formatDate, formatDateTime, formatCurrency, exportToCSV } from '../utils/helpers';
import QRCode from 'react-qr-code';
import {
  Search, Filter, Columns3, Download, QrCode, ChevronLeft, ChevronRight, ChevronDown,
  MoreVertical, Eye, Pencil, Printer, X, Check, RotateCcw, Lock,
  LayoutGrid, LayoutList, Minus, Plus, UserPlus, UserMinus, ArrowUp, ArrowDown,
  Settings2, FileText
} from 'lucide-react';
import { sendAssignmentEmail } from '../lib/assetAssignmentWebhook';

// ---- QR field options ----
const QR_FIELD_OPTIONS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'orgName',       label: 'Organization',   defaultOn: true  },
  { key: 'assetTag',      label: 'Asset Tag',      defaultOn: true  },
  { key: 'assetName',     label: 'Asset Name',     defaultOn: true  },
  { key: 'category',      label: 'Category',       defaultOn: true  },
  { key: 'status',        label: 'Status',         defaultOn: true  },
  { key: 'assignedTo',    label: 'Assigned To',    defaultOn: true  },
  { key: 'serialNumber',  label: 'Serial Number',  defaultOn: true  },
  { key: 'brand',         label: 'Brand',          defaultOn: true  },
  { key: 'model',         label: 'Model',          defaultOn: true  },
  { key: 'departmentName',label: 'Department',     defaultOn: true  },
  { key: 'locationName',  label: 'Location',       defaultOn: true  },
  { key: 'purchaseCost',  label: 'Purchase Cost',  defaultOn: false },
  { key: 'purchaseDate',  label: 'Purchase Date',  defaultOn: false },
];
const DEFAULT_QR_FIELDS = new Set(QR_FIELD_OPTIONS.filter(f => f.defaultOn).map(f => f.key));

// ---- QR helpers ----
function buildQRData(_row: AuditRow, _fields: Set<string>, _orgName = '', scanUrl = ''): string {
  // QR code encodes only the scan URL so phones detect it as a clickable link
  return scanUrl;
}

function buildScanUrl(orgSlug: string, assetId: string): string {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
  // HashRouter: URLs look like  origin/#/orgSlug/scan/assetId
  return `${base}#/${orgSlug}/scan/${assetId}`;
}

type QRLayout = 'grid' | 'vertical' | 'horizontal';
type QRAlign = 'left' | 'center' | 'right';
type QRVAlign = 'top' | 'center' | 'bottom';

type PaperSize = 'A4' | 'Letter' | 'A3';
const PAPER_SIZES: Record<PaperSize, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: 'A4 (210 × 297 mm)' },
  Letter: { w: 216, h: 279, label: 'Letter (216 × 279 mm)' },
  A3: { w: 297, h: 420, label: 'A3 (297 × 420 mm)' },
};

interface QRPrintSettings {
  layout: QRLayout;
  columns: number;
  labelScale: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  paperSize: PaperSize;
  alignH: QRAlign;
  alignV: QRVAlign;
}

const DEFAULT_QR_SETTINGS: QRPrintSettings = {
  layout: 'vertical',
  columns: 3,
  labelScale: 1,
  labelWidthMm: 53,
  labelHeightMm: 29,
  alignH: 'center',
  alignV: 'top',
  marginTop: 13,
  marginBottom: 13,
  marginLeft: 10,
  marginRight: 10,
  paperSize: 'A4',
};

// ---- Column definitions ----
interface ColumnDef {
  key: keyof AuditRow;
  label: string;
  defaultVisible: boolean;
  render?: (row: AuditRow) => React.ReactNode;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  allocated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  retired: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400',
  disposed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'assetTag', label: 'Asset Tag', defaultVisible: true },
  { key: 'assetName', label: 'Asset Name', defaultVisible: true },
  {
    key: 'allocationDate', label: 'Allocation Date', defaultVisible: true,
    render: (row) => row.allocationDate ? formatDateTime(row.allocationDate) : '-',
  },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: false },
  {
    key: 'status', label: 'Status', defaultVisible: true,
    render: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700'}`}>
        {row.status.replace('_', ' ')}
      </span>
    ),
  },
  { key: 'assignedTo', label: 'Assigned To', defaultVisible: true },
  {
    key: 'workMode', label: 'Work Mode', defaultVisible: true,
    render: (row) => {
      if (!row.workMode) return <span className="text-gray-400">-</span>;
      return row.workMode === 'wfo'
        ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Work from Office</span>
        : <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Work from Home</span>;
    },
  },
  { key: 'assignedToEmail', label: 'Email', defaultVisible: false },
  { key: 'departmentName', label: 'Department', defaultVisible: true },
  { key: 'locationName', label: 'Location', defaultVisible: true },
  { key: 'serialNumber', label: 'Serial Number', defaultVisible: false },
  { key: 'brand', label: 'Brand', defaultVisible: false },
  { key: 'model', label: 'Model', defaultVisible: false },
  {
    key: 'purchaseCost', label: 'Purchase Cost', defaultVisible: false,
    render: (row) => formatCurrency(row.purchaseCost),
  },
  {
    key: 'purchaseDate', label: 'Purchase Date', defaultVisible: false,
    render: (row) => row.purchaseDate ? formatDate(row.purchaseDate) : '-',
  },
];

export default function Audits() {
  const { user, isGlobalAdmin, organization } = useAuth();
  const orgCurrency = organization?.currency || 'USD';
  const data = useData();
  const { canAccess, plan } = useSubscription();
  const orgSlug = useOrgSlug();

  // ---- State ----
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [qrSettings, setQrSettings] = useState<QRPrintSettings>({ ...DEFAULT_QR_SETTINGS });
  const [detailRow, setDetailRow] = useState<AuditRow | null>(null);
  const [qrSingleRow, setQrSingleRow] = useState<AuditRow | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [qrFields, setQrFields] = useState<Set<string>>(new Set(DEFAULT_QR_FIELDS));
  const [qrFieldsOpen, setQrFieldsOpen] = useState(false);
  const [qrPanel, setQrPanel] = useState<'layout' | 'page' | 'fields' | null>(null);
  const [lockOnePerPage, setLockOnePerPage] = useState(false);
  const qrToolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!qrPanel) return;
    const onDown = (e: MouseEvent) => {
      if (qrToolbarRef.current && !qrToolbarRef.current.contains(e.target as Node)) setQrPanel(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [qrPanel]);
  const [draftDims, setDraftDims] = useState<Record<string, string>>({
    labelWidthMm:  String(DEFAULT_QR_SETTINGS.labelWidthMm),
    labelHeightMm: String(DEFAULT_QR_SETTINGS.labelHeightMm),
    marginTop:     String(DEFAULT_QR_SETTINGS.marginTop),
    marginBottom:  String(DEFAULT_QR_SETTINGS.marginBottom),
    marginLeft:    String(DEFAULT_QR_SETTINGS.marginLeft),
    marginRight:   String(DEFAULT_QR_SETTINGS.marginRight),
  });

  function commitDim(field: string, raw: string, min: number, max: number) {
    const v = Math.min(max, Math.max(min, parseInt(raw) || min));
    setQrSettings(s => ({ ...s, [field]: v }));
    setDraftDims(d => ({ ...d, [field]: String(v) }));
  }
  function stepDim(field: string, delta: number, min: number, max: number) {
    setQrSettings(s => {
      const v = Math.min(max, Math.max(min, (s[field as keyof QRPrintSettings] as number) + delta));
      setDraftDims(d => ({ ...d, [field]: String(v) }));
      return { ...s, [field]: v };
    });
  }
  const [assignRow, setAssignRow] = useState<AuditRow | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignLocationId, setAssignLocationId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignWorkMode, setAssignWorkMode] = useState<WorkMode | ''>('');
  const [quickEditCell, setQuickEditCell] = useState<{ assetId: string; field: string } | null>(null);
  const [quickEditSaving, setQuickEditSaving] = useState<string | null>(null);
  const [allocDateWarning, setAllocDateWarning] = useState<{ assetTag: string; assetName: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', category: '', type: '' as string, status: '' as string,
    serialNumber: '', brand: '', model: '',
    locationId: '', departmentId: '', workMode: '' as string,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openDetailModal = (row: AuditRow, edit = false) => {
    setDetailRow(row);
    setIsEditing(edit);
    const asset = data.assets.getAll().find(a => a.id === row.assetId);
    const activeAlloc = data.allocations.getAll().find(
      a => a.assetId === row.assetId && (a.status === 'active' || a.status === 'approved')
    );
    setEditForm({
      name: asset?.name || row.assetName,
      category: asset?.category || row.category,
      type: asset?.type || row.type,
      status: asset?.status || row.status,
      serialNumber: asset?.serialNumber || row.serialNumber,
      brand: asset?.brand || row.brand,
      model: asset?.model || row.model,
      locationId: asset?.locationId || '',
      departmentId: asset?.departmentId || '',
      workMode: (asset?.customFields?.work_mode as string) || '',
    });
  };

  const handleEditSave = async () => {
    if (!detailRow) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      // Merge work_mode into existing customFields (no DB migration needed)
      const existingCF = data.assets.getById(detailRow.assetId)?.customFields || {};
      const wm = editForm.workMode === 'wfo' ? 'wfo' : editForm.workMode === 'wfh' ? 'wfh' : null;

      // Update asset fields + work_mode stored in customFields
      await data.assets.update(detailRow.assetId, {
        name: editForm.name,
        category: editForm.category,
        type: editForm.type as any,
        status: editForm.status as any,
        serialNumber: editForm.serialNumber,
        brand: editForm.brand,
        model: editForm.model,
        locationId: editForm.locationId || undefined,
        departmentId: editForm.departmentId || undefined,
        customFields: { ...existingCF, ...(wm ? { work_mode: wm } : {}) },
      });

      await data.addAuditLog(
        user!.id, user!.name, 'Edited asset from audit', 'audits',
        detailRow.assetId, 'asset',
        `Edited ${detailRow.assetName} (${detailRow.assetTag}) from audit page`
      );

      setDetailRow(null);
      setIsEditing(false);
      refresh();
    } catch (err: any) {
      console.error('[Audit Edit] Save failed:', err);
      setEditError(err?.message || 'Save failed. Please check the database migration has been applied.');
    } finally {
      setSavingEdit(false);
    }
  };
  const [saving, setSaving] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const refresh = () => setRefreshCounter(c => c + 1);

  // ---- Sorting ----
  const [sortKey, setSortKey] = useState<keyof AuditRow>('allocationDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: keyof AuditRow) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const [filters, setFilters] = useState({
    status: 'all' as string,
    type: 'all' as string,
    department: 'all' as string,
    location: 'all' as string,
    assigned: 'all' as 'all' | 'assigned' | 'unassigned',
    workMode: 'all' as 'all' | 'wfo' | 'wfh',
  });

  const [pageSize, setPageSize] = useState(10);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ---- Derive audit rows from existing data ----
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const auditRows = useMemo<AuditRow[]>(() => {
    const assets = data.assets.getAll();
    const allocations = data.allocations.getAll();
    const users = data.users.getAll();
    const locations = data.locations.getAll();
    const departments = data.departments.getAll();

    return assets.map(asset => {
      const activeAlloc = allocations.find(
        a => a.assetId === asset.id && (a.status === 'active' || a.status === 'approved')
      );
      const assignedUser = activeAlloc ? users.find(u => u.id === activeAlloc.employeeId) : null;
      const location = locations.find(l => l.id === asset.locationId);
      const department = departments.find(d => d.id === asset.departmentId);

      return {
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        category: asset.category,
        type: asset.type,
        status: asset.status,
        serialNumber: asset.serialNumber,
        brand: asset.brand,
        model: asset.model,
        locationName: location?.name || '-',
        departmentName: department?.name || '-',
        assignedTo: assignedUser?.name || 'Unassigned',
        assignedToEmail: assignedUser?.email || '',
        allocationStatus: activeAlloc ? activeAlloc.status : 'unassigned',
        allocationDate: activeAlloc?.startDate || '',
        purchaseCost: asset.purchaseCost,
        purchaseDate: asset.purchaseDate,
        workMode: (asset.customFields?.work_mode as WorkMode) || null,
      };
    });
  }, [data, refreshCounter]);

  // ---- Filter + Search ----
  const filteredRows = useMemo(() => {
    let rows = auditRows;

    // Apply filters
    if (filters.status !== 'all') rows = rows.filter(r => r.status === filters.status);
    if (filters.type !== 'all') rows = rows.filter(r => r.type === filters.type);
    if (filters.department !== 'all') rows = rows.filter(r => r.departmentName === filters.department);
    if (filters.location !== 'all') rows = rows.filter(r => r.locationName === filters.location);
    if (filters.assigned === 'assigned') rows = rows.filter(r => r.assignedTo !== 'Unassigned');
    if (filters.assigned === 'unassigned') rows = rows.filter(r => r.assignedTo === 'Unassigned');
    if (filters.workMode !== 'all') rows = rows.filter(r => r.workMode === filters.workMode);

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(row => {
        if (searchField === 'all') {
          return Object.values(row).some(v => String(v).toLowerCase().includes(term));
        }
        return String(row[searchField as keyof AuditRow] ?? '').toLowerCase().includes(term);
      });
    }

    // Apply sorting
    rows.sort((a, b) => {
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

    return rows;
  }, [auditRows, filters, searchTerm, searchField, sortKey, sortDir]);

  // ---- Pagination ----
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const pagedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

  // ---- Selection helpers ----
  const allPageSelected = pagedRows.length > 0 && pagedRows.every(r => selectedRows.has(r.assetId));

  const toggleSelectAll = useCallback(() => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pagedRows.forEach(r => next.delete(r.assetId));
      } else {
        pagedRows.forEach(r => next.add(r.assetId));
      }
      return next;
    });
  }, [allPageSelected, pagedRows]);

  const toggleRow = useCallback((assetId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(assetId) ? next.delete(assetId) : next.add(assetId);
      return next;
    });
  }, []);

  // ---- Column visibility ----
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllColumns = () => setVisibleColumns(new Set(ALL_COLUMNS.map(c => c.key)));
  const resetColumns = () => setVisibleColumns(new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)));

  const filteredColumnList = ALL_COLUMNS.filter(c =>
    c.label.toLowerCase().includes(columnSearch.toLowerCase())
  );

  const allColumnsSelected = ALL_COLUMNS.every(c => visibleColumns.has(c.key));

  // ---- Quick Assign / Unassign ----
  const allUsers = data.users.getAll().filter(u => u.isActive);
  const allDepartments = data.departments.getAll();

  const openAssignModal = (row: AuditRow) => {
    setAssignRow(row);
    setAssignUserId('');
    setAssignDeptId('');
    setAssignLocationId(row.locationName !== '-' ? (data.locations.getAll().find(l => l.name === row.locationName)?.id || '') : '');
    setAssignNotes('');
    setAssignWorkMode('');
    setActionMenuId(null);
  };

  const handleQuickAssign = async () => {
    if (!assignRow || !assignUserId || !assignDeptId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Create allocation directly as 'active' (skip approval)
      await data.allocations.create({
        assetId: assignRow.assetId,
        employeeId: assignUserId,
        departmentId: assignDeptId,
        startDate: now,
        endDate: null,
        status: 'active' as AllocationStatus,
        approvedBy: user!.id,
        approvalDate: now,
        returnDate: null,
        returnCondition: null,
        notes: assignNotes,
        createdAt: now,
      });
      // Mark asset as allocated, update location, and save work_mode in customFields
      const existingAssetCF = data.assets.getById(assignRow.assetId)?.customFields || {};
      const assetUpdate: Record<string, any> = {
        status: 'allocated',
        customFields: { ...existingAssetCF, work_mode: assignWorkMode || null },
      };
      if (assignLocationId) assetUpdate.locationId = assignLocationId;
      await data.assets.update(assignRow.assetId, assetUpdate);
      // Audit log
      const assignedUser = allUsers.find(u => u.id === assignUserId);
      await data.addAuditLog(
        user!.id, user!.name, 'Quick assigned asset', 'audits',
        assignRow.assetId, 'allocation',
        `Assigned ${assignRow.assetName} (${assignRow.assetTag}) to ${assignedUser?.name || 'user'}`
      );
      // Fire-and-forget: send assignment email with acknowledgement form
      if (assignedUser) {
        const asset = data.assets.getAll().find(a => a.id === assignRow.assetId);
        const dept = allDepartments.find(d => d.id === assignDeptId);
        const loc = data.locations.getAll().find(l => l.id === (assignLocationId || asset?.locationId));
        sendAssignmentEmail({
          employeeName: assignedUser.name, employeeEmail: assignedUser.email, employeePhone: assignedUser.phone || '',
          employeeRole: assignedUser.role, department: dept?.name || '',
          assetName: assignRow.assetName, assetTag: assignRow.assetTag, assetType: asset?.type || '',
          assetCategory: asset?.category || '', serialNumber: asset?.serialNumber || '',
          brand: asset?.brand || '', model: asset?.model || '', location: loc?.name || '',
          assignedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          assignedBy: user!.name, notes: assignNotes || '', orgName: organization?.name || '',
        }).catch(() => {});
      }
      setAssignRow(null);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (row: AuditRow) => {
    if (row.assignedTo === 'Unassigned') return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Find the active allocation for this asset
      const activeAlloc = data.allocations.getAll().find(
        a => a.assetId === row.assetId && (a.status === 'active' || a.status === 'approved')
      );
      if (activeAlloc) {
        await data.allocations.update(activeAlloc.id, {
          status: 'returned' as AllocationStatus,
          returnDate: now,
          returnCondition: 'Good',
        });
      }
      await data.assets.update(row.assetId, { status: 'available' });
      await data.addAuditLog(
        user!.id, user!.name, 'Unassigned asset', 'audits',
        row.assetId, 'allocation',
        `Unassigned ${row.assetName} (${row.assetTag}) from ${row.assignedTo}`
      );
      setActionMenuId(null);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  // ---- Quick field edit ----
  const QUICK_EDIT_FIELDS = new Set([
    'assetTag', 'assetName', 'category', 'type', 'status', 'assignedTo', 'workMode',
    'assignedToEmail', 'departmentName', 'locationName', 'serialNumber', 'brand', 'model',
    'allocationDate', 'purchaseCost', 'purchaseDate',
  ]);

  const handleQuickFieldSave = async (row: AuditRow, field: string, value: string) => {
    setQuickEditSaving(row.assetId);
    setQuickEditCell(null);
    try {
      const existingCF = { ...((data.assets.getById(row.assetId)?.customFields || {}) as Record<string, string>) };

      if (field === 'assetName') {
        await data.assets.update(row.assetId, { name: value });
      } else if (field === 'assetTag') {
        await data.assets.update(row.assetId, { assetTag: value });
      } else if (field === 'category') {
        await data.assets.update(row.assetId, { category: value });
      } else if (field === 'type') {
        await data.assets.update(row.assetId, { type: value as any });
      } else if (field === 'serialNumber') {
        await data.assets.update(row.assetId, { serialNumber: value });
      } else if (field === 'brand') {
        await data.assets.update(row.assetId, { brand: value });
      } else if (field === 'model') {
        await data.assets.update(row.assetId, { model: value });
      } else if (field === 'purchaseCost') {
        await data.assets.update(row.assetId, { purchaseCost: parseFloat(value) || 0 });
      } else if (field === 'purchaseDate') {
        await data.assets.update(row.assetId, { purchaseDate: value });
      } else if (field === 'allocationDate') {
        const activeAlloc = data.allocations.getAll().find(
          a => a.assetId === row.assetId && (a.status === 'active' || a.status === 'approved')
        );
        if (activeAlloc) {
          await data.allocations.update(activeAlloc.id, { startDate: value });
        } else if (value) {
          setAllocDateWarning({ assetTag: row.assetTag, assetName: row.assetName });
          return;
        }
      } else if (field === 'assignedToEmail') {
        // Email is derived from user, not directly editable on asset
      } else if (field === 'status') {
        await data.assets.update(row.assetId, { status: value as any });
      } else if (field === 'workMode') {
        if (value === 'wfo' || value === 'wfh') existingCF.work_mode = value;
        else delete existingCF.work_mode;
        await data.assets.update(row.assetId, { customFields: existingCF });
      } else if (field === 'departmentName') {
        await data.assets.update(row.assetId, { departmentId: value || undefined });
      } else if (field === 'locationName') {
        await data.assets.update(row.assetId, { locationId: value || undefined });
      } else if (field === 'assignedTo') {
        const now = new Date().toISOString();
        const activeAlloc = data.allocations.getAll().find(
          a => a.assetId === row.assetId && (a.status === 'active' || a.status === 'approved')
        );
        if (!value) {
          if (activeAlloc) {
            await data.allocations.update(activeAlloc.id, { status: 'returned' as AllocationStatus, returnDate: now });
            await data.assets.update(row.assetId, { status: 'available' });
          }
        } else if (activeAlloc) {
          await data.allocations.update(activeAlloc.id, { employeeId: value });
        } else {
          await data.allocations.create({
            assetId: row.assetId,
            employeeId: value,
            departmentId: data.assets.getById(row.assetId)?.departmentId || '',
            startDate: now,
            endDate: null,
            status: 'active' as AllocationStatus,
            approvedBy: user!.id,
            approvalDate: now,
            returnDate: null,
            returnCondition: null,
            notes: '',
            createdAt: now,
          });
          await data.assets.update(row.assetId, { status: 'allocated' });
        }
      }

      await data.addAuditLog(
        user!.id, user!.name, `Quick updated ${field}`, 'audits',
        row.assetId, 'asset',
        `Updated ${field} for ${row.assetName} (${row.assetTag})`
      );
      refresh();
    } catch (err) {
      console.error('Quick field save failed:', err);
    } finally {
      setQuickEditSaving(null);
    }
  };

  const selectCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[130px]';

  const renderQuickEditSelect = (field: string, row: AuditRow) => {
    if (field === 'status') {
      return (
        <select autoFocus value={row.status} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'status', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          {['available','allocated','in_use','under_maintenance','retired','disposed'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
    if (field === 'workMode') {
      return (
        <select autoFocus value={row.workMode || ''} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'workMode', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          <option value="">Not set</option>
          <option value="wfo">Work from Office</option>
          <option value="wfh">Work from Home</option>
        </select>
      );
    }
    if (field === 'assignedTo') {
      const currentUserId = data.allocations.getAll().find(
        a => a.assetId === row.assetId && (a.status === 'active' || a.status === 'approved')
      )?.employeeId || '';
      return (
        <select autoFocus value={currentUserId} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'assignedTo', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          <option value="">Unassigned</option>
          {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    }
    if (field === 'departmentName') {
      const currentDeptId = data.assets.getById(row.assetId)?.departmentId || '';
      return (
        <select autoFocus value={currentDeptId} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'departmentName', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          <option value="">No department</option>
          {allDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      );
    }
    if (field === 'locationName') {
      const currentLocId = data.assets.getById(row.assetId)?.locationId || '';
      return (
        <select autoFocus value={currentLocId} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'locationName', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          <option value="">No location</option>
          {data.locations.getAll().map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      );
    }
    if (field === 'type') {
      return (
        <select autoFocus value={row.type} className={selectCls}
          onChange={e => handleQuickFieldSave(row, 'type', e.target.value)}
          onBlur={() => setQuickEditCell(null)}>
          {['furniture','it_equipment','vehicle','electronics','office_equipment','hvac','infrastructure','other'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
    // Text fields
    const textFields = ['assetTag', 'assetName', 'category', 'serialNumber', 'brand', 'model', 'assignedToEmail'];
    if (textFields.includes(field)) {
      const inputCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[120px]';
      return (
        <input
          autoFocus
          type="text"
          defaultValue={String(row[field as keyof AuditRow] ?? '')}
          className={inputCls}
          onKeyDown={e => {
            if (e.key === 'Enter') handleQuickFieldSave(row, field, (e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setQuickEditCell(null);
          }}
          onBlur={e => handleQuickFieldSave(row, field, e.target.value)}
        />
      );
    }
    // Date fields
    if (field === 'allocationDate' || field === 'purchaseDate') {
      const inputCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500';
      const current = String(row[field as keyof AuditRow] ?? '').split('T')[0];
      return (
        <input
          autoFocus
          type="date"
          defaultValue={current}
          className={inputCls}
          onChange={e => handleQuickFieldSave(row, field, e.target.value)}
          onBlur={() => setQuickEditCell(null)}
        />
      );
    }
    // Number fields
    if (field === 'purchaseCost') {
      const inputCls = 'px-2 py-1 text-xs rounded-lg border border-emerald-400 bg-white dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-[100px]';
      return (
        <input
          autoFocus
          type="number"
          step="0.01"
          defaultValue={row.purchaseCost || 0}
          className={inputCls}
          onKeyDown={e => {
            if (e.key === 'Enter') handleQuickFieldSave(row, field, (e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setQuickEditCell(null);
          }}
          onBlur={e => handleQuickFieldSave(row, field, e.target.value)}
        />
      );
    }
    return null;
  };

  // ---- Export ----
  const handleExport = () => {
    const exportData = filteredRows.map((r, idx) => {
      const obj: Record<string, unknown> = { '#': idx + 1 };
      ALL_COLUMNS.forEach(col => {
        if (visibleColumns.has(col.key)) {
          obj[col.label] = r[col.key];
        }
      });
      return obj;
    });
    exportToCSV(exportData, 'asset-audits');
  };

  // ---- QR selected rows ----
  const selectedAuditRows = useMemo(
    () => auditRows.filter(r => selectedRows.has(r.assetId)),
    [auditRows, selectedRows]
  );

  const qrBatchLimit = plan?.qrBatchLimit ?? 10;
  const hasBulkQr = canAccess('hasBulkQrExport');

  const handleGenerateQR = () => {
    if (!hasBulkQr && selectedRows.size > qrBatchLimit) {
      alert(`Your plan allows up to ${qrBatchLimit} QR labels at once. Upgrade to Premium for unlimited.`);
      return;
    }
    setShowQRPreview(true);
  };

  // ---- Print ----
  const getGridCols = () => {
    if (qrSettings.layout === 'vertical') return 1;
    if (qrSettings.layout === 'horizontal') return selectedAuditRows.length;
    return qrSettings.columns;
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const cols = getGridCols();

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const { marginTop, marginBottom, marginLeft, marginRight, labelWidthMm, labelHeightMm } = qrSettings;
    const paperRaw = PAPER_SIZES[qrSettings.paperSize];
    const isLandscape = qrSettings.layout === 'horizontal';
    const paper = isLandscape ? { w: paperRaw.h, h: paperRaw.w } : paperRaw;
    const printableW = paper.w - marginLeft - marginRight;
    const printableH = paper.h - marginTop - marginBottom;
    const gapMm = 3;
    const maxCols = Math.max(1, Math.floor((printableW + gapMm) / (labelWidthMm + gapMm)));
    const maxRows = Math.max(1, Math.floor((printableH + gapMm) / (labelHeightMm + gapMm)));
    // Lock = exactly one centered label per page, regardless of layout.
    const fitCols = lockOnePerPage ? 1 : (qrSettings.layout === 'vertical' ? 1 : qrSettings.layout === 'horizontal' ? maxCols : Math.min(cols, maxCols));
    const fitRows = lockOnePerPage ? 1 : (qrSettings.layout === 'horizontal' ? 1 : maxRows);
    const labelsPerPage = fitCols * fitRows;

    // Compute alignment for print (lock overrides to center)
    const justifyItems = lockOnePerPage
      ? 'center'
      : qrSettings.layout === 'vertical'
        ? (qrSettings.alignH === 'left' ? 'start' : qrSettings.alignH === 'right' ? 'end' : 'center')
        : 'start';
    const alignItems = lockOnePerPage
      ? 'center'
      : qrSettings.layout === 'horizontal'
        ? (qrSettings.alignV === 'top' ? 'start' : qrSettings.alignV === 'bottom' ? 'end' : 'center')
        : 'start';

    // Same proportional formulas as the preview (in mm so print and preview match physically).
    const qrSizeMm = Math.min(labelWidthMm * 0.45, labelHeightMm * 0.7);
    const fontSizeMm = labelHeightMm * 0.16;
    const headerFontMm = labelHeightMm * 0.12;
    const headerPadMm = labelHeightMm * 0.06;
    const bodyPadMm = labelHeightMm * 0.08;
    const bodyGapMm = labelWidthMm * 0.04;

    // Build pages of labels from innerHTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = printContent.innerHTML;
    const labelCards = tempDiv.querySelectorAll('.label-card');

    // Lock + horizontal layout: force vertical layout (one per page, centered) so flex doesn't try to wrap.
    const printLayoutHorizontal = qrSettings.layout === 'horizontal' && !lockOnePerPage;

    let pagesHtml = '';
    for (let i = 0; i < labelCards.length; i += labelsPerPage) {
      const pageLabels = Array.from(labelCards).slice(i, i + labelsPerPage);
      const labelsHtml = pageLabels.map(el => el.outerHTML).join('\n');
      pagesHtml += `<div class="print-page"><div class="label-grid">${labelsHtml}</div></div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fixed Asset Labels</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          @page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm; }
          .print-page {
            width: ${printableW}mm;
            min-height: ${printableH}mm;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-after: always;
          }
          .print-page:last-child { page-break-after: auto; }
          .label-grid {
            display: ${printLayoutHorizontal ? 'flex' : 'grid'};
            ${printLayoutHorizontal
              ? `flex-wrap: wrap; align-items: ${alignItems}; justify-content: center;`
              : `grid-template-columns: repeat(${fitCols}, auto); justify-items: ${justifyItems}; justify-content: center; align-content: ${alignItems};`}
            gap: ${gapMm}mm;
          }
          .label-card {
            border: 0.3mm solid #1f2937;
            border-radius: 1mm;
            overflow: hidden;
            width: ${labelWidthMm}mm;
            height: ${labelHeightMm}mm;
            display: flex;
            flex-direction: column;
          }
          .label-header {
            border-bottom: 0.3mm solid #1f2937;
            text-align: center;
            padding: ${headerPadMm}mm 1mm;
            font-size: ${headerFontMm}mm;
            font-weight: 700;
            letter-spacing: 0.3px;
            color: #1f2937;
            background: #f3f4f6;
            line-height: 1.1;
            flex-shrink: 0;
          }
          .label-body {
            display: flex;
            align-items: center;
            gap: ${bodyGapMm}mm;
            padding: ${bodyPadMm}mm;
            background: white;
            flex: 1;
            min-height: 0;
          }
          .label-body svg {
            flex-shrink: 0;
            width: ${qrSizeMm}mm;
            height: ${qrSizeMm}mm;
          }
          .label-tag {
            font-family: monospace;
            font-weight: 700;
            font-size: ${fontSizeMm}mm;
            color: #1f2937;
            line-height: 1.1;
            word-break: break-all;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleApplyFullPage = () => {
    const paperRaw = PAPER_SIZES[qrSettings.paperSize];
    const margin = 10;
    const labelW = paperRaw.w - margin * 2; // 190mm on A4
    const labelH = 79; // keep label proportions — rectangular, not full height
    // Center vertically: set top margin so label lands in the middle
    const topMargin = Math.round((paperRaw.h - labelH) / 2);
    const bottomMargin = paperRaw.h - labelH - topMargin;
    setQrSettings(s => ({
      ...s,
      layout: 'vertical',
      columns: 1,
      labelWidthMm: labelW,
      labelHeightMm: labelH,
      labelScale: 1.25,
      alignH: 'center',
      alignV: 'center',
      marginTop: topMargin,
      marginBottom: bottomMargin,
      marginLeft: margin,
      marginRight: margin,
    }));
    setDraftDims({
      labelWidthMm: String(labelW),
      labelHeightMm: String(labelH),
      marginTop: String(topMargin),
      marginBottom: String(bottomMargin),
      marginLeft: String(margin),
      marginRight: String(margin),
    });
  };

  // ---- Unique filter options ----
  const uniqueStatuses = [...new Set(auditRows.map(r => r.status))];
  const uniqueTypes = [...new Set(auditRows.map(r => r.type))];
  const uniqueDepartments = [...new Set(auditRows.map(r => r.departmentName).filter(d => d !== '-'))];
  const uniqueLocations = [...new Set(auditRows.map(r => r.locationName).filter(l => l !== '-'))];

  // ---- Feature gate: show upgrade prompt if plan doesn't have audit page ----
  if (!canAccess('hasAuditPage')) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upgrade Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The Audits page is available on Pro and Premium plans. Upgrade your subscription to track asset assignments, generate QR labels, and more.
          </p>
          <div className="inline-flex gap-3">
            <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              Current: <span className="font-semibold capitalize">{plan?.displayName || 'Beginner'}</span>
            </div>
            <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.key));

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredRows.length} asset{filteredRows.length !== 1 ? 's' : ''} tracked
            {selectedRows.size > 0 && ` \u00b7 ${selectedRows.size} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleGenerateQR}
            disabled={selectedRows.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <QrCode className="w-4 h-4" />
            Generate QR Labels
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Search By */}
        <select
          value={searchField}
          onChange={e => setSearchField(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Search by</option>
          <option value="assetTag">Asset Tag</option>
          <option value="assetName">Asset Name</option>
          <option value="assignedTo">Assigned To</option>
          <option value="category">Category</option>
          <option value="serialNumber">Serial Number</option>
          <option value="departmentName">Department</option>
          <option value="locationName">Location</option>
        </select>

        {/* Filters toggle */}
        {canAccess('hasAdvancedFilters') && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        )}

        {/* Select Columns */}
        {canAccess('hasColumnCustomization') && (
          <div className="relative" ref={columnPickerRef}>
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                showColumnPicker
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600'
              }`}
            >
              <Columns3 className="w-4 h-4" />
              Select Columns
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 py-2">
                {/* Column search */}
                <div className="px-3 pb-2 border-b border-gray-100/60 dark:border-zinc-700/30">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search"
                      value={columnSearch}
                      onChange={e => setColumnSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg bg-gray-50 dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Select All */}
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 cursor-pointer border-b border-gray-100/60 dark:border-zinc-700/30">
                  <input
                    type="checkbox"
                    checked={allColumnsSelected}
                    onChange={() => allColumnsSelected ? resetColumns() : selectAllColumns()}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-500 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Select All</span>
                </label>

                {/* Column list */}
                <div className="max-h-64 overflow-y-auto py-1">
                  {filteredColumnList.map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 cursor-pointer"
                    >
                      <span className="text-gray-400 dark:text-gray-500 cursor-grab">::</span>
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-500 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                    </label>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-3 pt-2 border-t border-gray-100 dark:border-zinc-700">
                  <button
                    onClick={resetColumns}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowColumnPicker(false)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && canAccess('hasAdvancedFilters') && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
            <select
              value={filters.department}
              onChange={e => { setFilters(f => ({ ...f, department: e.target.value })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Departments</option>
              {uniqueDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
            <select
              value={filters.location}
              onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assignment</label>
            <select
              value={filters.assigned}
              onChange={e => { setFilters(f => ({ ...f, assigned: e.target.value as 'all' | 'assigned' | 'unassigned' })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Work Mode</label>
            <select
              value={filters.workMode}
              onChange={e => { setFilters(f => ({ ...f, workMode: e.target.value as 'all' | 'wfo' | 'wfh' })); setPage(0); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All</option>
              <option value="wfo">Work from Office</option>
              <option value="wfh">Work from Home</option>
            </select>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card card-gradient overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-500 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                {visibleCols.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider text-center">Assign</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12 text-center">QR</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-10">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, idx) => (
                  <tr
                    key={row.assetId}
                    className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.assetId)}
                        onChange={() => toggleRow(row.assetId)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-500 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td
                      className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
                      onClick={() => openDetailModal(row)}
                      title="View details"
                    >
                      {String(page * pageSize + idx + 1).padStart(3, '0')}
                    </td>
                    {visibleCols.map(col => {
                      const isEditable = QUICK_EDIT_FIELDS.has(col.key);
                      const isActive = quickEditCell?.assetId === row.assetId && quickEditCell?.field === col.key;
                      const isSaving = quickEditSaving === row.assetId;
                      if (isEditable) {
                        return (
                          <td
                            key={col.key}
                            className="px-4 py-3 whitespace-nowrap"
                            onClick={e => { e.stopPropagation(); if (!isSaving) setQuickEditCell({ assetId: row.assetId, field: col.key }); }}
                          >
                            {isActive ? (
                              renderQuickEditSelect(col.key, row)
                            ) : (
                              <span className="group inline-flex items-center gap-1 cursor-pointer">
                                <span className="text-gray-700 dark:text-gray-300">
                                  {col.render ? col.render(row) : String(row[col.key as keyof AuditRow] ?? '-')}
                                </span>
                                {isSaving ? (
                                  <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {col.render ? col.render(row) : String(row[col.key as keyof AuditRow] ?? '-')}
                        </td>
                      );
                    })}
                    {/* Prominent Assign / Unassign button */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.assignedTo === 'Unassigned' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openAssignModal(row); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assign
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnassign(row); }}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Unassign
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setQrSingleRow(row); }}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors"
                        title="View QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === row.assetId ? null : row.assetId); }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      {actionMenuId === row.assetId && (
                        <div
                          ref={actionMenuRef}
                          className="absolute right-4 top-full mt-1 w-44 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl z-40 py-1"
                        >
                          <button
                            onClick={() => { openDetailModal(row); setActionMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" /> View Details
                          </button>
                          <button
                            onClick={() => { openDetailModal(row, true); setActionMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 flex items-center gap-2"
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Empty placeholder rows to fill the page (only for small page sizes) */}
              {pageSize <= 10 && Array.from({ length: Math.max(0, pageSize - pagedRows.length) }, (_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-100/60 dark:border-zinc-700/30">
                  <td className="px-4 py-3">&nbsp;</td>
                  <td className="px-4 py-3 text-gray-300 dark:text-gray-600 text-xs">
                    {pagedRows.length > 0 ? String(page * pageSize + pagedRows.length + i + 1).padStart(3, '0') : ''}
                  </td>
                  {visibleCols.map(col => (
                    <td key={col.key} className="px-4 py-3">&nbsp;</td>
                  ))}
                  <td className="px-4 py-3">&nbsp;</td>
                  <td className="px-4 py-3">&nbsp;</td>
                  <td className="px-4 py-3">&nbsp;</td>
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
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredRows.length)} of {filteredRows.length}
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
                        : 'border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'
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

      {/* Assign Modal */}
      {assignRow && (
        <Modal isOpen={!!assignRow} title={`Assign: ${assignRow.assetName}`} onClose={() => setAssignRow(null)} size="sm">
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Asset</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{assignRow.assetName} ({assignRow.assetTag})</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
              <select
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
              >
                <option value="">Select a user</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select
                value={assignDeptId}
                onChange={e => setAssignDeptId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
              >
                <option value="">Select a department</option>
                {allDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location (optional)</label>
              <select
                value={assignLocationId}
                onChange={e => setAssignLocationId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
              >
                <option value="">Keep current location</option>
                {data.locations.getAll().map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Mode</label>
              <select
                value={assignWorkMode}
                onChange={e => setAssignWorkMode(e.target.value as WorkMode | '')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
              >
                <option value="">Select work mode</option>
                <option value="wfo">Work from Office</option>
                <option value="wfh">Work from Home</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
              <textarea
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white"
                placeholder="Optional notes..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssignRow(null)}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAssign}
                disabled={!assignUserId || !assignDeptId || saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail / Edit Modal */}
      {detailRow && (
        <Modal isOpen={!!detailRow} title={isEditing ? 'Edit Asset' : 'Asset Details'} onClose={() => { setDetailRow(null); setIsEditing(false); }} size="lg">
          <div className="space-y-4">
            {/* Edit toggle button (shown in view mode) */}
            {!isEditing && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setIsEditing(true); setEditError(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            )}

            {isEditing ? (
              /* ---- EDIT MODE ---- */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Asset Tag (read-only) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Asset Tag</label>
                    <p className="text-sm text-gray-900 dark:text-white font-mono">{detailRow.assetTag}</p>
                  </div>
                  {/* Asset Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Asset Name</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
                  </div>
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                    <input type="text" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
                  </div>
                  {/* Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                      {['furniture','it_equipment','vehicle','electronics','office_equipment','hvac','infrastructure','other'].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                      {['available','allocated','in_use','under_maintenance','retired','disposed'].map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  {/* Serial Number */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Serial Number</label>
                    <input type="text" value={editForm.serialNumber} onChange={e => setEditForm(f => ({ ...f, serialNumber: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
                  </div>
                  {/* Brand */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                    <input type="text" value={editForm.brand} onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
                  </div>
                  {/* Model */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                    <input type="text" value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white" />
                  </div>
                  {/* Department */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
                    <select value={editForm.departmentId} onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                      <option value="">Select department</option>
                      {data.departments.getAll().map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Location */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                    <select value={editForm.locationId} onChange={e => setEditForm(f => ({ ...f, locationId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                      <option value="">Select location</option>
                      {data.locations.getAll().map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Assigned To (read-only) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assigned To</label>
                    <p className="text-sm text-gray-900 dark:text-white">{detailRow.assignedTo}</p>
                  </div>
                  {/* Work Mode */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Work Mode</label>
                    <select value={editForm.workMode} onChange={e => setEditForm(f => ({ ...f, workMode: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-zinc-700 dark:text-white">
                      <option value="">Not set</option>
                      <option value="wfo">Work from Office</option>
                      <option value="wfh">Work from Home</option>
                    </select>
                  </div>
                </div>

                {/* Error message */}
                {editError && (
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    {editError}
                  </div>
                )}

                {/* Save / Cancel buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-zinc-700">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={savingEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingEdit && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* ---- VIEW MODE ---- */
              <>
                <div className="grid grid-cols-2 gap-4">
                  {ALL_COLUMNS.map(col => (
                    <div key={col.key}>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{col.label}</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {col.render ? col.render(detailRow) : String(detailRow[col.key] ?? '-')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Single QR preview */}
                <div className="pt-4 border-t border-gray-200 dark:border-zinc-700 space-y-3">
                  {/* Fields dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setQrFieldsOpen(o => !o)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                      QR Fields
                      <span className="ml-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full px-1.5 py-0.5 font-medium">
                        {qrFields.size}/{QR_FIELD_OPTIONS.length}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${qrFieldsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {qrFieldsOpen && (
                      <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl shadow-lg p-2">
                        <div className="flex justify-between items-center px-2 pb-1.5 mb-1 border-b border-gray-100 dark:border-zinc-700">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Include in QR data</span>
                          <div className="flex gap-2">
                            <button onClick={() => setQrFields(new Set(QR_FIELD_OPTIONS.map(f => f.key)))} className="text-xs text-emerald-600 hover:underline">All</button>
                            <button onClick={() => setQrFields(new Set(['assetTag']))} className="text-xs text-gray-400 hover:underline">None</button>
                          </div>
                        </div>
                        {QR_FIELD_OPTIONS.map(f => (
                          <label key={f.key} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qrFields.has(f.key)}
                              disabled={f.key === 'assetTag'}
                              onChange={() => {
                                if (f.key === 'assetTag') return;
                                setQrFields(prev => {
                                  const next = new Set(prev);
                                  next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                            {f.key === 'assetTag' && <span className="ml-auto text-[10px] text-gray-400">required</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="border-[1.5px] border-gray-800 rounded-md overflow-hidden" style={{ width: 200 }}>
                      <div className="border-b-[1.5px] border-gray-800 text-center py-1 text-[10px] font-bold tracking-wide text-gray-900 bg-gray-100">
                        FIXED ASSET LABEL
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white">
                        <QRCode
                          value={buildQRData(detailRow, qrFields, organization?.name || '', buildScanUrl(orgSlug, detailRow.assetId))}
                          size={68}
                          level="M"
                        />
                        <p className="font-mono font-bold text-sm text-gray-900">{detailRow.assetTag}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Single QR Popup */}
      {qrSingleRow && (
        <Modal isOpen={!!qrSingleRow} title="QR Code" onClose={() => { setQrSingleRow(null); setQrFieldsOpen(false); }} size="sm">
          <div className="flex flex-col items-center gap-4">
            {/* Fields dropdown */}
            <div className="relative self-start w-full">
              <button
                onClick={() => setQrFieldsOpen(o => !o)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <Columns3 className="w-3.5 h-3.5" />
                QR Fields
                <span className="ml-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full px-1.5 py-0.5 font-medium">
                  {qrFields.size}/{QR_FIELD_OPTIONS.length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${qrFieldsOpen ? 'rotate-180' : ''}`} />
              </button>
              {qrFieldsOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl shadow-lg p-2">
                  <div className="flex justify-between items-center px-2 pb-1.5 mb-1 border-b border-gray-100 dark:border-zinc-700">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Include in QR data</span>
                    <div className="flex gap-2">
                      <button onClick={() => setQrFields(new Set(QR_FIELD_OPTIONS.map(f => f.key)))} className="text-xs text-emerald-600 hover:underline">All</button>
                      <button onClick={() => setQrFields(new Set(['assetTag']))} className="text-xs text-gray-400 hover:underline">None</button>
                    </div>
                  </div>
                  {QR_FIELD_OPTIONS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qrFields.has(f.key)}
                        disabled={f.key === 'assetTag'}
                        onChange={() => {
                          if (f.key === 'assetTag') return;
                          setQrFields(prev => {
                            const next = new Set(prev);
                            next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                      {f.key === 'assetTag' && <span className="ml-auto text-[10px] text-gray-400">required</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Label card */}
            <div className="border-[1.5px] border-gray-800 rounded-md overflow-hidden" style={{ width: 210 }}>
              <div className="border-b-[1.5px] border-gray-800 text-center py-1.5 text-[11px] font-bold tracking-wide text-gray-900 bg-gray-100">
                FIXED ASSET LABEL
              </div>
              <div className="flex items-center gap-3 p-3 bg-white">
                <QRCode
                  value={buildQRData(qrSingleRow, qrFields, organization?.name || '', buildScanUrl(orgSlug, qrSingleRow.assetId))}
                  size={72}
                  level="M"
                />
                <p className="font-mono font-bold text-base text-gray-900">{qrSingleRow.assetTag}</p>
              </div>
            </div>

            {/* Asset info */}
            <div className="w-full grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Asset Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{qrSingleRow.assetName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
                <p className="font-medium text-gray-900 dark:text-white">{qrSingleRow.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Assigned To</p>
                <p className="font-medium text-gray-900 dark:text-white">{qrSingleRow.assignedTo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">{qrSingleRow.status.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Print buttons */}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  const qrEl = document.getElementById('single-qr-label');
                  if (!qrEl) return;
                  printWindow.document.write(`
                    <!DOCTYPE html><html><head><title>Asset Label</title>
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { font-family: Arial, sans-serif; display: flex; justify-content: center; padding: 24px; }
                      .label-card { border: 1.5px solid #1f2937; border-radius: 6px; overflow: hidden; width: 210px; }
                      .label-header { border-bottom: 1.5px solid #1f2937; text-align: center; padding: 4px 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; background: #f3f4f6; }
                      .label-body { display: flex; align-items: center; gap: 12px; padding: 12px; }
                      .label-tag { font-family: monospace; font-weight: 700; font-size: 15px; }
                      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style></head><body>${qrEl.innerHTML}</body></html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Label
              </button>
              <button
                onClick={() => {
                  if (!qrSingleRow) return;
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  const qrEl = document.getElementById('single-qr-fullpage');
                  if (!qrEl) return;
                  printWindow.document.write(`
                    <!DOCTYPE html><html><head><title>Asset QR - ${qrSingleRow.assetTag}</title>
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { font-family: Arial, sans-serif; }
                      @page { size: A4; margin: 0; }
                      .full-page {
                        width: 210mm; height: 297mm;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        page-break-after: always;
                      }
                      .qr-container { text-align: center; }
                      .qr-container svg { width: 180mm; height: 180mm; }
                      .org-name { font-size: 14px; color: #6b7280; margin-bottom: 16px; font-weight: 500; }
                      .asset-tag { font-family: monospace; font-weight: 700; font-size: 36px; color: #1f2937; margin-top: 20px; }
                      .asset-name { font-size: 18px; color: #374151; margin-top: 8px; font-weight: 500; }
                      .label-line { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-top: 24px; }
                      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style></head><body>${qrEl.innerHTML}</body></html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Full Page
              </button>
            </div>

            {/* Hidden printable element — small label */}
            <div id="single-qr-label" className="hidden">
              <div className="label-card" style={{ border: '1.5px solid #1f2937', borderRadius: 6, overflow: 'hidden', width: 210 }}>
                <div className="label-header" style={{ borderBottom: '1.5px solid #1f2937', textAlign: 'center', padding: '4px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#1f2937', background: '#f3f4f6' }}>
                  FIXED ASSET LABEL
                </div>
                <div className="label-body" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'white' }}>
                  <QRCode value={buildQRData(qrSingleRow, qrFields, organization?.name || '', buildScanUrl(orgSlug, qrSingleRow.assetId))} size={72} level="M" />
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{qrSingleRow.assetTag}</span>
                </div>
              </div>
            </div>

            {/* Hidden printable element — full page */}
            <div id="single-qr-fullpage" className="hidden">
              <div className="full-page" style={{ width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="qr-container" style={{ textAlign: 'center' }}>
                  {organization?.name && (
                    <p className="org-name" style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, fontWeight: 500 }}>{organization.name}</p>
                  )}
                  <QRCode value={buildQRData(qrSingleRow, qrFields, organization?.name || '', buildScanUrl(orgSlug, qrSingleRow.assetId))} size={512} level="H" />
                  <p className="asset-tag" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 36, color: '#1f2937', marginTop: 20 }}>{qrSingleRow.assetTag}</p>
                  <p className="asset-name" style={{ fontSize: 18, color: '#374151', marginTop: 8, fontWeight: 500 }}>{qrSingleRow.assetName}</p>
                  <p className="label-line" style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginTop: 24 }}>FIXED ASSET LABEL</p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* QR Preview Modal */}
      {showQRPreview && (() => {
        const paperRawTop = PAPER_SIZES[qrSettings.paperSize];
        const isLandscapeTop = qrSettings.layout === 'horizontal';
        const paperTop = isLandscapeTop ? { w: paperRawTop.h, h: paperRawTop.w } : paperRawTop;
        const printableWTop = paperTop.w - qrSettings.marginLeft - qrSettings.marginRight;
        const printableHTop = paperTop.h - qrSettings.marginTop - qrSettings.marginBottom;
        const gapTop = 3;
        const maxColsTop = Math.max(1, Math.floor((printableWTop + gapTop) / (qrSettings.labelWidthMm + gapTop)));
        const maxRowsTop = Math.max(1, Math.floor((printableHTop + gapTop) / (qrSettings.labelHeightMm + gapTop)));
        const fitColsTop = lockOnePerPage ? 1 : (qrSettings.layout === 'vertical' ? 1 : qrSettings.layout === 'horizontal' ? maxColsTop : Math.min(qrSettings.columns, maxColsTop));
        const fitRowsTop = lockOnePerPage ? 1 : (qrSettings.layout === 'horizontal' ? 1 : maxRowsTop);
        const labelsPerPageTop = fitColsTop * fitRowsTop;
        const totalPagesTop = Math.max(1, Math.ceil(selectedAuditRows.length / labelsPerPageTop));

        const layoutLabel = qrSettings.layout === 'grid' ? 'Grid' : qrSettings.layout === 'vertical' ? 'Vertical' : 'Horizontal';
        const sizeLabel = qrSettings.labelScale === 0.75 ? 'Small' : qrSettings.labelScale === 1.25 ? 'Large' : 'Medium';
        const LayoutIcon = qrSettings.layout === 'grid' ? LayoutGrid : LayoutList;

        const popoverCls = "absolute z-50 top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl p-4";
        const triggerCls = (active: boolean) =>
          `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            active
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
              : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
          }`;
        const stepBtnCls = "w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors";
        const dimInputCls = "w-12 px-1 py-1 text-xs text-center rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-emerald-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
        const segBtnCls = (active: boolean) =>
          `flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            active
              ? 'bg-emerald-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
          }`;

        const handleReset = () => {
          setQrSettings({ ...DEFAULT_QR_SETTINGS });
          setQrFields(new Set(DEFAULT_QR_FIELDS));
          setQrPanel(null);
          setLockOnePerPage(false);
          setDraftDims({
            labelWidthMm:  String(DEFAULT_QR_SETTINGS.labelWidthMm),
            labelHeightMm: String(DEFAULT_QR_SETTINGS.labelHeightMm),
            marginTop:     String(DEFAULT_QR_SETTINGS.marginTop),
            marginBottom:  String(DEFAULT_QR_SETTINGS.marginBottom),
            marginLeft:    String(DEFAULT_QR_SETTINGS.marginLeft),
            marginRight:   String(DEFAULT_QR_SETTINGS.marginRight),
          });
        };

        return (
        <Modal isOpen={showQRPreview} title={`QR Label Preview (${selectedAuditRows.length} label${selectedAuditRows.length !== 1 ? 's' : ''})`} onClose={() => { setShowQRPreview(false); setQrPanel(null); }} size="xl">
          <div className="space-y-4">
            {/* Clean toolbar */}
            <div ref={qrToolbarRef} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Layout popover */}
                <div className="relative">
                  <button
                    onClick={() => setQrPanel(p => p === 'layout' ? null : 'layout')}
                    className={triggerCls(qrPanel === 'layout')}
                  >
                    <LayoutIcon className="w-3.5 h-3.5" />
                    <span>Layout</span>
                    <span className="text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-gray-500 dark:text-gray-400">{layoutLabel}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${qrPanel === 'layout' ? 'rotate-180' : ''}`} />
                  </button>
                  {qrPanel === 'layout' && (
                    <div className={`${popoverCls} w-72 space-y-3`}>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Layout</div>
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-lg">
                          <button onClick={() => setQrSettings(s => ({ ...s, layout: 'grid' }))} className={segBtnCls(qrSettings.layout === 'grid')}>
                            <span className="inline-flex items-center gap-1.5 justify-center"><LayoutGrid className="w-3.5 h-3.5" />Grid</span>
                          </button>
                          <button onClick={() => setQrSettings(s => ({ ...s, layout: 'vertical' }))} className={segBtnCls(qrSettings.layout === 'vertical')}>
                            <span className="inline-flex items-center gap-1.5 justify-center"><LayoutList className="w-3.5 h-3.5" />Vertical</span>
                          </button>
                          <button onClick={() => setQrSettings(s => ({ ...s, layout: 'horizontal' }))} className={segBtnCls(qrSettings.layout === 'horizontal')}>
                            <span className="inline-flex items-center gap-1.5 justify-center"><LayoutList className="w-3.5 h-3.5 rotate-90" />Row</span>
                          </button>
                        </div>
                      </div>

                      {qrSettings.layout === 'grid' && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Columns</div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setQrSettings(s => ({ ...s, columns: Math.max(1, s.columns - 1) }))} className={stepBtnCls}><Minus className="w-3 h-3" /></button>
                            <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-200">{qrSettings.columns}</span>
                            <button onClick={() => setQrSettings(s => ({ ...s, columns: Math.min(6, s.columns + 1) }))} className={stepBtnCls}><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                      )}

                      {qrSettings.layout === 'vertical' && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Position</div>
                          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-lg">
                            {(['left', 'center', 'right'] as QRAlign[]).map(val => (
                              <button key={val} onClick={() => setQrSettings(s => ({ ...s, alignH: val }))} className={segBtnCls(qrSettings.alignH === val)}>
                                {val.charAt(0).toUpperCase() + val.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {qrSettings.layout === 'horizontal' && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Position</div>
                          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-lg">
                            {(['top', 'center', 'bottom'] as QRVAlign[]).map(val => (
                              <button key={val} onClick={() => setQrSettings(s => ({ ...s, alignV: val }))} className={segBtnCls(qrSettings.alignV === val)}>
                                {val.charAt(0).toUpperCase() + val.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Print size</div>
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-lg">
                          {[{ value: 0.75, label: 'Small' }, { value: 1, label: 'Medium' }, { value: 1.25, label: 'Large' }].map(opt => (
                            <button key={opt.value} onClick={() => setQrSettings(s => ({ ...s, labelScale: opt.value }))} className={segBtnCls(qrSettings.labelScale === opt.value)}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Page Setup popover */}
                <div className="relative">
                  <button
                    onClick={() => setQrPanel(p => p === 'page' ? null : 'page')}
                    className={triggerCls(qrPanel === 'page')}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Page</span>
                    <span className="text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-gray-500 dark:text-gray-400">{qrSettings.paperSize} · {qrSettings.labelWidthMm}×{qrSettings.labelHeightMm}mm</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${qrPanel === 'page' ? 'rotate-180' : ''}`} />
                  </button>
                  {qrPanel === 'page' && (
                    <div className={`${popoverCls} w-80 space-y-3`}>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Paper</div>
                        <select
                          value={qrSettings.paperSize}
                          onChange={e => setQrSettings(s => ({ ...s, paperSize: e.target.value as PaperSize }))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                        >
                          {(Object.keys(PAPER_SIZES) as PaperSize[]).map(k => <option key={k} value={k}>{PAPER_SIZES[k].label}</option>)}
                        </select>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Label size (mm)</div>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'labelWidthMm', label: 'Width', min: 10, max: 300 },
                            { key: 'labelHeightMm', label: 'Height', min: 10, max: 300 },
                          ] as const).map(({ key, label, min, max }) => (
                            <div key={key}>
                              <label className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">{label}</label>
                              <div className="flex items-center gap-1">
                                <button onClick={() => stepDim(key, -1, min, max)} className={stepBtnCls}><Minus className="w-3 h-3" /></button>
                                <input
                                  type="number"
                                  value={draftDims[key]}
                                  onChange={e => setDraftDims(d => ({ ...d, [key]: e.target.value }))}
                                  onBlur={e => commitDim(key, e.target.value, min, max)}
                                  onKeyDown={e => e.key === 'Enter' && commitDim(key, (e.target as HTMLInputElement).value, min, max)}
                                  className={dimInputCls}
                                />
                                <button onClick={() => stepDim(key, 1, min, max)} className={stepBtnCls}><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Margins (mm)</div>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'marginTop', label: 'Top' },
                            { key: 'marginBottom', label: 'Bottom' },
                            { key: 'marginLeft', label: 'Left' },
                            { key: 'marginRight', label: 'Right' },
                          ] as const).map(({ key, label }) => (
                            <div key={key}>
                              <label className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">{label}</label>
                              <div className="flex items-center gap-1">
                                <button onClick={() => stepDim(key, -1, 0, 50)} className={stepBtnCls}><Minus className="w-3 h-3" /></button>
                                <input
                                  type="number"
                                  value={draftDims[key]}
                                  onChange={e => setDraftDims(d => ({ ...d, [key]: e.target.value }))}
                                  onBlur={e => commitDim(key, e.target.value, 0, 50)}
                                  onKeyDown={e => e.key === 'Enter' && commitDim(key, (e.target as HTMLInputElement).value, 0, 50)}
                                  className={dimInputCls}
                                />
                                <button onClick={() => stepDim(key, 1, 0, 50)} className={stepBtnCls}><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fields popover */}
                <div className="relative">
                  <button
                    onClick={() => setQrPanel(p => p === 'fields' ? null : 'fields')}
                    className={triggerCls(qrPanel === 'fields')}
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span>Fields</span>
                    <span className="text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-gray-500 dark:text-gray-400">{qrFields.size}/{QR_FIELD_OPTIONS.length}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${qrPanel === 'fields' ? 'rotate-180' : ''}`} />
                  </button>
                  {qrPanel === 'fields' && (
                    <div className={`${popoverCls} w-60 p-2`}>
                      <div className="flex justify-between items-center px-2 pb-1.5 mb-1 border-b border-gray-100 dark:border-zinc-700">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Include in QR</span>
                        <div className="flex gap-2">
                          <button onClick={() => setQrFields(new Set(QR_FIELD_OPTIONS.map(f => f.key)))} className="text-xs text-emerald-600 hover:underline">All</button>
                          <button onClick={() => setQrFields(new Set(['assetTag']))} className="text-xs text-gray-400 hover:underline">None</button>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {QR_FIELD_OPTIONS.map(f => (
                          <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qrFields.has(f.key)}
                              disabled={f.key === 'assetTag'}
                              onChange={() => {
                                if (f.key === 'assetTag') return;
                                setQrFields(prev => {
                                  const next = new Set(prev);
                                  next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">{f.label}</span>
                            {f.key === 'assetTag' && <span className="ml-auto text-[10px] text-gray-400">required</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                  title="Reset to defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyFullPage}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
                >
                  Full Page
                </button>
                <label
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none"
                  title="Force exactly one QR label per page, centered"
                >
                  <input
                    type="checkbox"
                    checked={lockOnePerPage}
                    onChange={e => setLockOnePerPage(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  One QR per page
                </label>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Labels
                </button>
              </div>
            </div>

            {/* Status line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span>{fitColsTop} × {fitRowsTop}</span>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <span>{labelsPerPageTop} per page</span>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <span>{totalPagesTop} page{totalPagesTop !== 1 ? 's' : ''}</span>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <span>{sizeLabel} labels</span>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <span>{isLandscapeTop ? 'Landscape' : 'Portrait'}</span>
            </div>

            {/* A4 Paper visual preview */}
            {(() => {
              const paperRaw = PAPER_SIZES[qrSettings.paperSize];
              // Horizontal layout = landscape orientation (swap w/h)
              const isLandscape = qrSettings.layout === 'horizontal';
              const paper = isLandscape ? { w: paperRaw.h, h: paperRaw.w } : paperRaw;
              // Scale: fit the paper into ~500px wide preview
              const previewScale = 500 / paper.w;
              const paperWpx = Math.round(paper.w * previewScale);
              const paperHpx = Math.round(paper.h * previewScale);
              const mTop = Math.round(qrSettings.marginTop * previewScale);
              const mBottom = Math.round(qrSettings.marginBottom * previewScale);
              const mLeft = Math.round(qrSettings.marginLeft * previewScale);
              const mRight = Math.round(qrSettings.marginRight * previewScale);
              const labelWpx = Math.round(qrSettings.labelWidthMm * previewScale);
              const labelHpx = Math.round(qrSettings.labelHeightMm * previewScale);
              const gapPx = Math.round(3 * previewScale);
              const printableW = paperWpx - mLeft - mRight;
              const printableH = paperHpx - mTop - mBottom;
              const maxFitCols = Math.max(1, Math.floor((printableW + gapPx) / (labelWpx + gapPx)));
              const maxFitRows = Math.max(1, Math.floor((printableH + gapPx) / (labelHpx + gapPx)));
              // Horizontal = single row, Vertical = single column, Grid = normal.
              // Lock: exactly one QR per page, centered.
              const fitCols = lockOnePerPage ? 1 : (
                qrSettings.layout === 'vertical' ? 1
                : qrSettings.layout === 'horizontal' ? maxFitCols
                : Math.min(qrSettings.columns, maxFitCols)
              );
              const fitRows = lockOnePerPage ? 1 : (
                qrSettings.layout === 'horizontal' ? 1
                : qrSettings.layout === 'vertical' ? maxFitRows
                : maxFitRows
              );
              const labelsPerPage = fitCols * fitRows;
              // Only show labels that fit on page 1 for the visual
              const visibleLabels = selectedAuditRows.slice(0, labelsPerPage);
              // QR code size relative to label
              const qrSize = Math.max(16, Math.round(Math.min(labelWpx * 0.45, labelHpx * 0.7)));
              const fontSize = Math.max(6, Math.round(labelHpx * 0.16));
              const headerFontSize = Math.max(5, Math.round(labelHpx * 0.12));
              const headerPad = Math.max(1, Math.round(labelHpx * 0.06));
              const bodyPad = Math.max(2, Math.round(labelHpx * 0.08));
              const bodyGap = Math.max(2, Math.round(labelWpx * 0.04));

              const totalPages = Math.ceil(selectedAuditRows.length / labelsPerPage);
              const pages = Array.from({ length: totalPages }, (_, pi) =>
                selectedAuditRows.slice(pi * labelsPerPage, (pi + 1) * labelsPerPage)
              );

              const marginLabelStyle: React.CSSProperties = {
                fontSize: 7, fontWeight: 600, color: '#94a3b8',
                position: 'absolute', whiteSpace: 'nowrap',
              };

              const renderPage = (pageLabels: AuditRow[], pageIdx: number) => (
                <div key={pageIdx} style={{ position: 'relative' }}>
                  {/* Page number */}
                  {totalPages > 1 && (
                    <div style={{ textAlign: 'center', marginBottom: 6, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                      Page {pageIdx + 1} of {totalPages}
                    </div>
                  )}

                  {/* Paper sheet */}
                  <div style={{
                    width: paperWpx, height: paperHpx,
                    background: 'white', borderRadius: 4,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)',
                    position: 'relative', overflow: 'visible',
                  }}>
                    {/* Margin boundary (dashed rectangle) */}
                    <div style={{
                      position: 'absolute',
                      top: mTop, left: mLeft,
                      width: printableW, height: printableH,
                      border: '1px dashed #cbd5e1',
                      borderRadius: 2,
                      pointerEvents: 'none',
                    }} />

                    {/* Top margin label */}
                    {mTop > 8 && (
                      <span style={{ ...marginLabelStyle, top: Math.round(mTop / 2) - 5, left: '50%', transform: 'translateX(-50%)' }}>
                        {qrSettings.marginTop}mm
                      </span>
                    )}
                    {/* Bottom margin label */}
                    {mBottom > 8 && (
                      <span style={{ ...marginLabelStyle, bottom: Math.round(mBottom / 2) - 5, left: '50%', transform: 'translateX(-50%)' }}>
                        {qrSettings.marginBottom}mm
                      </span>
                    )}
                    {/* Left margin label */}
                    {mLeft > 12 && (
                      <span style={{ ...marginLabelStyle, top: '50%', left: Math.round(mLeft / 2), transform: 'translateY(-50%) translateX(-50%) rotate(-90deg)' }}>
                        {qrSettings.marginLeft}mm
                      </span>
                    )}
                    {/* Right margin label */}
                    {mRight > 12 && (
                      <span style={{ ...marginLabelStyle, top: '50%', right: Math.round(mRight / 2), transform: 'translateY(-50%) translateX(50%) rotate(90deg)' }}>
                        {qrSettings.marginRight}mm
                      </span>
                    )}

                    {/* Labels grid inside margin area */}
                    <div style={{
                      position: 'absolute',
                      top: mTop, left: mLeft,
                      width: printableW, height: printableH,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${fitCols}, ${labelWpx}px)`,
                      gridTemplateRows: qrSettings.layout === 'horizontal' && !lockOnePerPage
                        ? `${labelHpx}px`
                        : `repeat(${fitRows}, ${labelHpx}px)`,
                      gap: gapPx,
                      justifyContent: lockOnePerPage
                        ? 'center'
                        : qrSettings.layout === 'vertical'
                          ? qrSettings.alignH === 'left' ? 'start' : qrSettings.alignH === 'right' ? 'end' : 'center'
                          : 'start',
                      alignContent: lockOnePerPage
                        ? 'center'
                        : qrSettings.layout === 'horizontal'
                          ? qrSettings.alignV === 'top' ? 'start' : qrSettings.alignV === 'bottom' ? 'end' : 'center'
                          : 'start',
                    }}>
                      {pageLabels.map((row, i) => (
                        <div key={row.assetId} style={{ position: 'relative' }}>
                          <div className="label-card" style={{
                            border: '1px solid #1f2937',
                            borderRadius: Math.max(2, Math.round(3 * previewScale)),
                            overflow: 'hidden',
                            width: labelWpx, height: labelHpx,
                            display: 'flex', flexDirection: 'column',
                          }}>
                            <div className="label-header" style={{
                              borderBottom: '1px solid #1f2937',
                              textAlign: 'center',
                              padding: `${headerPad}px 2px`,
                              fontSize: headerFontSize,
                              fontWeight: 700,
                              letterSpacing: '0.3px',
                              color: '#1f2937',
                              background: '#f3f4f6',
                              lineHeight: 1.1,
                              flexShrink: 0,
                            }}>
                              FIXED ASSET LABEL
                            </div>
                            <div className="label-body" style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: bodyGap,
                              padding: bodyPad,
                              background: 'white',
                              flex: 1,
                              minHeight: 0,
                            }}>
                              <QRCode
                                value={buildQRData(row, qrFields, organization?.name || '', buildScanUrl(orgSlug, row.assetId))}
                                size={qrSize}
                                level="M"
                              />
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: fontSize,
                                color: '#1f2937',
                                lineHeight: 1.1,
                                wordBreak: 'break-all',
                              }}>
                                {row.assetTag}
                              </span>
                            </div>
                          </div>

                          {/* Dimension guides on first label of first page */}
                          {pageIdx === 0 && i === 0 && (
                            <>
                              <div style={{
                                position: 'absolute',
                                top: -14, left: 0, width: labelWpx, height: 12,
                                display: 'flex', alignItems: 'center',
                              }}>
                                <div style={{ width: 1, height: 8, background: '#6366f1' }} />
                                <div style={{ flex: 1, height: 1, background: '#6366f1' }} />
                                <span style={{
                                  position: 'absolute', left: '50%', top: -2, transform: 'translateX(-50%)',
                                  fontSize: 8, fontWeight: 600, color: '#6366f1',
                                  background: 'white', padding: '0 3px', whiteSpace: 'nowrap',
                                }}>
                                  {qrSettings.labelWidthMm}mm
                                </span>
                                <div style={{ width: 1, height: 8, background: '#6366f1' }} />
                              </div>
                              <div style={{
                                position: 'absolute',
                                top: 0, left: -14, width: 12, height: labelHpx,
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                              }}>
                                <div style={{ width: 8, height: 1, background: '#6366f1' }} />
                                <div style={{ flex: 1, width: 1, background: '#6366f1' }} />
                                <span style={{
                                  position: 'absolute', top: '50%', left: -4, transform: 'translateY(-50%) rotate(-90deg)',
                                  fontSize: 8, fontWeight: 600, color: '#6366f1',
                                  background: 'white', padding: '0 3px', whiteSpace: 'nowrap',
                                }}>
                                  {qrSettings.labelHeightMm}mm
                                </span>
                                <div style={{ width: 8, height: 1, background: '#6366f1' }} />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Paper size watermark */}
                    <div style={{
                      position: 'absolute', bottom: 6, right: 8,
                      fontSize: 9, color: '#94a3b8', fontWeight: 500,
                    }}>
                      {qrSettings.paperSize} {isLandscape ? 'Landscape' : 'Portrait'} ({paper.w} × {paper.h} mm)
                    </div>
                  </div>
                </div>
              );

              return (
                <div className="overflow-auto max-h-[60vh]">
                  <div className="flex flex-col items-center gap-6 py-4 bg-gray-100 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700">
                    {pages.map((pageLabels, pi) => (
                      <React.Fragment key={pi}>
                        {renderPage(pageLabels, pi)}
                        {/* Page break indicator */}
                        {pi < pages.length - 1 && (
                          <div className="flex items-center gap-3 w-full px-8">
                            <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                            <span className="text-[10px] font-semibold text-red-400 dark:text-red-500 uppercase tracking-wider whitespace-nowrap">Page Break</span>
                            <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Hidden container with ALL labels for printing — no inline sizes, print CSS controls dimensions */}
            <div ref={printRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <div className="label-grid">
                {selectedAuditRows.map(row => (
                  <div key={row.assetId} className="label-card">
                    <div className="label-header">FIXED ASSET LABEL</div>
                    <div className="label-body">
                      <QRCode
                        value={buildQRData(row, qrFields, organization?.name || '', buildScanUrl(orgSlug, row.assetId))}
                        size={200}
                        level="M"
                      />
                      <span className="label-tag">{row.assetTag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
        );
      })()}

      {/* Allocation date warning — fired when user tries to set a date on an unallocated asset */}
      <Modal
        isOpen={!!allocDateWarning}
        onClose={() => setAllocDateWarning(null)}
        title="Asset is not allocated"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{allocDateWarning?.assetName}</span>
            {' '}({allocDateWarning?.assetTag}) isn&apos;t currently assigned to anyone, so the allocation date can&apos;t be saved.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set <span className="font-medium text-gray-900 dark:text-white">Assigned&nbsp;To</span> on this row first — the allocation date will become editable as soon as the asset is allocated.
          </p>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setAllocDateWarning(null)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
