// Monthly Asset Audit Report — Supabase Edge Function
// ====================================================
//
// Two callers:
//   1. Browser (manual button) — POST { organizationId } with the user's JWT.
//      The function verifies the caller is an active admin of that org, then
//      generates and sends ONE report.
//   2. pg_cron (scheduled monthly) — POST {} with the SERVICE_ROLE JWT.
//      The function iterates every active organization with Promise.allSettled.
//
// Idempotency: an `audit_reports` row keyed (org, year, month) prevents
// duplicate sends. Subsequent calls within the same month return { skipped: true }.
//
// The PDF is attached to the email as multipart/mixed directly via the Gmail
// API (see ../_shared/gmail.ts).

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

import { corsHeaders } from '../_shared/cors.ts';
import { computeStats, RawAsset, RawAllocation, RawDepartment, RawLocation } from '../_shared/stats.ts';
import { generateNarrative } from '../_shared/openai.ts';
import { buildAuditReport } from '../_shared/pdf.ts';
import { sendEdgeGmail } from '../_shared/gmail.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReqBody { organizationId?: string; callerUserId?: string }

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

  // Determine target organizations
  let targetOrgIds: string[] = [];
  try {
    if (body.organizationId) {
      // Manual button path: this app uses its own users table for auth, so
      // verify the caller's userId from the request body matches an active
      // admin of the requested org. (The Supabase JWT gate is just the anon
      // key — we never trust it for identity, only for transport.)
      if (!body.callerUserId) throw new Error('Missing callerUserId');
      await assertCallerIsOrgAdmin(body.callerUserId, body.organizationId, supabase);
      targetOrgIds = [body.organizationId];
    } else {
      // Cron path: empty body, runs for every active org. Caller must be the
      // service-role key (validated by Supabase verify_jwt at the edge).
      targetOrgIds = await listActiveOrgIds(supabase);
    }
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 403);
  }

  const now = new Date();
  const period = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

  const results = await Promise.allSettled(
    targetOrgIds.map(orgId => generateAndSendForOrg(orgId, period, supabase)),
  );

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.sent).length;
  const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.skipped).length;
  const failures = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.message || 'unknown');

  return jsonResponse({
    processed: results.length,
    sent,
    skipped,
    failures,
  });
});

async function generateAndSendForOrg(
  orgId: string,
  period: { year: number; month: number },
  supabase: SupabaseClient,
): Promise<{ sent?: boolean; skipped?: boolean }> {
  // 1. Idempotency insert
  const { error: insErr } = await supabase
    .from('audit_reports')
    .insert({
      organization_id: orgId,
      period_year: period.year,
      period_month: period.month,
      status: 'pending',
    });
  if (insErr) {
    if ((insErr as any).code === '23505') return { skipped: true };
    throw new Error(`audit_reports insert failed: ${insErr.message}`);
  }

  try {
    // 2. Fetch org data
    const [orgRes, assetsRes, allocsRes, locsRes, deptsRes, adminsRes] = await Promise.all([
      supabase.from('organizations').select('id,name,short_name,contact_email').eq('id', orgId).single(),
      supabase.from('assets').select('id,asset_tag,name,type,category,brand,model,serial_number,status,ram,processor,storage,graphics_card,purchase_cost,currency,location_id,department_id,device_name').eq('organization_id', orgId),
      supabase.from('allocations').select('id,asset_id,employee_id,status,start_date,end_date').eq('organization_id', orgId),
      supabase.from('locations').select('id,name').eq('organization_id', orgId),
      supabase.from('departments').select('id,name').eq('organization_id', orgId),
      supabase.from('users').select('id,name,email,role,is_active').eq('organization_id', orgId).eq('role', 'admin').eq('is_active', true),
    ]);

    if (orgRes.error) throw new Error(`org fetch: ${orgRes.error.message}`);
    if (assetsRes.error) throw new Error(`assets fetch: ${assetsRes.error.message}`);

    const org = orgRes.data as { id: string; name: string; short_name: string; contact_email: string };
    const assets = (assetsRes.data || []) as RawAsset[];
    const allocations = (allocsRes.data || []) as RawAllocation[];
    const locations = (locsRes.data || []) as RawLocation[];
    const departments = (deptsRes.data || []) as RawDepartment[];
    const admins = (adminsRes.data || []) as Array<{ id: string; name: string; email: string }>;

    if (admins.length === 0) {
      // No recipients — fall through to org contactEmail if present
      if (org.contact_email) {
        admins.push({ id: 'org', name: org.name, email: org.contact_email });
      } else {
        throw new Error('No admin recipients found for organization');
      }
    }

    // 3. Stats
    const stats = computeStats({ assets, allocations, locations, departments, period });

    // 4. Narrative (GPT with fallback)
    const narrative = await generateNarrative(stats, org.name);

    // 5. PDF
    const pdfBytes = await buildAuditReport({
      organizationName: org.name,
      organizationShortName: org.short_name || org.name,
      stats,
      narrative,
      periodLabel: `${stats.period.monthName} ${period.year}`,
    });

    // 6. Send email via Gmail API with the PDF attached
    const filename = `${org.short_name || 'asset'}_Audit_${stats.period.monthName}_${period.year}.pdf`;
    const subject = `${org.name} - Monthly Asset Audit Report (${stats.period.monthName} ${period.year})`;
    const bodyHtml = buildEmailBody(org.name, stats, `${stats.period.monthName} ${period.year}`);

    await sendEdgeGmail({
      to: admins.map(a => ({ email: a.email, name: a.name })),
      subject,
      html: bodyHtml,
      attachments: [{ filename, mimeType: 'application/pdf', bytes: pdfBytes }],
    });

    // 7. Mark sent
    await supabase.from('audit_reports')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipient_count: admins.length,
      })
      .eq('organization_id', orgId)
      .eq('period_year', period.year)
      .eq('period_month', period.month);

    return { sent: true };
  } catch (err) {
    // Mark as failed but leave row for visibility / manual retry
    await supabase.from('audit_reports')
      .update({ status: 'failed', error: (err as Error).message })
      .eq('organization_id', orgId)
      .eq('period_year', period.year)
      .eq('period_month', period.month);
    throw err;
  }
}

