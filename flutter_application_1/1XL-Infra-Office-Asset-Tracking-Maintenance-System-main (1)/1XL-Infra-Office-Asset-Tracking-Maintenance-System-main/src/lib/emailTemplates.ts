/**
 * Professional HTML email template generator.
 * Generates org-branded, responsive HTML emails for all notification events.
 * Inspired by GoHighLevel / Salesforce transactional email style.
 */

export interface EmailTemplateData {
  orgName: string;
  orgLogoUrl?: string;
  recipientName: string;
  subject: string;
  headline: string;
  body: string; // HTML body content (paragraphs, lists, etc.)
  ctaText?: string;
  ctaUrl?: string;
  footerText?: string;
}

/** Accent color for email elements */
const ACCENT = '#10b981';
const ACCENT_DARK = '#059669';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#6b7280';
const BG_PAGE = '#f4f4f5';
const BG_CARD = '#ffffff';
const BORDER = '#e5e7eb';

export function buildEmailHtml(data: EmailTemplateData): string {
  const {
    orgName,
    orgLogoUrl,
    recipientName,
    headline,
    body,
    ctaText,
    ctaUrl,
    footerText,
  } = data;

  const logoBlock = orgLogoUrl
    ? `<img src="${orgLogoUrl}" alt="${orgName}" style="max-height:40px;max-width:160px;object-fit:contain;" />`
    : `<span style="font-size:20px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:-0.3px;">${orgName}</span>`;

  const ctaBlock = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;padding:12px 32px;background:${TEXT_PRIMARY};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${ctaText}</a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PAGE};padding:32px 16px;">
<tr><td align="center">

<!-- Container -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">

  <!-- Header -->
  <tr><td style="padding:24px 32px;text-align:center;">
    ${logoBlock}
  </td></tr>

  <!-- Card -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_CARD};border-radius:12px;border:1px solid ${BORDER};overflow:hidden;">

      <!-- Accent bar -->
      <tr><td style="height:4px;background:linear-gradient(90deg,${ACCENT},${ACCENT_DARK});"></td></tr>

      <!-- Content -->
      <tr><td style="padding:32px 32px 24px;">

        <!-- Greeting -->
        <p style="margin:0 0 20px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.5;">Hi ${recipientName},</p>

        <!-- Headline -->
        <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};line-height:1.3;">${headline}</h1>

        <!-- Body -->
        <div style="font-size:15px;color:${TEXT_PRIMARY};line-height:1.65;">
          ${body}
        </div>

        ${ctaBlock}

      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:${TEXT_SECONDARY};">${footerText || `This is an automated notification from ${orgName}.`}</p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}


// ──────────────────────────────────────────────
// Pre-built content generators for each event
// ──────────────────────────────────────────────

/** Utility: wrap key-value pairs into a styled details table */
export function detailsTable(rows: [string, string][]): string {
  const trs = rows
    .filter(([, v]) => v)
    .map(([label, value]) =>
      `<tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;color:${TEXT_SECONDARY};white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:6px 0;font-size:13px;color:${TEXT_PRIMARY};font-weight:500;">${value}</td>
      </tr>`
    ).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;border-collapse:collapse;">${trs}</table>`;
}

/** Utility: info box with a background color */
export function infoBox(text: string, color: string = '#f0fdf4', borderColor: string = ACCENT): string {
  return `<div style="margin:16px 0;padding:14px 16px;background:${color};border-left:4px solid ${borderColor};border-radius:6px;font-size:14px;color:${TEXT_PRIMARY};line-height:1.5;">${text}</div>`;
}

/** Utility: status badge */
export function statusBadge(text: string, bgColor: string = '#ecfdf5', textColor: string = '#059669'): string {
  return `<span style="display:inline-block;padding:3px 10px;background:${bgColor};color:${textColor};font-size:12px;font-weight:600;border-radius:20px;text-transform:uppercase;letter-spacing:0.3px;">${text}</span>`;
}


// ──────────────────────────────────────────────
// Event-specific email body builders
// ──────────────────────────────────────────────

// User events
export function roleChangedBody(changedBy: string, oldRole: string, newRole: string): string {
  return `<p style="margin:0 0 12px;">Your role has been updated by <strong>${changedBy}</strong>.</p>` +
    detailsTable([['Previous Role', statusBadge(oldRole, '#f3f4f6', '#374151')], ['New Role', statusBadge(newRole)]]) +
    infoBox('Your permissions have been updated to reflect your new role. If you believe this change was made in error, please contact your administrator.');
}

