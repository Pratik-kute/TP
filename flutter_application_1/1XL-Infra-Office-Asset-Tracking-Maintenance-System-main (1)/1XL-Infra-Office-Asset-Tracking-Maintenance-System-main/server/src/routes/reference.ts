import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { mobileAuth, requireScope } from '../middleware/auth.js';
import { SCOPES } from '../lib/scopes.js';
import { getActor } from '../lib/actor.js';

const router = Router();
router.use(...mobileAuth);

const ListQuery = z.object({
  q:      z.string().max(120).optional(),
  limit:  z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});

// ── GET /reference/users ───────────────────────────────────────────────────
router.get(
  '/users',
  requireScope(SCOPES.REFERENCE_READ),
  asyncHandler(async (req, res) => {
    const orgId = getActor(req).organizationId;
    const q = validate(ListQuery, req.query);

    let query = db
      .from('users')
      .select('id, name, email, role, department_id, phone, avatar, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(q.limit);

    if (q.q) {
      const term = `%${q.q.replace(/[%_]/g, '')}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw Errors.internal('User list failed');

    res.json({
      items: (data ?? []).map(u => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        departmentId: u.department_id, phone: u.phone, avatar: u.avatar,
      })),
      total: data?.length ?? 0,
    });
  }),
);

// ── GET /reference/locations ───────────────────────────────────────────────
router.get(
  '/locations',
  requireScope(SCOPES.REFERENCE_READ),
  asyncHandler(async (req, res) => {
    const orgId = getActor(req).organizationId;
    const q = validate(ListQuery, req.query);

    let query = db
      .from('locations')
      .select('id, name, address, city, state, country, floor_no, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(q.limit);

    if (q.q) {
      const term = `%${q.q.replace(/[%_]/g, '')}%`;
      query = query.or(`name.ilike.${term},city.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw Errors.internal('Location list failed');

    res.json({
      items: (data ?? []).map(l => ({
        id: l.id, name: l.name, address: l.address, city: l.city,
        state: l.state, country: l.country, floorNo: l.floor_no,
      })),
      total: data?.length ?? 0,
    });
  }),
);

export default router;
