import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { usePageAccess } from './hooks/usePageAccess';
import OrgSlugResolver from './components/OrgSlugResolver';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Landing from './pages/Landing';
import SelectPlan from './pages/SelectPlan';
import CreateOrg from './pages/CreateOrg';
import SignupSuccess from './pages/SignupSuccess';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Allocations from './pages/Allocations';
import Maintenance from './pages/Maintenance';
import Repairs from './pages/Repairs';
import Consumables from './pages/Consumables';
import Procurement from './pages/Procurement';
import Vendors from './pages/Vendors';
import Depreciation from './pages/Depreciation';
import AuditLogs from './pages/AuditLogs';
import Audits from './pages/Audits';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Documents from './pages/Documents';
import Locations from './pages/Locations';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AccessControl from './pages/AccessControl';
import AssetRequest from './pages/AssetRequest';
import RecoveryPage from './pages/Recovery';
import DeadAssets from './pages/DeadAssets';
import Profile from './pages/Profile';
import PublicAssetEdit from './pages/PublicAssetEdit';
import PublicAssetScan from './pages/PublicAssetScan';
import ApiKeys from './pages/ApiKeys';


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Blocks super admin from accessing org-level routes */
function OrgProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isGlobalAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isGlobalAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

/** Spinner shown while the signed-in user's organization is still being resolved. */
function OrgLoading() {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="w-10 h-10 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

/** Route guard that checks page access via the configurable permission system */
function AccessControlledRoute({ segment, children }: { segment: string; children: React.ReactNode }) {
  const { organization } = useAuth();
  const { canAccess } = usePageAccess();
  if (!canAccess(segment)) {
    if (!organization?.shortName) return <OrgLoading />;
    return <Navigate to={`/${organization.shortName}/dashboard`} replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isGlobalAdmin, organization } = useAuth();
  if (isAuthenticated) {
    if (isGlobalAdmin) return <Navigate to="/admin" replace />;
    if (!organization?.shortName) return <OrgLoading />;
    return <Navigate to={`/${organization.shortName}/dashboard`} replace />;
  }
  return <>{children}</>;
}

/** Root "/" — show the public Landing page for visitors, redirect authenticated users. */
function RootRoute() {
  const { isAuthenticated, isGlobalAdmin, organization } = useAuth();
  if (!isAuthenticated) return <Landing />;
  if (isGlobalAdmin) return <Navigate to="/admin" replace />;
  if (!organization?.shortName) return <OrgLoading />;
  return <Navigate to={`/${organization.shortName}/dashboard`} replace />;
}

/** Fallback for unknown routes — send to landing (unauth) or dashboard (auth). */
function NotFoundRedirect() {
  const { isAuthenticated, isGlobalAdmin, organization } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isGlobalAdmin) return <Navigate to="/admin" replace />;
  if (!organization?.shortName) return <OrgLoading />;
  return <Navigate to={`/${organization.shortName}/dashboard`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/signup" element={<PublicRoute><SelectPlan /></PublicRoute>} />
            <Route path="/signup/create" element={<PublicRoute><CreateOrg /></PublicRoute>} />
            <Route path="/signup/success" element={<PublicRoute><SignupSuccess /></PublicRoute>} />

            {/* Super Admin platform console */}
            <Route path="/admin" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/:adminTab" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />

            {/* Legacy redirect */}
            <Route path="/select-org" element={<Navigate to="/admin" replace />} />

            {/* Public QR-accessible pages */}
            <Route path="/:orgSlug/asset/:assetId" element={<PublicAssetEdit />} />
            <Route path="/:orgSlug/scan/:assetId" element={<PublicAssetScan />} />

            {/* Protected org-scoped routes */}
            <Route path="/:orgSlug" element={<OrgProtectedRoute><OrgSlugResolver /></OrgProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              {/* Always accessible */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
              {/* Access-controlled pages */}
              <Route path="assets" element={<AccessControlledRoute segment="assets"><Assets /></AccessControlledRoute>} />
              <Route path="dead-assets" element={<AccessControlledRoute segment="dead-assets"><DeadAssets /></AccessControlledRoute>} />
              <Route path="allocations" element={<AccessControlledRoute segment="allocations"><Allocations /></AccessControlledRoute>} />
              <Route path="maintenance" element={<AccessControlledRoute segment="maintenance"><Maintenance /></AccessControlledRoute>} />
              <Route path="repairs" element={<AccessControlledRoute segment="repairs"><Repairs /></AccessControlledRoute>} />
              <Route path="consumables" element={<AccessControlledRoute segment="consumables"><Consumables /></AccessControlledRoute>} />
              <Route path="procurement" element={<AccessControlledRoute segment="procurement"><Procurement /></AccessControlledRoute>} />
              <Route path="asset-request" element={<AccessControlledRoute segment="asset-request"><AssetRequest /></AccessControlledRoute>} />
              <Route path="recovery" element={<AccessControlledRoute segment="recovery"><RecoveryPage /></AccessControlledRoute>} />
              <Route path="vendors" element={<AccessControlledRoute segment="vendors"><Vendors /></AccessControlledRoute>} />
              <Route path="depreciation" element={<AccessControlledRoute segment="depreciation"><Depreciation /></AccessControlledRoute>} />
              <Route path="audit-logs" element={<AccessControlledRoute segment="audit-logs"><AuditLogs /></AccessControlledRoute>} />
              <Route path="audits" element={<AccessControlledRoute segment="audits"><Audits /></AccessControlledRoute>} />
              <Route path="reports" element={<AccessControlledRoute segment="reports"><Reports /></AccessControlledRoute>} />
              <Route path="documents" element={<AccessControlledRoute segment="documents"><Documents /></AccessControlledRoute>} />
              <Route path="access-control" element={<AccessControlledRoute segment="access-control"><AccessControl /></AccessControlledRoute>} />
              {/* Admin-only (hardcoded, not configurable) */}
              <Route path="locations" element={<AccessControlledRoute segment="locations"><Locations /></AccessControlledRoute>} />
              <Route path="users" element={<AccessControlledRoute segment="users"><Users /></AccessControlledRoute>} />
              <Route path="settings" element={<AccessControlledRoute segment="settings"><Settings /></AccessControlledRoute>} />
              <Route path="api-keys" element={<AccessControlledRoute segment="api-keys"><ApiKeys /></AccessControlledRoute>} />
            </Route>

            {/* Root — Landing page for visitors, dashboard redirect for authed users */}
            <Route path="/" element={<RootRoute />} />
            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
