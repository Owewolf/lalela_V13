import 'dotenv/config';

import * as service from '../server/services/emailService';

async function main() {
  const recipient = process.argv[2];

  if (!recipient) {
    console.error('Usage: npx tsx scripts/send-test-emails.ts <email>');
    process.exit(1);
  }

  const {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendInviteEmail,
    sendCommunityCreatedEmail,
    sendMemberJoinedEmail,
    sendPaymentConfirmationEmail,
    sendTrialExpiryEmail,
    sendRenewalReminderEmail,
    sendFailedPaymentEmail,
  } = service as {
    sendVerificationEmail: (to: string, name: string, token: string) => Promise<void>;
    sendPasswordResetEmail: (to: string, name: string, token: string) => Promise<void>;
    sendInviteEmail: (to: string, inviteUrl: string, communityName: string, senderName: string) => Promise<void>;
    sendCommunityCreatedEmail: (to: string, name: string, communityName: string, trialExpiresAt: Date) => Promise<void>;
    sendMemberJoinedEmail: (to: string, name: string, communityName: string, trialExpiresAt: Date) => Promise<void>;
    sendPaymentConfirmationEmail: (opts: {
      to: string;
      name: string;
      type: 'COMMUNITY' | 'MEMBERSHIP';
      amount: number;
      invoiceUrl: string;
      invoiceNumber: string;
      nextBillingDate?: Date;
      inviteLink?: string;
    }) => Promise<void>;
    sendTrialExpiryEmail: (opts: {
      to: string;
      name: string;
      type: 'COMMUNITY' | 'MEMBERSHIP';
      daysLeft: number;
      expiresAt: Date;
    }) => Promise<void>;
    sendRenewalReminderEmail: (opts: {
      to: string;
      name: string;
      renewalDate: Date;
      daysLeft: number;
      amount: number;
    }) => Promise<void>;
    sendFailedPaymentEmail: (opts: {
      to: string;
      name: string;
      type: 'COMMUNITY' | 'MEMBERSHIP';
    }) => Promise<void>;
  };

  const name = 'Steven';
  const now = new Date();
  const plusDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const jobs: Array<{ label: string; run: () => Promise<void> }> = [
    { label: 'verification', run: () => sendVerificationEmail(recipient, name, 'test-verify-token-20260506') },
    { label: 'password-reset', run: () => sendPasswordResetEmail(recipient, name, 'test-reset-token-20260506') },
    {
      label: 'invite',
      run: () => sendInviteEmail(recipient, 'https://lalela.net/join?invite=test-invite-20260506', 'Wolfslair Circle', 'Heather P'),
    },
    {
      label: 'community-created',
      run: () => sendCommunityCreatedEmail(recipient, name, 'Wolfslair Circle', plusDays(30)),
    },
    {
      label: 'member-joined',
      run: () => sendMemberJoinedEmail(recipient, name, 'Wolfslair Circle', plusDays(365)),
    },
    {
      label: 'payment-confirmation',
      run: () => sendPaymentConfirmationEmail({
        to: recipient,
        name,
        type: 'COMMUNITY',
        amount: 99900,
        invoiceUrl: 'https://lalela.net/invoices/TEST-20260506-0001.pdf',
        invoiceNumber: 'TEST-20260506-0001',
        inviteLink: 'https://lalela.net/join?invite=community-live-20260506',
      }),
    },
    {
      label: 'trial-expiry',
      run: () => sendTrialExpiryEmail({
        to: recipient,
        name,
        type: 'COMMUNITY',
        daysLeft: 3,
        expiresAt: plusDays(3),
      }),
    },
    {
      label: 'renewal-reminder',
      run: () => sendRenewalReminderEmail({
        to: recipient,
        name,
        renewalDate: plusDays(5),
        daysLeft: 5,
        amount: 9900,
      }),
    },
    {
      label: 'failed-payment',
      run: () => sendFailedPaymentEmail({
        to: recipient,
        name,
        type: 'MEMBERSHIP',
      }),
    },
  ];

  const results: Array<{ label: string; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    try {
      await job.run();
      results.push({ label: job.label, ok: true });
      console.log(`OK ${job.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ label: job.label, ok: false, error: message });
      console.log(`FAIL ${job.label}: ${message}`);
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

void main();