# Asset Tracker — API Reference

Complete reference for every endpoint. The OpenAPI 3.1 spec is at
[`openapi.yaml`](./openapi.yaml). The printable version (cover page, TOC,
syntax-coloured code blocks) is at [`Asset-Tracker-API-Reference.pdf`](./Asset-Tracker-API-Reference.pdf).

> **Source of truth.** When this doc and the spec disagree, the spec wins.

---

## Conventions

- **Wire format:** JSON, `camelCase`. Database is `snake_case` — server translates.
- **Timestamps:** ISO 8601 with timezone (`2026-04-29T11:32:18.412Z`).
- **Dates:** `YYYY-MM-DD`.
- **IDs:** UUID v4.
- **Money:** `number`. Currency from `organization.currency`.
- **Null fields are explicit** — `null`, never omitted.
- **Base URL:** `https://asset.thebizzfly.com` (prod) / `http://localhost:4000` (dev).
- **All paths below are prefixed with `/api/v1`** unless under `/health` or `/api/v1/admin/*`.

---

## Authentication

All requests use the standard **Bearer** scheme:

```
Authorization: Bearer <token>
```

There are two kinds of bearer token; the server tells them apart by their shape, so the same header carries either:

| Kind | Format | Issued by | Lifetime |
|---|---|---|---|
| **API key** | `<orgslug>_<live\|test>_<24chars>` | Org admin in the web UI | Indefinite, or `expires_at` |
| **Access JWT** | Standard HS256 JWT | `POST /auth/login` | 30 minutes |

### Which token to send

| Endpoint group | Send |
|---|---|
| `POST /auth/login`, `/refresh`, `/logout` | API key only |
| `GET /auth/me` | User JWT only |
| All other endpoints | Either — JWT for user-scoped, API key for server-to-server |
| `GET /health` | No auth |

### API key format

```
1xl_live_K8j3pQrX9bR2sN7wHzVc1qLm
demo_test_K8j3pQrX9bR2sN7wHzVc1qLm
acmecorp_live_K8j3pQrX9bR2sN7wHzVc
```

The prefix is your organization's `short_name` (lowercased, alphanumeric, max 16 chars). The env tag is `live` in production, `test` elsewhere. Full secret shown **only once** on creation; the DB stores a bcrypt hash.

### Refresh-token rotation

`POST /auth/refresh` returns a **new** refresh token AND revokes the old one. Clients must overwrite the stored value immediately.

**Reuse detection.** If a revoked refresh token is presented again, the server revokes **every** active refresh token for that user. This protects against stolen refresh tokens.

---

## Common headers

| Header | Direction | Notes |
|---|---|---|
| `Authorization` | Request | `Bearer <token>` — required (except `/health`) |
| `X-Request-Id` | Request + Response | Optional client id (`A-Z a-z 0-9 . _ : -`, 1–128). Mirrored on response and inside the error envelope. **Always log this.** |
| `Idempotency-Key` | Request | Required-ish for `POST` mutations. See below. |
| `X-RateLimit-Limit` | Response | Per-key limit (req/min) |
| `X-RateLimit-Remaining` | Response | Tokens left in the current window |
| `X-RateLimit-Reset` | Response | Unix epoch when the bucket refills |
| `Retry-After` | Response (429 only) | Seconds to wait |

---

