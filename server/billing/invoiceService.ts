/**
 * Invoice generation — pdfkit PDF → MinIO storage → DB record.
 * Follows standard accounting layout: header, items table, totals, footer.
 */
import PDFDocument from 'pdfkit';
import { Client as MinioClient } from 'minio';
import crypto from 'node:crypto';
import { LALELA_INVOICE_LOGO_BUFFER } from './emailAssets.js';
import { getApiBaseUrl } from '../lib/urls.js';
import type { PrismaClient } from '../generated/prisma/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  invoiceNumber: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  type: 'COMMUNITY' | 'MEMBERSHIP';
  amount: number; // cents
  // Optional context for the welcome / community panel
  communityName?: string;
  communityActivatedAt?: Date;
  memberCount?: number;
  postCount?: number;
  platformRenewalDate?: Date | null;
  canCreateCommunity?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEAL = '#0d3d47';
const ORANGE = '#fc7127';
const CREAM = '#fff8f0';
const MUTED = '#6b7280';

function fmt(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

function getMinioClient(): MinioClient {
  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) throw new Error('MINIO_ENDPOINT not set — cannot store invoices');
  return new MinioClient({
    endPoint: endpoint,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'lalela',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
  });
}

function getInvoiceBucket(): string {
  return process.env.MINIO_INVOICES_BUCKET ?? process.env.MINIO_BUCKET ?? 'lalela';
}

function getInvoiceObjectName(invoiceNumber: string): string {
  return `invoices/${invoiceNumber}.pdf`;
}

function getInvoiceTokenSecret(): string {
  return process.env.INVOICE_LINK_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.MINIO_SECRET_KEY
    ?? 'lalela-invoice-secret';
}

export function createInvoiceAccessToken(invoiceNumber: string): string {
  return crypto
    .createHmac('sha256', getInvoiceTokenSecret())
    .update(invoiceNumber)
    .digest('hex');
}

