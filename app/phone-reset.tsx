import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import PhoneInput from 'react-native-phone-number-input';
import { ArrowLeft, Phone, KeyRound, Lock } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { THEME_COLORS } from '../src/theme/colors';

const TYPE_SCALE = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 14,
  xl: 18,
  hero: 24,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};
const RADIUS = {
  md: 12,
  lg: 16,
  xl: 20,
};
const LETTER_SPACING = {
  normal: 1,
  otp: 8,
};

type Step = 'phone' | 'otp' | 'done';

export default function PhoneResetScreen() {
  const router = useRouter();
  const { sendPhoneResetOtp, resetPasswordWithPhone } = useAuth();
  const phoneInputRef = useRef<PhoneInput>(null);

  const [step, setStep] = useState<Step>('phone');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phoneFormatted, setPhoneFormatted] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhoneValid =
    phoneFormatted.length >= 8 && (phoneInputRef.current?.isValidNumber(phoneRaw) ?? false);

  const handleSendOtp = async () => {
    if (loading || !isPhoneValid) return;
    setLoading(true);
    setError(null);
    try {
      await sendPhoneResetOtp(phoneFormatted);
      setStep('otp');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Failed to send OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (loading) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordWithPhone(phoneFormatted, otp, newPassword);
      setStep('done');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Reset failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME_COLORS.white }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACE.md, gap: SPACE.sm }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: SPACE.xs, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.surfaceContainerLow }}
        >
          <ArrowLeft size={20} color={THEME_COLORS.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>Reset Password via SMS</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.md }} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={{ backgroundColor: THEME_COLORS.errorSurface, borderColor: THEME_COLORS.errorBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.sm }}>
              <Text style={{ color: THEME_COLORS.error, fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          {step === 'phone' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                <Phone size={18} color={THEME_COLORS.primary} />
                <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Your phone number</Text>
              </View>
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
                onPress={handleSendOtp}
                disabled={loading || !isPhoneValid}
                style={{
                  backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.md, alignItems: 'center',
                  opacity: loading || !isPhoneValid ? 0.5 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color={THEME_COLORS.white} />
                  : <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Send Reset Code</Text>}
              </TouchableOpacity>
              <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.neutralTextSoft, textAlign: 'center', marginTop: SPACE.xs }}>
                If your phone is linked to an account with a password, we'll text you a code.
              </Text>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                <KeyRound size={18} color={THEME_COLORS.primary} />
                <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Enter the 6-digit code</Text>
              </View>
              <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoftAlt }}>Sent to {phoneFormatted}</Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                maxLength={6}
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, fontSize: TYPE_SCALE.hero, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.onSurface, textAlign: 'center', letterSpacing: LETTER_SPACING.otp }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs }}>
                <Lock size={18} color={THEME_COLORS.primary} />
                <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>New password</Text>
              </View>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                secureTextEntry
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, fontSize: TYPE_SCALE.lg, color: THEME_COLORS.onSurface }}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                secureTextEntry
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, fontSize: TYPE_SCALE.lg, color: THEME_COLORS.onSurface }}
              />

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={{
                  backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.md, alignItems: 'center',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color={THEME_COLORS.white} />
                  : <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
                <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft, textAlign: 'center' }}>Change phone number</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <View style={{ alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.xxl }}>
              <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary, textAlign: 'center' }}>
                Password updated
              </Text>
              <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoftAlt, textAlign: 'center' }}>
                You can now sign in with your new password.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/landing')}
                style={{ backgroundColor: THEME_COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xxl }}
              >
                <Text style={{ color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