## Error envelope

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found",
    "requestId": "5b1a4d8c-7c80-4f19-a64a-7b9f3a8b2c11",
    "fieldErrors": [
      { "field": "assetId", "message": "Invalid uuid" }
    ],
    "details": null
  }
}
```

`code` is the only field clients should branch on. `requestId` is mirrored in the `X-Request-Id` response header. `fieldErrors` is present for `VALIDATION_FAILED`.

### All error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `INVALID_QR_PAYLOAD` | `qrPayload` didn't parse |
| 401 | `UNAUTHENTICATED` | Missing/bad credentials |
| 401 | `TOKEN_EXPIRED` | Access JWT aged out — call `/auth/refresh` |
| 401 | `INVALID_API_KEY` | API key missing, malformed, expired, or revoked |
| 403 | `FORBIDDEN` | Authenticated but not allowed |
| 403 | `INSUFFICIENT_SCOPE` | API key missing the required scope |
| 404 | `NOT_FOUND` / `ASSET_NOT_FOUND` / `REPAIR_NOT_FOUND` / `PHOTO_NOT_FOUND` / `CYCLE_NOT_FOUND` | Self-explanatory |
| 409 | `CONFLICT` | Idempotency-key reuse with different body, or business-rule conflict |
| 422 | `VALIDATION_FAILED` | Body didn't match schema |
| 429 | `RATE_LIMITED` | Per-key bucket or per-IP login bucket exceeded |
| 500 | `INTERNAL_ERROR` | Server bug. File a ticket with the `requestId`. |

---

## Rate limiting

| Scope | Default | Configurable via |
|---|---|---|
| Per API key, per minute | 120 | `api_keys.rate_limit_per_minute` |
| `POST /auth/login` per IP, per 15 min | 20 | `LOGIN_RATE_LIMIT_PER_15MIN` env |

`Retry-After` is set on every `429`. Never retry sooner than that value.

---

## Idempotency

Every `POST` accepts `Idempotency-Key: <16-128 chars, A-Z a-z 0-9 _ ->`.

| Scenario | Result |
|---|---|
| Key not seen | Handler runs; if 2xx, body is cached for 24 h |
| Key seen, same body | Cached response replayed |
| Key seen, different body | `409 CONFLICT` |
| TTL expired | Treated as not-seen |

Generate the key when the user **commits the action**, not on every retry. `GET` and `DELETE` ignore the header.

---

## Endpoints

### `GET /health`

Public. No auth.

```bash
curl http://localhost:4000/health
```

```json
{
  "ok": true,
  "service": "1xl-asset-tracker-api",
  "env": "development",
  "uptimeSeconds": 142,
  "db": { "ok": true, "latencyMs": 87 },
  "minAppVersion": { "ios": "1.0.0", "android": "1.0.0" },
  "maintenanceMessage": null
}
```

`db.ok` — readiness. `minAppVersion` — drives in-client force-upgrade. `maintenanceMessage` — banner when non-null.

---

### Auth

#### `POST /auth/login`

**Auth:** API key only · **Scope:** `auth:login`

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "email": "alice@1xl.com",
    "password": "supersecret",
    "deviceId": "iPhone-15-Pro-Alice"
  }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Normalised to lowercase |
| `password` | string | yes | 1–200 chars |
| `deviceId` | string | no | 1–128 chars |

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOi...",
  "accessTokenExpiresIn": 1800,
  "refreshToken": "rT8K...",
  "refreshTokenExpiresIn": 2592000,
  "user": {
    "id": "...", "name": "Alice Admin", "email": "alice@1xl.com",
    "role": "admin", "departmentId": null, "phone": "", "avatar": null,
    "isActive": true, "organizationId": "..."
  }
}
```

**Errors:** `401 UNAUTHENTICATED` (wrong creds — same response as wrong email, to prevent enumeration), `403 FORBIDDEN` (cross-org), `429 RATE_LIMITED`.

> Legacy plaintext passwords are bcrypt-hashed on first successful login.

#### `POST /auth/refresh`

**Auth:** API key only · **Scope:** `auth:refresh`

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{ "refreshToken": "'"$REFRESH"'" }'
```

**Response 200:** new `{ accessToken, refreshToken, ...ExpiresIn }`. Overwrite stored values immediately.

#### `POST /auth/logout`

**Auth:** API key only

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{ "refreshToken": "'"$REFRESH"'", "allDevices": false }'
```

`allDevices: true` revokes every active refresh token for the user. Idempotent.

#### `GET /auth/me`

**Auth:** User JWT only · **Scope:** `auth:read`

```bash
curl https://asset.thebizzfly.com/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS"
```

**Response 200:** `{ user, organization }`. `organization` is `null` for super-admins.

---

### Assets

`$TOKEN` below is either an API key or a user JWT.

#### `POST /assets/lookup-by-qr`

**Auth:** Either · **Scope:** `assets:read`

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/assets/lookup-by-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "qrPayload": "LAP-1XL-01-001" }'
```

`qrPayload` accepts a UUID, an asset tag, or a full `/scan/` or `/asset/` URL. Returns the **asset envelope** (see Schemas).

#### `GET /assets/:assetId`

**Auth:** Either · **Scope:** `assets:read`

```bash
curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID \
  -H "Authorization: Bearer $TOKEN"
