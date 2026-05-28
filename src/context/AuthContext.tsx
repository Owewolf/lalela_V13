/**
 * AuthContext — JWT-based auth and cached user profile state.
 *
 * Storage keys in AsyncStorage:
 *   accessToken   — short-lived JWT (15 min)
 *   refreshToken  — long-lived JWT (30 days, rotated on use)
 *   userProfile   — JSON-serialised UserProfile (offline cache)
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { disconnectSocket, updateSocketAuth } from '../lib/socket';
import { migrateAsyncStorageKeys } from '../lib/migrateStorage';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { UserProfile } from '../types';

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextType {
  /** Currently authenticated user profile, or null when signed out */
  userProfile: UserProfile | null;
  /** True while we are checking stored tokens / loading initial profile */
  loading: boolean;
  /** True once the initial auth check is complete (mirrors old isAuthReady) */
  isAuthReady: boolean;

  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign out on this device */
  signOut: () => Promise<void>;
  /** Register a new account (sends verification email) */
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  /** Resend email verification */
  resendVerification: (email: string) => Promise<void>;
  /** Force a re-fetch of /users/me and update local cache (used after email verification round-trip) */
  refreshProfile: () => Promise<UserProfile | null>;
  /** Update the current user's profile via REST + refresh local cache */
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  /** Request a password reset email */
  forgotPassword: (email: string) => Promise<void>;
  /** Change password (authenticated) */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Delete account permanently */
  deleteAccount: () => Promise<void>;

  // ── Phone / OTP ────────────────────────────────────────────────────────────
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
  /** Send OTP to link a new phone number to the currently authenticated user */
  linkPhone: (phone: string) => Promise<void>;
  /** Verify OTP and attach phone to current user */
  verifyLinkPhone: (phone: string, code: string) => Promise<void>;  /** Attach (or replace) an email on the current account; triggers a verification email */
  linkEmail: (email: string) => Promise<void>;
  /** Set the initial password on an account that doesn't have one yet */
  setInitialPassword: (newPassword: string) => Promise<void>;  /** Send OTP for SMS-based password reset (always 200 to prevent enumeration) */
  sendPhoneResetOtp: (phone: string) => Promise<void>;
  /** Reset password using OTP delivered by SMS */
  resetPasswordWithPhone: (phone: string, code: string, newPassword: string) => Promise<void>;
  /** Send an SMS invite to a neighbour */
  sendSmsInvite: (phone: string, communityId: string) => Promise<void>;

  // ── Push token registration ────────────────────────────────────────────────
  registerPushToken: (token: string, platform: 'ios' | 'android') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function storeTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    ['accessToken', accessToken],
    ['refreshToken', refreshToken],
  ]);
  // Keep socket auth fresh after token refresh
  updateSocketAuth(accessToken);
}

