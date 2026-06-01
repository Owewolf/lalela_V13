import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readRequiredAsset(assetPath: string, label: string): Buffer {
	if (!fs.existsSync(assetPath)) {
		throw new Error(`[emailAssets] Missing required ${label} asset at ${assetPath}`);
	}
	return fs.readFileSync(assetPath);
}

const invoiceLogoPath = path.resolve(__dirname, '../../assets/lalela_email_header_logo.png');
const emailHeaderLogoPath = path.resolve(__dirname, '../../assets/lalela_email_header_logo_inverse.png');

export const LALELA_INVOICE_LOGO_BUFFER = readRequiredAsset(invoiceLogoPath, 'invoice logo');
export const LALELA_EMAIL_HEADER_LOGO_BUFFER = readRequiredAsset(emailHeaderLogoPath, 'email header logo');
export const LALELA_EMAIL_HEADER_LOGO_BASE64 = `data:image/png;base64,${LALELA_EMAIL_HEADER_LOGO_BUFFER.toString('base64')}`;