```

Same envelope shape as lookup.

---

### Photos

Three-step flow: presigned URL → direct PUT to Storage → finalize. Clients are responsible for stripping EXIF/GPS before upload.

#### `POST /assets/:assetId/photos/upload-url`

**Auth:** Either · **Scope:** `photos:write` · **Idempotency-Key recommended**

```bash
curl -X POST \
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/photos/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "filename": "shot.jpg", "mimeType": "image/jpeg", "sizeBytes": 12345 }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `filename` | string | yes | Used for the storage path's extension |
| `mimeType` | string | yes | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` |
| `sizeBytes` | int | yes | Must be ≤ `maxSizeBytes` (10 MB default) |
| `caption` | string | no | Stored on the photo row |

**Response 200:**

```json
{
  "photoId": "9c3a...",
  "uploadUrl": "https://xdtrqkjztgjihtahmbjx.supabase.co/storage/v1/object/...",
  "uploadMethod": "PUT",
  "uploadHeaders": { "content-type": "image/jpeg", "x-upsert": "false" },
  "storagePath": "<org>/<asset>/<photoId>.jpg",
  "bucket": "asset-images",
  "expiresInSeconds": 600,
  "maxSizeBytes": 10485760
}
```

#### Step 2 — direct PUT to Supabase Storage

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  -H "x-upsert: false" \
  --data-binary @./shot.jpg
```

Do **not** include `Authorization` here — the signed URL carries its own token.

#### `POST /assets/:assetId/photos/:photoId/finalize`

**Auth:** Either · **Scope:** `photos:write` · **Idempotency-Key recommended**

```bash
curl -X POST \
  "https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/photos/$PHOTO_ID/finalize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "caption": "Front view after cleaning" }'
```

Returns `{ photo: { ... } }`. Errors: `404 PHOTO_NOT_FOUND`, `422 VALIDATION_FAILED` (object not in storage).

---

### Maintenance

#### `GET /assets/:assetId/maintenance`

**Auth:** Either · **Scope:** `maintenance:read`

```bash
curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/maintenance \
  -H "Authorization: Bearer $TOKEN"
```

Returns `{ items, total }`, newest first, capped at 100.

#### `GET /maintenance/task-types`

**Auth:** Either · **Scope:** `maintenance:read`

Picker source: `preventive_inspection`, `cleaning`, `firmware_update`, `lubrication`, `calibration`, `replacement`, `corrective_other`.

#### `POST /assets/:assetId/maintenance`

**Auth:** Either · **Scope:** `maintenance:write` · **Idempotency-Key recommended**

```bash
curl -X POST \
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/maintenance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "taskTypeId": "cleaning",
    "type": "preventive",
    "notes": "Cleaned vents and screen",
    "checklist": ["Vents cleaned", "Screen wiped"]
  }'
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `taskTypeId` | string | yes | — | Echoed into `notes` as `[task:<id>]` |
| `type` | enum | yes | — | `preventive` / `corrective` |
| `scheduledDate` | datetime | no | now | |
| `completedDate` | datetime | no | now (if completed) | |
| `technicianId` | UUID | no | the caller | Must belong to caller's org |
| `cost` | number | no | 0 | |
| `notes` | string | no | "" | Max 2000 chars |
| `checklist` | string[] | no | [] | Max 50 × 200 chars |
| `status` | enum | no | `completed` | `scheduled` / `in_progress` / `completed` / `overdue` / `cancelled` |

---

### Repairs

#### `GET /assets/:assetId/repairs`

**Auth:** Either · **Scope:** `repairs:read`

```bash
curl https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/repairs \
  -H "Authorization: Bearer $TOKEN"
