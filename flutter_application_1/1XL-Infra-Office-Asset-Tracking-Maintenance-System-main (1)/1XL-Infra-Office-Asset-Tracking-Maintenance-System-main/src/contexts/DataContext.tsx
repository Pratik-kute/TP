import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { objectToSnake, objectToCamel, arrayToCamel } from '../lib/caseMapper';
import { useAuth } from './AuthContext';
import {
  User, Department, Location, Asset, Allocation, Maintenance, Repair, Vendor,
  Consumable, ConsumableAllocation, Procurement, AssetRequest, Recovery, DepreciationRecord, AuditLog,
  AuditFieldChange, Notification, Document, SystemConfig, DeletedAssetTag,
  Coupon, CouponRedemption, InviteLink, AuditReport
} from '../types';

// ---- helpers ----
type TableName =
  | 'users' | 'departments' | 'locations' | 'assets' | 'allocations'
  | 'maintenance' | 'repairs' | 'vendors' | 'consumables' | 'consumable_allocations'
  | 'procurements' | 'asset_requests' | 'recoveries' | 'depreciation' | 'audit_logs' | 'notifications' | 'documents'
  | 'deleted_asset_tags' | 'coupons' | 'coupon_redemptions' | 'invite_links' | 'audit_reports';

async function fetchTable<T>(table: TableName, organizationId?: string): Promise<T[]> {
  let query = supabase.from(table).select('*');
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { data, error } = await query;
  if (error) { console.error(`Error fetching ${table}:`, error); return []; }
  return arrayToCamel<T>(data ?? []);
}

// Convert "" → null for UUID FK fields (_id), optional date fields,
// and any enum/constrained columns that must not be empty strings
// Exclude TEXT columns that happen to end in _date (e.g. mfg_date)
const TEXT_DATE_KEYS = new Set(['mfg_date']);
const ENUM_KEYS = new Set(['work_mode', 'asset_use']);

function sanitize(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' && !TEXT_DATE_KEYS.has(k) && (
      ENUM_KEYS.has(k) ||
      k.endsWith('_id') || k.endsWith('_date') || k.endsWith('_start') || k.endsWith('_end')
    )) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---- CRUD wrapper ----
interface CrudOps<T extends { id: string }> {
  getAll: () => T[];
  getById: (id: string) => T | undefined;
  create: (item: Omit<T, 'id' | 'organizationId'>) => Promise<T>;
  bulkCreate: (items: Omit<T, 'id' | 'organizationId'>[]) => Promise<T[]>;
  update: (id: string, updates: Partial<T>) => Promise<T | undefined>;
  remove: (id: string) => Promise<boolean>;
  bulkRemove: (ids: string[]) => Promise<boolean>;
}

function makeCrud<T extends { id: string }>(
  table: TableName,
  cache: React.MutableRefObject<T[]>,
  setCache: (items: T[]) => void,
  organizationId?: string
): CrudOps<T> {
  return {
    getAll: () => cache.current,
    getById: (id: string) => cache.current.find(i => i.id === id),
    create: async (item: Omit<T, 'id' | 'organizationId'>) => {
      const raw = item as Record<string, any>;
      // Auto-inject organizationId if provided and not already set
      if (organizationId && !raw.organizationId) {
        raw.organizationId = organizationId;
      }
      const snaked = sanitize(objectToSnake(raw));
      const { data, error } = await supabase.from(table).insert(snaked).select().single();
      if (error) throw error;
      const created = objectToCamel<T>(data);
      const next = [...cache.current, created];
      cache.current = next;
      setCache(next);
      return created;
    },
    bulkCreate: async (items: Omit<T, 'id' | 'organizationId'>[]) => {
      if (items.length === 0) return [];
      const rows = items.map(item => {
        const raw = { ...(item as Record<string, any>) };
        if (organizationId && !raw.organizationId) {
          raw.organizationId = organizationId;
        }
        return sanitize(objectToSnake(raw));
      });
      // Single round-trip: one INSERT for the whole batch.
      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) throw error;
      const created = arrayToCamel<T>(data ?? []);
      const next = [...cache.current, ...created];
      cache.current = next;
      setCache(next);
      return created;
    },
    update: async (id: string, updates: Partial<T>) => {
      const snaked = sanitize(objectToSnake(updates as Record<string, any>));
      const { data, error } = await supabase.from(table).update(snaked).eq('id', id).select().single();
      if (error) throw error;
      const updated = objectToCamel<T>(data);
      const next = cache.current.map(i => (i.id === id ? updated : i));
      cache.current = next;
      setCache(next);
      return updated;
    },
    remove: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      const next = cache.current.filter(i => i.id !== id);
      cache.current = next;
      setCache(next);
      return true;
    },
    bulkRemove: async (ids: string[]) => {
      if (ids.length === 0) return true;
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) throw error;
      const idSet = new Set(ids);
      const next = cache.current.filter(i => !idSet.has(i.id));
      cache.current = next;
      setCache(next);
      return true;
    },
  };
}

