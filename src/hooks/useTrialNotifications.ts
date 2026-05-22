import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';

/**
 * Emits in-app notifications when the user's trial or subscription renewal is approaching.
 * Call once in a top-level component (e.g. HomeScreen or tab layout).
 *
 * @param onNotify - callback receives the notification object; caller is responsible for displaying it.
 */
export function useTrialNotifications(onNotify: (n: AppNotification) => void): void {
  const { userProfile } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userProfile) return;

    const now = new Date();
    const { licenseStatus, trialExpiresAt, subscriptionRenewalDate } = userProfile;

    if (licenseStatus === 'TRIAL' && trialExpiresAt) {
      const expiry = new Date(trialExpiresAt);
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const key = `trial_expiry_${userProfile.id}_${daysLeft}`;

      if (daysLeft >= 0 && daysLeft <= 5 && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        const notification: AppNotification = {
          id: key,
          userId: userProfile.id,
          type: 'trial_expiry',
          title: daysLeft === 0 ? 'Trial expires today' : `Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          message: `Subscribe for R99/year to keep full access after your trial ends on ${expiry.toLocaleDateString()}.`,
          createdAt: now.toISOString(),
          read: false,
        };
        onNotify(notification);
      }
    }

    if (licenseStatus === 'ACTIVE' && subscriptionRenewalDate) {
      const renewal = new Date(subscriptionRenewalDate);
      const daysLeft = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const key = `payment_reminder_${userProfile.id}_${daysLeft}`;

      if (daysLeft >= 0 && daysLeft <= 5 && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        const notification: AppNotification = {
          id: key,
          userId: userProfile.id,
          type: 'payment_reminder',
          title: daysLeft === 0 ? 'Subscription renews today' : `Subscription renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          message: `Your R99/year membership renews on ${renewal.toLocaleDateString()}. Ensure your payment method is up to date.`,
          createdAt: now.toISOString(),
          read: false,
        };
        onNotify(notification);
      }
    }
  }, [userProfile, onNotify]);
}
