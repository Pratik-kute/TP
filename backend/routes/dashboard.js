const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser } = require('./_helpers');

const router = express.Router();

router.get('/stats', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const orgId = user.organizationId;
    const [
      { count: totalAssets },
      { count: allocatedAssets },
      { count: sharedAssets },
      { count: maintenanceAssets },
      { count: totalMaintenance },
      { count: completedMaintenance },
      { count: activeRepairs },
      { count: activeUsers },
    ] = await Promise.all([
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'allocated'),
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'in_use'),
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'under_maintenance'),
      supabase.from('maintenance').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('maintenance').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'completed'),
      supabase.from('repairs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '("completed","cancelled")'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
    ]);

    const total = totalAssets || 0;
    const used = (allocatedAssets || 0) + (sharedAssets || 0) + (maintenanceAssets || 0);
    const maintenanceTotal = totalMaintenance || 0;

    res.json({
      totalAssets: total,
      utilization: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      compliance: maintenanceTotal > 0
        ? Math.round(((completedMaintenance || 0) / maintenanceTotal) * 1000) / 10
        : 0,
      activeRepairs: activeRepairs || 0,
      activeUsers: activeUsers || 0,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
