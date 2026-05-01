import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { Errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { mobileAuth, requireScope } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { SCOPES } from '../lib/scopes.js';
import { serializeAssetForMobile } from '../lib/assetSerializer.js';
import { getActor } from '../lib/actor.js';

const router = Router();

// All asset routes require API key + rate limit + user JWT.
router.use(...mobileAuth);

// ── helpers ────────────────────────────────────────────────────────────────
const UUID = z.string().uuid();

/**
 * QR-payload parser. Mobile may scan one of:
 *   - bare asset id  (UUID)
 *   - bare asset tag (e.g. "LAP-1XL-01-001")
 *   - URL of the form `https://<host>/<orgSlug>/scan/<assetId>` or `/asset/<assetId>`
 * Returns either an `id` or a `tag` to look up.
 */
function parseQrPayload(raw: string): { id?: string; tag?: string } {
  const trimmed = raw.trim();
  if (!trimmed) throw Errors.invalidQr('Empty QR payload');

  // URL? extract the last path segment after /asset/ or /scan/
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const m = u.pathname.match(/\/(?:asset|scan)\/([^\/?#]+)/);
      if (m) return UUID.safeParse(m[1]).success ? { id: m[1] } : { tag: decodeURIComponent(m[1]) };
    } catch {/* fall through */}
  }

  if (UUID.safeParse(trimmed).success) return { id: trimmed };

  // asset tag — accept ASCII letters, digits, dashes, underscores, dots
  if (/^[A-Za-z0-9._\-]{2,64}$/.test(trimmed)) return { tag: trimmed.toUpperCase() };

  throw Errors.invalidQr('QR payload did not match a known format');
}

// ── POST /assets/lookup-by-qr ──────────────────────────────────────────────
const QrBody = z.object({
  qrPayload: z.string().min(1).max(500),
  geoLat:    z.number().min(-90).max(90).optional(),
  geoLng:    z.number().min(-180).max(180).optional(),
});

router.post(
  '/lookup-by-qr',
  requireScope(SCOPES.ASSETS_READ),
  asyncHandler(async (req, res) => {
    const body = validate(QrBody, req.body);
    const actor = getActor(req);
    const ref = parseQrPayload(body.qrPayload);

    let q = db.from('assets').select('*').eq('organization_id', actor.organizationId).limit(1);
    q = ref.id ? q.eq('id', ref.id) : q.eq('asset_tag', ref.tag!);
    const { data, error } = await q.maybeSingle();
    if (error) throw Errors.internal('Asset lookup failed');
    if (!data) throw Errors.assetNotFound();

    const envelope = await serializeAssetForMobile(data, actor.asUser());
    res.json(envelope);
  }),
);

// ── GET /assets/:assetId ───────────────────────────────────────────────────
router.get(
  '/:assetId',
  requireScope(SCOPES.ASSETS_READ),
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const id = validate(UUID, req.params.assetId, 'assetId');

    const { data, error } = await db
      .from('assets').select('*').eq('id', id).eq('organization_id', actor.organizationId).maybeSingle();
    if (error) throw Errors.internal('Asset lookup failed');
    if (!data) throw Errors.assetNotFound();

    const envelope = await serializeAssetForMobile(data, actor.asUser());
    res.json(envelope);
  }),
);

// ── POST /assets/:assetId/photos/upload-url ────────────────────────────────
const UploadUrlBody = z.object({
  filename:  z.string().min(1).max(200),
  mimeType:  z.string().regex(/^image\/(jpe?g|png|webp|heic|heif)$/i, 'mimeType must be JPEG/PNG/WebP/HEIC'),
  sizeBytes: z.number().int().positive(),
  caption:   z.string().max(500).optional(),
});

