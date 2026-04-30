import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, Send } from 'lucide-react-native';

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

const THEME_COLORS: Record<string, string> = {
  'bg-primary': '#0d3d47',
  'bg-error': '#dc2626',
  'bg-blue-600': '#2563eb',
  'bg-amber-600': '#d97706',
  'bg-emerald-600': '#059669',
  'bg-secondary': '#6750a4',
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
  const resolvedColor = THEME_COLORS[themeColor] || '#0d3d47';

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
              <Send size={16} color="#fff" style={{ marginLeft: 6 }} />
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 20,
  },
  iconContainer: {
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '900',
    fontSize: 20,
    color: '#1e293b',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#334155',
  },
  boldItalic: {
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#334155',
  },
  titleBox: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    width: '100%',
  },
  postTypeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  postTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
