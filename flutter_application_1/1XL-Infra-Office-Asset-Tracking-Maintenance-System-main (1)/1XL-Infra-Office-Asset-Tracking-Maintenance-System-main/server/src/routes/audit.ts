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

async function getActiveCycle(orgId: string) {
  const { data } = await db
    .from('audit_cycles')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getCurrentAssignee(assetId: string): Promise<string | null> {
  const { data } = await db
    .from('allocations')
    .select('employee_id')
    .eq('asset_id', assetId)
    .in('status', ['active', 'approved'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.employee_id ?? null;
}

// ── POST /assets/:assetId/audit/verify ─────────────────────────────────────
const VerifyBody = z.object({
  cycleId:           z.string().uuid().optional(),
  actualLocationId:  z.string().uuid().nullable().optional(),
  actualAssigneeId:  z.string().uuid().nullable().optional(),
  notes:             z.string().max(1000).optional(),
  geoLat:            z.number().min(-90).max(90).optional(),
  geoLng:            z.number().min(-180).max(180).optional(),
});

router.post(
  '/assets/:assetId/audit/verify',
  requireScope(SCOPES.AUDIT_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(VerifyBody, req.body);

    const { data: asset } = await db
      .from('assets').select('*').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    let cycle: any = null;
    if (body.cycleId) {
      const { data } = await db.from('audit_cycles').select('*').eq('id', body.cycleId).maybeSingle();
      if (!data || data.organization_id !== orgId) throw Errors.cycleNotFound();
      if (data.status !== 'active') throw Errors.conflict('Audit cycle is not active');
      cycle = data;
    } else {
      cycle = await getActiveCycle(orgId);
      if (!cycle) throw Errors.cycleNotFound();
    }

    const expectedAssignee = await getCurrentAssignee(assetId);

    const row = {
      cycle_id:             cycle.id,
      asset_id:             assetId,
      organization_id:      orgId,
      verifier_id:          actor.userId,
      result:               'verified' as const,
      expected_location_id: asset.location_id ?? null,
      actual_location_id:   body.actualLocationId ?? asset.location_id ?? null,
      expected_assignee_id: expectedAssignee,
      actual_assignee_id:   body.actualAssigneeId ?? expectedAssignee,
      flag_reason:          null,
      notes:                body.notes ?? null,
      geo_lat:              body.geoLat ?? null,
      geo_lng:              body.geoLng ?? null,
    };

    // Upsert by (cycle_id, asset_id) — last write wins.
    const { data: existing } = await db
      .from('audit_verifications')
      .select('id').eq('cycle_id', cycle.id).eq('asset_id', assetId).maybeSingle();

    let saved: any;
    if (existing) {
      const { data: upd, error: updErr } = await db
        .from('audit_verifications')
        .update({ ...row, created_at: new Date().toISOString() })
        .eq('id', existing.id).select().single();
      if (updErr) throw Errors.internal('Could not update verification');
      saved = upd;
    } else {
      const { data: ins, error: insErr } = await db
        .from('audit_verifications').insert(row).select().single();
      if (insErr) throw Errors.internal('Could not insert verification');
      saved = ins;
    }

    res.status(201).json({ verification: objectToCamel(saved) });
  }),
);

// ── POST /assets/:assetId/audit/flag ───────────────────────────────────────
const FlagBody = z.object({
  cycleId:           z.string().uuid().optional(),
  flagReason:        z.enum(['wrong_location', 'wrong_assignee', 'damaged', 'missing', 'other']),
  actualLocationId:  z.string().uuid().nullable().optional(),
  actualAssigneeId:  z.string().uuid().nullable().optional(),
  notes:             z.string().min(3).max(1000),
  geoLat:            z.number().min(-90).max(90).optional(),
  geoLng:            z.number().min(-180).max(180).optional(),
});

router.post(
  '/assets/:assetId/audit/flag',
  requireScope(SCOPES.AUDIT_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(FlagBody, req.body);

    const { data: asset } = await db
      .from('assets').select('*').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    let cycle: any = null;
    if (body.cycleId) {
      const { data } = await db.from('audit_cycles').select('*').eq('id', body.cycleId).maybeSingle();
      if (!data || data.organization_id !== orgId) throw Errors.cycleNotFound();
      if (data.status !== 'active') throw Errors.conflict('Audit cycle is not active');
      cycle = data;
    } else {
      cycle = await getActiveCycle(orgId);
      if (!cycle) throw Errors.cycleNotFound();
    }

    const expectedAssignee = await getCurrentAssignee(assetId);

    const row = {
      cycle_id:             cycle.id,
      asset_id:             assetId,
      organization_id:      orgId,
      verifier_id:          actor.userId,
      result:               'flagged' as const,
      expected_location_id: asset.location_id ?? null,
      actual_location_id:   body.actualLocationId ?? null,
      expected_assignee_id: expectedAssignee,
      actual_assignee_id:   body.actualAssigneeId ?? null,
      flag_reason:          body.flagReason,
      notes:                body.notes,
      geo_lat:              body.geoLat ?? null,
      geo_lng:              body.geoLng ?? null,
    };

    const { data: existing } = await db
      .from('audit_verifications')
      .select('id').eq('cycle_id', cycle.id).eq('asset_id', assetId).maybeSingle();

    let saved: any;
    if (existing) {
      const { data: upd, error: updErr } = await db
        .from('audit_verifications')
        .update({ ...row, created_at: new Date().toISOString() })
        .eq('id', existing.id).select().single();
      if (updErr) throw Errors.internal('Could not update flag');
      saved = upd;
    } else {
      const { data: ins, error: insErr } = await db
        .from('audit_verifications').insert(row).select().single();
      if (insErr) throw Errors.internal('Could not insert flag');
      saved = ins;
    }

    await db.from('audit_logs').insert({
      user_id:        actor.userId,
      user_name:      actor.displayName,
      action:         'flag',
      module:         'audits',
      entity_id:      saved.id,
      entity_type:    'audit_verification',
      details:        `Flagged ${asset.name}: ${body.flagReason}`,
      timestamp:      new Date().toISOString(),
      organization_id: orgId,
    });

    res.status(201).json({ verification: objectToCamel(saved) });
  }),
);

export default router;
