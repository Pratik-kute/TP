const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser } = require('./_helpers');

const router = express.Router();

async function activeCycle(orgId, cycleId) {
  let query = supabase
    .from('audit_cycles')
    .select('*')
    .eq('organization_id', orgId);

  query = cycleId
    ? query.eq('id', cycleId)
    : query.eq('status', 'active').order('starts_at', { ascending: false }).limit(1);

  const { data, error: err } = await query.maybeSingle();
  if (err || !data || data.status !== 'active') return null;
  return data;
}

async function currentAssignee(assetId) {
  const { data } = await supabase
    .from('allocations')
    .select('employee_id')
    .eq('asset_id', assetId)
    .in('status', ['active', 'approved'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.employee_id || null;
}

async function saveVerification(req, res, result) {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { data: asset } = await supabase
      .from('assets')
      .select('*')
      .eq('id', req.params.assetId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (!asset) return error(res, 404, 'ASSET_NOT_FOUND', 'Asset not found.');

    const cycle = await activeCycle(user.organizationId, req.body.cycleId);
    if (!cycle) return error(res, 404, 'CYCLE_NOT_FOUND', 'No active audit cycle.');

    const expectedAssigneeId = await currentAssignee(asset.id);
    const row = {
      cycle_id: cycle.id,
      asset_id: asset.id,
      organization_id: user.organizationId,
      verifier_id: user.userId,
      result,
      expected_location_id: asset.location_id || null,
      actual_location_id: req.body.actualLocationId ?? asset.location_id ?? null,
      expected_assignee_id: expectedAssigneeId,
      actual_assignee_id: req.body.actualAssigneeId ?? expectedAssigneeId,
      flag_reason: result === 'flagged' ? req.body.flagReason : null,
      notes: req.body.notes || null,
      geo_lat: req.body.geoLat || null,
      geo_lng: req.body.geoLng || null,
      created_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('audit_verifications')
      .select('id')
      .eq('cycle_id', cycle.id)
      .eq('asset_id', asset.id)
      .maybeSingle();

    const query = existing
      ? supabase.from('audit_verifications').update(row).eq('id', existing.id)
      : supabase.from('audit_verifications').insert(row);
    const { data: saved, error: saveErr } = await query.select().single();
    if (saveErr) throw saveErr;

    await supabase.from('audit_logs').insert({
      user_id: user.userId,
      user_name: user.email,
      action: result === 'verified' ? 'VERIFY' : 'FLAG',
      module: 'Audits',
      entity_id: saved.id,
      entity_type: 'audit_verification',
      details: `${result === 'verified' ? 'Verified' : 'Flagged'} ${asset.name}`,
      timestamp: new Date().toISOString(),
      organization_id: user.organizationId,
    });

    res.status(201).json({
      verification: {
        id: saved.id,
        cycleId: saved.cycle_id,
        assetId: saved.asset_id,
        verifierId: saved.verifier_id,
        result: saved.result,
        expectedLocationId: saved.expected_location_id,
        actualLocationId: saved.actual_location_id,
        expectedAssigneeId: saved.expected_assignee_id,
        actualAssigneeId: saved.actual_assignee_id,
        flagReason: saved.flag_reason,
        notes: saved.notes,
        geoLat: saved.geo_lat,
        geoLng: saved.geo_lng,
        createdAt: saved.created_at,
      },
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

router.post('/assets/:assetId/audit/verify', (req, res) => {
  saveVerification(req, res, 'verified');
});

router.post('/assets/:assetId/audit/flag', (req, res) => {
  if (!req.body.flagReason || !req.body.notes) {
    return error(res, 422, 'VALIDATION_FAILED', 'Flag reason and notes are required.');
  }
  saveVerification(req, res, 'flagged');
});

module.exports = router;
