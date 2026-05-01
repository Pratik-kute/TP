// Builds the multi-page Asset Audit Report PDF using pdf-lib (Deno-native).
//
// Layout follows the Bizzfly template:
//   Cover -> §1 Exec Summary -> §2 Scope -> §3 Inventory -> §4 Computing
//        -> §5 Monitors -> §6 Peripherals -> §7 Mobile -> §8 Misc
//        -> §9 Audit Flags -> §10 CPU Register -> §11 Recommendations -> §12 Conclusion
//
// v1 limitations (documented in plan): no embedded TTF (sanitizes to ASCII to
// stay safe with WinAnsi), no charts (uses stat blocks + simple bars instead).

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'https://esm.sh/pdf-lib@1.17.1';
import type { ComputedStats } from './stats.ts';
import type { Narrative } from './openai.ts';

export interface BuildAuditReportInput {
  organizationName: string;
  organizationShortName: string;
  stats: ComputedStats;
  narrative: Narrative;
  periodLabel: string;
}

// Theme colors (matched roughly to template's emerald/zinc palette)
const COLOR_PRIMARY = rgb(0.07, 0.52, 0.40);   // emerald-600
const COLOR_TEXT = rgb(0.18, 0.18, 0.20);      // zinc-800
const COLOR_MUTED = rgb(0.42, 0.42, 0.46);     // zinc-500
const COLOR_RULE = rgb(0.85, 0.85, 0.88);      // zinc-200
const COLOR_TABLE_HEADER = rgb(0.93, 0.97, 0.95); // emerald-50
const COLOR_FLAG = rgb(0.80, 0.36, 0.04);      // amber-700
const COLOR_WHITE = rgb(1, 1, 1);

// Page geometry (Letter size 612 x 792)
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 50;
const MARGIN_Y = 60;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Sanitize text for WinAnsi-safe StandardFonts (Helvetica). Replaces common
// Unicode punctuation with ASCII equivalents and strips anything else.
// (TTF font embedding is the proper v2 fix.)
function sanitize(input: unknown): string {
  if (input == null) return '';
  return String(input)
    .replace(/[\u2013\u2014]/g, '-')   // en/em dash
    .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/\u2026/g, '...')         // ellipsis
    .replace(/\u26A0/g, '!')           // warning sign
    .replace(/\u00A0/g, ' ')           // nbsp
    .replace(/[\u2022\u00B7]/g, '-')   // bullets
    // Drop anything outside basic Latin / Latin-1
    .replace(/[^\x20-\xFE\n]/g, '');
}

interface DrawCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  meta: { org: string; period: string; location: string };
  pageNumber: number;
  totalPages: { value: number };
}

function newPage(ctx: DrawCtx): void {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN_Y;
  ctx.pageNumber++;
  drawHeader(ctx);
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < MARGIN_Y + 30) newPage(ctx);
}

function drawHeader(ctx: DrawCtx): void {
  ctx.page.drawText(sanitize(`${ctx.meta.org}    |    Asset Audit Report - ${ctx.meta.period}`), {
    x: MARGIN_X,
    y: PAGE_H - 35,
    size: 9,
    font: ctx.bold,
    color: COLOR_PRIMARY,
  });
  ctx.page.drawText('Confidential', {
    x: PAGE_W - MARGIN_X - 50,
    y: PAGE_H - 35,
    size: 9,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: PAGE_H - 42 },
    end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 42 },
    thickness: 0.5,
    color: COLOR_RULE,
  });
}

function drawFooter(ctx: DrawCtx): void {
  const text = sanitize(`Location: ${ctx.meta.location}    |    Prepared: ${ctx.meta.period}`);
  ctx.page.drawText(text, {
    x: MARGIN_X,
    y: 30,
    size: 8,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.page.drawText(`Page ${ctx.pageNumber}`, {
    x: PAGE_W - MARGIN_X - 40,
    y: 30,
    size: 8,
    font: ctx.font,
    color: COLOR_MUTED,
  });
}

function drawSectionHeading(ctx: DrawCtx, text: string): void {
  ensureSpace(ctx, 30);
  ctx.y -= 8;
  ctx.page.drawText(sanitize(text), {
    x: MARGIN_X,
    y: ctx.y,
    size: 14,
    font: ctx.bold,
    color: COLOR_PRIMARY,
  });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: MARGIN_X + 60, y: ctx.y },
    thickness: 1.5,
    color: COLOR_PRIMARY,
  });
  ctx.y -= 14;
}

