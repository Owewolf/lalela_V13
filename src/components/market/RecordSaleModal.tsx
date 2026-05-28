import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { THEME_COLORS } from '../../theme/colors';

interface RecordSaleModalProps {
  visible: boolean;
  listingTitle: string;
  charityName?: string | null;
  quantityType?: string | null;
  unitPrice: number;
  unitCatAmount: number;
  remainingQuantity: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => Promise<void> | void;
}

export default function RecordSaleModal({
  visible,
  listingTitle,
  charityName,
  quantityType,
  unitPrice,
  unitCatAmount,
  remainingQuantity,
  loading = false,
  onClose,
  onConfirm,
}: RecordSaleModalProps) {
  const [quantityText, setQuantityText] = useState('1');

  useEffect(() => {
    if (visible) {
      setQuantityText('1');
    }
  }, [visible]);

  const parsedQuantity = useMemo(() => {
    const n = Number(quantityText);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.floor(n));
  }, [quantityText]);

  const safeQuantity = Math.min(parsedQuantity, Math.max(1, remainingQuantity));
  const remainingAfterSale = Math.max(0, remainingQuantity - safeQuantity);
  const saleValue = safeQuantity * Math.max(0, Number(unitPrice || 0));
  const catValue = safeQuantity * Math.max(0, Number(unitCatAmount || 0));

  const increment = () => {
    setQuantityText(String(Math.min(remainingQuantity, safeQuantity + 1)));
  };

  const decrement = () => {
    setQuantityText(String(Math.max(1, safeQuantity - 1)));
  };

  const handleConfirm = async () => {
    if (safeQuantity < 1 || safeQuantity > remainingQuantity) {
      Alert.alert('Invalid quantity', `Enter a value between 1 and ${remainingQuantity}.`);
      return;
    }
    await onConfirm(safeQuantity);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_45 }}>
        <View className="bg-surface-container-low rounded-t-[28px] px-6 pt-5 pb-8" style={{ gap: 16 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-black text-primary">Record Sale</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text className="text-xl font-bold text-gray-500">×</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-600" numberOfLines={2}>
            {listingTitle}
          </Text>

          <View className="bg-surface-container rounded-2xl p-4 border" style={{ borderColor: THEME_COLORS.neutralBorderSoft, gap: 10 }}>
            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Quantity to record</Text>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-surface-container-low border"
                style={{ borderColor: THEME_COLORS.neutralBorderSoft }}
                onPress={decrement}
                disabled={loading}
              >
                <Text className="text-lg font-black text-primary">-</Text>
              </TouchableOpacity>

              <TextInput
                value={quantityText}
                onChangeText={(value) => setQuantityText(value.replace(/[^0-9]/g, '') || '1')}
                keyboardType="number-pad"
                editable={!loading}
                className="min-w-[88px] text-center text-2xl font-black text-primary"
                maxLength={5}
              />

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-surface-container-low border"
                style={{ borderColor: THEME_COLORS.neutralBorderSoft }}
                onPress={increment}
                disabled={loading || safeQuantity >= remainingQuantity}
              >
                <Text className="text-lg font-black text-primary">+</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500">Available: {remainingQuantity} {quantityType || 'item(s)'}</Text>
          </View>

          <View className="bg-orange-50 rounded-2xl p-4 border border-orange-100" style={{ gap: 6 }}>
            <Text className="text-sm font-bold text-orange-800">Preview</Text>
            <Text className="text-xs text-orange-900">Sale value: R{saleValue.toFixed(2)}</Text>
            <Text className="text-xs text-orange-900">CAT generated: R{catValue.toFixed(2)}{charityName ? ` (${charityName})` : ''}</Text>
            <Text className="text-xs text-orange-900">Remaining after sale: {remainingAfterSale}</Text>
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={loading}
            className="rounded-full py-4 items-center"
            style={{ backgroundColor: THEME_COLORS.warningStrong }}
          >
            <Text className="text-sm font-black text-primary uppercase tracking-widest">
              {loading ? 'Saving...' : 'Confirm Sale'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
