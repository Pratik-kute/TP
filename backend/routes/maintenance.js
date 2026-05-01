const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser } = require('./_helpers');

const router = express.Router();

const taskTypes = [
  { id: 'preventive_inspection', label: 'Preventive Inspection', defaultType: 'preventive' },
  { id: 'cleaning', label: 'Cleaning', defaultType: 'preventive' },
  { id: 'firmware_update', label: 'Firmware/Software Update', defaultType: 'preventive' },
  { id: 'lubrication', label: 'Lubrication', defaultType: 'preventive' },
  { id: 'calibration', label: 'Calibration', defaultType: 'preventive' },
  { id: 'replacement', label: 'Part Replacement', defaultType: 'corrective' },
  { id: 'corrective_other', label: 'Corrective - Other', defaultType: 'corrective' },
];

router.get('/task-types', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ items: taskTypes });
});

router.get('/assets/:assetId/maintenance', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { data, error: err, count } = await supabase
      .from('maintenance')
      .select('*', { count: 'exact' })
      .eq('organization_id', user.organizationId)
      .eq('asset_id', req.params.assetId)
      .order('scheduled_date', { ascending: false });
    if (err) throw err;

    res.json({
      items: (data || []).map((row) => ({
        id: row.id,
        assetId: row.asset_id,
        scheduledDate: row.scheduled_date,
        completedDate: row.completed_date,
        technicianId: row.technician_id,
        status: row.status,
        type: row.type,
        cost: Number(row.cost || 0),
        notes: row.notes,
        checklist: row.checklist || [],
        organizationId: row.organization_id,
        createdAt: row.created_at,
      })),
      total: count || 0,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

router.post('/assets/:assetId/maintenance', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const taskTypeId = req.body.taskTypeId || 'preventive_inspection';
    const selected = taskTypes.find((item) => item.id === taskTypeId) || taskTypes[0];
    const now = new Date().toISOString();

    const { data, error: err } = await supabase
      .from('maintenance')
      .insert({
        asset_id: req.params.assetId,
        organization_id: user.organizationId,
        scheduled_date: req.body.scheduledDate || now,
        completed_date: req.body.completedDate || now,
        technician_id: req.body.technicianId || user.userId,
        status: req.body.status || 'completed',
        type: req.body.type || selected.defaultType,
        cost: Number(req.body.cost || 0),
        notes: `[task:${taskTypeId}] ${req.body.notes || ''}`.trim(),
        checklist: req.body.checklist || [],
      })
      .select()
      .single();
    if (err) throw err;

    await supabase.from('audit_logs').insert({
      user_id: user.userId,
      user_name: user.email,
      action: 'CREATE',
      module: 'Maintenance',
      entity_id: data.id,
      entity_type: 'maintenance',
      details: `Logged maintenance for asset ${req.params.assetId}`,
      timestamp: now,
      organization_id: user.organizationId,
    });

    res.status(201).json({ maintenance: data });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
