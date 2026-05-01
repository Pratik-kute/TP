import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { objectToCamel, objectToSnake, arrayToCamel } from '../lib/caseMapper';
import { Asset, Location, Department, AssetStatus, AuditFieldChange } from '../types';
import { Package, MapPin, Building2, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export default function PublicAssetEdit() {
  const { orgSlug, assetId } = useParams<{ orgSlug: string; assetId: string }>();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Editable form fields
  const [status, setStatus] = useState<AssetStatus>('available');
  const [locationId, setLocationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!assetId) { setNotFound(true); setLoading(false); return; }

      const { data: assetData, error: assetErr } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (assetErr || !assetData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const a = objectToCamel<Asset>(assetData);
      setAsset(a);
      setStatus(a.status);
      setLocationId(a.locationId || '');
      setDepartmentId(a.departmentId || '');
      setDescription(a.description || '');

      // Fetch locations and departments for the asset's organization
      const [locsRes, deptsRes] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', a.organizationId),
        supabase.from('departments').select('*').eq('organization_id', a.organizationId),
      ]);

      if (locsRes.data) setLocations(arrayToCamel<Location>(locsRes.data));
      if (deptsRes.data) setDepartments(arrayToCamel<Department>(deptsRes.data));

      setLoading(false);
    }
    fetchData();
  }, [assetId]);

  async function handleSave() {
    if (!asset) return;
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const now = new Date().toISOString();

      // Compute changes for audit
      const changes: AuditFieldChange[] = [];

      if (asset.status !== status) {
        changes.push({ field: 'status', fieldLabel: 'Status', oldValue: asset.status, newValue: status });
      }
      if (asset.locationId !== locationId) {
        const oldLoc = locations.find(l => l.id === asset.locationId)?.name || asset.locationId || 'None';
        const newLoc = locations.find(l => l.id === locationId)?.name || locationId || 'None';
        changes.push({ field: 'locationId', fieldLabel: 'Location', oldValue: oldLoc, newValue: newLoc });
      }
      if (asset.departmentId !== departmentId) {
        const oldDept = departments.find(d => d.id === asset.departmentId)?.name || asset.departmentId || 'None';
        const newDept = departments.find(d => d.id === departmentId)?.name || departmentId || 'None';
        changes.push({ field: 'departmentId', fieldLabel: 'Department', oldValue: oldDept, newValue: newDept });
      }
      if ((asset.description || '') !== description) {
        changes.push({
          field: 'description', fieldLabel: 'Description',
          oldValue: asset.description || 'empty',
          newValue: description || 'empty',
        });
      }

      if (changes.length === 0) {
        setError('No changes detected.');
        setSaving(false);
        return;
      }

      // Update asset
      const updatePayload = objectToSnake({
        status,
        locationId,
        departmentId,
        description,
        updatedAt: now,
      });
      const { error: updateErr } = await supabase.from('assets').update(updatePayload).eq('id', asset.id);
      if (updateErr) throw updateErr;

      // Create audit log entry
      const auditPayload = objectToSnake({
        userId: 'public',
        userName: 'QR Edit',
        action: 'Updated',
        module: 'Assets',
        entityId: asset.id,
        entityType: 'Asset',
        details: `QR edit: ${changes.map(c => c.fieldLabel).join(', ')} on "${asset.name}" (${asset.assetTag})`,
        changes: changes,
        timestamp: now,
        organizationId: asset.organizationId,
      });
      await supabase.from('audit_logs').insert(auditPayload);

      // Update local asset state
      setAsset(prev => prev ? { ...prev, status, locationId, departmentId, description, updatedAt: now } : null);
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  // ---- RENDER ----

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading asset...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Asset Not Found</h1>
          <p className="text-zinc-400">The asset you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-12 h-12 rounded-xl object-contain" />
            <span className="text-xl font-bold text-white">Asset Tracker</span>
          </div>
          <p className="text-sm text-zinc-500">Quick Edit via QR Code</p>
        </div>

        {/* Asset Info Card (read-only) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{asset?.name}</h2>
              <p className="text-xs text-zinc-500 font-mono">{asset?.assetTag}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">Category</span>
              <p className="text-zinc-300">{asset?.category || '-'}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Brand / Model</span>
              <p className="text-zinc-300">{asset?.brand || '-'} {asset?.model || ''}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Serial Number</span>
              <p className="text-zinc-300 font-mono text-xs">{asset?.serialNumber || '-'}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Type</span>
              <p className="text-zinc-300">{asset?.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '-'}</p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-400 font-medium">Changes saved successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Editable Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Edit Asset Details</h3>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Status</span>
            </label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value as AssetStatus); setSaved(false); }}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</span>
            </label>
            <select
              value={locationId}
              onChange={e => { setLocationId(e.target.value); setSaved(false); }}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
            >
              <option value="">Select location</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Department</span>
            </label>
            <select
              value={departmentId}
              onChange={e => { setDepartmentId(e.target.value); setSaved(false); }}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
            >
              <option value="">Select department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description / Notes</label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); setSaved(false); }}
              rows={3}
              placeholder="Add notes about this asset..."
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          {orgSlug && <span className="uppercase">{orgSlug}</span>} &middot; Asset Management Suite
        </p>
      </div>
    </div>
  );
}
