import React from 'react';
import { View, Text, Image } from 'react-native';
import { Gift } from 'lucide-react-native';
import { Conversation, ConversationMetadata } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

interface ChatContextCardProps {
  conversationType: Conversation['type'];
  metadata?: ConversationMetadata;
  collapsed?: boolean;
}

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.\-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatCurrency = (symbol: string, value: number | null): string | null => {
  if (value == null) return null;
  const isWhole = Math.abs(value % 1) < 0.001;
  return `${symbol}${isWhole ? value.toFixed(0) : value.toFixed(2)}`;
};

export const ChatContextCard: React.FC<ChatContextCardProps> = ({
  conversationType,
  metadata,
  collapsed = false,
}) => {
  if (!metadata) return null;
  if (conversationType !== 'listing' && conversationType !== 'notice') return null;

  const title = metadata.listing_title || metadata.notice_title || metadata.title;
  if (!title) return null;

  const thumbnail = metadata.thumbnail_url || metadata.image;
  const currencySymbol = metadata.currency_symbol || 'R';

  const communityPrice = parseNumeric(metadata.community_price ?? metadata.price);
  const publicPrice = parseNumeric(metadata.public_price);
  const charityShort = metadata.charity?.supported_short;
  const charityContribution = parseNumeric(metadata.charity?.contribution_per_item ?? metadata.charity_price);

  if (collapsed) {
    return (
      <View
        className="px-3 py-2 border-b"
        style={{
          borderBottomColor: THEME_COLORS.neutralBorderSoft,
          backgroundColor: THEME_COLORS.whiteOverlay90,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-[13px] font-semibold flex-1" numberOfLines={1} style={{ color: THEME_COLORS.chatTextStrong }}>
            {title}
          </Text>
          {communityPrice != null ? (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: THEME_COLORS.primaryTintSoft }}>
              <Text className="text-[11px] font-bold" style={{ color: THEME_COLORS.primary }}>
                {formatCurrency(currencySymbol, communityPrice)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      className="mx-3 mt-2 mb-1 px-2.5 py-2 rounded-xl border"
      style={{
        borderColor: THEME_COLORS.neutralBorderSoft,
        backgroundColor: THEME_COLORS.white,
      }}
    >
      <View className="flex-row items-center gap-2.5">
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} className="w-12 h-12 rounded-lg" resizeMode="cover" />
        ) : (
          <View className="w-12 h-12 rounded-lg items-center justify-center" style={{ backgroundColor: THEME_COLORS.chatAvatarSurface }}>
            <Text className="text-[16px] font-bold" style={{ color: THEME_COLORS.chatTextStrong }}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1 min-w-0">
          <Text className="text-[14px] font-bold" numberOfLines={1} style={{ color: THEME_COLORS.chatTextStrong }}>
            {title}
          </Text>

          {conversationType === 'listing' ? (
            <View className="flex-row items-center flex-wrap mt-0.5">
              {communityPrice != null ? (
                <Text className="text-[12px] font-bold" style={{ color: THEME_COLORS.primary }}>
                  Community: {formatCurrency(currencySymbol, communityPrice)}
                </Text>
              ) : null}
              {communityPrice != null && publicPrice != null ? (
                <Text className="text-[12px] mx-1" style={{ color: THEME_COLORS.neutralTextSoft }}>
                  |
                </Text>
              ) : null}
              {publicPrice != null ? (
                <Text className="text-[12px]" style={{ color: THEME_COLORS.neutralTextMuted }}>
                  Public: {formatCurrency(currencySymbol, publicPrice)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text className="text-[12px] mt-0.5" numberOfLines={1} style={{ color: THEME_COLORS.neutralTextMuted }}>
              Notice context
            </Text>
          )}

          {conversationType === 'listing' && charityShort && charityContribution != null ? (
            <View className="flex-row items-center gap-1 mt-1">
              <Gift size={11} color={THEME_COLORS.secondary} />
              <Text className="text-[11px]" numberOfLines={1} style={{ color: THEME_COLORS.neutralTextMuted }}>
                Supports {charityShort} ({formatCurrency(currencySymbol, charityContribution)}/item)
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};
