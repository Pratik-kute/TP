const express = require('express');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const {
  error,
  requireUser,
  isUuid,
  pageParams,
} = require('./_helpers');

const router = express.Router();

function mapAsset(a) {
  return {
    id: a.id,
    assetTag: a.asset_tag,
    name: a.name,
    type: a.type,
    category: a.category,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serial_number,
    status: a.status,
    description: a.description,
    purchaseDate: a.purchase_date,
    purchaseCost: Number(a.purchase_cost || 0),
    currency: a.currency || 'INR',
    warrantyStart: a.warranty_start,
    warrantyEnd: a.warranty_end,
    imageUrl: a.image_url || (Array.isArray(a.image_urls) ? a.image_urls[0] : null),
    imageUrls: Array.isArray(a.image_urls) ? a.image_urls : [],
    processor: a.processor,
    ram: a.ram,
    storage: a.storage,
    assetUse: a.asset_use,
    organizationId: a.organization_id,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

function permittedActions(role, status) {
  if (['retired', 'disposed', 'dead'].includes(String(status || '').toLowerCase())) {
    return ['add_photo'];
  }
  switch (String(role || '').toLowerCase()) {
    case 'admin':
    case 'manager':
      return ['add_photo', 'log_maintenance', 'raise_repair', 'update_repair', 'mark_recovery', 'verify_audit'];
    case 'technician':
      return ['add_photo', 'log_maintenance', 'raise_repair', 'update_repair'];
    case 'auditor':
      return ['add_photo', 'verify_audit'];
    case 'vendor':
      return ['update_repair'];
    default:
      return ['add_photo', 'raise_repair'];
  }
}

async function currentAllocation(assetId) {
  const { data } = await supabase
    .from('allocations')
    .select('*')
    .eq('asset_id', assetId)
    .in('status', ['active', 'approved'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function activeAuditContext(asset, orgId) {
  const { data: cycle, error: cycleErr } = await supabase
    .from('audit_cycles')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cycleErr || !cycle) return null;

  const { data: verification } = await supabase
    .from('audit_verifications')
    .select('id, result, created_at')
    .eq('cycle_id', cycle.id)
    .eq('asset_id', asset.id)
    .maybeSingle();

  const allocation = await currentAllocation(asset.id);
  return {
    cycleId: cycle.id,
    cycleName: cycle.name || 'Active audit',
    cycleStartsAt: cycle.starts_at,
    cycleEndsAt: cycle.ends_at,
    expectedLocationId: asset.location_id || null,
    expectedAssigneeId: allocation?.employee_id || null,
    currentVerification: verification
      ? {
          id: verification.id,
          result: verification.result,
          createdAt: verification.created_at,
        }
      : null,
  };
}

async function envelope(asset, user) {
  const orgId = user.organizationId;
  const [locationRes, departmentRes, allocation, repairsRes, maintenanceRes] =
    await Promise.all([
      asset.location_id
        ? supabase.from('locations').select('*').eq('id', asset.location_id).maybeSingle()
        : Promise.resolve({ data: null }),
      asset.department_id
        ? supabase.from('departments').select('*').eq('id', asset.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      currentAllocation(asset.id),
      supabase
        .from('repairs')
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', asset.id)
        .not('status', 'in', '("completed","cancelled")'),
      supabase
        .from('maintenance')
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', asset.id)
        .in('status', ['scheduled', 'in_progress', 'overdue']),
    ]);

  let assignee = null;
  if (allocation?.employee_id) {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, phone, avatar')
      .eq('id', allocation.employee_id)
      .maybeSingle();
    assignee = data;
  } else if (asset.assigned_employee) {
    assignee = {
      id: '',
      name: asset.assigned_employee,
      email: '',
      role: asset.designation || 'staff',
    };
  }

  return {
    asset: mapAsset(asset),
    location: locationRes.data
      ? { id: locationRes.data.id, name: locationRes.data.name }
      : null,
    department: departmentRes.data
      ? { id: departmentRes.data.id, name: departmentRes.data.name }
      : null,
    currentAssignee: assignee
      ? {
          id: assignee.id || '',
          name: assignee.name,
          email: assignee.email || '',
          role: assignee.role || '',
          phone: assignee.phone || '',
          avatar: assignee.avatar || null,
        }
      : null,
    auditContext: await activeAuditContext(asset, orgId),
    permittedActions: permittedActions(user.role, asset.status),
    openRepairCount: repairsRes.count || 0,
    overdueMaintenanceCount: maintenanceRes.count || 0,
  };
}

function parseQrPayload(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/\/(?:asset|scan)\/([^/?#]+)/i);
      if (match) return decodeURIComponent(match[1]);
    } catch (err) {
      return null;
    }
  }
  return value.includes('/') ? value.split('/').pop() : value;
}

router.get('/', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { limit, from, to } = pageParams(req);
    let query = supabase
      .from('assets')
      .select('*', { count: 'exact' })
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.q) {
      const q = String(req.query.q).replace(/[%,]/g, '');
      query = query.or(`name.ilike.%${q}%,asset_tag.ilike.%${q}%,serial_number.ilike.%${q}%`);
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }

    const { data, count, error: err } = await query.limit(limit);
    if (err) throw err;
    res.json({
      items: (data || []).map(mapAsset),
      total: count || 0,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/lookup-by-qr', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const parsed = parseQrPayload(req.body.qrPayload);
    if (!parsed) return error(res, 400, 'INVALID_QR_PAYLOAD', 'Invalid QR payload.');

    let query = supabase
      .from('assets')
      .select('*')
      .eq('organization_id', user.organizationId)
      .limit(1);
    query = isUuid(parsed)
      ? query.eq('id', parsed)
      : query.eq('asset_tag', String(parsed).toUpperCase());

    const { data, error: err } = await query.maybeSingle();
    if (err) throw err;
    if (!data) return error(res, 404, 'ASSET_NOT_FOUND', 'Asset not found.');

    res.json(await envelope(data, user));
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.get('/:assetId', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { data, error: err } = await supabase
      .from('assets')
      .select('*')
      .eq('id', req.params.assetId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (err) throw err;
    if (!data) return error(res, 404, 'ASSET_NOT_FOUND', 'Asset not found.');

    res.json(await envelope(data, user));
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/:assetId/photos/upload-url', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const maxBytes = Number(process.env.PHOTO_MAX_BYTES || 10485760);
    const bucket = process.env.PHOTO_BUCKET || 'asset-images';
    const { filename, mimeType, sizeBytes, caption } = req.body;
    if (!filename || !mimeType || !sizeBytes || Number(sizeBytes) > maxBytes) {
      return error(res, 422, 'VALIDATION_FAILED', 'Invalid photo upload details.');
    }

    const { data: asset } = await supabase
      .from('assets')
      .select('id, organization_id')
      .eq('id', req.params.assetId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (!asset) return error(res, 404, 'ASSET_NOT_FOUND', 'Asset not found.');

    const photoId = crypto.randomUUID();
    const ext = String(filename).split('.').pop().replace(/[^a-z0-9]/gi, '') || 'jpg';
    const storagePath = `${user.organizationId}/${req.params.assetId}/${photoId}.${ext}`;
    const { error: insertErr } = await supabase.from('asset_photos').insert({
      id: photoId,
      asset_id: req.params.assetId,
      organization_id: user.organizationId,
      url: null,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      uploaded_by: user.userId,
      caption: caption || null,
      status: 'pending',
    });
    if (insertErr) throw insertErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signErr || !signed) throw signErr || new Error('Could not create upload URL.');

    res.json({
      photoId,
      uploadUrl: signed.signedUrl,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'content-type': mimeType,
        'x-upsert': 'false',
      },
      storagePath,
      bucket,
      expiresInSeconds: Number(process.env.PHOTO_PRESIGNED_TTL_SECONDS || 600),
      maxSizeBytes: maxBytes,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/:assetId/photos/:photoId/finalize', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const bucket = process.env.PHOTO_BUCKET || 'asset-images';
    const { data: photo } = await supabase
      .from('asset_photos')
      .select('*')
      .eq('id', req.params.photoId)
      .eq('asset_id', req.params.assetId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (!photo) return error(res, 404, 'PHOTO_NOT_FOUND', 'Photo not found.');

    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(photo.storage_path);
    const url = publicUrl.publicUrl;
    const { data: updated, error: updateErr } = await supabase
      .from('asset_photos')
      .update({
        status: 'active',
        url,
        caption: req.body.caption || photo.caption,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', photo.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    const { data: asset } = await supabase
      .from('assets')
      .select('image_url, image_urls')
      .eq('id', req.params.assetId)
      .maybeSingle();
    const imageUrls = Array.isArray(asset?.image_urls) ? asset.image_urls : [];
    await supabase
      .from('assets')
      .update({
        image_url: asset?.image_url || url,
        image_urls: [...imageUrls, url],
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.assetId);

    res.json({
      photo: {
        id: updated.id,
        url,
        caption: updated.caption,
        mimeType: updated.mime_type,
        sizeBytes: updated.size_bytes,
        createdAt: updated.created_at,
        finalizedAt: updated.finalized_at,
      },
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
