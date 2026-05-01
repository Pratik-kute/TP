# 1XL Asset Tracker — Mobile API

Standalone Express + TypeScript backend that serves the Flutter companion
app described in `../questionnaire.md`. Talks to the same Supabase project
as the web app, but never reaches into it through the browser — every call
goes through the service role from this server.

## Layout

```
server/
├── openapi.yaml                 OpenAPI 3.1 spec for the Flutter team
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts                 Entry point (graceful shutdown, signal handling)
    ├── app.ts                   Express app — middleware + route mounting
    ├── config.ts                Zod-validated env schema
    ├── db.ts                    Supabase service-role client
    ├── lib/
    │   ├── apiKey.ts            Generate / verify `<orgslug>_<live|test>_xxx` keys
    │   ├── jwt.ts               Sign + verify access tokens, generate refresh
    │   ├── password.ts          bcrypt + plaintext-equality (for legacy migration)
    │   ├── scopes.ts            Catalogue of API-key scopes
    │   ├── errors.ts            AppError class + stable error codes
    │   ├── caseMapper.ts        snake_case ↔ camelCase
    │   ├── permittedActions.ts  Per (user, asset) action tile computation
    │   ├── assetSerializer.ts   Builds the mobile asset envelope
    │   ├── validate.ts          Zod → ErrorEnvelope helper
    │   ├── asyncHandler.ts      Promise wrapper for Express handlers
    │   └── log.ts               pino logger with header redaction
    ├── middleware/
    │   ├── auth.ts              requireApiKey + requireUserJwt + requireScope
    │   ├── adminAuth.ts         X-Admin-User-Id auth for the React admin page
    │   ├── error.ts             Error envelope writer
    │   ├── requestId.ts         X-Request-Id pass-through
    │   ├── rateLimit.ts         Per-key + per-IP token-bucket
    │   ├── usageLog.ts          Fire-and-forget api_key_usage_log writer
    │   ├── idempotency.ts       Idempotency-Key replay cache
    │   └── types.ts             AuthedRequest typing
    └── routes/
        ├── health.ts            GET /health
        ├── auth.ts              POST /api/v1/auth/{login,refresh,logout}, GET /me
        ├── assets.ts            POST /lookup-by-qr, GET /{id}, photos
        ├── maintenance.ts       List + task-types + create
        ├── repairs.ts           List + get + create + updates
        ├── recovery.ts          POST /assets/{id}/recovery (atomic)
        ├── audit.ts             POST /assets/{id}/audit/{verify,flag}
        ├── reference.ts         GET /reference/{users,locations}
        └── adminApiKeys.ts      Web admin endpoints — list/create/patch/revoke/usage
```

## One-time setup

### 1. Apply the SQL migration

In the Supabase SQL editor, run `../supabase/schema_v26_mobile_api.sql`. It
creates: `api_keys`, `api_key_usage_log`, `refresh_tokens`,
`idempotency_keys`, `repair_updates`, `audit_cycles`, `audit_verifications`,
`asset_photos`, and adds `users.password_hash`. Idempotent.

### 2. Install + configure

```bash
cd server
cp .env.example .env       # then edit
npm install
```

Required env vars (see `.env.example` for the full list):

| Var | Notes |
|---|---|
| `SUPABASE_URL` | Same project as the web |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — never ship to the browser |
| `JWT_SECRET` | Min 32 chars. `openssl rand -base64 48` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins for the React UI |

### 3. Run

```bash
npm run dev          # tsx watch — hot reload
# or
npm run build && npm start
```

Server boots on `http://localhost:4000`. Health check:

```bash
curl http://localhost:4000/health
```

## Auth model

All requests use the standard `Authorization: Bearer <token>` scheme. The
bearer token is one of:

| Token | Identifies | Issued by | Lifetime |
|---|---|---|---|
| API key (`<orgslug>_<live\|test>_<24chars>`) | The integration / org | Admin in the web UI at `/:org/api-keys` | Indefinite, or `expires_at` |
| Access JWT | The user | `POST /api/v1/auth/login` | 30 min |

The server tells them apart by their shape. `/auth/login`, `/auth/refresh`,
`/auth/logout` only accept an API key. `/auth/me` only accepts a user JWT.
Every other endpoint accepts either.

