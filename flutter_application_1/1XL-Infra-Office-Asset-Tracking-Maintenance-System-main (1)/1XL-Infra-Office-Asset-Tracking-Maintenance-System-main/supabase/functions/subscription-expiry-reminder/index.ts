// Subscription Expiry Reminder — Supabase Edge Function
// ======================================================
//
// Sends a daily email to every active organization whose subscription
// is within the reminder window configured by the admin in Settings →
// Notification Settings → "Maintenance Reminder (days before due)".
//
// Reminder window:
//   windowStart = MAX(started_at, expires_at − reminderDays)
//   windowEnd   = expires_at
//   Send if:  windowStart <= TODAY <= windowEnd
//
// The MAX(started_at, ...) ensures we never send an expiry warning
// before the subscription itself began (e.g. a short trial where
// the reminder window would otherwise pre-date the plan start).
//
// Deduplication:
//   One row per (organization_id, sent_date) in subscription_reminder_logs
//   prevents duplicate emails if the function is triggered more than once
//   on the same day.
//
// Callers:
//   1. pg_cron — POST {} with service-role JWT at 09:00 UTC daily.
//   2. Manual  — POST { "organizationId": "<uuid>", "callerUserId": "<uuid>" }
//      to test/force a reminder for a specific org.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

import { corsHeaders } from '../_shared/cors.ts';
import { sendEdgeGmail, isGmailConfigured } from '../_shared/gmail.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReqBody {
  organizationId?: string;
  callerUserId?:   string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: ReqBody = {};
  try { body = await req.json(); } catch { /* empty body OK for cron */ }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Determine target organizations ────────────────────────────
  let targetOrgIds: string[] = [];
  try {
    if (body.organizationId) {
      if (!body.callerUserId) throw new Error('Missing callerUserId');
      await assertCallerIsOrgAdmin(body.callerUserId, body.organizationId, supabase);
      targetOrgIds = [body.organizationId];
    } else {
      targetOrgIds = await listActiveOrgIds(supabase);
    }
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 403);
  }

  if (!isGmailConfigured()) {
    return jsonResponse({ error: 'Gmail credentials not configured' }, 500);
  }

  // ── Fetch global reminder setting ─────────────────────────────
  const reminderDays = await fetchReminderDays(supabase);

  // ── Today's UTC date (YYYY-MM-DD) ─────────────────────────────
  const todayUtc = new Date();
  const todayDate = toDateOnly(todayUtc);   // e.g. "2026-04-28"

  // ── Process each org ──────────────────────────────────────────
  const results = await Promise.allSettled(
    targetOrgIds.map(orgId =>
      processOrg(orgId, todayUtc, todayDate, reminderDays, supabase),
    ),
  );

  const sent    = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.sent).length;
  const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.skipped).length;
  const outside = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.outside).length;
  const noSub   = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.noSubscription).length;
  const failures = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.message || 'unknown');

  return jsonResponse({ processed: results.length, sent, skipped, outside, noSubscription: noSub, failures });
});

// ──────────────────────────────────────────────────────────────
// Core per-org logic
// ──────────────────────────────────────────────────────────────

