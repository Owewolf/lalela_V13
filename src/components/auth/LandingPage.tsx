import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';


// Simple checkbox component
const Checkbox: React.FC<{ checked: boolean; onChange: (val: boolean) => void }> = ({ checked, onChange }) => (
  <TouchableOpacity
    onPress={() => onChange(!checked)}
    className="w-5 h-5 rounded-md border-2 items-center justify-center mr-1"
    style={{ borderColor: checked ? '#0d3d47' : '#d1d5db', backgroundColor: checked ? '#0d3d47' : 'transparent' }}
  >
    {checked && <Text className="text-white text-[10px] font-black">✓</Text>}
  </TouchableOpacity>
);

type JoinMode = 'start' | 'login';

const LandingPage: React.FC = () => {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [joinMode, setJoinMode] = useState<JoinMode>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+27');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  // Phone / OTP
  const { signIn, register, resendVerification, forgotPassword, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const { signInWithPhone, verifySmsCode } = {
    signInWithPhone: async (phone: string) => { await sendPhoneOtp(phone); },
    verifySmsCode: async (code: string) => { await verifyPhoneOtp(getFormattedPhoneNumber(), code); return null; },
  };
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Country picker
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const countryCodes = ['+27', '+1', '+44', '+91', '+254', '+234', '+49', '+33', '+61'];

  const isPhoneMode = mobileNumber.length > 0;

  const getFormattedPhoneNumber = () => {
    let clean = mobileNumber.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (mobileNumber.startsWith('+')) return mobileNumber;
    return `${countryCode}${clean}`;
  };


  const handleVerifyOtp = async () => {
    if (isSubmitting || otpCode.length !== 6) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyPhoneOtp(getFormattedPhoneNumber(), otpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await resendVerification(email);
    } catch (err: any) {
      setError('Could not resend. Please try again shortly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (isPhoneMode) {
        if (joinMode === 'start' && !agreedToTerms) throw new Error('You must agree to the Terms & Conditions.');
        await sendPhoneOtp(getFormattedPhoneNumber());
        setIsOtpSent(true);
        return;
      }

      if (joinMode === 'login') {
        await signIn(email, password);
        // AuthContext updates userProfile; AppGuard handles routing
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!agreedToTerms) throw new Error('You must agree to the Terms & Conditions.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');

        await register(email, password, `${name} ${lastName}`.trim(), undefined);

        await AsyncStorage.multiSet([
          ['pending_reg_name', `${name} ${lastName}`.trim()],
          ['pending_reg_first_name', name],
          ['pending_reg_last_name', lastName],
          ['pending_reg_agreed', agreedToTerms ? 'true' : 'false'],
          ['pending_reg_marketing', marketingConsent ? 'true' : 'false'],
          ['pending_reg_email', email],
          ['pending_onboarding_mode', 'start'],
        ]);

        setVerificationEmailSent(true);
      }
    } catch (err: any) {
      // Map server error messages to user-friendly strings
      const msg: string = err?.response?.data?.error ?? err.message ?? 'An error occurred.';
      if (msg.includes('already exists') || msg.includes('already in use')) setError('An account with this email already exists. Try signing in.');
      else if (msg.includes('Invalid credentials') || msg.includes('invalid-credential')) setError('Incorrect credentials. Please try again.');
      else if (msg.includes('not verified') || msg.includes('verify')) setError('Your email has not been verified. Check your inbox then sign in again.');
      else if (msg.includes('Too many')) setError('Too many failed attempts. Please try again later.');
      else setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!forgotEmail || forgotSubmitting) return;
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      await forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (err: any) {
      const msg: string = err?.response?.data?.error ?? err.message ?? 'An error occurred.';
      setForgotError(msg);
    } finally {
      setForgotSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const switchTab = (mode: JoinMode) => {
    setJoinMode(mode);
    setIsOtpSent(false);
    setError(null);
    setVerificationEmailSent(false);
    // Scroll to auth form so it's immediately visible
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header / Nav ── */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
          <View className="flex-row items-center gap-2">
            <Image 
              source={require('../../../assets/icon.png')} 
              className="w-10 h-10 rounded-xl"
              resizeMode="cover"
            />
            <Text className="text-2xl font-black text-[#0d3d47] tracking-tight">lalela</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => switchTab('login')}
              className="px-4 py-2 rounded-full border border-[#0d3d47]"
            >
              <Text className="text-[#0d3d47] font-black text-xs uppercase tracking-widest">Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => switchTab('start')}
              className="px-4 py-2 rounded-full bg-[#0d3d47]"
            >
              <Text className="text-white font-black text-xs uppercase tracking-widest">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero ── */}
        <View className="px-6 pt-10 pb-8">
          <Text className="text-5xl font-black text-[#0d3d47] leading-tight mb-4">
            no more talk talk —{'\n'}
            <Text className="text-orange-500">it's listen, listen, do.</Text>
          </Text>
          <Text className="text-base text-gray-500 font-medium leading-relaxed mb-8">
            join your community. trade safely.{'\n'}give back with every deal.
          </Text>
          <View className="flex-row gap-3 flex-wrap">
            <TouchableOpacity
              onPress={() => switchTab('start')}
              className="px-6 py-4 rounded-2xl flex-row items-center gap-2"
              style={{ backgroundColor: '#f97316' }}
            >
              <Text className="text-white font-black uppercase tracking-widest text-sm">Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => switchTab('login')}
              className="px-6 py-4 bg-[#0d3d47] rounded-2xl"
            >
              <Text className="text-white font-black uppercase tracking-widest text-sm">Login</Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* ── Auth Form ── */}
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="mx-6 mb-6"
        >
          <View className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
            {/* CTA */}
            <View className="mb-6 gap-4">
              <Text className="text-3xl font-black text-[#0d3d47] leading-tight">
                Start your community today
              </Text>
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-2xl bg-surface-container-low items-center justify-center">
                  <Text className="text-[#0d3d47] text-base font-black">✓</Text>
                </View>
                <Text className="font-bold text-[#0d3d47] text-sm">30 days free for admins</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-2xl bg-orange-50 items-center justify-center">
                  <Text className="text-[#f97316] text-base font-black">+ +</Text>
                </View>
                <Text className="font-bold text-[#0d3d47] text-sm">Unlimited member invites</Text>
              </View>
            </View>

            {/* Verification email sent — replaces form */}
            {verificationEmailSent ? (
              <View className="gap-6 items-center py-4">
                <View className="w-20 h-20 rounded-full bg-[#f0fdf4] items-center justify-center">
                  <Text className="text-[#0d3d47] text-3xl font-black">@</Text>
                </View>
                <Text className="text-2xl font-black text-[#0d3d47] text-center">Verify Your Email</Text>
                <Text className="text-sm text-gray-500 text-center leading-relaxed">
                  We've sent a verification link to{'\n'}
                  <Text className="font-bold text-[#0d3d47]">{email}</Text>
                </Text>
                <View className="bg-orange-50 border border-orange-100 rounded-2xl p-4 w-full">
                  <Text className="text-xs text-gray-600 text-center leading-relaxed">
                    Click the link in your email to activate your account.{'\n'}
                    Then come back here and sign in.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setVerificationEmailSent(false); switchTab('login'); }}
                  className="w-full py-4 bg-[#0d3d47] rounded-2xl items-center"
                >
                  <Text className="text-white font-black uppercase tracking-widest">Go to Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleResendVerification}
                  disabled={isSubmitting}
                  className="items-center py-2"
                  style={{ opacity: isSubmitting ? 0.5 : 1 }}
                >
                  <Text className="text-sm font-bold text-[#0d3d47]">
                    {isSubmitting ? 'Sending…' : 'Resend verification email'}
                  </Text>
                </TouchableOpacity>
                {error && (
                  <View className="bg-red-50 border border-red-100 rounded-2xl p-4 w-full">
                    <Text className="text-xs text-red-600 font-medium text-center">{error}</Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Tab switcher */}
                <View className="flex-row p-1.5 bg-gray-100 rounded-3xl mb-6">
                  {(['start', 'login'] as JoinMode[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => switchTab(m)}
                      className="flex-1 py-3 rounded-2xl items-center"
                      style={{ backgroundColor: joinMode === m ? 'white' : 'transparent' }}
                    >
                      <Text
                        className="font-black uppercase tracking-widest text-xs"
                        style={{ color: joinMode === m ? '#0d3d47' : '#9ca3af' }}
                      >
                        {m === 'start' ? 'Sign Up' : 'Login'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View className="mb-4 gap-1">
                  <Text className="text-2xl font-black text-[#0d3d47] text-center leading-tight">
                    {joinMode === 'start' ? 'Create Your Account' : 'Welcome Back'}
                  </Text>
                  <Text className="text-sm text-gray-500 text-center">
                    {joinMode === 'start'
                      ? 'Start or join a community — set up in minutes'
                      : 'Sign in to access your communities'}
                  </Text>
                </View>

                {/* OTP form (phone) */}
                {isOtpSent ? (
                  <View className="gap-4">
                    <View className="gap-1 items-center">
                      <Text className="text-lg font-black text-[#0d3d47]">Verify Your Number</Text>
                      <Text className="text-sm text-gray-500">
                        We've sent a code to {getFormattedPhoneNumber()}
                      </Text>
                    </View>
                    <View className="gap-1">
                      <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">
                        6-Digit Code
                      </Text>
                      <TextInput
                        value={otpCode}
                        onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="000000"
                        keyboardType="number-pad"
                        className="w-full px-6 py-4 bg-gray-100 rounded-2xl font-bold text-center tracking-widest text-2xl text-[#0d3d47]"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleVerifyOtp}
                      disabled={isSubmitting || otpCode.length !== 6}
                      className="py-4 rounded-2xl items-center"
                      style={{ backgroundColor: '#f97316', opacity: isSubmitting || otpCode.length !== 6 ? 0.5 : 1 }}
                    >
                      {isSubmitting
                        ? <ActivityIndicator color="white" size="small" />
                        : <Text className="text-white font-black text-base uppercase tracking-widest">Verify Code</Text>
                      }
                    </TouchableOpacity>
                    {error && (
                      <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
                        <Text className="text-xs text-red-600 font-medium text-center">{error}</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setIsOtpSent(false)} className="items-center py-2">
                      <Text className="text-sm font-bold text-gray-400">Use a different number</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-4">
                    {/* Name fields (sign up only) */}
                    {joinMode === 'start' && (
                      <View className="flex-row gap-3">
                        <View className="flex-1 gap-1">
                          <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">First Name *</Text>
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Sipho"
                            className="px-4 py-3 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                        <View className="flex-1 gap-1">
                          <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Last Name *</Text>
                          <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="e.g. Ndlovu"
                            className="px-4 py-3 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                      </View>
                    )}

                    {/* Email */}
                    <View className="gap-1">
                      <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                        Email Address{joinMode === 'start' ? ' *' : ''}
                      </Text>
                      <TextInput
                        value={email}
                        onChangeText={(t) => { setEmail(t); if (t) setMobileNumber(''); }}
                        placeholder="your@email.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={mobileNumber.length === 0}
                        className="px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]"
                        placeholderTextColor="#9ca3af"
                        style={{ opacity: mobileNumber.length > 0 ? 0.4 : 1 }}
                      />
                    </View>

                    {/* OR divider */}
                    <View className="flex-row items-center gap-2">
                      <View className="flex-1 h-px bg-gray-200" />
                      <Text className="text-[10px] font-black uppercase tracking-widest text-gray-300">or</Text>
                      <View className="flex-1 h-px bg-gray-200" />
                    </View>

                    {/* Phone */}
                    <View className="gap-1">
                      <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                        Phone Number{joinMode === 'start' ? ' *' : ''}
                      </Text>
                      <View className="flex-row gap-2" style={{ opacity: email.length > 0 ? 0.4 : 1 }}>
                        <TouchableOpacity
                          onPress={() => email.length === 0 && setShowCountryPicker(true)}
                          className="px-3 py-4 bg-gray-100 rounded-2xl items-center justify-center min-w-[72px]"
                        >
                          <Text className="font-bold text-[#0d3d47]">{countryCode}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={mobileNumber}
                          onChangeText={(t) => { setMobileNumber(t); if (t) setEmail(''); }}
                          placeholder="082 123 4567"
                          keyboardType="phone-pad"
                          editable={email.length === 0}
                          className="flex-1 px-4 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>

                    {/* Password */}
                    {!isPhoneMode && (
                      <View className="gap-1">
                        <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                          Password{joinMode === 'start' ? ' *' : ''}
                        </Text>
                        <View className="relative flex-row items-center">
                          <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Enter your password"
                            secureTextEntry={!showPassword}
                            className="flex-1 px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47] pr-12"
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4">
                            <Text className="text-xs font-bold text-[#9ca3af]">{showPassword ? 'Hide' : 'Show'}</Text>
                          </TouchableOpacity>
                        </View>
                        {joinMode === 'login' && (
                          <TouchableOpacity
                            onPress={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); setForgotError(null); }}
                            className="mt-1 ml-1"
                          >
                            <Text className="text-xs font-bold text-[#0d3d47]">Forgot password?</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Confirm Password */}
                    {joinMode === 'start' && !isPhoneMode && (
                      <View className="gap-1">
                        <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                          Confirm Password *
                        </Text>
                        <View className="relative flex-row items-center">
                          <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter your password"
                            secureTextEntry={!showConfirmPassword}
                            className="flex-1 px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47] pr-12"
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4">
                            <Text className="text-xs font-bold text-[#9ca3af]">{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Terms */}
                    {joinMode === 'start' && (
                      <View className="gap-3 pt-1">
                        <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)} className="flex-row items-start gap-2">
                          <Checkbox checked={agreedToTerms} onChange={setAgreedToTerms} />
                          <Text className="flex-1 text-xs text-gray-500 leading-relaxed">
                            I agree to the{' '}
                            <Text className="font-bold text-[#0d3d47]">Terms & Conditions</Text>
                            {' '}and{' '}
                            <Text className="font-bold text-[#0d3d47]">Privacy Policy</Text>
                            {' *'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMarketingConsent(!marketingConsent)} className="flex-row items-start gap-2">
                          <Checkbox checked={marketingConsent} onChange={setMarketingConsent} />
                          <Text className="flex-1 text-xs text-gray-500 leading-relaxed">
                            I'd like to receive community updates and promotional emails
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                      onPress={handleAuthSubmit}
                      disabled={isSubmitting}
                      className="py-4 rounded-2xl items-center"
                      style={{ backgroundColor: '#f97316', opacity: isSubmitting ? 0.5 : 1 }}
                    >
                      {isSubmitting
                        ? <ActivityIndicator color="white" size="small" />
                        : <Text className="text-white font-black text-base uppercase tracking-widest">
                            {joinMode === 'start' ? 'Create Account' : 'Sign In'}
                          </Text>
                      }
                    </TouchableOpacity>

                    {error && (
                      <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
                        <Text className="text-xs text-red-600 font-medium text-center">{error}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {Platform.OS === 'web' && (
          <View className="bg-[#0d3d47] px-6 py-12">
            <View className="flex-row items-center gap-2 mb-4">
              <Image 
                source={require('../../../assets/icon.png')} 
                className="w-8 h-8 rounded-lg"
                resizeMode="cover"
              />
              <Text className="text-2xl font-black text-white tracking-tight">lalela</Text>
            </View>
            <Text className="text-xs text-white/50 font-medium leading-relaxed mb-6">
              Build your own community — access your stage in some days.
            </Text>
            <View className="flex-row flex-wrap gap-x-6 gap-y-2">
              {['About', 'Privacy', 'Terms', 'Support', 'Contact'].map((link) => (
                <Text key={link} className="text-xs font-bold text-white/50">{link}</Text>
              ))}
            </View>
            <Text className="text-xs text-white/30 mt-6">© 2026 Lalela. All rights reserved.</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Country code picker ── */}
      <Modal transparent visible={showCountryPicker} animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/40"
          onPress={() => setShowCountryPicker(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10">
            <Text className="text-lg font-black text-[#0d3d47] mb-4 text-center">Select Country Code</Text>
            {countryCodes.map((code) => (
              <TouchableOpacity
                key={code}
                onPress={() => { setCountryCode(code); setShowCountryPicker(false); }}
                className="py-3 border-b border-gray-100 items-center"
              >
                <Text className="font-bold text-base" style={{ color: countryCode === code ? '#0d3d47' : '#374151' }}>
                  {code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Forgot password bottom sheet ── */}
      <Modal transparent visible={showForgotPassword} animationType="slide" onRequestClose={() => setShowForgotPassword(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/50 items-end justify-end"
          activeOpacity={1}
          onPress={() => setShowForgotPassword(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl p-8"
            style={{ paddingBottom: 40 }}
          >
            {forgotSent ? (
              <View className="gap-4 items-center">
                <View className="w-16 h-16 rounded-full bg-surface items-center justify-center">
                  <Text className="text-[#0d3d47] text-2xl font-black">@</Text>
                </View>
                <Text className="text-2xl font-black text-[#0d3d47] text-center">Check Your Email</Text>
                <Text className="text-gray-500 text-center font-medium">
                  We sent a password reset link to{' '}
                  <Text className="font-bold text-[#0d3d47]">{forgotEmail}</Text>
                </Text>
                <Text className="text-sm text-gray-400 text-center leading-relaxed">
                  Click the link in the email to set a new password. Check your spam folder if you don't see it.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowForgotPassword(false)}
                  className="w-full py-4 bg-[#0d3d47] rounded-2xl items-center"
                >
                  <Text className="text-white font-black uppercase tracking-widest">Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View className="gap-4">
                  <Text className="text-2xl font-black text-[#0d3d47] text-center">Reset Password</Text>
                  <Text className="text-sm text-gray-500 text-center">
                    Enter your email and we'll send you a link to reset your password.
                  </Text>
                  <View className="gap-1">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                      Email Address
                    </Text>
                    <TextInput
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder="your@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  {forgotError && (
                    <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
                      <Text className="text-xs text-red-600 font-medium text-center">{forgotError}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    disabled={forgotSubmitting || !forgotEmail}
                    className="py-4 rounded-2xl items-center"
                    style={{ backgroundColor: '#f97316', opacity: forgotSubmitting || !forgotEmail ? 0.5 : 1 }}
                  >
                    {forgotSubmitting
                      ? <ActivityIndicator color="white" size="small" />
                      : <Text className="text-white font-black uppercase tracking-widest">Send Reset Link</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowForgotPassword(false)} className="items-center py-2">
                    <Text className="text-sm font-bold text-gray-400">Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default LandingPage;