export function profileUpdatedBody(updatedBy: string, changes: string): string {
  return `<p style="margin:0 0 12px;">Your profile has been updated${updatedBy ? ` by <strong>${updatedBy}</strong>` : ''}.</p>` +
    infoBox(changes) +
    `<p style="margin:12px 0 0;font-size:14px;color:${TEXT_SECONDARY};">If you did not authorize this change, please contact your administrator immediately.</p>`;
}

export function userDeactivatedBody(): string {
  return `<p style="margin:0 0 12px;">Your account has been <strong>deactivated</strong>.</p>` +
    infoBox('You will no longer be able to log in to the platform. If you believe this was done in error, please contact your organization administrator.', '#fef2f2', '#ef4444');
}

export function userReactivatedBody(): string {
  return `<p style="margin:0 0 12px;">Your account has been <strong>reactivated</strong>.</p>` +
    infoBox('You can now log in and access the platform as usual. Welcome back!');
}

export function newUserCreatedBody(name: string, email: string, role: string, department: string, password: string, createdBy: string): string {
  return `<p style="margin:0 0 12px;">A new account has been created for you by <strong>${createdBy}</strong>.</p>` +
    detailsTable([
      ['Name', name],
      ['Email', email],
      ['Role', statusBadge(role)],
      ['Department', department],
      ['Temporary Password', `<code style="padding:2px 8px;background:#f3f4f6;border-radius:4px;font-family:monospace;font-size:13px;">${password}</code>`],
    ]) +
    infoBox('Please log in and change your password immediately for security.');
}

// For admins/managers when a user is created
export function newUserCreatedAdminBody(name: string, email: string, role: string, department: string, createdBy: string): string {
  return `<p style="margin:0 0 12px;">A new user has been added to your organization by <strong>${createdBy}</strong>.</p>` +
    detailsTable([['Name', name], ['Email', email], ['Role', statusBadge(role)], ['Department', department]]);
}

export function userDeletedAdminBody(name: string, email: string, deletedBy: string): string {
  return `<p style="margin:0 0 12px;">A user has been removed from your organization by <strong>${deletedBy}</strong>.</p>` +
    detailsTable([['Name', name], ['Email', email]]);
}

// Asset events
export function assetCreatedBody(assetName: string, assetTag: string, category: string, location: string, createdBy: string): string {
  return `<p style="margin:0 0 12px;">A new asset has been registered by <strong>${createdBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Category', category], ['Location', location]]);
}

export function assetStatusChangedBody(assetName: string, assetTag: string, oldStatus: string, newStatus: string, changedBy: string): string {
  return `<p style="margin:0 0 12px;">The status of an asset has been changed by <strong>${changedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Previous Status', statusBadge(oldStatus, '#f3f4f6', '#374151')], ['New Status', statusBadge(newStatus)]]);
}

export function assetOwnerChangedBody(assetName: string, assetTag: string, newOwner: string, changedBy: string): string {
  return `<p style="margin:0 0 12px;">Asset ownership has been updated by <strong>${changedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['New Owner', newOwner]]);
}

export function assetLocationChangedBody(assetName: string, assetTag: string, oldLocation: string, newLocation: string, changedBy: string): string {
  return `<p style="margin:0 0 12px;">An asset has been relocated by <strong>${changedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['From', oldLocation], ['To', newLocation]]);
}

export function assetDeletedBody(assetName: string, assetTag: string, deletedBy: string): string {
  return `<p style="margin:0 0 12px;">An asset has been removed from the system by <strong>${deletedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag]]) +
    infoBox('This asset record has been permanently deleted.', '#fef2f2', '#ef4444');
}

export function bulkImportBody(count: number, importedBy: string): string {
  return `<p style="margin:0 0 12px;"><strong>${count}</strong> assets have been imported via bulk upload by <strong>${importedBy}</strong>.</p>` +
    infoBox('Please review the imported assets to ensure all records are accurate.');
}

// Allocation events
export function allocationRequestedBody(assetName: string, employeeName: string, requestedBy: string): string {
  return `<p style="margin:0 0 12px;">A new asset allocation request has been submitted by <strong>${requestedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Requested For', employeeName]]) +
    infoBox('This request is pending your review and approval.');
}

export function allocationApprovedBody(assetName: string, assetTag: string, approvedBy: string): string {
  return `<p style="margin:0 0 12px;">Your asset allocation request has been <strong>approved</strong> by <strong>${approvedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag]]) +
    infoBox('The asset has been assigned to you. Please acknowledge receipt when you collect it.');
}

export function allocationRejectedBody(assetName: string, rejectedBy: string, reason: string): string {
  return `<p style="margin:0 0 12px;">Your asset allocation request has been <strong>rejected</strong> by <strong>${rejectedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Reason', reason || 'No reason provided']]) +
    infoBox('If you have questions about this decision, please contact your manager.', '#fef2f2', '#ef4444');
}

export function assetReturnedBody(assetName: string, assetTag: string, returnedBy: string): string {
  return `<p style="margin:0 0 12px;">An asset has been returned by <strong>${returnedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag]]) +
    infoBox('The asset is now back in inventory and available for reallocation.');
}

export function assetReturnedEmployeeBody(assetName: string, assetTag: string): string {
  return `<p style="margin:0 0 12px;">Your asset return has been processed.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag]]) +
    infoBox('This asset has been removed from your assigned inventory.');
}

