const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser } = require('./_helpers');

const router = express.Router();

function mapRepair(row, asset) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetTag: asset?.asset_tag,
    assetName: asset?.name,
    vendorId: row.vendor_id,
    technicianId: row.technician_id,
    issue: row.issue,
    status: row.status,
    priority: row.priority || 'medium',
    cost: Number(row.cost || 0),
    partsUsed: row.parts_used || '',
    laborHours: Number(row.labor_hours || 0),
    completionDate: row.completion_date,
    notes: row.notes,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    reportedByFullName: row.reported_by_full_name || 'Reporter',
  };
}

router.get('/assets/:assetId/repairs', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const [{ data: asset }, { data, error: err, count }] = await Promise.all([
      supabase
        .from('assets')
        .select('id, name, asset_tag')
        .eq('id', req.params.assetId)
        .eq('organization_id', user.organizationId)
        .maybeSingle(),
      supabase
        .from('repairs')
        .select('*', { count: 'exact' })
        .eq('organization_id', user.organizationId)
        .eq('asset_id', req.params.assetId)
        .order('created_at', { ascending: false }),
    ]);
    if (err) throw err;
    res.json({
      items: (data || []).map((row) => mapRepair(row, asset)),
      total: count || 0,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.get('/repairs/:repairId', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { data: repair, error: repairErr } = await supabase
      .from('repairs')
      .select('*')
      .eq('id', req.params.repairId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (repairErr) throw repairErr;
    if (!repair) return error(res, 404, 'REPAIR_NOT_FOUND', 'Repair not found.');

    const [{ data: asset }, { data: updates }] = await Promise.all([
      supabase.from('assets').select('id, name, asset_tag').eq('id', repair.asset_id).maybeSingle(),
      supabase
        .from('repair_updates')
        .select('*')
        .eq('repair_id', repair.id)
        .order('created_at', { ascending: true }),
    ]);

    res.json({
      repair: mapRepair(repair, asset),
      vendor: null,
      updates: (updates || []).map((row) => ({
        id: row.id,
        statusFrom: row.status_from,
        statusTo: row.status_to,
        note: row.note || row.notes,
        partsUsed: row.parts_used,
        laborHours: row.labor_hours,
        cost: row.cost,
        createdAt: row.created_at,
        actorFullName: row.actor_name || 'User',
      })),
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/assets/:assetId/repairs', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const now = new Date().toISOString();
    const startStatus = req.body.vendorId || req.body.technicianId ? 'assigned' : 'pending';
    const { data: repair, error: repairErr } = await supabase
      .from('repairs')
      .insert({
        asset_id: req.params.assetId,
        organization_id: user.organizationId,
        vendor_id: req.body.vendorId || null,
        technician_id: req.body.technicianId || null,
        issue: req.body.issue,
        status: startStatus,
        priority: req.body.priority || 'medium',
        cost: Number(req.body.cost || 0),
        parts_used: req.body.partsUsed || '',
        labor_hours: Number(req.body.laborHours || 0),
        completion_date: null,
        notes: req.body.notes || '',
        created_at: now,
      })
      .select()
      .single();
    if (repairErr) throw repairErr;

    await supabase.from('repair_updates').insert({
      repair_id: repair.id,
      status_from: null,
      status_to: startStatus,
      note: 'Repair raised via mobile',
      created_at: now,
      user_id: user.userId,
    });

    res.status(201).json({ repair: mapRepair(repair) });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/repairs/:repairId/updates', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { data: existing } = await supabase
      .from('repairs')
      .select('*')
      .eq('id', req.params.repairId)
      .eq('organization_id', user.organizationId)
      .maybeSingle();
    if (!existing) return error(res, 404, 'REPAIR_NOT_FOUND', 'Repair not found.');

    const statusTo = req.body.statusTo || existing.status;
    const updates = {
      status: statusTo,
      parts_used: req.body.partsUsed ?? existing.parts_used,
      labor_hours: req.body.laborHours ?? existing.labor_hours,
      cost: req.body.cost ?? existing.cost,
      completion_date: statusTo === 'completed' ? new Date().toISOString() : existing.completion_date,
    };

    const { data: repair, error: updateErr } = await supabase
      .from('repairs')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    await supabase.from('repair_updates').insert({
      repair_id: existing.id,
      status_from: existing.status,
      status_to: statusTo,
      note: req.body.note,
      parts_used: req.body.partsUsed || null,
      labor_hours: req.body.laborHours || null,
      cost: req.body.cost || null,
      created_at: new Date().toISOString(),
      user_id: user.userId,
    });

    res.json({ repair: mapRepair(repair) });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
