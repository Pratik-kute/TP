import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';

const router = Router();

router.get('/', async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  try {
    const { error } = await db.from('organizations').select('id', { count: 'exact', head: true }).limit(1);
    dbOk = !error;
  } catch { /* dbOk stays false */ }
  res.json({
    ok: true,
    service: '1xl-asset-tracker-api',
    env: config.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    db: { ok: dbOk, latencyMs: Date.now() - start },
    minAppVersion: { ios: '1.0.0', android: '1.0.0' }, // Section 10.2
    maintenanceMessage: null,
  });
});

export default router;
