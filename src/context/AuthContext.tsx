/**
 * AuthContext — JWT-based auth replacing Firebase Auth + Firestore user profile.
 *
 * Storage keys in AsyncStorage:
 *   access_token   — short-lived JWT (15 min)
 *   refresh_token  — long-lived JWT (30 days, rotated on use)
 *   user_profile   — JSON-serialised UserProfile (offline cache)
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { disconnectSocket, updateSocketAuth } from '../lib/socket';
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

  // ── Push token registration ────────────────────────────────────────────────
  registerPushToken: (token: string, platform: 'ios' | 'android') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function storeTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    ['access_token', accessToken],
    ['refresh_token', refreshToken],
  ]);
  // Keep socket auth fresh after token refresh
  updateSocketAuth(accessToken);
}

async function clearTokens() {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_profile']);
  disconnectSocket();
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // ── Boot: restore session from stored tokens ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [accessToken, cached] = await AsyncStorage.multiGet([
          'access_token',
          'user_profile',
        ]);

        if (accessToken[1]) {
          // Restore cached profile immediately for instant UI
          if (cached[1]) {
            setUserProfile(JSON.parse(cached[1]) as UserProfile);
          }
          // Fetch fresh profile (this also validates the token)
          try {
            const { data } = await api.get<UserProfile>('/users/me');
            setUserProfile(data);
            await AsyncStorage.setItem('user_profile', JSON.stringify(data));
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
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await storeTokens(data.accessToken, data.refreshToken);
    setUserProfile(data.user);
    await AsyncStorage.setItem('user_profile', JSON.stringify(data.user));
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearTokens();
      setUserProfile(null);
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

  // ── Update profile ────────────────────────────────────────────────────────
  const updateUserProfile = useCallback(async (data: Partial<UserProfile>) => {
    const { data: updated } = await api.put<UserProfile>('/users/me', data);
    setUserProfile(updated);
    await AsyncStorage.setItem('user_profile', JSON.stringify(updated));
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
  }, []);

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const sendPhoneOtp = useCallback(async (phone: string) => {
    await api.post('/auth/phone/send-otp', { phone });
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, code: string) => {
    const { data } = await api.post('/auth/phone/verify-otp', { phone, code });
    if (data.accessToken) {
      await storeTokens(data.accessToken, data.refreshToken);
      setUserProfile(data.user);
      await AsyncStorage.setItem('user_profile', JSON.stringify(data.user));
    }
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
        updateUserProfile,
        forgotPassword,
        changePassword,
        deleteAccount,
        sendPhoneOtp,
        verifyPhoneOtp,
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

/**
 * @deprecated Use useAuth() instead.
 * Kept as a thin alias for gradual migration of old useFirebase() call-sites.
 */
export const useFirebase = () => {
  const ctx = useAuth();
  // Map new fields to old FirebaseContext shape so existing components don't break yet
  return {
    ...ctx,
    user: ctx.userProfile
      ? { uid: ctx.userProfile.id, email: ctx.userProfile.email }
      : null,
    // Phone auth legacy stubs (no-ops — migrate call sites to sendPhoneOtp/verifyPhoneOtp)
    confirmationResult: null,
    setupRecaptcha: (_: string) => {},
    signInWithPhone: async (phone: string) => ctx.sendPhoneOtp(phone),
    verifySmsCode: async (code: string) => {
      if (!ctx.userProfile?.phone) throw new Error('No phone linked');
      return ctx.verifyPhoneOtp(ctx.userProfile.phone, code);
    },
    clearPhoneAuth: () => {},
  };
};
