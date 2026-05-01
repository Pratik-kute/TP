import { generateAcknowledgementPDF, AcknowledgementData } from './acknowledgementForm';
import { sendGmail, isGmailConfigured } from './gmailSender';
import { buildEmailHtml, detailsTable, infoBox } from './emailTemplates';

export interface AssignmentEmailPayload {
  // Employee
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  employeeRole: string;
  department: string;
  // Asset
  assetName: string;
  assetTag: string;
  assetType: string;
  assetCategory: string;
  serialNumber: string;
  brand: string;
  model: string;
  location: string;
  // Assignment
  assignedDate: string;
  assignedBy: string;
  notes: string;
  // Organization
  orgName: string;
  orgLogoUrl?: string;
}

/**
 * Sends asset assignment details + acknowledgement form PDF to the employee.
 * Email is built via the shared org-branded template and delivered through Gmail.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendAssignmentEmail(payload: AssignmentEmailPayload): Promise<void> {
  try {
    if (!isGmailConfigured()) {
      console.warn('[AssignmentEmail] Gmail credentials not configured');
      return;
    }
    if (!payload.employeeEmail) {
      console.warn(`[AssignmentEmail] No email for ${payload.employeeName}, skipping`);
      return;
    }

    // Build the acknowledgement PDF
    const ackData: AcknowledgementData = { ...payload };
    const pdfBlob = generateAcknowledgementPDF(ackData);

    // Build the HTML body (org-branded, matches template used elsewhere)
    const body =
      `<p style="margin:0 0 12px;">An asset has been assigned to you by <strong>${escape(payload.assignedBy)}</strong>.</p>` +
      detailsTable([
        ['Asset', payload.assetName],
        ['Tag', payload.assetTag],
        ['Category', payload.assetCategory || payload.assetType],
        ['Brand / Model', [payload.brand, payload.model].filter(Boolean).join(' ')],
        ['Serial #', payload.serialNumber],
        ['Location', payload.location],
        ['Assigned On', payload.assignedDate],
        ['Notes', payload.notes || ''],
      ]) +
      infoBox('Please review the attached acknowledgement form, sign it, and return it to your administrator.');

    const html = buildEmailHtml({
      orgName: payload.orgName,
      orgLogoUrl: payload.orgLogoUrl,
      recipientName: payload.employeeName,
      subject: `Asset Assigned: ${payload.assetName}`,
      headline: 'Asset Assigned to You',
      body,
    });

    const filename = `ACK-${payload.assetTag}-${payload.employeeName.replace(/\s+/g, '_')}.pdf`;

    const result = await sendGmail({
      to: payload.employeeEmail,
      toName: payload.employeeName,
      subject: `Asset Assigned: ${payload.assetName} (${payload.assetTag})`,
      html,
      attachments: [
        { filename, mimeType: 'application/pdf', content: pdfBlob },
      ],
    });

    if (!result.ok) {
      console.error(`[AssignmentEmail] Send failed: ${result.error}`);
    }
  } catch (err) {
    console.error('[AssignmentEmail] Unexpected error:', err);
  }
}

function escape(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  );
}
