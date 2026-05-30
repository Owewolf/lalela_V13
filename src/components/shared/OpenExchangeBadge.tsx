import React from 'react';
import { View, Text } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { THEME_COLORS } from '../../theme/colors';

interface OpenExchangeBadgeProps {
  compact?: boolean;
}

export function OpenExchangeBadge({ compact = false }: OpenExchangeBadgeProps) {
  return (
    <View
      className="flex-row items-center gap-1.5 px-3 py-1 rounded-full border self-start"
      style={{
        backgroundColor: THEME_COLORS.primary,
        borderColor: THEME_COLORS.primary,
      }}
    >
      <RefreshCw size={12} color={THEME_COLORS.white} />
      <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME_COLORS.white }}>
        {compact ? 'Exchange' : 'Exchange'}
      </Text>
    </View>
  );
}
