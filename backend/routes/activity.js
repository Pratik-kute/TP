const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser, pageParams } = require('./_helpers');

const router = express.Router();

function moduleName(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('repair')) return 'repairs';
  if (raw.includes('maintenance')) return 'maintenance';
  if (raw.includes('recovery')) return 'recovery';
  if (raw.includes('audit')) return 'audits';
  if (raw.includes('photo')) return 'photos';
  if (raw.includes('allocation')) return 'allocations';
  return 'assets';
}

router.get('/', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const { limit, from, to } = pageParams(req);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', user.organizationId)
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (req.query.assetId) {
      query = query.eq('entity_id', req.query.assetId);
    }
    if (req.query.q) {
      const q = String(req.query.q).replace(/[%,]/g, '');
      query = query.or(`user_name.ilike.%${q}%,action.ilike.%${q}%,module.ilike.%${q}%,details.ilike.%${q}%`);
    }
    if (req.query.module) {
      query = query.ilike('module', `%${req.query.module}%`);
    }

    const [{ data, count, error: logErr }, { count: todayCount }, { data: activeUsers }] =
      await Promise.all([
        query.limit(limit),
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', user.organizationId)
          .gte('timestamp', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase
          .from('audit_logs')
          .select('user_id')
          .eq('organization_id', user.organizationId)
          .limit(500),
      ]);

    if (logErr) throw logErr;

    res.json({
      items: (data || []).map((row) => ({
        id: row.id,
        action: row.action,
        module: moduleName(row.module),
        description: row.details || row.action,
        summary: row.details || row.action,
        assetId: row.entity_id,
        userId: row.user_id,
        userName: row.user_name || 'User',
        createdAt: row.timestamp,
      })),
      total: count || 0,
      todayCount: todayCount || 0,
      activeUsers: new Set((activeUsers || []).map((row) => row.user_id).filter(Boolean)).size,
    });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
