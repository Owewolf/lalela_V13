import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Key,
  ShieldCheck,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Info,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useFirebase } from '../../context/FirebaseContext';
import api from '../../lib/api';
import { accountService } from '../../services/accountService';
import { TwoFASetupResponse } from '../../types';

export const SecuritySection: React.FC = () => {
  const { userProfile, updateUserProfile } = useFirebase();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFASetupData, setTwoFASetupData] = useState<TwoFASetupResponse | null>(null);
  const [loading2FA, setLoading2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    if (twoFASetupData?.secret) {
      // Alert the user with the secret so they can manually copy it
      Alert.alert('2FA Secret Key', twoFASetupData.secret, [
        { text: 'OK', onPress: () => { setCopied(true); setTimeout(() => setCopied(false), 2000); } }
      ]);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      setStatus({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    if (passwordData.new.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters' });
      return;
    }
    try {
      await api.post('/auth/change-password', {
        current_password: passwordData.current,
        new_password: passwordData.new,
      });
      await updateUserProfile({ last_password_changed: new Date().toISOString() } as any);
      setShowPasswordForm(false);
      setPasswordData({ current: '', new: '', confirm: '' });
      setStatus({ type: 'success', message: 'Password changed successfully' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.response?.data?.message ?? error.message ?? 'Failed to change password' });
    }
  };

  const handleToggle2FA = async () => {
    if (!userProfile?.two_factor_enabled) {
      setLoading2FA(true);
      try {
        const setup = await accountService.setup2FA();
        setTwoFASetupData(setup);
        setShow2FASetup(true);
      } catch {
        setStatus({ type: 'error', message: 'Failed to initiate 2FA setup' });
      } finally {
        setLoading2FA(false);
      }
    } else {
      await updateUserProfile({ two_factor_enabled: false });
      setStatus({ type: 'success', message: '2FA disabled' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleVerify2FA = async () => {
    if (verificationCode.length !== 6) return;
    setLoading2FA(true);
    try {
      const { verified } = await accountService.verify2FA(verificationCode);
      if (verified) {
        await updateUserProfile({ two_factor_enabled: true, two_factor_method: 'App' });
        setShow2FASetup(false);
        setTwoFASetupData(null);
        setVerificationCode('');
        setStatus({ type: 'success', message: '2FA enabled successfully' });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ type: 'error', message: 'Invalid verification code' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Verification failed' });
    } finally {
      setLoading2FA(false);
    }
  };

  const lastChangedText = () => {
    if (!userProfile?.last_password_changed) return 'Never';
    return new Date(userProfile.last_password_changed as string).toLocaleDateString();
  };

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} color="#2563eb" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d3d47' }}>Login & Authentication</Text>
      </View>

      {/* Password Card */}
      <View style={{ backgroundColor: '#f5f5f5', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={22} color="#0d3d47" />
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Password</Text>
            <Text style={{ fontSize: 10, color: '#888' }}>Last changed: {lastChangedText()}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowPasswordForm(!showPasswordForm)}
          style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 12 }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#0d3d47', textTransform: 'uppercase', letterSpacing: 1 }}>
            {showPasswordForm ? 'Cancel' : 'Change'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPasswordForm && (
        <View style={{ gap: 12 }}>
          {/* Current password */}
          <View style={{ position: 'relative' }}>
            <TextInput
              value={passwordData.current}
              onChangeText={(v) => setPasswordData({ ...passwordData, current: v })}
              placeholder="Current Password"
              placeholderTextColor="#aaa"
              secureTextEntry={!showCurrentPass}
              style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, paddingRight: 50, fontSize: 14, color: '#1a1a1a' }}
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPass(!showCurrentPass)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              {showCurrentPass ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
            </TouchableOpacity>
          </View>

          {/* New password */}
          <View style={{ position: 'relative' }}>
            <TextInput
              value={passwordData.new}
              onChangeText={(v) => setPasswordData({ ...passwordData, new: v })}
              placeholder="New Password"
              placeholderTextColor="#aaa"
              secureTextEntry={!showNewPass}
              style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, paddingRight: 50, fontSize: 14, color: '#1a1a1a' }}
            />
            <TouchableOpacity
              onPress={() => setShowNewPass(!showNewPass)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              {showNewPass ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
            </TouchableOpacity>
          </View>

          {/* Confirm password */}
          <TextInput
            value={passwordData.confirm}
            onChangeText={(v) => setPasswordData({ ...passwordData, confirm: v })}
            placeholder="Confirm New Password"
            placeholderTextColor="#aaa"
            secureTextEntry
            style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, fontSize: 14, color: '#1a1a1a' }}
          />

          <TouchableOpacity
            onPress={handleChangePassword}
            style={{ backgroundColor: '#0d3d47', borderRadius: 20, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Update Password</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2FA Card */}
      <View style={{ backgroundColor: '#f5f5f5', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={22} color="#2563eb" />
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Two-Factor Authentication</Text>
            <Text style={{ fontSize: 10, color: '#888' }}>Add an extra layer of security</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleToggle2FA}
          disabled={loading2FA}
          style={{
            width: 52, height: 28, borderRadius: 14,
            backgroundColor: userProfile?.two_factor_enabled ? '#10b981' : '#d1d5db',
            justifyContent: 'center',
            opacity: loading2FA ? 0.5 : 1,
          }}
        >
          {loading2FA ? (
            <ActivityIndicator size="small" color="#fff" style={{ alignSelf: 'center' }} />
          ) : (
            <View style={{
              width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
              position: 'absolute',
              left: userProfile?.two_factor_enabled ? undefined : 4,
              right: userProfile?.two_factor_enabled ? 4 : undefined,
            }} />
          )}
        </TouchableOpacity>
      </View>

      {/* 2FA Setup Flow */}
      {show2FASetup && twoFASetupData && (
        <View style={{ backgroundColor: '#f9fafb', borderRadius: 24, padding: 24, gap: 20, borderWidth: 1, borderColor: 'rgba(22,163,74,0.1)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(22,163,74,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={18} color="#0d3d47" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0d3d47' }}>Enable Two-Factor Authentication</Text>
          </View>

          {/* QR Code */}
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              {twoFASetupData.qr_code ? (
                <QRCode value={twoFASetupData.qr_code} size={160} />
              ) : (
                <View style={{ width: 160, height: 160, backgroundColor: '#f5f5f5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#0d3d47" />
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 2 }}>Step 1: Scan QR Code</Text>
          </View>

          {/* Manual entry key */}
          {twoFASetupData.secret && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 2 }}>Step 2: Manual Entry Key</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                <Text style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#0d3d47', letterSpacing: 2 }} selectable>
                  {twoFASetupData.secret}
                </Text>
                <TouchableOpacity
                  onPress={handleCopyKey}
                  style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(22,163,74,0.08)' }}
                >
                  {copied ? <Check size={16} color="#0d3d47" /> : <Copy size={16} color="#0d3d47" />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Verification code */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 2 }}>Step 3: Verify & Enable</Text>
            <TextInput
              value={verificationCode}
              onChangeText={(t) => setVerificationCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="rgba(0,0,0,0.2)"
              keyboardType="numeric"
              maxLength={6}
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                paddingHorizontal: 24,
                paddingVertical: 18,
                fontSize: 28,
                fontWeight: '800',
                color: '#1a1a1a',
                textAlign: 'center',
                letterSpacing: 12,
                borderWidth: 2,
                borderColor: verificationCode.length === 6 ? '#10b981' : 'rgba(0,0,0,0.1)',
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleVerify2FA}
              disabled={loading2FA || verificationCode.length !== 6}
              style={{
                flex: 1, paddingVertical: 16, borderRadius: 20,
                backgroundColor: '#0d3d47', alignItems: 'center',
                opacity: (loading2FA || verificationCode.length !== 6) ? 0.5 : 1,
              }}
            >
              {loading2FA ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Verify & Enable</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShow2FASetup(false); setTwoFASetupData(null); setVerificationCode(''); }}
              style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center' }}
            >
              <Text style={{ color: '#888', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status */}
      {status && (
        <View style={{
          padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        }}>
          {status.type === 'success'
            ? <CheckCircle2 size={18} color="#10b981" />
            : <AlertTriangle size={18} color="#ef4444" />}
          <Text style={{ fontSize: 12, fontWeight: '700', color: status.type === 'success' ? '#059669' : '#ef4444' }}>
            {status.message}
          </Text>
        </View>
      )}
    </View>
  );
};
