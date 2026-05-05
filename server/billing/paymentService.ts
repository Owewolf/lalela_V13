import prisma from '../db.js';
import {
  generateInvoiceNumber,
  createInvoicePdf,
  uploadInvoicePdf,
  saveInvoiceRecord,
} from './invoiceService.js';
import { getOrCreateCommunityInviteLink } from './inviteService.js';
import { sendPaymentConfirmationEmail } from '../services/emailService.js';

export async function handlePaymentSuccess(
  userId: string,
  type: 'COMMUNITY' | 'MEMBERSHIP',
  communityId?: string,
) {
  const amount = type === 'COMMUNITY' ? 99900 : 9900;

  try {
    await prisma.billingRecord.create({
      data: {
        userId,
        type,
        amount,
        status: 'PAID',
        communityId: communityId ?? null,
      },
    });
  } catch (err) {
    console.error('[billing] billingRecord.create failed:', err);
  }

  let user: { name: string; email: string; subscriptionRenewalDate: Date | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, subscriptionRenewalDate: true },
    });
  } catch (err) {
    console.error('[billing] user fetch failed:', err);
  }

  if (!user) return;

  let invoiceNumber = `LAL-${Date.now()}`;
  let pdfUrl = '#';
  try {
    invoiceNumber = await generateInvoiceNumber(prisma);
    const pdfBuffer = await createInvoicePdf({
      invoiceNumber,
      createdAt: new Date(),
      userName: user.name,
      userEmail: user.email,
      type,
      amount,
    });
    pdfUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
  } catch (err) {
    console.error('[billing] invoice generation/upload failed:', err);
  }

  try {
    await saveInvoiceRecord(prisma, userId, invoiceNumber, amount, type, pdfUrl);
  } catch (err) {
    console.error('[billing] saveInvoiceRecord failed:', err);
  }

  let inviteLink: string | undefined;
  if (type === 'COMMUNITY' && communityId) {
    try {
      inviteLink = await getOrCreateCommunityInviteLink(prisma, communityId, userId);
    } catch (err) {
      console.error('[billing] invite link generation failed:', err);
    }
  }

  try {
    await sendPaymentConfirmationEmail({
      to: user.email,
      name: user.name,
      type,
      amount,
      invoiceUrl: pdfUrl,
      invoiceNumber,
      nextBillingDate: type === 'MEMBERSHIP' ? (user.subscriptionRenewalDate ?? undefined) : undefined,
      inviteLink,
    });
  } catch (err) {
    console.error('[billing] confirmation email failed:', err);
  }
}