// AllOrgData removed — Dashboard now uses org-scoped data only

// ---- Context shape ----
interface DataContextType {
  loading: boolean;
  users: CrudOps<User>;
  departments: CrudOps<Department>;
  locations: CrudOps<Location>;
  assets: CrudOps<Asset>;
  allocations: CrudOps<Allocation>;
  maintenance: CrudOps<Maintenance>;
  repairs: CrudOps<Repair>;
  vendors: CrudOps<Vendor>;
  consumables: CrudOps<Consumable>;
  consumableAllocations: CrudOps<ConsumableAllocation>;
  procurements: CrudOps<Procurement>;
  assetRequests: CrudOps<AssetRequest>;
  recoveries: CrudOps<Recovery>;
  depreciation: CrudOps<DepreciationRecord>;
  auditLogs: CrudOps<AuditLog>;
  notifications: CrudOps<Notification>;
  documents: CrudOps<Document>;
  deletedAssetTags: CrudOps<DeletedAssetTag>;
  coupons: CrudOps<Coupon>;
  couponRedemptions: CrudOps<CouponRedemption>;
  inviteLinks: CrudOps<InviteLink>;
  auditReports: CrudOps<AuditReport>;
  systemConfig: { get: () => SystemConfig; save: (c: SystemConfig) => Promise<void> };
  addAuditLog: (userId: string, userName: string, action: string, module: string, entityId: string, entityType: string, details: string, changes?: AuditFieldChange[]) => Promise<void>;
  addNotification: (userId: string, type: Notification['type'], title: string, message: string, priority?: Notification['priority']) => Promise<void>;
  notifyByRole: (roles: string[], type: Notification['type'], title: string, message: string, priority?: Notification['priority'], excludeUserId?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const defaultConfig: SystemConfig = {
  companyName: 'Asset Management',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  maintenanceReminderDays: 7,
  warrantyAlertDays: 30,
  stockAlertEnabled: true,
  depreciationMethod: 'straight_line',
  autoBackupEnabled: true,
  backupFrequency: 'weekly',
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const orgId = user?.organizationId || '';
  const [loading, setLoading] = useState(true);

  // State arrays (trigger re-renders)
  const [, setUsersState] = useState<User[]>([]);
  const [, setDepartmentsState] = useState<Department[]>([]);
  const [, setLocationsState] = useState<Location[]>([]);
  const [, setAssetsState] = useState<Asset[]>([]);
  const [, setAllocationsState] = useState<Allocation[]>([]);
  const [, setMaintenanceState] = useState<Maintenance[]>([]);
  const [, setRepairsState] = useState<Repair[]>([]);
  const [, setVendorsState] = useState<Vendor[]>([]);
  const [, setConsumablesState] = useState<Consumable[]>([]);
  const [, setConsumableAllocationsState] = useState<ConsumableAllocation[]>([]);
  const [, setProcurementsState] = useState<Procurement[]>([]);
  const [, setAssetRequestsState] = useState<AssetRequest[]>([]);
  const [, setRecoveriesState] = useState<Recovery[]>([]);
  const [, setDepreciationState] = useState<DepreciationRecord[]>([]);
  const [, setAuditLogsState] = useState<AuditLog[]>([]);
  const [, setNotificationsState] = useState<Notification[]>([]);
  const [, setDocumentsState] = useState<Document[]>([]);
  const [, setDeletedAssetTagsState] = useState<DeletedAssetTag[]>([]);
  const [, setCouponsState] = useState<Coupon[]>([]);
  const [, setCouponRedemptionsState] = useState<CouponRedemption[]>([]);
  const [, setInviteLinksState] = useState<InviteLink[]>([]);
  const [, setAuditReportsState] = useState<AuditReport[]>([]);
  const [configState, setConfigState] = useState<SystemConfig>(defaultConfig);

  // Refs for synchronous reads
  const usersRef = useRef<User[]>([]);
  const departmentsRef = useRef<Department[]>([]);
  const locationsRef = useRef<Location[]>([]);
  const assetsRef = useRef<Asset[]>([]);
  const allocationsRef = useRef<Allocation[]>([]);
  const maintenanceRef = useRef<Maintenance[]>([]);
  const repairsRef = useRef<Repair[]>([]);
  const vendorsRef = useRef<Vendor[]>([]);
  const consumablesRef = useRef<Consumable[]>([]);
  const consumableAllocationsRef = useRef<ConsumableAllocation[]>([]);
  const procurementsRef = useRef<Procurement[]>([]);
  const assetRequestsRef = useRef<AssetRequest[]>([]);
  const recoveriesRef = useRef<Recovery[]>([]);
  const depreciationRef = useRef<DepreciationRecord[]>([]);
  const auditLogsRef = useRef<AuditLog[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  const documentsRef = useRef<Document[]>([]);
  const deletedAssetTagsRef = useRef<DeletedAssetTag[]>([]);
  const couponsRef = useRef<Coupon[]>([]);
  const couponRedemptionsRef = useRef<CouponRedemption[]>([]);
  const inviteLinksRef = useRef<InviteLink[]>([]);
  const auditReportsRef = useRef<AuditReport[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const oid = orgId || undefined; // pass undefined if no org → fetch all (fallback)
    const [
      users, departments, locations, assets, allocations,
      maintenance, repairs, vendors, consumables, consumableAllocations,
      procurements, assetRequests, recoveries, depreciation, auditLogs, notifications, documents,
      deletedAssetTags, coupons, couponRedemptions, inviteLinks, auditReports, configRes
    ] = await Promise.all([
      fetchTable<User>('users', oid),
      fetchTable<Department>('departments', oid),
      fetchTable<Location>('locations', oid),
      fetchTable<Asset>('assets', oid),
      fetchTable<Allocation>('allocations', oid),
      fetchTable<Maintenance>('maintenance', oid),
      fetchTable<Repair>('repairs', oid),
      fetchTable<Vendor>('vendors', oid),
      fetchTable<Consumable>('consumables', oid),
      fetchTable<ConsumableAllocation>('consumable_allocations', oid),
      fetchTable<Procurement>('procurements', oid),
      fetchTable<AssetRequest>('asset_requests', oid),
      fetchTable<Recovery>('recoveries', oid),
      fetchTable<DepreciationRecord>('depreciation', oid),
      fetchTable<AuditLog>('audit_logs', oid),
      fetchTable<Notification>('notifications', oid),
      fetchTable<Document>('documents', oid),
      fetchTable<DeletedAssetTag>('deleted_asset_tags', oid),
      fetchTable<Coupon>('coupons', oid),
      fetchTable<CouponRedemption>('coupon_redemptions', oid),
      fetchTable<InviteLink>('invite_links', oid),
      fetchTable<AuditReport>('audit_reports', oid),
      supabase.from('system_config').select('*').single(),
    ]);

    usersRef.current = users; setUsersState(users);
    departmentsRef.current = departments; setDepartmentsState(departments);
    locationsRef.current = locations; setLocationsState(locations);
    assetsRef.current = assets; setAssetsState(assets);
    allocationsRef.current = allocations; setAllocationsState(allocations);
    maintenanceRef.current = maintenance; setMaintenanceState(maintenance);
    repairsRef.current = repairs; setRepairsState(repairs);
    vendorsRef.current = vendors; setVendorsState(vendors);
    consumablesRef.current = consumables; setConsumablesState(consumables);
    consumableAllocationsRef.current = consumableAllocations; setConsumableAllocationsState(consumableAllocations);
    procurementsRef.current = procurements; setProcurementsState(procurements);
    assetRequestsRef.current = assetRequests; setAssetRequestsState(assetRequests);
    recoveriesRef.current = recoveries; setRecoveriesState(recoveries);
    depreciationRef.current = depreciation; setDepreciationState(depreciation);
    auditLogsRef.current = auditLogs; setAuditLogsState(auditLogs);
    notificationsRef.current = notifications; setNotificationsState(notifications);
    documentsRef.current = documents; setDocumentsState(documents);
    deletedAssetTagsRef.current = deletedAssetTags; setDeletedAssetTagsState(deletedAssetTags);
    couponsRef.current = coupons; setCouponsState(coupons);
    couponRedemptionsRef.current = couponRedemptions; setCouponRedemptionsState(couponRedemptions);
    inviteLinksRef.current = inviteLinks; setInviteLinksState(inviteLinks);
    auditReportsRef.current = auditReports; setAuditReportsState(auditReports);

    if (configRes.data) {
      const c = objectToCamel<SystemConfig>(configRes.data);
      setConfigState(c);
    }

    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // fetchAllOrgData removed — Dashboard uses org-scoped data only

  // Build CRUD ops with org injection
  const users = makeCrud<User>('users', usersRef, setUsersState, orgId);
  const departments = makeCrud<Department>('departments', departmentsRef, setDepartmentsState, orgId);
  const locations = makeCrud<Location>('locations', locationsRef, setLocationsState, orgId);
  const assets = makeCrud<Asset>('assets', assetsRef, setAssetsState, orgId);
  const allocations = makeCrud<Allocation>('allocations', allocationsRef, setAllocationsState, orgId);
  const maintenance = makeCrud<Maintenance>('maintenance', maintenanceRef, setMaintenanceState, orgId);
  const repairs = makeCrud<Repair>('repairs', repairsRef, setRepairsState, orgId);
  const vendors = makeCrud<Vendor>('vendors', vendorsRef, setVendorsState, orgId);
  const consumables = makeCrud<Consumable>('consumables', consumablesRef, setConsumablesState, orgId);
  const consumableAllocations = makeCrud<ConsumableAllocation>('consumable_allocations', consumableAllocationsRef, setConsumableAllocationsState, orgId);
  const procurements = makeCrud<Procurement>('procurements', procurementsRef, setProcurementsState, orgId);
  const assetRequests = makeCrud<AssetRequest>('asset_requests', assetRequestsRef, setAssetRequestsState, orgId);
  const recoveries = makeCrud<Recovery>('recoveries', recoveriesRef, setRecoveriesState, orgId);
  const depreciation = makeCrud<DepreciationRecord>('depreciation', depreciationRef, setDepreciationState, orgId);
  const auditLogs = makeCrud<AuditLog>('audit_logs', auditLogsRef, setAuditLogsState, orgId);
  const notifications = makeCrud<Notification>('notifications', notificationsRef, setNotificationsState, orgId);
  const documents = makeCrud<Document>('documents', documentsRef, setDocumentsState, orgId);
  const deletedAssetTags = makeCrud<DeletedAssetTag>('deleted_asset_tags', deletedAssetTagsRef, setDeletedAssetTagsState, orgId);
  const coupons = makeCrud<Coupon>('coupons', couponsRef, setCouponsState, orgId);
  const couponRedemptions = makeCrud<CouponRedemption>('coupon_redemptions', couponRedemptionsRef, setCouponRedemptionsState, orgId);
  const inviteLinks = makeCrud<InviteLink>('invite_links', inviteLinksRef, setInviteLinksState, orgId);
  const auditReports = makeCrud<AuditReport>('audit_reports', auditReportsRef, setAuditReportsState, orgId);

  const systemConfig = {
    get: () => configState,
    save: async (c: SystemConfig) => {
      const snaked = objectToSnake(c as Record<string, any>);
      await supabase.from('system_config').update(snaked).eq('id', 1);
      setConfigState(c);
    },
  };

  const addAuditLog = async (userId: string, userName: string, action: string, module: string, entityId: string, entityType: string, details: string, changes?: AuditFieldChange[]) => {
    await auditLogs.create({
      userId,
      userName,
      action,
      module,
      entityId,
      entityType,
      details,
      changes: changes || [],
      timestamp: new Date().toISOString(),
    } as Omit<AuditLog, 'id' | 'organizationId'>);
  };

  const addNotification = async (userId: string, type: Notification['type'], title: string, message: string, priority: Notification['priority'] = 'medium') => {
    try {
      const created = await notifications.create({
        userId,
        type,
        title,
        message,
        isRead: false,
        priority,
        createdAt: new Date().toISOString(),
      } as Omit<Notification, 'id' | 'organizationId'>);
      console.log('[Notification] Created:', created.id, 'for user:', userId, 'type:', type);
    } catch (err) {
      console.error('[Notification] FAILED to create notification:', err);
      throw err; // re-throw so callers see the failure
    }
  };

  /** Notify all users with the given roles in the current org only */
  const notifyByRole = async (roles: string[], type: Notification['type'], title: string, message: string, priority: Notification['priority'] = 'medium', excludeUserId?: string) => {
    const targets = users.getAll().filter(u =>
      u.isActive &&
      roles.includes(u.role) &&
      u.id !== excludeUserId &&
      u.organizationId === orgId  // only users in the same org
    );
    await Promise.all(targets.map(u => addNotification(u.id, type, title, message, priority)));
  };

  const value: DataContextType = {
    loading,
    users, departments, locations, assets, allocations,
    maintenance, repairs, vendors, consumables, consumableAllocations,
    procurements, assetRequests, recoveries, depreciation, auditLogs, notifications, documents,
    deletedAssetTags, coupons, couponRedemptions, inviteLinks, auditReports,
    systemConfig, addAuditLog, addNotification, notifyByRole, refresh: loadAll,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading data...</p>
        </div>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
