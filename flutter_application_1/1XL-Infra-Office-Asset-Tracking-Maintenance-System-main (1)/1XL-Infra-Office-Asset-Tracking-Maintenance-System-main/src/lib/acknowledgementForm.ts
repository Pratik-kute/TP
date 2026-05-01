import jsPDF from 'jspdf';

export interface AcknowledgementData {
  // Organization
  orgName: string;
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
}

/**
 * Generates a professional Asset Acknowledgement Form as a PDF.
 * Returns a Blob suitable for sending via webhook or downloading.
 */
export function generateAcknowledgementPDF(d: AcknowledgementData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const lm = 20; // left margin
  const rm = pw - 20; // right margin
  let y = 20;

  // ---- Helper functions ----
  const line = (y1: number) => { doc.setDrawColor(100, 100, 200); doc.setLineWidth(0.3); doc.line(lm, y1, rm, y1); };
  const label = (text: string, x: number, yPos: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 120); doc.text(text, x, yPos); };
  const value = (text: string, x: number, yPos: number, maxW?: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30); doc.text(text || 'N/A', x, yPos, maxW ? { maxWidth: maxW } : undefined); };

  // ---- Header ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(60, 60, 140);
  doc.text(d.orgName, pw / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text('Asset Acknowledgement Form', pw / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Document ID: ACK-${d.assetTag}-${Date.now().toString(36).toUpperCase()}`, pw / 2, y, { align: 'center' });
  y += 3;
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });
  y += 6;
  line(y); y += 8;

  // ---- Section: Employee Information ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 140);
  doc.text('1. Employee Information', lm, y);
  y += 7;

  const col2 = pw / 2 + 5;
  label('Full Name', lm, y); label('Email', col2, y); y += 4;
  value(d.employeeName, lm, y); value(d.employeeEmail, col2, y); y += 7;
  label('Phone', lm, y); label('Department', col2, y); y += 4;
  value(d.employeePhone || 'N/A', lm, y); value(d.department, col2, y); y += 7;
  label('Role / Designation', lm, y); y += 4;
  value(d.employeeRole, lm, y); y += 8;
  line(y); y += 8;

  // ---- Section: Asset Details ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 140);
  doc.text('2. Asset Details', lm, y);
  y += 7;

  label('Asset Name', lm, y); label('Asset Tag', col2, y); y += 4;
  value(d.assetName, lm, y); value(d.assetTag, col2, y); y += 7;
  label('Type', lm, y); label('Category', col2, y); y += 4;
  value(d.assetType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), lm, y); value(d.assetCategory || 'N/A', col2, y); y += 7;
  label('Brand', lm, y); label('Model', col2, y); y += 4;
  value(d.brand || 'N/A', lm, y); value(d.model || 'N/A', col2, y); y += 7;
  label('Serial Number', lm, y); label('Location', col2, y); y += 4;
  value(d.serialNumber || 'N/A', lm, y); value(d.location || 'N/A', col2, y); y += 8;
  line(y); y += 8;

  // ---- Section: Assignment Details ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 140);
  doc.text('3. Assignment Details', lm, y);
  y += 7;

  label('Date of Assignment', lm, y); label('Assigned By', col2, y); y += 4;
  value(d.assignedDate, lm, y); value(d.assignedBy, col2, y); y += 7;
  if (d.notes) {
    label('Notes', lm, y); y += 4;
    value(d.notes, lm, y, rm - lm); y += 8;
  }
  line(y); y += 8;

  // ---- Section: Terms & Conditions ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 140);
  doc.text('4. Terms & Conditions', lm, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const terms = [
    'I acknowledge receipt of the above-mentioned asset(s) in good working condition.',
    'I agree to use the asset(s) solely for official purposes related to my role.',
    'I accept responsibility for the care and safekeeping of the asset(s).',
    'I will report any damage, loss, or malfunction immediately to my manager or IT department.',
    'I understand that the asset(s) remain the property of the organization at all times.',
    'Upon termination of employment or upon request, I will return the asset(s) in the same condition as received, subject to reasonable wear and tear.',
    'I understand that failure to return the asset(s) may result in deductions from my final settlement.',
  ];
  terms.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, rm - lm - 5);
    doc.text(lines, lm + 3, y);
    y += lines.length * 4.5;
  });
  y += 4;
  line(y); y += 10;

  // ---- Section: Signatures ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 140);
  doc.text('5. Acknowledgement & Signatures', lm, y);
  y += 10;

  // Employee signature block
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(lm, y + 12, lm + 70, y + 12);
  doc.line(col2, y + 12, col2 + 70, y + 12);
  y += 14;
  label('Employee Signature', lm, y); label('Date', col2, y);
  y += 10;

  label('Employee Name (Print)', lm, y);
  y += 4;
  value(d.employeeName, lm, y);
  y += 12;

  // Manager / Authority signature block
  doc.line(lm, y, lm + 70, y);
  doc.line(col2, y, col2 + 70, y);
  y += 2;
  label('Authorized Signature', lm, y); label('Date', col2, y);
  y += 10;

  label('Name (Print)', lm, y);
  y += 4;
  value(d.assignedBy, lm, y);

  // ---- Footer ----
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('This is an auto-generated document. Please sign, scan, and return to your administrator.', pw / 2, footerY, { align: 'center' });
  doc.text(`${d.orgName} | Asset Management System`, pw / 2, footerY + 4, { align: 'center' });

  return doc.output('blob');
}
