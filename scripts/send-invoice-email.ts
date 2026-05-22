import 'dotenv/config';
import nodemailer from 'nodemailer';
import { createInvoicePdf, uploadInvoicePdf } from '../server/billing/invoiceService.js';
import { baseEmailHtml, ctaButton, divider, infoRow } from '../server/services/emailTemplates.js';

type InvoiceType = 'COMMUNITY' | 'MEMBERSHIP';

function parseAmountToCents(value: string): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`Invalid amount: ${value}`);
  }
  return Math.round(normalized * 100);
}

async function main() {
  const to = process.argv[2] ?? 'steven@wolfslair.cc';
  const name = process.argv[3] ?? 'Steven';
  const type = (process.argv[4] ?? 'COMMUNITY').toUpperCase() as InvoiceType;
  const amount = parseAmountToCents(process.argv[5] ?? (type === 'COMMUNITY' ? '999' : '99'));

  if (type !== 'COMMUNITY' && type !== 'MEMBERSHIP') {
    throw new Error(`Unsupported invoice type: ${type}`);
  }

  const invoiceNumber = `LAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-ADHOC`;
  const itemLabel = type === 'COMMUNITY' ? 'Community Activation' : 'Platform Membership';
  const pdfBuffer = await createInvoicePdf({
    invoiceNumber,
    createdAt: new Date(),
    userName: name,
    userEmail: to,
    type,
    amount,
  });

  let invoiceUrl = '';
  try {
    invoiceUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
  } catch (error) {
    console.warn(
      '[invoice] upload failed, sending attachment only:',
      error instanceof Error ? error.message : String(error),
    );
  }

  const host = process.env.SMTP_HOST || 'mail.lalela.net';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (user == null || pass == null) {
    throw new Error('SMTP credentials missing');
  }

  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const from = `Lalela <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lalela.net'}>`;
  const amountLabel = `R ${(amount / 100).toFixed(2)}`;
  const html = baseEmailHtml(`
    <h2 style="color:#0d3d47;margin-top:0">Your Lalela Invoice</h2>
    <p>Hi ${name}, attached is your Lalela invoice for <strong>${itemLabel.toLowerCase()}</strong>.</p>
    ${divider()}
    <table cellpadding="0" cellspacing="0" style="width:100%">
      ${infoRow('Invoice', invoiceNumber)}
      ${infoRow('Item', itemLabel)}
      ${infoRow('Amount', amountLabel)}
    </table>
    ${divider()}
    ${invoiceUrl ? ctaButton('Download Invoice', invoiceUrl, '#0d3d47') : ''}
    <p style="color:#737971;font-size:12px;margin-top:20px">The PDF is attached to this email${invoiceUrl ? ' and available through the download link above' : ''}.</p>
  `, 'Your Lalela invoice is attached.');

  await transport.sendMail({
    from,
    to,
    subject: `Your Lalela invoice ${invoiceNumber}`,
    text: `Hi ${name},\n\nAttached is your Lalela invoice ${invoiceNumber} for ${itemLabel.toLowerCase()} (${amountLabel}).${invoiceUrl ? `\n\nDownload link: ${invoiceUrl}` : ''}`,
    html,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(JSON.stringify({ sent: true, to, invoiceNumber, invoiceUrl: invoiceUrl || null }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});