The web admin UI uses a separate header — `X-Admin-User-Id: <uuid>` — same
trust model as the existing `monthly-asset-report` Edge Function. Only
admins can create/revoke keys.

### API key format

```
1xl_live_K8j3pQrX9bR2sN7wHzVc1qLm     # production
demo_test_K8j3pQrX9bR2sN7wHzVc1qLm    # non-production
acmecorp_live_K8j3pQrX9bR2sN7wHzVc    # different org
```

The prefix is your organization's `short_name` (sanitized to lowercase
alphanumeric, max 16 chars). Bcrypt-hashed server-side. Only a short prefix
(`<orgslug>_<env>_<3chars>`) is kept in plain text for display. The full
secret is shown **once** on creation.

### Scopes

Every endpoint is gated by a scope check. See `src/lib/scopes.ts` for the
catalogue. The `DEFAULT_INTEGRATION_SCOPES` bundle covers everything a
typical integration needs and is what the admin UI's "Default scopes"
button selects.

Special wildcards:
- `<resource>:*` — all actions on a resource (`assets:*`, `repairs:*`, …)
- `*` — god mode (every scope). Use sparingly.

## Errors

Every error response uses the same envelope (Section 6.1):

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found",
    "requestId": "5b1a4d8c-…",
    "fieldErrors": [{ "field": "assetId", "message": "…" }]
  }
}
```

Codes are stable strings — see `src/lib/errors.ts`. Mobile should never
parse `message` for branching logic.

`X-Request-Id` is mirrored back on every response (generated if not
supplied). Set it client-side so support tickets can be traced.

## Idempotency

Every `POST` accepts `Idempotency-Key: <16-128 chars>`. The first call's
2xx response is cached in `idempotency_keys` for 24h. Same key + same body
within the window replays the cached response. Same key + different body
returns `409 CONFLICT`.

Mobile should generate one UUID per intent (e.g. `raise_repair_<uuid>`),
NOT per attempt — that's how retries get deduped.

## Rate limiting

- Per API key: `rate_limit_per_minute` column (default 120). Token bucket.
- Per IP for `/auth/login`: `LOGIN_RATE_LIMIT_PER_15MIN` (default 20).

Standard headers on every response: `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, `X-RateLimit-Reset`. `Retry-After` on 429.

The current implementation is in-memory — fine for a single-instance
deployment. Move to Redis if you scale horizontally.

## Photo upload flow

1. Mobile: `POST /assets/{id}/photos/upload-url` with `{ filename, mimeType, sizeBytes }`.
   - Server pre-creates an `asset_photos` row (`status='pending'`) and returns
     a Supabase Storage signed PUT URL valid for 10 minutes.
2. Mobile: `PUT <uploadUrl>` with the image bytes and `Content-Type` header.
3. Mobile: `POST /assets/{id}/photos/{photoId}/finalize` — server verifies
   the object exists, flips the row to `status='active'`, populates the
   public URL, and appends to `assets.image_urls`.

Privacy: mobile is responsible for stripping EXIF/GPS before upload
(Section 7.4). Server stores whatever it receives.

## Generating the OpenAPI spec for the Flutter team

Hand them `server/openapi.yaml`. View it locally with:

```bash
npx @redocly/cli preview-docs openapi.yaml
```

Any contract change must update both the route + the spec in the same PR.

## Deployment

Any standard Node 20+ host (Render, Fly, Railway, Hetzner). Required:
- Env vars from `.env.example`
- Supabase service role network reachability
- A reverse proxy that forwards `X-Forwarded-For` (we trust one hop)
- HTTPS terminated at the proxy

Suggested startup:

```bash
npm ci && npm run build && npm start
```

`npm start` runs `node dist/index.js`. The process exits with code 1 on
unhandled rejections (caught in `src/index.ts`) so your supervisor restarts it.

## Operations

- **Logs:** pino JSON in production, pretty-printed in dev. Authorization
  and `x-api-key` headers are redacted.
- **Per-key audit trail:** `api_key_usage_log` rows accumulate forever.
  Add a periodic cleanup if size becomes a concern.
- **Refresh-token reuse detection:** if a revoked refresh token is presented
  again, we revoke every active token for that user (CSRF/replay defence).
- **Password migration:** legacy plaintext passwords are bcrypt-hashed on
  first successful login. After every active user has logged in once, drop
  the `users.password` column manually.