router.post(
  '/:assetId/photos/upload-url',
  requireScope(SCOPES.PHOTOS_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const body    = validate(UploadUrlBody, req.body);

    if (body.sizeBytes > config.PHOTO_MAX_BYTES) {
      throw Errors.validation(`Photo exceeds ${config.PHOTO_MAX_BYTES} bytes`);
    }

    const { data: asset, error: assetErr } = await db
      .from('assets').select('id, organization_id').eq('id', assetId).maybeSingle();
    if (assetErr) throw Errors.internal('Asset lookup failed');
    if (!asset || asset.organization_id !== orgId) throw Errors.assetNotFound();

    const ext = (body.filename.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const photoId = crypto.randomUUID();
    const path = `${orgId}/${assetId}/${photoId}.${ext}`;

    // Pre-create a 'pending' photo row so finalize can flip it to 'active'.
    const { error: insErr } = await db.from('asset_photos').insert({
      id: photoId,
      asset_id: assetId,
      organization_id: orgId,
      url: null,
      storage_path: path,
      mime_type: body.mimeType,
      size_bytes: body.sizeBytes,
      uploaded_by: actor.userId,
      caption: body.caption ?? null,
      status: 'pending',
    });
    if (insErr) throw Errors.internal('Could not record pending photo');

    const { data: signed, error: signErr } = await db.storage
      .from(config.PHOTO_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signErr || !signed) throw Errors.internal('Could not create signed upload URL');

    res.json({
      photoId,
      uploadUrl:    signed.signedUrl,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'content-type': body.mimeType,
        'x-upsert':     'false',
      },
      storagePath:  path,
      bucket:       config.PHOTO_BUCKET,
      expiresInSeconds: config.PHOTO_PRESIGNED_TTL_SECONDS,
      maxSizeBytes: config.PHOTO_MAX_BYTES,
    });
  }),
);

// ── POST /assets/:assetId/photos/:photoId/finalize ─────────────────────────
const FinalizeBody = z.object({
  caption: z.string().max(500).optional(),
});

router.post(
  '/:assetId/photos/:photoId/finalize',
  requireScope(SCOPES.PHOTOS_WRITE),
  idempotency,
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const orgId = actor.organizationId;
    const assetId = validate(UUID, req.params.assetId, 'assetId');
    const photoId = validate(UUID, req.params.photoId, 'photoId');
    const body    = validate(FinalizeBody, req.body);

    const { data: photo } = await db
      .from('asset_photos').select('*').eq('id', photoId).maybeSingle();
    if (!photo || photo.organization_id !== orgId || photo.asset_id !== assetId) {
      throw Errors.photoNotFound();
    }
    if (photo.status === 'active') {
      // Idempotent — already finalized.
      res.json({
        photo: {
          id: photo.id, url: photo.url, caption: photo.caption,
          mimeType: photo.mime_type, sizeBytes: photo.size_bytes,
          createdAt: photo.created_at, finalizedAt: photo.finalized_at,
        },
      });
      return;
    }

    // Verify the object was actually uploaded to storage.
    const folder = photo.storage_path.split('/').slice(0, -1).join('/');
    const filename = photo.storage_path.split('/').pop()!;
    const { data: listed } = await db.storage.from(config.PHOTO_BUCKET).list(folder, { search: filename });
    const exists = !!listed?.find(o => o.name === filename);
    if (!exists) throw Errors.validation('Object not found in storage — was the upload completed?');

    const { data: pub } = db.storage.from(config.PHOTO_BUCKET).getPublicUrl(photo.storage_path);
    const url = pub.publicUrl;

    const { data: updated, error: updErr } = await db
      .from('asset_photos')
      .update({
        status: 'active',
        url,
        caption: body.caption ?? photo.caption,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', photoId)
      .select()
      .single();
    if (updErr) throw Errors.internal('Could not finalize photo');

    // Append to assets.image_urls so the photo shows up in the web UI too.
    const { data: assetRow } = await db.from('assets').select('image_urls, image_url').eq('id', assetId).maybeSingle();
    if (assetRow) {
      const existing: string[] = Array.isArray(assetRow.image_urls) ? assetRow.image_urls : [];
      const next = [...existing, url];
      await db.from('assets').update({
        image_urls: next,
        image_url: assetRow.image_url ?? url,
        updated_at: new Date().toISOString(),
      }).eq('id', assetId);
    }

    res.json({
      photo: {
        id: updated.id, url: updated.url, caption: updated.caption,
        mimeType: updated.mime_type, sizeBytes: updated.size_bytes,
        createdAt: updated.created_at, finalizedAt: updated.finalized_at,
      },
    });
  }),
);

export default router;
