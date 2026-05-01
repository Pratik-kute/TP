import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { Errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { mobileAuth, requireScope } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { SCOPES } from '../lib/scopes.js';
import { getActor } from '../lib/actor.js';
import { objectToCamel } from '../lib/caseMapper.js';

const router = Router();
router.use(...mobileAuth);

const UUID = z.string().uuid();

// ── GET /assets/:assetId/maintenance ───────────────────────────────────────
router.get(
  '/assets/:assetId/maintenance',
  requireScope(SCOPES.MAINT_READ),
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');

    const { data: asset } = await db.from('assets')
      .select('id, organization_id').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    const { data, error } = await db
      .from('maintenance')
      .select('*')
      .eq('asset_id', assetId)
      .eq('organization_id', orgId)
      .order('scheduled_date', { ascending: false })
      .limit(100);
    if (error) throw Errors.internal('Maintenance lookup failed');

    res.json({ items: (data ?? []).map(objectToCamel), total: data?.length ?? 0 });
  }),
);

// ── GET /maintenance/task-types ────────────────────────────────────────────
const TASK_TYPES = [
  { id: 'preventive_inspection', label: 'Preventive Inspection', defaultType: 'preventive' as const },
  { id: 'cleaning',              label: 'Cleaning',              defaultType: 'preventive' as const },
  { id: 'firmware_update',       label: 'Firmware/Software Update', defaultType: 'preventive' as const },
  { id: 'lubrication',           label: 'Lubrication',           defaultType: 'preventive' as const },
  { id: 'calibration',           label: 'Calibration',           defaultType: 'preventive' as const },
  { id: 'replacement',           label: 'Part Replacement',      defaultType: 'corrective' as const },
  { id: 'corrective_other',      label: 'Corrective — Other',    defaultType: 'corrective' as const },
];

router.get(
  '/maintenance/task-types',
  requireScope(SCOPES.MAINT_READ),
  asyncHandler(async (_req, res) => {
    res.json({ items: TASK_TYPES });
  }),
);

// ── POST /assets/:assetId/maintenance ──────────────────────────────────────
const CreateBody = z.object({
  taskTypeId:    z.string().min(1).max(64),
  type:          z.enum(['preventive', 'corrective']),
  scheduledDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  technicianId:  z.string().uuid().nullable().optional(),
  cost:          z.number().min(0).max(10_000_000).optional(),
  notes:         z.string().max(2000).default(''),
  checklist:     z.array(z.string().max(200)).max(50).default([]),
  status:        z.enum(['scheduled', 'in_progress', 'completed', 'overdue', 'cancelled']).default('completed'),
});

router.post(
  '/assets/:assetId/maintenance',
  requireScope(SCOPES.MAINT_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(CreateBody, req.body);

    const { data: asset } = await db.from('assets')
      .select('id, organization_id').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    if (body.technicianId) {
      const { data: tech } = await db.from('users')
        .select('id, organization_id, role')
        .eq('id', body.technicianId).maybeSingle();
      if (!tech || tech.organization_id !== orgId) {
        throw Errors.validation('technicianId does not belong to this organization');
      }
    }

    const row = {
      asset_id:       assetId,
      organization_id: orgId,
      scheduled_date: body.scheduledDate ?? new Date().toISOString(),
      completed_date: body.completedDate ?? (body.status === 'completed' ? new Date().toISOString() : null),
      technician_id:  body.technicianId ?? actor.userId,
      status:         body.status,
      type:           body.type,
      cost:           body.cost ?? 0,
      notes:          [`[task:${body.taskTypeId}]`, body.notes].filter(Boolean).join(' ').trim(),
      checklist:      body.checklist,
    };

    const { data: created, error: insErr } = await db
      .from('maintenance').insert(row).select().single();
    if (insErr) throw Errors.internal('Could not create maintenance record');

    // Mirror to audit_logs for activity feed.
    await db.from('audit_logs').insert({
      user_id:        actor.userId,
      user_name:      actor.displayName,
      action:         'create',
      module:         'maintenance',
      entity_id:      created.id,
      entity_type:    'maintenance',
      details:        `Logged ${body.type} maintenance via API (${body.taskTypeId})`,
      timestamp:      new Date().toISOString(),
      organization_id: orgId,
    });

    res.status(201).json({ maintenance: objectToCamel(created) });
  }),
);

export default router;
