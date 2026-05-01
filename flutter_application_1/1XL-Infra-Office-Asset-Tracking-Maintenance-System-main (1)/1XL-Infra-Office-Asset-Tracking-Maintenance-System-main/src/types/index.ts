export type UserRole = 'admin' | 'manager' | 'employee' | 'technician' | 'vendor' | 'auditor' | 'staff';

export type AssetStatus = 'available' | 'allocated' | 'in_use' | 'under_maintenance' | 'retired' | 'disposed' | 'dead';
export type AssetType = 'furniture' | 'it_equipment' | 'vehicle' | 'electronics' | 'office_equipment' | 'hvac' | 'infrastructure' | 'other';
export type AllocationStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'active';
export type AllocationType = 'new_employee' | 'add_on' | 'replacement';
export type WorkMode = 'wfo' | 'wfh';
export type AssetUse = 'personal' | 'common';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type RepairStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type ProcurementStatus = 'requested' | 'approved' | 'ordered' | 'received' | 'rejected' | 'cancelled';
export type AssetRequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';
export type RecoveryIncidentType = 'lost' | 'damaged' | 'stolen' | 'insurance_claim' | 'write_off';
export type RecoveryStatus = 'reported' | 'investigating' | 'recovered' | 'partially_recovered' | 'closed' | 'written_off';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// ---- Page Access Control ----
export type PagePermissions = Partial<Record<Exclude<UserRole, 'admin'>, string[]>>;

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  departmentId: string;
  phone: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  avatar?: string;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  managerId: string;
  locationId: string;
  description: string;
  floorNo?: string;
  organizationId: string;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  floorNo?: string;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetTag: string;
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
  warrantyStart: string;
  warrantyEnd: string;
  status: AssetStatus;
  vendorId: string;
  description: string;
  usefulLifeYears: number;
  salvageValue: number;
  currency?: string;
  invoiceUrl?: string;
  invoiceUrls?: string[];
  imageUrl?: string;
  imageUrls?: string[];
  // Extended IT fields (populated via bulk import)
  processor?: string;
  ram?: string;
  storage?: string;
  graphicsCard?: string;
  screenSize?: string;
  configuration?: string;
  deviceName?: string;
  assignedEmployee?: string;
  designation?: string;
  physicallyVerified?: boolean;
  mfgDate?: string;
  assetUse?: AssetUse | null;
  customFields?: Record<string, string> | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Allocation {
  id: string;
  assetId: string;
  employeeId: string;
  departmentId: string;
  startDate: string;
  endDate: string | null;
  status: AllocationStatus;
  allocationType?: AllocationType;
  replacesAllocationId?: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  returnDate: string | null;
  returnCondition: string | null;
  notes: string;
  organizationId: string;
  createdAt: string;
}

