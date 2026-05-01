import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader, ConfirmDialog } from '../components/ui';
import { SystemConfig } from '../types';
import { Save, RotateCcw, Database, Bell, Calculator, Shield, Image, Upload } from 'lucide-react';
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES } from '../utils/helpers';

export default function Settings() {
  const data = useData();
  const { organization, updateOrganization } = useAuth();

  // Use org currency as the canonical source — systemConfig.currency is global/shared and
  // is not per-org. All pages (Assets, Depreciation, etc.) read organization.currency.
  const [config, setConfig] = useState<SystemConfig>({
    ...data.systemConfig.get(),
    currency: organization?.currency || data.systemConfig.get().currency,
  });
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedCountry, setSelectedCountry] = useState(organization?.country || '');

  // Sync local states when AuthContext finishes resolving the organization
  useEffect(() => {
    if (organization?.name) setOrgName(organization.name);
    if (organization?.currency) setConfig(prev => ({ ...prev, currency: organization.currency }));
    if (organization?.country) setSelectedCountry(organization.country);
  }, [organization?.id, organization?.name, organization?.currency, organization?.country]);

  /** Persist a currency change to both DB and AuthContext immediately so all pages update. */
  const persistCurrency = async (currency: string) => {
    setConfig(prev => ({ ...prev, currency }));
    if (organization) {
      await supabase.from('organizations').update({ currency }).eq('id', organization.id);
      updateOrganization({ currency });
    }
  };

  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    const country = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      // Auto-set and persist currency when country changes
      await persistCurrency(country.currency);
    }
    // Persist country to organization in DB
    if (organization) {
      await supabase.from('organizations').update({ country: countryCode || null }).eq('id', organization.id);
      updateOrganization({ country: countryCode || undefined });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logos/${organization.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('organization-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('organization-assets').getPublicUrl(path);
      // Persist logo URL to database so it survives page refresh
      const { error: dbError } = await supabase.from('organizations').update({ logo_url: publicData.publicUrl }).eq('id', organization.id);
      if (dbError) throw dbError;
      updateOrganization({ logoUrl: publicData.publicUrl });
    } catch (err) {
      console.error('Logo upload failed:', err);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    await data.systemConfig.save(config);
    if (organization) {
      const orgUpdates: Record<string, string> = {};
      // Persist company name (system_config is global; org name is per-tenant)
      if (orgName.trim() && orgName.trim() !== organization.name) {
        orgUpdates.name = orgName.trim();
      }
      // Always persist currency to the organizations table — this is what every page reads
      if (config.currency && config.currency !== organization.currency) {
        orgUpdates.currency = config.currency;
      }
      if (Object.keys(orgUpdates).length > 0) {
        await supabase.from('organizations').update(orgUpdates).eq('id', organization.id);
        updateOrganization(orgUpdates as any);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = async () => {
    await data.refresh();
    setConfig(data.systemConfig.get());
    setShowReset(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="System Configuration" subtitle="Manage system-wide settings and preferences"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowReset(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
              <RotateCcw className="w-4 h-4" /> Reset All Data
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>
        }
      />

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">Settings saved successfully!</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branding */}
        <div className="card card-gradient p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Branding</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization Logo</label>
              <div className="flex items-center gap-4">
                {organization?.logoUrl ? (
                  <img src={organization.logoUrl} alt="Org Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-200 dark:border-zinc-600" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-zinc-700 flex items-center justify-center border border-gray-200 dark:border-zinc-600">
                    <Image className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
                    <Upload className="w-4 h-4" /> {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Recommended: 256x256px, PNG or JPG</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
              <p className="text-sm text-gray-600 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border border-gray-200 dark:border-zinc-600">Asset Tracker</p>
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="card card-gradient p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">General Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
              <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Your company name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country / Location</label>
              <select value={selectedCountry} onChange={e => handleCountryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                <option value="">Select a country</option>
                {SUPPORTED_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag}  {c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sets the default currency automatically.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <select value={config.currency} onChange={e => persistCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Applied across all pages instantly.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Format</label>
              <select value={config.dateFormat} onChange={e => setConfig({...config, dateFormat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card card-gradient p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-orange-600" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Notification Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Maintenance Reminder (days before due)</label>
              <input type="number" min={1} max={30} value={config.maintenanceReminderDays}
                onChange={e => setConfig({...config, maintenanceReminderDays: parseInt(e.target.value) || 7})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Warranty Alert (days before expiry)</label>
              <input type="number" min={1} max={90} value={config.warrantyAlertDays}
                onChange={e => setConfig({...config, warrantyAlertDays: parseInt(e.target.value) || 30})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white" />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.stockAlertEnabled}
                  onChange={e => setConfig({...config, stockAlertEnabled: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Low Stock Alerts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Depreciation Settings */}
        <div className="card card-gradient p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Depreciation Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Depreciation Method</label>
              <select value={config.depreciationMethod}
                onChange={e => setConfig({...config, depreciationMethod: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.depreciationMethod === 'straight_line'
                ? 'Straight Line: Equal depreciation each year over the useful life of the asset.'
                : 'Declining Balance: Higher depreciation in early years, declining over time.'}
            </p>
          </div>
        </div>

        {/* Backup Settings */}
        <div className="card card-gradient p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Backup & Data</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.autoBackupEnabled}
                  onChange={e => setConfig({...config, autoBackupEnabled: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Auto Backup</span>
              </label>
            </div>
            {config.autoBackupEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Frequency</label>
                <select value={config.backupFrequency}
                  onChange={e => setConfig({...config, backupFrequency: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
            <div className="pt-2">
              <button onClick={() => {
                const backupData = JSON.stringify(localStorage, null, 2);
                const blob = new Blob([backupData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="w-full px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                Export Backup (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-6 card card-gradient p-6">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">System Information</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Version</p><p className="text-sm font-medium">2.12</p></div>
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Total Users</p><p className="text-sm font-medium">{data.users.getAll().length}</p></div>
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Total Assets</p><p className="text-sm font-medium">{data.assets.getAll().length}</p></div>
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Data Storage</p><p className="text-sm font-medium">PostgreSQL</p></div>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-center text-xs text-gray-400 dark:text-zinc-500 mt-8">&copy; {new Date().getFullYear()} 1XL Ventures. All rights reserved.</p>

      <ConfirmDialog isOpen={showReset} onClose={() => setShowReset(false)} onConfirm={handleReset}
        title="Reset All Data" message="This will reset all data back to the demo defaults. All changes you've made will be lost. This cannot be undone." />
    </div>
  );
}
