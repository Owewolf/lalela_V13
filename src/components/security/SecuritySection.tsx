import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
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
  Phone,
  Mail,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { accountService } from '../../services/accountService';
import { TwoFASetupResponse } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  sm: 10,
  md: 11,
  body: 13,
  lg: 12,
  xl: 14,
  xxl: 16,
  h: 18,
  otp: 24,
  otpLarge: 28,
} as const;

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const SPACE = {
  xxs: 4,
  xs: 6,
  sm: 8,
  s10: 10,
  md: 12,
  s14: 14,
  lg: 16,
  s18: 18,
  xl: 20,
  xxl: 24,
  s32: 32,
  s40: 40,
  s44: 44,
  s50: 50,
  s52: 52,
  s160: 160,
} as const;

const RADIUS = {
  sm: 10,
  md: 12,
  pill: 14,
  lg: 16,
  xl: 20,
  card: 24,
} as const;

export const SecuritySection: React.FC = () => {
  const { userProfile, updateUserProfile, linkPhone, verifyLinkPhone, linkEmail, setInitialPassword, resendVerification } = useAuth();
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

  // Phone link state
  const phoneInputRef = useRef<PhoneInput>(null);
  const [showPhoneLink, setShowPhoneLink] = useState(false);
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phoneFormatted, setPhoneFormatted] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Email link state
  const [showEmailLink, setShowEmailLink] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailPasswordInput, setEmailPasswordInput] = useState('');
  const [emailPasswordConfirm, setEmailPasswordConfirm] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const hasPassword = userProfile?.hasPassword !== false; // default true if undefined (back-compat)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());

  const isLinkedPhoneValid =
    phoneFormatted.length >= 8 && (phoneInputRef.current?.isValidNumber(phoneRaw) ?? false);

  const handleSendLinkOtp = async () => {
    if (phoneLoading || !isLinkedPhoneValid) return;
    setPhoneLoading(true);
    setStatus(null);
    try {
      await linkPhone(phoneFormatted);
      setPhoneOtpSent(true);
      setStatus({ type: 'success', message: 'OTP sent. Check your SMS.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Failed to send OTP';
      setStatus({ type: 'error', message: msg });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyLinkOtp = async () => {
    if (phoneLoading || phoneOtp.length !== 6) return;
    setPhoneLoading(true);
    setStatus(null);
    try {
      await verifyLinkPhone(phoneFormatted, phoneOtp);
      setStatus({ type: 'success', message: 'Phone linked successfully' });
      setShowPhoneLink(false);
      setPhoneOtpSent(false);
      setPhoneOtp('');
      setPhoneRaw('');
      setPhoneFormatted('');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Verification failed';
      setStatus({ type: 'error', message: msg });
    } finally {
      setPhoneLoading(false);
    }
  };

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
      if (hasPassword) {
        await api.post('/auth/change-password', {
          currentPassword: passwordData.current,
          newPassword: passwordData.new,
        });
        await updateUserProfile({ lastPasswordChanged: new Date().toISOString() } as any);
      } else {
        // First-time password set for phone-only accounts.
        await setInitialPassword(passwordData.new);
      }
      setShowPasswordForm(false);
      setPasswordData({ current: '', new: '', confirm: '' });
      setStatus({ type: 'success', message: hasPassword ? 'Password changed successfully' : 'Password set successfully — you can now log in with email and password' });
      setTimeout(() => setStatus(null), 4000);
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.response?.data?.error ?? error?.response?.data?.message ?? error.message ?? 'Failed to update password' });
    }
  };

  const handleLinkEmail = async () => {
    if (emailLoading || !emailValid) return;
    // When no password exists yet, force one in the same step so the user can
    // actually log in with the email once they verify it.
    if (!hasPassword) {
      if (emailPasswordInput.length < 8) {
        setStatus({ type: 'error', message: 'Password must be at least 8 characters' });
        return;
      }
      if (emailPasswordInput !== emailPasswordConfirm) {
        setStatus({ type: 'error', message: 'Passwords do not match' });
        return;
      }
    }
    setEmailLoading(true);
    setStatus(null);
    try {
      await linkEmail(emailInput.trim().toLowerCase());
      if (!hasPassword) {
        await setInitialPassword(emailPasswordInput);
      }
      setShowEmailLink(false);
      setEmailInput('');
      setEmailPasswordInput('');
      setEmailPasswordConfirm('');
      setStatus({
        type: 'success',
        message: hasPassword
          ? 'Verification email sent. Check your inbox to confirm.'
          : 'Password saved and verification email sent. Confirm your email to start signing in with it.',
      });
      setTimeout(() => setStatus(null), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Failed to link email';
      setStatus({ type: 'error', message: msg });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    if (!userProfile?.email) return;
    try {
      await resendVerification(userProfile.email);
      setStatus({ type: 'success', message: 'Verification email re-sent.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.response?.data?.error ?? err.message ?? 'Failed to resend' });
    }
  };

  const handleToggle2FA = async () => {
    if (!userProfile?.twoFactorEnabled) {
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
      await updateUserProfile({ twoFactorEnabled: false });
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
        await updateUserProfile({ twoFactorEnabled: true, twoFactorMethod: 'App' });
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
    if (!userProfile?.lastPasswordChanged) return 'Never';
    return new Date(userProfile.lastPasswordChanged as string).toLocaleDateString();
  };

  const authItemCardStyle = {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    borderWidth: 1,
    borderColor: THEME_COLORS.overlayBorderSoft,
  } as const;

  const authTitleStyle = {
    fontSize: TYPE_SCALE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.onSurface,
  } as const;

  const authMetaStyle = {
    fontSize: TYPE_SCALE.xl,
    color: THEME_COLORS.neutralTextSoft,
  } as const;

  return (
    <View style={{ gap: SPACE.lg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} color={THEME_COLORS.brandBlueText} />
        </View>
        <Text style={{ fontSize: TYPE_SCALE.h, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Login & Authentication</Text>
      </View>

      {/* Password Card */}
      <View style={[authItemCardStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, marginRight: SPACE.md, gap: SPACE.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Key size={24} color={THEME_COLORS.primary} />
            <Text style={authTitleStyle}>Password</Text>
          </View>
          <Text style={authMetaStyle}>
            {hasPassword ? `Last changed: ${lastChangedText()}` : 'Not set — add one to log in with email'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowPasswordForm(!showPasswordForm)}
          style={{ minWidth: 112, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' }}
        >
          <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: SPACE.xxs }}>
            {showPasswordForm ? 'Cancel' : hasPassword ? 'Change' : 'Set'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPasswordForm && (
        <View style={{ gap: SPACE.md }}>
          {/* Current password — only when changing an existing one */}
          {hasPassword && (
            <View style={{ position: 'relative' }}>
              <TextInput
                value={passwordData.current}
                onChangeText={(v) => setPasswordData({ ...passwordData, current: v })}
                placeholder="Current Password"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                secureTextEntry={!showCurrentPass}
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, paddingRight: SPACE.s50, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPass(!showCurrentPass)}
                style={{ position: 'absolute', right: SPACE.s14, top: 0, bottom: 0, justifyContent: 'center' }}
              >
                {showCurrentPass ? <EyeOff size={18} color={THEME_COLORS.neutralTextSoft} /> : <Eye size={18} color={THEME_COLORS.neutralTextSoft} />}
              </TouchableOpacity>
            </View>
          )}

          {/* New password */}
          <View style={{ position: 'relative' }}>
            <TextInput
              value={passwordData.new}
              onChangeText={(v) => setPasswordData({ ...passwordData, new: v })}
              placeholder="New Password"
              placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
              secureTextEntry={!showNewPass}
              style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, paddingRight: SPACE.s50, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
            />
            <TouchableOpacity
              onPress={() => setShowNewPass(!showNewPass)}
              style={{ position: 'absolute', right: SPACE.s14, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              {showNewPass ? <EyeOff size={18} color={THEME_COLORS.neutralTextSoft} /> : <Eye size={18} color={THEME_COLORS.neutralTextSoft} />}
            </TouchableOpacity>
          </View>

          {/* Confirm password */}
          <TextInput
            value={passwordData.confirm}
            onChangeText={(v) => setPasswordData({ ...passwordData, confirm: v })}
            placeholder="Confirm New Password"
            placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
            secureTextEntry
            style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
          />

          <TouchableOpacity
            onPress={handleChangePassword}
            style={{ backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.lg, alignItems: 'center' }}
          >
            <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold }}>{hasPassword ? 'Update Password' : 'Set Password'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Email Address Card */}
      <View style={[authItemCardStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, marginRight: SPACE.md, gap: SPACE.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Mail size={24} color={THEME_COLORS.primary} />
            <Text style={authTitleStyle}>Email Address</Text>
          </View>
          <Text style={authMetaStyle}>
            {userProfile?.email
              ? `${userProfile.email}${userProfile.emailVerified ? '  • Verified' : '  • Unverified'}`
              : 'Add an email to log in with email + password'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowEmailLink((v) => !v);
            setEmailInput('');
          }}
          style={{ minWidth: 112, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' }}
        >
          <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: SPACE.xxs }}>
            {showEmailLink ? 'Cancel' : userProfile?.email ? 'Change' : 'Link'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Unverified-email helper: resend link */}
      {userProfile?.email && !userProfile.emailVerified && !showEmailLink && (
        <TouchableOpacity onPress={handleResendEmailVerification}>
          <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.brandBlueText, textAlign: 'center', textDecorationLine: 'underline' }}>
            Resend verification email
          </Text>
        </TouchableOpacity>
      )}

      {showEmailLink && (
        <View style={{ gap: SPACE.md }}>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@example.com"
            placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
          />

          {!hasPassword && (
            <>
              <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle }}>
                Set a password now so you can sign in with this email later.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl }}>
                <TextInput
                  value={emailPasswordInput}
                  onChangeText={setEmailPasswordInput}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                  secureTextEntry={!showEmailPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  style={{ flex: 1, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
                />
                <TouchableOpacity onPress={() => setShowEmailPassword((v) => !v)}>
                  {showEmailPassword ? <EyeOff size={18} color={THEME_COLORS.neutralTextSoftAlt} /> : <Eye size={18} color={THEME_COLORS.neutralTextSoftAlt} />}
                </TouchableOpacity>
              </View>
              <TextInput
                value={emailPasswordConfirm}
                onChangeText={setEmailPasswordConfirm}
                placeholder="Confirm password"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                secureTextEntry={!showEmailPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }}
              />
            </>
          )}

          <TouchableOpacity
            onPress={handleLinkEmail}
            disabled={emailLoading || !emailValid || (!hasPassword && (emailPasswordInput.length < 8 || emailPasswordInput !== emailPasswordConfirm))}
            style={{
              backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.lg, alignItems: 'center',
              opacity: emailLoading || !emailValid || (!hasPassword && (emailPasswordInput.length < 8 || emailPasswordInput !== emailPasswordConfirm)) ? 0.5 : 1,
            }}
          >
            {emailLoading
              ? <ActivityIndicator color={THEME_COLORS.white} />
              : <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold }}>
                  {hasPassword ? 'Send Verification Email' : 'Set Password & Send Verification'}
                </Text>}
          </TouchableOpacity>
          <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft, textAlign: 'center' }}>
            We’ll send a verification link to confirm the address.
          </Text>
        </View>
      )}

      {/* Phone Number Card */}
      <View style={[authItemCardStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, marginRight: SPACE.md, gap: SPACE.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Phone size={24} color={THEME_COLORS.primary} />
            <Text style={authTitleStyle}>Phone Number</Text>
          </View>
          <Text style={authMetaStyle}>
            {userProfile?.phone
              ? `${userProfile.phone}${userProfile.phoneVerified ? '  • Verified' : ''}`
              : 'Add a phone number to log in via SMS'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowPhoneLink((v) => !v);
            setPhoneOtpSent(false);
            setPhoneOtp('');
          }}
          style={{ minWidth: 112, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' }}
        >
          <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: SPACE.xxs }}>
            {showPhoneLink ? 'Cancel' : userProfile?.phone ? 'Change' : 'Link'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPhoneLink && (
        <View style={{ gap: SPACE.md }}>
          {!phoneOtpSent ? (
            <>
              <PhoneInput
                ref={phoneInputRef}
                defaultValue={phoneRaw}
                defaultCode="ZA"
                layout="first"
                onChangeText={setPhoneRaw}
                onChangeFormattedText={setPhoneFormatted}
                containerStyle={{ width: '100%', backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl }}
                textContainerStyle={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl }}
                textInputStyle={{ color: THEME_COLORS.primary, fontWeight: FONT_WEIGHT.bold }}
                codeTextStyle={{ color: THEME_COLORS.primary, fontWeight: FONT_WEIGHT.bold }}
              />
              <TouchableOpacity
                onPress={handleSendLinkOtp}
                disabled={phoneLoading || !isLinkedPhoneValid}
                style={{
                  backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.lg, alignItems: 'center',
                  opacity: phoneLoading || !isLinkedPhoneValid ? 0.5 : 1,
                }}
              >
                {phoneLoading
                  ? <ActivityIndicator color={THEME_COLORS.white} />
                  : <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold }}>Send SMS Code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle, textAlign: 'center' }}>
                We sent a 6-digit code to {phoneFormatted}
              </Text>
              <TextInput
                value={phoneOtp}
                onChangeText={(t) => setPhoneOtp(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                maxLength={6}
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.otp, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.onSurface, textAlign: 'center', letterSpacing: SPACE.sm }}
              />
              <TouchableOpacity
                onPress={handleVerifyLinkOtp}
                disabled={phoneLoading || phoneOtp.length !== 6}
                style={{
                  backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.lg, alignItems: 'center',
                  opacity: phoneLoading || phoneOtp.length !== 6 ? 0.5 : 1,
                }}
              >
                {phoneLoading
                  ? <ActivityIndicator color={THEME_COLORS.white} />
                  : <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold }}>Verify & Link Phone</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setPhoneOtpSent(false); setPhoneOtp(''); }}>
                <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSoft, textAlign: 'center' }}>Change number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* 2FA Card */}
      <View style={[authItemCardStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, marginRight: SPACE.md, gap: SPACE.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Smartphone size={24} color={THEME_COLORS.primary} />
            <Text style={authTitleStyle}>Two-Factor Authentication</Text>
          </View>
          <Text style={authMetaStyle}>Add an extra layer of security</Text>
        </View>
        <TouchableOpacity
          onPress={handleToggle2FA}
          disabled={loading2FA}
          style={{
            width: SPACE.s52, height: TYPE_SCALE.otpLarge, borderRadius: RADIUS.pill,
            backgroundColor: userProfile?.twoFactorEnabled ? THEME_COLORS.primary : THEME_COLORS.primaryContainer,
            justifyContent: 'center',
            opacity: loading2FA ? 0.5 : 1,
          }}
        >
          {loading2FA ? (
            <ActivityIndicator size="small" color={THEME_COLORS.white} style={{ alignSelf: 'center' }} />
          ) : (
            <View style={{
              width: SPACE.xl, height: SPACE.xl, borderRadius: RADIUS.sm, backgroundColor: THEME_COLORS.white,
              position: 'absolute',
              left: userProfile?.twoFactorEnabled ? undefined : SPACE.xxs,
              right: userProfile?.twoFactorEnabled ? SPACE.xxs : undefined,
            }} />
          )}
        </TouchableOpacity>
      </View>

      {/* 2FA Setup Flow */}
      {show2FASetup && twoFASetupData && (
        <View style={{ backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.card, padding: SPACE.xxl, gap: SPACE.xl, borderWidth: 1, borderColor: THEME_COLORS.successTintSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s10 }}>
            <View style={{ width: SPACE.s32, height: SPACE.s32, borderRadius: RADIUS.sm, backgroundColor: THEME_COLORS.successTintSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Info size={18} color={THEME_COLORS.primary} />
            </View>
            <Text style={{ fontSize: TYPE_SCALE.xxl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>Enable Two-Factor Authentication</Text>
          </View>

          {/* QR Code */}
          <View style={{ alignItems: 'center', gap: SPACE.sm }}>
            <View style={{ padding: SPACE.lg, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.card, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
              {twoFASetupData.qrCode ? (
                <QRCode value={twoFASetupData.qrCode} size={160} />
              ) : (
                <View style={{ width: SPACE.s160, height: SPACE.s160, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={THEME_COLORS.primary} />
                </View>
              )}
            </View>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: SPACE.xs }}>Step 1: Scan QR Code</Text>
          </View>

          {/* Manual entry key */}
          {twoFASetupData.secret && (
            <View style={{ gap: SPACE.md }}>
              <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: SPACE.xs }}>Step 2: Manual Entry Key</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.s14, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorder }}>
                <Text style={{ flex: 1, fontFamily: 'monospace', fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary, letterSpacing: SPACE.xs }} selectable>
                  {twoFASetupData.secret}
                </Text>
                <TouchableOpacity
                  onPress={handleCopyKey}
                  style={{ padding: SPACE.sm, borderRadius: RADIUS.sm, backgroundColor: THEME_COLORS.successTintSofterAlt }}
                >
                  {copied ? <Check size={16} color={THEME_COLORS.primary} /> : <Copy size={16} color={THEME_COLORS.primary} />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Verification code */}
          <View style={{ gap: SPACE.sm }}>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: SPACE.xs }}>Step 3: Verify & Enable</Text>
            <TextInput
              value={verificationCode}
              onChangeText={(t) => setVerificationCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={THEME_COLORS.blackOverlay20}
              keyboardType="numeric"
              maxLength={6}
              style={{
                backgroundColor: THEME_COLORS.surfaceContainerLow,
                borderRadius: RADIUS.xl,
                paddingHorizontal: SPACE.xxl,
                paddingVertical: SPACE.s18,
                fontSize: TYPE_SCALE.otpLarge,
                fontWeight: FONT_WEIGHT.extrabold,
                color: THEME_COLORS.onSurface,
                textAlign: 'center',
                letterSpacing: SPACE.md,
                borderWidth: 2,
                borderColor: verificationCode.length === 6 ? THEME_COLORS.success : THEME_COLORS.alias_rgba_0_0_0_0_1,
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: SPACE.md }}>
            <TouchableOpacity
              onPress={handleVerify2FA}
              disabled={loading2FA || verificationCode.length !== 6}
              style={{
                flex: 1, paddingVertical: SPACE.lg, borderRadius: RADIUS.xl,
                backgroundColor: THEME_COLORS.primary, alignItems: 'center',
                opacity: (loading2FA || verificationCode.length !== 6) ? 0.5 : 1,
              }}
            >
              {loading2FA ? (
                <ActivityIndicator size="small" color={THEME_COLORS.white} />
              ) : (
                <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: SPACE.xxs }}>Verify & Enable</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShow2FASetup(false); setTwoFASetupData(null); setVerificationCode(''); }}
              style={{ paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.xl, backgroundColor: THEME_COLORS.surfaceContainerLow, alignItems: 'center' }}
            >
              <Text style={{ color: THEME_COLORS.neutralTextSoft, fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status */}
      {status && (
        <View style={{
          padding: SPACE.s14, borderRadius: RADIUS.lg, flexDirection: 'row', alignItems: 'center', gap: SPACE.s10,
          backgroundColor: status.type === 'success' ? THEME_COLORS.successTintSoftAlt : THEME_COLORS.errorTintSoft,
        }}>
          {status.type === 'success'
            ? <CheckCircle2 size={18} color={THEME_COLORS.success} />
            : <AlertTriangle size={18} color={THEME_COLORS.errorStrong} />}
          <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: status.type === 'success' ? THEME_COLORS.successStrongAlt : THEME_COLORS.errorStrong }}>
            {status.message}
          </Text>
        </View>
      )}
    </View>
  );
};
