/**
 * Subscription Expiry Reminder Service (browser-side).
 *
 * Called from Dashboard when an admin is logged in.
 * Sends a daily email reminder to all active admins of the organization
 * when today falls inside the expiry reminder window:
 *
 *   windowStart = MAX(started_at, expires_at − maintenanceReminderDays)
 *   windowEnd   = expires_at
 *   Send if:  windowStart <= TODAY <= windowEnd  AND  localHour >= 9
 *
 * The MAX(started_at, ...) ensures we never warn before the plan began
 * (e.g. a short trial where the window would otherwise pre-date plan start).
 *
 * Deduplication: one row per (organization_id, sent_date) in
 * subscription_reminder_logs prevents duplicate sends even if Dashboard
 * re-mounts multiple times on the same day.
 */

import { supabase } from './supabase';
import { sendNotificationEmailToMany } from './notificationEmailService';
import { subscriptionExpiryBody } from './emailTemplates';

interface ReminderParams {
  orgId:      string;
  orgName:    string;
  orgLogoUrl?: string;
}

/** Returns "YYYY-MM-DD" in the local timezone. */
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Main entry-point. Fire-and-forget — never throws, logs warnings instead.
 * Safe to call on every Dashboard mount; the dedup table guarantees at-most-once per day.
 */
export async function checkAndSendSubscriptionReminder(params: ReminderParams): Promise<void> {
  const { orgId, orgName, orgLogoUrl } = params;

  try {
    const now = new Date();

    // Only fire at or after 09:00 local time
    if (now.getHours() < 9) return;

    const todayStr = localDateString(now);

    // ── 1. Check if already sent today ──────────────────────────
    const { data: existing } = await supabase
      .from('subscription_reminder_logs')
      .select('id')
      .eq('organization_id', orgId)
      .eq('sent_date', todayStr)
      .maybeSingle();

    if (existing) return; // already handled today

    // ── 2. Fetch active subscription ────────────────────────────
    const { data: sub } = await supabase
      .from('organization_subscriptions')
      .select('id, started_at, expires_at, plan_id, subscription_plans(name, display_name)')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .maybeSingle();

    if (!sub?.expires_at) return; // no active subscription with an expiry date

    // ── 3. Fetch reminder window setting ────────────────────────
    const { data: cfg } = await supabase
      .from('system_config')
      .select('maintenance_reminder_days')
      .eq('id', 1)
      .single();

    const reminderDays: number =
      typeof cfg?.maintenance_reminder_days === 'number' && cfg.maintenance_reminder_days > 0
        ? cfg.maintenance_reminder_days
        : 7;

    // ── 4. Calculate effective window ───────────────────────────
    const expiresAt  = new Date(sub.expires_at);
    const startedAt  = new Date(sub.started_at);

    // Strip time — compare calendar dates only
    const expiresDate  = new Date(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth(), expiresAt.getUTCDate());
    const startedDate  = new Date(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), startedAt.getUTCDate());
    const todayDate    = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const rawWindowStart = new Date(expiresDate);
    rawWindowStart.setDate(rawWindowStart.getDate() - reminderDays);

    // Respect plan start: don't warn before the subscription began
    const windowStart = rawWindowStart < startedDate ? startedDate : rawWindowStart;

    if (todayDate < windowStart || todayDate > expiresDate) return; // outside reminder window

    // ── 5. Calculate days remaining ─────────────────────────────
    const daysRemaining = Math.max(
      0,
      Math.round((expiresDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // ── 6. Fetch all active admin recipients ────────────────────
    const { data: admins } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('is_active', true);

    const recipients = (admins || []).filter(a => !!a.email) as Array<{ email: string; name: string }>;
    if (recipients.length === 0) {
      console.warn('[SubscriptionReminder] No admin recipients found for org', orgId);
      return;
    }

    // ── 7. Build email content ───────────────────────────────────
    const planName: string =
      (sub.subscription_plans as { display_name?: string } | null)?.display_name || 'Current';

    const expiryDateFormatted = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });

    const urgencyLabel =
      daysRemaining === 0 ? 'expires today' :
      daysRemaining === 1 ? 'expires tomorrow' :
      `expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;

    const subject = `Your ${planName} plan ${urgencyLabel} — action required`;

    await sendNotificationEmailToMany(
      recipients,
      'subscription_expiry_reminder',
      subject,
      {
        orgName,
        orgLogoUrl,
        headline: 'Subscription Expiry Reminder',
        body: subscriptionExpiryBody(planName, expiryDateFormatted, daysRemaining),
      },
      orgId,
    );

    // ── 8. Log the send (dedup guard) ────────────────────────────
    await supabase.from('subscription_reminder_logs').insert({
      organization_id: orgId,
      sent_date:        todayStr,
      days_remaining:   daysRemaining,
      expires_at:       sub.expires_at,
    });

  } catch (err) {
    console.error('[SubscriptionReminder] Unexpected error:', err);
  }
}
