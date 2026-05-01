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

const RecoveryBody = z.object({
  incidentType:  z.enum(['lost', 'damaged', 'stolen', 'insurance_claim', 'write_off']),
  severity:      z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description:   z.string().min(3).max(2000),
  estimatedLoss: z.number().min(0).max(100_000_000).default(0),
  incidentDate:  z.string().datetime().optional(),
  /**
   * If `markAssetDead` is true, also flips the asset to status='dead'.
   * Mobile sets this for stolen/lost/write_off cases. Atomic per TRD 5.16.
   */
  markAssetDead: z.boolean().default(false),
});

router.post(
  '/assets/:assetId/recovery',
  requireScope(SCOPES.RECOVERY_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(RecoveryBody, req.body);

    const { data: asset } = await db
      .from('assets').select('id, organization_id, status, name').eq('id', assetId).maybeSingle();
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();
    if (asset.status === 'dead' || asset.status === 'disposed') {
      throw Errors.conflict(`Asset already ${asset.status} — cannot file recovery`);
    }

    const recoveryRow = {
      asset_id:        assetId,
      organization_id: orgId,
      reported_by:     actor.userId,
      incident_type:   body.incidentType,
      status:          'reported' as const,
      severity:        body.severity,
      description:     body.description,
      resolution:      '',
      estimated_loss:  body.estimatedLoss,
      recovered_amount: 0,
      incident_date:   body.incidentDate ?? new Date().toISOString(),
      resolved_date:   null,
      resolved_by:     null,
    };

    const { data: created, error: insErr } = await db
      .from('recoveries').insert(recoveryRow).select().single();
    if (insErr) throw Errors.internal('Could not file recovery');

    let updatedAsset: any = null;
    if (body.markAssetDead) {
      const { data: upd, error: updErr } = await db
        .from('assets')
        .update({ status: 'dead', updated_at: new Date().toISOString() })
        .eq('id', assetId)
        .select().single();
      if (updErr) {
        // Best-effort rollback to keep the operation atomic from the caller's POV.
        await db.from('recoveries').delete().eq('id', created.id);
        throw Errors.internal('Could not mark asset dead — recovery rolled back');
      }
      updatedAsset = upd;
    }

    await db.from('audit_logs').insert({
      user_id:        actor.userId,
      user_name:      actor.displayName,
      action:         'create',
      module:         'recovery',
      entity_id:      created.id,
      entity_type:    'recovery',
      details:        `${body.incidentType} reported for ${asset.name}${body.markAssetDead ? ' (asset marked dead)' : ''}`,
      timestamp:      new Date().toISOString(),
      organization_id: orgId,
    });

    res.status(201).json({
      recovery: objectToCamel(created),
      asset: updatedAsset ? objectToCamel(updatedAsset) : null,
    });
  }),
);

export default router;
