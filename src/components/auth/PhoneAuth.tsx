import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import { KeyRound, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME_COLORS } from '../../theme/colors';

const SPACE = {
  zero: 0,
  xs: 4,
  lg: 16,
};
const RADIUS = {
  lg: 16,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

interface PhoneAuthProps {
  onSuccess?: (user: any) => Promise<void> | void;
  onError?: (error: string) => void;
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onCancel,
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={() => {}}>
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_05 }}>
      <View className="rounded-3xl p-8 w-full max-w-sm" style={{ backgroundColor: THEME_COLORS.surface }}>
        <Text className="text-xl font-bold text-primary mb-2">{title}</Text>
        <Text className="text-sm text-gray-500 mb-6">{message}</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onCancel}
            className="flex-1 py-3 rounded-2xl items-center"
            style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
          >
            <Text className="font-bold text-gray-600">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 py-3 rounded-2xl bg-primary items-center opacity-100 disabled:opacity-50"
            style={{ opacity: confirmDisabled ? 0.5 : 1 }}
          >
            <Text className="font-bold text-white">{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export const PhoneAuth: React.FC<PhoneAuthProps> = ({ onSuccess, onError }) => {
  const { sendPhoneOtp, verifyPhoneOtp, userProfile } = useAuth();
  const phoneInputRef = useRef<PhoneInput>(null);
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'sendCode' | 'verifyCode' | null>(null);

  const isPhoneValid =
    phoneNumber.length >= 8 && (phoneInputRef.current?.isValidNumber(phoneRaw) ?? false);

  const handleConfirmSendCode = async () => {
    setLocalError(null);
    setIsLoading(true);
    try {
      await sendPhoneOtp(phoneNumber);
      setOtpSent(true);
    } catch (err: any) {
      console.error('Phone auth error:', err);
      const msg = err.message || 'Failed to send code';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  const handlePrepareSendCode = () => {
    if (isLoading || !isPhoneValid) return;
    setPendingAction('sendCode');
    setShowConfirm(true);
  };

  const handleConfirmVerifyCode = async () => {
    setLocalError(null);
    setIsLoading(true);
    try {
      await verifyPhoneOtp(phoneNumber, otpCode);
      await onSuccess?.(userProfile);
    } catch (err: any) {
      console.error('OTP verify error:', err);
      const msg = err.message || 'Failed to verify code';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
      setPendingAction(null);
    }
  };

  const handlePrepareVerifyCode = () => {
    if (isLoading || otpCode.length !== 6) return;
    setPendingAction('verifyCode');
    setShowConfirm(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="w-full"
    >
      <View className="w-full space-y-4">
        {localError && (
          <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <Text className="text-xs text-red-600 font-medium text-center">{localError}</Text>
          </View>
        )}

        {!otpSent ? (
          <View className="space-y-4">
            <View className="space-y-2">
              <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">
                Mobile Number
              </Text>
              <PhoneInput
                ref={phoneInputRef}
                defaultValue={phoneRaw}
                defaultCode="ZA"
                layout="first"
                onChangeText={setPhoneRaw}
                onChangeFormattedText={setPhoneNumber}
                withDarkTheme={false}
                withShadow={false}
                autoFocus={false}
                containerStyle={{ width: '100%', backgroundColor: THEME_COLORS.neutralBgSofter, borderRadius: RADIUS.lg, paddingVertical: SPACE.xs }}
                textContainerStyle={{ backgroundColor: THEME_COLORS.neutralBgSofter, borderRadius: RADIUS.lg, paddingVertical: SPACE.zero }}
                textInputStyle={{ color: THEME_COLORS.primary, fontWeight: FONT_WEIGHT.bold }}
                codeTextStyle={{ color: THEME_COLORS.primary, fontWeight: FONT_WEIGHT.bold }}
                textInputProps={{ placeholderTextColor: THEME_COLORS.neutralTextSoft, accessibilityLabel: 'Phone number' }}
              />
            </View>
            <TouchableOpacity
              onPress={handlePrepareSendCode}
              disabled={isLoading || !isPhoneValid}
              className="w-full py-5 rounded-2xl items-center justify-center flex-row gap-2"
              style={{ backgroundColor: isLoading || !isPhoneValid ? THEME_COLORS.tertiaryFixed : THEME_COLORS.primary, opacity: isLoading || !isPhoneValid ? 0.6 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-black text-lg uppercase tracking-widest">
                  Send SMS Code
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-4">
            <View className="space-y-2">
              <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">
                6-Digit Code
              </Text>
              <View className="relative">
                <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                  <KeyRound size={20} color={THEME_COLORS.primary} />
                </View>
                <TextInput
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  importantForAutofill="yes"
                  maxLength={6}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl font-bold text-primary text-center text-xl tracking-widest"
                  style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
                  placeholderTextColor={THEME_COLORS.neutralTextSoft}
                />
              </View>
              <Text className="text-xs text-gray-500 text-center mt-2 px-2 leading-relaxed">
                We've sent a 6-digit code to{' '}
                <Text className="font-bold">{phoneNumber}</Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={handlePrepareVerifyCode}
              disabled={isLoading || otpCode.length !== 6}
              className="w-full py-5 rounded-2xl items-center justify-center"
              style={{ backgroundColor: THEME_COLORS.primary, opacity: isLoading || otpCode.length !== 6 ? 0.5 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-black text-lg uppercase tracking-widest">
                  Verify Code
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setOtpSent(false);
                setOtpCode('');
              }}
              disabled={isLoading}
              className="w-full py-3 items-center justify-center flex-row gap-2"
            >
              <ArrowLeft size={16} color={THEME_COLORS.neutralTextSoft} />
              <Text className="text-gray-400 text-sm font-bold">Change Mobile Number</Text>
            </TouchableOpacity>
          </View>
        )}

        <ConfirmModal
          visible={showConfirm}
          title={pendingAction === 'verifyCode' ? 'Confirm OTP Verification' : 'Confirm SMS Send'}
          message={
            pendingAction === 'verifyCode'
              ? 'Confirm you want to verify this one-time code.'
              : 'Confirm you want to send an SMS verification code to this phone number.'
          }
          confirmLabel={
            pendingAction === 'verifyCode'
              ? isLoading ? 'Verifying...' : 'Yes, verify'
              : isLoading ? 'Sending...' : 'Yes, send'
          }
          confirmDisabled={isLoading}
          onConfirm={() => {
            if (pendingAction === 'verifyCode') {
              void handleConfirmVerifyCode();
              return;
            }
            void handleConfirmSendCode();
          }}
          onCancel={() => {
            if (isLoading) return;
            setShowConfirm(false);
            setPendingAction(null);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};
