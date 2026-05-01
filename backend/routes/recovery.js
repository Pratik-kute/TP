const express = require('express');
const supabase = require('../config/supabase');
const { error, requireUser } = require('./_helpers');

const router = express.Router();

router.post('/assets/:assetId/recovery', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    const incidentType = req.body.incidentType || 'lost';
    const description = req.body.description || req.body.notes || 'Recovery incident reported from mobile.';

    const { data: recovery, error: recErr } = await supabase
      .from('recoveries')
      .insert({
        asset_id: req.params.assetId,
        organization_id: user.organizationId,
        incident_type: incidentType,
        severity: req.body.severity || 'medium',
        description,
        estimated_loss: Number(req.body.estimatedLoss || 0),
        incident_date: req.body.incidentDate || new Date().toISOString(),
        status: 'reported',
      })
      .select()
      .single();
    if (recErr) throw recErr;

    let asset = null;
    if (req.body.markAssetDead === true) {
      const { data } = await supabase
        .from('assets')
        .update({ status: 'dead', updated_at: new Date().toISOString() })
        .eq('id', req.params.assetId)
        .eq('organization_id', user.organizationId)
        .select()
        .maybeSingle();
      asset = data;
    }

    res.status(201).json({ recovery, asset });
  } catch (err) {
    error(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