// Maintenance events
export function maintenanceScheduledBody(assetName: string, assetTag: string, scheduledDate: string, assignedBy: string, description: string): string {
  return `<p style="margin:0 0 12px;">You have been assigned a maintenance task by <strong>${assignedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Scheduled Date', scheduledDate], ['Description', description || 'N/A']]);
}

export function maintenanceInProgressBody(assetName: string, assetTag: string, technician: string): string {
  return `<p style="margin:0 0 12px;">Maintenance is now in progress.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Technician', technician]]);
}

export function maintenanceCompletedBody(assetName: string, assetTag: string, completedBy: string, cost: string): string {
  return `<p style="margin:0 0 12px;">Maintenance has been completed.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Completed By', completedBy], ['Cost', cost || 'N/A']]) +
    infoBox('The asset is now back in operational status.');
}

// Repair events
export function repairCreatedBody(assetName: string, assetTag: string, issue: string, priority: string, reportedBy: string): string {
  return `<p style="margin:0 0 12px;">A new repair request has been created by <strong>${reportedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Issue', issue], ['Priority', statusBadge(priority, priority === 'critical' ? '#fef2f2' : '#fef9c3', priority === 'critical' ? '#dc2626' : '#ca8a04')]]);
}

export function repairStatusUpdatedBody(assetName: string, assetTag: string, oldStatus: string, newStatus: string, updatedBy: string): string {
  return `<p style="margin:0 0 12px;">Repair status has been updated by <strong>${updatedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Previous Status', statusBadge(oldStatus, '#f3f4f6', '#374151')], ['New Status', statusBadge(newStatus)]]);
}

// Procurement events
export function procurementRequestedBody(itemName: string, quantity: number, requestedBy: string, estimatedCost: string): string {
  return `<p style="margin:0 0 12px;">A new procurement request has been submitted by <strong>${requestedBy}</strong>.</p>` +
    detailsTable([['Item', itemName], ['Quantity', String(quantity)], ['Estimated Cost', estimatedCost || 'N/A']]) +
    infoBox('This request is pending your review.');
}

export function procurementApprovedBody(itemName: string, quantity: number, approvedBy: string): string {
  return `<p style="margin:0 0 12px;">Your procurement request has been <strong>approved</strong> by <strong>${approvedBy}</strong>.</p>` +
    detailsTable([['Item', itemName], ['Quantity', String(quantity)]]);
}

export function procurementRejectedBody(itemName: string, rejectedBy: string, reason: string): string {
  return `<p style="margin:0 0 12px;">Your procurement request has been <strong>rejected</strong> by <strong>${rejectedBy}</strong>.</p>` +
    detailsTable([['Item', itemName], ['Reason', reason || 'No reason provided']]) +
    infoBox('Contact the approver if you have questions.', '#fef2f2', '#ef4444');
}

export function procurementOrderedBody(itemName: string, quantity: number, orderedBy: string): string {
  return `<p style="margin:0 0 12px;">A procurement order has been placed by <strong>${orderedBy}</strong>.</p>` +
    detailsTable([['Item', itemName], ['Quantity', String(quantity)]]);
}

export function procurementReceivedBody(itemName: string, quantity: number, receivedBy: string): string {
  return `<p style="margin:0 0 12px;">Procurement items have been received.</p>` +
    detailsTable([['Item', itemName], ['Quantity', String(quantity)], ['Received By', receivedBy]]) +
    infoBox('The items are now available in inventory.');
}

// Asset request events
export function assetRequestCreatedBody(assetType: string, justification: string, requestedBy: string): string {
  return `<p style="margin:0 0 12px;">A new asset request has been submitted by <strong>${requestedBy}</strong>.</p>` +
    detailsTable([['Requested Asset', assetType], ['Justification', justification || 'N/A']]) +
    infoBox('This request is pending your review.');
}

export function assetRequestApprovedBody(assetType: string, approvedBy: string): string {
  return `<p style="margin:0 0 12px;">Your asset request has been <strong>approved</strong> by <strong>${approvedBy}</strong>.</p>` +
    detailsTable([['Requested Asset', assetType]]);
}

export function assetRequestRejectedBody(assetType: string, rejectedBy: string, reason: string): string {
  return `<p style="margin:0 0 12px;">Your asset request has been <strong>rejected</strong> by <strong>${rejectedBy}</strong>.</p>` +
    detailsTable([['Requested Asset', assetType], ['Reason', reason || 'No reason provided']]);
}

export function assetRequestFulfilledBody(assetType: string, fulfilledBy: string): string {
  return `<p style="margin:0 0 12px;">Your asset request has been <strong>fulfilled</strong> by <strong>${fulfilledBy}</strong>.</p>` +
    detailsTable([['Requested Asset', assetType]]) +
    infoBox('The requested asset has been allocated to you.');
}

export function assetRequestCancelledBody(assetType: string, cancelledBy: string): string {
  return `<p style="margin:0 0 12px;">An asset request has been cancelled by <strong>${cancelledBy}</strong>.</p>` +
    detailsTable([['Requested Asset', assetType]]);
}

// Consumable events
export function lowStockBody(itemName: string, currentStock: number, threshold: number): string {
  return `<p style="margin:0 0 12px;">A consumable item is running low on stock.</p>` +
    detailsTable([['Item', itemName], ['Current Stock', String(currentStock)], ['Alert Threshold', String(threshold)]]) +
    infoBox('Please reorder this item to avoid stockouts.', '#fef9c3', '#ca8a04');
}

// Recovery events
export function recoveryReportedBody(assetName: string, assetTag: string, incidentType: string, reportedBy: string, description: string): string {
  const color = incidentType === 'stolen' ? '#fef2f2' : '#fef9c3';
  const border = incidentType === 'stolen' ? '#ef4444' : '#ca8a04';
  return `<p style="margin:0 0 12px;">An asset incident has been reported by <strong>${reportedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['Incident Type', statusBadge(incidentType, color, border)], ['Description', description || 'N/A']]) +
    infoBox('Please investigate this incident and take appropriate action.', color, border);
}

