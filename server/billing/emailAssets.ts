import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const invoiceLogoPath = path.resolve(__dirname, '../../assets/lalela_email_header_logo.png');
const emailHeaderLogoPath = path.resolve(__dirname, '../../assets/favicon_full.png');

export const LALELA_INVOICE_LOGO_BUFFER = fs.readFileSync(invoiceLogoPath);
export const LALELA_EMAIL_HEADER_LOGO_BUFFER = fs.readFileSync(emailHeaderLogoPath);
export const LALELA_EMAIL_HEADER_LOGO_BASE64 = `data:image/png;base64,${LALELA_EMAIL_HEADER_LOGO_BUFFER.toString('base64')}`;
