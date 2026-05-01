import { db } from '../db.js';
import { computePermittedActions } from './permittedActions.js';
import type { AuthedUser } from '../middleware/types.js';

/**
 * Build the canonical mobile asset envelope:
 *   { asset, location, department, vendor, currentAllocation, currentAssignee,
 *     auditContext?, permittedActions }
 *
 * Pulls one row per related entity in parallel — no N+1.
 */
export async function serializeAssetForMobile(asset: any, user: AuthedUser) {
  const [locationRes, deptRes, vendorRes, allocRes] = await Promise.all([
    asset.location_id
      ? db.from('locations').select('id, name, address, city, state, country, floor_no').eq('id', asset.location_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    asset.department_id
      ? db.from('departments').select('id, name, floor_no').eq('id', asset.department_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    asset.vendor_id
      ? db.from('vendors').select('id, name, contact_person, email, phone').eq('id', asset.vendor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('allocations')
      .select('*')
      .eq('asset_id', asset.id)
      .in('status', ['active', 'approved'])
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let assignee: any = null;
  if (allocRes.data?.employee_id) {
    const { data } = await db.from('users')
      .select('id, name, email, phone, role')
      .eq('id', allocRes.data.employee_id)
      .maybeSingle();
    assignee = data ? {
      id: data.id, name: data.name, email: data.email, phone: data.phone, role: data.role,
    } : null;
  }

  // Audit context: any active cycle for the org?
  let auditContext: any = null;
  const { data: cycle } = await db
    .from('audit_cycles')
    .select('id, name, starts_at, ends_at')
    .eq('organization_id', asset.organization_id)
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cycle) {
    const { data: verification } = await db
      .from('audit_verifications')
      .select('id, result, created_at')
      .eq('cycle_id', cycle.id)
      .eq('asset_id', asset.id)
      .maybeSingle();
    auditContext = {
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleStartsAt: cycle.starts_at,
      cycleEndsAt: cycle.ends_at,
      expectedLocationId: asset.location_id,
      expectedAssigneeId: allocRes.data?.employee_id ?? null,
      currentVerification: verification ? {
        id: verification.id,
        result: verification.result,
        createdAt: verification.created_at,
      } : null,
    };
  }

  const permittedActions = computePermittedActions(user, { status: asset.status, organizationId: asset.organization_id });

  return {
    asset: {
      id: asset.id,
      assetTag: asset.asset_tag,
      name: asset.name,
      type: asset.type,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serial_number,
      status: asset.status,
      description: asset.description,
      purchaseDate: asset.purchase_date,
      purchaseCost: Number(asset.purchase_cost ?? 0),
      currency: asset.currency ?? null,
      warrantyStart: asset.warranty_start,
      warrantyEnd: asset.warranty_end,
      imageUrl: asset.image_url ?? null,
      imageUrls: asset.image_urls ?? [],
      processor: asset.processor ?? null,
      ram: asset.ram ?? null,
      storage: asset.storage ?? null,
      assetUse: asset.asset_use ?? null,
      organizationId: asset.organization_id,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    },
    location: locationRes.data ? {
      id: locationRes.data.id,
      name: locationRes.data.name,
      address: locationRes.data.address,
      city: locationRes.data.city,
      state: locationRes.data.state,
      country: locationRes.data.country,
      floorNo: locationRes.data.floor_no,
    } : null,
    department: deptRes.data ? {
      id: deptRes.data.id,
      name: deptRes.data.name,
      floorNo: deptRes.data.floor_no,
    } : null,
    vendor: vendorRes.data ? {
      id: vendorRes.data.id,
      name: vendorRes.data.name,
      contactPerson: vendorRes.data.contact_person,
      email: vendorRes.data.email,
      phone: vendorRes.data.phone,
    } : null,
    currentAllocation: allocRes.data ? {
      id: allocRes.data.id,
      status: allocRes.data.status,
      startDate: allocRes.data.start_date,
      endDate: allocRes.data.end_date,
      allocationType: allocRes.data.allocation_type,
      employeeId: allocRes.data.employee_id,
      departmentId: allocRes.data.department_id,
    } : null,
    currentAssignee: assignee,
    auditContext,
    permittedActions,
  };
}
