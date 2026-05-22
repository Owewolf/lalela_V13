/**
 * Shared Lalela email templates.
 * All transactional emails use baseEmailHtml() for consistent branding.
 */
import { LALELA_EMAIL_HEADER_LOGO_BASE64 } from '../billing/emailAssets.js';

const TEAL = '#0d3d47';
const ORANGE = '#fc7127';
const CREAM = '#fff8f0';
const TEXT = '#1a1c1a';
const MUTED = '#737971';
const BORDER = '#c2c8bf';

// ─── CTA Button ───────────────────────────────────────────────────────────────

export function ctaButton(label: string, url: string, color: string = ORANGE): string {
  return `
    <p style="margin:28px 0;text-align:center">
      <a href="${url}"
         style="background:${color};color:#ffffff;text-decoration:none;
                padding:14px 28px;border-radius:8px;font-weight:700;
                font-size:15px;display:inline-block;letter-spacing:0.3px">
        ${label}
      </a>
    </p>
    <p style="text-align:center;font-size:12px;color:${MUTED};margin-top:4px">
      Or copy this link: <a href="${url}" style="color:${TEAL}">${url}</a>
    </p>`;
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0">`;
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

export function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:${MUTED};font-size:13px;width:140px">${label}</td>
      <td style="padding:8px 0;color:${TEXT};font-size:13px;font-weight:600">${value}</td>
    </tr>`;
}

// ─── Base Template ────────────────────────────────────────────────────────────

export function baseEmailHtml(bodyContent: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lalela</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f0ece8;font-family:Arial,Helvetica,sans-serif;color:${TEXT};line-height:1.6">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0ece8">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0ece8">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:${TEAL};padding:28px 32px;text-align:center">
            <img src="${LALELA_EMAIL_HEADER_LOGO_BASE64}"
                 alt="Lalela"
                 width="72"
                 style="display:block;margin:0 auto;max-width:72px;height:auto;border-radius:16px;background:${CREAM}">
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:${CREAM};padding:36px 40px">
            ${bodyContent}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#ede9e5;padding:20px 40px;text-align:center">
            <p style="margin:0 0 4px;font-size:12px;color:${MUTED}">
              © ${new Date().getFullYear()} Lalela — Community Platform
            </p>
            <p style="margin:0;font-size:11px;color:${MUTED}">
              You're receiving this because you have a Lalela account.
              If this wasn't you, please ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
