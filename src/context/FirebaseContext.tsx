/**
 * FirebaseContext — backward-compatibility shim over AuthContext (JWT-based).
 *
 * All existing components that call `useFirebase()` continue to work without
 * modification. The hook maps the new AuthContext shape to the original Firebase
 * interface, providing a synthetic `user` object with `uid`, `email`, etc.
 *
 * NOTE: No separate FirebaseProvider is needed — this hook calls useAuth()
 * directly, so it must be used inside an AuthProvider tree.
 */
import React, { useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { UserProfile } from '../types';

// Synthetic Firebase-like user shape used by legacy components
export interface SyntheticUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  providerData: any[];
}

function buildSyntheticUser(profile: UserProfile): SyntheticUser {
  return {
    uid: profile.id,
    email: profile.email ?? null,
    emailVerified: true,
    displayName: profile.name ?? null,
    photoURL: profile.profile_image ?? null,
    providerData: [],
  };
}

/**
 * Drop-in replacement for the original `useFirebase()` hook.
 * Internally delegates to `useAuth()` (JWT-based, no Firebase SDK).
 */
export function useFirebase() {
  const {
    userProfile,
    loading,
    isAuthReady,
    updateUserProfile,
    signOut,
    deleteAccount,
    sendPhoneOtp,
    verifyPhoneOtp,
  } = useAuth();

  // Phone OTP flow state — per-component instance (same behaviour as before)
  const [confirmationResult, setConfirmationResult] = useState<{ phone: string } | null>(null);
  const pendingPhoneRef = useRef<string>('');

  const user: SyntheticUser | null = userProfile ? buildSyntheticUser(userProfile) : null;

  const setupRecaptcha = (_containerId: string) => {
    // No-op: React Native uses APNs/SafetyNet; no DOM RecaptchaVerifier needed.
  };

  const signInWithPhone = async (phoneNumber: string, _appVerifier?: any) => {
    pendingPhoneRef.current = phoneNumber;
    await sendPhoneOtp(phoneNumber);
    // Sentinel value so PhoneAuth shows the OTP input step
    setConfirmationResult({ phone: phoneNumber });
  };

  const verifySmsCode = async (code: string) => {
    await verifyPhoneOtp(pendingPhoneRef.current, code);
    setConfirmationResult(null);
    // Return a shape compatible with the old Firebase result
    return { user };
  };

  const clearPhoneAuth = () => {
    setConfirmationResult(null);
    pendingPhoneRef.current = '';
  };

  return {
    user,
    userProfile,
    loading,
    isAuthReady,
    updateUserProfile,
    signOut,
    deleteAccount,
    confirmationResult,
    setupRecaptcha,
    signInWithPhone,
    verifySmsCode,
    clearPhoneAuth,
  };
}

// Legacy named export kept for any code that still imports FirebaseProvider
// (now a no-op passthrough since auth state lives in AuthProvider).
export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
