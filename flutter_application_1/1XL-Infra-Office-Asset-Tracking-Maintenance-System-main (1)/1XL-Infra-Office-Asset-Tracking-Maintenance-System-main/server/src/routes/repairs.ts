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
const REPAIR_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;

// ── GET /assets/:assetId/repairs ───────────────────────────────────────────
router.get(
  '/assets/:assetId/repairs',
  requireScope(SCOPES.REPAIRS_READ),
  asyncHandler(async (req, res) => {
    const orgId = getActor(req).organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');

    const { data: asset } = await db.from('assets')
      .select('id, organization_id').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    const { data, error } = await db
      .from('repairs')
      .select('*')
      .eq('asset_id', assetId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw Errors.internal('Repair list lookup failed');

    res.json({ items: (data ?? []).map(objectToCamel), total: data?.length ?? 0 });
  }),
);

// ── GET /repairs/:repairId ─────────────────────────────────────────────────
router.get(
  '/repairs/:repairId',
  requireScope(SCOPES.REPAIRS_READ),
  asyncHandler(async (req, res) => {
    const orgId = getActor(req).organizationId;
    const repairId = validate(UUID, req.params.repairId, 'repairId');

    const { data: repair, error } = await db
      .from('repairs').select('*').eq('id', repairId).maybeSingle();
    if (error) throw Errors.internal('Repair lookup failed');
    if (!repair || repair.organization_id !== orgId) throw Errors.repairNotFound();

    const [{ data: updates }, { data: vendor }] = await Promise.all([
      db.from('repair_updates')
        .select('*').eq('repair_id', repairId)
        .order('created_at', { ascending: true }),
      repair.vendor_id
        ? db.from('vendors').select('id, name, contact_person, phone').eq('id', repair.vendor_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    res.json({
      repair: objectToCamel(repair),
      vendor: vendor ? {
        id: vendor.id, name: vendor.name,
        contactPerson: vendor.contact_person, phone: vendor.phone,
      } : null,
      updates: (updates ?? []).map(objectToCamel),
    });
  }),
);

// ── POST /assets/:assetId/repairs ──────────────────────────────────────────
const CreateBody = z.object({
  issue:       z.string().min(3).max(2000),
  priority:    z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  vendorId:    z.string().uuid().nullable().optional(),
  technicianId: z.string().uuid().nullable().optional(),
  partsUsed:   z.string().max(500).optional(),
  notes:       z.string().max(2000).optional(),
});

router.post(
  '/assets/:assetId/repairs',
  requireScope(SCOPES.REPAIRS_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(CreateBody, req.body);

    const { data: asset } = await db.from('assets')
      .select('id, organization_id, status').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    const row = {
      asset_id:       assetId,
      organization_id: orgId,
      vendor_id:      body.vendorId ?? null,
      technician_id:  body.technicianId ?? null,
      issue:          body.issue,
      status:         body.technicianId ? 'assigned' : 'pending',
      priority:       body.priority,
      cost:           0,
      parts_used:     body.partsUsed ?? '',
      labor_hours:    0,
      completion_date: null,
      notes:          body.notes ?? '',
    };

    const { data: created, error: insErr } = await db
      .from('repairs').insert(row).select().single();
    if (insErr) throw Errors.internal('Could not create repair ticket');

    // Initial update entry so the audit trail starts on creation.
    await db.from('repair_updates').insert({
      repair_id:       created.id,
      organization_id: orgId,
      author_id:       actor.userId,
      author_name:     actor.displayName,
      status_from:     null,
      status_to:       created.status,
      note:            'Repair raised via API',
    });

    await db.from('audit_logs').insert({
      user_id:        actor.userId,
      user_name:      actor.displayName,
      action:         'create',
      module:         'repairs',
      entity_id:      created.id,
      entity_type:    'repair',
      details:        `Raised repair: ${body.issue.slice(0, 80)}`,
      timestamp:      new Date().toISOString(),
      organization_id: orgId,
    });

    res.status(201).json({ repair: objectToCamel(created) });
  }),
);

// ── POST /repairs/:repairId/updates ────────────────────────────────────────
const UpdateBody = z.object({
  statusTo:    z.enum(REPAIR_STATUSES).optional(),
  note:        z.string().min(1).max(2000),
  partsUsed:   z.string().max(500).optional(),
  laborHours:  z.number().min(0).max(10_000).optional(),
  cost:        z.number().min(0).max(10_000_000).optional(),
});

router.post(
  '/repairs/:repairId/updates',
  requireScope(SCOPES.REPAIRS_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const repairId = validate(UUID, req.params.repairId, 'repairId');
    const body     = validate(UpdateBody, req.body);

    const { data: repair } = await db
      .from('repairs').select('*').eq('id', repairId).maybeSingle();
    if (!repair || repair.organization_id !== orgId) throw Errors.repairNotFound();

    const oldStatus = repair.status;
    const newStatus = body.statusTo ?? oldStatus;

    const patch: Record<string, unknown> = {};
    if (body.statusTo)  patch.status        = body.statusTo;
    if (body.partsUsed !== undefined)  patch.parts_used  = body.partsUsed;
    if (body.laborHours !== undefined) patch.labor_hours = body.laborHours;
    if (body.cost !== undefined)       patch.cost        = body.cost;
    if (body.statusTo === 'completed') patch.completion_date = new Date().toISOString();

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await db.from('repairs').update(patch).eq('id', repairId);
      if (updErr) throw Errors.internal('Could not update repair');
    }

    const { data: updateRow, error: insErr } = await db
      .from('repair_updates')
      .insert({
        repair_id:       repairId,
        organization_id: orgId,
        author_id:       actor.userId,
        author_name:     actor.displayName,
        status_from:     oldStatus,
        status_to:       newStatus,
        note:            body.note,
      })
      .select().single();
    if (insErr) throw Errors.internal('Could not record repair update');

    await db.from('audit_logs').insert({
      user_id:        actor.userId,
      user_name:      actor.displayName,
      action:         'update',
      module:         'repairs',
      entity_id:      repairId,
      entity_type:    'repair',
      details:        `${oldStatus} → ${newStatus}: ${body.note.slice(0, 80)}`,
      timestamp:      new Date().toISOString(),
      organization_id: orgId,
    });

    res.status(201).json({ update: objectToCamel(updateRow) });
  }),
);

export default router;