export function recoveryUpdatedBody(assetName: string, assetTag: string, newStatus: string, updatedBy: string): string {
  return `<p style="margin:0 0 12px;">A recovery incident has been updated by <strong>${updatedBy}</strong>.</p>` +
    detailsTable([['Asset', assetName], ['Tag', assetTag], ['New Status', statusBadge(newStatus)]]);
}

// Generic / system notifications
export function genericNotificationBody(message: string): string {
  return `<p style="margin:0;line-height:1.65;">${message}</p>`;
}

// Subscription expiry reminder
export function subscriptionExpiryBody(
  planName: string,
  expiryDate: string,
  daysRemaining: number,
): string {
  const warnBg     = daysRemaining === 0 ? '#fef2f2' : daysRemaining <= 3 ? '#fef9c3' : '#fff7ed';
  const warnBorder = daysRemaining === 0 ? '#ef4444' : daysRemaining <= 3 ? '#eab308' : '#f97316';
  const warnColor  = daysRemaining === 0 ? '#dc2626' : daysRemaining <= 3 ? '#a16207' : '#c2410c';

  const urgencyLine =
    daysRemaining === 0
      ? 'Your subscription <strong>expires today</strong>.'
      : daysRemaining === 1
      ? 'Your subscription expires <strong>tomorrow</strong>.'
      : `Your subscription expires in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong>.`;

  return (
    `<div style="margin:0 0 16px;padding:14px 16px;background:${warnBg};border-left:4px solid ${warnBorder};border-radius:6px;font-size:15px;color:${warnColor};font-weight:600;">${urgencyLine}</div>` +
    detailsTable([
      ['Plan',          statusBadge(planName)],
      ['Expiry Date',   expiryDate],
      ['Days Remaining', `<span style="color:${warnColor};font-weight:700;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</span>`],
    ]) +
    `<p style="margin:12px 0 8px;font-size:14px;line-height:1.65;">To avoid any disruption, please renew or upgrade your plan before the expiry date.</p>` +
    `<p style="margin:0;font-size:13px;color:${TEXT_SECONDARY};line-height:1.6;">After expiry your organization will revert to the <strong>Beginner</strong> plan and access to advanced features will be restricted until renewed.</p>`
  );
}