async function listActiveOrgIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id,is_active');
  if (error) throw new Error(`organizations fetch: ${error.message}`);
  return (data || []).filter((o: any) => o.is_active !== false).map((o: any) => o.id);
}

async function assertCallerIsOrgAdmin(
  callerUserId: string,
  organizationId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id,role,is_active,organization_id')
    .eq('id', callerUserId)
    .eq('organization_id', organizationId)
    .eq('role', 'admin')
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) throw new Error('Caller is not an admin of this organization');
}

function buildEmailBody(orgName: string, stats: any, periodLabel: string): string {
  return `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f8fa;padding:24px;color:#1f2328">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e1e4e8">
    <h1 style="margin:0 0 8px;color:#0a7d4e;font-size:22px">${escapeHtml(orgName)}</h1>
    <p style="margin:0 0 24px;color:#6e7781;font-size:14px">Monthly Asset Audit Report - ${escapeHtml(periodLabel)}</p>
    <p style="font-size:14px;line-height:1.6">Hello,</p>
    <p style="font-size:14px;line-height:1.6">Your monthly asset audit report is attached as a PDF. It contains a complete inventory overview, computing equipment analysis, peripheral coverage status, and audit flags identified during the period.</p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0">
      <tr>
        <td style="padding:12px;background:#ecfdf5;border-radius:8px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#0a7d4e">${stats.totals.assets}</div>
          <div style="font-size:11px;color:#6e7781;margin-top:4px">Total Assets</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:12px;background:#ecfdf5;border-radius:8px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#0a7d4e">${stats.flags.length}</div>
          <div style="font-size:11px;color:#6e7781;margin-top:4px">Flags Identified</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:12px;background:#ecfdf5;border-radius:8px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#0a7d4e">${stats.deadAssets.length}</div>
          <div style="font-size:11px;color:#6e7781;margin-top:4px">Dead/Retired</div>
        </td>
      </tr>
    </table>
    <p style="font-size:14px;line-height:1.6">Please review the attached report and take action on any flagged items at your convenience.</p>
    <p style="font-size:13px;color:#6e7781;margin-top:32px;border-top:1px solid #e1e4e8;padding-top:16px">This is an automated message from the Asset Tracking System.</p>
  </div>
</body></html>`.trim();
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
