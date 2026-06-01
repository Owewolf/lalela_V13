import React from 'react';
import { Alert, Modal, Text, TouchableOpacity, View, Image, ScrollView } from 'react-native';
import { AlertTriangle, Info, MapPin, RefreshCw, Tag } from 'lucide-react-native';
import { CommunityNotice } from '../../types';
import { resolveMediaUrl } from '../../lib/config';
import { ListingHeroMedia } from '../shared/ListingHeroMedia';
import { THEME_COLORS } from '../../theme/colors';

type TopicInfoModalProps = {
  visible: boolean;
  post: CommunityNotice | null;
  loading?: boolean;
  onClose: () => void;
  onOpenChat: () => Promise<void> | void;
};

const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `R${value.toLocaleString()}`;
};

const noticeLabel = (post: CommunityNotice) => {
  const level = String(post.urgencyLevel || '').toLowerCase();
  const urgency = String(post.urgency || '').toLowerCase();
  if (level === 'warning' || urgency === 'high') return 'WARNING';
  if (level === 'info' || urgency === 'normal') return 'INFO';
  return 'GENERAL';
};

const listingLabel = (post: CommunityNotice, supportedShort: string) => {
  if (post.isOpenExchange) return 'EXCHANGE';
  if (supportedShort.length >= 2) return supportedShort;
  return 'CAT';
};

const getPillTone = (label: string) => {
  if (label === 'EXCHANGE') {
    return {
      border: THEME_COLORS.primary,
      bg: THEME_COLORS.primary,
      text: THEME_COLORS.white,
    };
  }
  if (label === 'WARNING') {
    return {
      border: THEME_COLORS.warningBorderStrong,
      bg: THEME_COLORS.warningSurface,
      text: THEME_COLORS.warning,
    };
  }
  if (label === 'INFO') {
    return {
      border: THEME_COLORS.infoBorderStrong,
      bg: THEME_COLORS.infoSurfaceSoft,
      text: THEME_COLORS.brandBlueText,
    };
  }
  if (label === 'GENERAL') {
    return {
      border: THEME_COLORS.tertiaryFixed,
      bg: THEME_COLORS.successSurface,
      text: THEME_COLORS.primary,
    };
  }
  return {
    border: THEME_COLORS.primary,
    bg: THEME_COLORS.primaryTintSoft,
    text: THEME_COLORS.primary,
  };
};

const getPillIcon = (label: string, color: string) => {
  if (label === 'EXCHANGE') return <RefreshCw size={12} color={color} />;
  if (label === 'WARNING') return <AlertTriangle size={12} color={color} />;
  if (label === 'INFO') return <Info size={12} color={color} />;
  return <Tag size={12} color={color} />;
};

export function TopicInfoModal({ visible, post, loading = false, onClose, onOpenChat }: TopicInfoModalProps) {
  const safePost = post;
  if (!safePost) return null;

  const heroImage = safePost.postsImage || (safePost as any).imageUrl || null;
  const supportedShort = String((safePost as any).charity?.supported_short || '').trim().toUpperCase();
  const label = safePost.type === 'listing' ? listingLabel(safePost, supportedShort) : noticeLabel(safePost);
  const tone = getPillTone(label);
  const authorImageUri = resolveMediaUrl(safePost.authorImage || null);

  const localPrice = formatPrice(safePost.communityPrice ?? safePost.price);
  const publicPrice = formatPrice(safePost.publicPrice);
  const catPrice = formatPrice(safePost.charityAmount);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_45 }}>
        <View className="bg-surface-container-low rounded-t-[28px] overflow-hidden">
          <ScrollView bounces={false}>
            <View className="px-6 pt-5 pb-6" style={{ gap: 14 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-black text-primary">{safePost.type === 'listing' ? 'Listing' : 'Notice'} Details</Text>
                <TouchableOpacity onPress={onClose} disabled={loading}>
                  <Text className="text-xl font-bold text-gray-500">×</Text>
                </TouchableOpacity>
              </View>

              <View className="rounded-2xl overflow-hidden border" style={{ borderColor: THEME_COLORS.neutralBorderSoft }}>
                <ListingHeroMedia
                  imageUrl={heroImage}
                  latitude={safePost.latitude}
                  longitude={safePost.longitude}
                  imageHeight={180}
                  imageAspectClassName=""
                  showLocationBadge={false}
                />
                <View className="px-4 pt-4 pb-4 bg-surface-container-low" style={{ gap: 10 }}>
                  <Text className="text-[24px] leading-8 font-black text-neutralTextStrong" numberOfLines={2}>
                    {safePost.title}
                  </Text>

                  <View className="flex-row items-center justify-between">
                    <View
                      className="px-3 py-1 rounded-full border flex-row items-center gap-1.5"
                      style={{ borderColor: tone.border, backgroundColor: tone.bg }}
                    >
                      {getPillIcon(label, tone.text)}
                      <Text className="text-[12px] font-black" style={{ color: tone.text }}>{label}</Text>
                    </View>

                    {authorImageUri ? (
                      <Image source={{ uri: authorImageUri }} style={{ width: 32, height: 32, borderRadius: 16 }} resizeMode="cover" />
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-surface-container items-center justify-center">
                        <Text className="text-[11px] font-bold text-neutralTextMuted">{(safePost.authorName || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View className="rounded-2xl border p-4" style={{ borderColor: THEME_COLORS.neutralBorderSoft, gap: 8 }}>
                <Text className="text-[11px] font-bold uppercase tracking-widest text-neutralTextMuted">Topic information</Text>
                <Text className="text-[14px] font-semibold text-neutralTextStrong">By {safePost.authorName} · {safePost.authorRole || 'Member'}</Text>
                {safePost.description ? (
                  <Text className="text-[14px] leading-5 text-neutralTextSubtle" numberOfLines={4}>{safePost.description}</Text>
                ) : null}
                {safePost.locationName ? (
                  <View className="flex-row items-center gap-1.5">
                    <MapPin size={14} color={THEME_COLORS.neutralTextSubtle} />
                    <Text className="text-[13px] text-neutralTextSubtle">{safePost.locationName}</Text>
                  </View>
                ) : null}
              </View>

              {safePost.type === 'listing' ? (
                <View className="rounded-2xl border p-4" style={{ borderColor: THEME_COLORS.neutralBorderSoft, gap: 6 }}>
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-neutralTextMuted">Pricing</Text>
                  {localPrice ? <Text className="text-[14px] text-neutralTextStrong">Community: {localPrice}</Text> : null}
                  {publicPrice ? <Text className="text-[14px] text-neutralTextStrong">Public: {publicPrice}</Text> : null}
                  {catPrice ? <Text className="text-[14px] text-neutralTextStrong">CAT: {catPrice}</Text> : null}
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  Promise.resolve(onOpenChat()).catch(() => {
                    Alert.alert('Chat unavailable', 'Unable to open this conversation right now.');
                  });
                }}
                disabled={loading}
                className="rounded-full py-4 items-center"
                style={{ backgroundColor: THEME_COLORS.primary }}
              >
                <Text className="text-[13px] font-black uppercase tracking-widest" style={{ color: THEME_COLORS.white }}>
                  {loading ? 'Opening chat...' : 'Open Chat'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
