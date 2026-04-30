import api from '../lib/api';
import { UserProfile, UserSession, TwoFASetupResponse, LicensingInfo } from '../types';

export const accountService = {
  async getProfile(): Promise<UserProfile> {
    const { data } = await api.get<UserProfile>('/users/me');
    return data;
  },

  async updateProfile(data: Partial<UserProfile>): Promise<{ message: string; data: any }> {
    const { data: updated } = await api.put<UserProfile>('/users/me', data);
    return { message: 'Profile updated', data: updated };
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    await api.post('/auth/change-password', { currentPassword: oldPassword, newPassword });
    return { message: 'Password updated successfully' };
  },

  async get2FAStatus(): Promise<{ enabled: boolean; method: string; backup_codes_remaining: number }> {
    try {
      const { data } = await api.get('/users/me/2fa');
      return data;
    } catch {
      return { enabled: false, method: 'authenticator', backup_codes_remaining: 0 };
    }
  },

  async update2FAStatus(enabled: boolean): Promise<{ message: string }> {
    await api.put('/users/me/2fa', { enabled });
    return { message: '2FA status updated' };
  },

  async setup2FA(): Promise<TwoFASetupResponse> {
    const { data } = await api.post('/users/me/2fa/setup');
    return data;
  },

  async verify2FA(code: string): Promise<{ verified: boolean }> {
    const { data } = await api.post('/users/me/2fa/verify', { code });
    return data;
  },

  async getSessions(): Promise<UserSession[]> {
    try {
      const { data } = await api.get<UserSession[]>('/users/me/sessions');
      return data;
    } catch {
      return [
        {
          id: 'current',
          device: 'Current Device',
          ip: '127.0.0.1',
          location: 'Local',
          last_active: new Date().toISOString(),
          is_current: true,
        },
      ];
    }
  },

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    await api.delete(`/users/me/sessions/${sessionId}`);
    return { message: 'Session revoked' };
  },

  async revokeAllOtherSessions(): Promise<{ message: string }> {
    await api.delete('/users/me/sessions');
    return { message: 'Other sessions revoked' };
  },

  async getAuditLogs(): Promise<any[]> {
    try {
      const { data } = await api.get('/users/me/audit-logs');
      return data;
    } catch {
      return [];
    }
  },

  async createCheckoutSession(
    type: 'membership' | 'community',
    targetId?: string,
  ): Promise<{ url: string }> {
    try {
      const { data } = await api.post('/billing/checkout', { type, targetId });
      return data;
    } catch {
      // Fallback for mock/dev
      let qs = `?checkout=true&type=${type}`;
      if (targetId) qs += `&communityId=${targetId}`;
      return { url: qs };
    }
  },

  async simulateSuccessfulPayment(
    type: 'membership' | 'community',
    targetId?: string,
  ): Promise<{ message: string; status: string }> {
    try {
      const { data } = await api.post('/billing/simulate-payment', { type, targetId });
      return data;
    } catch {
      return { message: 'License activated successfully', status: 'active' };
    }
  },
};