```

#### `GET /repairs/:repairId`

**Auth:** Either · **Scope:** `repairs:read`

Returns `{ repair, vendor, updates[] }`.

#### `POST /assets/:assetId/repairs`

**Auth:** Either · **Scope:** `repairs:write` · **Idempotency-Key recommended**

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/repairs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "issue": "Battery does not charge past 80%",
    "priority": "medium",
    "notes": "Reproduced 3 times today"
  }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `issue` | string | yes | 3–2000 chars |
| `priority` | enum | no | `low` / `medium` / `high` / `critical` |
| `vendorId` | UUID | no | If set, ticket starts in `assigned` |
| `technicianId` | UUID | no | Same |
| `partsUsed` | string | no | Max 500 chars |
| `notes` | string | no | Max 2000 chars |

#### `POST /repairs/:repairId/updates`

**Auth:** Either · **Scope:** `repairs:write` · **Idempotency-Key recommended**

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/repairs/$REPAIR_ID/updates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "statusTo": "in_progress", "note": "Picked up by IT, diagnosing" }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `statusTo` | enum | no | `pending` / `assigned` / `in_progress` / `completed` / `cancelled` |
| `note` | string | yes | 1–2000 chars |
| `partsUsed` | string | no | Replaces existing |
| `laborHours` | number | no | Replaces existing |
| `cost` | number | no | Replaces existing |

If `statusTo === "completed"`, server stamps `completion_date = now()`.

---

### Recovery

#### `POST /assets/:assetId/recovery`

**Auth:** Either · **Scope:** `recovery:write` · **Idempotency-Key recommended**

Atomically files an incident and (optionally) flips the asset to `dead`.

```bash
curl -X POST https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/recovery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "incidentType": "stolen",
    "severity": "high",
    "description": "Reported missing from desk 4B",
    "estimatedLoss": 1200,
    "markAssetDead": true
  }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `incidentType` | enum | yes | `lost` / `damaged` / `stolen` / `insurance_claim` / `write_off` |
| `severity` | enum | no | `low` / `medium` / `high` / `critical` |
| `description` | string | yes | 3–2000 chars |
| `estimatedLoss` | number | no | Default 0 |
| `incidentDate` | datetime | no | Default now |
| `markAssetDead` | boolean | no | If true, asset.status becomes `dead` |

Returns `{ recovery, asset }`. `asset` is `null` if `markAssetDead` was false. Errors: `409 CONFLICT` if asset already `dead`/`disposed`.

---

### Audit

Both endpoints upsert one row per `(cycle, asset)`. The active cycle is found automatically.

#### `POST /assets/:assetId/audit/verify`

**Auth:** Either · **Scope:** `audit:write` · **Idempotency-Key recommended**

```bash
curl -X POST \
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/audit/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "notes": "Verified in person" }'
```

#### `POST /assets/:assetId/audit/flag`

**Auth:** Either · **Scope:** `audit:write` · **Idempotency-Key recommended**

```bash
curl -X POST \
  https://asset.thebizzfly.com/api/v1/assets/$ASSET_ID/audit/flag \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "flagReason": "wrong_location",
    "notes": "Found in Conference Room B; expected Floor 4 storage"
  }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `cycleId` | UUID | no | Default = active cycle |
| `flagReason` | enum | yes | `wrong_location` / `wrong_assignee` / `damaged` / `missing` / `other` |
| `actualLocationId` | UUID | no | What you saw — `null` if missing |
| `actualAssigneeId` | UUID | no | Same |
| `notes` | string | yes | 3–1000 chars |
| `geoLat` / `geoLng` | number | no | Coordinates |

---

### Reference data

#### `GET /reference/users`

**Auth:** Either · **Scope:** `reference:read`

```bash
curl "https://asset.thebizzfly.com/api/v1/reference/users?q=bob&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

Query params: `q` (substring search), `limit` (default 100, max 500).

#### `GET /reference/locations`

**Auth:** Either · **Scope:** `reference:read`

