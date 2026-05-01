import { useEffect, useMemo, useState } from 'react';
import {
  Key, Plus, RotateCw, Copy, Check, AlertTriangle, ShieldOff, Activity,
  Clock, Globe, AlertCircle, Loader2, Search, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Modal, StatCard } from '../components/ui';
import {
  apiKeysClient,
  type ApiKey,
  type ApiKeyListResponse,
  type ApiKeyUsageResponse,
} from '../lib/apiClient';

/* -------------------------------------------------------------------------- */
/* utils                                                                      */
/* -------------------------------------------------------------------------- */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

function StatusPill({ k }: { k: ApiKey }) {
  if (k.revokedAt) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Revoked</span>;
  if (!k.isActive)  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Disabled</span>;
  if (k.expiresAt && new Date(k.expiresAt) < new Date())
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Expired</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>;
}

/* -------------------------------------------------------------------------- */
/* page                                                                       */
/* -------------------------------------------------------------------------- */
export default function ApiKeysPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ApiKeyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [secretJustCreated, setSecretJustCreated] = useState<{ secret: string; name: string } | null>(null);
  const [usageFor, setUsageFor] = useState<ApiKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKey | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiKeysClient.list(user.id);
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const filtered = useMemo(() => {
    const items = list?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(k =>
      k.name.toLowerCase().includes(q) ||
      k.keyPrefix.toLowerCase().includes(q) ||
      (k.scopes ?? []).some(s => s.toLowerCase().includes(q)),
    );
  }, [list, search]);

  const stats = useMemo(() => {
    const items = list?.items ?? [];
    const active = items.filter(k => k.isActive && !k.revokedAt && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length;
    const revoked = items.filter(k => k.revokedAt).length;
    const usedRecently = items.filter(k => k.lastUsedAt && Date.now() - new Date(k.lastUsedAt).getTime() < 24 * 3600_000).length;
    return { total: items.length, active, revoked, usedRecently };
  }, [list]);

  const isAdmin = user?.role === 'admin' || user?.isGlobalAdmin;

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <ShieldOff className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin only</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            API key management is restricted to organization admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">API Keys</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Issue and revoke credentials for any integration calling the platform API.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 inline-flex items-center gap-1.5">
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create key
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total keys"      value={stats.total}        icon={<Key className="w-5 h-5 text-emerald-600" />}     iconBg="bg-emerald-100 dark:bg-emerald-900/30" />
        <StatCard title="Active"          value={stats.active}       icon={<Activity className="w-5 h-5 text-blue-600" />}    iconBg="bg-blue-100 dark:bg-blue-900/30" />
        <StatCard title="Used last 24h"   value={stats.usedRecently} icon={<Clock className="w-5 h-5 text-purple-600" />}     iconBg="bg-purple-100 dark:bg-purple-900/30" />
        <StatCard title="Revoked"         value={stats.revoked}      icon={<ShieldOff className="w-5 h-5 text-red-600" />}    iconBg="bg-red-100 dark:bg-red-900/30" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, prefix, or scope…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Errors */}
      {error && (
        <div className="card p-4 mb-4 bg-red-50/80 dark:bg-red-900/10 border border-red-200/60 dark:border-red-700/40">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Could not load API keys</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                Server URL: <code>{apiKeysClient.baseUrl}</code> — make sure the API server is running and <code>VITE_MOBILE_API_URL</code> points at it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading && !list ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Key className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{list?.items.length ? 'No keys match your search.' : 'No API keys yet.'}</p>
          {!list?.items.length && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create one to give the mobile app access.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-100 dark:border-zinc-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prefix</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scopes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last used</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} className="border-b border-gray-50 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{k.name}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{k.keyPrefix}…</td>
                  <td className="px-4 py-3"><StatusPill k={k} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(k.scopes ?? []).slice(0, 3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-zinc-700/50 text-gray-700 dark:text-gray-300">{s}</span>
                      ))}
                      {k.scopes && k.scopes.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500">+{k.scopes.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{k.rateLimitPerMinute}/min</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {fmtRelative(k.lastUsedAt)}
                    {k.lastUsedIp && <span className="block text-xs text-gray-400">{k.lastUsedIp}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{fmtDate(k.createdAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setUsageFor(k)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mr-3">
                      Usage
                    </button>
                    {!k.revokedAt && (
                      <button onClick={() => setConfirmRevoke(k)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && list && (
        <CreateKeyModal
          available={list.availableScopes}
          defaults={list.defaultScopes}
          onClose={() => setShowCreate(false)}
          onCreated={(secret, name) => {
            setShowCreate(false);
            setSecretJustCreated({ secret, name });
            load();
          }}
        />
      )}

      {secretJustCreated && (
        <SecretRevealModal
          secret={secretJustCreated.secret}
          name={secretJustCreated.name}
          onClose={() => setSecretJustCreated(null)}
        />
      )}

      {confirmRevoke && (
        <Modal isOpen onClose={() => setConfirmRevoke(null)} title="Revoke API key?">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Revoking <span className="font-semibold text-gray-900 dark:text-white">{confirmRevoke.name}</span> immediately blocks any client using this key.
            This action cannot be undone — issue a new key if you need to restore access.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmRevoke(null)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700">
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!user?.id) return;
                try {
                  await apiKeysClient.revoke(user.id, confirmRevoke.id);
                  setConfirmRevoke(null);
                  load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Revoke failed');
                }
              }}
              className="px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              Revoke key
            </button>
          </div>
        </Modal>
      )}

      {usageFor && (
        <UsageModal apiKey={usageFor} onClose={() => setUsageFor(null)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* create modal                                                               */
/* -------------------------------------------------------------------------- */
function CreateKeyModal({ available, defaults, onClose, onCreated }: {
  available: string[];
  defaults: string[];
  onClose: () => void;
  onCreated: (secret: string, name: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(defaults);
  const [rateLimit, setRateLimit] = useState(120);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const s of available) {
      const root = s.split(':')[0];
      g[root] = g[root] ?? [];
      g[root].push(s);
    }
    return g;
  }, [available]);

  const toggle = (s: string) =>
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const submit = async () => {
    if (!user?.id) return;
    setBusy(true); setErr(null);
    try {
      const res = await apiKeysClient.create(user.id, {
        name: name.trim(),
        scopes,
        rateLimitPerMinute: rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onCreated(res.secret, res.apiKey.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Create API key" size="lg">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Production integration"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rate limit (per minute)</label>
            <input
              type="number" min={1} max={10000} value={rateLimit}
              onChange={e => setRateLimit(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Expires at (optional)</label>
            <input
              type="datetime-local" value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Scopes</label>
            <div className="flex gap-2">
              <button onClick={() => setScopes(defaults)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Default scopes</button>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <button onClick={() => setScopes(available)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Select all</button>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <button onClick={() => setScopes([])} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Clear</button>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 max-h-72 overflow-y-auto space-y-3 bg-gray-50/50 dark:bg-zinc-900/30">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{group}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-white dark:hover:bg-zinc-800 px-2 py-1 rounded">
                      <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500" />
                      <span className="font-mono text-xs">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {err && (
          <div className="flex gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || !name.trim() || scopes.length === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Create key
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* secret-reveal modal (shown once)                                           */
/* -------------------------------------------------------------------------- */
function SecretRevealModal({ secret, name, onClose }: { secret: string; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };
  return (
    <Modal isOpen onClose={onClose} title={`Key created: ${name}`}>
      <div className="space-y-4">
        <div className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/40">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Copy this key now — it will not be shown again.</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/80 mt-0.5">
              Store it in a secrets manager. Never commit it to source control.
            </p>
          </div>
        </div>
        <div className="font-mono text-xs break-all bg-gray-900 text-emerald-300 dark:bg-zinc-950 p-4 rounded-lg select-all">
          {secret}
        </div>
        <div className="flex justify-between items-center">
          <button onClick={copy} className="px-3 py-2 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 inline-flex items-center gap-2">
            {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy to clipboard</>}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700">
            I've stored it safely
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* usage drawer                                                               */
/* -------------------------------------------------------------------------- */
function UsageModal({ apiKey, onClose }: { apiKey: ApiKey; onClose: () => void }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<ApiKeyUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [windowH, setWindowH] = useState(24);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    setLoading(true); setErr(null);
    apiKeysClient.usage(user.id, apiKey.id, windowH)
      .then(r => { if (!cancelled) setUsage(r); })
      .catch(e => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Usage lookup failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, apiKey.id, windowH]);

  return (
    <Modal isOpen onClose={onClose} title={`Usage — ${apiKey.name}`} size="xl">
      <div className="flex items-center gap-2 mb-4">
        {[1, 6, 24, 168, 720].map(h => (
          <button
            key={h}
            onClick={() => setWindowH(h)}
            className={`px-3 py-1.5 text-xs rounded-lg ${windowH === h ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300'}`}
          >
            {h === 1 ? '1h' : h < 24 ? `${h}h` : h === 24 ? '1d' : h === 168 ? '7d' : '30d'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
      )}
      {err && (
        <div className="text-sm text-red-600 dark:text-red-400 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" /> {err}</div>
      )}

      {usage && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="card p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total requests</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{usage.summary.totalRequests}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">Success</div>
              <div className="text-2xl font-bold text-emerald-600">{usage.summary.successCount}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">Errors</div>
              <div className="text-2xl font-bold text-red-500">{usage.summary.errorCount}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg latency</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{usage.summary.avgResponseMs}ms</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="card p-4">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top endpoints</div>
              {usage.summary.topEndpoints.length === 0
                ? <p className="text-sm text-gray-400">No data</p>
                : <ul className="space-y-1.5">{usage.summary.topEndpoints.map(e => (
                    <li key={e.key} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate pr-3">{e.key}</span>
                      <span className="text-gray-500 dark:text-gray-400">{e.count}</span>
                    </li>
                  ))}</ul>
              }
            </div>
            <div className="card p-4">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top errors</div>
              {usage.summary.topErrors.length === 0
                ? <p className="text-sm text-gray-400">No errors </p>
                : <ul className="space-y-1.5">{usage.summary.topErrors.map(e => (
                    <li key={e.key} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-red-600 dark:text-red-400 truncate pr-3">{e.key}</span>
                      <span className="text-gray-500 dark:text-gray-400">{e.count}</span>
                    </li>
                  ))}</ul>
              }
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-100 dark:border-zinc-700/50">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent requests</div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/50 dark:bg-zinc-900/30 text-gray-500 dark:text-gray-400 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Time</th>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Method</th>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Endpoint</th>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">ms</th>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.recent.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400">No requests in this window</td></tr>
                  ) : usage.recent.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-zinc-800/40 last:border-0">
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtRelative(r.timestamp)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{r.method}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300 truncate max-w-xs">{r.endpoint}</td>
                      <td className={`px-3 py-1.5 font-mono ${r.statusCode >= 400 ? 'text-red-600' : 'text-emerald-600'}`}>{r.statusCode}</td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{r.responseTimeMs}</td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-[10px] flex items-center gap-1"><Globe className="w-3 h-3" /> {r.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
