import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, Send } from 'lucide-react-native';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

interface PostConfirmationModalProps {
  isOpen: boolean;
  ctaLabel: string;
  postType: string;
  communityName: string;
  title: string;
  themeColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  customTitle?: string;
  customMessage?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

const THEME_COLOR_CLASS_MAP: Record<string, string> = {
  'bg-primary': THEME_COLORS.primary,
  'bg-error': THEME_COLORS.errorStrong,
  'bg-blue-600': THEME_COLORS.brandBlueText,
  'bg-amber-600': THEME_COLORS.warning,
  'bg-emerald-600': THEME_COLORS.successStrongAlt,
  'bg-secondary': THEME_COLORS.md3Primary,
};
const TYPE_SCALE = {
  sm: 9,
  body: 13,
  lg: 14,
  title: 20,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xs: 4,
  sm: 6,
  md: 8,
  s10: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  s24: 24,
  s32: 32,
  s64: 64,
};
const RADIUS = {
  md: 16,
  lg: 24,
  full: 32,
};
const LINE_HEIGHT = {
  body: 20,
};
const LETTER_SPACING = {
  wide: 1.5,
};

export const PostConfirmationModal: React.FC<PostConfirmationModalProps> = ({
  isOpen,
  ctaLabel,
  postType,
  communityName,
  title,
  themeColor,
  onConfirm,
  onCancel,
  customTitle,
  customMessage,
  cancelLabel,
  confirmLabel,
  confirmDisabled = false,
}) => {
  const resolvedColor = THEME_COLOR_CLASS_MAP[themeColor] || THEME_COLORS.primary;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: resolvedColor + '1A' }]}>
              <AlertCircle size={32} color={resolvedColor} />
            </View>
            <Text style={styles.modalTitle}>{customTitle ?? 'Confirm Your Post'}</Text>
            {customMessage ? (
              <Text style={styles.modalMessage}>{customMessage}</Text>
            ) : (
              <Text style={styles.modalMessage}>
                You are about to{' '}
                <Text style={styles.bold}>{ctaLabel}</Text>
                {' '}in{' '}
                <Text style={styles.boldItalic}>{communityName}</Text>
                . Please confirm this is correct.
              </Text>
            )}
            {!!title && (
              <View style={styles.titleBox}>
                <Text style={styles.postTypeLabel}>{postType}</Text>
                <Text style={styles.postTitle} numberOfLines={2}>{title}</Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>{cancelLabel ?? 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: resolvedColor },
                confirmDisabled && styles.disabledBtn,
              ]}
              onPress={onConfirm}
              disabled={confirmDisabled}
            >
              <Text style={styles.confirmBtnText}>{confirmLabel ?? ctaLabel}</Text>
              <Send size={SPACE.xl} color={THEME_COLORS.white} style={{ marginLeft: SPACE.sm }} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.s24,
  },
  card: {
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACE.s32,
    width: '100%',
    maxWidth: 380,
    ...createShadow(THEME_COLORS.black, 0, 8, 0.18, 24, 8),
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorder,
    gap: SPACE.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    gap: SPACE.md,
  },
  iconCircle: {
    width: SPACE.s64,
    height: SPACE.s64,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  modalTitle: {
    fontWeight: FONT_WEIGHT.black,
    fontSize: TYPE_SCALE.title,
    color: THEME_COLORS.aliasHex_1e293b,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: TYPE_SCALE.body,
    color: THEME_COLORS.neutralTextSubtle,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.body,
  },
  bold: {
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
  },
  boldItalic: {
    fontWeight: FONT_WEIGHT.bold,
    fontStyle: 'italic',
    color: THEME_COLORS.neutralTextHeading,
  },
  titleBox: {
    marginTop: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.s10,
    backgroundColor: THEME_COLORS.neutralBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBgSoft,
    width: '100%',
  },
  postTypeLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: SPACE.xs,
  },
  postTitle: {
    fontSize: TYPE_SCALE.body,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACE.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: THEME_COLORS.neutralBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: THEME_COLORS.neutralTextDefault,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: TYPE_SCALE.lg,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: {
    color: THEME_COLORS.white,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: TYPE_SCALE.lg,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
