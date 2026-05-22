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
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { invoiceNumber, createdAt, userName, userEmail, type, amount } = data;
    const itemLabel = type === 'COMMUNITY'
      ? 'Community Activation — Once-off (Permanent)'
      : 'Platform Membership — Annual Subscription';

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(TEAL);

    // The charcoal bubble logo carries its own shape, so render it directly.
    try {
      doc.image(LALELA_INVOICE_LOGO_BUFFER, 46, 14, { width: 64, height: 64 });
    } catch {
      // Logo load failed — continue without it
    }

    doc
      .fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Lalela', 118, 28)
      .fontSize(10)
      .font('Helvetica')
      .text('Community Platform', 118, 54)
      .fillColor('#ffffff')
      .fontSize(9)
      .text('lalela.net  |  admin@lalela.net', 118, 68);

    // Invoice title
    doc
      .fillColor(TEAL)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('INVOICE', doc.page.width - 180, 20, { width: 130, align: 'right' });

    doc.moveDown(0);

    // ── Info block ────────────────────────────────────────────────────────────
    const infoTop = 110;
    doc.y = infoTop;

    // Left: Invoice To
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('INVOICE TO', 50, infoTop);
    doc.fillColor('#1a1c1a').fontSize(11).font('Helvetica-Bold').text(userName, 50, infoTop + 14);
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica').text(userEmail, 50, infoTop + 28);

    // Right: Invoice details
    const rCol = doc.page.width - 230;
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('INVOICE NUMBER', rCol, infoTop);
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica-Bold').text(invoiceNumber, rCol, infoTop + 14);
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('DATE', rCol, infoTop + 32);
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica').text(
      createdAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }),
      rCol, infoTop + 46,
    );

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.moveTo(50, infoTop + 70).lineTo(doc.page.width - 50, infoTop + 70)
      .strokeColor('#e5e7eb').lineWidth(1).stroke();

    // ── Items table header ────────────────────────────────────────────────────
    const tableTop = infoTop + 82;
    doc.rect(50, tableTop, doc.page.width - 100, 22).fill(TEAL);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('DESCRIPTION', 58, tableTop + 7);
    doc.text('QTY', doc.page.width - 200, tableTop + 7, { width: 40, align: 'center' });
    doc.text('UNIT PRICE', doc.page.width - 150, tableTop + 7, { width: 80, align: 'right' });
    doc.text('TOTAL', doc.page.width - 58, tableTop + 7, { width: 60, align: 'right' });

    // ── Items table row ───────────────────────────────────────────────────────
    const rowTop = tableTop + 30;
    doc.fillColor('#1a1c1a').fontSize(10).font('Helvetica');
    doc.text(itemLabel, 58, rowTop, { width: doc.page.width - 320 });
    doc.text('1', doc.page.width - 200, rowTop, { width: 40, align: 'center' });
    doc.text(fmt(amount), doc.page.width - 150, rowTop, { width: 80, align: 'right' });
    doc.text(fmt(amount), doc.page.width - 58, rowTop, { width: 60, align: 'right' });

    // Row divider
    doc.moveTo(50, rowTop + 22).lineTo(doc.page.width - 50, rowTop + 22)
      .strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    // ── Totals ────────────────────────────────────────────────────────────────
    const totTop = rowTop + 32;
    const labelX = doc.page.width - 200;
    const valueX = doc.page.width - 58;

    doc.fillColor(MUTED).fontSize(9).font('Helvetica');
    doc.text('Subtotal', labelX, totTop, { width: 140, align: 'right' });
    doc.fillColor('#1a1c1a').text(fmt(amount), valueX - 60, totTop, { width: 60, align: 'right' });

    doc.fillColor(MUTED).text('VAT (0%)', labelX, totTop + 16, { width: 140, align: 'right' });
    doc.fillColor('#1a1c1a').text('R 0.00', valueX - 60, totTop + 16, { width: 60, align: 'right' });

    // Total bar
    doc.rect(labelX - 10, totTop + 32, doc.page.width - labelX + 10 - 50, 26).fill(ORANGE);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL', labelX, totTop + 39, { width: 140, align: 'right' });
    doc.text(fmt(amount), valueX - 60, totTop + 39, { width: 60, align: 'right' });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
      .strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(MUTED).fontSize(8).font('Helvetica');
    doc.text('Thank you for being part of the Lalela community.', 50, footerY + 10, { align: 'center' });
    doc.text('Lalela — Community Platform  |  lalela.net  |  support@lalela.net', 50, footerY + 22, { align: 'center' });
    doc.text(`Invoice ${invoiceNumber} — Generated ${createdAt.toISOString().slice(0, 10)}`, 50, footerY + 34, { align: 'center' });

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