export function verifyInvoiceAccessToken(invoiceNumber: string, token: string): boolean {
  const expected = createInvoiceAccessToken(invoiceNumber);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function buildInvoiceApiUrl(invoiceNumber: string): string {
  const base = getApiBaseUrl();
  const token = createInvoiceAccessToken(invoiceNumber);
  return `${base}/billing/invoices/${encodeURIComponent(invoiceNumber)}/pdf?token=${token}`;
}

// ─── Invoice Number ───────────────────────────────────────────────────────────

export async function generateInvoiceNumber(prisma: PrismaClient): Promise<string> {
  const count = await prisma.invoice.count();
  const seq = String(count + 1).padStart(4, '0');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `LAL-${date}-${seq}`;
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

export function createInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // autoFirstPage:true (default); we add nothing that could trigger a second page.
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const {
      invoiceNumber, createdAt, userName, userEmail, type, amount,
      communityName, communityActivatedAt, memberCount, postCount,
      platformRenewalDate, canCreateCommunity,
    } = data;

    const PAGE_W = doc.page.width;   // 595
    const PAGE_H = doc.page.height;  // 842
    const LEFT = 50;
    const RIGHT = PAGE_W - 50;

    // Strict column grid for items + totals (eliminates the prior overlap)
    const DESC_X = 58;
    const DESC_W = 240;
    const QTY_X = 320;
    const QTY_W = 40;
    const PRICE_X = 380;
    const PRICE_W = 80;
    const TOTAL_X = 460;
    const TOTAL_W = 65;

    const itemLabel = type === 'COMMUNITY'
      ? 'Community Licence (once-off, lifelong) — includes 1-year Creator Platform Membership'
      : 'Platform Membership — Annual (R99/year)';

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

    // ── 1. Header band ────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 90).fill(TEAL);

    try {
      doc.image(LALELA_INVOICE_LOGO_BUFFER, 46, 14, { width: 64, height: 64 });
    } catch {
      // Logo load failed — continue without it
    }

    doc
      .fillColor('#ffffff')
      .fontSize(22).font('Helvetica-Bold').text('Lalela', 118, 24, { width: 300 })
      .fontSize(10).font('Helvetica').text('Community Platform', 118, 50, { width: 300 })
      .fontSize(9).text('lalela.net  |  admin@lalela.net', 118, 64, { width: 300 });

    doc
      .fillColor('#ffffff')
      .fontSize(22).font('Helvetica-Bold')
      .text('INVOICE', PAGE_W - 200, 34, { width: 150, align: 'right' });

    // ── 2. Bill-to / meta block ───────────────────────────────────────────────
    const infoTop = 110;

    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text('INVOICE TO', LEFT, infoTop, { width: 200 });
    doc.fillColor('#1a1c1a').fontSize(11).font('Helvetica-Bold')
      .text(userName, LEFT, infoTop + 14, { width: 240 });
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica')
      .text(userEmail || ' ', LEFT, infoTop + 30, { width: 240 });

    const rCol = PAGE_W - 220;
    const rColW = 170;
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text('INVOICE NUMBER', rCol, infoTop, { width: rColW });
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica-Bold')
      .text(invoiceNumber, rCol, infoTop + 14, { width: rColW });
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text('DATE', rCol, infoTop + 32, { width: rColW });
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica')
      .text(fmtDate(createdAt), rCol, infoTop + 46, { width: rColW });

    // Divider
    doc.moveTo(LEFT, infoTop + 76).lineTo(RIGHT, infoTop + 76)
      .strokeColor('#e5e7eb').lineWidth(1).stroke();

    // ── 3. Items table ────────────────────────────────────────────────────────
    const tableTop = infoTop + 92;
    doc.rect(LEFT, tableTop, RIGHT - LEFT, 22).fill(TEAL);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('DESCRIPTION', DESC_X, tableTop + 7, { width: DESC_W });
    doc.text('QTY', QTY_X, tableTop + 7, { width: QTY_W, align: 'center' });
    doc.text('UNIT PRICE', PRICE_X, tableTop + 7, { width: PRICE_W, align: 'right' });
    doc.text('TOTAL', TOTAL_X, tableTop + 7, { width: TOTAL_W, align: 'right' });

    const rowTop = tableTop + 30;
    const ROW_H = 32;
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica');
    doc.text(itemLabel, DESC_X, rowTop, { width: DESC_W });
    doc.text('1', QTY_X, rowTop, { width: QTY_W, align: 'center' });
    doc.text(fmt(amount), PRICE_X, rowTop, { width: PRICE_W, align: 'right' });
    doc.text(fmt(amount), TOTAL_X, rowTop, { width: TOTAL_W, align: 'right' });

    // Row divider
    doc.moveTo(LEFT, rowTop + ROW_H).lineTo(RIGHT, rowTop + ROW_H)
      .strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    // ── 4. Totals block ───────────────────────────────────────────────────────
    const totTop = rowTop + ROW_H + 14;
    const labelOpts = { width: PRICE_W, align: 'right' as const };
    const valueOpts = { width: TOTAL_W, align: 'right' as const };

    doc.fillColor(MUTED).fontSize(9).font('Helvetica')
      .text('Subtotal', PRICE_X, totTop, labelOpts);
    doc.fillColor('#1a1c1a')
      .text(fmt(amount), TOTAL_X, totTop, valueOpts);

    doc.fillColor(MUTED)
      .text('VAT (0%)', PRICE_X, totTop + 16, labelOpts);
    doc.fillColor('#1a1c1a')
      .text('R 0.00', TOTAL_X, totTop + 16, valueOpts);

    // Orange TOTAL bar — spans PRICE_X to the right page margin
    const barY = totTop + 34;
    const barH = 28;
    const barX = PRICE_X;
    const barW = RIGHT - PRICE_X;
    doc.rect(barX, barY, barW, barH).fill(ORANGE);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
      .text('TOTAL', PRICE_X + 4, barY + 9, labelOpts);
    doc.fillColor('#ffffff')
      .text(fmt(amount), TOTAL_X, barY + 9, valueOpts);

    // ── 5. Welcome / community panel ──────────────────────────────────────────
    const panelTop = barY + barH + 28;
    const panelH = 200;
    const panelX = LEFT;
    const panelW = RIGHT - LEFT;

    doc.roundedRect(panelX, panelTop, panelW, panelH, 8).fill(CREAM);

    if (type === 'COMMUNITY') {
      const heading = communityName
        ? `Welcome to Lalela, ${communityName}`
        : 'Welcome to Lalela';
      doc.fillColor(TEAL).fontSize(15).font('Helvetica-Bold')
        .text(heading, panelX + 18, panelTop + 16, { width: panelW - 36 });

      // 2×2 stat grid
      const statTop = panelTop + 48;
      const colAX = panelX + 18;
      const colBX = panelX + Math.floor(panelW / 2) + 8;
      const colW = Math.floor(panelW / 2) - 26;

      const drawStat = (x: number, y: number, label: string, value: string) => {
        doc.fillColor(MUTED).fontSize(8).font('Helvetica')
          .text(label.toUpperCase(), x, y, { width: colW });
        doc.fillColor('#1a1c1a').fontSize(12).font('Helvetica-Bold')
          .text(value, x, y + 12, { width: colW });
      };

      drawStat(colAX, statTop, 'Members', String(memberCount ?? 1));
      drawStat(colBX, statTop, 'Posts', String(postCount ?? 0));
      drawStat(
        colAX, statTop + 38,
        'Community licensed since',
        fmtDate(communityActivatedAt ?? createdAt),
      );
      drawStat(colBX, statTop + 38, 'Community licence', 'Permanent (lifelong)');

      // Platform renewal note
      if (platformRenewalDate) {
        doc.fillColor(TEAL).fontSize(9).font('Helvetica-Bold')
          .text(
            `Platform membership renews on ${fmtDate(platformRenewalDate)}`,
            panelX + 18, statTop + 86, { width: panelW - 36 },
          );
      }

      // Warm paragraph
      doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica')
        .text(
          "Your community now has a permanent home on Lalela. From here every post, every voice and every member helps shape a stronger neighbourhood. We're glad to walk this road with you.",
          panelX + 18, statTop + 108, { width: panelW - 36, align: 'left' },
        );
    } else {
      // MEMBERSHIP
      doc.fillColor(TEAL).fontSize(15).font('Helvetica-Bold')
        .text('Thank you for renewing your Lalela membership', panelX + 18, panelTop + 16, { width: panelW - 36 });

      doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica')
        .text(
          'Your next year on Lalela starts today. Stay close to your community, stay heard, stay connected.',
          panelX + 18, panelTop + 50, { width: panelW - 36 },
        );

      if (platformRenewalDate) {
        doc.fillColor(MUTED).fontSize(8).font('Helvetica')
          .text('MEMBERSHIP RENEWS ON', panelX + 18, panelTop + 96, { width: panelW - 36 });
        doc.fillColor('#1a1c1a').fontSize(12).font('Helvetica-Bold')
          .text(fmtDate(platformRenewalDate), panelX + 18, panelTop + 108, { width: panelW - 36 });
      }

      if (canCreateCommunity) {
        doc.fillColor(ORANGE).fontSize(10).font('Helvetica-Bold')
          .text(
            "You're now entitled to start your own community — 30-day trial included.",
            panelX + 18, panelTop + 150, { width: panelW - 36 },
          );
      }
    }

    // ── 6. Footer ─────────────────────────────────────────────────────────────
    // Keep well inside the 50pt bottom margin so pdfkit never auto-paginates.
    const footerLineY = PAGE_H - 70;
    doc.moveTo(LEFT, footerLineY).lineTo(RIGHT, footerLineY)
      .strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text(
        `Lalela — Community Platform  |  lalela.net  |  support@lalela.net   ·   Invoice ${invoiceNumber}`,
        LEFT, footerLineY + 8,
        { width: RIGHT - LEFT, align: 'center', lineBreak: false },
      );

    doc.end();
  });
}