```bash
curl "https://asset.thebizzfly.com/api/v1/reference/locations?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Schemas

### Asset envelope

```jsonc
{
  "asset": {
    "id": "uuid",
    "assetTag": "LAP-1XL-01-001",
    "name": "Dell XPS 13 — Alice",
    "type": "it_equipment",
    "category": "Laptop",
    "brand": "Dell",
    "model": "XPS 13",
    "serialNumber": "SN-12345",
    "status": "allocated",
    "purchaseDate": "2024-09-01",
    "purchaseCost": 1200,
    "currency": "USD",
    "imageUrl": "https://.../primary.jpg",
    "imageUrls": ["..."],
    "processor": "Intel i7-1360P",
    "ram": "16 GB",
    "storage": "512 GB SSD",
    "assetUse": "personal",
    "organizationId": "uuid",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "location":   { ... } | null,
  "department": { ... } | null,
  "vendor":     { ... } | null,
  "currentAllocation": { "id", "status", "startDate", "endDate", "allocationType", "employeeId", "departmentId" } | null,
  "currentAssignee":   { "id", "name", "email", "phone", "role" } | null,
  "auditContext": {
    "cycleId", "cycleName", "cycleStartsAt", "cycleEndsAt",
    "expectedLocationId", "expectedAssigneeId",
    "currentVerification": { "id", "result", "createdAt" } | null
  } | null,
  "permittedActions": ["add_photo", "log_maintenance", "raise_repair", "update_repair", "mark_recovery", "verify_audit"]
}
```

### User

```jsonc
{
  "id", "name", "email",
  "role": "admin | manager | employee | technician | vendor | auditor | staff",
  "departmentId": "uuid" | null, "phone", "avatar": "https://..." | null,
  "isActive": true, "organizationId": "uuid" | null
}
```

### Organization

```jsonc
{
  "id", "name", "shortName",
  "logoUrl": "https://..." | null,
  "currency": "USD", "country": "IN" | null,
  "contactEmail", "contactPhone", "industry"
}
```

---

## Scope catalogue

| Scope | Endpoints |
|---|---|
| `auth:login` | `POST /auth/login` |
| `auth:refresh` | `POST /auth/refresh` |
| `auth:read` | `GET /auth/me` |
| `assets:read` | `POST /assets/lookup-by-qr`, `GET /assets/:id` |
| `assets:write` | *(reserved)* |
| `photos:write` | photos endpoints |
| `maintenance:read` / `maintenance:write` | maintenance endpoints |
| `repairs:read` / `repairs:write` | repairs endpoints |
| `recovery:write` | recovery |
| `audit:read` / `audit:write` | audit endpoints |
| `reference:read` | reference endpoints |

**Wildcards:** `<resource>:*` (all actions), `*` (every scope — god-mode key).

---

## Permitted-actions matrix

| Action | Admin | Manager | Technician | Vendor | Auditor | Employee | Staff |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `add_photo` | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `log_maintenance` | ✓ | ✓ | ✓ | — | — | — | — |
| `raise_repair` | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| `update_repair` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `mark_recovery` | ✓ | ✓ | — | — | — | — | — |
| `verify_audit` | ✓ | ✓ | — | — | ✓ | — | — |

When `asset.status` is `retired`, `disposed`, or `dead`, the only permitted action is `add_photo`. Integrations using an API key alone (no user JWT) are treated as admin-equivalent — their authority comes from explicit scope grants on the key.

---

## Asset status enum

| Value | Display | Means |
|---|---|---|
| `available` | Available | In inventory, not assigned |
| `allocated` | Allocated | Assigned to a person |
| `in_use` | In Use (Shared) | Common-use asset |
| `under_maintenance` | Under Maintenance | Temporarily out of service |
| `retired` | Retired | End of life |
| `disposed` | Disposed | Sold or scrapped |
| `dead` | Dead | Lost / stolen / written off |

---

## Versioning

- `/api/v1/*` is **additive-only**.
- Breaking changes get `/api/v2/*`. v1 stays alive in parallel for at least one client release cycle.
- `error.code` strings never change meaning.
- Sunset endpoints carry `Deprecation: true` + `Sunset: <date>` headers months ahead of removal.

---

## Quick reference card

```
BASE       https://asset.thebizzfly.com  (or http://localhost:4000)
HEADERS    Authorization: Bearer <token>     (token = API key OR user JWT)
           Idempotency-Key: <uuid>           (recommended on POSTs)
           X-Request-Id: <id>                (recommended on every call)

AUTH       POST   /api/v1/auth/login
           POST   /api/v1/auth/refresh
           POST   /api/v1/auth/logout
           GET    /api/v1/auth/me

ASSETS     POST   /api/v1/assets/lookup-by-qr
           GET    /api/v1/assets/:id

PHOTOS     POST   /api/v1/assets/:id/photos/upload-url
           POST   /api/v1/assets/:id/photos/:photoId/finalize

MAINT      GET    /api/v1/assets/:id/maintenance
           GET    /api/v1/maintenance/task-types
           POST   /api/v1/assets/:id/maintenance

REPAIRS    GET    /api/v1/assets/:id/repairs
           GET    /api/v1/repairs/:id
           POST   /api/v1/assets/:id/repairs
           POST   /api/v1/repairs/:id/updates

RECOVERY   POST   /api/v1/assets/:id/recovery

AUDIT      POST   /api/v1/assets/:id/audit/verify
           POST   /api/v1/assets/:id/audit/flag

REFERENCE  GET    /api/v1/reference/users
           GET    /api/v1/reference/locations

HEALTH     GET    /health
```
