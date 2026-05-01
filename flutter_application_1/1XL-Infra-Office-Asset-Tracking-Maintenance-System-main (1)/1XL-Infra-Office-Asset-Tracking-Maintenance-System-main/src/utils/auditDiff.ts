import { Asset } from '../types';

export interface AuditFieldChange {
  field: string;
  fieldLabel: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

const ASSET_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  type: 'Type',
  category: 'Category',
  brand: 'Brand',
  model: 'Model',
  serialNumber: 'Serial Number',
  locationId: 'Location',
  departmentId: 'Department',
  assignedEmployee: 'Assigned To',
  designation: 'Designation',
  purchaseDate: 'Purchase Date',
  purchaseCost: 'Purchase Cost',
  warrantyStart: 'Warranty Start',
  warrantyEnd: 'Warranty End',
  status: 'Status',
  vendorId: 'Vendor',
  description: 'Description',
  usefulLifeYears: 'Useful Life (Years)',
  salvageValue: 'Salvage Value',
  invoiceUrl: 'Invoice URL',
  processor: 'Processor',
  ram: 'RAM',
  storage: 'Storage',
  graphicsCard: 'Graphics Card',
  screenSize: 'Screen Size',
  configuration: 'Configuration',
  deviceName: 'Device Name',
  mfgDate: 'Manufacture Date',
  physicallyVerified: 'Physically Verified',
};

// Fields to skip in diff (auto-managed)
const SKIP_FIELDS = new Set(['id', 'assetTag', 'organizationId', 'createdAt', 'updatedAt']);

export function computeAssetDiff(
  oldAsset: Partial<Asset>,
  newValues: Partial<Asset>,
  resolvers?: {
    locationName?: (id: string) => string;
    departmentName?: (id: string) => string;
    vendorName?: (id: string) => string;
  }
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  for (const [key, newVal] of Object.entries(newValues)) {
    if (SKIP_FIELDS.has(key)) continue;
    const oldVal = (oldAsset as Record<string, unknown>)[key];

    // Compare as strings to handle type mismatches (e.g. number vs string)
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      let displayOld: string | number | boolean | null = oldVal as string | number | boolean | null;
      let displayNew: string | number | boolean | null = newVal as string | number | boolean | null;

      // Resolve FK IDs to human-readable names
      if (key === 'locationId' && resolvers?.locationName) {
        displayOld = oldVal ? resolvers.locationName(String(oldVal)) : 'None';
        displayNew = newVal ? resolvers.locationName(String(newVal)) : 'None';
      }
      if (key === 'departmentId' && resolvers?.departmentName) {
        displayOld = oldVal ? resolvers.departmentName(String(oldVal)) : 'None';
        displayNew = newVal ? resolvers.departmentName(String(newVal)) : 'None';
      }
      if (key === 'vendorId' && resolvers?.vendorName) {
        displayOld = oldVal ? resolvers.vendorName(String(oldVal)) : 'None';
        displayNew = newVal ? resolvers.vendorName(String(newVal)) : 'None';
      }

      changes.push({
        field: key,
        fieldLabel: ASSET_FIELD_LABELS[key] || key,
        oldValue: displayOld ?? null,
        newValue: displayNew ?? null,
      });
    }
  }
  return changes;
}
