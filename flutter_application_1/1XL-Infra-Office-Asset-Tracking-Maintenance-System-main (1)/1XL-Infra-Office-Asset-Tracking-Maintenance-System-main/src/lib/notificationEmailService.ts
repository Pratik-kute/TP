/**
 * Central notification email service.
 * Every notification event builds org-branded HTML via buildEmailHtml
 * and sends it directly through the Gmail API (see gmailSender.ts).
 * Fire-and-forget — errors are logged but never thrown.
 */

import { buildEmailHtml, type EmailTemplateData } from './emailTemplates';
import { sendGmail, isGmailConfigured } from './gmailSender';

export interface NotificationEmailPayload {
  eventType: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  emailHtml: string;
  orgName: string;
  orgId: string;
  [key: string]: unknown;
}

/**
 * Sends a notification email via Gmail API.
 * Builds the HTML from template data and dispatches asynchronously.
 */
export async function sendNotificationEmail(
  eventType: string,
  recipientEmail: string,
  recipientName: string,
  subject: string,
  templateData: Omit<EmailTemplateData, 'recipientName' | 'subject'>,
  _orgId: string,
  _extraData?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!isGmailConfigured()) {
      console.warn('[NotificationEmail] Gmail credentials not configured');
      return;
    }
    if (!recipientEmail) {
      console.warn(`[NotificationEmail] No email for recipient "${recipientName}", skipping`);
      return;
    }

    const html = buildEmailHtml({ ...templateData, recipientName, subject });

    const result = await sendGmail({
      to: recipientEmail,
      toName: recipientName,
      subject,
      html,
    });

    if (!result.ok) {
      console.error(`[NotificationEmail] ${eventType} → ${recipientEmail} failed: ${result.error}`);
    }
  } catch (err) {
    console.error('[NotificationEmail] Unexpected error:', err);
  }
}

/**
 * Send the same notification email to multiple recipients.
 * One Gmail send per recipient (individual personalized emails).
 */
export async function sendNotificationEmailToMany(
  recipients: Array<{ email: string; name: string }>,
  eventType: string,
  subject: string,
  templateData: Omit<EmailTemplateData, 'recipientName' | 'subject'>,
  orgId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  await Promise.all(
    recipients.map(r =>
      sendNotificationEmail(eventType, r.email, r.name, subject, templateData, orgId, extraData)
    )
  );
}
