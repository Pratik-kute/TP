/**
 * Password reset flow for the custom-auth `users` table.
 *
 * 1. requestPasswordReset(email)  → generates token, stores it, emails the link.
 *    Always reports success to the caller (prevents email enumeration), but
 *    only sends a message when the email belongs to an active user.
 * 2. validateResetToken(token)    → confirms the token exists, isn't used, and
 *    isn't expired.
 * 3. resetPassword(token, pwd)    → updates the user's password and marks the
 *    token used in a single round-trip per step.
 *
 * Token: 32 random bytes hex-encoded (256 bits of entropy).
 * TTL:   1 hour from issue.
 */

import { supabase } from './supabase';
import { sendGmail } from './gmailSender';
import { buildEmailHtml } from './emailTemplates';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Build the in-app reset URL. Uses HashRouter so the path is `#/reset-password/<token>`. */
function buildResetUrl(token: string): string {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
  return `${base}#/reset-password/${token}`;
}

export interface RequestResetResult {
  ok: boolean;
  error?: string;
}

export async function requestPasswordReset(email: string): Promise<RequestResetResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return { ok: false, error: 'Please enter your email address.' };

  // Look up the user. Errors here are infrastructure errors; absence is fine.
  const { data: user, error: lookupErr } = await supabase
    .from('users')
    .select('id, name, email, is_active, organization_id')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (lookupErr) {
    console.error('[PasswordReset] User lookup failed:', lookupErr);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  // Don't reveal whether the email is registered.
  if (!user || !user.is_active) {
    return { ok: true };
  }

  // Resolve the org name for the email branding (best-effort).
  let orgName = '1XL Asset Tracker';
  if (user.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', user.organization_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: insertErr } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

  if (insertErr) {
    console.error('[PasswordReset] Failed to store token:', insertErr);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  const resetUrl = buildResetUrl(token);
  const html = buildEmailHtml({
    orgName,
    recipientName: user.name || user.email,
    subject: 'Reset your password',
    headline: 'Reset your password',
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Hi ${user.name || 'there'},
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        We received a request to reset the password for your <strong>${orgName}</strong> account.
        Click the button below to choose a new one. This link is valid for the next hour.
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.6;">
        If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    `,
    ctaText: 'Reset password',
    ctaUrl: resetUrl,
    footerText: `If the button doesn't work, paste this link into your browser:<br/><a href="${resetUrl}" style="color:#10b981;word-break:break-all;">${resetUrl}</a>`,
  });

  const result = await sendGmail({
    to: user.email,
    toName: user.name,
    subject: `Reset your password — ${orgName}`,
    html,
  });

  if (!result.ok) {
    console.error('[PasswordReset] Email send failed:', result.error);
    return { ok: false, error: 'Failed to send the reset email. Please try again or contact support.' };
  }

  return { ok: true };
}

export interface ValidateTokenResult {
  valid: boolean;
  userId?: string;
  userEmail?: string;
  error?: string;
}

export async function validateResetToken(token: string): Promise<ValidateTokenResult> {
  if (!token) return { valid: false, error: 'Missing reset token.' };

  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[PasswordReset] Token lookup failed:', error);
    return { valid: false, error: 'Something went wrong. Please request a new link.' };
  }
  if (!data) return { valid: false, error: 'This reset link is invalid.' };
  if (data.used_at) return { valid: false, error: 'This reset link has already been used.' };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'This reset link has expired. Please request a new one.' };
  }

  // Fetch email for display on the reset form.
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', data.user_id)
    .maybeSingle();

  return { valid: true, userId: data.user_id, userEmail: user?.email };
}

export interface ResetResult {
  ok: boolean;
  error?: string;
}

export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const validation = await validateResetToken(token);
  if (!validation.valid || !validation.userId) {
    return { ok: false, error: validation.error || 'Invalid reset link.' };
  }

  const nowIso = new Date().toISOString();

  // Update the password.
  const { error: updateErr } = await supabase
    .from('users')
    .update({ password: newPassword, updated_at: nowIso })
    .eq('id', validation.userId);

  if (updateErr) {
    console.error('[PasswordReset] Failed to update password:', updateErr);
    return { ok: false, error: 'Failed to update password. Please try again.' };
  }

  // Burn the token so it can't be reused. Best-effort — even if this fails the
  // password has been changed; we just log.
  const { error: burnErr } = await supabase
    .from('password_reset_tokens')
    .update({ used_at: nowIso })
    .eq('token', token);

  if (burnErr) {
    console.error('[PasswordReset] Failed to mark token used:', burnErr);
  }

  return { ok: true };
}
