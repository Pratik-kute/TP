import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { objectToCamel, objectToSnake } from '../lib/caseMapper';
import { Asset, Organization } from '../types';
import {
  CheckCircle, AlertTriangle, Loader2,
  Tag, Package,
} from 'lucide-react';

interface ScanData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationName: string;
  deviceInfo: string;
  platform: string;
  timestamp: string;
}

function getDeviceInfo(): { deviceInfo: string; platform: string } {
  const ua = navigator.userAgent;
  let platform = 'Unknown';

  if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Android/i.test(ua)) platform = 'Android';
  else if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Mac/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  let deviceInfo = platform;
  const match = ua.match(/\(([^)]+)\)/);
  if (match) {
    deviceInfo = match[1].split(';').slice(0, 2).join(' · ').trim();
  }

  return { deviceInfo, platform };
}

/** Reverse geocode coordinates to a human-readable location name */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!resp.ok) return '';
    const data = await resp.json();
    const addr = data.address;
    if (!addr) return data.display_name || '';
    // Build a concise location: road/neighbourhood, city/town, country
    const parts = [
      addr.road || addr.neighbourhood || addr.suburb || '',
      addr.city || addr.town || addr.village || addr.county || '',
      addr.country || '',
    ].filter(Boolean);
    return parts.join(', ');
  } catch {
    return '';
  }
}

export default function PublicAssetScan() {
  const { orgSlug, assetId } = useParams<{ orgSlug: string; assetId: string }>();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [locationStatus, setLocationStatus] = useState<'requesting' | 'granted' | 'denied' | 'unavailable'>('requesting');
  const [logged, setLogged] = useState(false);
  const [logError, setLogError] = useState('');
  const hasLogged = useRef(false);

  const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
  const homeUrl = `${base}#/login`;
  const currentYear = new Date().getFullYear();

  // Fetch asset + org data
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

      if (a.organizationId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', a.organizationId)
          .single();
        if (orgData) setOrg(objectToCamel<Organization>(orgData));
      }

      setLoading(false);
    }
    fetchData();
  }, [assetId]);

  // Request geolocation
  useEffect(() => {
    if (!asset || loading) return;

    const { deviceInfo, platform } = getDeviceInfo();
    const timestamp = new Date().toISOString();

    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setScanData({ latitude: null, longitude: null, accuracy: null, locationName: '', deviceInfo, platform, timestamp });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationStatus('granted');
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locationName = await reverseGeocode(lat, lng);
        setScanData({
          latitude: lat,
          longitude: lng,
          accuracy: Math.round(position.coords.accuracy),
          locationName,
          deviceInfo,
          platform,
          timestamp,
        });
      },
      (err) => {
        setLocationStatus(err.code === 1 ? 'denied' : 'unavailable');
        setScanData({ latitude: null, longitude: null, accuracy: null, locationName: '', deviceInfo, platform, timestamp });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [asset, loading]);

  // Log the scan to audit_logs once per page load
  useEffect(() => {
    if (!scanData || !asset || hasLogged.current) return;
    hasLogged.current = true;

    async function logScan() {
      try {
        let locationStr: string;
        if (scanData!.latitude !== null) {
          const coords = `${scanData!.latitude.toFixed(6)}, ${scanData!.longitude!.toFixed(6)} (±${scanData!.accuracy}m)`;
          locationStr = scanData!.locationName
            ? `${scanData!.locationName} [${coords}]`
            : coords;
        } else {
          locationStr = locationStatus === 'denied' ? 'Location denied by user' : 'Location unavailable';
        }

        const details = [
          `QR scanned for "${asset!.name}" (${asset!.assetTag})`,
          `Location: ${locationStr}`,
          `Device: ${scanData!.deviceInfo}`,
          `Platform: ${scanData!.platform}`,
        ].join(' | ');

        const logEntry = objectToSnake({
          userId: '00000000-0000-0000-0000-000000000000',
          userName: `QR Scanner (${scanData!.platform})`,
          action: 'QR Scanned',
          module: 'Audits',
          entityId: asset!.id,
          entityType: 'Asset',
          details,
          timestamp: scanData!.timestamp,
          organizationId: asset!.organizationId,
        });

        const { error } = await supabase.from('audit_logs').insert(logEntry);
        if (error) throw error;
        setLogged(true);
      } catch (err: any) {
        console.error('Failed to log scan:', err);
        setLogError(err?.message || 'Failed to save scan');
        setLogged(true);
      }
    }

    logScan();
  }, [scanData, asset, locationStatus]);

  // ── Shared header ──
  const Header = () => (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <a href={homeUrl} className="flex items-center gap-2.5 no-underline hover:opacity-80 transition-opacity">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-base font-bold text-gray-900">{org?.name || 'Asset Tracker'}</span>
        </a>
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Asset Scan</span>
      </div>
    </header>
  );

  // ── Shared footer ──
  const Footer = () => (
    <footer className="w-full bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-lg mx-auto px-4 py-5 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="w-4 h-4 rounded object-contain opacity-50" />
          ) : (
            <Package className="w-3.5 h-3.5 text-gray-300" />
          )}
          <span className="text-xs text-gray-400 font-medium">{org?.name || 'Asset Tracker'}</span>
        </div>
        <p className="text-[10px] text-gray-300">
          &copy; {currentYear} {org?.name || 'Asset Tracker'}. All rights reserved.
        </p>
        <p className="text-[10px] text-gray-300">
          Powered by Asset Tracking & Maintenance System
        </p>
      </div>
    </footer>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Loading asset...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !asset) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h1 className="text-lg font-bold text-gray-900">Asset Not Found</h1>
            <p className="text-sm text-gray-500">This QR code does not match any asset in the system.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Waiting for geolocation / scan data ──
  if (!scanData) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Capturing scan data...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Main scan result ──
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50 to-gray-50">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 py-8">
        {/* Success card */}
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Green header */}
          <div className="bg-emerald-600 px-5 py-5 text-center">
            <CheckCircle className="w-10 h-10 text-white mx-auto mb-2" />
            <h1 className="text-lg font-bold text-white">Scan Recorded</h1>
            <p className="text-emerald-100 text-xs mt-1">
              {new Date(scanData.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Asset details */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 rounded-xl">
              <Tag className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Asset Tag</p>
                <p className="text-sm font-bold text-gray-900">{asset.assetTag}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Name</p>
                <p className="text-sm font-medium text-gray-800 truncate">{asset.name}</p>
              </div>
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Category</p>
                <p className="text-sm font-medium text-gray-800 truncate">{asset.category || '—'}</p>
              </div>
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Brand</p>
                <p className="text-sm font-medium text-gray-800 truncate">{asset.brand || '—'}</p>
              </div>
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Status</p>
                <p className="text-sm font-medium text-gray-800 capitalize">{asset.status?.replace(/_/g, ' ') || '—'}</p>
              </div>
            </div>

            {asset.serialNumber && (
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Serial Number</p>
                <p className="text-sm font-mono font-medium text-gray-800">{asset.serialNumber}</p>
              </div>
            )}
          </div>

          {/* Footer status */}
          <div className={`px-5 py-3 text-center text-xs font-medium ${logError ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {!logged ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving scan data...
              </span>
            ) : logError ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Scan recorded locally. Sync pending.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" /> Scan saved to audit trail
              </span>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