function drawSubHeading(ctx: DrawCtx, text: string): void {
  ensureSpace(ctx, 22);
  ctx.page.drawText(sanitize(text), {
    x: MARGIN_X,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.y -= 16;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = sanitize(text);
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(ctx: DrawCtx, text: string, size = 10, color = COLOR_TEXT): void {
  for (const para of String(text || '').split(/\n\n+/)) {
    const lines = wrapText(para, ctx.font, size, CONTENT_W);
    for (const line of lines) {
      ensureSpace(ctx, size + 4);
      ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y, size, font: ctx.font, color });
      ctx.y -= size + 4;
    }
    ctx.y -= 4;
  }
}

interface Column { header: string; key: string; width: number; align?: 'left' | 'right' | 'center' }

function drawTable(
  ctx: DrawCtx,
  columns: Column[],
  rows: Array<Record<string, string | number>>,
): void {
  const rowH = 18;
  const headerH = 22;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  let x0 = MARGIN_X;
  if (totalW < CONTENT_W) x0 = MARGIN_X; // left-aligned
  // Header
  ensureSpace(ctx, headerH + rowH);
  ctx.page.drawRectangle({
    x: x0,
    y: ctx.y - headerH + 6,
    width: totalW,
    height: headerH,
    color: COLOR_TABLE_HEADER,
    borderColor: COLOR_RULE,
    borderWidth: 0.5,
  });
  let cx = x0;
  for (const col of columns) {
    ctx.page.drawText(sanitize(col.header), {
      x: cx + 6,
      y: ctx.y - 8,
      size: 9,
      font: ctx.bold,
      color: COLOR_PRIMARY,
    });
    cx += col.width;
  }
  ctx.y -= headerH;

  // Rows
  for (const row of rows) {
    if (ctx.y - rowH < MARGIN_Y + 30) {
      newPage(ctx);
      drawTable(ctx, columns, []); // re-draws header on new page
    }
    cx = x0;
    for (const col of columns) {
      const raw = sanitize(row[col.key] ?? '');
      const truncated = truncateToWidth(raw, ctx.font, 8.5, col.width - 12);
      ctx.page.drawText(truncated, {
        x: cx + 6,
        y: ctx.y - 6,
        size: 8.5,
        font: ctx.font,
        color: COLOR_TEXT,
      });
      cx += col.width;
    }
    ctx.page.drawLine({
      start: { x: x0, y: ctx.y - rowH + 4 },
      end: { x: x0 + totalW, y: ctx.y - rowH + 4 },
      thickness: 0.4,
      color: COLOR_RULE,
    });
    ctx.y -= rowH;
  }
  ctx.y -= 6;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = text.slice(0, mid) + '...';
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  return text.slice(0, Math.max(0, lo - 1)) + '...';
}

// ----- Main entry -----

export async function buildAuditReport(input: BuildAuditReportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: DrawCtx = {
    pdf,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN_Y,
    font,
    bold,
    meta: {
      org: input.organizationName,
      period: input.periodLabel,
      location: input.stats.period.locationName,
    },
    pageNumber: 1,
    totalPages: { value: 0 },
  };

  // ----- Cover page -----
  drawHeader(ctx);
  ctx.y = PAGE_H - 130;
  ctx.page.drawText(sanitize(input.organizationName.toUpperCase()), {
    x: MARGIN_X,
    y: ctx.y,
    size: 32,
    font: bold,
    color: COLOR_PRIMARY,
  });
  ctx.y -= 36;
  ctx.page.drawText('Assets Audit Report', {
    x: MARGIN_X,
    y: ctx.y,
    size: 20,
    font: bold,
    color: COLOR_TEXT,
  });
  ctx.y -= 24;
  ctx.page.drawText(input.periodLabel, {
    x: MARGIN_X,
    y: ctx.y,
    size: 14,
    font,
    color: COLOR_MUTED,
  });
  ctx.y -= 40;
  ctx.page.drawText(sanitize(`Location: ${ctx.meta.location}`), {
    x: MARGIN_X,
    y: ctx.y,
    size: 11,
    font,
    color: COLOR_TEXT,
  });
  ctx.y -= 16;
  ctx.page.drawText('Classification: Confidential - Internal Use Only', {
    x: MARGIN_X,
    y: ctx.y,
    size: 11,
    font,
    color: COLOR_TEXT,
  });

  // KPI stat blocks
  ctx.y -= 60;
  drawStatGrid(ctx, [
    { label: 'Total Assets', value: String(input.stats.totals.assets) },
    { label: 'Desktops', value: String(input.stats.totals.desktops) },
    { label: 'Monitors', value: String(input.stats.totals.monitors) },
    { label: 'Peripherals', value: String(input.stats.totals.peripherals) },
    { label: 'Mobile', value: String(input.stats.totals.mobile) },
  ]);
  drawFooter(ctx);

  // ----- §1 Executive Summary -----
  newPage(ctx);
  drawSectionHeading(ctx, '1. Executive Summary');
  drawParagraph(ctx, input.narrative.executiveSummary);
  drawFooter(ctx);

  // ----- §2 Scope & Methodology -----
  newPage(ctx);
  drawSectionHeading(ctx, '2. Audit Scope & Methodology');
  drawSubHeading(ctx, '2.1 Scope');
  drawParagraph(ctx,
    '- Physical inspection of all IT hardware and office assets at the premises\n' +
    '- Verification of asset tags, serial numbers, and device configurations\n' +
    '- Documentation of all computing equipment, peripheral devices, and miscellaneous assets\n' +
    '- Cross-referencing of physical assets against existing records');
  drawSubHeading(ctx, '2.2 Methodology');
  drawParagraph(ctx,
    '- One-to-one physical verification of each asset against its asset tag\n' +
    '- Recording of hardware specifications (processor, RAM, storage, graphics card)\n' +
    '- Checking for missing, damaged, or unlabelled items\n' +
    '- Separate tracking of mobile assets in a dedicated sheet\n' +
    '- Summary count compiled for each asset category at the end of the audit');
  drawFooter(ctx);

  // ----- §3 Asset Inventory Overview -----
  newPage(ctx);
  drawSectionHeading(ctx, '3. Asset Inventory Overview');
  drawParagraph(ctx, 'The table below presents the complete inventory count across all asset categories discovered during the audit.');
  drawTable(ctx,
    [
      { header: '#', key: 'idx', width: 30 },
      { header: 'Asset Category', key: 'category', width: 280 },
      { header: 'Total Quantity', key: 'quantity', width: 100 },
      { header: 'Location', key: 'location', width: 102 },
    ],
    input.stats.inventory.map((r, i) => ({
      idx: i + 1,
      category: r.category,
      quantity: r.quantity,
      location: r.location,
    })),
  );
  drawFooter(ctx);

  // ----- §4 Computing Equipment Analysis -----
  newPage(ctx);
  drawSectionHeading(ctx, '4. Computing Equipment Analysis');
  drawSubHeading(ctx, '4.1 Desktops & Laptops');
  drawParagraph(ctx,
    `A total of ${input.stats.totals.desktops} desktop unit(s) and ${input.stats.totals.laptops} laptop(s) ` +
    `were audited during this period. The breakdown of processor and RAM configuration is shown below.`);
  // Processor table
  drawSubHeading(ctx, '4.2 Processor Distribution');
  drawTable(ctx,
    [
      { header: 'Processor', key: 'processor', width: 360 },
      { header: 'Units', key: 'units', width: 152 },
    ],
    Object.entries(input.stats.computing.processorBreakdown).map(([k, v]) => ({
      processor: k, units: v,
    })),
  );
  drawSubHeading(ctx, '4.3 RAM Configuration');
  drawTable(ctx,
    [
      { header: 'RAM', key: 'ram', width: 360 },
      { header: 'Units', key: 'units', width: 152 },
    ],
    Object.entries(input.stats.computing.ramBreakdown).map(([k, v]) => ({
      ram: k, units: v,
    })),
  );
  drawFooter(ctx);

  // ----- §5 Monitors -----
  newPage(ctx);
  drawSectionHeading(ctx, '5. Monitors');
  drawParagraph(ctx,
    `${input.stats.totals.monitors} monitor(s) were physically verified and tagged during this audit period. ` +
    `All monitor serial numbers, model identifiers, and assignment to workstations have been recorded in the central asset register.`);
  drawFooter(ctx);

  // ----- §6 Peripheral Devices -----
  newPage(ctx);
  drawSectionHeading(ctx, '6. Peripheral Devices');
  drawTable(ctx,
    [
      { header: 'Peripheral', key: 'peripheral', width: 200 },
      { header: 'Recorded', key: 'recorded', width: 100 },
      { header: 'Workstations', key: 'ws', width: 110 },
      { header: 'Gap', key: 'gap', width: 102 },
    ],
    [
      { peripheral: 'Keyboards', recorded: input.stats.peripherals.keyboards, ws: input.stats.peripherals.workstations, gap: input.stats.peripherals.keyboardGap },
      { peripheral: 'Mice', recorded: input.stats.peripherals.mice, ws: input.stats.peripherals.workstations, gap: input.stats.peripherals.mouseGap },
      { peripheral: 'Adaptors', recorded: input.stats.peripherals.adaptors, ws: input.stats.peripherals.workstations, gap: input.stats.peripherals.adaptorGap },
    ],
  );
  drawFooter(ctx);

  // ----- §7 Mobile Assets -----
  newPage(ctx);
  drawSectionHeading(ctx, '7. Mobile Assets');
  if (input.stats.mobile.length === 0) {
    drawParagraph(ctx, 'No mobile assets are currently registered under the inventory.');
  } else {
    drawTable(ctx,
      [
        { header: '#', key: 'idx', width: 30 },
        { header: 'Asset Tag', key: 'tag', width: 100 },
        { header: 'Device', key: 'device', width: 220 },
        { header: 'Serial', key: 'serial', width: 162 },
      ],
      input.stats.mobile.map((m, i) => ({
        idx: i + 1,
        tag: m.tag,
        device: `${m.brand} ${m.model}`.trim() || m.name,
        serial: m.serialNumber || '-',
      })),
    );
  }
  drawFooter(ctx);

  // ----- §8 Miscellaneous & Office Assets -----
  newPage(ctx);
  drawSectionHeading(ctx, '8. Miscellaneous & Office Assets');
  if (input.stats.miscellaneous.length === 0) {
    drawParagraph(ctx, 'No miscellaneous office assets were catalogued during this audit period.');
  } else {
    drawTable(ctx,
      [
        { header: '#', key: 'idx', width: 30 },
        { header: 'Asset', key: 'asset', width: 220 },
        { header: 'Asset Tag', key: 'tag', width: 110 },
        { header: 'Description', key: 'desc', width: 152 },
      ],
      input.stats.miscellaneous.slice(0, 20).map((m, i) => ({
        idx: i + 1,
        asset: m.name,
        tag: m.tag,
        desc: m.description,
      })),
    );
  }
  drawFooter(ctx);

  // ----- §9 Audit Flags & Issues -----
  newPage(ctx);
  drawSectionHeading(ctx, '9. Audit Flags & Issues');
  drawParagraph(ctx, input.narrative.auditFlagsCommentary);
  if (input.stats.flags.length > 0) {
    drawTable(ctx,
      [
        { header: '#', key: 'idx', width: 30 },
        { header: 'Issue Category', key: 'category', width: 200 },
        { header: 'Affected', key: 'affected', width: 130 },
        { header: 'Recommended Action', key: 'action', width: 152 },
      ],
      input.stats.flags.map((f, i) => ({
        idx: i + 1,
        category: f.category,
        affected: f.affectedAssets,
        action: f.recommendedAction,
      })),
    );
  }
  if (input.stats.deadAssets.length > 0) {
    drawSubHeading(ctx, '9.1 Dead / Retired / Disposed Assets');
    drawTable(ctx,
      [
        { header: '#', key: 'idx', width: 30 },
        { header: 'Asset Tag', key: 'tag', width: 130 },
        { header: 'Name', key: 'name', width: 240 },
        { header: 'Status', key: 'status', width: 112 },
      ],
      input.stats.deadAssets.map((d, i) => ({
        idx: i + 1,
        tag: d.tag,
        name: d.name,
        status: d.status,
      })),
    );
  }
  drawFooter(ctx);

  // ----- §10 Complete CPU Register -----
  newPage(ctx);
  drawSectionHeading(ctx, '10. Complete Computing Asset Register');
  drawParagraph(ctx, 'The table below provides the complete computing asset register with hardware specifications.');
  drawTable(ctx,
    [
      { header: '#', key: 'idx', width: 24 },
      { header: 'Asset Tag', key: 'tag', width: 80 },
      { header: 'Device Name', key: 'name', width: 130 },
      { header: 'Serial No.', key: 'serial', width: 110 },
      { header: 'CPU', key: 'cpu', width: 70 },
      { header: 'RAM', key: 'ram', width: 50 },
      { header: 'GPU', key: 'gpu', width: 48 },
    ],
    input.stats.cpuRegister.map((r, i) => ({
      idx: i + 1,
      tag: r.tag,
      name: r.name,
      serial: r.serialNumber,
      cpu: r.cpu,
      ram: r.ram,
      gpu: r.gpu,
    })),
  );
  drawFooter(ctx);

  // ----- §11 Recommendations -----
  newPage(ctx);
  drawSectionHeading(ctx, '11. Recommendations');
  drawParagraph(ctx, input.narrative.recommendations);
  drawFooter(ctx);

  // ----- §12 Conclusion -----
  newPage(ctx);
  drawSectionHeading(ctx, '12. Conclusion');
  drawParagraph(ctx,
    `The ${input.periodLabel} assets audit of ${input.organizationName} has been completed successfully. ` +
    `${input.stats.flags.length} key issue(s) have been flagged in this report. ` +
    `This report should be reviewed by the IT Manager and relevant department heads. A follow-up verification is recommended within 45 days of corrective actions being taken.`);
  ctx.y -= 20;
  drawSubHeading(ctx, 'Report Prepared By');
  drawParagraph(ctx, `IT/Admin Team - ${input.organizationName}\nDate: ${input.periodLabel}\nLocation: ${ctx.meta.location}`);
  drawFooter(ctx);

  return await pdf.save();
}

function drawStatGrid(ctx: DrawCtx, items: Array<{ label: string; value: string }>): void {
  const cols = Math.min(items.length, 5);
  const cellW = CONTENT_W / cols;
  const cellH = 70;
  const yTop = ctx.y;
  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_X + col * cellW + 4;
    const y = yTop - row * (cellH + 10);
    ctx.page.drawRectangle({
      x,
      y: y - cellH,
      width: cellW - 8,
      height: cellH,
      color: COLOR_TABLE_HEADER,
      borderColor: COLOR_PRIMARY,
      borderWidth: 1,
    });
    const valW = ctx.bold.widthOfTextAtSize(items[i].value, 22);
    ctx.page.drawText(sanitize(items[i].value), {
      x: x + (cellW - 8 - valW) / 2,
      y: y - 32,
      size: 22,
      font: ctx.bold,
      color: COLOR_PRIMARY,
    });
    const labW = ctx.font.widthOfTextAtSize(items[i].label, 9);
    ctx.page.drawText(sanitize(items[i].label), {
      x: x + (cellW - 8 - labW) / 2,
      y: y - 52,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    });
  }
  ctx.y = yTop - cellH - 20;
}