async function clearTokens() {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userProfile']);
  disconnectSocket();
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const syncProfileFromServer = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: queryKeys.currentUserProfile(),
        queryFn: async (): Promise<UserProfile> => {
          const { data } = await api.get<UserProfile>('/users/me');
          return data;
        },
      });
      setUserProfile(fresh);
      await AsyncStorage.setItem('userProfile', JSON.stringify(fresh));
      return fresh;
    } catch {
      return null;
    }
  }, []);

  // ── Boot: restore session from stored tokens ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await migrateAsyncStorageKeys();
        const [accessToken, cached] = await AsyncStorage.multiGet([
          'accessToken',
          'userProfile',
        ]);

        if (accessToken[1]) {
          // Restore cached profile immediately for instant UI
          if (cached[1]) {
            setUserProfile(JSON.parse(cached[1]) as UserProfile);
          }
          // Fetch fresh profile (this also validates the token)
          try {
            const fresh = await syncProfileFromServer();
            if (!fresh) throw new Error('Profile refresh failed');
          } catch {
            // 401 → interceptor will attempt refresh; if that fails it clears tokens
            // and a subsequent render will see null userProfile → AppGuard routes to /landing
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error('AuthContext boot error:', err);
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    })();
  }, [syncProfileFromServer]);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await storeTokens(data.accessToken, data.refreshToken);
    // Refetch canonical profile so cache always matches /users/me shape.
    const fresh = await syncProfileFromServer();
    if (!fresh) {
      setUserProfile(data.user);
      await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));
      queryClient.setQueryData(queryKeys.currentUserProfile(), data.user);
    }
  }, [syncProfileFromServer]);

  // ── Sign out ──────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearTokens();
      setUserProfile(null);
      queryClient.removeQueries({ queryKey: queryKeys.currentUserProfile() });
      queryClient.removeQueries({ queryKey: queryKeys.currentUserSessions() });
      queryClient.removeQueries({ queryKey: queryKeys.currentUserTwoFA() });
      queryClient.removeQueries({ queryKey: queryKeys.currentUserAuditLogs() });
    }
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    phone?: string,
  ) => {
    await api.post('/auth/register', { email, password, name, phone });
    // Account created but email must be verified before login — caller redirects to verification screen
  }, []);

  // ── Resend verification email ─────────────────────────────────────────────
  const resendVerification = useCallback(async (email: string) => {
    await api.post('/auth/resend-verification', { email });
  }, []);

  // ── Refresh profile (used after email verification deep-link or app resume) ─
  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    return syncProfileFromServer();
  }, [syncProfileFromServer]);

  // ── Update profile ────────────────────────────────────────────────────────
  const updateUserProfile = useCallback(async (data: Partial<UserProfile>) => {
    const { data: updated } = await api.put<UserProfile>('/users/me', data);
    setUserProfile(updated);
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    queryClient.setQueryData(queryKeys.currentUserProfile(), updated);
  }, []);

  // ── Forgot / reset password ───────────────────────────────────────────────
  const forgotPassword = useCallback(async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }, []);

  // ── Delete account ────────────────────────────────────────────────────────
  const deleteAccount = useCallback(async () => {
    await api.delete('/users/me');
    await clearTokens();
    setUserProfile(null);
    queryClient.removeQueries({ queryKey: queryKeys.currentUserProfile() });
    queryClient.removeQueries({ queryKey: queryKeys.currentUserSessions() });
    queryClient.removeQueries({ queryKey: queryKeys.currentUserTwoFA() });
    queryClient.removeQueries({ queryKey: queryKeys.currentUserAuditLogs() });
  }, []);

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const sendPhoneOtp = useCallback(async (phone: string) => {
    await api.post('/auth/phone/send-otp', { phone });
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, code: string) => {
    const { data } = await api.post('/auth/phone/verify-otp', { phone, code });
    if (data.accessToken) {
      await storeTokens(data.accessToken, data.refreshToken);
      // Refetch the canonical profile so we get the full shape (role,
      // lastCommunityId, licenseStatus, etc.) — mirrors the boot path and
      // guards against any drift in the verify-otp response payload.
      const fresh = await syncProfileFromServer();
      if (!fresh) {
        setUserProfile(data.user);
        await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));
        queryClient.setQueryData(queryKeys.currentUserProfile(), data.user);
      }
    }
  }, [syncProfileFromServer]);

  // ── Link phone to current account ─────────────────────────────────────────
  const linkPhone = useCallback(async (phone: string) => {
    await api.post('/auth/link-phone', { phone });
  }, []);

  const verifyLinkPhone = useCallback(async (phone: string, code: string) => {
    const { data } = await api.post<{ user: UserProfile }>('/auth/verify-link-phone', { phone, code });
    if (data?.user) {
      setUserProfile(data.user);
      await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));
    }
  }, []);

  // ── Link email to current account ───────────────────────────────────
  const linkEmail = useCallback(async (email: string) => {
    await api.post('/auth/link-email', { email });
    // Refresh the canonical profile so email + emailVerified=false are reflected.
    const fresh = await syncProfileFromServer();
    if (!fresh) {
      // Non-fatal — next /users/me call will pick it up.
    }
  }, [syncProfileFromServer]);

  // ── Set initial password (phone-only accounts) ────────────────────────
  const setInitialPassword = useCallback(async (newPassword: string) => {
    await api.post('/auth/set-password', { newPassword });
    const fresh = await syncProfileFromServer();
    if (!fresh) {
      // Non-fatal.
    }
  }, [syncProfileFromServer]);

  // ── Phone-based password reset ────────────────────────────────────────────
  const sendPhoneResetOtp = useCallback(async (phone: string) => {
    await api.post('/auth/phone/send-reset-otp', { phone });
  }, []);

  const resetPasswordWithPhone = useCallback(
    async (phone: string, code: string, newPassword: string) => {
      await api.post('/auth/phone/reset-password', { phone, code, newPassword });
    },
    [],
  );

  // ── SMS invite ────────────────────────────────────────────────────────────
  const sendSmsInvite = useCallback(async (phone: string, communityId: string) => {
    await api.post('/auth/send-invite', { phone, communityId });
  }, []);

  // ── Push token ────────────────────────────────────────────────────────────
  const registerPushToken = useCallback(async (token: string, platform: 'ios' | 'android') => {
    await api.put('/users/me/push-token', { token, platform });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        loading,
        isAuthReady,
        signIn,
        signOut,
        register,
        resendVerification,
        refreshProfile,
        updateUserProfile,
        forgotPassword,
        changePassword,
        deleteAccount,
        sendPhoneOtp,
        verifyPhoneOtp,
        linkPhone,
        verifyLinkPhone,
        linkEmail,
        setInitialPassword,
        sendPhoneResetOtp,
        resetPasswordWithPhone,
        sendSmsInvite,
        registerPushToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

