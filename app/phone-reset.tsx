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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, borderRadius: 12, backgroundColor: '#f5f5f5' }}
        >
          <ArrowLeft size={20} color="#0d3d47" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0d3d47' }}>Reset Password via SMS</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 16, padding: 12 }}>
              <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          {step === 'phone' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Phone size={18} color="#0d3d47" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d3d47' }}>Your phone number</Text>
              </View>
              <PhoneInput
                ref={phoneInputRef}
                defaultValue={phoneRaw}
                defaultCode="ZA"
                layout="first"
                onChangeText={setPhoneRaw}
                onChangeFormattedText={setPhoneFormatted}
                containerStyle={{ width: '100%', backgroundColor: '#f5f5f5', borderRadius: 20 }}
                textContainerStyle={{ backgroundColor: '#f5f5f5', borderRadius: 20 }}
                textInputStyle={{ color: '#0d3d47', fontWeight: '700' }}
                codeTextStyle={{ color: '#0d3d47', fontWeight: '700' }}
              />
              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={loading || !isPhoneValid}
                style={{
                  backgroundColor: '#0d3d47', borderRadius: 20, paddingVertical: 16, alignItems: 'center',
                  opacity: loading || !isPhoneValid ? 0.5 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Send Reset Code</Text>}
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 }}>
                If your phone is linked to an account with a password, we'll text you a code.
              </Text>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color="#0d3d47" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d3d47' }}>Enter the 6-digit code</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#666' }}>Sent to {phoneFormatted}</Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                maxLength={6}
                style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 16, fontSize: 24, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', letterSpacing: 8 }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Lock size={18} color="#0d3d47" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d3d47' }}>New password</Text>
              </View>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 8 chars)"
                placeholderTextColor="#aaa"
                secureTextEntry
                style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, fontSize: 14, color: '#1a1a1a' }}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#aaa"
                secureTextEntry
                style={{ backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, fontSize: 14, color: '#1a1a1a' }}
              />

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={{
                  backgroundColor: '#0d3d47', borderRadius: 20, paddingVertical: 16, alignItems: 'center',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
                <Text style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>Change phone number</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <View style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0d3d47', textAlign: 'center' }}>
                Password updated
              </Text>
              <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                You can now sign in with your new password.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/landing')}
                style={{ backgroundColor: '#0d3d47', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 32 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
