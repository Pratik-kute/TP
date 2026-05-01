const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const router = express.Router();

function extractOrgId(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.organizationId;
  } catch (err) {
    return null;
  }
}

// GET /api/v1/reference/users
router.get('/users', async (req, res) => {
  try {
    const organizationId = extractOrgId(req);
    if (organizationId === undefined) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });

    const { q } = req.query;
    let query = supabase
      .from('users')
      .select('id, name, email, role, department_id, phone, avatar', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return res.json({
      items: (data || []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        departmentId: u.department_id,
        phone: u.phone || '',
        avatar: u.avatar
      })),
      total: count || 0
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/v1/reference/locations
router.get('/locations', async (req, res) => {
  try {
    const organizationId = extractOrgId(req);
    if (organizationId === undefined) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });

    const { q } = req.query;
    let query = supabase
      .from('locations')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return res.json({
      items: (data || []).map(l => ({
        id: l.id,
        name: l.name
      })),
      total: count || 0
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

module.exports = router;
