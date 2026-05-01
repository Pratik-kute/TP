import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { arrayToCamel, objectToCamel, objectToSnake } from '../lib/caseMapper';
import { Organization, OrganizationSubscription, SubscriptionPlan, Coupon, CouponType, CouponRedemption, InviteLink, PartnerCompany, PartnerTier, PartnerType, PartnerStatus, CompanySize, PaymentTerms, User as UserType, AuditLog } from '../types';
import {
  Building2, LogOut, Sun, Moon, Tag, Link2, CreditCard,
  Plus, X, Copy, Trash2, Eye, EyeOff, Search, ChevronDown, ChevronUp,
  Users, Package, AlertCircle, CheckCircle,
  DollarSign, Shield, RefreshCw, Power,
  Info, Save, Edit3, User, Check, Calendar, Clock,
  Handshake, Globe, MapPin, TrendingUp, Award, Briefcase, FileText, Star, Hash,
  LayoutDashboard, ScrollText, Activity, Settings, Menu, ChevronLeft, ChevronRight, BarChart3, Server, Database
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const APP_VERSION = '5.11.34';

// ---- Helpers ----
const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const NA = 'N/A';
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : NA;
const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : NA;

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const toDateInput = (d: string | null) => d ? new Date(d).toISOString().slice(0, 10) : '';

type Tab = 'dashboard' | 'organizations' | 'partners' | 'coupons' | 'invites' | 'plans' | 'users' | 'audit_logs' | 'revenue' | 'platform_settings' | 'system_health';

interface OrgRow extends Organization {
  subscription: OrganizationSubscription | null;
  plan: SubscriptionPlan | null;
  userCount: number;
  assetCount: number;
}

// ---- Reusable small components ----
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const selectCls = inputCls;

const VALID_TABS: Tab[] = ['dashboard', 'organizations', 'partners', 'coupons', 'invites', 'plans', 'users', 'audit_logs', 'revenue', 'platform_settings', 'system_health'];
const TAB_SLUGS: Record<Tab, string> = {
  dashboard: 'dashboard', organizations: 'organizations', partners: 'partners',
  coupons: 'coupons', invites: 'invites', plans: 'plans', users: 'users',
  audit_logs: 'audit-logs', revenue: 'revenue', platform_settings: 'settings',
  system_health: 'system-health',
};
const SLUG_TO_TAB: Record<string, Tab> = Object.fromEntries(Object.entries(TAB_SLUGS).map(([k, v]) => [v, k as Tab]));

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { adminTab } = useParams<{ adminTab?: string }>();

  // Derive tab from URL, default to dashboard
  const tab: Tab = (adminTab && SLUG_TO_TAB[adminTab]) || 'dashboard';
  const setTab = (t: Tab) => navigate(`/admin/${TAB_SLUGS[t]}`, { replace: false });
  const [loading, setLoading] = useState(true);

  // Sidebar
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Data
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);

  // Search
  const [orgSearch, setOrgSearch] = useState('');
  const [orgPage, setOrgPage] = useState(0);
  const [orgPageSize, setOrgPageSize] = useState(10);
  const [couponSearch, setCouponSearch] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');

  // Expanded org detail
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  // Org edit modal
  const [editingOrg, setEditingOrg] = useState<OrgRow | null>(null);
  const [orgEditForm, setOrgEditForm] = useState({ name: '', shortName: '', contactEmail: '', contactPhone: '', industry: '', isActive: true });
  const [orgSaving, setOrgSaving] = useState(false);

  // Org create modal
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgCreateForm, setOrgCreateForm] = useState({
    name: '', shortName: '', contactEmail: '', contactPhone: '', industry: '',
    planId: '', billingCycle: 'monthly' as string,
    enabledPages: {
      assets: true, allocations: true, maintenance: false, repairs: false,
      consumables: false, procurement: false, assetRequest: false, recovery: false,
      vendors: false, depreciation: false, audits: false, auditLogs: true,
      reports: false, documents: false,
    } as Record<string, boolean>,
  });
  const [orgCreating, setOrgCreating] = useState(false);

  // Create user for org
  const [showCreateUser, setShowCreateUser] = useState<string | null>(null); // org id or '__pick__'
  const [userCreateForm, setUserCreateForm] = useState({ name: '', email: '', password: '', role: 'admin', phone: '', orgId: '' });
  const [userCreating, setUserCreating] = useState(false);

  // Subscription edit modal
  const [editingSub, setEditingSub] = useState<OrgRow | null>(null);
  const [subEditForm, setSubEditForm] = useState({ planId: '', status: 'active', billingCycle: 'monthly', startedAt: '', expiresAt: '', trialEndsAt: '', autoRenew: true });
  const [subSaving, setSubSaving] = useState(false);

  // Plan edit modal
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planEditForm, setPlanEditForm] = useState<any>({});
  const [planSaving, setPlanSaving] = useState(false);

  // Coupon form
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: generateCode(), description: '', type: 'percentage' as CouponType, value: 10, maxRedemptions: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '' });
  const [couponSaving, setCouponSaving] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [showRedemptions, setShowRedemptions] = useState<string | null>(null);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ label: '', targetEmail: '', couponId: '', planId: '', maxUses: 1, expiresAt: '' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Partner companies
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<PartnerStatus | 'all'>('all');
  const [partnerTierFilter, setPartnerTierFilter] = useState<PartnerTier | 'all'>('all');
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<PartnerCompany | null>(null);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    companyName: '', shortCode: '', website: '', contactPerson: '', contactEmail: '', contactPhone: '',
    address: '', city: '', state: '', country: '', industry: '', companySize: 'small' as CompanySize,
    partnerType: 'reseller' as PartnerType, tier: 'bronze' as PartnerTier, status: 'prospective' as PartnerStatus,
    commissionRate: 10, lifetimeRevenue: 0, currentMrr: 0, dealCount: 0, assignedManager: '',
    referredOrgs: 0, contractStart: '', contractEnd: '', paymentTerms: 'net_30' as PaymentTerms,
    tags: [] as string[], internalNotes: '',
  });
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerTagInput, setPartnerTagInput] = useState('');
  const [showCommission, setShowCommission] = useState(false);

  // Convert org to partner
  const [convertOrgToPartner, setConvertOrgToPartner] = useState<OrgRow | null>(null);
  const [convertConfirmText, setConvertConfirmText] = useState('');
  const [converting, setConverting] = useState(false);

  // Delete organization
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<OrgRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null);

  // User Management tab
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userOrgFilter, setUserOrgFilter] = useState<string>('all');
  const [userPage, setUserPage] = useState(0);
  const [userPageSize, setUserPageSize] = useState(10);

  // Audit Logs tab
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditOrgFilter, setAuditOrgFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);

  // Profile dropdown + edit
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Info modal
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileDropdown(false);
    }
    if (showProfileDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfileDropdown]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        { data: orgData }, { data: subData }, { data: planData },
        { data: couponData }, { data: redemptionData }, { data: inviteData },
        { data: userCounts }, { data: assetCounts }, { data: partnerData },
      ] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('organization_subscriptions').select('*'),
        supabase.from('subscription_plans').select('*').order('price_monthly'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('coupon_redemptions').select('*'),
        supabase.from('invite_links').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('organization_id').not('is_global_admin', 'eq', true),
        supabase.from('assets').select('organization_id'),
        supabase.from('partner_companies').select('*').order('created_at', { ascending: false }),
      ]);

      const plansArr = arrayToCamel<SubscriptionPlan>(planData ?? []);
      const subsArr = arrayToCamel<OrganizationSubscription>(subData ?? []);

      const userCountMap: Record<string, number> = {};
      (userCounts ?? []).forEach((u: any) => { userCountMap[u.organization_id] = (userCountMap[u.organization_id] || 0) + 1; });
      const assetCountMap: Record<string, number> = {};
      (assetCounts ?? []).forEach((a: any) => { assetCountMap[a.organization_id] = (assetCountMap[a.organization_id] || 0) + 1; });

      const orgRows: OrgRow[] = arrayToCamel<Organization>(orgData ?? []).map(org => {
        const sub = subsArr.find(s => s.organizationId === org.id) || null;
        const plan = sub ? plansArr.find(p => p.id === sub.planId) || null : null;
        return { ...org, subscription: sub, plan, userCount: userCountMap[org.id] || 0, assetCount: assetCountMap[org.id] || 0 };
      });

      setOrgs(orgRows);
      setPlans(plansArr);
      setCoupons(arrayToCamel<Coupon>(couponData ?? []));
      setRedemptions(arrayToCamel<CouponRedemption>(redemptionData ?? []));
      setInviteLinks(arrayToCamel<InviteLink>(inviteData ?? []));
      setPartners(arrayToCamel<PartnerCompany>(partnerData ?? []));
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setAllUsers([]); // clear caches so they re-fetch
    setAuditLogs([]);
    await loadAll();
    setRefreshing(false);
  };

  // Lazy-load for new tabs
  const loadUsers = async () => {
    if (allUsers.length > 0) return;
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setAllUsers(arrayToCamel<UserType>(data ?? []));
  };
  const loadAuditLogs = async () => {
    if (auditLogs.length > 0) return;
    const { data } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);
    setAuditLogs(arrayToCamel<AuditLog>(data ?? []));
  };
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'audit_logs') loadAuditLogs();
  }, [tab]);
  const handleLogout = () => { logout(); navigate('/login'); };

  // ---- Stats ----
  const activeOrgs = orgs.filter(o => o.isActive);
  const activeSubs = orgs.filter(o => o.subscription?.status === 'active' || o.subscription?.status === 'trialing');
  const mrr = orgs.reduce((sum, o) => {
    if (!o.subscription || !o.plan || o.subscription.status === 'cancelled' || o.subscription.status === 'expired') return sum;
    return sum + (o.subscription.billingCycle === 'yearly' ? o.plan.priceYearly / 12 : o.plan.priceMonthly);
  }, 0);
  const totalUsers = orgs.reduce((sum, o) => sum + o.userCount, 0);
  const totalAssets = orgs.reduce((sum, o) => sum + o.assetCount, 0);
  const expiringSoon = orgs.filter(o => { const d = daysUntil(o.subscription?.expiresAt ?? null); return d !== null && d >= 0 && d <= 30; });

  // ---- Filtered ----
  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
    o.shortName.toLowerCase().includes(orgSearch.toLowerCase()) ||
    (o.contactEmail || '').toLowerCase().includes(orgSearch.toLowerCase())
  );
  const filteredCoupons = coupons.filter(c => c.code.toLowerCase().includes(couponSearch.toLowerCase()) || c.description.toLowerCase().includes(couponSearch.toLowerCase()));
  const filteredInvites = inviteLinks.filter(l => l.label.toLowerCase().includes(inviteSearch.toLowerCase()) || (l.targetEmail || '').toLowerCase().includes(inviteSearch.toLowerCase()));
  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.companyName.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.contactPerson.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.contactEmail.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.shortCode.toLowerCase().includes(partnerSearch.toLowerCase());
    const matchesStatus = partnerStatusFilter === 'all' || p.status === partnerStatusFilter;
    const matchesTier = partnerTierFilter === 'all' || p.tier === partnerTierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  // Partner stats
  const activePartners = partners.filter(p => p.status === 'active');
  const totalPartnerMrr = partners.reduce((s, p) => s + p.currentMrr, 0);
  const totalPartnerRevenue = partners.reduce((s, p) => s + p.lifetimeRevenue, 0);
  const totalPartnerDeals = partners.reduce((s, p) => s + p.dealCount, 0);
  const avgCommission = activePartners.length ? activePartners.reduce((s, p) => s + p.commissionRate, 0) / activePartners.length : 0;

  // ---- Partner CRUD ----
  const resetPartnerForm = () => {
    setShowCommission(false);
    setPartnerForm({
      companyName: '', shortCode: '', website: '', contactPerson: '', contactEmail: '', contactPhone: '',
      address: '', city: '', state: '', country: '', industry: '', companySize: 'small' as CompanySize,
      partnerType: 'reseller' as PartnerType, tier: 'bronze' as PartnerTier, status: 'prospective' as PartnerStatus,
      commissionRate: 0, lifetimeRevenue: 0, currentMrr: 0, dealCount: 0, assignedManager: '',
      referredOrgs: 0, contractStart: '', contractEnd: '', paymentTerms: 'net_30' as PaymentTerms,
      tags: [], internalNotes: '',
    });
    setPartnerTagInput('');
  };
  const openPartnerEdit = (p: PartnerCompany) => {
    setPartnerForm({
      companyName: p.companyName, shortCode: p.shortCode, website: p.website,
      contactPerson: p.contactPerson, contactEmail: p.contactEmail, contactPhone: p.contactPhone,
      address: p.address, city: p.city, state: p.state, country: p.country,
      industry: p.industry, companySize: p.companySize, partnerType: p.partnerType,
      tier: p.tier, status: p.status, commissionRate: p.commissionRate,
      lifetimeRevenue: p.lifetimeRevenue, currentMrr: p.currentMrr, dealCount: p.dealCount,
      assignedManager: p.assignedManager, referredOrgs: p.referredOrgs,
      contractStart: p.contractStart ? new Date(p.contractStart).toISOString().slice(0, 10) : '',
      contractEnd: p.contractEnd ? new Date(p.contractEnd).toISOString().slice(0, 10) : '',
      paymentTerms: p.paymentTerms, tags: p.tags || [], internalNotes: p.internalNotes,
    });
    setPartnerTagInput('');
    setShowCommission(p.commissionRate > 0);
    setEditingPartner(p);
  };
  const savePartner = async () => {
    setPartnerSaving(true);
    try {
      const payload: any = {
        company_name: partnerForm.companyName, short_code: partnerForm.shortCode, website: partnerForm.website,
        contact_person: partnerForm.contactPerson, contact_email: partnerForm.contactEmail, contact_phone: partnerForm.contactPhone,
        address: partnerForm.address, city: partnerForm.city, state: partnerForm.state, country: partnerForm.country,
        industry: partnerForm.industry, company_size: partnerForm.companySize, partner_type: partnerForm.partnerType,
        tier: partnerForm.tier, status: partnerForm.status, commission_rate: partnerForm.commissionRate,
        lifetime_revenue: partnerForm.lifetimeRevenue, current_mrr: partnerForm.currentMrr, deal_count: partnerForm.dealCount,
        assigned_manager: partnerForm.assignedManager, referred_orgs: partnerForm.referredOrgs,
        contract_start: partnerForm.contractStart || null, contract_end: partnerForm.contractEnd || null,
        payment_terms: partnerForm.paymentTerms, tags: partnerForm.tags, internal_notes: partnerForm.internalNotes,
      };
      if (partnerForm.status === 'active' && !payload.onboarded_at) payload.onboarded_at = new Date().toISOString();
      if (editingPartner) {
        const { error } = await supabase.from('partner_companies').update(payload).eq('id', editingPartner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('partner_companies').insert(payload);
        if (error) throw error;
      }
      await loadAll();
      setEditingPartner(null);
      setShowPartnerForm(false);
      resetPartnerForm();
    } catch (err) { console.error('Failed to save partner:', err); } finally { setPartnerSaving(false); }
  };
  const deletePartner = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this partner?')) return;
    try {
      await supabase.from('partner_companies').delete().eq('id', id);
      setPartners(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleConvertOrgToPartner = async () => {
    if (!convertOrgToPartner || convertConfirmText !== 'I understand') return;
    setConverting(true);
    try {
      const org = convertOrgToPartner;
      const { error } = await supabase.from('partner_companies').insert({
        company_name: org.name,
        short_code: org.shortName,
        contact_email: org.contactEmail || '',
        contact_phone: org.contactPhone || '',
        industry: org.industry || '',
        company_size: 'medium',
        partner_type: 'strategic',
        tier: 'bronze',
        status: 'active',
        commission_rate: 0,
        lifetime_revenue: 0,
        current_mrr: 0,
        deal_count: 0,
        assigned_manager: '',
        referred_orgs: 0,
        payment_terms: 'net_30',
        tags: ['converted-from-org'],
        internal_notes: `Converted from organization "${org.name}" (${org.shortName}) on ${new Date().toLocaleDateString()}`,
        onboarded_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadAll();
      setConvertOrgToPartner(null);
      setConvertConfirmText('');
    } catch (err) { console.error('Failed to convert org to partner:', err); } finally { setConverting(false); }
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrgTarget) return;
    if (deleteConfirmText !== deleteOrgTarget.shortName) return;
    setDeletingOrg(true);
    setDeleteOrgError(null);
    try {
      const orgId = deleteOrgTarget.id;
      // Child rows protected by ON DELETE CASCADE (see migration_cascade_org_delete.sql).
      // We still manually clear a few tables whose FKs use SET NULL / NO ACTION so the org
      // record doesn't leak references to deleted orgs.
      // partner_companies.organization_id already uses ON DELETE SET NULL (schema_v9) so we leave it.
      const { error } = await supabase.from('organizations').delete().eq('id', orgId);
      if (error) throw error;
      setOrgs(prev => prev.filter(o => o.id !== orgId));
      setAllUsers(prev => prev.filter(u => u.organizationId !== orgId));
      if (expandedOrgId === orgId) setExpandedOrgId(null);
      setDeleteOrgTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete organization';
      console.error('Delete org failed:', err);
      setDeleteOrgError(msg);
    } finally {
      setDeletingOrg(false);
    }
  };

  const isOrgAlreadyPartner = (org: OrgRow) => partners.some(p =>
    p.companyName.toLowerCase() === org.name.toLowerCase() || p.shortCode.toLowerCase() === org.shortName.toLowerCase()
  );

  const tierConfig: Record<PartnerTier, { label: string; color: string; bg: string; icon: string }> = {
    platinum: { label: 'Platinum', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', icon: '💎' },
    gold: { label: 'Gold', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: '🥇' },
    silver: { label: 'Silver', color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-200 dark:bg-gray-700/50', icon: '🥈' },
    bronze: { label: 'Bronze', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: '🥉' },
  };
  const partnerStatusConfig: Record<PartnerStatus, { label: string; cls: string }> = {
    prospective: { label: 'Prospective', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    onboarding: { label: 'Onboarding', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    inactive: { label: 'Inactive', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
    suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    churned: { label: 'Churned', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  };
  const partnerTypeLabels: Record<PartnerType, string> = {
    reseller: 'Reseller', referral: 'Referral', technology: 'Technology',
    consulting: 'Consulting', strategic: 'Strategic', affiliate: 'Affiliate',
  };
  const companySizeLabels: Record<CompanySize, string> = {
    startup: 'Startup', small: 'Small', medium: 'Medium', large: 'Large', enterprise: 'Enterprise',
  };
  const paymentTermLabels: Record<PaymentTerms, string> = {
    net_15: 'Net 15', net_30: 'Net 30', net_45: 'Net 45', net_60: 'Net 60', upon_receipt: 'Upon Receipt',
  };

  // ---- Org Edit ----
  const openOrgEdit = (org: OrgRow) => {
    setOrgEditForm({ name: org.name, shortName: org.shortName, contactEmail: org.contactEmail || '', contactPhone: org.contactPhone || '', industry: org.industry || '', isActive: org.isActive });
    setEditingOrg(org);
  };
  const saveOrg = async () => {
    if (!editingOrg) return;
    setOrgSaving(true);
    try {
      const { error } = await supabase.from('organizations').update({
        name: orgEditForm.name, short_name: orgEditForm.shortName, contact_email: orgEditForm.contactEmail,
        contact_phone: orgEditForm.contactPhone, industry: orgEditForm.industry, is_active: orgEditForm.isActive,
      }).eq('id', editingOrg.id);
      if (error) throw error;
      setOrgs(prev => prev.map(o => o.id === editingOrg.id ? { ...o, ...orgEditForm } : o));
      setEditingOrg(null);
    } catch (err) { console.error('Failed to save org:', err); } finally { setOrgSaving(false); }
  };

  const createOrg = async () => {
    if (!orgCreateForm.name.trim() || !orgCreateForm.shortName.trim()) return;
    setOrgCreating(true);
    try {
      // Build page_permissions from enabled pages
      const enabledPageSlugs = Object.entries(orgCreateForm.enabledPages).filter(([, v]) => v).map(([k]) => k);
      const pagePerms: Record<string, string[]> = {};
      ['manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'].forEach(role => {
        pagePerms[role] = enabledPageSlugs;
      });

      const { data: newOrg, error } = await supabase.from('organizations').insert({
        name: orgCreateForm.name.trim(),
        short_name: orgCreateForm.shortName.trim().toUpperCase(),
        contact_email: orgCreateForm.contactEmail.trim(),
        contact_phone: orgCreateForm.contactPhone.trim(),
        industry: orgCreateForm.industry.trim(),
        is_active: true,
        page_permissions: pagePerms,
      }).select().single();
      if (error) throw error;
      const created = objectToCamel<Organization>(newOrg);

      // Create subscription if plan selected
      let sub: OrganizationSubscription | null = null;
      let plan: SubscriptionPlan | null = null;
      if (orgCreateForm.planId) {
        plan = plans.find(p => p.id === orgCreateForm.planId) || null;
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data: subData } = await supabase.from('organization_subscriptions').insert({
          organization_id: created.id,
          plan_id: orgCreateForm.planId,
          status: 'active',
          billing_cycle: orgCreateForm.billingCycle,
          started_at: now,
          expires_at: expiresAt,
          auto_renew: true,
        }).select().single();
        if (subData) sub = objectToCamel<OrganizationSubscription>(subData);
      }

      setOrgs(prev => [{ ...created, subscription: sub, plan, userCount: 0, assetCount: 0 }, ...prev]);
      setShowCreateOrg(false);
      setOrgCreateForm({
        name: '', shortName: '', contactEmail: '', contactPhone: '', industry: '',
        planId: '', billingCycle: 'monthly',
        enabledPages: { assets: true, allocations: true, maintenance: false, repairs: false, consumables: false, procurement: false, assetRequest: false, recovery: false, vendors: false, depreciation: false, audits: false, auditLogs: true, reports: false, documents: false },
      });
    } catch (err) { console.error('Failed to create org:', err); } finally { setOrgCreating(false); }
  };

  const createUser = async () => {
    const orgId = showCreateUser === '__pick__' ? userCreateForm.orgId : showCreateUser;
    if (!orgId || !userCreateForm.name.trim() || !userCreateForm.email.trim()) return;
    setUserCreating(true);
    try {
      const { data: newUser, error } = await supabase.from('users').insert({
        name: userCreateForm.name.trim(),
        email: userCreateForm.email.trim(),
        password: userCreateForm.password.trim() || 'password',
        role: userCreateForm.role,
        phone: userCreateForm.phone.trim(),
        is_active: true,
        is_global_admin: false,
        organization_id: orgId,
      }).select().single();
      if (error) throw error;
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, userCount: o.userCount + 1 } : o));
      if (newUser) setAllUsers(prev => [objectToCamel<UserType>(newUser), ...prev]);
      setShowCreateUser(null);
      setUserCreateForm({ name: '', email: '', password: '', role: 'admin', phone: '', orgId: '' });
    } catch (err) { console.error('Failed to create user:', err); } finally { setUserCreating(false); }
  };

  // ---- Subscription Edit ----
  const openSubEdit = (org: OrgRow) => {
    const s = org.subscription;
    setSubEditForm({
      planId: s?.planId || '', status: s?.status || 'active', billingCycle: s?.billingCycle || 'monthly',
      startedAt: toDateInput(s?.startedAt ?? null), expiresAt: toDateInput(s?.expiresAt ?? null),
      trialEndsAt: toDateInput(s?.trialEndsAt ?? null), autoRenew: s?.autoRenew ?? true,
    });
    setEditingSub(org);
  };
  const saveSub = async () => {
    if (!editingSub) return;
    setSubSaving(true);
    try {
      const payload: any = {
        plan_id: subEditForm.planId, status: subEditForm.status, billing_cycle: subEditForm.billingCycle,
        started_at: subEditForm.startedAt ? new Date(subEditForm.startedAt).toISOString() : new Date().toISOString(),
        expires_at: subEditForm.expiresAt ? new Date(subEditForm.expiresAt).toISOString() : null,
        trial_ends_at: subEditForm.trialEndsAt ? new Date(subEditForm.trialEndsAt).toISOString() : null,
        auto_renew: subEditForm.autoRenew,
        cancelled_at: subEditForm.status === 'cancelled' ? new Date().toISOString() : null,
      };
      if (editingSub.subscription) {
        const { error } = await supabase.from('organization_subscriptions').update(payload).eq('id', editingSub.subscription.id);
        if (error) throw error;
      } else {
        payload.organization_id = editingSub.id;
        const { error } = await supabase.from('organization_subscriptions').insert(payload);
        if (error) throw error;
      }
      await loadAll();
      setEditingSub(null);
    } catch (err) { console.error('Failed to save subscription:', err); } finally { setSubSaving(false); }
  };
  const endSubscription = async () => {
    if (!editingSub?.subscription) return;
    setSubSaving(true);
    try {
      await supabase.from('organization_subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', editingSub.subscription.id);
      await loadAll();
      setEditingSub(null);
    } catch (err) { console.error(err); } finally { setSubSaving(false); }
  };

  // ---- Plan Edit ----
  const openPlanEdit = (plan: SubscriptionPlan) => {
    setPlanEditForm({
      displayName: plan.displayName, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly,
      maxAssets: plan.maxAssets, maxUsers: plan.maxUsers, maxLocations: plan.maxLocations, qrBatchLimit: plan.qrBatchLimit,
      hasAuditPage: plan.hasAuditPage, hasAdvancedFilters: plan.hasAdvancedFilters, hasColumnCustomization: plan.hasColumnCustomization,
      hasBulkQrExport: plan.hasBulkQrExport, hasDepreciation: plan.hasDepreciation, hasReports: plan.hasReports,
      hasDocuments: plan.hasDocuments, hasProcurement: plan.hasProcurement,
      discountPercent: plan.discountPercent || 0, discountNote: plan.discountNote || '', isActive: plan.isActive,
    });
    setEditingPlan(plan);
  };
  const savePlan = async () => {
    if (!editingPlan) return;
    setPlanSaving(true);
    try {
      const { error } = await supabase.from('subscription_plans').update(objectToSnake(planEditForm)).eq('id', editingPlan.id);
      if (error) throw error;
      setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...planEditForm } : p));
      // Also refresh orgs so plan names update
      await loadAll();
      setEditingPlan(null);
    } catch (err) { console.error('Failed to save plan:', err); } finally { setPlanSaving(false); }
  };

  // ---- Profile Edit ----
  const openProfileEdit = () => {
    setProfileForm({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
    setShowProfileEdit(true);
    setShowProfileDropdown(false);
  };
  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase.from('users').update({ name: profileForm.name, email: profileForm.email, phone: profileForm.phone }).eq('id', user.id);
      if (error) throw error;
      // Reload to reflect changes
      window.location.reload();
    } catch (err) { console.error('Failed to save profile:', err); } finally { setProfileSaving(false); }
  };

  // ---- Coupon CRUD ----
  const createCoupon = async () => {
    setCouponSaving(true);
    try {
      const { data, error } = await supabase.from('coupons').insert({
        code: couponForm.code, description: couponForm.description, type: couponForm.type, value: couponForm.value,
        applicable_plan_ids: [], max_redemptions: couponForm.maxRedemptions, current_redemptions: 0,
        valid_from: new Date(couponForm.validFrom).toISOString(),
        valid_until: couponForm.validUntil ? new Date(couponForm.validUntil).toISOString() : null,
        status: 'active', created_by: user?.id, organization_id: null,
      }).select().single();
      if (error) throw error;
      setCoupons(prev => [objectToCamel<Coupon>(data), ...prev]);
      setShowCouponForm(false);
      setCouponForm({ code: generateCode(), description: '', type: 'percentage', value: 10, maxRedemptions: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '' });
    } catch (err) { console.error(err); } finally { setCouponSaving(false); }
  };
  const toggleCouponStatus = async (c: Coupon) => {
    const s = c.status === 'active' ? 'disabled' : 'active';
    await supabase.from('coupons').update({ status: s }).eq('id', c.id);
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, status: s as any } : x));
  };
  const deleteCoupon = async (id: string) => { await supabase.from('coupons').delete().eq('id', id); setCoupons(prev => prev.filter(c => c.id !== id)); };

  // ---- Invite CRUD ----
  const createInvite = async () => {
    setInviteSaving(true);
    try {
      const token = generateCode() + generateCode();
      const { data, error } = await supabase.from('invite_links').insert({
        token, label: inviteForm.label, target_email: inviteForm.targetEmail || null, coupon_id: inviteForm.couponId || null,
        plan_id: inviteForm.planId || null, max_uses: inviteForm.maxUses, current_uses: 0,
        expires_at: inviteForm.expiresAt ? new Date(inviteForm.expiresAt).toISOString() : null,
        status: 'active', created_by: user?.id, organization_id: null,
      }).select().single();
      if (error) throw error;
      setInviteLinks(prev => [objectToCamel<InviteLink>(data), ...prev]);
      setShowInviteForm(false);
      setInviteForm({ label: '', targetEmail: '', couponId: '', planId: '', maxUses: 1, expiresAt: '' });
    } catch (err) { console.error(err); } finally { setInviteSaving(false); }
  };
  const toggleInviteStatus = async (l: InviteLink) => {
    const s = l.status === 'active' ? 'disabled' : 'active';
    await supabase.from('invite_links').update({ status: s }).eq('id', l.id);
    setInviteLinks(prev => prev.map(x => x.id === l.id ? { ...x, status: s as any } : x));
  };
  const deleteInvite = async (id: string) => { await supabase.from('invite_links').delete().eq('id', id); setInviteLinks(prev => prev.filter(l => l.id !== id)); };

  // ---- Status badge helper ----
  const statusBadge = (status: string) => {
    const m: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      disabled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      depleted: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      used: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return m[status] || m.expired;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-zinc-950">
        <div className="w-10 h-10 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ---- Sidebar navigation ----
  interface AdminNavItem { key: Tab; label: string; icon: any; count?: number; }
  interface AdminNavGroup { label: string; items: AdminNavItem[]; }
  const adminNavGroups: AdminNavGroup[] = [
    { label: '', items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { label: 'Platform', items: [
      { key: 'organizations', label: 'Organizations', icon: Building2, count: orgs.length },
      { key: 'users', label: 'User Management', icon: Users },
      { key: 'audit_logs', label: 'Audit Logs', icon: ScrollText },
    ]},
    { label: 'Monetization', items: [
      { key: 'plans', label: 'Plans', icon: CreditCard, count: plans.length },
      { key: 'coupons', label: 'Coupons', icon: Tag, count: coupons.length },
      { key: 'invites', label: 'Invite Links', icon: Link2, count: inviteLinks.length },
      { key: 'revenue', label: 'Revenue & Billing', icon: DollarSign },
    ]},
    { label: 'Partnerships', items: [
      { key: 'partners', label: 'Partner Companies', icon: Handshake, count: partners.length },
    ]},
    { label: 'System', items: [
      { key: 'platform_settings', label: 'Platform Settings', icon: Settings },
      { key: 'system_health', label: 'System Health', icon: Activity },
    ]},
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className={`rounded-xl object-contain ${collapsed ? 'w-9 h-9' : 'w-10 h-10'}`} />
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-white tracking-tight">Asset Tracker</span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-900/30 rounded">Admin</span>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {adminNavGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && !collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group.label}</p>
            )}
            {group.label && collapsed && <div className="mx-3 my-2 border-t border-white/10" />}
            {group.items.map(item => {
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); setMobileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 shadow-[inset_0_0_12px_rgba(16,185,129,0.08)]'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.count !== undefined && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-500'}`}>{item.count}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User info + collapse */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-amber-400">Super Admin</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors text-xs"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /> <span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  const featureKeys = [
    { k: 'hasAuditPage', l: 'Audits' }, { k: 'hasAdvancedFilters', l: 'Adv. Filters' },
    { k: 'hasColumnCustomization', l: 'Custom Columns' }, { k: 'hasBulkQrExport', l: 'Bulk QR' },
    { k: 'hasDepreciation', l: 'Depreciation' }, { k: 'hasReports', l: 'Reports' },
    { k: 'hasDocuments', l: 'Documents' }, { k: 'hasProcurement', l: 'Procurement' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-zinc-950">
      {/* ================= SIDEBAR (Desktop) ================= */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-zinc-900 to-zinc-950 text-white flex-col transition-all duration-300 h-full flex-shrink-0`}>
        {sidebarContent}
      </aside>

      {/* ================= SIDEBAR (Mobile Overlay) ================= */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white flex flex-col animate-slideIn">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInfoModal(true)} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" title="App Info">
              <Info className="w-5 h-5" />
            </button>
            <button onClick={handleRefresh} className={`p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${refreshing ? 'animate-spin' : ''}`} title="Refresh data">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" title={isDark ? 'Light mode' : 'Dark mode'}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative" ref={profileRef}>
              <button onClick={() => setShowProfileDropdown(p => !p)} className="flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-zinc-700 ml-1">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Super Admin</p>
                </div>
              </button>
              {showProfileDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="p-3 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={openProfileEdit} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                    <User className="w-4 h-4" /> Edit Profile
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div key={tab} className="max-w-[1400px] mx-auto animate-fadeIn">

        {/* ================= DASHBOARD TAB ================= */}
        {tab === 'dashboard' && (() => {
          const inactiveOrgs = orgs.filter(o => !o.isActive);
          const trialingSubs = orgs.filter(o => o.subscription?.status === 'trialing');
          const cancelledSubs = orgs.filter(o => o.subscription?.status === 'cancelled');
          const noSubOrgs = orgs.filter(o => !o.subscription);
          const arr = mrr * 12;
          const avgUsersPerOrg = activeOrgs.length > 0 ? (totalUsers / activeOrgs.length).toFixed(1) : '0';
          const avgAssetsPerOrg = activeOrgs.length > 0 ? (totalAssets / activeOrgs.length).toFixed(1) : '0';
          const topOrgsByAssets = [...orgs].sort((a, b) => b.assetCount - a.assetCount).slice(0, 5);
          const topOrgsByUsers = [...orgs].sort((a, b) => b.userCount - a.userCount).slice(0, 5);
          const planDistribution = plans.filter(p => p.isActive).map(p => ({
            plan: p, count: orgs.filter(o => o.plan?.id === p.id).length,
          }));
          return (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold">Welcome back, {user?.name || 'Admin'}</h2>
              <p className="text-emerald-100 mt-1 text-sm">Here's what's happening across your platform today.</p>
              <div className="flex items-center gap-4 mt-4 text-xs text-emerald-200">
                <span>{orgs.length} organizations</span>
                <span className="w-1 h-1 rounded-full bg-emerald-300" />
                <span>{totalUsers} users</span>
                <span className="w-1 h-1 rounded-full bg-emerald-300" />
                <span>{totalAssets} assets managed</span>
              </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Active Orgs', value: activeOrgs.length, sub: `${inactiveOrgs.length} inactive`, icon: Building2, color: 'text-emerald-600' },
                { label: 'Active Subs', value: activeSubs.length, sub: `${trialingSubs.length} trialing`, icon: CheckCircle, color: 'text-emerald-500' },
                { label: 'MRR', value: `$${mrr.toFixed(0)}`, sub: `ARR: $${arr.toFixed(0)}`, icon: DollarSign, color: 'text-green-500' },
                { label: 'Total Users', value: totalUsers, sub: `~${avgUsersPerOrg}/org`, icon: Users, color: 'text-blue-500' },
                { label: 'Total Assets', value: totalAssets, sub: `~${avgAssetsPerOrg}/org`, icon: Package, color: 'text-purple-500' },
                { label: 'Expiring Soon', value: expiringSoon.length, sub: `${cancelledSubs.length} cancelled`, icon: AlertCircle, color: expiringSoon.length > 0 ? 'text-amber-500' : 'text-gray-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Secondary Row: Revenue + Plan Distribution + Top Orgs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Revenue Snapshot */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Revenue Snapshot</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Monthly (MRR)</span><span className="font-bold text-gray-900 dark:text-white">${mrr.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Annual (ARR)</span><span className="font-bold text-gray-900 dark:text-white">${arr.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Avg Revenue / Org</span><span className="font-medium text-gray-700 dark:text-gray-300">${activeSubs.length > 0 ? (mrr / activeSubs.length).toFixed(2) : '0.00'}</span></div>
                  <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex justify-between"><span className="text-gray-500">Monthly Billing</span><span className="font-medium text-gray-700 dark:text-gray-300">{orgs.filter(o => o.subscription?.billingCycle === 'monthly').length} orgs</span></div>
                    <div className="flex justify-between mt-1"><span className="text-gray-500">Yearly Billing</span><span className="font-medium text-gray-700 dark:text-gray-300">{orgs.filter(o => o.subscription?.billingCycle === 'yearly').length} orgs</span></div>
                  </div>
                </div>
              </div>

              {/* Plan Distribution */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Plan Distribution</h3>
                <div className="space-y-3">
                  {planDistribution.map(({ plan: p, count }) => {
                    const pct = orgs.length > 0 ? (count / orgs.length) * 100 : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{p.displayName}</span>
                          <span className="text-xs text-gray-500">{count} org{count !== 1 ? 's' : ''} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {noSubOrgs.length > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-zinc-800">
                      <span className="text-gray-400">No Subscription</span>
                      <span className="text-xs text-gray-500">{noSubOrgs.length} org{noSubOrgs.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Organizations */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-500" /> Top Organizations</h3>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">By Assets</p>
                  {topOrgsByAssets.map((o, i) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>{o.name}</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{o.assetCount} assets</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">By Users</p>
                  {topOrgsByUsers.map((o, i) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>{o.name}</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{o.userCount} users</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Expiring Soon */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Expiring Within 30 Days ({expiringSoon.length})</h3>
                {expiringSoon.length === 0 ? (
                  <div className="text-center py-6"><CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" /><p className="text-sm text-gray-400">All subscriptions are healthy</p></div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {expiringSoon.map(org => (
                      <div key={org.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{org.name}</span>
                          <span className="text-xs text-gray-500">({org.plan?.displayName || 'No plan'})</span>
                        </div>
                        <span className="text-xs font-semibold text-amber-600">{daysUntil(org.subscription?.expiresAt ?? null)}d left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subscription Status Breakdown */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /> Subscription Health</h3>
                <div className="space-y-2">
                  {[
                    { status: 'active', label: 'Active', color: 'bg-emerald-500' },
                    { status: 'trialing', label: 'Trialing', color: 'bg-blue-500' },
                    { status: 'past_due', label: 'Past Due', color: 'bg-amber-500' },
                    { status: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
                    { status: 'expired', label: 'Expired', color: 'bg-gray-400' },
                  ].map(s => {
                    const count = orgs.filter(o => o.subscription?.status === s.status).length;
                    const pct = orgs.length > 0 ? (count / orgs.length) * 100 : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
                          <span className="text-xs text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTab('organizations')} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><Building2 className="w-3.5 h-3.5" /> Manage Organizations</button>
                <button onClick={() => setShowCreateOrg(true)} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><Plus className="w-3.5 h-3.5" /> Create Organization</button>
                <button onClick={() => setTab('users')} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><Users className="w-3.5 h-3.5" /> View All Users</button>
                <button onClick={() => setTab('revenue')} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><DollarSign className="w-3.5 h-3.5" /> Revenue Report</button>
                <button onClick={() => setTab('audit_logs')} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><ScrollText className="w-3.5 h-3.5" /> Audit Logs</button>
                <button onClick={() => setTab('system_health')} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-zinc-700"><Activity className="w-3.5 h-3.5" /> System Health</button>
              </div>
            </div>

            {/* Platform Info Footer */}
            <div className="text-center py-3 text-[11px] text-gray-400 dark:text-gray-600">
              Asset Tracker v{APP_VERSION} &middot; {orgs.length} organizations &middot; Platform Administration Console
            </div>
          </div>
          );
        })()}

        {/* ================= ORGANIZATIONS TAB ================= */}
        {tab === 'organizations' && (() => {
          const orgTotalPages = Math.ceil(filteredOrgs.length / orgPageSize);
          const orgPagedRows = filteredOrgs.slice(orgPage * orgPageSize, (orgPage + 1) * orgPageSize);
          const activeOrgsCount = orgs.filter(o => o.isActive).length;
          const trialCount = orgs.filter(o => o.subscription?.status === 'trialing').length;
          const expiringCount = orgs.filter(o => {
            const d = daysUntil(o.subscription?.expiresAt ?? null);
            return d !== null && d >= 0 && d <= 30;
          }).length;
          const expiredCount = orgs.filter(o => {
            const d = daysUntil(o.subscription?.expiresAt ?? null);
            return d !== null && d < 0;
          }).length;
          return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Organizations</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{orgs.length} organizations &middot; {activeOrgsCount} active</p>
              </div>
              <button onClick={() => setShowCreateOrg(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Plus className="w-4 h-4" /> Create Organization
              </button>
            </div>

            {/* Quick stat cards */}
            {orgs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Active', value: activeOrgsCount },
                  { label: 'Inactive', value: orgs.length - activeOrgsCount },
                  { label: 'Trialing', value: trialCount },
                  { label: 'Expiring ≤30d', value: expiringCount + expiredCount },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search organizations by name, slug, or email..." value={orgSearch} onChange={e => { setOrgSearch(e.target.value); setOrgPage(0); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>

            {/* Table */}
            <div className="card card-gradient overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                      {['Organization', 'Plan', 'Status', 'Billing', 'Users', 'Assets', 'Expires', 'Created', ''].map(h => (
                        <th key={h} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-12 text-gray-400 dark:text-gray-500">Loading organizations...</td></tr>
                    ) : filteredOrgs.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-12 text-gray-400 dark:text-gray-500">No organizations match your search</td></tr>
                    ) : (
                      orgPagedRows.map((org, idx) => {
                      const expiryDays = daysUntil(org.subscription?.expiresAt ?? null);
                      const isExpanded = expandedOrgId === org.id;
                      return (
                        <React.Fragment key={org.id}>
                          <tr className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors cursor-pointer" onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{String(orgPage * orgPageSize + idx + 1).padStart(3, '0')}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${org.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                  <Building2 className={`w-4 h-4 ${org.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{org.name}</p>
                                  <p className="text-[11px] text-gray-400 font-mono">{org.shortName}</p>
                                </div>
                                {!org.isActive && <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">Inactive</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {org.plan ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  org.plan.name === 'premium' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                  org.plan.name === 'pro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}>{org.plan.displayName}</span>
                              ) : <span className="text-xs text-gray-400">Free tier</span>}
                            </td>
                            <td className="px-4 py-3">
                              {org.subscription ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(org.subscription.status)}`}>{org.subscription.status}</span>
                              ) : <span className="text-xs text-gray-400">No subscription</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                              {org.subscription ? (
                                <span className="capitalize">{org.subscription.billingCycle || 'monthly'}</span>
                              ) : NA}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {org.userCount}{org.plan && org.plan.maxUsers !== -1 && <span className="text-gray-400 ml-0.5">/ {org.plan.maxUsers}</span>}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {org.assetCount}{org.plan && org.plan.maxAssets !== -1 && <span className="text-gray-400 ml-0.5">/ {org.plan.maxAssets}</span>}
                            </td>
                            <td className="px-4 py-3">
                              {org.subscription?.expiresAt ? (
                                <div>
                                  <span className="text-xs text-gray-600 dark:text-gray-300">{formatDate(org.subscription.expiresAt)}</span>
                                  {expiryDays !== null && expiryDays <= 30 && expiryDays >= 0 && <span className="ml-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">({expiryDays}d)</span>}
                                  {expiryDays !== null && expiryDays < 0 && <span className="ml-1 text-[10px] font-semibold text-red-500">Expired</span>}
                                </div>
                              ) : <span className="text-xs text-gray-400">{NA}</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(org.createdAt)}</td>
                            <td className="px-4 py-3 text-right">{isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}</td>
                          </tr>
                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} className="px-4 py-4 bg-gray-50/70 dark:bg-zinc-800/20">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  {/* Org Details */}
                                  <div className="card card-gradient p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Organization Details</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-[11px] text-gray-700 dark:text-gray-300 select-all">{org.id}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Slug</span><span className="font-semibold text-gray-700 dark:text-gray-300">{org.shortName}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Contact Email</span><span className="text-gray-700 dark:text-gray-300">{org.contactEmail || NA}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="text-gray-700 dark:text-gray-300">{org.contactPhone || NA}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Industry</span><span className="text-gray-700 dark:text-gray-300">{org.industry || NA}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Active</span><span className={`font-medium ${org.isActive ? 'text-emerald-600' : 'text-red-500'}`}>{org.isActive ? 'Yes' : 'No'}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-700 dark:text-gray-300">{formatDateTime(org.createdAt)}</span></div>
                                    </div>
                                  </div>
                                  {/* Subscription Details */}
                                  <div className="card card-gradient p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subscription</h4>
                                      <button onClick={(e) => { e.stopPropagation(); openSubEdit(org); }} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                                        <Edit3 className="w-3 h-3" /> {org.subscription ? 'Manage' : 'Assign Plan'}
                                      </button>
                                    </div>
                                    {org.subscription ? (
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-semibold text-gray-700 dark:text-gray-300">{org.plan?.displayName || 'Unknown'}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-medium capitalize ${org.subscription.status === 'active' ? 'text-emerald-600' : org.subscription.status === 'past_due' ? 'text-amber-600' : 'text-gray-500'}`}>{org.subscription.status}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="text-gray-700 dark:text-gray-300 capitalize">{org.subscription.billingCycle || 'monthly'}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Started</span><span className="text-gray-700 dark:text-gray-300">{formatDate(org.subscription.startedAt)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Expires</span><span className="text-gray-700 dark:text-gray-300">{formatDate(org.subscription.expiresAt)}</span></div>
                                        {org.subscription.trialEndsAt && <div className="flex justify-between"><span className="text-gray-500">Trial Ends</span><span className="text-gray-700 dark:text-gray-300">{formatDate(org.subscription.trialEndsAt)}</span></div>}
                                        <div className="flex justify-between"><span className="text-gray-500">Auto-Renew</span><span className={`font-medium ${org.subscription.autoRenew ? 'text-emerald-600' : 'text-gray-400'}`}>{org.subscription.autoRenew ? 'Yes' : 'No'}</span></div>
                                        {org.subscription.cancelledAt && <div className="flex justify-between"><span className="text-gray-500">Cancelled</span><span className="text-red-500">{formatDate(org.subscription.cancelledAt)}</span></div>}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-sm text-gray-400 py-4"><AlertCircle className="w-4 h-4" /><span>No subscription assigned</span></div>
                                    )}
                                  </div>
                                  {/* Usage / Limits */}
                                  <div className="card card-gradient p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Usage & Limits</h4>
                                    <div className="space-y-3">
                                      {[{ label: 'Users', used: org.userCount, limit: org.plan?.maxUsers ?? 5 }, { label: 'Assets', used: org.assetCount, limit: org.plan?.maxAssets ?? 50 }].map(u => {
                                        const pct = u.limit === -1 ? 0 : Math.min(100, (u.used / u.limit) * 100);
                                        return (
                                          <div key={u.label}>
                                            <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{u.label}</span><span className="font-medium text-gray-700 dark:text-gray-300">{u.used} / {u.limit === -1 ? 'Unlimited' : u.limit}</span></div>
                                            <div className="h-2 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: u.limit === -1 ? '0%' : `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {org.plan && (
                                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Plan Features</p>
                                          <div className="flex flex-wrap gap-1">
                                            {featureKeys.map(f => (
                                              <span key={f.k} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${(org.plan as any)[f.k] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through'}`}>{f.l}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Actions */}
                                  <div className="card card-gradient p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Actions</h4>
                                    <div className="space-y-2">
                                      <button onClick={(e) => { e.stopPropagation(); openOrgEdit(org); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                                        <Edit3 className="w-4 h-4" /> Quick Edit
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setShowCreateUser(org.id); setUserCreateForm({ name: '', email: '', password: '', role: 'admin', phone: '', orgId: org.id }); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                        <User className="w-4 h-4" /> Add User
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); openSubEdit(org); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                                        <CreditCard className="w-4 h-4" /> {org.subscription ? 'Manage Subscription' : 'Assign Plan'}
                                      </button>
                                      {!isOrgAlreadyPartner(org) ? (
                                        <button onClick={(e) => { e.stopPropagation(); setConvertOrgToPartner(org); setConvertConfirmText(''); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                                          <Handshake className="w-4 h-4" /> Convert to Partner
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                          <Handshake className="w-4 h-4" /> Partner Company
                                        </div>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteOrgTarget(org); setDeleteConfirmText(''); setDeleteOrgError(null); }}
                                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" /> Delete Organization
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer — pagination */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredOrgs.length === 0
                      ? 'No organizations found'
                      : `Showing ${orgPage * orgPageSize + 1}–${Math.min((orgPage + 1) * orgPageSize, filteredOrgs.length)} of ${filteredOrgs.length} organizations`}
                  </p>
                  <select
                    value={orgPageSize}
                    onChange={e => { setOrgPageSize(Number(e.target.value)); setOrgPage(0); }}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {[10, 25, 50, 100, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
                  </select>
                </div>
                {orgTotalPages > 1 && (
                  <div className="flex gap-1">
                    <button onClick={() => setOrgPage(p => Math.max(0, p - 1))} disabled={orgPage === 0}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    {Array.from({ length: Math.min(orgTotalPages, 5) }, (_, i) => {
                      const pageNum = orgPage < 3 ? i : orgPage - 2 + i;
                      if (pageNum >= orgTotalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => setOrgPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${orgPage === pageNum ? 'bg-emerald-600 text-white' : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'}`}>
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button onClick={() => setOrgPage(p => Math.min(orgTotalPages - 1, p + 1))} disabled={orgPage >= orgTotalPages - 1}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ================= PARTNERS TAB ================= */}
        {tab === 'partners' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Active Partners', value: activePartners.length, icon: Handshake, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Partner MRR', value: `$${totalPartnerMrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Lifetime Revenue', value: `$${totalPartnerRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                { label: 'Total Deals', value: totalPartnerDeals, icon: Briefcase, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
                { label: 'Avg. Commission', value: `${avgCommission.toFixed(1)}%`, icon: Award, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-gray-100 dark:border-zinc-800`}>
                  <div className="flex items-center gap-2 mb-2"><k.icon className={`w-4 h-4 ${k.color}`} /><span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{k.label}</span></div>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Tier Breakdown Bar */}
            {partners.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3">Partner Tier Distribution</p>
                <div className="flex rounded-full overflow-hidden h-3 bg-gray-100 dark:bg-zinc-800">
                  {(['platinum', 'gold', 'silver', 'bronze'] as PartnerTier[]).map(t => {
                    const count = partners.filter(p => p.tier === t).length;
                    const pct = (count / partners.length) * 100;
                    if (pct === 0) return null;
                    const colors: Record<string, string> = { platinum: 'bg-violet-500', gold: 'bg-amber-500', silver: 'bg-gray-400', bronze: 'bg-orange-500' };
                    return <div key={t} className={`${colors[t]} transition-all`} style={{ width: `${pct}%` }} title={`${tierConfig[t].label}: ${count} (${pct.toFixed(0)}%)`} />;
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  {(['platinum', 'gold', 'silver', 'bronze'] as PartnerTier[]).map(t => {
                    const count = partners.filter(p => p.tier === t).length;
                    if (count === 0) return null;
                    return <span key={t} className="text-[11px] text-gray-500 dark:text-gray-400">{tierConfig[t].icon} {tierConfig[t].label} ({count})</span>;
                  })}
                </div>
              </div>
            )}

            {/* Search + Filters + Add Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search partners..." value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <select value={partnerStatusFilter} onChange={e => setPartnerStatusFilter(e.target.value as any)} className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="all">All Statuses</option>
                {(Object.keys(partnerStatusConfig) as PartnerStatus[]).map(s => <option key={s} value={s}>{partnerStatusConfig[s].label}</option>)}
              </select>
              <select value={partnerTierFilter} onChange={e => setPartnerTierFilter(e.target.value as any)} className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="all">All Tiers</option>
                {(['platinum', 'gold', 'silver', 'bronze'] as PartnerTier[]).map(t => <option key={t} value={t}>{tierConfig[t].icon} {tierConfig[t].label}</option>)}
              </select>
              <button onClick={() => { resetPartnerForm(); setEditingPartner(null); setShowPartnerForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Partner
              </button>
            </div>

            {/* Partner Table */}
            <div className="card card-gradient overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">MRR</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Deals</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Contract</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-16 text-center"><Handshake className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3 opacity-30" /><p className="text-sm text-gray-400 dark:text-gray-500">{partners.length === 0 ? 'No partner companies yet' : 'No matches found'}</p></td></tr>
                    ) : filteredPartners.map(p => {
                      const tc = tierConfig[p.tier];
                      const sc = partnerStatusConfig[p.status];
                      const isExpanded = expandedPartnerId === p.id;
                      const contractDays = daysUntil(p.contractEnd);
                      return (
                        <React.Fragment key={p.id}>
                          <tr className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors cursor-pointer" onClick={() => setExpandedPartnerId(isExpanded ? null : p.id)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${tc.bg} flex items-center justify-center text-sm font-bold ${tc.color}`}>
                                  {p.shortCode ? p.shortCode.slice(0, 2).toUpperCase() : p.companyName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{p.companyName}</p>
                                  <p className="text-[11px] text-gray-400">{p.contactPerson}{p.contactEmail ? ` \u00B7 ${p.contactEmail}` : ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="text-xs text-gray-600 dark:text-gray-300">{partnerTypeLabels[p.partnerType]}</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${tc.bg} ${tc.color}`}>{tc.icon} {tc.label}</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.cls}`}>{sc.label}</span></td>
                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{p.commissionRate}%</td>
                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">${p.currentMrr.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.dealCount}</td>
                            <td className="px-4 py-3">
                              {p.contractEnd ? (
                                <span className={`text-xs ${contractDays !== null && contractDays <= 30 ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {contractDays !== null && contractDays <= 0 ? 'Expired' : contractDays !== null && contractDays <= 30 ? `${contractDays}d left` : formatDate(p.contractEnd)}
                                </span>
                              ) : <span className="text-xs text-gray-400">Open-ended</span>}
                            </td>
                            <td className="px-4 py-3"><button className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">{isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}</button></td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50/50 dark:bg-zinc-800/20">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                  {/* Contact & Company Info */}
                                  <div className="card card-gradient p-4">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company Details</p>
                                    <div className="space-y-2">
                                      {[
                                        { l: 'Partner ID', v: p.id.slice(0, 8) + '...' },
                                        { l: 'Short Code', v: p.shortCode || 'N/A' },
                                        { l: 'Industry', v: p.industry || 'N/A' },
                                        { l: 'Company Size', v: companySizeLabels[p.companySize] },
                                        { l: 'Website', v: p.website || 'N/A' },
                                        { l: 'Location', v: [p.city, p.state, p.country].filter(Boolean).join(', ') || 'N/A' },
                                        { l: 'Phone', v: p.contactPhone || 'N/A' },
                                      ].map(r => (
                                        <div key={r.l} className="flex items-center justify-between text-sm">
                                          <span className="text-gray-500 dark:text-gray-400">{r.l}</span>
                                          <span className="font-medium text-gray-700 dark:text-gray-300 text-right max-w-[60%] truncate">{r.v}</span>
                                        </div>
                                      ))}
                                      {p.tags && p.tags.length > 0 && (
                                        <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Tags</span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {p.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-medium">{tag}</span>)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Financial Summary */}
                                  <div className="card card-gradient p-4">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Financial Summary</p>
                                    <div className="space-y-2">
                                      {[
                                        { l: 'Commission Rate', v: `${p.commissionRate}%` },
                                        { l: 'Current MRR', v: `$${p.currentMrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                                        { l: 'Lifetime Revenue', v: `$${p.lifetimeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                                        { l: 'Closed Deals', v: p.dealCount.toString() },
                                        { l: 'Referred Orgs', v: p.referredOrgs.toString() },
                                        { l: 'Payment Terms', v: paymentTermLabels[p.paymentTerms] },
                                        { l: 'Assigned Manager', v: p.assignedManager || 'Unassigned' },
                                      ].map(r => (
                                        <div key={r.l} className="flex items-center justify-between text-sm">
                                          <span className="text-gray-500 dark:text-gray-400">{r.l}</span>
                                          <span className="font-medium text-gray-700 dark:text-gray-300">{r.v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Contract & Notes */}
                                  <div className="card card-gradient p-4">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Contract & Notes</p>
                                    <div className="space-y-2">
                                      {[
                                        { l: 'Contract Start', v: formatDate(p.contractStart) },
                                        { l: 'Contract End', v: p.contractEnd ? formatDate(p.contractEnd) : 'Open-ended' },
                                        { l: 'Onboarded', v: formatDate(p.onboardedAt) },
                                        { l: 'Created', v: formatDate(p.createdAt) },
                                        { l: 'Last Updated', v: formatDateTime(p.updatedAt) },
                                      ].map(r => (
                                        <div key={r.l} className="flex items-center justify-between text-sm">
                                          <span className="text-gray-500 dark:text-gray-400">{r.l}</span>
                                          <span className="font-medium text-gray-700 dark:text-gray-300">{r.v}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {p.internalNotes && (
                                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Internal Notes</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{p.internalNotes}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-2 mt-4">
                                      <button onClick={(e) => { e.stopPropagation(); openPartnerEdit(p); setShowPartnerForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Edit3 className="w-3 h-3" /> Edit</button>
                                      <button onClick={(e) => { e.stopPropagation(); deletePartner(p.id); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40"><Trash2 className="w-3 h-3" /> Remove</button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= COUPONS TAB ================= */}
        {tab === 'coupons' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search coupons..." value={couponSearch} onChange={e => setCouponSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <button onClick={() => { setCouponForm({ code: generateCode(), description: '', type: 'percentage', value: 10, maxRedemptions: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '' }); setShowCouponForm(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors"><Plus className="w-4 h-4" /> Create Coupon</button>
            </div>
            {showCouponForm && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-800 p-5">
                <div className="flex items-center justify-between mb-4"><h4 className="text-sm font-semibold text-gray-900 dark:text-white">New Coupon</h4><button onClick={() => setShowCouponForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-4 h-4 text-gray-500" /></button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Promo Code"><div className="flex gap-1"><input type="text" value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} /><button onClick={() => setCouponForm({ ...couponForm, code: generateCode() })} className="px-2 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-600 dark:text-gray-300 text-sm"><RefreshCw className="w-3.5 h-3.5" /></button></div></Field>
                  <Field label="Type"><select value={couponForm.type} onChange={e => setCouponForm({ ...couponForm, type: e.target.value as CouponType })} className={selectCls}><option value="percentage">Percentage Discount</option><option value="fixed_amount">Fixed Amount Off</option><option value="trial_extension">Trial Extension (days)</option></select></Field>
                  <Field label={`Value ${couponForm.type === 'percentage' ? '(%)' : couponForm.type === 'fixed_amount' ? '($)' : '(days)'}`}><input type="number" min={0} max={couponForm.type === 'percentage' ? 100 : 9999} value={couponForm.value} onChange={e => setCouponForm({ ...couponForm, value: parseFloat(e.target.value) || 0 })} className={inputCls} /></Field>
                  <Field label="Max Redemptions"><input type="number" min={0} value={couponForm.maxRedemptions} onChange={e => setCouponForm({ ...couponForm, maxRedemptions: parseInt(e.target.value) || 0 })} className={inputCls} /><p className="text-[10px] text-gray-400 mt-0.5">0 = unlimited</p></Field>
                  <div className="sm:col-span-2 lg:col-span-4"><Field label="Description"><input type="text" value={couponForm.description} onChange={e => setCouponForm({ ...couponForm, description: e.target.value })} className={inputCls} placeholder="e.g., 20% off Pro plan for new users" /></Field></div>
                  <Field label="Valid From"><input type="date" value={couponForm.validFrom} onChange={e => setCouponForm({ ...couponForm, validFrom: e.target.value })} className={inputCls} /></Field>
                  <Field label="Valid Until (optional)"><input type="date" value={couponForm.validUntil} onChange={e => setCouponForm({ ...couponForm, validUntil: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowCouponForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
                  <button disabled={!couponForm.code || couponSaving} onClick={createCoupon} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50">{couponSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{couponSaving ? 'Creating...' : 'Create Coupon'}</button>
                </div>
              </div>
            )}
            <div className="card card-gradient overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30"><tr>{['Code', 'Type', 'Value', 'Redemptions', 'Status', 'Valid Until', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredCoupons.map(coupon => {
                      const cr = redemptions.filter(r => r.couponId === coupon.id);
                      return (
                        <React.Fragment key={coupon.id}>
                          <tr className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-mono font-semibold text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg">{coupon.code}</span><button onClick={() => { navigator.clipboard.writeText(coupon.code); setCopiedCouponId(coupon.id); setTimeout(() => setCopiedCouponId(null), 2000); }} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="Copy">{copiedCouponId === coupon.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}</button></div>{coupon.description && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[250px]">{coupon.description}</p>}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 capitalize">{coupon.type.replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200">{coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'fixed_amount' ? `$${coupon.value}` : `${coupon.value} days`}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{coupon.currentRedemptions}{coupon.maxRedemptions > 0 ? ` / ${coupon.maxRedemptions}` : ' / unlimited'}</td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(coupon.status)}`}>{coupon.status}</span></td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{coupon.validUntil ? formatDate(coupon.validUntil) : 'Never'}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => setShowRedemptions(showRedemptions === coupon.id ? null : coupon.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="View redemptions">{showRedemptions === coupon.id ? <EyeOff className="w-3.5 h-3.5 text-gray-500" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}</button><button onClick={() => toggleCouponStatus(coupon)} className={`p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded ${coupon.status === 'active' ? 'text-orange-500' : 'text-green-500'}`} title={coupon.status === 'active' ? 'Disable' : 'Enable'}><Power className="w-3.5 h-3.5" /></button><button onClick={() => { if (confirm('Delete this coupon?')) deleteCoupon(coupon.id); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button></div></td>
                          </tr>
                          {showRedemptions === coupon.id && (
                            <tr><td colSpan={7} className="px-4 py-3 bg-gray-50/50 dark:bg-zinc-800/20">{cr.length === 0 ? <p className="text-xs text-gray-400 py-1">No redemptions yet</p> : <div className="space-y-1"><p className="text-[10px] uppercase font-medium text-gray-400 mb-1">Redemption History</p>{cr.map(r => <div key={r.id} className="flex items-center justify-between text-xs bg-white dark:bg-zinc-700 rounded-lg px-3 py-2 border border-gray-100 dark:border-zinc-600"><span className="text-gray-500 font-mono text-[11px]">{r.userId.slice(0, 8)}...</span><span className="text-gray-500">{formatDate(r.redeemedAt)}</span><span className="font-medium text-green-600 dark:text-green-400">{coupon.type === 'percentage' ? `${r.discountApplied}%` : `$${r.discountApplied}`} off</span></div>)}</div>}</td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredCoupons.length === 0 && <div className="text-center py-12 text-gray-400"><Tag className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No coupons found</p></div>}
            </div>
          </div>
        )}

        {/* ================= INVITE LINKS TAB ================= */}
        {tab === 'invites' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search invite links..." value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <button onClick={() => { setInviteForm({ label: '', targetEmail: '', couponId: '', planId: '', maxUses: 1, expiresAt: '' }); setShowInviteForm(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"><Plus className="w-4 h-4" /> Create Invite</button>
            </div>
            {showInviteForm && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5">
                <div className="flex items-center justify-between mb-4"><h4 className="text-sm font-semibold text-gray-900 dark:text-white">New Invite Link</h4><button onClick={() => setShowInviteForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-4 h-4 text-gray-500" /></button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 lg:col-span-3"><Field label="Label"><input type="text" value={inviteForm.label} onChange={e => setInviteForm({ ...inviteForm, label: e.target.value })} className={inputCls} placeholder="e.g., Enterprise onboarding - Acme Corp" /></Field></div>
                  <Field label="Target Email (optional)"><input type="email" value={inviteForm.targetEmail} onChange={e => setInviteForm({ ...inviteForm, targetEmail: e.target.value })} className={inputCls} placeholder="client@company.com" /><p className="text-[10px] text-gray-400 mt-0.5">Leave empty = anyone can use</p></Field>
                  <Field label="Subscription Plan"><select value={inviteForm.planId} onChange={e => setInviteForm({ ...inviteForm, planId: e.target.value })} className={selectCls}><option value="">Select a plan</option>{plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.displayName} - ${p.priceMonthly}/mo</option>)}</select></Field>
                  <Field label="Attach Coupon (optional)"><select value={inviteForm.couponId} onChange={e => setInviteForm({ ...inviteForm, couponId: e.target.value })} className={selectCls}><option value="">No coupon</option>{coupons.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.code} - {c.type === 'percentage' ? `${c.value}%` : c.type === 'fixed_amount' ? `$${c.value}` : `${c.value} days`}</option>)}</select></Field>
                  <Field label="Max Uses"><input type="number" min={0} value={inviteForm.maxUses} onChange={e => setInviteForm({ ...inviteForm, maxUses: parseInt(e.target.value) || 0 })} className={inputCls} /><p className="text-[10px] text-gray-400 mt-0.5">0 = unlimited</p></Field>
                  <Field label="Expires At (optional)"><input type="date" value={inviteForm.expiresAt} onChange={e => setInviteForm({ ...inviteForm, expiresAt: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
                  <button disabled={!inviteForm.label || inviteSaving} onClick={createInvite} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{inviteSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}{inviteSaving ? 'Creating...' : 'Create Invite'}</button>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
              {filteredInvites.length === 0 ? <div className="text-center py-12 text-gray-400"><Link2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No invite links found</p></div> : (
                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {filteredInvites.map(link => {
                    const ac = link.couponId ? coupons.find(c => c.id === link.couponId) : null;
                    const ap = link.planId ? plans.find(p => p.id === link.planId) : null;
                    const url = `${window.location.origin}${window.location.pathname}#/invite/${link.token}`;
                    return (
                      <div key={link.id} className="flex items-center justify-between p-4 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{link.label}</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(link.status)}`}>{link.status}</span></div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] text-gray-400 font-mono truncate max-w-[350px]">{url}</span>
                            {link.targetEmail && <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">To: {link.targetEmail}</span>}
                            {ap && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ap.name === 'premium' ? 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' : ap.name === 'pro' ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800'}`}>{ap.displayName}</span>}
                            {ac && <span className="text-[10px] text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 px-1.5 py-0.5 rounded font-mono">{ac.code}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1"><span className="text-[10px] text-gray-400">Uses: {link.currentUses}{link.maxUses > 0 ? ` / ${link.maxUses}` : ' / unlimited'}</span>{link.expiresAt && <span className="text-[10px] text-gray-400">Expires: {formatDate(link.expiresAt)}</span>}<span className="text-[10px] text-gray-400">Created: {formatDate(link.createdAt)}</span></div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button onClick={() => { navigator.clipboard.writeText(url); setCopiedLinkId(link.id); setTimeout(() => setCopiedLinkId(null), 2000); }} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg text-gray-500" title="Copy">{copiedLinkId === link.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                          <button onClick={() => toggleInviteStatus(link)} className={`p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg ${link.status === 'active' ? 'text-orange-500' : 'text-green-500'}`} title={link.status === 'active' ? 'Disable' : 'Enable'}><Power className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm('Delete this invite link?')) deleteInvite(link.id); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PLANS TAB ================= */}
        {tab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => {
              const subCount = orgs.filter(o => o.plan?.id === plan.id && o.subscription?.status !== 'cancelled' && o.subscription?.status !== 'expired').length;
              return (
                <div key={plan.id} className={`bg-white dark:bg-zinc-900 rounded-xl border-2 p-6 ${plan.name === 'premium' ? 'border-purple-300 dark:border-purple-700' : plan.name === 'pro' ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-zinc-700'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.displayName}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${plan.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span>
                      <button onClick={() => openPlanEdit(plan)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Edit plan"><Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
                    </div>
                  </div>
                  <div className="mb-4">
                    {plan.discountPercent > 0 ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-gray-900 dark:text-white">${(plan.priceMonthly * (1 - plan.discountPercent / 100)).toFixed(2)}</span>
                          <span className="text-sm text-gray-500">/mo</span>
                          <span className="text-sm text-gray-400 line-through">${plan.priceMonthly}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">${(plan.priceYearly * (1 - plan.discountPercent / 100)).toFixed(2)}/year <span className="line-through">${plan.priceYearly}</span></p>
                        <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{plan.discountPercent}% off{plan.discountNote ? ` \u00B7 ${plan.discountNote}` : ''}</span>
                      </div>
                    ) : (
                      <div><div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-gray-900 dark:text-white">${plan.priceMonthly}</span><span className="text-sm text-gray-500">/mo</span></div><p className="text-xs text-gray-400 mt-0.5">${plan.priceYearly}/year</p></div>
                    )}
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Subscribers</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{subCount}</span></div>
                    {[{ l: 'Max Assets', v: plan.maxAssets }, { l: 'Max Users', v: plan.maxUsers }, { l: 'Max Locations', v: plan.maxLocations }, { l: 'QR Batch', v: plan.qrBatchLimit }].map(r => (
                      <div key={r.l} className="flex items-center justify-between text-sm"><span className="text-gray-500">{r.l}</span><span className="font-medium text-gray-700 dark:text-gray-300">{r.v === -1 ? 'Unlimited' : r.v}</span></div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 dark:border-zinc-800 pt-3"><p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Features</p><div className="flex flex-wrap gap-1.5">{featureKeys.map(f => <span key={f.k} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(plan as any)[f.k] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through'}`}>{f.l}</span>)}</div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Partner Create/Edit Modal */}
      {showPartnerForm && (
        <ModalOverlay onClose={() => { setShowPartnerForm(false); setEditingPartner(null); resetPartnerForm(); }}>
          <div className="p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingPartner ? `Edit Partner: ${editingPartner.companyName}` : 'Add Partner Company'}</h3>
              <button onClick={() => { setShowPartnerForm(false); setEditingPartner(null); resetPartnerForm(); }} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              {/* Identity */}
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Company Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company Name *"><input type="text" value={partnerForm.companyName} onChange={e => setPartnerForm({ ...partnerForm, companyName: e.target.value })} className={inputCls} placeholder="Acme Corp" /></Field>
                <Field label="Short Code"><input type="text" value={partnerForm.shortCode} onChange={e => setPartnerForm({ ...partnerForm, shortCode: e.target.value.toUpperCase().slice(0, 6) })} className={inputCls} placeholder="ACME" maxLength={6} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website"><input type="text" value={partnerForm.website} onChange={e => setPartnerForm({ ...partnerForm, website: e.target.value })} className={inputCls} placeholder="https://acme.com" /></Field>
                <Field label="Industry"><input type="text" value={partnerForm.industry} onChange={e => setPartnerForm({ ...partnerForm, industry: e.target.value })} className={inputCls} placeholder="Technology" /></Field>
              </div>

              {/* Contact */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact Person *"><input type="text" value={partnerForm.contactPerson} onChange={e => setPartnerForm({ ...partnerForm, contactPerson: e.target.value })} className={inputCls} /></Field>
                  <Field label="Email *"><input type="email" value={partnerForm.contactEmail} onChange={e => setPartnerForm({ ...partnerForm, contactEmail: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Phone"><input type="text" value={partnerForm.contactPhone} onChange={e => setPartnerForm({ ...partnerForm, contactPhone: e.target.value })} className={inputCls} /></Field>
                  <Field label="Address"><input type="text" value={partnerForm.address} onChange={e => setPartnerForm({ ...partnerForm, address: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="City"><input type="text" value={partnerForm.city} onChange={e => setPartnerForm({ ...partnerForm, city: e.target.value })} className={inputCls} /></Field>
                  <Field label="State"><input type="text" value={partnerForm.state} onChange={e => setPartnerForm({ ...partnerForm, state: e.target.value })} className={inputCls} /></Field>
                  <Field label="Country"><input type="text" value={partnerForm.country} onChange={e => setPartnerForm({ ...partnerForm, country: e.target.value })} className={inputCls} /></Field>
                </div>
              </div>

              {/* Classification */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Classification</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Partner Type">
                    <select value={partnerForm.partnerType} onChange={e => setPartnerForm({ ...partnerForm, partnerType: e.target.value as PartnerType })} className={selectCls}>
                      {(Object.keys(partnerTypeLabels) as PartnerType[]).map(t => <option key={t} value={t}>{partnerTypeLabels[t]}</option>)}
                    </select>
                  </Field>
                  <Field label="Company Size">
                    <select value={partnerForm.companySize} onChange={e => setPartnerForm({ ...partnerForm, companySize: e.target.value as CompanySize })} className={selectCls}>
                      {(Object.keys(companySizeLabels) as CompanySize[]).map(s => <option key={s} value={s}>{companySizeLabels[s]}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Tier">
                    <select value={partnerForm.tier} onChange={e => setPartnerForm({ ...partnerForm, tier: e.target.value as PartnerTier })} className={selectCls}>
                      {(['bronze', 'silver', 'gold', 'platinum'] as PartnerTier[]).map(t => <option key={t} value={t}>{tierConfig[t].icon} {tierConfig[t].label}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={partnerForm.status} onChange={e => setPartnerForm({ ...partnerForm, status: e.target.value as PartnerStatus })} className={selectCls}>
                      {(Object.keys(partnerStatusConfig) as PartnerStatus[]).map(s => <option key={s} value={s}>{partnerStatusConfig[s].label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Financials */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Financials</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Current MRR ($)"><input type="number" min={0} step="0.01" value={partnerForm.currentMrr} onChange={e => setPartnerForm({ ...partnerForm, currentMrr: parseFloat(e.target.value) || 0 })} className={inputCls} /></Field>
                  <Field label="Lifetime Revenue ($)"><input type="number" min={0} step="0.01" value={partnerForm.lifetimeRevenue} onChange={e => setPartnerForm({ ...partnerForm, lifetimeRevenue: parseFloat(e.target.value) || 0 })} className={inputCls} /></Field>
                </div>
                {/* Commission toggle */}
                <div className="mt-3">
                  {!showCommission ? (
                    <button type="button" onClick={() => setShowCommission(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800">
                      <Plus className="w-3.5 h-3.5" /> Add Commission
                    </button>
                  ) : (
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Field label="Commission (%)">
                          <input type="number" min={0} max={100} step="0.5" value={partnerForm.commissionRate} onChange={e => setPartnerForm({ ...partnerForm, commissionRate: parseFloat(e.target.value) || 0 })} className={inputCls} />
                        </Field>
                      </div>
                      <button type="button" onClick={() => { setShowCommission(false); setPartnerForm({ ...partnerForm, commissionRate: 0 }); }}
                        className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors mb-0.5">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <Field label="Deal Count"><input type="number" min={0} value={partnerForm.dealCount} onChange={e => setPartnerForm({ ...partnerForm, dealCount: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
                  <Field label="Referred Orgs"><input type="number" min={0} value={partnerForm.referredOrgs} onChange={e => setPartnerForm({ ...partnerForm, referredOrgs: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
                  <Field label="Payment Terms">
                    <select value={partnerForm.paymentTerms} onChange={e => setPartnerForm({ ...partnerForm, paymentTerms: e.target.value as PaymentTerms })} className={selectCls}>
                      {(Object.keys(paymentTermLabels) as PaymentTerms[]).map(t => <option key={t} value={t}>{paymentTermLabels[t]}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Contract & Assignment */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Contract & Assignment</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Contract Start"><input type="date" value={partnerForm.contractStart} onChange={e => setPartnerForm({ ...partnerForm, contractStart: e.target.value })} className={inputCls} /></Field>
                  <Field label="Contract End"><input type="date" value={partnerForm.contractEnd} onChange={e => setPartnerForm({ ...partnerForm, contractEnd: e.target.value })} className={inputCls} /></Field>
                  <Field label="Assigned Manager"><input type="text" value={partnerForm.assignedManager} onChange={e => setPartnerForm({ ...partnerForm, assignedManager: e.target.value })} className={inputCls} placeholder="Account Manager" /></Field>
                </div>
              </div>

              {/* Tags */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Tags</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {partnerForm.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                      {tag}
                      <button type="button" onClick={() => setPartnerForm({ ...partnerForm, tags: partnerForm.tags.filter((_, idx) => idx !== i) })} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={partnerTagInput} onChange={e => setPartnerTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && partnerTagInput.trim()) { e.preventDefault(); setPartnerForm({ ...partnerForm, tags: [...partnerForm.tags, partnerTagInput.trim()] }); setPartnerTagInput(''); } }} className={inputCls} placeholder="Type a tag and press Enter" />
                  {partnerTagInput.trim() && <button type="button" onClick={() => { setPartnerForm({ ...partnerForm, tags: [...partnerForm.tags, partnerTagInput.trim()] }); setPartnerTagInput(''); }} className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-200">Add</button>}
                </div>
              </div>

              {/* Notes */}
              <Field label="Internal Notes">
                <textarea value={partnerForm.internalNotes} onChange={e => setPartnerForm({ ...partnerForm, internalNotes: e.target.value })} className={`${inputCls} min-h-[80px]`} placeholder="Internal-only notes about this partner..." />
              </Field>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowPartnerForm(false); setEditingPartner(null); resetPartnerForm(); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={savePartner} disabled={partnerSaving || !partnerForm.companyName.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {partnerSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <Save className="w-4 h-4" /> {editingPartner ? 'Update Partner' : 'Create Partner'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ================= USER MANAGEMENT TAB ================= */}
        {tab === 'users' && (() => {
          const filteredUsers = allUsers.filter(u => {
            if (userOrgFilter !== 'all' && u.organizationId !== userOrgFilter) return false;
            if (userSearch.trim()) {
              const term = userSearch.toLowerCase();
              return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.role.toLowerCase().includes(term);
            }
            return true;
          });
          const userTotalPages = Math.ceil(filteredUsers.length / userPageSize);
          const userPagedRows = filteredUsers.slice(userPage * userPageSize, (userPage + 1) * userPageSize);
          return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{allUsers.length} users across {orgs.length} organizations</p>
              </div>
              <button onClick={() => { setShowCreateUser('__pick__'); setUserCreateForm({ name: '', email: '', password: '', role: 'admin', phone: '', orgId: '' }); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Plus className="w-4 h-4" /> Create User
              </button>
            </div>

            {/* Role breakdown cards */}
            {allUsers.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {['admin', 'manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'].map(role => {
                  const count = allUsers.filter(u => u.role === role).length;
                  return (
                    <div key={role} className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-3 text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
                      <p className="text-[10px] font-medium text-gray-400 uppercase">{role}s</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search + Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name, email, or role..." value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(0); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <select value={userOrgFilter} onChange={e => { setUserOrgFilter(e.target.value); setUserPage(0); }}
                className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="all">All Organizations</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="card card-gradient overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Organization</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Active</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400 dark:text-gray-500">Loading users...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400 dark:text-gray-500">No users match your filters</td></tr>
                    ) : (
                      userPagedRows.map((u, idx) => (
                        <tr key={u.id} className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{String(userPage * userPageSize + idx + 1).padStart(3, '0')}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{u.name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : u.role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : u.role === 'technician' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
                            }`}>{u.role}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{orgs.find(o => o.id === u.organizationId)?.name || (u.isGlobalAdmin ? <span className="text-amber-600 font-medium">Platform Admin</span> : 'N/A')}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.phone || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => {
                                const newStatus = !u.isActive;
                                await supabase.from('users').update({ is_active: newStatus }).eq('id', u.id);
                                setAllUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: newStatus } : x));
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(u.createdAt)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
                                await supabase.from('users').delete().eq('id', u.id);
                                setAllUsers(prev => prev.filter(x => x.id !== u.id));
                              }}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer — pagination */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredUsers.length === 0
                      ? 'No users found'
                      : `Showing ${userPage * userPageSize + 1}–${Math.min((userPage + 1) * userPageSize, filteredUsers.length)} of ${filteredUsers.length} users${userOrgFilter !== 'all' ? ` in ${orgs.find(o => o.id === userOrgFilter)?.name || 'selected org'}` : ''}`}
                  </p>
                  <select
                    value={userPageSize}
                    onChange={e => { setUserPageSize(Number(e.target.value)); setUserPage(0); }}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {[10, 25, 50, 100, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
                  </select>
                </div>
                {userTotalPages > 1 && (
                  <div className="flex gap-1">
                    <button onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    {Array.from({ length: Math.min(userTotalPages, 5) }, (_, i) => {
                      const pageNum = userPage < 3 ? i : userPage - 2 + i;
                      if (pageNum >= userTotalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => setUserPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${userPage === pageNum ? 'bg-emerald-600 text-white' : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'}`}>
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button onClick={() => setUserPage(p => Math.min(userTotalPages - 1, p + 1))} disabled={userPage >= userTotalPages - 1}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ================= AUDIT LOGS TAB ================= */}
        {tab === 'audit_logs' && (() => {
          const uniqueModules = [...new Set(auditLogs.map(l => l.module).filter(Boolean))].sort();
          const filteredLogs = auditLogs.filter(l => {
            if (auditOrgFilter !== 'all' && l.organizationId !== auditOrgFilter) return false;
            if (auditSearch.trim()) {
              const term = auditSearch.toLowerCase();
              return (l.userName || '').toLowerCase().includes(term) || (l.action || '').toLowerCase().includes(term) || (l.module || '').toLowerCase().includes(term) || (l.details || '').toLowerCase().includes(term);
            }
            return true;
          });
          const logTotalPages = Math.ceil(filteredLogs.length / auditPageSize);
          const logPagedRows = filteredLogs.slice(auditPage * auditPageSize, (auditPage + 1) * auditPageSize);
          return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Platform-wide activity trail &middot; {auditLogs.length} entries loaded</p>
              </div>
              <button onClick={() => { setAuditLogs([]); loadAuditLogs(); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {/* Quick stats */}
            {auditLogs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Total Entries', value: auditLogs.length, icon: ScrollText, color: 'text-emerald-600' },
                  { label: 'Unique Users', value: new Set(auditLogs.map(l => l.userName)).size, icon: Users, color: 'text-blue-500' },
                  { label: 'Modules', value: uniqueModules.length, icon: Package, color: 'text-purple-500' },
                  { label: 'Organizations', value: new Set(auditLogs.filter(l => l.organizationId).map(l => l.organizationId)).size, icon: Building2, color: 'text-amber-500' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Module filter chips */}
            {uniqueModules.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAuditSearch('')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${!auditSearch ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>
                  All Modules
                </button>
                {uniqueModules.map(m => (
                  <button key={m} onClick={() => setAuditSearch(m || '')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${auditSearch === m ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>
                    {m} <span className="ml-1 text-xs opacity-60">({auditLogs.filter(l => l.module === m).length})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search + Org Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by user, action, module, or details..." value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(0); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <select value={auditOrgFilter} onChange={e => setAuditOrgFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="all">All Organizations</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="card card-gradient overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Module</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Details</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Organization</th>
                    </tr>
                  </thead>
                  <tbody key={`audit-page-${auditPage}-${auditPageSize}`} className="animate-fadeIn">
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">Loading audit logs...</td></tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">No logs match your filters</td></tr>
                    ) : (
                      logPagedRows.map((l, idx) => (
                        <tr key={l.id} className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{String(auditPage * auditPageSize + idx + 1).padStart(3, '0')}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(l.timestamp)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{l.userName || 'System'}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{l.action}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              l.module === 'Assets' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : l.module === 'Audits' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : l.module === 'allocations' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
                            }`}>{l.module || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[350px] truncate" title={l.details || ''}>{l.details || '-'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{orgs.find(o => o.id === l.organizationId)?.name || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {(logTotalPages > 1 || auditPageSize !== 10) && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Showing {auditPage * auditPageSize + 1}-{Math.min((auditPage + 1) * auditPageSize, filteredLogs.length)} of {filteredLogs.length}
                    </p>
                    <select value={auditPageSize} onChange={e => { setAuditPageSize(Number(e.target.value)); setAuditPage(0); }}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      {[10, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    {Array.from({ length: Math.min(logTotalPages, 5) }, (_, i) => {
                      const pageNum = auditPage < 3 ? i : auditPage - 2 + i;
                      if (pageNum >= logTotalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => setAuditPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${auditPage === pageNum ? 'bg-emerald-600 text-white' : 'border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5'}`}>
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button onClick={() => setAuditPage(p => Math.min(logTotalPages - 1, p + 1))} disabled={auditPage >= logTotalPages - 1}
                      className="p-2 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ================= REVENUE & BILLING TAB ================= */}
        {tab === 'revenue' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue & Billing</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial overview across {activeSubs.length} active subscriptions</p>
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'MRR', value: `$${mrr.toFixed(2)}`, icon: DollarSign, color: 'text-green-500' },
                { label: 'ARR', value: `$${(mrr * 12).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-500' },
                { label: 'Active Subs', value: activeSubs.length, icon: CheckCircle, color: 'text-blue-500' },
                { label: 'Avg / Org', value: `$${activeSubs.length > 0 ? (mrr / activeSubs.length).toFixed(2) : '0.00'}`, icon: Building2, color: 'text-purple-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Revenue by Plan + Billing/Status side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Revenue by Plan</h3>
                <div className="space-y-3">
                  {plans.filter(p => p.isActive).map(plan => {
                    const planOrgs = orgs.filter(o => o.plan?.id === plan.id && (o.subscription?.status === 'active' || o.subscription?.status === 'trialing'));
                    const planMrr = planOrgs.reduce((sum, o) => sum + (o.subscription?.billingCycle === 'yearly' ? plan.priceYearly / 12 : plan.priceMonthly), 0);
                    const pct = mrr > 0 ? (planMrr / mrr) * 100 : 0;
                    return (
                      <div key={plan.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{plan.displayName}</span>
                          <span className="text-xs text-gray-500">{planOrgs.length} subs &middot; ${planMrr.toFixed(2)}/mo</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> Billing Cycle</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Monthly', count: orgs.filter(o => o.subscription?.billingCycle === 'monthly').length, color: 'bg-blue-500' },
                    { label: 'Yearly', count: orgs.filter(o => o.subscription?.billingCycle === 'yearly').length, color: 'bg-emerald-500' },
                    { label: 'No Subscription', count: orgs.filter(o => !o.subscription).length, color: 'bg-gray-400' },
                  ].map(b => {
                    const pct = orgs.length > 0 ? (b.count / orgs.length) * 100 : 0;
                    return (
                      <div key={b.label}>
                        <div className="flex justify-between mb-1"><span className="text-gray-500">{b.label}</span><span className="font-medium text-gray-900 dark:text-white">{b.count} ({pct.toFixed(0)}%)</span></div>
                        <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${b.color} rounded-full`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-amber-500" /> Status Breakdown</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { status: 'active', label: 'Active', color: 'bg-emerald-500' },
                    { status: 'trialing', label: 'Trialing', color: 'bg-blue-500' },
                    { status: 'past_due', label: 'Past Due', color: 'bg-amber-500' },
                    { status: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
                    { status: 'expired', label: 'Expired', color: 'bg-gray-400' },
                  ].map(s => {
                    const count = orgs.filter(o => o.subscription?.status === s.status).length;
                    const pct = orgs.length > 0 ? (count / orgs.length) * 100 : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between mb-1"><span className="text-gray-500">{s.label}</span><span className="font-medium text-gray-900 dark:text-white">{count}</span></div>
                        <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Per-Org Revenue Table */}
            <div className="card card-gradient overflow-hidden relative">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Revenue by Organization</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-zinc-700/20 border-b border-gray-100/60 dark:border-zinc-700/30">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Organization</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Billing</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Monthly</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Annual</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.filter(o => o.subscription).sort((a, b) => {
                      const aPrice = a.plan ? (a.subscription?.billingCycle === 'yearly' ? a.plan.priceYearly / 12 : a.plan.priceMonthly) : 0;
                      const bPrice = b.plan ? (b.subscription?.billingCycle === 'yearly' ? b.plan.priceYearly / 12 : b.plan.priceMonthly) : 0;
                      return bPrice - aPrice;
                    }).map((org, idx) => {
                      const monthlyPrice = org.plan ? (org.subscription?.billingCycle === 'yearly' ? org.plan.priceYearly / 12 : org.plan.priceMonthly) : 0;
                      const isActive = org.subscription?.status === 'active' || org.subscription?.status === 'trialing';
                      return (
                        <tr key={org.id} className="border-b border-gray-100/60 dark:border-zinc-700/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-600/5 transition-colors">
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{String(idx + 1).padStart(3, '0')}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{org.name}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{org.plan?.displayName || 'N/A'}</span></td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize text-xs">{org.subscription?.billingCycle || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : org.subscription?.status === 'past_due' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>{org.subscription?.status || '-'}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">${monthlyPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">${(monthlyPrice * 12).toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{org.subscription?.expiresAt ? formatDate(org.subscription.expiresAt) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">{orgs.filter(o => o.subscription).length} subscriptions &middot; Total MRR: <span className="font-semibold text-gray-900 dark:text-white">${mrr.toFixed(2)}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* ================= PLATFORM SETTINGS TAB ================= */}
        {tab === 'platform_settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure global platform behavior and policies</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* General Configuration */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">General Configuration</h3>
                </div>
                <div className="space-y-4">
                  <Field label="Default Plan for New Organizations">
                    <select className={selectCls} disabled>
                      <option>Beginner (Free)</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">Coming soon. Requires database migration.</p>
                  </Field>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Email Notifications</p><p className="text-[11px] text-gray-400">Platform-wide email templates for all orgs</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Auto-Renew Default</p><p className="text-[11px] text-gray-400">Default auto-renew setting for new subscriptions</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">On</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Default Currency</p><p className="text-[11px] text-gray-400">Platform default for new organizations</p></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">USD ($)</span>
                  </div>
                </div>
              </div>

              {/* Security & Access */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Security & Access</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Maintenance Mode</p><p className="text-[11px] text-gray-400">Temporarily disable access for non-admins</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400 rounded-full">Off</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Public QR Scan Page</p><p className="text-[11px] text-gray-400">Allow unauthenticated QR code scanning</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Geolocation on Scan</p><p className="text-[11px] text-gray-400">Request GPS location when QR is scanned</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Enabled</span>
                  </div>
                  <Field label="Platform Announcement">
                    <textarea className={`${inputCls} min-h-[60px]`} placeholder="Display a banner message across all organizations..." disabled />
                    <p className="text-[10px] text-gray-400 mt-1">Coming soon. Requires database migration.</p>
                  </Field>
                </div>
              </div>

              {/* Branding */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Branding & White Label</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Platform Name</p><p className="text-[11px] text-gray-400">Displayed in header, emails, and scan pages</p></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Asset Tracker</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">App Version</p><p className="text-[11px] text-gray-400">Current deployed version</p></div>
                    <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">v{APP_VERSION}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-zinc-800">
                    <div><p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Custom Logo per Org</p><p className="text-[11px] text-gray-400">Organizations can upload their own logo</p></div>
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Supported</span>
                  </div>
                </div>
              </div>

              {/* Limits & Quotas */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Limits & Quotas</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {plans.filter(p => p.isActive).map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{p.displayName}</span>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>{p.maxUsers === -1 ? 'Unlimited' : p.maxUsers} users</span>
                        <span>{p.maxAssets === -1 ? 'Unlimited' : p.maxAssets} assets</span>
                        <span>${p.priceMonthly}/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SYSTEM HEALTH TAB ================= */}
        {tab === 'system_health' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Platform infrastructure overview and diagnostics</p>
            </div>

            {/* Status Banner */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">All Systems Operational</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Database, Auth, Storage, and API are running normally</p>
              </div>
            </div>

            {/* Record counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Organizations', value: orgs.length, icon: Building2, color: 'text-emerald-600' },
                { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-500' },
                { label: 'Total Assets', value: totalAssets, icon: Package, color: 'text-purple-500' },
                { label: 'Coupons', value: coupons.length, icon: Tag, color: 'text-amber-500' },
                { label: 'Partners', value: partners.length, icon: Handshake, color: 'text-indigo-500' },
                { label: 'Invite Links', value: inviteLinks.length, icon: Link2, color: 'text-cyan-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Users by Organization</h3>
                <div className="space-y-2 text-sm max-h-[250px] overflow-y-auto">
                  {[...orgs].sort((a, b) => b.userCount - a.userCount).map((o, i) => {
                    const pct = totalUsers > 0 ? (o.userCount / totalUsers) * 100 : 0;
                    return (
                      <div key={o.id}>
                        <div className="flex justify-between mb-0.5"><span className="text-gray-500 truncate flex items-center gap-1"><span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>{o.name}</span><span className="font-medium text-gray-900 dark:text-white">{o.userCount}</span></div>
                        <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-purple-500" /> Assets by Organization</h3>
                <div className="space-y-2 text-sm max-h-[250px] overflow-y-auto">
                  {[...orgs].sort((a, b) => b.assetCount - a.assetCount).map((o, i) => {
                    const pct = totalAssets > 0 ? (o.assetCount / totalAssets) * 100 : 0;
                    return (
                      <div key={o.id}>
                        <div className="flex justify-between mb-0.5"><span className="text-gray-500 truncate flex items-center gap-1"><span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>{o.name}</span><span className="font-medium text-gray-900 dark:text-white">{o.assetCount}</span></div>
                        <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Server className="w-4 h-4 text-gray-500" /> Platform Stack</h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: 'Version', value: `v${APP_VERSION}`, color: '' },
                    { label: 'Database', value: 'PostgreSQL (Supabase)', color: '' },
                    { label: 'Frontend', value: 'React 19 + TypeScript', color: '' },
                    { label: 'Styling', value: 'Tailwind CSS 4', color: '' },
                    { label: 'Build', value: 'Vite 7', color: '' },
                    { label: 'Auth', value: 'Custom (Supabase RLS)', color: '' },
                    { label: 'Storage', value: 'Supabase Storage', color: '' },
                    { label: 'Active Orgs', value: `${activeOrgs.length} / ${orgs.length}`, color: 'text-emerald-600' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between py-1 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                      <span className="text-gray-500">{r.label}</span>
                      <span className={`font-medium ${r.color || 'text-gray-900 dark:text-white'} ${r.label === 'Version' ? 'font-mono' : ''}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Health Matrix */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /> Subscription Health Matrix</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-zinc-800">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                      <th className="text-center py-2 text-xs font-semibold text-emerald-600 uppercase">Active</th>
                      <th className="text-center py-2 text-xs font-semibold text-blue-600 uppercase">Trialing</th>
                      <th className="text-center py-2 text-xs font-semibold text-amber-600 uppercase">Past Due</th>
                      <th className="text-center py-2 text-xs font-semibold text-red-600 uppercase">Cancelled</th>
                      <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.filter(p => p.isActive).map(p => {
                      const planOrgs = orgs.filter(o => o.plan?.id === p.id);
                      const active = planOrgs.filter(o => o.subscription?.status === 'active').length;
                      const trialing = planOrgs.filter(o => o.subscription?.status === 'trialing').length;
                      const pastDue = planOrgs.filter(o => o.subscription?.status === 'past_due').length;
                      const cancelled = planOrgs.filter(o => o.subscription?.status === 'cancelled').length;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 dark:border-zinc-800 last:border-0">
                          <td className="py-2 font-medium text-gray-700 dark:text-gray-300">{p.displayName}</td>
                          <td className="py-2 text-center">{active > 0 ? <span className="font-bold text-emerald-600">{active}</span> : <span className="text-gray-300">0</span>}</td>
                          <td className="py-2 text-center">{trialing > 0 ? <span className="font-bold text-blue-600">{trialing}</span> : <span className="text-gray-300">0</span>}</td>
                          <td className="py-2 text-center">{pastDue > 0 ? <span className="font-bold text-amber-600">{pastDue}</span> : <span className="text-gray-300">0</span>}</td>
                          <td className="py-2 text-center">{cancelled > 0 ? <span className="font-bold text-red-600">{cancelled}</span> : <span className="text-gray-300">0</span>}</td>
                          <td className="py-2 text-center font-semibold text-gray-900 dark:text-white">{planOrgs.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

          </div>

      {/* Org Edit Modal */}
      {editingOrg && (
        <ModalOverlay onClose={() => setEditingOrg(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Organization</h3><button onClick={() => setEditingOrg(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <Field label="Organization Name"><input type="text" value={orgEditForm.name} onChange={e => setOrgEditForm({ ...orgEditForm, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Short Name (slug)"><input type="text" value={orgEditForm.shortName} onChange={e => setOrgEditForm({ ...orgEditForm, shortName: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Email"><input type="email" value={orgEditForm.contactEmail} onChange={e => setOrgEditForm({ ...orgEditForm, contactEmail: e.target.value })} className={inputCls} /></Field>
                <Field label="Contact Phone"><input type="text" value={orgEditForm.contactPhone} onChange={e => setOrgEditForm({ ...orgEditForm, contactPhone: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Industry"><input type="text" value={orgEditForm.industry} onChange={e => setOrgEditForm({ ...orgEditForm, industry: e.target.value })} className={inputCls} placeholder="e.g., Technology, Healthcare" /></Field>
              <Field label="Status"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={orgEditForm.isActive} onChange={e => setOrgEditForm({ ...orgEditForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{orgEditForm.isActive ? 'Active' : 'Inactive'}</span></label></Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingOrg(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={saveOrg} disabled={orgSaving || !orgEditForm.name.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{orgSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}<Save className="w-4 h-4" /> Save Changes</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Convert Org to Partner Modal */}
      {convertOrgToPartner && (
        <ModalOverlay onClose={() => { setConvertOrgToPartner(null); setConvertConfirmText(''); }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Handshake className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Convert to Partner Company</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{convertOrgToPartner.name} ({convertOrgToPartner.shortName})</p>
                </div>
              </div>
              <button onClick={() => { setConvertOrgToPartner(null); setConvertConfirmText(''); }} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">This action will convert this organization into a partner company.</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">The organization will continue to operate normally. A new partner company record will be created with the organization's details.</p>
                </div>
              </div>
            </div>

            {/* Perks */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3">Partner Company Perks</p>
              <div className="space-y-2">
                {[
                  { icon: DollarSign, color: 'text-green-500', title: 'Revenue Tracking', desc: 'Track MRR, lifetime revenue, and deal count for this partner' },
                  { icon: TrendingUp, color: 'text-emerald-500', title: 'Commission Management', desc: 'Set up optional commission rates and payment terms' },
                  { icon: Award, color: 'text-amber-500', title: 'Tier & Classification', desc: 'Assign partner tier (Bronze → Platinum), type, and status tracking' },
                  { icon: Users, color: 'text-blue-500', title: 'Referral Tracking', desc: 'Track referred organizations and partnership performance' },
                  { icon: FileText, color: 'text-purple-500', title: 'Contract Management', desc: 'Manage contract dates, payment terms, and internal notes' },
                  { icon: Globe, color: 'text-cyan-500', title: 'Partner Profile', desc: 'Full company profile with contact info, address, and tags' },
                ].map((perk, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                    <perk.icon className={`w-4 h-4 ${perk.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{perk.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{perk.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation */}
            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Type <span className="font-bold text-gray-900 dark:text-white">"I understand"</span> to confirm the conversion:</p>
              <input
                type="text"
                value={convertConfirmText}
                onChange={e => setConvertConfirmText(e.target.value)}
                className={inputCls}
                placeholder="Type: I understand"
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setConvertOrgToPartner(null); setConvertConfirmText(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button
                onClick={handleConvertOrgToPartner}
                disabled={converting || convertConfirmText !== 'I understand'}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {converting && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <Handshake className="w-4 h-4" /> Convert to Partner
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Organization Modal */}
      {deleteOrgTarget && (
        <ModalOverlay onClose={() => { setDeleteOrgTarget(null); setDeleteConfirmText(''); setDeleteOrgError(null); }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Organization</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{deleteOrgTarget.name} ({deleteOrgTarget.shortName})</p>
                </div>
              </div>
              <button onClick={() => { setDeleteOrgTarget(null); setDeleteConfirmText(''); setDeleteOrgError(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Warning */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">This action is permanent and cannot be undone.</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">Deleting this organization will permanently remove all of its users, assets, allocations, maintenance, repairs, vendors, consumables, procurements, documents, audit logs, notifications, recoveries, asset requests, and subscription records.</p>
                </div>
              </div>
            </div>

            {/* Impact summary */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3">Records that will be deleted</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Users', value: deleteOrgTarget.userCount },
                  { label: 'Assets', value: deleteOrgTarget.assetCount },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{r.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Plus every related row (allocations, maintenance, repairs, etc.) via ON DELETE CASCADE.</p>
            </div>

            {/* Confirmation */}
            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Type the organization code <span className="font-bold text-gray-900 dark:text-white font-mono">{deleteOrgTarget.shortName}</span> to confirm deletion:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className={inputCls}
                placeholder={`Type: ${deleteOrgTarget.shortName}`}
                autoFocus
              />
              {deleteOrgError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{deleteOrgError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setDeleteOrgTarget(null); setDeleteConfirmText(''); setDeleteOrgError(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button
                onClick={handleDeleteOrg}
                disabled={deletingOrg || deleteConfirmText !== deleteOrgTarget.shortName}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingOrg && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <Trash2 className="w-4 h-4" /> Delete Organization
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <ModalOverlay onClose={() => setShowCreateOrg(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Organization</h3><button onClick={() => setShowCreateOrg(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              {/* Identity */}
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Organization Details</p>
              <Field label="Organization Name *"><input type="text" value={orgCreateForm.name} onChange={e => setOrgCreateForm({ ...orgCreateForm, name: e.target.value })} className={inputCls} placeholder="e.g., Acme Corporation" /></Field>
              <Field label="Short Name / Slug *"><input type="text" value={orgCreateForm.shortName} onChange={e => setOrgCreateForm({ ...orgCreateForm, shortName: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} placeholder="e.g., ACME" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Email"><input type="email" value={orgCreateForm.contactEmail} onChange={e => setOrgCreateForm({ ...orgCreateForm, contactEmail: e.target.value })} className={inputCls} placeholder="admin@example.com" /></Field>
                <Field label="Contact Phone"><input type="text" value={orgCreateForm.contactPhone} onChange={e => setOrgCreateForm({ ...orgCreateForm, contactPhone: e.target.value })} className={inputCls} placeholder="+1 234 567 8900" /></Field>
              </div>
              <Field label="Industry"><input type="text" value={orgCreateForm.industry} onChange={e => setOrgCreateForm({ ...orgCreateForm, industry: e.target.value })} className={inputCls} placeholder="e.g., Technology, Healthcare" /></Field>

              {/* Subscription Plan */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Subscription Package</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plan">
                    <select value={orgCreateForm.planId} onChange={e => setOrgCreateForm({ ...orgCreateForm, planId: e.target.value })} className={selectCls}>
                      <option value="">No plan (free tier)</option>
                      {plans.filter(p => p.isActive).map(p => (
                        <option key={p.id} value={p.id}>{p.displayName} | ${p.priceMonthly}/mo (${p.priceYearly}/yr)</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Billing Cycle">
                    <select value={orgCreateForm.billingCycle} onChange={e => setOrgCreateForm({ ...orgCreateForm, billingCycle: e.target.value })} className={selectCls} disabled={!orgCreateForm.planId}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                </div>
                {/* Plan summary */}
                {orgCreateForm.planId && (() => {
                  const selectedPlan = plans.find(p => p.id === orgCreateForm.planId);
                  if (!selectedPlan) return null;
                  return (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-800 dark:text-emerald-300">{selectedPlan.displayName}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          ${orgCreateForm.billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly}/{orgCreateForm.billingCycle === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <span>{selectedPlan.maxUsers === -1 ? 'Unlimited' : selectedPlan.maxUsers} users</span>
                        <span>{selectedPlan.maxAssets === -1 ? 'Unlimited' : selectedPlan.maxAssets} assets</span>
                        <span>{selectedPlan.maxLocations === -1 ? 'Unlimited' : selectedPlan.maxLocations} locations</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Page Access / Features */}
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Enabled Features</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setOrgCreateForm({ ...orgCreateForm, enabledPages: Object.fromEntries(Object.keys(orgCreateForm.enabledPages).map(k => [k, true])) })}
                      className="text-[10px] text-emerald-600 hover:underline">Select All</button>
                    <button type="button" onClick={() => setOrgCreateForm({ ...orgCreateForm, enabledPages: Object.fromEntries(Object.keys(orgCreateForm.enabledPages).map(k => [k, false])) })}
                      className="text-[10px] text-gray-400 hover:underline">Clear All</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'assets', label: 'Assets' },
                    { key: 'allocations', label: 'Allocations' },
                    { key: 'assetRequest', label: 'Asset Requests' },
                    { key: 'maintenance', label: 'Maintenance' },
                    { key: 'repairs', label: 'Repairs' },
                    { key: 'consumables', label: 'Consumables' },
                    { key: 'procurement', label: 'Procurement' },
                    { key: 'vendors', label: 'Vendors' },
                    { key: 'recovery', label: 'Recovery' },
                    { key: 'depreciation', label: 'Depreciation' },
                    { key: 'audits', label: 'Audits' },
                    { key: 'auditLogs', label: 'Activity Log' },
                    { key: 'reports', label: 'Reports' },
                    { key: 'documents', label: 'Documents' },
                  ].map(pg => (
                    <label key={pg.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      orgCreateForm.enabledPages[pg.key]
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}>
                      <input type="checkbox" checked={!!orgCreateForm.enabledPages[pg.key]}
                        onChange={e => setOrgCreateForm({ ...orgCreateForm, enabledPages: { ...orgCreateForm.enabledPages, [pg.key]: e.target.checked } })}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className={`text-xs font-medium ${orgCreateForm.enabledPages[pg.key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>{pg.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-zinc-700">
              <button onClick={() => setShowCreateOrg(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={createOrg} disabled={orgCreating || !orgCreateForm.name.trim() || !orgCreateForm.shortName.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {orgCreating && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <Plus className="w-4 h-4" /> Create Organization
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <ModalOverlay onClose={() => setShowCreateUser(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create User</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {showCreateUser === '__pick__' ? 'Select an organization below' : `For: ${orgs.find(o => o.id === showCreateUser)?.name || 'Organization'}`}
                </p>
              </div>
              <button onClick={() => setShowCreateUser(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              {showCreateUser === '__pick__' && (
                <Field label="Organization *">
                  <select value={userCreateForm.orgId} onChange={e => setUserCreateForm({ ...userCreateForm, orgId: e.target.value })} className={selectCls}>
                    <option value="">Select an organization</option>
                    {orgs.filter(o => o.isActive).map(o => <option key={o.id} value={o.id}>{o.name} ({o.shortName})</option>)}
                  </select>
                </Field>
              )}
              <Field label="Full Name *"><input type="text" value={userCreateForm.name} onChange={e => setUserCreateForm({ ...userCreateForm, name: e.target.value })} className={inputCls} placeholder="John Doe" /></Field>
              <Field label="Email *"><input type="email" value={userCreateForm.email} onChange={e => setUserCreateForm({ ...userCreateForm, email: e.target.value })} className={inputCls} placeholder="john@example.com" /></Field>
              <Field label="Password"><input type="text" value={userCreateForm.password} onChange={e => setUserCreateForm({ ...userCreateForm, password: e.target.value })} className={inputCls} placeholder="Leave empty for default: password" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <select value={userCreateForm.role} onChange={e => setUserCreateForm({ ...userCreateForm, role: e.target.value })} className={selectCls}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                    <option value="staff">Staff</option>
                    <option value="technician">Technician</option>
                    <option value="vendor">Vendor</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </Field>
                <Field label="Phone"><input type="text" value={userCreateForm.phone} onChange={e => setUserCreateForm({ ...userCreateForm, phone: e.target.value })} className={inputCls} placeholder="+1 234 567 8900" /></Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateUser(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={createUser} disabled={userCreating || !userCreateForm.name.trim() || !userCreateForm.email.trim() || (showCreateUser === '__pick__' && !userCreateForm.orgId)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {userCreating && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <User className="w-4 h-4" /> Create User
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Subscription Edit Modal */}
      {editingSub && (
        <ModalOverlay onClose={() => setEditingSub(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Manage Subscription: {editingSub.name}</h3><button onClick={() => setEditingSub(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <Field label="Subscription Plan"><select value={subEditForm.planId} onChange={e => setSubEditForm({ ...subEditForm, planId: e.target.value })} className={selectCls}><option value="">Select a plan</option>{plans.map(p => <option key={p.id} value={p.id}>{p.displayName} - ${p.priceMonthly}/mo (${p.priceYearly}/yr)</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status"><select value={subEditForm.status} onChange={e => setSubEditForm({ ...subEditForm, status: e.target.value })} className={selectCls}><option value="active">Active</option><option value="trialing">Trialing</option><option value="past_due">Past Due</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></Field>
                <Field label="Billing Cycle"><select value={subEditForm.billingCycle} onChange={e => setSubEditForm({ ...subEditForm, billingCycle: e.target.value })} className={selectCls}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Started At"><input type="date" value={subEditForm.startedAt} onChange={e => setSubEditForm({ ...subEditForm, startedAt: e.target.value })} className={inputCls} /></Field>
                <Field label="Expires At"><input type="date" value={subEditForm.expiresAt} onChange={e => setSubEditForm({ ...subEditForm, expiresAt: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Trial Ends At (optional)"><input type="date" value={subEditForm.trialEndsAt} onChange={e => setSubEditForm({ ...subEditForm, trialEndsAt: e.target.value })} className={inputCls} /></Field>
              <Field label="Auto-Renew"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={subEditForm.autoRenew} onChange={e => setSubEditForm({ ...subEditForm, autoRenew: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{subEditForm.autoRenew ? 'Enabled' : 'Disabled'}</span></label></Field>
            </div>
            <div className="flex items-center justify-between mt-6">
              {editingSub.subscription && editingSub.subscription.status !== 'cancelled' && (
                <button onClick={endSubscription} disabled={subSaving} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">End Subscription</button>
              )}
              <div className="flex-1" />
              <div className="flex gap-2">
                <button onClick={() => setEditingSub(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
                <button onClick={saveSub} disabled={subSaving || !subEditForm.planId} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{subSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}<Save className="w-4 h-4" /> Save</button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Plan Edit Modal */}
      {editingPlan && (
        <ModalOverlay onClose={() => setEditingPlan(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Plan: {editingPlan.displayName}</h3><button onClick={() => setEditingPlan(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="space-y-4">
              <Field label="Display Name"><input type="text" value={planEditForm.displayName} onChange={e => setPlanEditForm({ ...planEditForm, displayName: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly Price ($)"><input type="number" min={0} step="0.01" value={planEditForm.priceMonthly} onChange={e => setPlanEditForm({ ...planEditForm, priceMonthly: parseFloat(e.target.value) || 0 })} className={inputCls} /></Field>
                <Field label="Yearly Price ($)"><input type="number" min={0} step="0.01" value={planEditForm.priceYearly} onChange={e => setPlanEditForm({ ...planEditForm, priceYearly: parseFloat(e.target.value) || 0 })} className={inputCls} /></Field>
              </div>
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Discount</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Discount (%)"><input type="number" min={0} max={100} step="0.01" value={planEditForm.discountPercent} onChange={e => setPlanEditForm({ ...planEditForm, discountPercent: parseFloat(e.target.value) || 0 })} className={inputCls} />{planEditForm.discountPercent > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Monthly: ${(planEditForm.priceMonthly * (1 - planEditForm.discountPercent / 100)).toFixed(2)} | Yearly: ${(planEditForm.priceYearly * (1 - planEditForm.discountPercent / 100)).toFixed(2)}</p>}</Field>
                  <Field label="Discount Note"><input type="text" value={planEditForm.discountNote} onChange={e => setPlanEditForm({ ...planEditForm, discountNote: e.target.value })} className={inputCls} placeholder="e.g., Early adopter pricing" /></Field>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Assets (-1 = unlimited)"><input type="number" min={-1} value={planEditForm.maxAssets} onChange={e => setPlanEditForm({ ...planEditForm, maxAssets: parseInt(e.target.value) })} className={inputCls} /></Field>
                <Field label="Max Users (-1 = unlimited)"><input type="number" min={-1} value={planEditForm.maxUsers} onChange={e => setPlanEditForm({ ...planEditForm, maxUsers: parseInt(e.target.value) })} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Locations (-1 = unlimited)"><input type="number" min={-1} value={planEditForm.maxLocations} onChange={e => setPlanEditForm({ ...planEditForm, maxLocations: parseInt(e.target.value) })} className={inputCls} /></Field>
                <Field label="QR Batch Limit (-1 = unlimited)"><input type="number" min={-1} value={planEditForm.qrBatchLimit} onChange={e => setPlanEditForm({ ...planEditForm, qrBatchLimit: parseInt(e.target.value) })} className={inputCls} /></Field>
              </div>
              <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Feature Toggles</p>
                <div className="grid grid-cols-2 gap-2">
                  {featureKeys.map(f => (
                    <label key={f.k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!planEditForm[f.k]} onChange={e => setPlanEditForm({ ...planEditForm, [f.k]: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{f.l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Plan Active"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={planEditForm.isActive} onChange={e => setPlanEditForm({ ...planEditForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{planEditForm.isActive ? 'Active' : 'Inactive'}</span></label></Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={savePlan} disabled={planSaving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{planSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}<Save className="w-4 h-4" /> Save Plan</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <ModalOverlay onClose={() => setShowProfileEdit(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile</h3><button onClick={() => setShowProfileEdit(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100/60 dark:border-zinc-700/30">
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-2xl font-bold text-white">{profileForm.name?.charAt(0) || 'A'}</div>
              <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p><p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Super Admin</p></div>
            </div>
            <div className="space-y-4">
              <Field label="Full Name"><input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Email Address"><input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} className={inputCls} /></Field>
              <Field label="Phone"><input type="text" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowProfileEdit(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">Cancel</button>
              <button onClick={saveProfile} disabled={profileSaving || !profileForm.name.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{profileSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}<Save className="w-4 h-4" /> Save Profile</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <ModalOverlay onClose={() => setShowInfoModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-gray-900 dark:text-white">About Asset Tracker</h3><button onClick={() => setShowInfoModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100/60 dark:border-zinc-700/30">
              <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-16 h-16 rounded-xl object-contain" />
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">Asset Tracker</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Office Asset Tracking & Maintenance System</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Version', value: APP_VERSION },
                { label: 'Platform', value: 'SaaS (Multi-Tenant)' },
                { label: 'Database', value: 'PostgreSQL (Supabase)' },
                { label: 'Frontend', value: 'React 19 + TypeScript' },
                { label: 'Styling', value: 'Tailwind CSS' },
                { label: 'Organizations', value: `${orgs.length} registered` },
                { label: 'Active Subscriptions', value: `${activeSubs.length}` },
                { label: 'Total Platform Users', value: `${totalUsers}` },
                { label: 'Total Platform Assets', value: `${totalAssets}` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-zinc-800 last:border-0">
                  <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-700 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">&copy; {new Date().getFullYear()} 1XL Infra. All rights reserved.</p>
            </div>
          </div>
        </ModalOverlay>
      )}

      </div>{/* end scrollable + main content column */}
    </div>
  );
}
