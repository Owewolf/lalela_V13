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

  let user: { name: string; email: string | null; subscriptionRenewalDate: Date | null } | null = null;
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

    // Build optional community / membership context for the invoice panel.
    let communityName: string | undefined;
    let communityActivatedAt: Date | undefined;
    let memberCount: number | undefined;
    let postCount: number | undefined;
    let canCreateCommunity: boolean | undefined;

    if (type === 'COMMUNITY' && communityId) {
      try {
        const community = await prisma.community.findUnique({
          where: { id: communityId },
          select: {
            name: true,
            activatedAt: true,
            createdAt: true,
            _count: { select: { members: true, posts: true } },
          },
        });
        if (community) {
          communityName = community.name;
          communityActivatedAt = community.activatedAt ?? community.createdAt;
          memberCount = community._count.members;
          postCount = community._count.posts;
        }
      } catch (err) {
        console.error('[billing] community context fetch failed:', err);
      }
    } else if (type === 'MEMBERSHIP') {
      // First paid MEMBERSHIP unlocks the right to start a community on a 30-day trial.
      canCreateCommunity = true;
    }

    const pdfBuffer = await createInvoicePdf({
      invoiceNumber,
      createdAt: new Date(),
      userName: user.name,
      userEmail: user.email ?? '',
      type,
      amount,
      communityName,
      communityActivatedAt,
      memberCount,
      postCount,
      platformRenewalDate: user.subscriptionRenewalDate ?? null,
      canCreateCommunity,
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

  if (!user.email) return;

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