async function processOrg(
  orgId:        string,
  todayUtc:     Date,
  todayDate:    string,
  reminderDays: number,
  supabase:     SupabaseClient,
): Promise<Record<string, boolean>> {

  // 1. Fetch active subscription with plan name
  const { data: sub, error: subErr } = await supabase
    .from('organization_subscriptions')
    .select('id, organization_id, plan_id, status, started_at, expires_at, subscription_plans(name, display_name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .maybeSingle();

  if (subErr) throw new Error(`sub fetch [${orgId}]: ${subErr.message}`);
  if (!sub || !sub.expires_at) return { noSubscription: true };

  const expiresAt  = new Date(sub.expires_at);
  const startedAt  = new Date(sub.started_at);

  // 2. Calculate reminder window
  //    windowStart = max(started_at, expires_at - reminderDays)
  const windowStart = new Date(expiresAt);
  windowStart.setUTCDate(windowStart.getUTCDate() - reminderDays);
  const effectiveWindowStart = windowStart < startedAt ? startedAt : windowStart;

  // 3. Check whether today is inside [effectiveWindowStart, expiresAt]
  const todayMidnight = new Date(todayDate + 'T00:00:00.000Z');
  const expiresMidnight = new Date(toDateOnly(expiresAt) + 'T00:00:00.000Z');

  if (todayMidnight < effectiveWindowStart || todayMidnight > expiresMidnight) {
    return { outside: true };
  }

  // 4. Deduplication — skip if already sent today
  const { data: existing } = await supabase
    .from('subscription_reminder_logs')
    .select('id')
    .eq('organization_id', orgId)
    .eq('sent_date', todayDate)
    .maybeSingle();

  if (existing) return { skipped: true };

  // 5. Fetch org details + admin recipients
  const [orgRes, adminsRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, short_name, contact_email, logo_url')
      .eq('id', orgId)
      .single(),
    supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('is_active', true),
  ]);

  if (orgRes.error) throw new Error(`org fetch [${orgId}]: ${orgRes.error.message}`);

  const org    = orgRes.data as { id: string; name: string; short_name: string; contact_email: string; logo_url?: string };
  let admins = ((adminsRes.data || []) as Array<{ id: string; name: string; email: string }>) .filter(a => a.email);

  if (admins.length === 0 && org.contact_email) {
    admins = [{ id: 'org', name: org.name, email: org.contact_email }];
  }
  if (admins.length === 0) throw new Error(`No admin recipients for org ${orgId}`);

  // 6. Build email content
  const daysRemaining = Math.max(
    0,
    Math.ceil((expiresMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const planDisplayName: string =
    (sub.subscription_plans as any)?.display_name || 'Current';

  const expiryDateFormatted = expiresAt.toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
    timeZone: 'UTC',
  });

  const urgencyLabel =
    daysRemaining === 0 ? 'expires today' :
    daysRemaining === 1 ? 'expires tomorrow' :
    `expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;

  const subject = `Your ${planDisplayName} plan ${urgencyLabel} — action required`;

  const html = buildReminderEmail({
    orgName:          org.name,
    orgLogoUrl:       org.logo_url,
    planName:         planDisplayName,
    expiryDate:       expiryDateFormatted,
    daysRemaining,
  });

  // 7. Send to all admins
  await sendEdgeGmail({
    to:      admins.map(a => ({ email: a.email, name: a.name })),
    subject,
    html,
  });

  // 8. Log send (dedup guard)
  await supabase.from('subscription_reminder_logs').insert({
    organization_id: orgId,
    sent_date:       todayDate,
    days_remaining:  daysRemaining,
    expires_at:      sub.expires_at,
  });

  return { sent: true };
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function fetchReminderDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('system_config')
    .select('maintenance_reminder_days')
    .eq('id', 1)
    .single();
  const days = data?.maintenance_reminder_days;
  return typeof days === 'number' && days > 0 ? days : 7;
}

async function listActiveOrgIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, is_active');
  if (error) throw new Error(`organizations fetch: ${error.message}`);
  return (data || []).filter((o: any) => o.is_active !== false).map((o: any) => o.id);
}

async function assertCallerIsOrgAdmin(
  callerUserId:  string,
  organizationId: string,
  supabase:       SupabaseClient,
): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', callerUserId)
    .eq('organization_id', organizationId)
    .eq('role', 'admin')
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) throw new Error('Caller is not an admin of this organization');
}

/** Returns "YYYY-MM-DD" for a Date in UTC. */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────
// Email template
// ──────────────────────────────────────────────────────────────

interface ReminderEmailArgs {
  orgName:      string;
  orgLogoUrl?:  string;
  planName:     string;
  expiryDate:   string;
  daysRemaining: number;
}

function buildReminderEmail(args: ReminderEmailArgs): string {
  const { orgName, orgLogoUrl, planName, expiryDate, daysRemaining } = args;

  const ACCENT      = '#10b981';
  const ACCENT_DARK = '#059669';
  const WARN_BG     = daysRemaining === 0 ? '#fef2f2' : daysRemaining <= 3 ? '#fef9c3' : '#fff7ed';
  const WARN_BORDER = daysRemaining === 0 ? '#ef4444' : daysRemaining <= 3 ? '#eab308' : '#f97316';
  const WARN_COLOR  = daysRemaining === 0 ? '#dc2626' : daysRemaining <= 3 ? '#a16207' : '#c2410c';

  const urgencyLine =
    daysRemaining === 0
      ? 'Your subscription <strong>expires today</strong>.'
      : daysRemaining === 1
      ? 'Your subscription expires <strong>tomorrow</strong>.'
      : `Your subscription expires in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong>.`;

  const logoBlock = orgLogoUrl
    ? `<img src="${escHtml(orgLogoUrl)}" alt="${escHtml(orgName)}" style="max-height:40px;max-width:160px;object-fit:contain;" />`
    : `<span style="font-size:20px;font-weight:700;color:#1a1a1a;">${escHtml(orgName)}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Subscription Expiry Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">

  <!-- Header -->
  <tr><td style="padding:24px 32px;text-align:center;">${logoBlock}</td></tr>

  <!-- Card -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

      <!-- Accent bar -->
      <tr><td style="height:4px;background:linear-gradient(90deg,${ACCENT},${ACCENT_DARK});"></td></tr>

      <!-- Content -->
      <tr><td style="padding:32px 32px 28px;">

        <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.5;">Hi ${escHtml(orgName)} Admin,</p>

        <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.3;">
          Subscription Expiry Reminder
        </h1>

        <!-- Urgency banner -->
        <div style="margin:0 0 20px;padding:14px 16px;background:${WARN_BG};border-left:4px solid ${WARN_BORDER};border-radius:6px;">
          <p style="margin:0;font-size:15px;color:${WARN_COLOR};font-weight:600;">${urgencyLine}</p>
        </div>

        <!-- Details table -->
        <table role="presentation" cellpadding="0" cellspacing="0"
          style="margin:0 0 20px;width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">Plan</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">
              <span style="display:inline-block;padding:3px 10px;background:#ecfdf5;color:#059669;font-size:12px;font-weight:600;border-radius:20px;">${escHtml(planName)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">Expiry Date</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${escHtml(expiryDate)}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">Days Remaining</td>
            <td style="padding:6px 0;font-size:14px;color:${WARN_COLOR};font-weight:700;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</td>
          </tr>
        </table>

        <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;line-height:1.65;">
          To avoid any disruption to your team's access to premium features, please renew or upgrade
          your plan before the expiry date.
        </p>

        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
          After your subscription expires, your organization will revert to the <strong>Beginner</strong> plan
          and access to advanced features will be restricted until renewed.
        </p>

        <!-- CTA -->
        <div style="text-align:center;margin:8px 0 4px;">
          <a href="#" style="display:inline-block;padding:13px 36px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.2px;">
            Upgrade / Renew Now
          </a>
        </div>

      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
      This is an automated reminder from the ${escHtml(orgName)} Asset Tracking System.
      You are receiving this because you are an administrator of your organization.
    </p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">&copy; ${new Date().getUTCFullYear()} ${escHtml(orgName)}. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c],
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
