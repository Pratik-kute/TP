/**
 * Sends the welcome email with login credentials to a newly signed-up org admin.
 * Uses the shared org-branded template (buildEmailHtml) so signup emails match
 * the look of every other notification (org name header, green accent, details
 * table, status box, footer — see the email template used across the app).
 */

import { sendGmail, isGmailConfigured } from './gmailSender';
import { buildEmailHtml, detailsTable, infoBox } from './emailTemplates';

export interface SignupWelcomeEmailPayload {
  eventType: 'signup_welcome';
  orgName: string;
  orgShortName: string;
  planName: string;
  planDisplayName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  loginUrl: string;
  orgLogoUrl?: string;
}

export async function sendSignupWelcomeEmail(
  payload: SignupWelcomeEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!isGmailConfigured()) {
    console.warn('[SignupWelcome] VITE_GMAIL_* env vars not configured');
    return { ok: false, error: 'Gmail credentials not configured' };
  }

  const subject = `Welcome to ${payload.orgName} — Your login details`;
  const headline = 'Your workspace is ready';

  const passwordCell =
    `<code style="padding:2px 8px;background:#f3f4f6;border-radius:4px;font-family:monospace;font-size:13px;">${esc(payload.adminPassword)}</code>`;

  const body =
    `<p style="margin:0 0 12px;">Your organization <strong>${esc(payload.orgName)}</strong> has been created on the <strong>${esc(payload.planDisplayName)}</strong> plan. Use the credentials below to sign in.</p>` +
    detailsTable([
      ['Login Email', esc(payload.adminEmail)],
      ['Temporary Password', passwordCell],
      ['Organization Code', esc(payload.orgShortName)],
    ]) +
    infoBox('Please sign in and change your password immediately for security. If you did not create this account, you can safely ignore this email.');

  const html = buildEmailHtml({
    orgName: payload.orgName,
    orgLogoUrl: payload.orgLogoUrl,
    recipientName: payload.adminName,
    subject,
    headline,
    body,
    ctaText: 'Sign in to your workspace',
    ctaUrl: payload.loginUrl,
  });

  const result = await sendGmail({
    to: payload.adminEmail,
    toName: payload.adminName,
    subject,
    html,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Unknown email error' };
  }
  return { ok: true };
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  );
}
