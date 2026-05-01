# Monthly Asset Audit Report — Setup Guide (Local-Only)

This feature generates a multi-page Asset Audit PDF (modeled on the Bizzfly template) and emails it to your organization's admins via the Gmail API. **No deployment required.** The Edge Function runs locally via `supabase functions serve`, reading credentials from your repo's `.env` file.

> Trade-off: because the function runs locally, the manual "Send Monthly Report Now" button only works when you have `supabase functions serve` running on your machine. The pg_cron monthly schedule cannot reach localhost — see "Scheduling options" at the bottom for alternatives.

## Architecture

```
Manual button (Reports.tsx, admin only)
            │
            ▼
   POST http://localhost:54321/functions/v1/monthly-asset-report
            │
            ▼
   Local Supabase Edge Function (running via `supabase functions serve`)
   1. Verify caller is an active admin of the target org
   2. Idempotency insert into audit_reports
   3. Fetch org data (assets, allocations, locations, depts, admins)
   4. Compute aggregate stats
   5. Generate narrative paragraphs via GPT-4o-mini (templated fallback if no key)
   6. Build multi-page PDF with pdf-lib
   7. Send email via Gmail API with the PDF attached (multipart/mixed)
   8. Mark audit_reports row sent
```

## One-time setup steps

### 1. Install the Supabase CLI

```bash
npm install -g supabase
```

(No `supabase login` needed for local-only.)

### 2. Add credentials to `.env`

Copy from `.env.example`. The `.env` file at the repo root needs **both** the Vite vars (for the browser) and the Edge Function vars (read by `supabase functions serve --env-file .env`):

```env
# ===== Vite (browser) =====
VITE_SUPABASE_URL=https://xdtrqkjztgjihtahmbjx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_MONTHLY_REPORT_FN_URL=http://localhost:54321/functions/v1/monthly-asset-report

# Gmail credentials (used by the browser AND, as a fallback, by the local Edge Function)
VITE_GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GMAIL_CLIENT_SECRET=your-client-secret
VITE_GMAIL_REFRESH_TOKEN=your-refresh-token
VITE_GMAIL_SENDER=bot@your-domain.com
VITE_GMAIL_SENDER_NAME=1XL Asset Tracker

# ===== Edge Function (NOT VITE_-prefixed; safe in same .env file) =====
SUPABASE_URL=https://xdtrqkjztgjihtahmbjx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # Get from Supabase Dashboard → Settings → API → service_role secret
OPENAI_API_KEY=sk-...                   # Optional. If absent, falls back to deterministic templated paragraphs.
```

> **Vite ignores anything that doesn't start with `VITE_`**, so `OPENAI_API_KEY` and the service role key cannot leak to the browser even though they sit in the same file.
>
> For the local function, the Gmail sender reads `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_SENDER` first, then falls back to the `VITE_GMAIL_*` copies. So a single set of vars works for both browser and local function.

### 3. Run the SQL migration

In the Supabase SQL editor, execute:

```
supabase/schema_v21_audit_reports.sql
```

This creates the `audit_reports` table (used for idempotency + history) on the live cloud DB. **You can ignore the `pg_cron` portion of the file** if you want — it's harmless if pg_cron isn't enabled, the cron job just won't fire. The local function and manual button work without it.

> If pg_cron complains about extension permissions, comment out the `CREATE EXTENSION` and `cron.schedule` blocks at the bottom of the file. Only the `CREATE TABLE audit_reports` part is required.

### 4. Start the function locally

In a dedicated terminal, from the repo root:

```bash
supabase functions serve monthly-asset-report --env-file .env --no-verify-jwt
```

You should see:
```
Serving functions on http://localhost:54321/functions/v1/<function-name>
```

Leave this process running whenever you want the manual button to work.

### 5. Test

**Quick smoke test from the terminal:**

```bash
curl -i -X POST http://localhost:54321/functions/v1/monthly-asset-report \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"<your-org-uuid>","callerUserId":"<your-admin-user-uuid>"}'
```

Should return `{"processed":1,"sent":1,"skipped":0,"failures":[]}` after ~10–20s.

**UI test:**

1. Run the Vite dev server (`npm run dev` or via the preview tool).
2. Log in as an org admin.
3. Open the **Reports** page.
4. Click **Send Monthly Report Now**. Spinner shows for 10–20s, then a green success toast appears.
5. Check your inbox — the email arrives with the PDF attached.
6. The "Last sent" line below the button updates.

## How auth works in this setup

- Vite's browser button posts `{ organizationId, callerUserId: user.id }` to the local function URL with the anon key in the `Authorization` header.
- The function ignores the anon key for identity (it's just transport) and instead looks up `callerUserId` in the `users` table, requiring `role='admin'` and matching `organization_id`. If that lookup fails, the function returns 403.
- This is safe because `users.id` is an unguessable UUID and the function uses the service role to do the lookup — a malicious browser can't claim to be a different user without knowing their UUID, and the role/org match prevents lateral access.

## Failure modes

- **Function not running:** Button shows red toast "Failed to send report. Is `supabase functions serve` running?"
- **OpenAI key missing/invalid:** Function falls back to deterministic templated paragraphs. The report still sends.
- **Gmail API error (expired refresh token, revoked consent, etc.):** Function marks the `audit_reports` row as `failed` with the error message. To retry: delete the row first.
  ```sql
  DELETE FROM audit_reports WHERE organization_id='<id>' AND period_year=2026 AND period_month=4;
  ```
- **Already sent this month:** Returns `{ skipped: true }` and the UI shows "Report for this month has already been sent."
- **No admin recipients:** Falls back to the organization's `contact_email` if set; otherwise marks failed.

## Scheduling options (since pg_cron can't reach localhost)

The original plan used pg_cron in the cloud DB to invoke the function on the 1st of each month. That requires a publicly-reachable function URL. With local-only, your options are:

1. **Manual only.** Click the button on the 1st each month. Simplest. Works today.
2. **System cron on your machine** that calls `curl` against the local function URL. Only fires if your machine is on at the scheduled time.
3. **Deploy the function.** Run `supabase functions deploy monthly-asset-report --no-verify-jwt`, then `supabase secrets set OPENAI_API_KEY=... GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... GMAIL_REFRESH_TOKEN=... GMAIL_SENDER=...`, then re-enable the `pg_cron` block in `schema_v21_audit_reports.sql`. Update `VITE_MONTHLY_REPORT_FN_URL` in `.env` to the deployed URL. Everything else stays the same.

## File map

| File | Purpose |
| --- | --- |
| `supabase/config.toml` | Supabase CLI project config (verify_jwt off) |
| `supabase/functions/monthly-asset-report/index.ts` | Edge Function entry point |
| `supabase/functions/monthly-asset-report/deno.json` | Import map |
| `supabase/functions/_shared/cors.ts` | CORS headers |
| `supabase/functions/_shared/stats.ts` | Pure aggregation logic |
| `supabase/functions/_shared/openai.ts` | GPT-4o-mini wrapper + templated fallback |
| `supabase/functions/_shared/pdf.ts` | pdf-lib multi-page PDF builder |
| `supabase/functions/_shared/gmail.ts` | Gmail API sender (MIME multipart for attachments) |
| `supabase/schema_v21_audit_reports.sql` | `audit_reports` table (+ optional pg_cron) |
| `src/pages/Reports.tsx` | "Send Monthly Report Now" button (admin only) |
| `src/contexts/DataContext.tsx` | `auditReports` CRUD wrapper |
| `src/types/index.ts` | `AuditReport` type |