// ─── MinIO Upload ─────────────────────────────────────────────────────────────

export async function uploadInvoicePdf(buffer: Buffer, invoiceNumber: string): Promise<string> {
  const minio = getMinioClient();
  const bucket = getInvoiceBucket();
  const objectName = getInvoiceObjectName(invoiceNumber);

  const exists = await minio.bucketExists(bucket);
  if (!exists) await minio.makeBucket(bucket, 'us-east-1');

  await minio.putObject(bucket, objectName, buffer, buffer.length, {
    'Content-Type': 'application/pdf',
  });

  return buildInvoiceApiUrl(invoiceNumber);
}

export async function getInvoicePdf(invoiceNumber: string): Promise<Buffer> {
  const minio = getMinioClient();
  const bucket = getInvoiceBucket();
  const objectName = getInvoiceObjectName(invoiceNumber);
  const stream = await minio.getObject(bucket, objectName);

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ─── DB Record ────────────────────────────────────────────────────────────────

export async function saveInvoiceRecord(
  prisma: PrismaClient,
  userId: string,
  invoiceNumber: string,
  amount: number,
  type: 'COMMUNITY' | 'MEMBERSHIP',
  pdfUrl: string,
) {
  return prisma.invoice.create({
    data: { userId, invoiceNumber, amount, type, pdfUrl },
  });
}
