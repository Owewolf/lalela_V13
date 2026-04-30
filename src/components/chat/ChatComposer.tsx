import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Send, Camera, ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadImage } from '../../lib/uploadImage';
import { useAuth } from '../../context/AuthContext';

interface ChatComposerProps {
  onSend: (text: string) => void;
  onSendAttachment: (url: string, type: 'image') => void | Promise<void>;
  onTyping: (isTyping: boolean) => void;
  onSendLocation?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSend,
  onSendAttachment,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [text, onSend, onTyping]);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 3000);
    },
    [onTyping]
  );

  const uploadAndSend = async (uri: string, _mimeType: string = 'image/jpeg') => {
    if (!userProfile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(uri, 'chat', userProfile.id);
      await onSendAttachment(url, 'image');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAndSend(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to share images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAndSend(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
    }
  };

  if (disabled) {
    return (
      <View className="px-3 pb-3 pt-2">
        <View className="flex-row items-center justify-center gap-2 py-3 px-4 bg-red-50 border border-red-200 rounded-2xl">
          <Text className="text-red-600 text-xs font-bold text-center">
            Your trial has expired. Pay R149 once-off for lifetime membership to continue chatting.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="bg-white/95 px-3 pt-2 border-t border-gray-200"
      style={{ paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 12 }}
    >
      {/* Upload error */}
      {uploadError ? (
        <Text className="text-xs text-red-500 font-medium mb-1 px-1">{uploadError}</Text>
      ) : null}

      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 bg-white border border-gray-200 rounded-[26px] px-3 py-2 min-h-[48px]">
          <TouchableOpacity
            onPress={handlePickPhoto}
            activeOpacity={0.7}
            className="p-2 rounded-full"
          >
            <ImageIcon size={20} color="#667781" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleTakePhoto}
            activeOpacity={0.7}
            className="p-2 rounded-full"
          >
            <Camera size={20} color="#667781" />
          </TouchableOpacity>

          <TextInput
            value={text}
            onChangeText={handleChangeText}
            placeholder={uploading ? 'Uploading photo...' : placeholder}
            placeholderTextColor="#9ca3af"
            editable={!uploading}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              fontSize: 15,
              color: '#111827',
              maxHeight: 120,
              alignSelf: 'center',
              paddingTop: 0,
              paddingBottom: 0,
            }}
            returnKeyType="default"
          />
        </View>

        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || uploading}
          activeOpacity={0.8}
          className={[
            'w-12 h-12 rounded-full items-center justify-center',
            text.trim() && !uploading
              ? 'bg-[#25d366]'
              : 'bg-gray-200',
          ].join(' ')}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#0d3d47" />
          ) : (
            <Send size={19} color={text.trim() ? '#ffffff' : '#9ca3af'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