export interface AuditReport {
  id: string;
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  status: 'pending' | 'sent' | 'failed';
  recipientCount: number | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface Maintenance {
  id: string;
  assetId: string;
  scheduledDate: string;
  completedDate: string | null;
  technicianId: string;
  status: MaintenanceStatus;
  type: 'preventive' | 'corrective';
  cost: number;
  notes: string;
  checklist: string[];
  organizationId: string;
  createdAt: string;
}

export interface Repair {
  id: string;
  assetId: string;
  vendorId: string;
  technicianId: string;
  issue: string;
  status: RepairStatus;
  priority: Priority;
  cost: number;
  partsUsed: string;
  laborHours: number;
  completionDate: string | null;
  notes: string;
  organizationId: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  services: string[];
  warrantyCovered: boolean;
  rating: number;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export interface Consumable {
  id: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  costPerUnit: number;
  departmentId: string;
  locationId: string;
  lastRestocked: string;
  organizationId: string;
  createdAt: string;
}

export interface ConsumableAllocation {
  id: string;
  consumableId: string;
  employeeId: string;
  departmentId: string;
  quantity: number;
  date: string;
  organizationId: string;
}

export interface Procurement {
  id: string;
  assetName: string;
  assetType: AssetType;
  category: string;
  requestedBy: string;
  departmentId: string;
  vendorId: string;
  quantity: number;
  estimatedCost: number;
  actualCost: number | null;
  status: ProcurementStatus;
  approvedBy: string | null;
  approvalDate: string | null;
  expectedDelivery: string;
  receivedDate: string | null;
  notes: string;
  organizationId: string;
  createdAt: string;
}

export interface AssetRequest {
  id: string;
  requesterId: string;
  assetType: AssetType;
  category: string;
  assetName: string;
  quantity: number;
  urgency: Priority;
  reason: string;
  status: AssetRequestStatus;
  reviewedBy: string | null;
  reviewDate: string | null;
  reviewNote: string;
  fulfilledAssetId: string | null;
  organizationId: string;
  createdAt: string;
}

export interface Recovery {
  id: string;
  assetId: string;
  reportedBy: string;
  incidentType: RecoveryIncidentType;
  status: RecoveryStatus;
  severity: Priority;
  description: string;
  resolution: string;
  estimatedLoss: number;
  recoveredAmount: number;
  incidentDate: string;
  resolvedDate: string | null;
  resolvedBy: string | null;
  organizationId: string;
  createdAt: string;
}

export interface DepreciationRecord {
  id: string;
  assetId: string;
  year: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  method: 'straight_line' | 'declining_balance';
  date: string;
  organizationId: string;
}

export interface AuditFieldChange {
  field: string;
  fieldLabel: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entityId: string;
  entityType: string;
  details: string;
  changes?: AuditFieldChange[];
  timestamp: string;
  organizationId: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'maintenance' | 'repair' | 'allocation' | 'warranty' | 'stock' | 'procurement' | 'system' | 'user' | 'asset' | 'asset_request' | 'recovery';
  title: string;
  message: string;
  isRead: boolean;
  priority: Priority;
  link?: string;
  organizationId: string;
  createdAt: string;
}

export interface Document {
  id: string;
  assetId: string;
  name: string;
  type: 'warranty' | 'invoice' | 'manual' | 'service_report' | 'purchase_order' | 'other';
  description: string;
  fileSize: string;
  fileUrl?: string;
  fileName?: string;
  uploadedBy: string;
  organizationId: string;
  createdAt: string;
}

export interface DeletedAssetTag {
  id: string;
  assetTag: string;
  organizationId: string;
  originalAssetName: string;
  deletedAt: string;
}

export interface SystemConfig {
  companyName: string;
  currency: string;
  dateFormat: string;
  maintenanceReminderDays: number;
  warrantyAlertDays: number;
  stockAlertEnabled: boolean;
  depreciationMethod: 'straight_line' | 'declining_balance';
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface Organization {
  id: string;
  name: string;
  shortName: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  country?: string;
  currency: string;
  isActive: boolean;
  pagePermissions: PagePermissions | null;
  logoUrl?: string;
  createdAt: string;
}

// ---- SaaS Subscription Types ----
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  maxAssets: number;
  maxUsers: number;
  maxLocations: number;
  qrBatchLimit: number;
  hasAuditPage: boolean;
  hasAdvancedFilters: boolean;
  hasColumnCustomization: boolean;
  hasBulkQrExport: boolean;
  hasDepreciation: boolean;
  hasReports: boolean;
  hasDocuments: boolean;
  hasProcurement: boolean;
  priceMonthly: number;
  priceYearly: number;
  discountPercent: number;
  discountNote: string;
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  billingCycle: 'monthly' | 'yearly';
  autoRenew: boolean;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Audit Page Row (derived, not a DB table) ----
export interface AuditRow {
  assetId: string;
  assetTag: string;
  assetName: string;
  category: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string;
  brand: string;
  model: string;
  locationName: string;
  departmentName: string;
  assignedTo: string;
  assignedToEmail: string;
  allocationStatus: string;
  allocationDate: string;
  purchaseCost: number;
  purchaseDate: string;
  workMode: WorkMode | null;
}

// ---- Coupon / Promo Code Types ----
export type CouponType = 'percentage' | 'fixed_amount' | 'trial_extension';
export type CouponStatus = 'active' | 'expired' | 'depleted' | 'disabled';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number; // percentage (0-100) or fixed amount or extra trial days
  applicablePlanIds: string[]; // which plans this coupon applies to (empty = all)
  maxRedemptions: number; // 0 = unlimited
  currentRedemptions: number;
  validFrom: string;
  validUntil: string | null;
  status: CouponStatus;
  createdBy: string; // userId of super admin who created it
  organizationId: string | null; // null = platform-wide (super admin)
  createdAt: string;
  updatedAt: string;
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  userId: string;
  organizationId: string | null;
  redeemedAt: string;
  planIdAtRedemption: string; // which plan was active when redeemed
  discountApplied: number; // actual $ or % discount applied
}

// ---- Invite Links ----
export type InviteLinkStatus = 'active' | 'expired' | 'used' | 'disabled';

export interface InviteLink {
  id: string;
  token: string; // unique token for the URL
  label: string; // admin-friendly name e.g. "John's Pro trial invite"
  targetEmail: string | null; // restrict to specific email, null = anyone
  couponId: string | null; // optionally attach a coupon
  planId: string | null; // which plan to sign up for
  maxUses: number; // 0 = unlimited
  currentUses: number;
  expiresAt: string | null;
  status: InviteLinkStatus;
  createdBy: string;
  organizationId: string | null; // null = platform-wide (super admin)
  createdAt: string;
}

// ---- Partner Company Types ----
export type PartnerTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type PartnerType = 'reseller' | 'referral' | 'technology' | 'consulting' | 'strategic' | 'affiliate';
export type PartnerStatus = 'prospective' | 'onboarding' | 'active' | 'inactive' | 'suspended' | 'churned';
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
export type PaymentTerms = 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'upon_receipt';

export interface PartnerCompany {
  id: string;
  companyName: string;
  shortCode: string;
  logoUrl: string;
  website: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  companySize: CompanySize;
  partnerType: PartnerType;
  tier: PartnerTier;
  status: PartnerStatus;
  commissionRate: number;
  lifetimeRevenue: number;
  currentMrr: number;
  dealCount: number;
  assignedManager: string;
  organizationId: string | null;
  referredOrgs: number;
  contractStart: string | null;
  contractEnd: string | null;
  paymentTerms: PaymentTerms;
  tags: string[];
  internalNotes: string;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KPIData {
  assetAllocationRate: number;
  idleAssetPercentage: number;
  maintenanceComplianceRate: number;
  maintenanceCompletionRate: number;
  avgDowntimePerAsset: number;
  maintenanceCostPerAsset: number;
  repairCompletionRate: number;
  avgVendorResponseTime: number;
  stockAvailabilityRate: number;
  totalAssetValue: number;
  totalDepreciation: number;
  budgetAdherence: number;
  approvalTurnaroundTime: number;
}
