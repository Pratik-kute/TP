// Supabase Edge Function — send-welcome-email
// Sends login credentials to a newly signed-up org admin via Gmail API.
//
// Flow:
//   1. Exchange refresh token → access token  (POST oauth2.googleapis.com/token)
//   2. Build RFC 2822 email message
//   3. Base64url-encode it
//   4. POST to gmail.googleapis.com/gmail/v1/users/me/messages/send
//
// Required Supabase secrets (set once via CLI — see README):
//   GMAIL_CLIENT_ID      — Google OAuth2 client ID
//   GMAIL_CLIENT_SECRET  — Google OAuth2 client secret
//   GMAIL_REFRESH_TOKEN  — long-lived refresh token for bot@1xl.com
//   GMAIL_SENDER         — bot@1xl.com

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface WelcomeEmailPayload {
  orgName: string;
  orgShortName: string;
  planDisplayName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  loginUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── Read credentials from Supabase secrets ───────────────────────────────
  const clientId     = Deno.env.get('GMAIL_CLIENT_ID')     ?? '';
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET') ?? '';
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN') ?? '';
  const sender       = Deno.env.get('GMAIL_SENDER')        ?? 'bot@1xl.com';

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[send-welcome-email] Gmail OAuth2 secrets not configured');
    return json({ error: 'Email service not configured — Gmail secrets missing' }, 500);
  }

  // ── Parse request body ───────────────────────────────────────────────────
  let payload: WelcomeEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { orgName, orgShortName, planDisplayName, adminName, adminEmail, adminPassword, loginUrl } = payload;
  if (!adminEmail || !adminName || !orgName) {
    return json({ error: 'Missing required fields' }, 400);
  }

  // ── Step 1: Exchange refresh token for access token ──────────────────────
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[send-welcome-email] Token exchange failed:', tokenData);
      return json({ error: 'Failed to get Gmail access token', detail: tokenData.error_description ?? tokenData.error }, 500);
    }

    accessToken = tokenData.access_token;
    console.log('[send-welcome-email] Access token obtained');
  } catch (err) {
    console.error('[send-welcome-email] Token fetch error:', err);
    return json({ error: 'Network error during token exchange' }, 500);
  }

  // ── Step 2: Build RFC 2822 email message ─────────────────────────────────
  const subject = `Welcome to 1XL Asset Tracker — Your login details for ${orgName}`;
  const htmlBody = buildWelcomeEmail({ orgName, orgShortName, planDisplayName, adminName, adminEmail, adminPassword, loginUrl });

  const rfc2822 = [
    `From: "1XL Asset Tracker" <${sender}>`,
    `To: ${adminEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n');

  // ── Step 3: Base64url-encode the message ─────────────────────────────────
  const encoded = btoa(unescape(encodeURIComponent(rfc2822)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // ── Step 4: Send via Gmail API ────────────────────────────────────────────
  try {
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      },
    );

    const gmailData = await gmailRes.json();

    if (!gmailRes.ok) {
      console.error('[send-welcome-email] Gmail API error:', gmailData);
      return json({
        error: 'Gmail API rejected the request',
        detail: gmailData?.error?.message ?? JSON.stringify(gmailData),
      }, 500);
    }

    console.log(`[send-welcome-email] ✓ Sent to ${adminEmail} — messageId: ${gmailData.id}`);
    return json({ ok: true, messageId: gmailData.id });

  } catch (err) {
    console.error('[send-welcome-email] Gmail send error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  );
}

function buildWelcomeEmail(p: WelcomeEmailPayload): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to 1XL Asset Tracker</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f0f20;border-radius:12px 12px 0 0;padding:28px 40px;">
          <span style="color:#f0f0f5;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
            &#9632;&nbsp; Asset Tracker &nbsp;<span style="color:#8b5cf6;font-size:13px;font-weight:500;">by 1XL</span>
          </span>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">

          <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1a1a2e;">
            Welcome, ${esc(p.adminName)}!
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
            Your organization <strong style="color:#1a1a2e;">${esc(p.orgName)}</strong>
            has been created on the <strong>${esc(p.planDisplayName)}</strong> plan.
            Use the credentials below to sign in.
          </p>

          <!-- Credentials box -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f8f9ff;border:1px solid #ddd8f8;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:24px 28px;">

              <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:1.2px;
                         text-transform:uppercase;color:#8b5cf6;">Login Email</p>
              <p style="margin:0 0 18px;font-size:16px;color:#1a1a2e;font-weight:500;">
                ${esc(p.adminEmail)}
              </p>

              <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:1.2px;
                         text-transform:uppercase;color:#8b5cf6;">Password</p>
              <p style="margin:0 0 18px;font-size:16px;color:#1a1a2e;font-weight:600;
                         font-family:'Courier New',monospace;letter-spacing:1.5px;
                         background:#eeeeff;display:inline-block;padding:6px 12px;border-radius:6px;">
                ${esc(p.adminPassword)}
              </p>

              <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:1.2px;
                         text-transform:uppercase;color:#8b5cf6;">Organization Code</p>
              <p style="margin:0;font-size:16px;color:#1a1a2e;font-weight:500;">
                ${esc(p.orgShortName)}
              </p>

            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${esc(p.loginUrl)}"
                 style="display:inline-block;background:#8b5cf6;color:#fff;font-size:15px;
                        font-weight:600;text-decoration:none;padding:14px 44px;
                        border-radius:8px;letter-spacing:0.2px;">
                Sign in to your workspace →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;
                     border-top:1px solid #f0f0f0;padding-top:20px;">
            You can change your password anytime from the Settings page after signing in.<br/>
            If you did not create this account, please ignore this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            Sent by
            <a href="mailto:bot@1xl.com" style="color:#8b5cf6;text-decoration:none;">bot@1xl.com</a>
            &nbsp;·&nbsp; © ${year} 1XL. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
