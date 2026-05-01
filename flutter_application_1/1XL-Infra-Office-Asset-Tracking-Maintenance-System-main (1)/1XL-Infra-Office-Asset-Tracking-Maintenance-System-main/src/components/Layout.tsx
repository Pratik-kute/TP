import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useOrgSlug } from '../hooks/useOrgSlug';
import { usePageAccess } from '../hooks/usePageAccess';
import {
  LayoutDashboard, Package, Users, ArrowLeftRight, Wrench, Truck, ShoppingCart,
  TrendingDown, ScrollText, Bell, BarChart3, FileText, Building2, Settings,
  LogOut, Menu, ChevronLeft, ChevronRight, BoxesIcon, Search, X, Sun, Moon,
  ClipboardCheck, Crown, Zap, Shield, ClipboardList, ShieldAlert, Skull,
  User as UserIcon, Key
} from 'lucide-react';

interface NavItem { segment: string; label: string; icon: any; roles: string[]; }
interface NavGroup { label: string; items: NavItem[]; }

const navGroups: NavGroup[] = [
  { label: '', items: [
    { segment: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee', 'technician', 'vendor', 'auditor'] },
  ]},
  { label: 'Asset Management', items: [
    { segment: 'assets', label: 'Assets', icon: Package, roles: ['admin', 'manager', 'employee', 'staff', 'auditor'] },
    { segment: 'dead-assets', label: 'Dead Assets', icon: Skull, roles: ['admin', 'manager', 'auditor'] },
    { segment: 'allocations', label: 'Allocations', icon: ArrowLeftRight, roles: ['admin', 'manager', 'employee', 'staff'] },
    { segment: 'consumables', label: 'Consumables', icon: BoxesIcon, roles: ['admin', 'manager', 'employee', 'staff'] },
    { segment: 'asset-request', label: 'Asset Requests', icon: ClipboardList, roles: ['admin', 'manager', 'employee', 'staff', 'technician', 'vendor', 'auditor'] },
  ]},
  { label: 'Operations', items: [
    { segment: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['admin', 'manager', 'technician'] },
    { segment: 'repairs', label: 'Repairs', icon: Truck, roles: ['admin', 'manager', 'technician', 'vendor'] },
    { segment: 'recovery', label: 'Recovery', icon: ShieldAlert, roles: ['admin', 'manager', 'technician'] },
    { segment: 'procurement', label: 'Procurement', icon: ShoppingCart, roles: ['admin', 'manager'] },
    { segment: 'vendors', label: 'Vendors', icon: Building2, roles: ['admin', 'manager'] },
  ]},
  { label: 'Reporting', items: [
    { segment: 'depreciation', label: 'Depreciation', icon: TrendingDown, roles: ['admin', 'auditor'] },
    { segment: 'audits', label: 'Audits', icon: ClipboardCheck, roles: ['admin', 'manager', 'auditor'] },
    { segment: 'audit-logs', label: 'Activity Log', icon: ScrollText, roles: ['admin', 'auditor'] },
    { segment: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager', 'auditor'] },
    { segment: 'documents', label: 'Documents', icon: FileText, roles: ['admin', 'manager'] },
  ]},
  { label: 'Administration', items: [
    { segment: 'access-control', label: 'Access Control', icon: Shield, roles: ['admin', 'manager'] },
    { segment: 'locations', label: 'Locations & Depts', icon: Building2, roles: ['admin'] },
    { segment: 'users', label: 'User Management', icon: Users, roles: ['admin'] },
    { segment: 'api-keys', label: 'API Keys', icon: Key, roles: ['admin'] },
    { segment: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ]},
];

// Flat list for usePageAccess compatibility
const navItems = navGroups.flatMap(g => g.items);

export default function Layout() {
  const { user, logout, organization, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const orgSlug = useOrgSlug();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const data = useData();
  const { isDark, toggleTheme } = useTheme();
  const { plan, tierName } = useSubscription();
  // Show the signed-in user's organization name. Fall back to the global
  // system_config.companyName only if no org is loaded — that field is shared
  // across tenants and would otherwise leak another company's name into the UI.
  const displayOrgName = organization?.name || data.systemConfig.get()?.companyName || '';
  const notifications = data.notifications.getAll().filter(n => n.userId === user?.id && !n.isRead);
  const { canAccess } = usePageAccess();
  const filteredNav = navItems.filter(item => user && canAccess(item.segment));
  const navRef = useRef<HTMLElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);


  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center justify-center ${collapsed ? 'h-[68px] px-0' : 'px-5 py-5'}`}>
        <div className={`flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-3.5'}`}>
          {organization?.logoUrl ? (
            <img src={organization.logoUrl} alt="Logo" className={`rounded-xl flex-shrink-0 object-contain ${collapsed ? 'w-9 h-9' : 'w-14 h-14'}`} />
          ) : (
            <div className={`rounded-xl flex-shrink-0 bg-emerald-500/20 flex items-center justify-center ${collapsed ? 'w-9 h-9' : 'w-14 h-14'}`}>
              <Package className={`text-emerald-400 ${collapsed ? 'w-5 h-5' : 'w-8 h-8'}`} />
            </div>
          )}
          {!collapsed && (
            <div>
              <div className="text-lg font-bold tracking-tight whitespace-nowrap text-white leading-tight">Asset Tracker</div>
            </div>
          )}
        </div>
      </div>

      {/* Organization Display */}
      {organization && (
        <div className="px-3 py-2.5">
          <div className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-200 truncate">{displayOrgName}</p>
                <p className="text-[10px] text-zinc-500 truncate">{tierName || 'Free'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 py-3 px-3 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter(item => canAccess(item.segment));
          if (visibleItems.length === 0) return null;
          return (
            <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
              {group.label && !collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group.label}</p>
              )}
              {collapsed && gi > 0 && <div className="border-t border-white/5 my-2 mx-2" />}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const fullPath = `/${orgSlug}/${item.segment}`;
                  const isActive = location.pathname.startsWith(fullPath);
                  return (
                    <NavLink
                      key={item.segment}
                      to={fullPath}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_12px_rgba(16,185,129,0.08)]'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {item.segment === 'notifications' && notifications.length > 0 && (
                        <span className={`${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center`}>
                          {notifications.length}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User info + collapse */}
      <div className={`mt-auto ${collapsed ? 'p-2' : 'p-3'}`}>
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {user && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden" title={user.name}>
                {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
              title="Expand"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:bg-white/5 hover:text-red-400 transition-colors w-full"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-2 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors flex-shrink-0"
              title="Collapse"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-zinc-900 to-zinc-950 text-white flex-col transition-all duration-300 h-full`}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white flex flex-col animate-slideIn">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header — glass effect */}
        <header className="h-[68px] glass bg-white/80 dark:bg-zinc-900/80 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets, users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-soft pl-10 pr-4 py-2.5 w-64 lg:w-80 bg-white dark:bg-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Org badge in header */}
            {organization && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/8 dark:bg-emerald-500/10 rounded-xl">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{displayOrgName}</span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => navigate(`/${orgSlug}/notifications`)}
              className="relative p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            {user && (
              <div className="relative flex items-center gap-3 pl-3 border-l border-gray-200/50 dark:border-zinc-700/50">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-emerald-500/20 overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-400/50 transition-all"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0)
                  )}
                </button>

                {/* Profile Menu Dropdown */}
                {showProfileMenu && (
                  <div ref={profileMenuRef} className="absolute right-0 top-12 w-56 card p-1.5 shadow-xl z-50 animate-fadeIn" style={{ boxShadow: 'var(--shadow-float)' }}>
                    <div className="px-3 py-2.5 border-b border-gray-100 dark:border-zinc-700/50 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate(`/${orgSlug}/profile`);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" /> My Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate(`/${orgSlug}/settings`);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400" /> Settings
                    </button>
                    <div className="border-t border-gray-100 dark:border-zinc-700/50 my-1" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5 lg:p-8">
          <div className="animate-fadeIn">
            <Outlet />
          </div>
        </main>

        {/* Footer bar — glass effect */}
        <footer className="h-9 glass bg-white/70 dark:bg-zinc-900/70 flex items-center justify-between px-4 lg:px-8 flex-shrink-0" style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.03)' }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {tierName === 'premium' ? (
                <Crown className="w-3.5 h-3.5 text-purple-500" />
              ) : tierName === 'pro' ? (
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 dark:border-gray-500" />
              )}
              <span className={`text-xs font-semibold ${
                tierName === 'premium'
                  ? 'text-purple-600 dark:text-purple-400'
                  : tierName === 'pro'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {plan?.displayName || 'Beginner'} Plan
              </span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">&copy; {new Date().getFullYear()} 1XL Ventures. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
