/**
 * One-off invoice fixture renderer.
 * Generates /tmp/invoice-community.pdf and /tmp/invoice-membership.pdf so the
 * single-page layout can be eyeballed without touching MinIO or Prisma.
 *
 *   npx tsx scripts/render-invoice-fixture.ts
 */
import fs from 'node:fs';
import { createInvoicePdf } from '../server/billing/invoiceService.js';

async function main() {
  const now = new Date('2026-05-24T10:00:00Z');
  const inOneYear = new Date('2027-05-24T10:00:00Z');

  const community = await createInvoicePdf({
    invoiceNumber: 'LAL-20260524-0005',
    createdAt: now,
    userName: 'Steven Mohaud',
    userEmail: 'steven@wolfslair.cc',
    type: 'COMMUNITY',
    amount: 99900,
    communityName: 'Wolfslair Neighbourhood',
    communityActivatedAt: now,
    memberCount: 1,
    postCount: 0,
    platformRenewalDate: inOneYear,
  });
  fs.writeFileSync('/tmp/invoice-community.pdf', community);
  console.log(`community: /tmp/invoice-community.pdf (${community.length} bytes)`);

  const membership = await createInvoicePdf({
    invoiceNumber: 'LAL-20260524-0006',
    createdAt: now,
    userName: 'Thandi Ndlovu',
    userEmail: 'thandi@example.com',
    type: 'MEMBERSHIP',
    amount: 9900,
    platformRenewalDate: inOneYear,
    canCreateCommunity: true,
  });
  fs.writeFileSync('/tmp/invoice-membership.pdf', membership);
  console.log(`membership: /tmp/invoice-membership.pdf (${membership.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
