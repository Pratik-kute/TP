// Aggregates raw rows fetched from Supabase into the shape needed by the
// PDF builder and the OpenAI prompt. Pure functions only — no I/O here.

export interface RawAsset {
  id: string;
  asset_tag: string;
  name: string;
  type: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  ram: string | null;
  processor: string | null;
  storage: string | null;
  graphics_card: string | null;
  purchase_cost: number | null;
  currency: string | null;
  location_id: string | null;
  department_id: string | null;
  device_name: string | null;
}

export interface RawAllocation {
  id: string;
  asset_id: string;
  employee_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

export interface RawLocation { id: string; name: string }
export interface RawDepartment { id: string; name: string }

export interface ComputedStats {
  totals: {
    assets: number;
    desktops: number;
    laptops: number;
    monitors: number;
    peripherals: number;
    mobile: number;
    other: number;
    totalValue: number;
    currency: string;
  };
  statusBreakdown: Record<string, number>;
  inventory: Array<{ category: string; quantity: number; location: string }>;
  computing: {
    desktopCount: number;
    laptopCount: number;
    processorBreakdown: Record<string, number>;
    ramBreakdown: Record<string, number>;
    flaggedLowRam: Array<{ tag: string; name: string; ram: string }>;
    flaggedNoSerial: Array<{ tag: string; name: string }>;
    flaggedNoGpu: Array<{ tag: string; name: string }>;
  };
  peripherals: {
    keyboards: number;
    mice: number;
    adaptors: number;
    workstations: number;
    keyboardGap: number;
    mouseGap: number;
    adaptorGap: number;
  };
  mobile: Array<{ tag: string; name: string; brand: string; model: string; serialNumber: string }>;
  miscellaneous: Array<{ tag: string; name: string; description: string }>;
  flags: Array<{ category: string; affectedAssets: string; recommendedAction: string }>;
  cpuRegister: Array<{
    tag: string; name: string; serialNumber: string; cpu: string; ram: string; gpu: string;
  }>;
  deadAssets: Array<{ tag: string; name: string; status: string }>;
  period: { year: number; month: number; monthName: string; locationName: string };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ramToGB(ram: string | null): number {
  if (!ram) return 0;
  const m = ram.match(/(\d+)\s*GB/i);
  return m ? parseInt(m[1], 10) : 0;
}

function isPeripheral(category: string | null, type: string): boolean {
  const cat = (category || '').toLowerCase();
  const t = (type || '').toLowerCase();
  return /keyboard|mouse|adaptor|adapter|cable|charger/.test(cat + ' ' + t);
}

function isComputing(type: string): boolean {
  return /desktop|laptop|computer|workstation|cpu/i.test(type || '');
}

function isMonitor(type: string, category: string | null): boolean {
  return /monitor|display|screen/i.test((type || '') + ' ' + (category || ''));
}

function isMobile(type: string, category: string | null): boolean {
  return /mobile|phone|tablet/i.test((type || '') + ' ' + (category || ''));
}

export function computeStats(input: {
  assets: RawAsset[];
  allocations: RawAllocation[];
  locations: RawLocation[];
  departments: RawDepartment[];
  period: { year: number; month: number };
}): ComputedStats {
  const { assets, locations, period } = input;

  const locationMap = new Map(locations.map(l => [l.id, l.name]));
  const primaryLocation = locations[0]?.name || 'Head Office';

  const desktops = assets.filter(a => /desktop|cpu|workstation/i.test(a.type));
  const laptops = assets.filter(a => /laptop/i.test(a.type));
  const monitors = assets.filter(a => isMonitor(a.type, a.category));
  const mobile = assets.filter(a => isMobile(a.type, a.category));
  const peripherals = assets.filter(a => isPeripheral(a.category, a.type));
  const others = assets.filter(a =>
    !isComputing(a.type) && !isMonitor(a.type, a.category) &&
    !isMobile(a.type, a.category) && !isPeripheral(a.category, a.type)
  );

  // Status totals
  const statusBreakdown: Record<string, number> = {};
  for (const a of assets) {
    statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
  }

  // Inventory grouping
  const invMap = new Map<string, { quantity: number; location: string }>();
  for (const a of assets) {
    const key = a.category || a.type || 'Uncategorized';
    const loc = locationMap.get(a.location_id || '') || primaryLocation;
    const existing = invMap.get(key);
    if (existing) existing.quantity++;
    else invMap.set(key, { quantity: 1, location: loc });
  }
  const inventory = Array.from(invMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.quantity - a.quantity);

  // Computing breakdowns
  const computingAssets = [...desktops, ...laptops];
  const processorBreakdown: Record<string, number> = {};
  const ramBreakdown: Record<string, number> = {};
  const flaggedLowRam: ComputedStats['computing']['flaggedLowRam'] = [];
  const flaggedNoSerial: ComputedStats['computing']['flaggedNoSerial'] = [];
  const flaggedNoGpu: ComputedStats['computing']['flaggedNoGpu'] = [];
  for (const a of computingAssets) {
    const cpu = a.processor || 'Unspecified';
    processorBreakdown[cpu] = (processorBreakdown[cpu] || 0) + 1;
    const ram = a.ram || 'Unspecified';
    ramBreakdown[ram] = (ramBreakdown[ram] || 0) + 1;
    if (ramToGB(a.ram) > 0 && ramToGB(a.ram) < 16) {
      flaggedLowRam.push({ tag: a.asset_tag, name: a.name, ram: a.ram || '' });
    }
    if (!a.serial_number || /not\s*visible|not\s*available|n\/?a/i.test(a.serial_number)) {
      flaggedNoSerial.push({ tag: a.asset_tag, name: a.name });
    }
    if (!a.graphics_card || /none|no\s*gpu/i.test(a.graphics_card)) {
      flaggedNoGpu.push({ tag: a.asset_tag, name: a.name });
    }
  }

  // Peripherals
  const keyboards = peripherals.filter(p => /keyboard/i.test(p.category || '' + p.type)).length;
  const mice = peripherals.filter(p => /mouse|mice/i.test(p.category || '' + p.type)).length;
  const adaptors = peripherals.filter(p => /adaptor|adapter|charger/i.test(p.category || '' + p.type)).length;
  const workstations = desktops.length + laptops.length;

  // Mobile
  const mobileList = mobile.map(m => ({
    tag: m.asset_tag,
    name: m.name,
    brand: m.brand || '',
    model: m.model || '',
    serialNumber: m.serial_number || '',
  }));

  // Miscellaneous (non-IT, non-peripheral, non-computing)
  const miscList = others.map(o => ({
    tag: o.asset_tag,
    name: o.name,
    description: o.brand && o.model ? `${o.brand} ${o.model}` : (o.category || ''),
  }));

  // Audit flags table
  const flags: ComputedStats['flags'] = [];
  if (flaggedLowRam.length) flags.push({
    category: 'Below-Standard RAM',
    affectedAssets: flaggedLowRam.map(f => f.tag).join(', '),
    recommendedAction: 'Upgrade RAM to meet 16 GB fleet standard',
  });
  if (flaggedNoSerial.length) flags.push({
    category: 'Serial Number Missing/Unreadable',
    affectedAssets: flaggedNoSerial.map(f => f.tag).join(', '),
    recommendedAction: 'Recover serial from BIOS or manufacturer records',
  });
  if (flaggedNoGpu.length) flags.push({
    category: 'No Discrete Graphics Card',
    affectedAssets: flaggedNoGpu.map(f => f.tag).join(', '),
    recommendedAction: 'Document workload; procure discrete GPU if required',
  });
  if (workstations - keyboards > 0) flags.push({
    category: 'Missing Keyboards',
    affectedAssets: `${workstations - keyboards} workstation(s)`,
    recommendedAction: 'Procure or assign keyboards to unequipped workstations',
  });
  if (workstations - mice > 0) flags.push({
    category: 'Missing Mice',
    affectedAssets: `${workstations - mice} workstation(s)`,
    recommendedAction: 'Procure or assign mice to unequipped workstations',
  });
  if (workstations - adaptors > 0) flags.push({
    category: 'Missing Adaptors',
    affectedAssets: `${workstations - adaptors} workstation(s)`,
    recommendedAction: 'Verify shared power strip arrangement or procure adaptors',
  });

  // Dead/retired/disposed
  const deadAssets = assets
    .filter(a => ['dead', 'retired', 'disposed'].includes(a.status))
    .map(a => ({ tag: a.asset_tag, name: a.name, status: a.status }));
  if (deadAssets.length) flags.push({
    category: 'Dead / Retired / Disposed Assets',
    affectedAssets: `${deadAssets.length} asset(s)`,
    recommendedAction: 'Review for write-off, replacement, or disposal documentation',
  });

  // Complete CPU register
  const cpuRegister = computingAssets.map(a => ({
    tag: a.asset_tag,
    name: a.device_name || a.name || '-',
    serialNumber: a.serial_number || 'NOT VISIBLE',
    cpu: a.processor || 'Unspecified',
    ram: a.ram || 'Unspecified',
    gpu: a.graphics_card || 'None',
  }));

  // Total value (sum across normalized currency)
  const currency = (assets.find(a => a.currency)?.currency || 'USD').toUpperCase();
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0);

  return {
    totals: {
      assets: assets.length,
      desktops: desktops.length,
      laptops: laptops.length,
      monitors: monitors.length,
      peripherals: peripherals.length,
      mobile: mobile.length,
      other: others.length,
      totalValue,
      currency,
    },
    statusBreakdown,
    inventory,
    computing: {
      desktopCount: desktops.length,
      laptopCount: laptops.length,
      processorBreakdown,
      ramBreakdown,
      flaggedLowRam,
      flaggedNoSerial,
      flaggedNoGpu,
    },
    peripherals: {
      keyboards,
      mice,
      adaptors,
      workstations,
      keyboardGap: Math.max(0, workstations - keyboards),
      mouseGap: Math.max(0, workstations - mice),
      adaptorGap: Math.max(0, workstations - adaptors),
    },
    mobile: mobileList,
    miscellaneous: miscList,
    flags,
    cpuRegister,
    deadAssets,
    period: {
      year: period.year,
      month: period.month,
      monthName: MONTH_NAMES[period.month - 1] || '',
      locationName: primaryLocation,
    },
  };
}
