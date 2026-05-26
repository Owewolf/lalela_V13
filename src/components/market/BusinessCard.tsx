import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { ArrowRight, Phone, Star, Clock, MessageSquare, Globe, MapPin } from 'lucide-react-native';
import { showMapOptions } from '../../lib/maps';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

interface BusinessCardProps {
  name: string;
  distance: string;
  category: string;
  status?: 'Open' | 'Closed';
  image?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  label?: string;
  labelType?: 'top-rated' | 'new';
  neighbors?: number;
  closingTime?: string;
  hasCall?: boolean;
  onChat?: () => void;
  isMemberBusiness?: boolean;
  phone?: string;
  website?: string;
  description?: string;
  address?: string;
  ownerName?: string;
  ownerImage?: string;
  latitude?: number;
  longitude?: number;
}

const sanitizeUrl = (url: string): string | null => {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    /* invalid */
  }
  return null;
};

export const BusinessCard: React.FC<BusinessCardProps> = ({
  name,
  distance,
  category,
  status,
  image,
  icon,
  iconBg,
  iconColor,
  label,
  labelType,
  neighbors,
  closingTime,
  hasCall,
  onChat,
  isMemberBusiness,
  phone,
  website,
  description,
  address,
  ownerName,
  ownerImage,
  latitude,
  longitude,
}) => {
  const [imgError, setImgError] = useState(false);
  const [ownerImgError, setOwnerImgError] = useState(false);
  const safeWebsite = website ? sanitizeUrl(website) : null;
  const removedOwnerLabel = ['my', 'business'].join(' ');
  const visibleLabel = label?.trim().toLowerCase() === removedOwnerLabel ? undefined : label;
  const ownerInitial = ownerName?.trim().charAt(0).toUpperCase();

  const handleCall = () => {
    if (!phone) return;
    const tel = 'tel:' + phone.replace(/[\s\-()]/g, '');
    Linking.openURL(tel).catch(() =>
      Alert.alert('Cannot call', 'Unable to open phone dialer.')
    );
  };

  const handleWebsite = () => {
    if (!safeWebsite) return;
    Linking.openURL(safeWebsite).catch(() =>
      Alert.alert('Cannot open', 'Unable to open the website.')
    );
  };

  return (
    <View
      className={[
        'bg-white rounded-3xl p-4 flex-row gap-4 shadow-sm',
        isMemberBusiness
          ? 'border-2 border-purple-400/60'
          : 'border border-gray-100',
      ].join(' ')}
      style={
        isMemberBusiness
          ? createShadow(THEME_COLORS.aliasHex_a855f7, 0, 0, 0.12, 8, 3)
          : createShadow(THEME_COLORS.black, 0, 0, 0.06, 6, 2)
      }
    >
      {/* Image / Icon area */}
      <View
        className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 items-center justify-center"
        style={{ backgroundColor: iconBg || THEME_COLORS.neutralBgSofter }}
      >
        {image && !imgError ? (
          <Image
            className="w-full h-full"
            source={{ uri: image }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : icon ? (
          <View>{icon}</View>
        ) : (
          <Text
            className="text-3xl font-bold"
            style={{ color: iconColor || THEME_COLORS.primary }}
          >
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
        {labelType === 'top-rated' && (
          <View className="absolute top-1 left-1 bg-amber-400 rounded-full px-1.5 py-0.5 flex-row items-center gap-0.5">
            <Star size={8} color={THEME_COLORS.white} fill={THEME_COLORS.white} />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 justify-between py-0.5 min-w-0">
        <View>
          {/* Name + distance */}
          <View className="flex-row justify-between items-start gap-2">
            <Text
              className="font-bold text-primary text-base leading-tight flex-1"
              numberOfLines={1}
            >
              {name}
            </Text>
            <View className="bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
              <Text className="text-[10px] font-bold text-gray-500">{distance}</Text>
            </View>
          </View>

          {/* Category + status */}
          <Text className="text-gray-400 text-xs mt-0.5">
            {category}
            {status ? (
              <>
                {' • '}
                <Text
                  className={status === 'Open' ? 'text-primary font-medium' : 'text-red-500 font-medium'}
                >
                  {status}
                </Text>
              </>
            ) : null}
          </Text>

          {description ? (
            <Text className="text-gray-400 text-[11px] mt-1 leading-relaxed" numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          {address ? (
            latitude && longitude ? (
              <TouchableOpacity 
                className="flex-row items-center gap-1 mt-1" 
                onPress={() => showMapOptions(latitude, longitude, name)}
              >
                <MapPin size={10} color={THEME_COLORS.brandBlue} />
                <Text className="text-blue-500 text-[10px] flex-1 font-medium" numberOfLines={1}>
                  {address}
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={10} color={THEME_COLORS.neutralTextSoft} />
                <Text className="text-gray-300 text-[10px] flex-1" numberOfLines={1}>
                  {address}
                </Text>
              </View>
            )
          ) : null}
        </View>

        {/* Bottom row */}
        <View className="flex-row items-center justify-between mt-2">
          {/* Left: metadata */}
          <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
            {isMemberBusiness && ownerName ? (
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <View className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 items-center justify-center flex-shrink-0">
                  {ownerImage && !ownerImgError ? (
                    <Image
                      source={{ uri: ownerImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                      onError={() => setOwnerImgError(true)}
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-primary/10">
                      <Text className="text-primary font-bold text-[10px]">
                        {ownerInitial || '?'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-gray-500 text-[11px] font-semibold flex-1" numberOfLines={1}>
                  {ownerName}
                </Text>
              </View>
            ) : neighbors !== undefined ? (
              <View className="flex-row items-center gap-2">
                <View className="flex-row">
                  {[1, 2].map((i) => (
                    <View
                      key={i}
                      className="w-5 h-5 rounded-full border-2 border-white bg-gray-200"
                      style={{ marginLeft: i > 1 ? -8 : 0 }}
                    />
                  ))}
                </View>
                <Text className="text-[10px] text-gray-400 font-medium">
                  {neighbors} neighbors visited
                </Text>
              </View>
            ) : closingTime ? (
              <View className="flex-row items-center gap-1">
                <Clock size={12} color={THEME_COLORS.neutralTextSoft} />
                <Text className="text-[10px] text-gray-400">Closes {closingTime}</Text>
              </View>
            ) : visibleLabel ? (
              <View
                className={[
                  'px-2 py-0.5 rounded',
                  labelType === 'top-rated' ? 'bg-amber-50' : 'bg-surface-container-low',
                ].join(' ')}
              >
                <Text
                  className={[
                    'text-[10px] font-medium',
                    labelType === 'top-rated' ? 'text-amber-700' : 'text-primary',
                  ].join(' ')}
                >
                  {visibleLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Right: action buttons */}
          <View className="flex-row items-center gap-1.5 flex-shrink-0">
            {phone ? (
              <TouchableOpacity
                onPress={handleCall}
                className="w-8 h-8 rounded-full bg-primary items-center justify-center"
                style={createShadow(THEME_COLORS.primary, 0, 0, 0.3, 4, 2)}
                activeOpacity={0.8}
              >
                <Phone size={16} color={THEME_COLORS.white} />
              </TouchableOpacity>
            ) : null}

            {safeWebsite ? (
              <TouchableOpacity
                onPress={handleWebsite}
                className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center"
                activeOpacity={0.8}
              >
                <Globe size={16} color={THEME_COLORS.brandBlueText} />
              </TouchableOpacity>
            ) : null}

            {onChat ? (
              <TouchableOpacity
                onPress={onChat}
                className="w-8 h-8 rounded-full bg-surface-container-low items-center justify-center"
                activeOpacity={0.8}
              >
                <MessageSquare size={16} color={THEME_COLORS.primary} />
              </TouchableOpacity>
            ) : null}

            {!phone && !safeWebsite && !onChat ? (
              hasCall ? (
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-primary items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Phone size={16} color={THEME_COLORS.white} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity activeOpacity={0.8}>
                  <ArrowRight size={20} color={THEME_COLORS.primary} />
                </TouchableOpacity>
              )
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};
